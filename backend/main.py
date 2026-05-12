import socketio
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import os
import time

from state_manager import StateManager
from hardware_manager import HardwareManager
from db_manager import DatabaseManager
from production_manager import ProductionManager

# --- Altyapı ---
app = FastAPI()
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
socket_app = socketio.ASGIApp(sio, app)

# Ana event loop'u saklamak için değişken
main_loop = None

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

db = DatabaseManager()
hw = HardwareManager()
state = StateManager(db, hw)
prod = ProductionManager(state, hw, db)

# Donanım başlat (Database'deki en güncel yapılandırmayı uygula)
hw.apply_config(state.data.get("nanos", []), state.data.get("sensors", []))

# Arayüze güvenli veri gönderme (Thread-Safe)
def safe_emit():
    if main_loop and main_loop.is_running():
        main_loop.call_soon_threadsafe(
            lambda: asyncio.create_task(sio.emit('STATE_UPDATE', state.data))
        )

# GPIO callback'lerini bağla
hw.on_input_detected = lambda: safe_emit() or state.increment_input()
hw.on_output_detected = lambda: safe_emit() or state.increment_output()


# --- Yardımcı ---
def refresh_ports():
    """HardwareManager üzerinden güncel portları al."""
    return hw.get_available_ports()

# --- Socket Olayları ---
@sio.event
async def connect(sid, environ):
    print(f"[SOCKET] Bağlandı: {sid}")
    state.data["serialPorts"] = refresh_ports()
    await sio.emit('STATE_UPDATE', state.data, room=sid)

@sio.on('ACTION')
async def handle_action(sid, data):
    action_type = data.get('type')
    payload = data.get('payload', {})
    print(f"[ACTION] {action_type}")

    # --- Sistem Modu ---
    if action_type == 'SET_MODE':
        state.set_mode(payload.get('mode'))
    elif action_type == 'START_AUTO_CYCLE':
        state.start_auto()
    elif action_type == 'EMERGENCY_STOP':
        state.set_mode('ARIZA')
        hw.all_off()
    elif action_type == 'ACKNOWLEDGE_STARTUP':
        state.set_mode('BEKLEMEDE')
    elif action_type == 'ACKNOWLEDGE_FAULT':
        state.set_mode('BEKLEMEDE')
    elif action_type == 'TRIGGER_FAULT':
        state.set_mode('ARIZA')
    elif action_type == 'REQUEST_STOP_AFTER_CYCLE':
        state.data["stopAfterCycleRequested"] = True

    # --- Port Tarama ---
    elif action_type == 'SCAN_PORTS':
        state.data["serialPorts"] = refresh_ports()
        print(f"[PORT] Bulunanlar: {state.data['serialPorts']}")

    # --- Valf ---
    elif action_type == 'TOGGLE_VALVE':
        state.toggle_valve_manual(payload.get('id'))
    elif action_type == 'ADD_VALVE':
        valves = state.data.get("valves", [])
        valves.append(payload.get("valve"))
        state.data["valves"] = valves
        db.save_state("valves", valves)
    elif action_type == 'REMOVE_VALVE':
        valves = [v for v in state.data.get("valves", []) if v["id"] != payload.get("id")]
        state.data["valves"] = valves
        db.save_state("valves", valves)
    elif action_type == 'UPDATE_VALVE':
        valves = state.data.get("valves", [])
        for v in valves:
            if v["id"] == payload.get("id"):
                v.update(payload.get("updates", {}))
        state.data["valves"] = valves
        db.save_state("valves", valves)
    elif action_type == 'SET_VALVE_MODE':
        valves = state.data.get("valves", [])
        for v in valves:
            if v["id"] == payload.get("id"):
                v["mode"] = payload.get("mode")
        state.data["valves"] = valves
        db.save_state("valves", valves)

    # --- Sensör ---
    elif action_type == 'ADD_SENSOR':
        sensors = state.data.get("sensors", [])
        sensors.append(payload.get("sensor"))
        state.data["sensors"] = sensors
        db.save_state("sensors", sensors)
        hw.apply_config(state.data.get("nanos", []), sensors)
    elif action_type == 'REMOVE_SENSOR':
        sensors = [s for s in state.data.get("sensors", []) if s["id"] != payload.get("id")]
        state.data["sensors"] = sensors
        db.save_state("sensors", sensors)
        hw.apply_config(state.data.get("nanos", []), sensors)
    elif action_type == 'UPDATE_SENSOR':
        sensors = state.data.get("sensors", [])
        for s in sensors:
            if s["id"] == payload.get("id"):
                s.update(payload.get("updates", {}))
        state.data["sensors"] = sensors
        db.save_state("sensors", sensors)
        hw.apply_config(state.data.get("nanos", []), sensors)
    elif action_type == 'TOGGLE_SENSOR_ENABLED':
        sensors = state.data.get("sensors", [])
        for s in sensors:
            if s["id"] == payload.get("id"):
                s["enabled"] = not s.get("enabled", True)
        state.data["sensors"] = sensors
        db.save_state("sensors", sensors)
        hw.apply_config(state.data.get("nanos", []), sensors)

    # --- Nano / Arduino ---
    elif action_type == 'ADD_HARDWARE':
        nanos = state.data.get("nanos", [])
        nanos.append(payload.get("nano"))
        state.data["nanos"] = nanos
        db.save_state("nanos", nanos)
        hw.apply_config(nanos, state.data.get("sensors", []))
    elif action_type == 'UPDATE_NANO_CONFIG':
        nanos = state.data.get("nanos", [])
        for n in nanos:
            if n["id"] == payload.get("id"):
                n.update(payload.get("config", {}))
        state.data["nanos"] = nanos
        db.save_state("nanos", nanos)
        hw.apply_config(nanos, state.data.get("sensors", []))
    elif action_type == 'REMOVE_HARDWARE':
        nanos = [n for n in state.data.get("nanos", []) if n["id"] != payload.get("id")]
        state.data["nanos"] = nanos
        db.save_state("nanos", nanos)
        hw.apply_config(nanos, state.data.get("sensors", []))
    elif action_type == 'SEND_NANO_COMMAND':
        hw.send_command(payload.get('cmd'), target_port=payload.get('port'))

    # --- Kapılar ---
    elif action_type == 'UPDATE_SYSTEM_GATE':
        target = payload.get("target")
        if target in state.data:
            state.data[target].update(payload.get("updates", {}))
            db.save_state(target, state.data[target])
    elif action_type == 'TOGGLE_GATE_ENABLED':
        target = payload.get("target") or payload.get("id")
        if target and target in state.data:
            state.data[target]["enabled"] = not state.data[target].get("enabled", True)
            db.save_state(target, state.data[target])
    elif action_type == 'RESET_COUNTER':
        key = "inputCount" if payload.get("target") == 'input' else "outputCount"
        state.data[key] = 0

    # --- Reçete ---
    elif action_type == 'ADD_RECIPE':
        db.add_recipe(payload.get("recipe"))
        state.data["recipes"] = db.get_recipes()
    elif action_type == 'REMOVE_RECIPE':
        db.remove_recipe(payload.get("id"))
        state.data["recipes"] = db.get_recipes()
    elif action_type == 'UPDATE_RECIPE':
        db.update_recipe(payload.get("id"), payload.get("updates", {}))
        state.data["recipes"] = db.get_recipes()
    elif action_type == 'SELECT_RECIPE':
        state.data["config"]["recipeId"] = payload.get("id")
        db.save_state("config", state.data["config"])

    # --- Konfig ---
    elif action_type == 'UPDATE_CONFIG':
        state.data["config"].update(payload.get("config", {}))
        db.save_state("config", state.data["config"])

    await sio.emit('STATE_UPDATE', state.data)

# --- Arka Plan Döngüsü ---
async def broadcast_loop():
    while True:
        # Serial'den gelen sensör veya ACK bilgilerini oku
        hw.update()
        
        state.data["serialPorts"] = refresh_ports()
        
        # Nano bağlantı durumlarını kontrol et ve kopanları geri bağla
        for n in state.data.get("nanos", []):
            port = n.get("port")
            if port:
                is_online = hw.is_port_online(port)
                if not is_online:
                    # Kopmuşsa tekrar bağlanmayı dene
                    hw.connect_to_port(port, n.get("baudRate", 9600))
                    is_online = hw.is_port_online(port)
                
                n["status"] = "ONLINE" if is_online else "OFFLINE"
        
        await sio.emit('STATE_UPDATE', state.data)
        await asyncio.sleep(2)

@app.on_event("startup")
async def startup_event():
    global main_loop
    main_loop = asyncio.get_event_loop()
    asyncio.create_task(broadcast_loop())
    asyncio.create_task(prod.run_loop())

if __name__ == "__main__":
    print("\n" + "="*50)
    print("   PLGAZOZ BACKEND - PORT 8000")
    print("="*50 + "\n")
    uvicorn.run(socket_app, host="0.0.0.0", port=8000, log_level="warning")

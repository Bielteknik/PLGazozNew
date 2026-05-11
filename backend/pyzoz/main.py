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

# --- Altyapı ---
app = FastAPI()
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
socket_app = socketio.ASGIApp(sio, app)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

db = DatabaseManager()
hw = HardwareManager()
state = StateManager(db, hw)

# Donanım başlat (hata olsa da devam et)
hw.connect_serial()
hw.setup_gpio()

# --- Yardımcı ---
def refresh_ports():
    """Pi 5 için: pyserial + manuel /dev kontrol"""
    ports = [p.device for p in __import__('serial').tools.list_ports.comports()]
    for i in range(4):
        for prefix in ['/dev/ttyUSB', '/dev/ttyACM']:
            p = f"{prefix}{i}"
            if os.path.exists(p) and p not in ports:
                ports.append(p)
    # Şu an nano'larda tanımlı portları da ekle
    for n in state.data.get("nanos", []):
        if n.get("port") and n.get("port") not in ports:
            ports.append(n.get("port"))
    return sorted(set(ports))

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
    elif action_type == 'REMOVE_SENSOR':
        sensors = [s for s in state.data.get("sensors", []) if s["id"] != payload.get("id")]
        state.data["sensors"] = sensors
        db.save_state("sensors", sensors)
    elif action_type == 'UPDATE_SENSOR':
        sensors = state.data.get("sensors", [])
        for s in sensors:
            if s["id"] == payload.get("id"):
                s.update(payload.get("updates", {}))
        state.data["sensors"] = sensors
        db.save_state("sensors", sensors)
    elif action_type == 'TOGGLE_SENSOR_ENABLED':
        sensors = state.data.get("sensors", [])
        for s in sensors:
            if s["id"] == payload.get("id"):
                s["enabled"] = not s.get("enabled", True)
        state.data["sensors"] = sensors
        db.save_state("sensors", sensors)

    # --- Nano / Arduino ---
    elif action_type == 'ADD_HARDWARE':
        nanos = state.data.get("nanos", [])
        nanos.append(payload.get("nano"))
        state.data["nanos"] = nanos
        db.save_state("nanos", nanos)
    elif action_type == 'REMOVE_HARDWARE':
        nanos = [n for n in state.data.get("nanos", []) if n["id"] != payload.get("id")]
        state.data["nanos"] = nanos
        db.save_state("nanos", nanos)
    elif action_type == 'UPDATE_NANO_CONFIG':
        nanos = state.data.get("nanos", [])
        for n in nanos:
            if n["id"] == payload.get("id"):
                n.update(payload.get("config", {}))
                # Port atandıysa bağlanmayı dene
                if "port" in payload.get("config", {}) or "baudRate" in payload.get("config", {}):
                    port = n.get("port")
                    baud = n.get("baudRate", 115200)
                    if port:
                        success = hw.connect_to_port(port, baud)
                        n["status"] = "ONLINE" if success else "OFFLINE"
                        print(f"[NANO] {port} bağlantı: {'ONLINE' if success else 'OFFLINE'}")
        state.data["nanos"] = nanos
        db.save_state("nanos", nanos)
    elif action_type == 'SEND_NANO_COMMAND':
        hw.send_serial(f"{payload.get('cmd')}\n")

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
        state.data["serialPorts"] = refresh_ports()
        
        # Nano bağlantı durumlarını kontrol et
        for n in state.data.get("nanos", []):
            if n.get("port"):
                is_connected = hw.serial_conn and hw.serial_conn.is_open and hw.serial_conn.port == n.get("port")
                n["status"] = "ONLINE" if is_connected else "OFFLINE"
        
        await sio.emit('STATE_UPDATE', state.data)
        await asyncio.sleep(2)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(broadcast_loop())

if __name__ == "__main__":
    print("\n" + "="*50)
    print("   PLGAZOZ BACKEND - PORT 8000")
    print("="*50 + "\n")
    uvicorn.run(socket_app, host="0.0.0.0", port=8000, log_level="warning")

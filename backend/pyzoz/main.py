import socketio
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json

from state_manager import StateManager
from hardware_manager import HardwareManager
from db_manager import DatabaseManager

# 1. Altyapıyı Hazırla
app = FastAPI()
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
socket_app = socketio.ASGIApp(sio, app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

db = DatabaseManager()
hw = HardwareManager()
state = StateManager(db, hw)

# Donanımı Başlat
hw.connect_serial()
hw.setup_gpio()

# Port listesini state'e ekle
state.data["serialPorts"] = hw.get_available_ports()

# 3. Socket.io Olayları
@sio.event
async def connect(sid, environ):
    ports = hw.get_available_ports()
    state.data["serialPorts"] = ports
    print(f"[Socket] İstemci bağlandı: {sid}")
    await sio.emit('AVAILABLE_PORTS', ports, room=sid)
    await sio.emit('STATE_UPDATE', state.data, room=sid)

@sio.on('ACTION')
async def handle_action(sid, data):
    action_type = data.get('type')
    payload = data.get('payload', {})
    
    print(f"[Action] Alınan Aksiyon: {action_type}")
    
    # --- SİSTEM MODLARI ---
    if action_type == 'SET_MODE':
        state.set_mode(payload.get('mode'))
    elif action_type == 'START_AUTO_CYCLE':
        state.start_auto()
    elif action_type == 'EMERGENCY_STOP':
        state.set_mode('ACIL_DURDUR')
        hw.all_off()
    elif action_type == 'ACKNOWLEDGE_STARTUP':
        state.set_mode('BEKLEMEDE')
    elif action_type == 'ACKNOWLEDGE_FAULT':
        state.set_mode('BEKLEMEDE')
    elif action_type == 'TRIGGER_FAULT':
        state.set_mode('ARIZA')
    elif action_type == 'REQUEST_STOP_AFTER_CYCLE':
        state.data["stopAfterCycleRequested"] = True

    # --- VALF YÖNETİMİ ---
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

    # --- SENSÖR YÖNETİMİ ---
    elif action_type == 'ADD_SENSOR':
        sensors = state.data.get("sensors", [])
        sensors.append(payload.get("sensor"))
        state.data["sensors"] = sensors
        db.save_state("sensors", sensors)
        hw.setup_gpio() # Yeni sensörü GPIO'ya bağla
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

    # --- NANO / ARDUINO YÖNETİMİ ---
    elif action_type == 'ADD_HARDWARE': # React'te Nano için ADD_HARDWARE kullanılıyor
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
        state.data["nanos"] = nanos
        db.save_state("nanos", nanos)
    elif action_type == 'SEND_NANO_COMMAND':
        hw.send_serial(f"{payload.get('cmd')}\n")
    elif action_type == 'SCAN_PORTS':
        ports = hw.get_available_ports()
        state.data["serialPorts"] = ports
        await sio.emit('AVAILABLE_PORTS', ports)

    # --- KAPILAR VE DİĞERLERİ ---
    elif action_type == 'UPDATE_SYSTEM_GATE':
        target = payload.get("target")
        state.data[target].update(payload.get("updates", {}))
        db.save_state(target, state.data[target])
    elif action_type == 'TOGGLE_GATE_ENABLED':
        target = payload.get("target")
        if target in state.data:
            state.data[target]["enabled"] = not state.data[target].get("enabled", True)
            db.save_state(target, state.data[target])
    elif action_type == 'RESET_COUNTER':
        if payload.get("target") == 'input':
            state.data["inputCount"] = 0
        else:
            state.data["outputCount"] = 0

    # --- REÇETE YÖNETİMİ ---
    elif action_type == 'ADD_RECIPE':
        db.add_recipe(payload.get("recipe"))
        state.data["recipes"] = db.get_recipes()
    elif action_type == 'REMOVE_RECIPE':
        db.remove_recipe(payload.get("id"))
        state.data["recipes"] = db.get_recipes()
    elif action_type == 'UPDATE_RECIPE':
        db.update_recipe(payload.get("id"), payload.get("updates"))
        state.data["recipes"] = db.get_recipes()
    elif action_type == 'SELECT_RECIPE':
        config = state.data.get("config", {})
        config["recipeId"] = payload.get("id")
        state.data["config"] = config
        db.save_state("config", config)

    elif action_type == 'UPDATE_CONFIG':
        config = state.data.get("config", {})
        config.update(payload.get("config", {}))
        state.data["config"] = config
        db.save_state("config", config)

    # Her aksiyondan sonra güncel durumu tüm istemcilere gönder
    await sio.emit('STATE_UPDATE', state.data)

# State Manager'dan gelen güncellemeleri yayınla
async def state_broadcast_loop():
    while True:
        await sio.emit('STATE_UPDATE', state.data)
        await asyncio.sleep(0.5)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(state_broadcast_loop())

if __name__ == "__main__":
    uvicorn.run(socket_app, host="0.0.0.0", port=8000)

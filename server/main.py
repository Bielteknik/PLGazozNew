import asyncio
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio
from hardware import hw
from database import db
from sensors import sensors
from production import ProductionManager

app = FastAPI()
# Socket.io setup
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
socket_app = socketio.ASGIApp(sio, app)

# Production Logic Manager
pm = ProductionManager(sio)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"name": "PLGazoz Backend", "version": "1.0.0", "hardware": "Raspberry Pi + Arduino Nano"}

@app.get("/ports")
def get_ports():
    return {"ports": hw.scan_ports()}

@app.get("/data")
def get_all_data():
    """Tüm veritabanı içeriğini tek seferde döndürür."""
    return {
        "recipes": db.get_recipes(),
        "config": db.get_config(),
        "history": db.get_history()
    }

@app.post("/recipes")
async def save_recipe(recipe: dict):
    db.save_recipe(recipe)
    return {"status": "ok"}

@app.delete("/recipes/{recipe_id}")
def delete_recipe(recipe_id: str):
    db.delete_recipe(recipe_id)
    return {"status": "ok"}

@app.post("/config")
async def save_config(config: dict):
    db.save_config(config)
    pm.set_config(config)
    return {"status": "ok"}

@sio.on("SET_MODE")
async def handle_set_mode(sid, mode):
    pm.set_mode(mode)
    await pm.broadcast_update()

@sio.on("START_AUTO_CYCLE")
async def handle_start_auto(sid, data=None):
    await pm.start_auto_cycle()

@sio.on("STOP_AUTO_CYCLE")
async def handle_stop_auto(sid, data=None):
    pm.set_mode("BEKLEMEDE")
    await pm.broadcast_update()
    # Kapatılması gereken valfleri kapat
    for i in range(1, 11):
        hw.set_valve("COM4", i, False)

@sio.event
async def connect(sid, environ):
    print(f"HMI connected: {sid}")

@sio.on("VALVE_CONTROL")
async def handle_valve(sid, data):
    # data: {"port": str, "id": int, "state": bool}
    hw.set_valve(data['port'], data['id'], data['state'])

@sio.on("GATE_CONTROL")
async def handle_gate(sid, data):
    # data: {"port": str, "id": int, "pos": int}
    hw.set_gate(data['port'], data['id'], data['pos'])

@sio.on("SAVE_HISTORY")
async def handle_history(sid, passport):
    db.add_history(passport)

@sio.on("SYNC_HARDWARE")
async def handle_sync(sid, data):
    """Tüm pin ve hız ayarlarını Arduinolara gönderir."""
    # data: {"valves": [], "gates": []}
    for v in data.get('valves', []):
        hw.sync_valve_config(v)
    
    # Giriş/Çıkış kilitleri ve ekstra kilitler
    gates = data.get('gates', [])
    for g in gates:
        hw.sync_gate_config(g)
    
    print(f"Hardware sync completed for {sid}")

@sio.on("SET_PORT_MAPPING")
async def handle_port_mapping(sid, mapping):
    """
    mapping: {'NANO-1': '/dev/ttyUSB0', 'NANO-2': '/dev/ttyACM0'}
    """
    hw.set_port_mapping(mapping)

async def sensor_worker():
    """Arka planda sensörleri sürekli tarar ve değişiklik olduğunda HMI'a bildirir."""
    last_states = {}
    SENSORS = [17, 27, 22] 
    
    while True:
        try:
            # Dijital Sensörler (Lazer)
            current_states = {}
            for pin in SENSORS:
                current_states[pin] = hw.read_sensor(pin)
            
            if current_states != last_states:
                await sio.emit("SENSOR_STATES", current_states)
                await pm.update(current_states)
                last_states = current_states.copy()
            else:
                # Durum değişmese bile zamanlayıcıları işletmek için update çağırılmalı
                await pm.update(current_states)
            
            # Mesafe Sensörü (Analog/Ultrasonik)
            distance = sensors.read_distance()
            await sio.emit("DISTANCE_UPDATE", {"value": distance})
            
        except Exception as e:
            print(f"Sensor Worker Error: {e}")
            
        await asyncio.sleep(0.02) # Optimized to 20ms

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(sensor_worker())

if __name__ == "__main__":
    uvicorn.run(socket_app, host="0.0.0.0", port=8000)

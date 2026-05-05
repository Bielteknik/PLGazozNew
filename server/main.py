import asyncio
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio
from hardware import hw
from database import db
from sensors import sensors

app = FastAPI()
# Socket.io setup
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
socket_app = socketio.ASGIApp(sio, app)

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
    return {"status": "ok"}

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
                last_states = current_states.copy()
            
            # Mesafe Sensörü (Analog/Ultrasonik)
            distance = sensors.read_distance()
            await sio.emit("DISTANCE_UPDATE", {"value": distance})
            
        except Exception as e:
            print(f"Sensor Worker Error: {e}")
            
        await asyncio.sleep(0.05)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(sensor_worker())

if __name__ == "__main__":
    uvicorn.run(socket_app, host="0.0.0.0", port=8000)

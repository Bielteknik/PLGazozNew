from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio
import uvicorn
from db_manager import DatabaseManager
from hardware_manager import HardwareManager
from state_manager import StateManager
import os

# 1. Altyapı Kurulumu
app = FastAPI()
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
socket_app = socketio.ASGIApp(sio, app)

# CORS Ayarları
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Yöneticileri Başlat
db = DatabaseManager()
hw = HardwareManager()
state = StateManager(db, hw)

# Donanımı Başlat
hw.connect_serial()
hw.setup_gpio()

# 3. Socket.io Olayları
@sio.event
async def connect(sid, environ):
    print(f"[Socket] İstemci bağlandı: {sid}")
    await sio.emit('STATE_UPDATE', state.data, room=sid)

@sio.on('ACTION')
async def handle_action(sid, data):
    action_type = data.get('type')
    payload = data.get('payload', {})
    
    print(f"[Action] Alınan Aksiyon: {action_type}")
    
    if action_type == 'SET_MODE':
        state.set_mode(payload.get('mode'))
    elif action_type == 'START_AUTO':
        state.start_auto()
    elif action_type == 'TOGGLE_VALVE':
        state.toggle_valve_manual(payload.get('id'))
    elif action_type == 'EMERGENCY_STOP':
        state.set_mode('ACIL_DURDUR')
        hw.all_off()
        
    # Her aksiyondan sonra güncel durumu gönder
    await sio.emit('STATE_UPDATE', state.data)

# State Manager'dan gelen güncellemeleri yayınla
def broadcast_state(new_data):
    # Bu fonksiyon asenkron socketio ile uyumlu çalışması için bir köprüdür
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.run_coroutine_threadsafe(sio.emit('STATE_UPDATE', new_data), loop)
    except Exception as e:
        pass

state.on_state_change = broadcast_state

# 4. API Rotaları
@app.get("/")
async def root():
    return {"status": "Pyzoz Backend Aktif", "device": "Raspberry Pi 5"}

@app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    print("[Pyzoz] Sunucu 8000 portunda başlatılıyor...")
    uvicorn.run(socket_app, host="0.0.0.0", port=8000)

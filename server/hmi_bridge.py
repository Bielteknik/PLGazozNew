import eventlet
import socketio
import threading
import time
from hardware import hw
from production import ProductionManager
from database import db

# Socket.io Sunucusu Ayarları
sio = socketio.Server(cors_allowed_origins='*')
app = socketio.WSGIApp(sio)

pm = ProductionManager()

def production_callback(data):
    """Üretim verileri her değiştiğinde Flutter'a gönderir."""
    sio.emit('production_update', data)

pm.register_callback(production_callback)

@sio.event
def connect(sid, environ):
    print(f"HMI Bağlandı: {sid}")
    # İlk bağlantıda güncel verileri gönder
    sio.emit('production_update', {
        'inputCount': pm.input_count,
        'outputCount': pm.output_count,
        'state': pm.state,
        'mode': pm.mode
    })

@sio.on('set_mode')
def handle_set_mode(sid, mode):
    print(f"Yeni Mod Talebi: {mode}")
    pm.set_mode(mode)
    if mode == 'OTOMATİK':
        threading.Thread(target=pm.start_auto_cycle_sync).start()

@sio.on('toggle_valve')
def handle_toggle_valve(sid, valve_id):
    print(f"Manuel Valf Kontrolü: {valve_id}")
    hw.set_valve("NANO-2", valve_id, True)
    time.sleep(1) # Örnek: 1 saniye sonra kapat
    hw.set_valve("NANO-2", valve_id, False)

@sio.on('set_gate')
def handle_set_gate(sid, data):
    # data: {'id': 1, 'pos': 100}
    print(f"Manuel Kapı Kontrolü: {data}")
    hw.set_gate("NANO-1", data['id'], data['pos'])

@sio.on('load_recipe')
def handle_load_recipe(sid, recipe_data):
    print(f"Reçete Yükleniyor: {recipe_data['name']}")
    pm.set_config(recipe_data)
    db.save_config(recipe_data)

def sensor_worker():

    """Arka planda sensörleri tarar ve Flutter'a yayınlar."""
    SENSORS = [17, 27, 22]
    while True:
        states = {}
        for pin in SENSORS:
            states[str(pin)] = hw.read_sensor(pin)
        
        sio.emit('sensor_update', states)
        pm.update_sync(states) # Mantık döngüsünü işlet
        time.sleep(0.05)

if __name__ == '__main__':
    # Sensör tarama thread'ini başlat
    threading.Thread(target=sensor_worker, daemon=True).start()
    
    # Sunucuyu başlat (Port 5000)
    print("Flutter HMI Köprüsü 5000 portunda çalışıyor...")
    eventlet.wsgi.server(eventlet.listen(('', 5000)), app)

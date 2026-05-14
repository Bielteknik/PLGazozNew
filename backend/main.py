import socketio
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import os
import time
from contextlib import asynccontextmanager

from state_manager import StateManager
from hardware_manager import HardwareManager
from db_manager import DatabaseManager
from production_manager import ProductionManager

# --- Lifespan ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global main_loop
    main_loop = asyncio.get_event_loop()
    
    # 1. Her şeyi sıfırla (Temiz Sayfa)
    db.reset_hardware_links()
    state.reload_from_db() # Ham veriyle ezmek yerine güvenli yükleme yap
    
    # 2. İlk Taramayı Yap
    print("[Startup] Donanım aranıyor...")
    for target in ['GatesNano', 'ValvesNano']:
        if hw.find_and_connect(target):
            # Bulunan nanoyu listeye ekle
            port = next((p for p, d_id in hw.port_to_id_map.items() if d_id == target), None)
            if port:
                new_nano = {"id": target, "name": "Kilit ve Sensörler" if target == "GatesNano" else "Valf Kontrol", "port": port, "status": "ONLINE", "baudRate": 115200}
                state.data["nanos"].append(new_nano)
                db.save_state("nanos", state.data["nanos"])
                
                # Otonom Eşleştirme Yap
                if target == 'ValvesNano':
                    for v in state.data["valves"]: v["nanoId"] = "ValvesNano"
                    db.save_state("valves", state.data["valves"])
                else:
                    for s in state.data["sensors"]:
                        s["device"] = "GatesNano"
                    state.data["inputGate"]["nanoId"] = "GatesNano"
                    state.data["outputGate"]["nanoId"] = "GatesNano"
                    db.save_state("sensors", state.data["sensors"])
                    db.save_state("inputGate", state.data["inputGate"])
                    db.save_state("outputGate", state.data["outputGate"])
    
    # 3. Donanım yapılandırmasını uygula (Nano'lar bulunduktan sonra)
    hw.apply_config(state.data.get("nanos", []), state.data.get("sensors", []))
    
    # Döngüleri Başlat
    b_task = asyncio.create_task(broadcast_loop())
    p_task = asyncio.create_task(prod.run_loop())
    
    yield
    
    # Kapanış
    b_task.cancel()
    p_task.cancel()
    hw.cleanup()

# --- Altyapı ---
app = FastAPI(lifespan=lifespan)
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
socket_app = socketio.ASGIApp(sio, app)

# Ana event loop'u saklamak için değişken
main_loop = None

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

db = DatabaseManager()
hw = HardwareManager()
state = StateManager(db, hw)
prod = ProductionManager(state, hw, db)

# Arayüze güvenli veri gönderme (Thread-Safe)
def safe_emit():
    if main_loop:
        # Zaman damgası ekle (Arayüzün güncellendiğini anlaması için)
        state.data["lastUpdate"] = time.time()
        asyncio.run_coroutine_threadsafe(sio.emit('STATE_UPDATE', state.data), main_loop)

# Sensör callback'lerini bağla (Arduino'dan gelen veriler için)
def handle_sensor_event(d_id, s_type):
    prod.handle_sensor(d_id, s_type)
    safe_emit()

hw.on_input_detected = handle_sensor_event


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
        fault_type = payload.get('type', 'GENERIC')
        faults = {
            'VALVE_STUCK': ('ERR_VALF_SIKISIK', 'CRITICAL', 'Valf 3 tam kapanamadı.'),
            'SENSOR_UNSTABLE': ('WARN_SENSOR_GURULTUSU', 'WARNING', 'Giriş sensörü okumaları yüksek oranda kararsız.'),
            'COMM_LOSS': ('ERR_ILETISIM_KOPTU', 'CRITICAL', 'Nano 2 (Valfler) ile bağlantı kesildi.'),
            'TIMEOUT_SETTLE': ('ERR_ZAMAN_ASIMI', 'CRITICAL', 'Dengelenme durumu izin verilen maksimum süreyi aştı.'),
        }
        code, severity, message = faults.get(fault_type, ('ERR_GENERIC', 'CRITICAL', 'Bilinmeyen hata.'))
        new_alert = {
            'id': f'ALR-{int(time.time())}', 'code': code, 'severity': severity,
            'message': message, 'suggestion': 'Lütfen sistemi kontrol edin.',
            'timestamp': time.time(), 'resolved': False
        }
        state.data["activeAlerts"].insert(0, new_alert)
        if severity == 'CRITICAL':
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

    elif action_type == 'TEST_VALVE_PULSE':
        valve_id = payload.get('id')
        duration = payload.get('duration', 1000)
        asyncio.create_task(hw.pulse_valve(valve_id, duration))

    elif action_type == 'TOGGLE_HARDWARE_STATUS':
        v_id = payload.get('id')
        valves = state.data.get("valves", [])
        for v in valves:
            if v["id"] == v_id:
                v["enabled"] = not v.get("enabled", True)
                v["isOpen"] = False
        state.data["valves"] = valves
        db.save_state("valves", valves)

    elif action_type == 'SET_VALVE_PULSE':
        pulse_id = payload.get('id')
        duration = payload.get('duration', 1000)
        valves = state.data.get("valves", [])
        for v in valves:
            if v["id"] == pulse_id:
                v["pulseDuration"] = duration
        state.data["valves"] = valves
        db.save_state("valves", valves)

    # --- Sayaç Yönetimi ---
    elif action_type == 'MANAGE_COUNTER':
        target = payload.get('target') # 'input' or 'output'
        op = payload.get('op') # 'inc', 'dec', 'reset'
        
        if target == 'input':
            if op == 'inc': state.data["inputCount"] += 1
            elif op == 'dec': state.data["inputCount"] = max(0, state.data["inputCount"] - 1)
            elif op == 'reset': state.data["inputCount"] = 0
        else:
            if op == 'inc': state.data["outputCount"] += 1
            elif op == 'dec': state.data["outputCount"] = max(0, state.data["outputCount"] - 1)
            elif op == 'reset': state.data["outputCount"] = 0
        
        print(f"[Counter] {target} {op} yapıldı. Yeni Değerler: {state.data['inputCount']}/{state.data['outputCount']}")

    # --- Kilit Manuel Kontrol ---
    elif action_type == 'OPERATE_GATE':
        gate_id = payload.get('id') or payload.get('target')
        pos = payload.get('position') # 1=Aç/İleri, 0=Kapat/Geri
        hw.control_gate(gate_id, pos)
    elif action_type == 'OPERATE_EXTRA_GATE':
        gate_id = payload.get('id')
        pos = payload.get('position', 1)
        extra_gates = state.data.get("extraGates", [])
        for g in extra_gates:
            if g.get("id") == gate_id and g.get("enabled"):
                g["isOpen"] = pos > 0
                g["position"] = pos
        state.data["extraGates"] = extra_gates
        db.save_state("extraGates", extra_gates)

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
        target_id = payload.get('nanoId')
        target_port = payload.get('port')
        
        # Eğer nanoId verildiyse portu bul
        if target_id and not target_port:
            for p, d_id in hw.port_to_id_map.items():
                if d_id == target_id:
                    target_port = p
                    break
        
        hw.send_command(payload.get('cmd'), target_port=target_port)

    # --- Kapılar ---
    elif action_type == 'UPDATE_SYSTEM_GATE':
        target = payload.get("target")
        if target in state.data:
            state.data[target].update(payload.get("updates", {}))
            db.save_state(target, state.data[target])
    elif action_type == 'TOGGLE_GATE_ENABLED':
        gate_id = payload.get("target") or payload.get("id")
        if gate_id in state.data:
            state.data[gate_id]["enabled"] = not state.data[gate_id].get("enabled", True)
            db.save_state(gate_id, state.data[gate_id])
        # Extra gate toggle
        extra = state.data.get("extraGates", [])
        for g in extra:
            if g.get("id") == gate_id:
                g["enabled"] = not g.get("enabled", True)
                if not g["enabled"]:
                    g["isOpen"] = False
                    g["position"] = 0
        state.data["extraGates"] = extra
        db.save_state("extraGates", extra)
    elif action_type == 'UPDATE_GATE':
        gate_id = payload.get("id")
        updates = payload.get("updates", {})
        extra = state.data.get("extraGates", [])
        for g in extra:
            if g.get("id") == gate_id:
                g.update(updates)
        state.data["extraGates"] = extra
        db.save_state("extraGates", extra)
    elif action_type == 'ADD_GATE':
        gate = payload.get("gate", {})
        extra = state.data.get("extraGates", [])
        extra.append(gate)
        state.data["extraGates"] = extra
        db.save_state("extraGates", extra)
    elif action_type == 'REMOVE_GATE':
        gate_id = payload.get("id")
        extra = [g for g in state.data.get("extraGates", []) if g.get("id") != gate_id]
        state.data["extraGates"] = extra
        db.save_state("extraGates", extra)

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
        recipe_id = payload.get("id")
        state.data["config"]["recipeId"] = recipe_id
        recipe = next((r for r in state.data.get("recipes", []) if r["id"] == recipe_id), None)
        if recipe:
            state.data["config"]["volumeMl"] = recipe.get("volumeMl", 250)
            state.data["config"]["targetCount"] = recipe.get("targetCount", 1)
            state.data["config"]["fillTimeMs"] = recipe.get("fillTimeMs", 1000)
            state.data["config"]["settlingTimeMs"] = recipe.get("settlingTimeMs", 500)
            state.data["config"]["dripWaitTimeMs"] = recipe.get("dripWaitTimeMs", 500)
        db.save_state("config", state.data["config"])

    # --- Kullanıcı Prompt Yanıtı ---
    elif action_type == 'ANSWER_PROMPT':
        answer = payload.get('answer', False)
        prompt_type = state.data.get("activePrompt")
        if prompt_type == "COUNT_MISMATCH":
            if answer:
                state.data["activePrompt"] = None
                state.log("Kullanıcı onayı: sayı farkına rağmen döngü devam ediyor.")
            else:
                state.data["activePrompt"] = None
                state.data["mode"] = "BEKLEMEDE"
                state.log("Kullanıcı reddetti. Sistem bekleme moduna alındı.")

    # --- Konfig ---
    elif action_type == 'UPDATE_CONFIG':
        state.data["config"].update(payload.get("config", {}))
        db.save_state("config", state.data["config"])

    await sio.emit('STATE_UPDATE', state.data)

@sio.on('TERMINAL_INPUT')
async def handle_terminal_input(sid, data):
    nano_id = data.get('nanoId')
    cmd = data.get('data')
    
    target_port = None
    # ID bazlı portu bul
    for p, d_id in hw.port_to_id_map.items():
        if d_id == nano_id:
            target_port = p
            break
            
    if target_port:
        hw.send_command(cmd, target_port=target_port)
        print(f"[TERMINAL] -> {nano_id}: {cmd}")

# --- Arka Plan Döngüsü ---
async def broadcast_loop():
    while True:
        # Serial'den gelen sensör veya ACK bilgilerini oku
        hw.update()
        
        state.data["serialPorts"] = refresh_ports()
        
        # --- Nano Donanım Yönetimi & Otonom Eşleştirme ---
        nanos = state.data.get("nanos", [])
        
        # Beklenen donanımların listede olduğundan emin ol (Eğer startup'ta bulunamadılarsa listeye ekle ki döngü aramaya devam etsin)
        expected_ids = ['GatesNano', 'ValvesNano']
        for eid in expected_ids:
            if not any(n['id'] == eid for n in nanos):
                nanos.append({"id": eid, "name": "Kilit ve Sensörler" if eid == "GatesNano" else "Valf Kontrol", "port": None, "status": "OFFLINE", "baudRate": 115200})
                state.data["nanos"] = nanos

        initial_nano_count = len(nanos)
        
        # 1. Temizlik: Sadece meşru donanımları tut (Hayaletleri sil)
        nanos = [n for n in nanos if n['id'] in ['GatesNano', 'ValvesNano']]
        if len(nanos) != initial_nano_count:
            print(f"[Auto-Clean] {initial_nano_count - len(nanos)} adet hayalet donanım silindi.")
            db.save_state("nanos", nanos)
            state.data["nanos"] = nanos

        for n in nanos:
            port = n.get("port")
            is_online = hw.is_port_online(port) if port else False
            
            if not is_online:
                # Sadece 10 saniyede bir yeni tarama yap (Sistemi bloke etmemek için)
                now = time.time()
                if (now - state.last_hw_search_time) > 10:
                    state.last_hw_search_time = now
                    print(f"[Self-Healing] {n['id']} aranıyor...")
                    if hw.find_and_connect(n['id']):
                        # Yeni portu kaydet
                        for p, d_id in hw.port_to_id_map.items():
                            if d_id == n['id']:
                                n['port'] = p
                                print(f"[Self-Healing] {n['id']} bağlandı: {p}")
                                break
                        is_online = True
                
            n["status"] = "ONLINE" if is_online else "OFFLINE"
                
            # 2. Otonom Eşleştirme & Kalıcı Kayıt
            if is_online:
                if n['id'] == 'ValvesNano':
                    valves_updated = False
                    for v in state.data.get("valves", []):
                        if v.get("nanoId") != "ValvesNano":
                            v["nanoId"] = "ValvesNano"
                            valves_updated = True
                    if valves_updated:
                        print(f"[Auto-Config] ValvesNano eşleşti, valfler kaydedildi.")
                        db.save_state("valves", state.data["valves"])
                
                elif n['id'] == 'GatesNano':
                    gates_updated = False
                    # Sensörleri Raspberry Pi moduna geçir (tip korunur)
                    for s in state.data.get("sensors", []):
                        if s.get("device") != "RASPI":
                            original = s.get("type", "INPUT")
                            s["device"] = "RASPI"
                            s["type"] = original
                            gates_updated = True
                    
                    # Kilitleri bağla
                    if state.data.get("inputGate", {}).get("nanoId") != "GatesNano":
                        state.data["inputGate"]["nanoId"] = "GatesNano"
                        gates_updated = True
                    if state.data.get("outputGate", {}).get("nanoId") != "GatesNano":
                        state.data["outputGate"]["nanoId"] = "GatesNano"
                        gates_updated = True
                        
                    if gates_updated:
                        print(f"[Auto-Config] GatesNano eşleşti, kilitler ve sensörler kaydedildi.")
                        db.save_state("sensors", state.data["sensors"])
                        db.save_state("inputGate", state.data["inputGate"])
                        db.save_state("outputGate", state.data["outputGate"])
                        # Donanıma yeni sensör modunu bildir!
                        hw.apply_config(state.data["nanos"], state.data["sensors"])
        
        # --- Durum Temizliği (Frontend Çökme Koruması) ---
        for key in ["nanos", "valves", "sensors", "recipes", "terminalLogs", "cycleHistory", "activeAlerts", "extraGates"]:
            if key not in state.data or state.data[key] is None:
                state.data[key] = []
        
        # Obje korumaları
        if "config" not in state.data or state.data["config"] is None:
            state.data["config"] = {"recipeId": "RECIPE-1", "volumeMl": 250}
        if "inputGate" not in state.data or state.data["inputGate"] is None:
            state.data["inputGate"] = {"name": "Giriş Kapısı", "isOpen": False}
        if "outputGate" not in state.data or state.data["outputGate"] is None:
            state.data["outputGate"] = {"name": "Çıkış Kapısı", "isOpen": False}
        for key in ["promptData", "activePrompt", "isWashingDone", "isWashingRequired", "stopAfterCycleRequested"]:
            if key not in state.data:
                state.data[key] = None if key in ("activePrompt", "promptData") else False
        
        # Reçete koruması (eğer liste boşsa arayüz çökmesin diye hayali bir reçete göster)
        if not state.data["recipes"]:
            state.data["recipes"] = [{"id": "RECIPE-1", "name": "Yükleniyor...", "targetCount": 1}]

        safe_emit()
        await asyncio.sleep(0.5)


if __name__ == "__main__":
    print("\n" + "="*50)
    print("   PLGAZOZ BACKEND - PORT 8000")
    print("="*50 + "\n")
    uvicorn.run(socket_app, host="0.0.0.0", port=8000, log_level="warning")

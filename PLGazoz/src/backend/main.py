import asyncio
import json
import logging
import uuid
import time
from typing import Set, Dict, Any
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import database
from serial_manager import SerialManager

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("PLGazozServer")

app = FastAPI(title="PLGazoz HMI & Automation Backend", version="2.0.0")

# Enable CORS for Vite React HMI front-end (typically port 3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active HMI WebSocket connections
active_websockets: Set[WebSocket] = set()

# Live System Telemetry State
state = {
    "mode": "BASLATMA",             # BASLATMA, BEKLEMEDE, OTOMATİK, MANUEL, YIKAMA, ARIZA
    "autoState": "BEKLEMEDE",       # BEKLEMEDE, GIRIS_SAYILIYOR, GIRIS_KILITLI, DENGELEME, DOLUM, DAMLA_BEKLEME, TAHLIYE, DOGRULAMA
    "inputCount": 0,
    "outputCount": 0,
    "valves": [],                   # Loaded from DB on startup, status maintained in RAM
    "sensors": [],                  # Loaded from DB
    "gates": [],                    # Loaded from DB
    "devices": [],                  # Loaded from DB
    "recipes": [],                  # Loaded from DB
    "cycleHistory": [],             # Loaded from DB
    "activeAlerts": [],             # Loaded from DB
    "config": {},                   # Loaded from DB
    "isWashingDone": True,
    "isWashingRequired": False,
    "stopAfterCycleRequested": False,
    "activePrompt": None,           # 'BOTTLE_CHECK' or None
    "syrupTankVolumeLiters": 50.0,
    "syrupTankCurrentVolumeMl": 50000.0,
    "laserSensorDistanceMm": 15,
    "terminalLogs": [f"[{time.strftime('%H:%M:%S')}] [SYS] Python industrial backend started."]
}

# In-memory helpers
cycle_start_time = 0.0
active_valve_timers = []

# Instantiate SerialManager
serial_manager = None

# --- TELEMETRY BROADCAST ---

async def broadcast_state():
    """Broadcasts current telemetry state to all connected HMI displays over WebSockets"""
    if not active_websockets:
        return
    
    # Pre-render state package
    payload = json.dumps(state)
    
    disconnected = set()
    for ws in active_websockets:
        try:
            await ws.send_text(payload)
        except Exception:
            disconnected.add(ws)
            
    for ws in disconnected:
        active_websockets.remove(ws)

# --- SERIAL EVENT HANDLER (CALLBACK FROM HARDWARE) ---

def handle_hardware_event(device_id: str, element: str, action: str):
    """
    Callback method invoked when serial_manager receives an event from Arduinos.
    element: e.g. 'D2' (pin), or 'HCSR04' (distance)
    action: e.g. 'ACTIVE' (beam broken), or integer (distance value in mm)
    """
    logger.info(f"HARDWARE EVENT -> Device: {device_id} | Element: {element} | Action: {action}")
    
    # 1. Handle HC-SR04 distance measurement
    if element == "HCSR04":
        dist_mm = int(action)
        state["laserSensorDistanceMm"] = dist_mm
        
        # Calculate volume based on height (calibrated range: 15mm = 50L, 500mm = 0L)
        # Formula: Volume = 50000 * (1 - (dist - 15) / 485)
        clamped_dist = max(15, min(500, dist_mm))
        vol_ml = max(0.0, min(50000.0, 50000.0 * (1.0 - (clamped_dist - 15.0) / 485.0)))
        state["syrupTankCurrentVolumeMl"] = round(vol_ml, 1)
        
        log_message(f"[SYS] HC-SR04 Seviye Ölçümü: {dist_mm}mm. Depo Hacmi: {(vol_ml/1000.0):.2f} Litre.")
        
        # Sync with database config table
        database.update_system_config({"current_tank_volume_ml": int(vol_ml)})
        
        # Critical alert logic
        if vol_ml < state["config"]["refill_lower_limit_ml"]:
            add_alert("CRIT_SYRUP_LOW", "WARNING", "Şerbet Seviyesi Düşük", "Ana kazandan tankı besleyin veya şerbet tankını doldurun.")
        else:
            resolve_alert("CRIT_SYRUP_LOW")
        return

    # 2. Handle Digital Pin Events (Bottle Counters)
    # Scan sensors_config to find which sensor is mapped to this device and pin
    matching_sensor = None
    for sens in state["sensors"]:
        if sens["device_id"] == device_id and sens["pin"] == element and sens["enabled"]:
            matching_sensor = sens
            break
            
    if matching_sensor:
        sensor_id = matching_sensor["id"]
        logger.info(f"Mapped hardware event from {device_id} pin {element} to sensor: {sensor_id}")
        
        if sensor_id == "SENS-IN":
            # Bottle entered
            if state["mode"] == "OTOMATİK" and state["autoState"] == "GIRIS_SAYILIYOR":
                if state["inputCount"] < state["config"]["target_count"]:
                    state["inputCount"] += 1
                    log_message(f"[SYS] Şişe Giriş Yaptı ({state['inputCount']}/{state['config']['target_count']})")
                    
        elif sensor_id == "SENS-OUT":
            # Bottle exited
            if state["mode"] == "OTOMATİK" and state["autoState"] == "TAHLIYE":
                if state["outputCount"] < state["inputCount"]:
                    state["outputCount"] += 1
                    log_message(f"[SYS] Şişe Tahliye Oldu ({state['outputCount']}/{state['inputCount']})")

# --- INITIALIZATION & RE-LOAD ---

def reload_system_data():
    """Loads all configuration and telemetry parameters from SQLite database into memory"""
    logger.info("Syncing SQLite database configs to RAM memory...")
    state["recipes"] = database.get_recipes()
    state["valves"] = database.get_valves()
    state["sensors"] = database.get_sensors()
    state["gates"] = database.get_gates()
    state["devices"] = database.get_devices()
    state["config"] = database.get_system_config()
    state["cycleHistory"] = database.get_production_history(limit=40)
    state["activeAlerts"] = database.get_active_errors()
    
    # Sync in-memory volume with DB
    state["syrupTankCurrentVolumeMl"] = state["config"]["current_tank_volume_ml"]
    state["laserSensorDistanceMm"] = int(15.0 + (1.0 - state["syrupTankCurrentVolumeMl"] / 50000.0) * 485.0)

def log_message(msg: str):
    logger.info(msg)
    timestamp = time.strftime("%H:%M:%S")
    state["terminalLogs"].insert(0, f"[{timestamp}] {msg}")
    state["terminalLogs"] = state["terminalLogs"][:60] # Keep last 60 rows

def add_alert(code: str, severity: str, message: str, suggestion: str):
    # Check if duplicate active alert exists
    for alert in state["activeAlerts"]:
        if alert["error_code"] == code and not alert["resolved"]:
            return
            
    err = {
        "timestamp": int(time.time() * 1000),
        "error_code": code,
        "severity": severity,
        "message": message,
        "suggestion": suggestion
    }
    database.add_error_log(err)
    state["activeAlerts"] = database.get_active_errors()

def resolve_alert(code: str):
    conn = database.get_db_connection()
    conn.execute("UPDATE error_logs SET resolved = 1, resolved_timestamp = ? WHERE error_code = ? AND resolved = 0", (int(time.time() * 1000), code))
    conn.commit()
    conn.close()
    state["activeAlerts"] = database.get_active_errors()

# --- AUTOMATIC STATE MACHINE LOOP ---

async def bottling_state_machine_loop():
    """
    Main state machine background task running on Raspberry Pi 5.
    Controls timing, sensors, and dynamic valve/gate hardware triggering.
    """
    global cycle_start_time
    logger.info("Bottling state machine background loop initialized.")
    
    while True:
        try:
            if state["mode"] != "OTOMATİK":
                # Manual or Standby mode, check every 500ms
                await asyncio.sleep(0.5)
                continue

            # --- AUTOMATIC SEQUENCE PROCESSING ---
            auto_state = state["autoState"]
            recipe_id = state["config"]["recipeId"]
            active_recipe = next((r for r in state["recipes"] if r["id"] == recipe_id), state["recipes"][0])
            
            # Target bottle count depends on selected recipe active valves list
            target_count = len(active_recipe.get("active_valves", [1,2,3,4]))
            state["config"]["target_count"] = target_count

            if auto_state == "BEKLEMEDE":
                # Waiting for bottle check or new cycle trigger
                if state["activePrompt"] is None and not state["stopAfterCycleRequested"]:
                    state["activePrompt"] = "BOTTLE_CHECK"
                    log_message("[SYS] Emniyet Kilidi: Dolum alanı temiz mi? Şişeler hazır mı?")
                await asyncio.sleep(0.5)

            elif auto_state == "GIRIS_SAYILIYOR":
                # 1. Open Entrance Gate dynamically
                gate_in = next((g for g in state["gates"] if g["id"] == "GATE-IN"), None)
                if gate_in and gate_in["enabled"]:
                    serial_manager.write_to_device(gate_in["device_id"], gate_in["pin"], "ON")
                    
                # 2. Mock Mode Automatic Trigger
                if serial_manager.mock_mode:
                    await asyncio.sleep(0.8) # Simulate bottle sliding in
                    if state["inputCount"] < target_count:
                        state["inputCount"] += 1
                        log_message(f"[SYS] [MOCK SENS] Şişe Giriş Yaptı ({state['inputCount']}/{target_count})")
                else:
                    await asyncio.sleep(0.1)

                # 3. Check transition
                if state["inputCount"] >= target_count:
                    state["autoState"] = "GIRIS_KILITLI"
                    log_message("[SYS] Hedef şişe sayısına ulaşıldı. Giriş kilitleniyor.")

            elif auto_state == "GIRIS_KILITLI":
                # Close Entrance Gate
                gate_in = next((g for g in state["gates"] if g["id"] == "GATE-IN"), None)
                if gate_in:
                    serial_manager.write_to_device(gate_in["device_id"], gate_in["pin"], "OFF")
                
                await asyncio.sleep(1.0) # wait for physical door to lock securely
                state["autoState"] = "DENGELEME"
                log_message("[SYS] Giriş kapısı kilitlendi. Dengeleme fazına geçiliyor.")

            elif auto_state == "DENGELEME":
                # Wait for conveyor vibration to settle down
                settling_ms = active_recipe.get("settling_time_ms", 600)
                await asyncio.sleep(settling_ms / 1000.0)
                state["autoState"] = "DOLUM"
                log_message("[SYS] Dengeleme bitti. Dolum valfleri açılıyor.")

            elif auto_state == "DOLUM":
                # 1. Open designated valves dynamically mapped in DB
                active_valves = active_recipe.get("active_valves", [1,2,3,4])
                logger.info(f"Opening valves for recipe: {active_valves}")
                
                for valve in state["valves"]:
                    if valve["id"] in active_valves and valve["enabled"]:
                        serial_manager.write_to_device(valve["device_id"], valve["pin"], "ON")
                        valve["isOpen"] = True

                # 2. Handle valve closing sequences based on durations
                fill_ms = active_recipe.get("fill_time_ms", 2400)
                valve_durations = active_recipe.get("valve_durations", {})
                
                # Determine longest time
                longest_time = fill_ms
                for v_id in active_valves:
                    duration = valve_durations.get(str(v_id), fill_ms)
                    if duration > longest_time:
                        longest_time = duration

                # Asynchronously close valves based on their custom durations
                async def close_valve_delayed(v_id: int, delay: int):
                    await asyncio.sleep(delay / 1000.0)
                    target_valve = next((val for val in state["valves"] if val["id"] == v_id), None)
                    if target_valve and state["autoState"] == "DOLUM":
                        serial_manager.write_to_device(target_valve["device_id"], target_valve["pin"], "OFF")
                        target_valve["isOpen"] = False
                        logger.info(f"Valve {v_id} shut off dynamically after {delay}ms.")

                tasks = []
                for v_id in active_valves:
                    duration = valve_durations.get(str(v_id), fill_ms)
                    tasks.append(asyncio.create_task(close_valve_delayed(v_id, duration)))

                await asyncio.sleep(longest_time / 1000.0)
                # Double check all valves are closed
                for valve in state["valves"]:
                    if valve["isOpen"]:
                        serial_manager.write_to_device(valve["device_id"], valve["pin"], "OFF")
                        valve["isOpen"] = False

                state["autoState"] = "DAMLA_BEKLEME"
                log_message("[SYS] Dolum valfleri kapatıldı. Damla bekleme fazı başladı.")

            elif auto_state == "DAMLA_BEKLEME":
                # Wait for nozzle drops to clear
                drip_ms = active_recipe.get("drip_wait_time_ms", 1000)
                await asyncio.sleep(drip_ms / 1000.0)
                state["autoState"] = "TAHLIYE"
                log_message("[SYS] Damla süzülmesi bitti. Çıkış kapısı açılıyor.")

            elif auto_state == "TAHLIYE":
                # 1. Open Exit Gate dynamically
                gate_out = next((g for g in state["gates"] if g["id"] == "GATE-OUT"), None)
                if gate_out and gate_out["enabled"]:
                    serial_manager.write_to_device(gate_out["device_id"], gate_out["pin"], "ON")

                # 2. Mock Mode Automatic Trigger
                if serial_manager.mock_mode:
                    await asyncio.sleep(0.8) # Simulate bottle exiting
                    if state["outputCount"] < state["inputCount"]:
                        state["outputCount"] += 1
                        log_message(f"[SYS] [MOCK SENS] Şişe Çıkış Yaptı ({state['outputCount']}/{state['inputCount']})")
                else:
                    await asyncio.sleep(0.1)

                # 3. Check transition
                if state["outputCount"] >= state["inputCount"]:
                    # Close output gate
                    if gate_out:
                        serial_manager.write_to_device(gate_out["device_id"], gate_out["pin"], "OFF")
                    
                    state["autoState"] = "DOGRULAMA"
                    log_message("[SYS] Tüm şişeler tahliye edildi. Doğrulama yapılıyor.")

            elif auto_state == "DOGRULAMA":
                # Verify counts match
                is_valid = (state["inputCount"] == target_count) and (state["inputCount"] == state["outputCount"])
                duration = int((time.time() - cycle_start_time) * 1000) if cycle_start_time > 0 else 24000
                
                # Calculate syrup usage mathematically
                total_syrup_used = len(active_recipe.get("active_valves", [1,2,3,4])) * active_recipe.get("volume_ml", 250)
                next_volume = max(0.0, state["syrupTankCurrentVolumeMl"] - total_syrup_used)
                
                # Write to database production logs
                cycle_uuid = str(uuid.uuid4())
                prod_log = {
                    "cycle_uuid": cycle_uuid,
                    "recipe_id": active_recipe["id"],
                    "recipe_name": active_recipe["name"],
                    "start_timestamp": int(time.time() * 1000) - duration,
                    "end_timestamp": int(time.time() * 1000),
                    "duration_ms": duration,
                    "input_count": state["inputCount"],
                    "output_count": state["outputCount"],
                    "status": "GEÇTİ" if is_valid else "KALDI",
                    "syrup_used_ml": total_syrup_used
                }
                database.add_production_log(prod_log)
                
                # Triggers ultrasonic reading to calibrate height dynamically
                sensor_level = next((s for s in state["sensors"] if s["id"] == "SENS-LEVEL"), None)
                if sensor_level and sensor_level["enabled"]:
                    pins = sensor_level["pin"].split(",")
                    if len(pins) == 2:
                        serial_manager.trigger_ultrasonic_read(pins[0], pins[1])
                else:
                    # In mock or fallback, update directly
                    state["syrupTankCurrentVolumeMl"] = next_volume
                    state["laserSensorDistanceMm"] = int(15.0 + (1.0 - next_volume / 50000.0) * 485.0)
                    database.update_system_config({"current_tank_volume_ml": int(next_volume)})

                # Handle Auto-refill valve triggers (Nano 1, valve 9 by default)
                if state["syrupTankCurrentVolumeMl"] < state["config"]["refill_lower_limit_ml"]:
                    log_message("[SYS] Şerbet seviyesi kritik limitin altında! Otomatik dolum başlatılıyor.")
                    refill_valve = next((v for v in state["valves"] if v["id"] == 9), None)
                    if refill_valve and refill_valve["enabled"]:
                        serial_manager.trigger_refill_valve("ON", refill_valve["pin"])
                        
                        # Simulate tank filling up over 3 seconds for mock/simulation
                        if serial_manager.mock_mode:
                            await asyncio.sleep(3.0)
                            serial_manager.trigger_refill_valve("OFF", refill_valve["pin"])
                            state["syrupTankCurrentVolumeMl"] = 50000.0
                            state["laserSensorDistanceMm"] = 15
                            database.update_system_config({"current_tank_volume_ml": 50000})
                            log_message("[SYS] [MOCK REFILL] Depo dolumu tamamlandı. Dolum valfi kapatıldı.")

                # Refresh in-memory history logs
                state["cycleHistory"] = database.get_production_history(limit=40)

                # Reset loop metrics
                state["inputCount"] = 0
                state["outputCount"] = 0
                
                if is_valid:
                    log_message(f"[SYS] Döngü başarıyla tamamlandı. ({total_syrup_used}ml şerbet kullanıldı).")
                    if state["stopAfterCycleRequested"]:
                        state["mode"] = "BEKLEMEDE"
                        state["autoState"] = "BEKLEMEDE"
                        state["stopAfterCycleRequested"] = False
                        state["activePrompt"] = None
                        log_message("[SYS] Operatör Döngü Sonu Emniyet Duruşu istedi. Bekleme Moduna geçildi.")
                    else:
                        state["autoState"] = "BEKLEMEDE"
                        state["activePrompt"] = "BOTTLE_CHECK" # Ask for next cycle
                else:
                    state["mode"] = "ARIZA"
                    state["autoState"] = "BEKLEMEDE"
                    add_alert("ERR_COUNT", "CRITICAL", "Doğrulama Hatası", "Giriş ve çıkış sayıları uyuşmuyor. Lütfen dolum alanını kontrol edin.")
                    log_message("[SYS] DOĞRULAMA HATASI! Üretim acil durduruldu.")

        except Exception as e:
            logger.error(f"Error in state machine loop: {e}")
            state["mode"] = "ARIZA"
            add_alert("ERR_FATAL_LOOP", "CRITICAL", "İç Durum Makinesi Hatası", str(e))
        
        # Telemetry cycle frequency
        await asyncio.sleep(0.1)

# --- WASHING DONGUSU (PULSING SIGNAL THREAD SIMULATION) ---

async def washing_pulse_loop():
    """Loops and pulses active valves continuously when in WASHING mode"""
    logger.info("Washing cycle background worker initialized.")
    valve_pulse_state = False
    
    while True:
        if state["mode"] == "YIKAMA":
            valve_pulse_state = not valve_pulse_state
            # Pulse all enabled valves (1-8)
            for valve in state["valves"]:
                if valve["id"] < 9 and valve["enabled"]:
                    cmd = "ON" if valve_pulse_state else "OFF"
                    serial_manager.write_to_device(valve["device_id"], valve["pin"], cmd)
                    valve["isOpen"] = (cmd == "ON")
            
            await asyncio.sleep(0.5) # pulse every 500ms
        else:
            await asyncio.sleep(0.5)

# --- FASTAPI WEB INTERFACE (WEBSOCKETS) ---

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_websockets.add(websocket)
    logger.info(f"HMI Touchscreen connected over WebSockets. Total viewers: {len(active_websockets)}")
    
    try:
        # Immediately push initial state
        await websocket.send_text(json.dumps(state))
        
        while True:
            # Keep connection alive, listen for any messages
            data = await websocket.receive_text()
            # If the touchscreen wants to push custom mock sensor inputs
            # e.g., {"action": "MOCK_TRIGGER", "sensor": "IN"}
            try:
                msg = json.loads(data)
                if msg.get("action") == "MOCK_TRIGGER":
                    sensor_type = msg.get("sensor")
                    serial_manager.simulate_mock_sensor_trigger(sensor_type)
            except Exception as e:
                logger.error(f"Error parsing websocket message: {e}")
    except WebSocketDisconnect:
        logger.info("HMI Touchscreen disconnected.")
    finally:
        if websocket in active_websockets:
            active_websockets.remove(websocket)

# Periodic task to broadcast state to all clients every 100ms
async def telemetry_broadcast_loop():
    while True:
        await broadcast_state()
        await asyncio.sleep(0.1)

# --- HTTP REST API ENDPOINTS FOR ACTIONS ---

@app.post("/api/start")
def start_production():
    if state["isWashingRequired"]:
        raise HTTPException(status_code=400, detail="Dolum reçetesi değişti. Doluma başlamadan önce Yıkama döngüsü yapılması mecburidir.")
    if state["mode"] in ["OTOMATİK", "YIKAMA"]:
        raise HTTPException(status_code=400, detail="Sistem meşgul veya başka bir mod aktif.")
    
    # Reset counters
    state["inputCount"] = 0
    state["outputCount"] = 0
    state["mode"] = "OTOMATİK"
    state["autoState"] = "BEKLEMEDE"
    state["activePrompt"] = "BOTTLE_CHECK"
    state["stopAfterCycleRequested"] = False
    
    # Ensure gates are closed on start
    for gate in state["gates"]:
        serial_manager.write_to_device(gate["device_id"], gate["pin"], "OFF")
        gate["isOpen"] = False
        
    log_message("[SYS] Otomatik üretim başlatıldı. Emniyet onayı bekleniyor.")
    return {"status": "success"}

@app.post("/api/stop")
def stop_production():
    """Emergency Stop (E-STOP) button cut-off triggers this"""
    state["mode"] = "ARIZA"
    state["autoState"] = "BEKLEMEDE"
    state["activePrompt"] = None
    
    # Instantly trigger NANO-1 to release pressure / shut down all output relays
    for valve in state["valves"]:
        serial_manager.write_to_device(valve["device_id"], valve["pin"], "OFF")
        valve["isOpen"] = False
        
    for gate in state["gates"]:
        serial_manager.write_to_device(gate["device_id"], gate["pin"], "OFF")
        gate["isOpen"] = False
        
    add_alert("EMERGENCY_STOP", "CRITICAL", "Acil Durdurma Aktif", "E-STOP mantar butonu basıldı. Güvenlik hatlarını sıfırlayın.")
    log_message("[SYS] acil durdurma aktif edildi! Tüm çıkışlar kapatıldı.")
    return {"status": "success"}

@app.post("/api/stop_after_cycle")
def stop_after_cycle():
    state["stopAfterCycleRequested"] = True
    log_message("[SYS] Döngü sonu durma isteği alındı. Mevcut şişeler dolup tahliye olduktan sonra sistem Bekleme moduna geçecektir.")
    return {"status": "success"}

@app.post("/api/start_washing")
def start_washing():
    if state["mode"] == "OTOMATİK" and state["autoState"] != "BEKLEMEDE":
        raise HTTPException(status_code=400, detail="Üretim devam ederken temizleme başlatılamaz.")
        
    state["mode"] = "YIKAMA"
    state["autoState"] = "YIKAMA_DONGUSU"
    state["isWashingDone"] = True
    state["isWashingRequired"] = False
    resolve_alert("WASH_REQUIRED")
    
    # Open gates to let flushing water run through conveyor
    for gate in state["gates"]:
        serial_manager.write_to_device(gate["device_id"], gate["pin"], "ON")
        gate["isOpen"] = True
        
    log_message("[SYS] Yıkama modu aktif edildi. Valfler durulama modunda çalkalanıyor.")
    return {"status": "success"}

@app.post("/api/stop_washing")
def stop_washing():
    if state["mode"] != "YIKAMA":
        raise HTTPException(status_code=400, detail="Yıkama aktif değil.")
        
    state["mode"] = "BEKLEMEDE"
    state["autoState"] = "BEKLEMEDE"
    
    # Close gates
    for gate in state["gates"]:
        serial_manager.write_to_device(gate["device_id"], gate["pin"], "OFF")
        gate["isOpen"] = False
        
    log_message("[SYS] Yıkama tamamlandı. Sistem bekleme konumunda.")
    return {"status": "success"}

@app.post("/api/acknowledge_startup")
def acknowledge_startup():
    if state["mode"] == "BASLATMA":
        state["mode"] = "BEKLEMEDE"
        state["autoState"] = "BEKLEMEDE"
        resolve_alert("SYS_ACTIVE")
        log_message("[SYS] Sistem ilk açılış onayı operatör tarafından verildi.")
    return {"status": "success"}

@app.post("/api/acknowledge_fault")
def acknowledge_fault():
    state["mode"] = "BEKLEMEDE"
    state["autoState"] = "BEKLEMEDE"
    state["inputCount"] = 0
    state["outputCount"] = 0
    database.resolve_all_errors()
    state["activeAlerts"] = database.get_active_errors()
    log_message("[SYS] Arıza kaydı resetlendi. Güvenli başlama konumu yükleniyor.")
    return {"status": "success"}

class PromptAnswer(BaseModel):
    answer: bool

@app.post("/api/answer_prompt")
def answer_prompt(payload: PromptAnswer):
    global cycle_start_time
    if state["activePrompt"] == "BOTTLE_CHECK":
        state["activePrompt"] = None
        if not payload.answer:
            # Area is clean, let's start the automatic counting sequence!
            cycle_start_time = time.time()
            state["autoState"] = "GIRIS_SAYILIYOR"
            log_message("[SYS] Emniyet onaylandı. Şişe giriş kapısı açılıyor.")
        else:
            # Operator says bottle is already present! Stop and alert!
            state["mode"] = "ARIZA"
            state["autoState"] = "BEKLEMEDE"
            add_alert("ERR_BOTTLE_IN_AREA", "CRITICAL", "Dolum Alanı Dolu", "Şişe giriş bariyeri önünde eski şişeler algılandı. Hattı boşaltın.")
            log_message("[SYS] EMNİYET İPTALİ! Dolum alanı temiz değil.")
    return {"status": "success"}

@app.post("/api/refill_syrup")
def refill_syrup():
    serial_manager.trigger_refill_valve("ON")
    # Simulation in mock
    if serial_manager.mock_mode:
        state["syrupTankCurrentVolumeMl"] = 50000.0
        state["laserSensorDistanceMm"] = 15
        database.update_system_config({"current_tank_volume_ml": 50000})
        log_message("[SYS] [MOCK] Şerbet deposu dolduruldu (50.0L).")
    else:
        # In real hardware, trigger_refill_valve is ON, it will close when ultrasonic/pressure reads full
        log_message("[SYS] Manuel depo dolum valfi açıldı. Lazer doluluk sınırına ulaşınca otomatik kapanacaktır.")
    return {"status": "success"}

# --- REST API CONFIG & SETTINGS ---

class ConfigUpdate(BaseModel):
    settings: Dict[str, Any]

@app.post("/api/settings/config")
def update_config(payload: ConfigUpdate):
    database.update_system_config(payload.settings)
    reload_system_data()
    log_message("[SYS] Sistem yapılandırması veritabanından güncellendi.")
    return {"status": "success", "config": state["config"]}

class RecipeSchema(BaseModel):
    id: str
    name: str
    volumeMl: int
    fillTimeMs: int
    settlingTimeMs: int
    dripWaitTimeMs: int
    activeValves: list
    co2PressureBar: float = 3.5
    syrupRatioPercent: float = 12.0
    targetTempCelsius: float = 4.0
    carbonationLevel: str = 'ORTA'
    cappingTorqueNm: float = 2.2
    description: str = ''

@app.post("/api/settings/recipes")
def add_new_recipe(recipe: RecipeSchema):
    db_recipe = {
        "id": recipe.id,
        "name": recipe.name,
        "volume_ml": recipe.volumeMl,
        "fill_time_ms": recipe.fillTimeMs,
        "settling_time_ms": recipe.settlingTimeMs,
        "drip_wait_time_ms": recipe.dripWaitTimeMs,
        "active_valves": recipe.activeValves,
        "co2_pressure_bar": recipe.co2PressureBar,
        "syrup_ratio_percent": recipe.syrupRatioPercent,
        "target_temp_celsius": recipe.targetTempCelsius,
        "carbonation_level": recipe.carbonationLevel,
        "capping_torque_nm": recipe.cappingTorqueNm,
        "description": recipe.description
    }
    database.add_recipe(db_recipe)
    reload_system_data()
    log_message(f"[SYS] Yeni reçete oluşturuldu: {recipe.name}")
    return {"status": "success"}

@app.post("/api/settings/recipes/{recipe_id}")
def edit_recipe(recipe_id: str, payload: Dict[str, Any]):
    # Convert camelCase from HMI UI to snake_case for DB
    db_updates = {}
    mapping = {
        "name": "name",
        "volumeMl": "volume_ml",
        "fillTimeMs": "fill_time_ms",
        "settlingTimeMs": "settling_time_ms",
        "dripWaitTimeMs": "drip_wait_time_ms",
        "activeValves": "active_valves",
        "co2PressureBar": "co2_pressure_bar",
        "syrupRatioPercent": "syrup_ratio_percent",
        "targetTempCelsius": "target_temp_celsius",
        "carbonationLevel": "carbonation_level",
        "cappingTorqueNm": "capping_torque_nm",
        "description": "description"
    }
    for k, v in payload.items():
        if k in mapping:
            db_updates[mapping[k]] = v
            
    database.update_recipe(recipe_id, db_updates)
    reload_system_data()
    log_message(f"[SYS] Reçete parametreleri güncellendi: {recipe_id}")
    return {"status": "success"}

@app.delete("/api/settings/recipes/{recipe_id}")
def delete_recipe(recipe_id: str):
    database.remove_recipe(recipe_id)
    reload_system_data()
    log_message(f"[SYS] Reçete silindi: {recipe_id}")
    return {"status": "success"}

@app.post("/api/settings/recipes/{recipe_id}/select")
def select_active_recipe(recipe_id: str):
    if state["mode"] == "OTOMATİK" and state["autoState"] != "BEKLEMEDE":
        raise HTTPException(status_code=400, detail="Üretim devam ederken reçete değiştirilemez.")
        
    database.update_system_config({"active_recipe_id": recipe_id})
    reload_system_data()
    
    # Mark washing required due to flavor contamination safety rules
    state["isWashingRequired"] = True
    state["isWashingDone"] = False
    add_alert("WASH_REQUIRED", "WARNING", "Yıkama Zorunlu", "Reçete değişti. Kalite standardı için üretime başlamadan önce Yıkama yapılması gerekmektedir.")
    log_message(f"[SYS] Yeni dolum reçetesi seçildi: {recipe_id}. Yıkama zorunlu kılındı.")
    return {"status": "success"}

# --- HARDWARE PORT & PIN ROUTINGS REST API (DYNAMIC ROUTING OVER HMI) ---

class HardwareMappingUpdate(BaseModel):
    id: str             # e.g., 'SENS-IN', or '1' (valve)
    device_id: str      # 'NANO-1', 'NANO-2', or 'RASPI'
    pin: str            # 'D2', 'GPIO21' etc.
    enabled: bool = True

@app.post("/api/settings/hardware/valves")
def route_valve(mapping: HardwareMappingUpdate):
    database.update_valve_pin(int(mapping.id), mapping.device_id, mapping.pin, 1 if mapping.enabled else 0)
    reload_system_data()
    log_message(f"[SYS] Vana {mapping.id} çıkış pini dynamically yönlendirildi: {mapping.device_id} -> {mapping.pin}")
    return {"status": "success"}

@app.post("/api/settings/hardware/sensors")
def route_sensor(mapping: HardwareMappingUpdate):
    database.update_sensor_pin(mapping.id, mapping.device_id, mapping.pin, 1 if mapping.enabled else 0)
    reload_system_data()
    log_message(f"[SYS] Sensör {mapping.id} giriş pini dynamically yönlendirildi: {mapping.device_id} -> {mapping.pin}")
    return {"status": "success"}

@app.post("/api/settings/hardware/gates")
def route_gate(mapping: HardwareMappingUpdate):
    database.update_gate_pin(mapping.id, mapping.device_id, mapping.pin, 1 if mapping.enabled else 0)
    reload_system_data()
    log_message(f"[SYS] Kilit kapısı {mapping.id} pini dynamically yönlendirildi: {mapping.device_id} -> {mapping.pin}")
    return {"status": "success"}

class DeviceMappingUpdate(BaseModel):
    id: str
    port: str
    baudrate: int
    enabled: bool = True

@app.post("/api/settings/hardware/devices")
def route_device(mapping: DeviceMappingUpdate):
    conn = database.get_db_connection()
    conn.execute("""
    UPDATE devices 
    SET port = ?, baudrate = ?, enabled = ?
    WHERE id = ?
    """, (mapping.port, mapping.baudrate, 1 if mapping.enabled else 0, mapping.id))
    conn.commit()
    conn.close()
    reload_system_data()
    
    # Trigger dynamic hot-reconnection on the serial manager
    if serial_manager:
        success = serial_manager.update_device_connection(mapping.id, mapping.port, mapping.baudrate, mapping.enabled)
        if success:
            log_message(f"[SYS] Cihaz {mapping.id} yeni bağlantısı dinamik olarak kuruldu: {mapping.port} (Baudrate: {mapping.baudrate})")
        else:
            log_message(f"[SYS] [UYARI] Cihaz {mapping.id} bağlantısı kurulamadı! Lütfen port adını ({mapping.port}) ve kabloları kontrol edin.")
    else:
        log_message(f"[SYS] Cihaz {mapping.id} haberleşme portu güncellendi: {mapping.port} (Baudrate: {mapping.baudrate})")
        
    return {"status": "success"}

# --- MANUAL OVERRIDES (MANUEL MOD PANELI CONTROLS) ---

@app.post("/api/manual/valves/{valve_id}/toggle")
def manual_toggle_valve(valve_id: int):
    # Search for valve in RAM
    valve = next((v for v in state["valves"] if v["id"] == valve_id), None)
    if not valve:
        raise HTTPException(status_code=404, detail="Valf bulunamadı.")
        
    next_state = "OFF" if valve["isOpen"] else "ON"
    
    # Write directly to hardware dynamically
    serial_manager.write_to_device(valve["device_id"], valve["pin"], next_state)
    valve["isOpen"] = (next_state == "ON")
    
    # If pulse mode and we turned it on, set timer to shut it off
    if next_state == "ON" and valve.get("mode") == "PULSE":
        async def close_pulse():
            await asyncio.sleep(valve.get("pulse_duration_ms", 1000) / 1000.0)
            serial_manager.write_to_device(valve["device_id"], valve["pin"], "OFF")
            valve["isOpen"] = False
        asyncio.create_task(close_pulse())
        
    log_message(f"[MANUEL] Valf {valve_id} el ile {next_state} yapıldı.")
    return {"status": "success", "isOpen": valve["isOpen"]}

@app.post("/api/manual/gates/{gate_id}/operate")
def manual_operate_gate(gate_id: str, payload: Dict[str, Any]):
    # 'gate_id' matches 'GATE-IN' or 'GATE-OUT'
    gate = next((g for g in state["gates"] if g["id"] == gate_id), None)
    if not gate:
        raise HTTPException(status_code=404, detail="Kilit kapısı bulunamadı.")
        
    position = payload.get("position", 0) # 0 = CLOSE, 100 = OPEN
    cmd = "ON" if position > 0 else "OFF"
    
    serial_manager.write_to_device(gate["device_id"], gate["pin"], cmd)
    gate["isOpen"] = (cmd == "ON")
    
    log_message(f"[MANUEL] Kilit {gate_id} el ile {cmd} yapıldı.")
    return {"status": "success", "isOpen": gate["isOpen"]}

@app.post("/api/manual/counters/{counter_type}/adjust")
def adjust_bottle_counter(counter_type: str, payload: Dict[str, int]):
    # counter_type: 'input' or 'output'
    amount = payload.get("amount", 0)
    field = "inputCount" if counter_type == "input" else "outputCount"
    state[field] = max(0, state[field] + amount)
    log_message(f"[MANUEL] Şişe sayacı {counter_type} el ile ayarlandı: {state[field]}")
    return {"status": "success", "count": state[field]}

# --- APPS STARTUP CYCLES ---

@app.on_event("startup")
def startup_event():
    global serial_manager
    logger.info("Starting up FastAPI application services...")
    
    # 1. Sync data from SQLite
    reload_system_data()
    
    # 2. Start Serial Port Managers (check configuration for ports)
    # Detect if mock or live. If port configuration in DB exists, try to open.
    # For robust startup, check if we want to run mock mode. If ports don't open, fallback to mock.
    mock = True
    
    # If Nanos are enabled in database, try to connect live
    enabled_nanos = [n for n in state["devices"] if n["id"].startswith("NANO") and n["enabled"]]
    if enabled_nanos:
        # Check if we are running in production or development to decide fallback
        mock = False # Try live first!
        
    # Start manager
    serial_manager = SerialManager(event_callback=handle_hardware_event, mock_mode=mock)
    serial_manager.start()
    
    # If manager performed handshake and failed to connect to live ports, fallback to mock so server doesn't halt
    if not mock and not any(serial_manager.connections.values()):
        logger.warning("FAILED to connect to any live Arduino card. Falling back to MOCK mode for dry-run testing.")
        serial_manager.stop()
        serial_manager = SerialManager(event_callback=handle_hardware_event, mock_mode=True)
        serial_manager.start()
        state["terminalLogs"].append(f"[{time.strftime('%H:%M:%S')}] [WARN] Canlı kartlar bulunamadı. MOCK moduna geçildi.")

    state["activeAlerts"] = database.get_active_errors()
    
    # Trigger active warning on boot
    add_alert("SYS_ACTIVE", "WARNING", "Sistem Aktif", "Üretime başlamak için reçete seçin ve yıkama kontrolü yapın.")

    # 3. Spawn background workers in asyncio loops
    asyncio.create_task(bottling_state_machine_loop())
    asyncio.create_task(washing_pulse_loop())
    asyncio.create_task(telemetry_broadcast_loop())

@app.on_event("shutdown")
def shutdown_event():
    logger.info("Shutting down FastAPI application services...")
    if serial_manager:
        serial_manager.stop()

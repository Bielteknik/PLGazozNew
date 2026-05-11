import time
import threading
import json

class StateManager:
    def __init__(self, db, hw):
        self.db = db
        self.hw = hw
        self.data = {
            "mode": "BEKLEMEDE",
            "autoState": "BEKLEMEDE",
            "inputCount": 0,
            "outputCount": 0,
            "activeAlerts": [],
            "terminalLogs": [],
            "valves": self.db.get_state("valves") or [],
            "sensors": self.db.get_state("sensors") or [],
            "nanos": self.db.get_state("nanos") or [],
            "config": self.db.get_state("config") or {},
            "recipes": self.db.get_recipes(),
            "inputGate": self.db.get_state("inputGate") or {"isOpen": False, "enabled": True, "position": 0},
            "outputGate": self.db.get_state("outputGate") or {"isOpen": False, "enabled": True, "position": 0},
            "extraGates": self.db.get_state("extraGates") or [],
            "cycleHistory": self.db.get_cycle_history(),
            "isWashingDone": False,
            "isWashingRequired": False,
            "stopAfterCycleRequested": False,
            "activePrompt": None
        }
        self.on_state_change = None
        self.cycle_thread = None
        
        # Link Hardware Callbacks
        self.hw.on_input_detected = self.handle_input_trigger
        self.hw.on_output_detected = self.handle_output_trigger

    def log(self, msg):
        timestamp = time.strftime("%H:%M:%S")
        formatted = f"[{timestamp}] {msg}"
        self.data["terminalLogs"].insert(0, formatted)
        if len(self.data["terminalLogs"]) > 50:
            self.data["terminalLogs"].pop()
        print(formatted)
        self.emit_update()

    def emit_update(self):
        if self.on_state_change:
            self.on_state_change(self.data)

    def handle_input_trigger(self):
        self.data["inputCount"] += 1
        self.log(f"Giriş Sensörü: {self.data['inputCount']}. ürün algılandı.")
        if self.data["mode"] == "OTOMATİK" and self.data["autoState"] == "GIRIS_SAYILIYOR":
            target = self.data["config"].get("targetCount", 9)
            if self.data["inputCount"] >= target:
                self.process_auto_step()

    def handle_output_trigger(self):
        self.data["outputCount"] += 1
        self.log(f"Çıkış Sensörü: {self.data['outputCount']}. ürün algılandı.")
        if self.data["mode"] == "OTOMATİK" and self.data["autoState"] == "TAHLIYE":
            target = self.data["config"].get("targetCount", 9)
            if self.data["outputCount"] >= target:
                self.process_auto_step()

    def set_mode(self, mode):
        self.data["mode"] = mode
        self.log(f"Sistem Modu: {mode}")
        if mode == "MANUEL":
            self.hw.all_off()
        self.emit_update()

    def start_auto(self):
        if self.data["mode"] != "BEKLEMEDE": return
        self.data["mode"] = "OTOMATİK"
        self.data["autoState"] = "GIRIS_SAYILIYOR"
        self.data["inputCount"] = 0
        self.data["outputCount"] = 0
        self.log("Otomatik Üretim Başlatıldı.")
        self.process_auto_step()

    def process_auto_step(self):
        state = self.data["autoState"]
        
        if state == "GIRIS_SAYILIYOR":
            # Logic handled by sensor trigger
            pass
            
        elif state == "DOLUM":
            self.log("Dolum Başlıyor...")
            for v in self.data["valves"]:
                if v.get("enabled"):
                    self.hw.toggle_valve(v["pin"], True)
            
            # Wait for fill time
            fill_time = self.data["config"].get("fillTimeMs", 1500) / 1000.0
            threading.Timer(fill_time, self.finish_fill).start()

    def finish_fill(self):
        self.hw.all_off()
        self.log("Dolum Tamamlandı. Tahliye Başlıyor.")
        self.data["autoState"] = "TAHLIYE"
        self.emit_update()

    def toggle_valve_manual(self, valve_id):
        for v in self.data["valves"]:
            if v["id"] == valve_id:
                v["isOpen"] = not v["isOpen"]
                self.hw.toggle_valve(v["pin"], v["isOpen"])
                self.emit_update()
                break

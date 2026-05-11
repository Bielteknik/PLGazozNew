import time

class StateManager:
    def __init__(self, db, hw):
        self.db = db
        self.hw = hw
        self.data = {
            "mode": "BASLATMA",
            "autoState": "BEKLEMEDE",
            "inputCount": 0,
            "outputCount": 0,
            "valves": self.db.get_state("valves") or [],
            "nanos": self.db.get_state("nanos") or [
                {"id": "NANO-1", "name": "Valf Kontrol", "port": "/dev/ttyUSB0", "status": "ONLINE", "pingMs": 10, "baudRate": 9600}
            ],
            "sensors": self.db.get_state("sensors") or [],
            "terminalLogs": ["Python Backend Hazır.", "Sistem başlatılıyor..."],
            "inputGate": self.db.get_state("inputGate") or {"id": "GATE-IN", "name": "Giriş Kapısı", "isOpen": False, "position": 0, "enabled": True},
            "outputGate": self.db.get_state("outputGate") or {"id": "GATE-OUT", "name": "Çıkış Kapısı", "isOpen": False, "position": 0, "enabled": True},
            "extraGates": self.db.get_state("extraGates") or [],
            "cycleHistory": [],
            "activeAlerts": [
                { "id": "ALR-STARTUP", "code": "SYS_ACTIVE", "severity": "WARNING", "message": "Python Backend Aktif", "suggestion": "Donanım bağlantılarını kontrol edin.", "timestamp": int(time.time() * 1000), "resolved": False }
            ],
            "config": self.db.get_state("config") or {
                "recipeId": "REC-01",
                "volumeMl": 40,
                "targetCount": 9,
                "fillTimeMs": 1500,
                "settlingTimeMs": 800,
                "dripWaitTimeMs": 400,
                "inputDebounceMs": 35,
                "outputDebounceMs": 40,
                "gateSpeedPercent": 100,
                "watchdogTimeoutMs": 15000,
                "maxRetries": 3,
                "relayInversion": False,
                "autoRecovery": True,
                "manualValveMaxOpenTimeMs": 5000,
                "logLevel": "INFO",
                "heartbeatIntervalMs": 5000,
                "enableMqtt": False,
                "mqttBrokerUrl": "mqtt://localhost:1883",
                "autoCleanEnabled": False,
                "autoCleanIntervalCount": 1000,
                "maxTemperatureThreshold": 65,
                "voltageWarningLimit": 22.5,
                "emergencyStopBehavior": "FREEZE",
                "washDurationMs": 60000,
                "washValveIntervalMs": 5000
            },
            "recipes": self.db.get_recipes(),
            "serialPorts": [],
            "isWashingDone": False,
            "isWashingRequired": False,
            "stopAfterCycleRequested": False,
            "activePrompt": None
        }

    def set_mode(self, mode):
        self.data["mode"] = mode
        self.log(f"Sistem Modu Değişti: {mode}")

    def log(self, message):
        timestamp = time.strftime("%H:%M:%S")
        log_entry = f"[{timestamp}] {message}"
        print(f"[LOG] {log_entry}")
        self.data["terminalLogs"].append(log_entry)
        # Log listesini 50 satırda sınırla
        if len(self.data["terminalLogs"]) > 50:
            self.data["terminalLogs"].pop(0)

    def start_auto(self):
        self.data["mode"] = "OTOMATİK"
        self.data["autoState"] = "CALISIYOR"
        self.log("Otomatik üretim döngüsü başlatıldı.")

    def toggle_valve_manual(self, valve_id):
        valves = self.data.get("valves", [])
        for v in valves:
            if v["id"] == valve_id:
                v["isOpen"] = not v.get("isOpen", False)
                state_str = "AÇIK" if v["isOpen"] else "KAPALI"
                self.log(f"Valf {valve_id} Manuel: {state_str}")
                self.hw.control_valve(v["pin"], v["isOpen"])
                break

    def increment_input(self):
        self.data["inputCount"] += 1
        self.log(f"Giriş Lazeri: {self.data['inputCount']}")

    def increment_output(self):
        self.data["outputCount"] += 1
        self.log(f"Çıkış Lazeri: {self.data['outputCount']}")

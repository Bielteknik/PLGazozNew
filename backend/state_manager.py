import time

class StateManager:
    def __init__(self, db, hw):
        self.db = db
        self.hw = hw
        
        # Temel çalışma değerleri (Database'de tutulmaz, her açılışta sıfırlanır)
        self.data = {
            "mode": "BASLATMA",
            "autoState": "BEKLEMEDE",
            "inputCount": 0,
            "outputCount": 0,
            "terminalLogs": ["Python Backend Hazır.", "Sistem başlatılıyor..."],
            "serialPorts": [],
            "cycleHistory": [],
            "activeAlerts": [],
            "activePrompt": None,
            "isWashingDone": False,
            "isWashingRequired": False,
            "stopAfterCycleRequested": False,
            "recipes": [],
            "valves": [],
            "sensors": [],
            "nanos": []
        }
        
        # Diğer tüm konfigürasyonu Database'den yükle
        self.reload_from_db()

    def reload_from_db(self):
        """Database'deki tüm yapılandırmayı state.data içine çeker (Canlı sayaçları korur)."""
        # Canlı sayaçları yedekle
        curr_in = self.data.get("inputCount", 0)
        curr_out = self.data.get("outputCount", 0)
        
        db_state = self.db.get_all_state()
        self.data.update(db_state)
        
        # Canlı sayaçları geri yükle
        self.data["inputCount"] = curr_in
        self.data["outputCount"] = curr_out
        
        # Reçeteleri ayrıca yükle
        self.data["recipes"] = self.db.get_recipes()
        self.log("Yapılandırma veritabanından yüklendi.")
        
        # Her yüklemede donanım tarafına haber ver (Pi Sensörlerini aktive etmesi için)
        if hasattr(self, 'hw'):
            self.hw.apply_config(self.data.get("nanos", []), self.data.get("sensors", []))

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
        self.data["autoState"] = "BEKLEMEDE"
        self.log("Otomatik üretim döngüsü başlatıldı.")

    def toggle_valve_manual(self, valve_id):
        valves = self.data.get("valves", [])
        for v in valves:
            if v["id"] == valve_id:
                v["isOpen"] = not v.get("isOpen", False)
                state_str = "AÇIK" if v["isOpen"] else "KAPALI"
                self.log(f"Valf {valve_id} Manuel: {state_str}")
                self.hw.control_valve(valve_id, v["isOpen"])
                break

    def increment_input(self):
        self.data["inputCount"] += 1
        self.log(f"Giriş Lazeri: {self.data['inputCount']}")

    def increment_output(self):
        self.data["outputCount"] += 1
        self.log(f"Çıkış Lazeri: {self.data['outputCount']}")

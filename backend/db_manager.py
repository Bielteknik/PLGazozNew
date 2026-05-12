import sqlite3
import json
import os

class DatabaseManager:
    def __init__(self, db_path="plgazoz.db"):
        # Dosya yolunu kesinleştir (scriptin olduğu klasöre göre)
        self.db_path = os.path.join(os.path.dirname(__file__), db_path)
        self.init_db()

    def get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def init_db(self):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('CREATE TABLE IF NOT EXISTS system_state (key TEXT PRIMARY KEY, value TEXT)')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS recipes (
                    id TEXT PRIMARY KEY,
                    name TEXT,
                    volumeMl INTEGER,
                    targetCount INTEGER,
                    fillTimeMs INTEGER,
                    settlingTimeMs INTEGER,
                    dripWaitTimeMs INTEGER,
                    description TEXT,
                    active BOOLEAN
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS cycle_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    recipeId TEXT,
                    timestamp INTEGER,
                    duration INTEGER,
                    inputCount INTEGER,
                    outputCount INTEGER,
                    success BOOLEAN
                )
            ''')

            # Temel veriler eksikse tohumla
            cursor.execute("SELECT count(*) FROM system_state")
            if cursor.fetchone()[0] == 0:
                print("[DB] İlk kurulum: Varsayılan veriler tohumlanıyor...")
                self._seed_default_data(cursor)
                
            conn.commit()
            print(f"[DB] Veritabanı bağlantısı başarılı.")

    def _seed_default_data(self, cursor):
        defaults = {
            "config": {
                "recipeId": "RECIPE-1",
                "volumeMl": 250,
                "targetCount": 9,
                "fillTimeMs": 1500,
                "settlingTimeMs": 1000,
                "dripWaitTimeMs": 500,
                "inputDebounceMs": 200,
                "outputDebounceMs": 200,
                "gateSpeedPercent": 80,
                "watchdogTimeoutMs": 15000,
                "maxRetries": 3,
                "relayInversion": False,
                "autoRecovery": True,
                "manualValveMaxOpenTimeMs": 10000,
                "logLevel": "INFO",
                "heartbeatIntervalMs": 5000,
                "enableMqtt": False,
                "mqttBrokerUrl": "localhost",
                "autoCleanEnabled": False,
                "autoCleanIntervalCount": 10,
                "maxTemperatureThreshold": 60,
                "voltageWarningLimit": 11.5,
                "emergencyStopBehavior": "SAFE_HOME",
                "washDurationMs": 30000,
                "washValveIntervalMs": 2000
            },
            "valves": [
                {"id": 10, "name": "1", "pin": "2", "enabled": True, "isOpen": False, "mode": "CONTINUOUS"},
                {"id": 11, "name": "2", "pin": "3", "enabled": True, "isOpen": False, "mode": "CONTINUOUS"},
                {"id": 12, "name": "3", "pin": "4", "enabled": True, "isOpen": False, "mode": "CONTINUOUS"},
                {"id": 13, "name": "4", "pin": "5", "enabled": True, "isOpen": False, "mode": "CONTINUOUS"},
                {"id": 14, "name": "5", "pin": "6", "enabled": True, "isOpen": False, "mode": "CONTINUOUS"},
                {"id": 15, "name": "6", "pin": "7", "enabled": True, "isOpen": False, "mode": "CONTINUOUS"},
                {"id": 16, "name": "7", "pin": "8", "enabled": True, "isOpen": False, "mode": "CONTINUOUS"},
                {"id": 17, "name": "8", "pin": "9", "enabled": True, "isOpen": False, "mode": "CONTINUOUS"},
                {"id": 18, "name": "9", "pin": "10", "enabled": True, "isOpen": False, "mode": "CONTINUOUS"}
            ],
            "sensors": [
                {"id": "SENS-IN", "name": "Giriş Lazeri", "type": "INPUT", "pin": "17", "enabled": True, "device": "NANO", "status": "ONLINE"},
                {"id": "SENS-OUT", "name": "Çıkış Lazeri", "type": "OUTPUT", "pin": "27", "enabled": True, "device": "NANO", "status": "ONLINE"}
            ],
            "nanos": [
                {"id": "NANO-1", "name": "Kilit ve Sensörler", "port": "/dev/ttyUSB0", "status": "OFFLINE", "pingMs": 0, "baudRate": 9600},
                {"id": "NANO-2", "name": "Valf Kontrol", "port": "/dev/ttyUSB1", "status": "OFFLINE", "pingMs": 0, "baudRate": 9600}
            ],
            "inputGate": {"id": "GATE-IN", "name": "Giriş Kapısı", "isOpen": False, "pin": "G1", "enabled": True, "position": 0},
            "outputGate": {"id": "GATE-OUT", "name": "Çıkış Kapısı", "isOpen": False, "pin": "G2", "enabled": True, "position": 0},
            "extraGates": []
        }
        
        for key, value in defaults.items():
            cursor.execute("INSERT OR REPLACE INTO system_state (key, value) VALUES (?, ?)", (key, json.dumps(value)))
            
        cursor.execute("INSERT OR REPLACE INTO recipes (id, name, volumeMl, targetCount, fillTimeMs, settlingTimeMs, dripWaitTimeMs, description, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                       ("RECIPE-1", "Standart Dolum", 250, 9, 1500, 1000, 500, "9 şişe standart dolum reçetesi", True))

    def get_state(self, key):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT value FROM system_state WHERE key = ?", (key,))
            row = cursor.fetchone()
            return json.loads(row['value']) if row else None

    def save_state(self, key, value):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT OR REPLACE INTO system_state (key, value) VALUES (?, ?)", (key, json.dumps(value)))
            conn.commit()

    def get_recipes(self):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM recipes")
            return [dict(row) for row in cursor.fetchall()]

    def add_recipe(self, r):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO recipes (id, name, volumeMl, targetCount, fillTimeMs, settlingTimeMs, dripWaitTimeMs, description, active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (r['id'], r['name'], r['volumeMl'], r['targetCount'], r['fillTimeMs'], r['settlingTimeMs'], r['dripWaitTimeMs'], r['description'], False))
            conn.commit()

    def remove_recipe(self, recipe_id):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM recipes WHERE id = ?", (recipe_id,))
            conn.commit()

    def update_recipe(self, recipe_id, updates):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            for key, value in updates.items():
                cursor.execute(f"UPDATE recipes SET {key} = ? WHERE id = ?", (value, recipe_id))
            conn.commit()

    def add_cycle(self, cycle_data):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO cycle_history (recipeId, timestamp, duration, inputCount, outputCount, success)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (cycle_data['recipeId'], cycle_data['timestamp'], cycle_data['duration'], 
                  cycle_data['inputCount'], cycle_data['outputCount'], cycle_data['success']))
            conn.commit()

    def get_cycle_history(self, limit=50):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM cycle_history ORDER BY id DESC LIMIT ?", (limit,))
            return [dict(row) for row in cursor.fetchall()]

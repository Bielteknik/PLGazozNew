import sqlite3
import json
import os

class DatabaseManager:
    def __init__(self, db_path="plgazoz.db"):
        self.db_path = db_path
        self.init_db()

    def get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def init_db(self):
        # Sıfırdan kurulum için veritabanını temizle (Kullanıcı talebi)
        if os.path.exists(self.db_path):
            os.remove(self.db_path)
            
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Sistem Durumu ve Ayarlar Tablosu
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS system_state (
                    key TEXT PRIMARY KEY,
                    value TEXT
                )
            ''')
            
            # Reçeteler Tablosu
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS recipes (
                    id TEXT PRIMARY KEY,
                    name TEXT,
                    targetCount INTEGER,
                    fillTimeMs INTEGER,
                    waitAfterFillMs INTEGER,
                    active BOOLEAN
                )
            ''')
            
            # Üretim Geçmişi (Döngüler) Tablosu
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

            # Varsayılan Verileri Ekle
            self._seed_default_data(cursor)
            conn.commit()
            print(f"[DB] Veritabanı başarıyla sıfırlandı ve kuruldu: {self.db_path}")

    def _seed_default_data(self, cursor):
        # Varsayılan Ayarlar (SystemConfig tipine tam uyumlu)
        default_config = {
            "recipeId": "RECIPE-1",
            "volumeMl": 250,
            "targetCount": 9,
            "fillTimeMs": 1500,
            "settlingTimeMs": 1000,
            "dripWaitTimeMs": 500,
            "inputDebounceMs": 200,
            "outputDebounceMs": 200,
            "gateSpeedPercent": 80,
            "watchdogTimeoutMs": 5000,
            "maxRetries": 3,
            "relayInversion": False,
            "autoRecovery": True,
            "manualValveMaxOpenTimeMs": 10000,
            "logLevel": "INFO",
            "heartbeatIntervalMs": 1000,
            "enableMqtt": False,
            "mqttBrokerUrl": "localhost",
            "autoCleanEnabled": False,
            "autoCleanIntervalCount": 10,
            "maxTemperatureThreshold": 60,
            "voltageWarningLimit": 11.5,
            "emergencyStopBehavior": "SAFE_HOME",
            "washDurationMs": 30000,
            "washValveIntervalMs": 2000
        }
        cursor.execute("INSERT OR REPLACE INTO system_state (key, value) VALUES (?, ?)", ("config", json.dumps(default_config)))

        # Varsayılan Donanım Tanımları
        default_valves = [
            {"id": 10, "name": "1", "pin": "2", "enabled": True, "isOpen": False, "mode": "CONTINUOUS"},
            {"id": 11, "name": "2", "pin": "3", "enabled": True, "isOpen": False, "mode": "CONTINUOUS"},
            {"id": 12, "name": "3", "pin": "4", "enabled": True, "isOpen": False, "mode": "CONTINUOUS"},
            {"id": 13, "name": "4", "pin": "5", "enabled": True, "isOpen": False, "mode": "CONTINUOUS"},
            {"id": 14, "name": "5", "pin": "6", "enabled": True, "isOpen": False, "mode": "CONTINUOUS"},
            {"id": 15, "name": "6", "pin": "7", "enabled": True, "isOpen": False, "mode": "CONTINUOUS"},
            {"id": 16, "name": "7", "pin": "8", "enabled": True, "isOpen": False, "mode": "CONTINUOUS"},
            {"id": 17, "name": "8", "pin": "9", "enabled": True, "isOpen": False, "mode": "CONTINUOUS"},
            {"id": 18, "name": "9", "pin": "10", "enabled": True, "isOpen": False, "mode": "CONTINUOUS"}
        ]
        cursor.execute("INSERT OR REPLACE INTO system_state (key, value) VALUES (?, ?)", ("valves", json.dumps(default_valves)))

        default_sensors = [
            {"id": "SENS-IN", "name": "Giriş Lazeri", "type": "INPUT", "pin": "17", "enabled": True, "device": "RASPI", "status": "ONLINE"},
            {"id": "SENS-OUT", "name": "Çıkış Lazeri", "type": "OUTPUT", "pin": "27", "enabled": True, "device": "RASPI", "status": "ONLINE"}
        ]
        cursor.execute("INSERT OR REPLACE INTO system_state (key, value) VALUES (?, ?)", ("sensors", json.dumps(default_sensors)))

        default_nanos = [
            {"id": "NANO-1", "name": "Valf Kontrol", "port": "/dev/ttyUSB0", "status": "ONLINE", "pingMs": 10, "baudRate": 115200}
        ]
        cursor.execute("INSERT OR REPLACE INTO system_state (key, value) VALUES (?, ?)", ("nanos", json.dumps(default_nanos)))

        # Varsayılan Kapılar
        cursor.execute("INSERT OR REPLACE INTO system_state (key, value) VALUES (?, ?)", ("inputGate", json.dumps({"isOpen": False, "pin": "18", "enabled": True, "position": 0})))
        cursor.execute("INSERT OR REPLACE INTO system_state (key, value) VALUES (?, ?)", ("outputGate", json.dumps({"isOpen": False, "pin": "23", "enabled": True, "position": 0})))
        cursor.execute("INSERT OR REPLACE INTO system_state (key, value) VALUES (?, ?)", ("extraGates", json.dumps([])))

        # Varsayılan Reçete (Recipe tipine tam uyumlu)
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

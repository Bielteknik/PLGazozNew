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

            # Tablo boşsa varsayılanları yükle
            cursor.execute("SELECT count(*) FROM system_state")
            if cursor.fetchone()[0] == 0:
                print("[DB] İlk kurulum: Varsayılan veriler tohumlanıyor...")
                self._seed_default_data(cursor)
            else:
                # Mod anahtarı yoksa ekle
                cursor.execute("SELECT COUNT(*) FROM system_state WHERE key = 'mode'")
                if cursor.fetchone()[0] == 0:
                    cursor.execute("INSERT INTO system_state (key, value) VALUES ('mode', '\"MANUEL\"')")
            
            conn.commit()
            
            # Mevcut verideki eski ID'leri yeni isimlendirmeye zorla (Migration)
            cursor.execute("SELECT key, value FROM system_state WHERE key IN ('nanos', 'sensors')")
            rows = cursor.fetchall()
            for row in rows:
                key = row['key']
                data = json.loads(row['value'])
                updated = False
                
                if key == 'nanos':
                    # Sadece GatesNano ve ValvesNano'yu tut, diğerlerini sil
                    new_nanos = []
                    for n in data:
                        if n['id'] == 'NANO-1' or n['id'] == 'GatesNano':
                            n['id'] = 'GatesNano'
                            n['name'] = 'Kilit ve Sensörler'
                            n['baudRate'] = 115200
                            new_nanos.append(n)
                            updated = True
                        elif n['id'] == 'NANO-2' or n['id'] == 'ValvesNano':
                            n['id'] = 'ValvesNano'
                            n['name'] = 'Valf Kontrol'
                            n['baudRate'] = 115200
                            new_nanos.append(n)
                            updated = True
                    if updated:
                        data = new_nanos

                elif key == 'valves':
                    for v in data:
                        if 'connectionId' in v:
                            v['nanoId'] = v.pop('connectionId')
                            updated = True
                
                elif key == 'sensors':
                    for s in data:
                        if s['device'] == 'NANO' or s['device'] == 'NANO-1':
                            s['device'] = 'GatesNano'
                            updated = True
                
                if updated:
                    cursor.execute("UPDATE system_state SET value = ? WHERE key = ?", (json.dumps(data), key))
            
            conn.commit()
            print(f"[DB] Veritabanı bağlantısı başarılı.")

    def _seed_default_data(self, cursor):
        defaults = {
            "mode": "MANUEL",
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
                {"id": 10, "name": "Vana 1", "pin": "2", "enabled": True, "isOpen": False, "mode": "CONTINUOUS", "nanoId": "ValvesNano"},
                {"id": 11, "name": "Vana 2", "pin": "3", "enabled": True, "isOpen": False, "mode": "CONTINUOUS", "nanoId": "ValvesNano"},
                {"id": 12, "name": "Vana 3", "pin": "4", "enabled": True, "isOpen": False, "mode": "CONTINUOUS", "nanoId": "ValvesNano"},
                {"id": 13, "name": "Vana 4", "pin": "5", "enabled": True, "isOpen": False, "mode": "CONTINUOUS", "nanoId": "ValvesNano"},
                {"id": 14, "name": "Vana 5", "pin": "6", "enabled": True, "isOpen": False, "mode": "CONTINUOUS", "nanoId": "ValvesNano"},
                {"id": 15, "name": "Vana 6", "pin": "7", "enabled": True, "isOpen": False, "mode": "CONTINUOUS", "nanoId": "ValvesNano"},
                {"id": 16, "name": "Vana 7", "pin": "8", "enabled": True, "isOpen": False, "mode": "CONTINUOUS", "nanoId": "ValvesNano"},
                {"id": 17, "name": "Vana 8", "pin": "11", "enabled": True, "isOpen": False, "mode": "CONTINUOUS", "nanoId": "ValvesNano"},
                {"id": 18, "name": "Vana 9", "pin": "12", "enabled": True, "isOpen": False, "mode": "CONTINUOUS", "nanoId": "ValvesNano"}
            ],
            "sensors": [
                {"id": "SENS-IN", "name": "Giriş Lazeri", "type": "INPUT", "pin": "17", "enabled": True, "device": "GatesNano", "status": "ONLINE"},
                {"id": "SENS-OUT", "name": "Çıkış Lazeri", "type": "OUTPUT", "pin": "27", "enabled": True, "device": "GatesNano", "status": "ONLINE"}
            ],
            "nanos": [
                {"id": "GatesNano", "name": "Kilit ve Sensörler", "port": "/dev/ttyUSB0", "status": "OFFLINE", "pingMs": 0, "baudRate": 115200},
                {"id": "ValvesNano", "name": "Valf Kontrol", "port": "/dev/ttyUSB1", "status": "OFFLINE", "pingMs": 0, "baudRate": 115200}
            ],
            "inputGate": {"id": "G-IN", "name": "Giriş Kapısı", "pin": "G1", "stepPin": 2, "dirPin": 5, "enPin": 8, "isOpen": False, "nanoId": "GatesNano", "enabled": True, "position": 0},
            "outputGate": {"id": "G-OUT", "name": "Çıkış Kapısı", "pin": "G2", "stepPin": 3, "dirPin": 6, "enPin": 8, "isOpen": False, "nanoId": "GatesNano", "enabled": True, "position": 0},
            "extraGates": []
        }
        
        for key, value in defaults.items():
            cursor.execute("INSERT OR REPLACE INTO system_state (key, value) VALUES (?, ?)", (key, json.dumps(value)))
            
        cursor.execute("INSERT OR REPLACE INTO recipes (id, name, volumeMl, targetCount, fillTimeMs, settlingTimeMs, dripWaitTimeMs, description, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                       ("RECIPE-1", "Standart Dolum", 250, 9, 1500, 1000, 500, "9 şişe standart dolum reçetesi", True))

    def get_all_state(self):
        """Tüm system_state tablosunu bir sözlük olarak döner."""
        state = {}
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT key, value FROM system_state")
            for row in cursor.fetchall():
                state[row['key']] = json.loads(row['value'])
        return state

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
                  cycle_data['inputCount'], cycle_data['outputCount'], cycle_data['validationStatus'] == 'PASS'))
            conn.commit()

    def get_cycle_history(self, limit=50):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM cycle_history ORDER BY id DESC LIMIT ?", (limit,))
            return [dict(row) for row in cursor.fetchall()]

    def reset_hardware_links(self):
        """Tüm donanım eşleşmelerini ve nano listesini sıfırlar."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            # Nanoları sil
            cursor.execute("UPDATE system_state SET value = '[]' WHERE key = 'nanos'")
            
            # Valf eşleşmelerini temizle
            cursor.execute("SELECT value FROM system_state WHERE key = 'valves'")
            row = cursor.fetchone()
            if row:
                valves = json.loads(row[0])
                for v in valves: v['nanoId'] = None
                cursor.execute("UPDATE system_state SET value = ? WHERE key = 'valves'", (json.dumps(valves),))
            
            # Sensörleri temizle
            cursor.execute("SELECT value FROM system_state WHERE key = 'sensors'")
            row = cursor.fetchone()
            if row:
                sensors = json.loads(row[0])
                for s in sensors: 
                    s['device'] = None
                    s['type'] = 'ARDUINO' # Varsayılan olarak Nano moduna al
                cursor.execute("UPDATE system_state SET value = ? WHERE key = 'sensors'", (json.dumps(sensors),))
            
            # Kilitleri temizle
            for key in ['inputGate', 'outputGate']:
                cursor.execute(f"SELECT value FROM system_state WHERE key = '{key}'")
                row = cursor.fetchone()
                if row:
                    gate = json.loads(row[0])
                    gate['nanoId'] = None
                    cursor.execute(f"UPDATE system_state SET value = ? WHERE key = '{key}'", (json.dumps(gate),))
            
            conn.commit()
            print("[DB] Donanım eşleşmeleri sıfırlandı.")

import sqlite3
import json
import os
import time
import uuid

DB_PATH = os.path.join(os.path.dirname(__file__), "plgazoz.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Devices Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        connection_type TEXT NOT NULL,
        port TEXT,
        baudrate INTEGER DEFAULT 115200,
        enabled INTEGER DEFAULT 1
    )
    """)

    # 2. Valves Config Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS valves_config (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        device_id TEXT NOT NULL,
        pin TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        mode TEXT DEFAULT 'CONTINUOUS',
        pulse_duration_ms INTEGER DEFAULT 1000,
        FOREIGN KEY (device_id) REFERENCES devices(id)
    )
    """)

    # 3. Sensors Config Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sensors_config (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        device_id TEXT NOT NULL,
        pin TEXT NOT NULL,
        type TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        resistor_type TEXT DEFAULT 'PULLUP',
        debounce_ms INTEGER DEFAULT 35,
        FOREIGN KEY (device_id) REFERENCES devices(id)
    )
    """)

    # 4. Gates Config Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS gates_config (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        device_id TEXT NOT NULL,
        pin TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        FOREIGN KEY (device_id) REFERENCES devices(id)
    )
    """)

    # 5. Recipes Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS recipes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        volume_ml INTEGER NOT NULL,
        fill_time_ms INTEGER NOT NULL,
        settling_time_ms INTEGER NOT NULL,
        drip_wait_time_ms INTEGER NOT NULL,
        active_valves TEXT NOT NULL,
        co2_pressure_bar REAL DEFAULT 4.0,
        syrup_ratio_percent REAL DEFAULT 12.0,
        target_temp_celsius REAL DEFAULT 4.0,
        carbonation_level TEXT DEFAULT 'YÜKSEK',
        capping_torque_nm REAL DEFAULT 2.4,
        description TEXT,
        is_system INTEGER DEFAULT 0
    )
    """)

    # 6. Production History Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS production_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cycle_uuid TEXT NOT NULL UNIQUE,
        recipe_id TEXT NOT NULL,
        recipe_name TEXT NOT NULL,
        start_timestamp INTEGER NOT NULL,
        end_timestamp INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        input_count INTEGER NOT NULL,
        output_count INTEGER NOT NULL,
        status TEXT NOT NULL,
        operator_name TEXT DEFAULT 'Operatör',
        syrup_used_ml INTEGER NOT NULL,
        FOREIGN KEY (recipe_id) REFERENCES recipes(id)
    )
    """)

    # 7. Error Logs Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS error_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        error_code TEXT NOT NULL,
        severity TEXT NOT NULL,
        message TEXT NOT NULL,
        suggestion TEXT,
        cycle_uuid TEXT,
        resolved INTEGER DEFAULT 0,
        resolved_timestamp INTEGER,
        FOREIGN KEY (cycle_uuid) REFERENCES production_history(cycle_uuid)
    )
    """)

    # 8. System Config Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS system_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        active_recipe_id TEXT NOT NULL,
        target_count INTEGER DEFAULT 4,
        tank_capacity_ml INTEGER DEFAULT 50000,
        current_tank_volume_ml INTEGER DEFAULT 50000,
        watchdog_timeout_ms INTEGER DEFAULT 15000,
        auto_recovery INTEGER DEFAULT 1,
        log_level TEXT DEFAULT 'INFO',
        refill_lower_limit_ml INTEGER DEFAULT 5000,
        FOREIGN KEY (active_recipe_id) REFERENCES recipes(id)
    )
    """)

    # --- SEED DATA ---
    
    # Seed Devices
    cursor.execute("SELECT COUNT(*) FROM devices")
    if cursor.fetchone()[0] == 0:
        cursor.executemany("""
        INSERT INTO devices (id, name, connection_type, port, baudrate, enabled) VALUES (?, ?, ?, ?, ?, ?)
        """, [
            ('Valfler', 'Nano 1 - Röle Kartı (Valfler)', 'UART', '/dev/ttyAMA0', 115200, 1),
            ('Sensors', 'Nano 2 - Sensör & Kilit (Sensors)', 'USB', '/dev/ttyUSB0', 115200, 1),
            ('RASPI', 'Raspberry Pi 5 GPIO', 'INTERNAL', None, None, 1)
        ])

    # Seed Valves Config
    cursor.execute("SELECT COUNT(*) FROM valves_config")
    if cursor.fetchone()[0] == 0:
        cursor.executemany("""
        INSERT INTO valves_config (id, name, device_id, pin, enabled, mode, pulse_duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, [
            (1, 'Dolum Nozzle 1', 'Valfler', 'D2', 1, 'CONTINUOUS', 1000),
            (2, 'Dolum Nozzle 2', 'Valfler', 'D3', 1, 'CONTINUOUS', 1000),
            (3, 'Dolum Nozzle 3', 'Valfler', 'D4', 1, 'CONTINUOUS', 1000),
            (4, 'Dolum Nozzle 4', 'Valfler', 'D5', 1, 'CONTINUOUS', 1000),
            (5, 'Dolum Nozzle 5', 'Valfler', 'D6', 1, 'CONTINUOUS', 1000),
            (6, 'Dolum Nozzle 6', 'Valfler', 'D7', 1, 'CONTINUOUS', 1000),
            (7, 'Dolum Nozzle 7', 'Valfler', 'D8', 1, 'CONTINUOUS', 1000),
            (8, 'Dolum Nozzle 8', 'Valfler', 'D9', 1, 'CONTINUOUS', 1000),
            (9, 'Şerbet Tank Besleme Valfi', 'Valfler', 'D10', 1, 'CONTINUOUS', 1000)
        ])

    # Seed Sensors Config
    cursor.execute("SELECT COUNT(*) FROM sensors_config")
    if cursor.fetchone()[0] == 0:
        cursor.executemany("""
        INSERT INTO sensors_config (id, name, device_id, pin, type, enabled, resistor_type, debounce_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            ('SENS-IN', 'Giriş Şişe Bariyeri', 'Sensors', 'D2', 'INPUT', 1, 'PULLUP', 35),
            ('SENS-OUT', 'Çıkış Şişe Bariyeri', 'Sensors', 'D3', 'OUTPUT', 1, 'PULLUP', 35),
            ('SENS-LEVEL', 'HC-SR04 Seviye Sensörü', 'Sensors', 'D7,D8', 'LEVEL', 1, 'NONE', 0)
        ])

    # Seed Gates Config
    cursor.execute("SELECT COUNT(*) FROM gates_config")
    if cursor.fetchone()[0] == 0:
        cursor.executemany("""
        INSERT INTO gates_config (id, name, device_id, pin, enabled) VALUES (?, ?, ?, ?, ?)
        """, [
            ('GATE-IN', 'Giriş Selenoid Kilidi', 'Sensors', 'D5', 1),
            ('GATE-OUT', 'Çıkış Selenoid Kilidi', 'Sensors', 'D6', 1)
        ])

    # Seed Recipes
    cursor.execute("SELECT COUNT(*) FROM recipes")
    if cursor.fetchone()[0] == 0:
        cursor.executemany("""
        INSERT INTO recipes (id, name, volume_ml, fill_time_ms, settling_time_ms, drip_wait_time_ms, active_valves, co2_pressure_bar, syrup_ratio_percent, target_temp_celsius, carbonation_level, capping_torque_nm, description, is_system) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            ('REC-SADE', 'Klasik Sade Gazoz (250ml)', 250, 2400, 600, 1000, '[1,2,3,4]', 4.2, 12.0, 4.0, 'YÜKSEK', 2.4, 'Geleneksel limon aromalı klasik sade gazoz. Yüksek karbondioksit absorbsiyonu sağlar.', 1),
            ('REC-MANDALINA', 'Bodrum Mandalinası Gazozu (250ml)', 250, 2600, 700, 1200, '[5,6,7,8]', 3.8, 14.5, 4.5, 'ORTA', 2.3, 'Bodrum mandalina özlü lezzetli formül.', 1),
            ('REC-KARADUT', 'Ege Karadut Gazozu (330ml)', 330, 3200, 800, 1400, '[1,3,5,7]', 3.5, 16.0, 3.8, 'ORTA', 2.5, 'Gurme Ege karadut özlü gazoz.', 1),
            ('REC-TONIK', 'Zencefilli Elma Tonik (200ml)', 200, 2000, 500, 800, '[2,4,6,8]', 4.5, 10.0, 3.5, 'YÜKSEK', 2.6, 'Zencefil ve tonik asitli aromatik dolum.', 1)
        ])

    # Seed System Config
    cursor.execute("SELECT COUNT(*) FROM system_config")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
        INSERT INTO system_config (id, active_recipe_id, target_count, tank_capacity_ml, current_tank_volume_ml, watchdog_timeout_ms, auto_recovery, log_level, refill_lower_limit_ml)
        VALUES (1, 'REC-SADE', 4, 50000, 48500, 15000, 1, 'INFO', 5000)
        """)

    conn.commit()
    conn.close()

# --- HELPER FUNCTIONS FOR BACKEND SERVICE ---

def get_devices():
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM devices").fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_valves():
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM valves_config").fetchall()
    conn.close()
    return [dict(r) for r in rows]

def update_valve_pin(valve_id: int, device_id: str, pin: str, enabled: int = 1):
    conn = get_db_connection()
    conn.execute("""
    UPDATE valves_config 
    SET device_id = ?, pin = ?, enabled = ?
    WHERE id = ?
    """, (device_id, pin, enabled, valve_id))
    conn.commit()
    conn.close()

def get_sensors():
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM sensors_config").fetchall()
    conn.close()
    return [dict(r) for r in rows]

def update_sensor_pin(sensor_id: str, device_id: str, pin: str, enabled: int = 1):
    conn = get_db_connection()
    conn.execute("""
    UPDATE sensors_config 
    SET device_id = ?, pin = ?, enabled = ?
    WHERE id = ?
    """, (device_id, pin, enabled, sensor_id))
    conn.commit()
    conn.close()

def get_gates():
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM gates_config").fetchall()
    conn.close()
    return [dict(r) for r in rows]

def update_gate_pin(gate_id: str, device_id: str, pin: str, enabled: int = 1):
    conn = get_db_connection()
    conn.execute("""
    UPDATE gates_config 
    SET device_id = ?, pin = ?, enabled = ?
    WHERE id = ?
    """, (device_id, pin, enabled, gate_id))
    conn.commit()
    conn.close()

def get_recipes():
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM recipes").fetchall()
    conn.close()
    recipes = []
    for r in rows:
        d = dict(r)
        d['active_valves'] = json.loads(d['active_valves'])
        recipes.append(d)
    return recipes

def add_recipe(recipe: dict):
    conn = get_db_connection()
    conn.execute("""
    INSERT INTO recipes (id, name, volume_ml, fill_time_ms, settling_time_ms, drip_wait_time_ms, active_valves, co2_pressure_bar, syrup_ratio_percent, target_temp_celsius, carbonation_level, capping_torque_nm, description, is_system)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    """, (
        recipe['id'], recipe['name'], recipe['volume_ml'], recipe['fill_time_ms'],
        recipe['settling_time_ms'], recipe['drip_wait_time_ms'], json.dumps(recipe['active_valves']),
        recipe.get('co2_pressure_bar', 4.0), recipe.get('syrup_ratio_percent', 12.0),
        recipe.get('target_temp_celsius', 4.0), recipe.get('carbonation_level', 'YÜKSEK'),
        recipe.get('capping_torque_nm', 2.4), recipe.get('description', '')
    ))
    conn.commit()
    conn.close()

def update_recipe(recipe_id: str, updates: dict):
    conn = get_db_connection()
    fields = []
    values = []
    for k, v in updates.items():
        if k == 'id':
            continue
        fields.append(f"{k} = ?")
        if k == 'active_valves':
            values.append(json.dumps(v))
        else:
            values.append(v)
    
    values.append(recipe_id)
    query = f"UPDATE recipes SET {', '.join(fields)} WHERE id = ?"
    conn.execute(query, values)
    conn.commit()
    conn.close()

def remove_recipe(recipe_id: str):
    conn = get_db_connection()
    # Ensure it's not a system default recipe
    conn.execute("DELETE FROM recipes WHERE id = ? AND is_system = 0", (recipe_id,))
    conn.commit()
    conn.close()

def get_system_config():
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM system_config WHERE id = 1").fetchone()
    conn.close()
    return dict(row) if row else None

def update_system_config(updates: dict):
    conn = get_db_connection()
    fields = []
    values = []
    for k, v in updates.items():
        if k == 'id':
            continue
        fields.append(f"{k} = ?")
        values.append(v)
    values.append(1) # ID = 1
    query = f"UPDATE system_config SET {', '.join(fields)} WHERE id = ?"
    conn.execute(query, values)
    conn.commit()
    conn.close()

def add_production_log(log: dict):
    conn = get_db_connection()
    conn.execute("""
    INSERT INTO production_history (cycle_uuid, recipe_id, recipe_name, start_timestamp, end_timestamp, duration_ms, input_count, output_count, status, operator_name, syrup_used_ml)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        log.get('cycle_uuid', str(uuid.uuid4())), log['recipe_id'], log['recipe_name'],
        log['start_timestamp'], log['end_timestamp'], log['duration_ms'],
        log['input_count'], log['output_count'], log['status'],
        log.get('operator_name', 'Operatör'), log['syrup_used_ml']
    ))
    conn.commit()
    conn.close()

def get_production_history(limit: int = 50):
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM production_history ORDER BY start_timestamp DESC LIMIT ?", (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def add_error_log(err: dict):
    conn = get_db_connection()
    conn.execute("""
    INSERT INTO error_logs (timestamp, error_code, severity, message, suggestion, cycle_uuid, resolved)
    VALUES (?, ?, ?, ?, ?, ?, 0)
    """, (
        err.get('timestamp', int(time.time() * 1000)), err['error_code'], err['severity'],
        err['message'], err.get('suggestion', ''), err.get('cycle_uuid')
    ))
    conn.commit()
    conn.close()

def resolve_all_errors():
    conn = get_db_connection()
    conn.execute("UPDATE error_logs SET resolved = 1, resolved_timestamp = ? WHERE resolved = 0", (int(time.time() * 1000),))
    conn.commit()
    conn.close()

def get_active_errors():
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM error_logs WHERE resolved = 0 ORDER BY timestamp DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

# Run schema initialization when imported/called
init_db()

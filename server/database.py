import sqlite3
import json
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "plgazoz.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Recipes table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS recipes (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            volumeMl INTEGER,
            targetCount INTEGER,
            fillTimeMs INTEGER,
            settlingTimeMs INTEGER,
            dripWaitTimeMs INTEGER,
            description TEXT
        )
    ''')
    
    # System Config table (Single row)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS system_config (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            data TEXT NOT NULL
        )
    ''')
    
    # Cycle History table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cycle_history (
            id TEXT PRIMARY KEY,
            timestamp INTEGER,
            recipeName TEXT,
            inputCount INTEGER,
            outputCount INTEGER,
            status TEXT
        )
    ''')
    
    conn.commit()
    conn.close()

class DatabaseManager:
    def __init__(self):
        init_db()

    # --- Recipes ---
    def get_recipes(self):
        conn = get_db()
        recipes = [dict(row) for row in conn.execute("SELECT * FROM recipes").fetchall()]
        conn.close()
        return recipes

    def save_recipe(self, recipe):
        conn = get_db()
        conn.execute('''
            INSERT OR REPLACE INTO recipes 
            (id, name, volumeMl, targetCount, fillTimeMs, settlingTimeMs, dripWaitTimeMs, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (recipe['id'], recipe['name'], recipe['volumeMl'], recipe['targetCount'], 
              recipe['fillTimeMs'], recipe['settlingTimeMs'], recipe['dripWaitTimeMs'], recipe['description']))
        conn.commit()
        conn.close()

    def delete_recipe(self, recipe_id):
        conn = get_db()
        conn.execute("DELETE FROM recipes WHERE id = ?", (recipe_id,))
        conn.commit()
        conn.close()

    # --- Config ---
    def get_config(self):
        conn = get_db()
        row = conn.execute("SELECT data FROM system_config WHERE id = 1").fetchone()
        conn.close()
        return json.loads(row['data']) if row else None

    def save_config(self, config_data):
        conn = get_db()
        conn.execute("INSERT OR REPLACE INTO system_config (id, data) VALUES (1, ?)", (json.dumps(config_data),))
        conn.commit()
        conn.close()

    # --- History ---
    def get_history(self, limit=100):
        conn = get_db()
        history = [dict(row) for row in conn.execute("SELECT * FROM cycle_history ORDER BY timestamp DESC LIMIT ?", (limit,)).fetchall()]
        conn.close()
        return history

    def add_history(self, passport):
        conn = get_db()
        conn.execute('''
            INSERT INTO cycle_history (id, timestamp, recipeName, inputCount, outputCount, status)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (passport['id'], passport['timestamp'], passport['recipeName'], 
              passport['inputCount'], passport['outputCount'], passport['status']))
        conn.commit()
        conn.close()

db = DatabaseManager()

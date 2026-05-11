import Database from 'better-sqlite3';
import path from 'path';

export class DatabaseManager {
  private db: Database.Database;

  constructor() {
    const dbPath = path.join(__dirname, '../../database.sqlite');
    this.db = new Database(dbPath);
    this.initTables();
  }

  private initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cycle_history (
        id TEXT PRIMARY KEY,
        recipeName TEXT,
        timestamp INTEGER,
        duration INTEGER,
        inputCount INTEGER,
        outputCount INTEGER,
        validationStatus TEXT,
        operatorId TEXT
      );

      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        code TEXT,
        severity TEXT,
        message TEXT,
        timestamp INTEGER,
        resolved INTEGER
      );

      CREATE TABLE IF NOT EXISTS system_state (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
    console.log('[Database] Tables initialized');
  }

  public insertCycle(cycle: any) {
    const stmt = this.db.prepare(`
      INSERT INTO cycle_history (id, recipeName, timestamp, duration, inputCount, outputCount, validationStatus, operatorId)
      VALUES (@id, @recipeName, @timestamp, @duration, @inputCount, @outputCount, @validationStatus, @operatorId)
    `);
    stmt.run(cycle);
  }

  public getRecentCycles(limit = 100) {
    return this.db.prepare('SELECT * FROM cycle_history ORDER BY timestamp DESC LIMIT ?').all(limit);
  }

  public setState(key: string, value: any) {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO system_state (key, value) VALUES (?, ?)');
    stmt.run(key, JSON.stringify(value));
  }

  public getState(key: string): any {
    const stmt = this.db.prepare('SELECT value FROM system_state WHERE key = ?');
    const row = stmt.get(key) as { value: string } | undefined;
    if (row && row.value) {
      try {
        return JSON.parse(row.value);
      } catch (e) {
        console.error(`[Database] Error parsing JSON for key ${key}`, e);
        return null;
      }
    }
    return null;
  }
}

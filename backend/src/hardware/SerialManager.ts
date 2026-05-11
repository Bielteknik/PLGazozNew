import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

export class SerialManager {
  private ports: Map<string, SerialPort> = new Map();
  public onData?: (id: string, data: string) => void;
  public onStatus?: (id: string, status: 'ONLINE' | 'OFFLINE') => void;

  constructor() {
    this.scanPorts();
  }

  public async scanPorts(): Promise<string[]> {
    try {
      const available = await SerialPort.list();
      const paths = available.map(p => p.path);
      console.log('[Serial] Available system ports:', paths);
      return paths;
    } catch (err) {
      console.error('[Serial] Error scanning ports:', err);
      return [];
    }
  }

  public connect(id: string, path: string, baudRate: number = 9600) {
    if (this.ports.has(id)) {
      this.disconnect(id);
    }

    const port = new SerialPort({ path, baudRate, autoOpen: false });
    const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

    port.on('open', () => {
      console.log(`[Serial] Connected to ${id} on ${path}`);
    });

    parser.on('data', (data: string) => {
      console.log(`[Serial] Data from ${id}: ${data}`);
      this.handleIncomingData(id, data.trim());
    });

    port.on('close', () => {
      console.log(`[Serial] Port ${path} for ${id} closed.`);
      this.ports.delete(id);
      this.onStatus?.(id, 'OFFLINE');
    });

    port.on('error', (err) => {
      console.error(`[Serial] Error on ${id}:`, err);
      this.ports.delete(id);
      this.onStatus?.(id, 'OFFLINE');
    });

    this.ports.set(id, port);

    // Açıkça portu açıyoruz
    port.open((err) => {
      if (err) {
        console.error(`[Serial] Error opening port ${path} for ${id}:`, err.message);
        this.onStatus?.(id, 'OFFLINE');
      } else {
        console.log(`[Serial] Successfully connected to ${id} on ${path}`);
        this.onStatus?.(id, 'ONLINE');
      }
    });
  }

  public disconnect(id: string) {
    const port = this.ports.get(id);
    if (port && port.isOpen) {
      port.close();
      this.ports.delete(id);
      this.onStatus?.(id, 'OFFLINE');
      console.log(`[Serial] Disconnected from ${id}`);
    }
  }

  public sendCommand(id: string, command: string) {
    const port = this.ports.get(id);

    // Echo outgoing command to terminal
    if (this.onData) {
      this.onData(id, `-> ${command}`);
    }

    if (port && port.isOpen) {
      port.write(`${command}\n`);
    } else {
      const errorMsg = `ERR: ${id} not connected`;
      console.warn(`[Serial] ${errorMsg}`);
      if (this.onData) {
        this.onData(id, errorMsg);
      }
    }
  }

  // --- Helpers for Protocol ---

  private getTargetNano(defaultId: string): string {
    if (this.ports.has(defaultId)) return defaultId;
    // Fallback: find any connected NANO
    const anyNano = Array.from(this.ports.keys()).find(id => id.includes('NANO'));
    return anyNano || defaultId;
  }

  public sendGateCommand(target: 'INPUT' | 'OUTPUT', state: 'OPEN' | 'CLOSE') {
    const nanoId = this.getTargetNano('NANO-1');
    const gateId = (target === 'INPUT') ? 1 : 2;
    const pos = (state === 'OPEN') ? 100 : 0;

    this.sendCommand(nanoId, `G${gateId}:${pos}`);
  }

  public sendValveCommand(valveId: number | 'ALL', state: 'ON' | 'OFF') {
    const nanoId = this.getTargetNano('NANO-2');
    this.sendCommand(nanoId, `VALVE_CMD:${valveId}:${state}`);
  }

  private handleIncomingData(id: string, data: string) {
    // Parse Arduino response (e.g. ACK, sensor reads)
    // Fire and Forget is primary, but we log ACKs
    if (data.startsWith('ACK:')) {
      console.log(`[Serial ACK] ${id}: ${data}`);
    } else if (data.startsWith('SENSOR:')) {
      // In case we read optical limits from NANO-1
      console.log(`[Serial SENSOR] ${id}: ${data}`);
    }

    // Broadcast raw data for terminal
    if (this.onData) {
      this.onData(id, data);
    }
  }
}

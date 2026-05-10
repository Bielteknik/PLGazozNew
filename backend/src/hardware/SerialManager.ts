import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

export class SerialManager {
  private ports: Map<string, SerialPort> = new Map();
  public onData?: (id: string, data: string) => void;

  constructor() {
    this.scanPorts();
  }

  public async scanPorts() {
    try {
      const available = await SerialPort.list();
      console.log('[Serial] Available ports:', available.map(p => p.path));
      return available;
    } catch (err) {
      console.error('[Serial] Error scanning ports:', err);
      return [];
    }
  }

  public connect(id: string, path: string, baudRate: number = 9600) {
    if (this.ports.has(id)) {
      this.disconnect(id);
    }

    const port = new SerialPort({ path, baudRate });
    const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

    port.on('open', () => {
      console.log(`[Serial] Connected to ${id} on ${path}`);
    });

    parser.on('data', (data: string) => {
      console.log(`[Serial] Data from ${id}: ${data}`);
      this.handleIncomingData(id, data.trim());
    });

    port.on('error', (err) => {
      console.error(`[Serial] Error on ${id}:`, err);
    });

    this.ports.set(id, port);
  }

  public disconnect(id: string) {
    const port = this.ports.get(id);
    if (port && port.isOpen) {
      port.close();
      this.ports.delete(id);
      console.log(`[Serial] Disconnected from ${id}`);
    }
  }

  public sendCommand(id: string, command: string) {
    const port = this.ports.get(id);
    if (port && port.isOpen) {
      port.write(`${command}\n`);
    } else {
      console.warn(`[Serial] Cannot send command to ${id}, port closed or not connected`);
    }
  }

  // --- Helpers for Protocol ---
  
  public sendGateCommand(target: 'INPUT' | 'OUTPUT', state: 'OPEN' | 'CLOSE') {
    // We assume NANO-1 is always the gate controller
    // G1 = INPUT (Gate 1), G2 = OUTPUT (Gate 2)
    // 100 = OPEN, 0 = CLOSE
    const gateId = (target === 'INPUT') ? 1 : 2;
    const pos = (state === 'OPEN') ? 100 : 0;
    
    this.sendCommand('NANO-1', `G${gateId}:${pos}`);
  }

  public sendValveCommand(valveId: number | 'ALL', state: 'ON' | 'OFF') {
    // We assume NANO-2 is always the valve controller
    this.sendCommand('NANO-2', `VALVE_CMD:${valveId}:${state}`);
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

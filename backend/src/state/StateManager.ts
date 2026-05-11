import { SystemData, SystemMode, AutoState } from '../../../src/types/system';
import { INITIAL_STATE } from '../../../src/hooks/useSystemSimulator';
import { DatabaseManager } from '../db/DatabaseManager';
import { SerialManager } from '../hardware/SerialManager';
import { GPIOManager } from '../hardware/GPIOManager';

export class StateManager {
  private data: SystemData;
  private db: DatabaseManager;
  private cycleStartTs: number = 0;
  private currentTimeout: NodeJS.Timeout | null = null;
  private serial: SerialManager;
  private gpio: GPIOManager;
  public onUpdate: (state: SystemData) => void = () => {};
  private manualAuthToken?: string;
  private manualAuthExpires?: number;

  constructor(db: DatabaseManager, serial: SerialManager, gpio: GPIOManager, onUpdate: (state: SystemData) => void) {
    this.db = db;
    this.serial = serial;
    this.gpio = gpio;
    this.onUpdate = onUpdate;

    this.data = JSON.parse(JSON.stringify(INITIAL_STATE));
    
    // Load persisted state
    const config = this.db.getState('config');
    if (config) this.data.config = config;
    
    const recipes = this.db.getState('recipes');
    if (recipes) this.data.recipes = recipes;
    
    const valves = this.db.getState('valves');
    if (valves) this.data.valves = valves;
    
    const nanos = this.db.getState('nanos');
    if (nanos) {
      this.data.nanos = nanos;
      this.data.nanos.forEach(n => {
         if (n.port) {
            this.serial.connect(n.id, n.port, n.baudRate);
         }
      });
    }
    
    const sensors = this.db.getState('sensors');
    if (sensors) this.data.sensors = sensors;
    
    const extraGates = this.db.getState('extraGates');
    if (extraGates) this.data.extraGates = extraGates;
    
    const inputGate = this.db.getState('inputGate');
    if (inputGate) this.data.inputGate = inputGate;
    
    const outputGate = this.db.getState('outputGate');
    if (outputGate) this.data.outputGate = outputGate;

    const recentCycles = this.db.getRecentCycles(100);
    if (recentCycles) this.data.cycleHistory = recentCycles as any;

    // Set initial transient state
    this.data.mode = 'BEKLEMEDE';
    this.data.autoState = 'BEKLEMEDE';

    // Wire GPIO events to State Machine
    this.gpio.onInputDetected = () => this.handleInputLaser();
    this.gpio.onOutputDetected = () => this.handleOutputLaser();

    // Wire Serial status events to State
    this.serial.onStatus = (id, status) => {
      this.updateData(p => ({
        ...p,
        nanos: p.nanos.map(n => n.id === id ? { ...n, status } : n)
      }));
    };
  }

  public setManualAuth(token: string, expires: number) {
    this.manualAuthToken = token;
    this.manualAuthExpires = expires;
    console.log('[Auth] Manual token set, expires at', new Date(expires).toISOString());
  }

  public clearManualAuth() {
    this.manualAuthToken = undefined;
    this.manualAuthExpires = undefined;
    console.log('[Auth] Manual token cleared');
  }

  // Handle hardware laser interrupts
  private handleInputLaser() {
    if (this.data.mode === 'OTOMATİK' && this.data.autoState === 'GIRIS_SAYILIYOR') {
      this.updateData(p => {
         const activeTargetCount = Math.min(p.config.targetCount, p.valves.filter(v => v.enabled).length);
         if (p.inputCount < activeTargetCount) {
             return { ...p, inputCount: p.inputCount + 1 };
         }
         return p;
      });
      this.processAutoState(); // Re-check if goal is reached
    }
  }

  private handleOutputLaser() {
    if (this.data.mode === 'OTOMATİK' && this.data.autoState === 'TAHLIYE') {
      this.updateData(p => {
         if (p.outputCount < p.inputCount) {
             return { ...p, outputCount: p.outputCount + 1 };
         }
         return p;
      });
      this.processAutoState(); // Re-check if all bottles are out
    }
  }

  public getState(): SystemData {
    return this.data;
  }

  private updateData(updater: (p: SystemData) => SystemData) {
    const oldData = this.data;
    this.data = updater(this.data);
    
    // Persist changes
    if (oldData.config !== this.data.config) this.db.setState('config', this.data.config);
    if (oldData.recipes !== this.data.recipes) this.db.setState('recipes', this.data.recipes);
    if (oldData.valves !== this.data.valves) this.db.setState('valves', this.data.valves);
    if (oldData.nanos !== this.data.nanos) this.db.setState('nanos', this.data.nanos);
    if (oldData.sensors !== this.data.sensors) this.db.setState('sensors', this.data.sensors);
    if (oldData.extraGates !== this.data.extraGates) this.db.setState('extraGates', this.data.extraGates);
    if (oldData.inputGate !== this.data.inputGate) this.db.setState('inputGate', this.data.inputGate);
    if (oldData.outputGate !== this.data.outputGate) this.db.setState('outputGate', this.data.outputGate);

    this.onUpdate(this.data);
  }

  public handleAction(action: any) {
    const { type, payload, token } = action;
    console.log(`[StateManager] Action received: ${type}`, payload);

    switch (type) {
      case 'SET_MODE':
        this.setMode(payload.mode);
        break;
      case 'START_AUTO_CYCLE':
        this.startAutoCycle();
        break;
      case 'ANSWER_PROMPT':
        this.answerPrompt(payload.answer);
        break;
      case 'TOGGLE_HARDWARE_STATUS':
        this.updateData(p => {
           const id = payload.id;
           return {
              ...p,
              valves: p.valves.map(v => v.id === id ? { ...v, enabled: !v.enabled } : v)
           };
        });
        break;
      case 'ACKNOWLEDGE_STARTUP':
        this.updateData(p => ({ ...p, mode: 'BEKLEMEDE', autoState: 'BEKLEMEDE' }));
        break;
      case 'ACKNOWLEDGE_FAULT':
        this.updateData(p => ({ ...p, mode: 'BEKLEMEDE', autoState: 'BEKLEMEDE', activeAlerts: p.activeAlerts.map(a => ({...a, resolved: true})) }));
        break;
      case 'REQUEST_STOP_AFTER_CYCLE':
        this.updateData(p => ({ ...p, stopAfterCycleRequested: true }));
        break;

      // Configuration Actions
      case 'ADD_HARDWARE':
        this.updateData(p => {
          if (payload.nano.port) {
            this.serial.connect(payload.nano.id, payload.nano.port, payload.nano.baudRate);
          }
          return { ...p, nanos: [...p.nanos, payload.nano] };
        });
        break;
      case 'REMOVE_HARDWARE':
        this.serial.disconnect(payload.id);
        this.updateData(p => ({ ...p, nanos: p.nanos.filter(n => n.id !== payload.id) }));
        break;
      case 'UPDATE_NANO_CONFIG':
        this.updateData(p => {
          const newNanos = p.nanos.map(n => n.id === payload.id ? { ...n, ...payload.config } : n);
          const updatedNano = newNanos.find(n => n.id === payload.id);
          if (updatedNano && (payload.config.port !== undefined || payload.config.baudRate !== undefined)) {
             if (updatedNano.port) {
               this.serial.connect(updatedNano.id, updatedNano.port, updatedNano.baudRate);
             } else {
               this.serial.disconnect(updatedNano.id);
             }
          }
          return { ...p, nanos: newNanos };
        });
        break;
      case 'ADD_VALVE':
        this.updateData(p => ({ ...p, valves: [...p.valves, payload.valve] }));
        break;
      case 'REMOVE_VALVE':
        this.updateData(p => ({ ...p, valves: p.valves.filter(v => Number(v.id) !== Number(payload.id)) }));
        break;
      case 'TOGGLE_HARDWARE_STATUS':
        this.updateData(p => {
           const id = payload.id;
           return {
              ...p,
              valves: p.valves.map(v => Number(v.id) === Number(id) ? { ...v, enabled: !v.enabled } : v)
           };
        });
        break;
      case 'ADD_SENSOR':
        this.updateData(p => ({ ...p, sensors: [...p.sensors, payload.sensor] }));
        break;
      case 'REMOVE_SENSOR':
        this.updateData(p => ({ ...p, sensors: p.sensors.filter(s => s.id !== payload.id) }));
        break;
      case 'UPDATE_SENSOR':
        this.updateData(p => ({ 
          ...p, 
          sensors: p.sensors.map(s => s.id === payload.id ? { ...s, ...payload.updates } : s) 
        }));
        break;
      case 'TOGGLE_SENSOR_ENABLED':
        this.updateData(p => ({ 
          ...p, 
          sensors: p.sensors.map(s => s.id === payload.id ? { ...s, enabled: !s.enabled } : s) 
        }));
        break;
      case 'ADD_GATE':
        this.updateData(p => ({ ...p, extraGates: [...(p.extraGates || []), payload.gate] }));
        break;
      case 'REMOVE_GATE':
        this.updateData(p => ({ ...p, extraGates: (p.extraGates || []).filter(g => g.id !== payload.id) }));
        break;
      case 'UPDATE_GATE':
        this.updateData(p => ({ 
          ...p, 
          extraGates: (p.extraGates || []).map(g => g.id === payload.id ? { ...g, ...payload.updates } : g) 
        }));
        break;
      case 'UPDATE_SYSTEM_GATE':
        this.updateData(p => ({ 
          ...p, 
          [payload.target as keyof SystemData]: { ...((p as any)[payload.target]), ...payload.updates } 
        }));
        break;
      case 'UPDATE_VALVE':
        this.updateData(p => ({ 
          ...p, 
          valves: p.valves.map(v => Number(v.id) === Number(payload.id) ? { ...v, ...payload.updates } : v) 
        }));
        break;
      case 'UPDATE_CONFIG':
        this.updateData(p => ({ ...p, config: { ...p.config, ...payload.config } }));
        break;
      case 'ADD_RECIPE':
        this.updateData(p => ({ ...p, recipes: [...p.recipes, payload.recipe] }));
        break;
      case 'REMOVE_RECIPE':
        this.updateData(p => ({ ...p, recipes: p.recipes.filter(r => r.id !== payload.id) }));
        break;
      case 'UPDATE_RECIPE':
        this.updateData(p => ({ 
          ...p, 
          recipes: p.recipes.map(r => r.id === payload.id ? { ...r, ...payload.updates } : r) 
        }));
        break;
      case 'SELECT_RECIPE':
        this.updateData(p => ({ ...p, config: { ...p.config, recipeId: payload.id }, isWashingRequired: true }));
        break;

      case 'RESET_COUNTER':
        const { target } = payload;
        this.updateData(p => ({
          ...p,
          [target === 'input' ? 'inputCount' : 'outputCount']: 0
        }));
        break;

      case 'SEND_NANO_COMMAND':
        const { nanoId, cmd } = payload;
        this.serial.sendCommand(nanoId, cmd);
        break;
      case 'TRIGGER_FAULT':
        this.updateData(p => ({
          ...p,
          mode: 'ARIZA',
          activeAlerts: [
            { id: `ALR-${Date.now()}`, code: 'ERR_MANUAL_FAULT', severity: 'WARNING', message: 'Simüle Edilmiş Hata', suggestion: 'Kullanıcı tarafından diagnostik testi için hata tetiklendi.', timestamp: Date.now(), resolved: false },
            ...p.activeAlerts
          ]
        }));
        break;

      case 'TOGGLE_VALVE': {
        const id = payload.id;
        this.updateData(p => {
          const valve = p.valves.find(v => v.id === id);
          if (!valve) return p;
          const newState = !valve.isOpen;
          this.serial.sendValveCommand(valve.pin || id, newState ? 'ON' : 'OFF', valve.nanoId);
          return {
            ...p,
            valves: p.valves.map(v => v.id === id ? { ...v, isOpen: newState } : v)
          };
        });
        break;
      }
      case 'OPERATE_GATE': {
        const { target, position } = payload;
        const gateKey = target === 'inputGate' ? 'inputGate' : 'outputGate';
        const serialTarget = target === 'inputGate' ? 'INPUT' : 'OUTPUT';
        const isOpen = position > 0;
        
        this.updateData(p => {
          const gate = p[gateKey];
          this.serial.sendGateCommand(serialTarget, isOpen ? 'OPEN' : 'CLOSE', gate.nanoId);
          return {
            ...p,
            [gateKey]: { ...p[gateKey], isOpen, position }
          };
        });
        break;
      }
      case 'TOGGLE_GATE_ENABLED': {
        const target = payload.target as 'inputGate' | 'outputGate';
        this.updateData(p => ({
          ...p,
          [target]: { ...p[target], enabled: !p[target].enabled }
        }));
        break;
      }
      case 'SET_VALVE_MODE': {
        const { id, mode } = payload;
        this.updateData(p => ({
          ...p,
          valves: p.valves.map(v => v.id === id ? { ...v, mode } : v)
        }));
        break;
      }
      case 'SET_VALVE_PULSE': {
        const { id, duration } = payload;
        this.updateData(p => ({
          ...p,
          valves: p.valves.map(v => v.id === id ? { ...v, pulseDurationMs: duration } : v)
        }));
        break;
      }
      case 'EXIT_APPLICATION': {
        console.log('[System] Exit requested. Killing browser and stopping services...');
        const { exec } = require('child_process');
        // Kill any chromium or chrome processes
        exec('pkill chromium-browser || pkill chromium || pkill chrome');
        // Give it a moment to close before exiting backend
        setTimeout(() => {
          process.exit(0);
        }, 1000);
        break;
      }
    }
    
    return this.data;
  }

  private setMode(mode: SystemMode) {
    if (this.currentTimeout) clearTimeout(this.currentTimeout);
    
    this.updateData(p => {
      if (mode === 'YIKAMA') {
        const newState = { 
          ...p, mode, autoState: 'YIKAMA_DONGUSU' as AutoState,
          inputGate: { ...p.inputGate, isOpen: true, position: 100 },
          outputGate: { ...p.outputGate, isOpen: true, position: 100 }
        };
        this.serial.sendGateCommand('INPUT', 'OPEN', p.inputGate.nanoId);
        this.serial.sendGateCommand('OUTPUT', 'OPEN', p.outputGate.nanoId);
        this.cycleStartTs = Date.now();
        setTimeout(() => this.processAutoState(), 0);
        return newState;
      }
      if (mode === 'TAHLIYE') {
        this.serial.sendGateCommand('INPUT', 'OPEN', p.inputGate.nanoId);
        this.serial.sendGateCommand('OUTPUT', 'OPEN', p.outputGate.nanoId);
        // For 'ALL', we still fallback unless we want to loop through all nanos
        this.serial.sendValveCommand('ALL', 'OFF'); 
        return {
          ...p, mode, autoState: 'BEKLEMEDE',
          inputGate: { ...p.inputGate, isOpen: true, position: 100 },
          outputGate: { ...p.outputGate, isOpen: true, position: 100 },
          valves: p.valves.map(v => ({ ...v, isOpen: false }))
        };
      }
      return { ...p, mode };
    });
    this.processAutoState();
  }

  private startAutoCycle() {
    this.updateData(p => {
      if (p.isWashingRequired) {
          return {
             ...p,
             activeAlerts: [{
               id: `ALR-WASH-FAIL-${Date.now()}`,
               code: 'ERR_NO_WASH',
               severity: 'CRITICAL',
               message: 'Yıkama Yapılmadı',
               suggestion: 'Reçete değişimi sonrası yıkama zorunludur. Lütfen önce Yıkama döngüsünü başlatın.',
               timestamp: Date.now(),
               resolved: false
             }, ...p.activeAlerts]
          };
      }
      return { 
        ...p, 
        mode: 'OTOMATİK', 
        autoState: 'BEKLEMEDE',
        inputCount: 0, 
        outputCount: 0,
        inputGate: { ...p.inputGate, isOpen: false, position: 0 },
        outputGate: { ...p.outputGate, isOpen: false, position: 0 },
        activePrompt: 'BOTTLE_CHECK'
      };
    });
  }

  private answerPrompt(answer: boolean) {
    this.updateData(p => {
      if (p.activePrompt === 'BOTTLE_CHECK') {
        if (!answer) {
          this.cycleStartTs = Date.now();
          const nextState = {
            ...p,
            activePrompt: null as any,
            autoState: 'GIRIS_SAYILIYOR' as AutoState,
            inputGate: { ...p.inputGate, isOpen: true, position: 100 }
          };
          this.serial.sendGateCommand('INPUT', 'OPEN');
          return nextState;
        } else {
          return {
            ...p,
            activePrompt: null as any,
            mode: 'ARIZA',
            activeAlerts: [
              { id: `ALR-${Date.now()}`, code: 'ERR_BOTTLE_IN_AREA', severity: 'CRITICAL', message: 'Dolum Alanı Dolu', suggestion: 'Lütfen dolum alanındaki şişeleri tahliye edin.', timestamp: Date.now(), resolved: false },
              ...p.activeAlerts
            ]
          };
        }
      }
      return { ...p, activePrompt: null as any };
    });
    this.processAutoState();
  }

  private transitionTo(nextState: AutoState, delayMs: number) {
    if (this.currentTimeout) clearTimeout(this.currentTimeout);
    this.currentTimeout = setTimeout(() => {
      this.updateData(p => ({ ...p, autoState: nextState }));
      this.processAutoState();
    }, delayMs);
  }

  private processAutoState() {
    if (this.data.mode !== 'OTOMATİK' && this.data.mode !== 'YIKAMA') return;

    switch (this.data.autoState) {
      case 'GIRIS_SAYILIYOR':
        if (this.currentTimeout) clearTimeout(this.currentTimeout);
        this.currentTimeout = setTimeout(() => {
          this.updateData(p => {
             const activeTargetCount = Math.min(p.config.targetCount, p.valves.filter(v => v.enabled).length);
             if (p.inputCount < activeTargetCount) {
                 return { ...p, inputCount: p.inputCount + 1 };
             }
             this.serial.sendGateCommand('INPUT', 'CLOSE');
             return { ...p, autoState: 'GIRIS_KILITLI', inputGate: { ...p.inputGate, isOpen: false, position: 0 } };
          });
          this.processAutoState();
        }, 300);
        break;
        
      case 'GIRIS_KILITLI':
        this.transitionTo('DENGELEME', 1000);
        break;
        
      case 'DENGELEME':
        this.transitionTo('DOLUM', this.data.config.settlingTimeMs);
        break;
        
      case 'DOLUM':
        this.updateData(p => {
           p.valves.filter(v => v.enabled).forEach(v => this.serial.sendValveCommand(v.pin || v.id, 'ON', v.nanoId));
           return { ...p, valves: p.valves.map(v => ({ ...v, isOpen: v.enabled })) };
        });
        if (this.currentTimeout) clearTimeout(this.currentTimeout);
        this.currentTimeout = setTimeout(() => {
           this.updateData(p => {
               this.serial.sendValveCommand('ALL', 'OFF');
               return { ...p, autoState: 'DAMLA_BEKLEME', valves: p.valves.map(v => ({ ...v, isOpen: false })) };
           });
           this.processAutoState();
        }, this.data.config.fillTimeMs);
        break;
        
      case 'DAMLA_BEKLEME':
        this.transitionTo('TAHLIYE', this.data.config.dripWaitTimeMs);
        break;

      case 'TAHLIYE':
        if (this.currentTimeout) clearTimeout(this.currentTimeout);
        this.currentTimeout = setTimeout(() => {
          this.updateData(p => {
             if (p.outputCount < p.inputCount) {
                 if (!p.outputGate.isOpen) {
                    this.serial.sendGateCommand('OUTPUT', 'OPEN');
                    return { ...p, outputGate: { ...p.outputGate, isOpen: true, position: 100 } };
                 }
                 return { ...p, outputCount: p.outputCount + 1 };
             }
             this.serial.sendGateCommand('OUTPUT', 'CLOSE');
             return { ...p, autoState: 'DOGRULAMA', outputGate: { ...p.outputGate, isOpen: false, position: 0 } };
          });
          this.processAutoState();
        }, 500);
        break;
        
      case 'DOGRULAMA':
        const activeTargetCount = Math.min(this.data.config.targetCount, this.data.valves.filter(v => v.enabled).length);
        const isValid = this.data.inputCount === activeTargetCount && this.data.inputCount === this.data.outputCount;
        
        if (this.currentTimeout) clearTimeout(this.currentTimeout);
        this.currentTimeout = setTimeout(() => {
           this.updateData(p => {
              const duration = Date.now() - this.cycleStartTs;
              const recipeName = p.recipes.find(r => r.id === p.config.recipeId)?.name || 'Bilinmeyen';
              
              const passport = {
                 id: `PASS-${Date.now()}`,
                 recipeName,
                 timestamp: Date.now(),
                 duration,
                 inputCount: p.inputCount,
                 outputCount: p.outputCount,
                 validationStatus: isValid ? 'PASS' : 'FAIL',
                 operatorId: 'AUTO'
              };
              
              // Log to SQLite
              this.db.insertCycle(passport);

              const willContinue = isValid && !p.stopAfterCycleRequested;

              return {
                ...p,
                mode: isValid ? (p.stopAfterCycleRequested ? 'BEKLEMEDE' : 'OTOMATİK') : 'ARIZA', 
                autoState: 'BEKLEMEDE',
                stopAfterCycleRequested: false,
                inputCount: 0,
                outputCount: 0,
                activePrompt: willContinue ? 'BOTTLE_CHECK' : null as any,
                cycleHistory: [passport, ...p.cycleHistory].slice(0, 100) as any, // keep latest 100 in memory
              };
           });
           this.processAutoState();
        }, 1500);
        break;

      case 'YIKAMA_DONGUSU':
        const elapsed = Date.now() - this.cycleStartTs;
        if (elapsed >= this.data.config.washDurationMs) {
           this.serial.sendValveCommand('ALL', 'OFF');
           this.updateData(p => ({ 
             ...p, mode: 'BEKLEMEDE', autoState: 'BEKLEMEDE', 
             isWashingDone: true, isWashingRequired: false,
             valves: p.valves.map(v => ({ ...v, isOpen: false }))
           }));
        } else {
           // Toggle valves every washValveIntervalMs
           const shouldBeOpen = Math.floor(elapsed / this.data.config.washValveIntervalMs) % 2 === 0;
           this.updateData(p => {
              if (p.valves[0].isOpen !== shouldBeOpen) {
                 this.serial.sendValveCommand('ALL', shouldBeOpen ? 'ON' : 'OFF');
                 return { ...p, valves: p.valves.map(v => ({ ...v, isOpen: shouldBeOpen })) };
              }
              return p;
           });
           
           if (this.currentTimeout) clearTimeout(this.currentTimeout);
           this.currentTimeout = setTimeout(() => this.processAutoState(), 500);
        }
        break;
    }
  }
}

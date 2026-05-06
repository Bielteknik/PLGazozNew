import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { SystemData, SystemMode, AutoState, CyclePassport, ValveState, NanoState, SensorState, GateState, Recipe } from '../types/system';

const socket = io('http://localhost:8000', {
  transports: ['websocket'],
  autoConnect: true
});

// Initial state mimicking a factory reset / boot up state
const INITIAL_STATE: SystemData = {
  mode: 'BASLATMA',
  autoState: 'BEKLEMEDE',
  inputCount: 0,
  outputCount: 0,
  
  valves: Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    isOpen: false,
    mode: 'CONTINUOUS',
    enabled: true,
    pulseDuration: 1000,
    targetVolumeMl: 50,
    nanoId: 'NANO-2',
    pin: `D${i + 2}`
  })),
  nanos: [
    { id: 'NANO-1', name: 'NANO 1 (KAPILAR)', status: 'ONLINE', pingMs: 12, port: 'COM3', baudRate: 115200 },
    { id: 'NANO-2', name: 'NANO 2 (VALFLER)', status: 'ONLINE', pingMs: 14, port: 'COM4', baudRate: 115200 }
  ],
  sensors: [
    { id: 'SENS-IN', name: 'Giriş Lazer', enabled: true, pin: '17', device: 'RASPI', type: 'INPUT', debounceMs: 50, isTriggered: false },
    { id: 'SENS-MID', name: 'Orta Lazer (Dolum)', enabled: true, pin: '27', device: 'RASPI', type: 'INPUT', debounceMs: 50, isTriggered: false },
    { id: 'SENS-OUT', name: 'Çıkış Lazer', enabled: true, pin: '22', device: 'RASPI', type: 'OUTPUT', debounceMs: 50, isTriggered: false }
  ],
  terminalLogs: [`[${new Date().toLocaleTimeString()}] [SYS] Master terminal initialized.`],
  inputGate: { isOpen: false, position: 0, enabled: true, nanoId: 'NANO-1', pin: 'D2', dirPin: 'D3', enablePin: 'D4', stepsToOpen: 200, stepsToClose: 200, speed: 1000, acceleration: 500 },
  outputGate: { isOpen: false, position: 0, enabled: true, nanoId: 'NANO-1', pin: 'D5', dirPin: 'D6', enablePin: 'D7', stepsToOpen: 200, stepsToClose: 200, speed: 1000, acceleration: 500 },
  extraGates: [],
  
  cycleHistory: [
    { id: 'CYC-0001', timestamp: Date.now() - 3600000, recipeId: 'REC-01', duration: 42000, inputCount: 3, outputCount: 3, validationStatus: 'PASS', operatorId: 'OP-123' },
    { id: 'CYC-0002', timestamp: Date.now() - 3000000, recipeId: 'REC-01', duration: 43500, inputCount: 3, outputCount: 3, validationStatus: 'PASS', operatorId: 'OP-123' },
  ],
  activeAlerts: [
    { id: 'ALR-STARTUP', code: 'SYS_ACTIVE', severity: 'WARNING', message: 'Sistem Aktif', suggestion: 'Üretime başlamak için reçete seçin ve yıkama kontrolü yapın.', timestamp: Date.now(), resolved: false }
  ],
  config: {
    recipeId: 'REC-01',
    volumeMl: 500,
    targetCount: 3, 
    fillTimeMs: 4000, 
    settlingTimeMs: 800, 
    dripWaitTimeMs: 1200, 
    inputDebounceMs: 35, 
    outputDebounceMs: 40,
    gateSpeedPercent: 100,
    watchdogTimeoutMs: 15000,
    maxRetries: 3,
    relayInversion: false,
    autoRecovery: true,
    manualValveMaxOpenTimeMs: 5000,
    logLevel: 'INFO',
    heartbeatIntervalMs: 5000,
    enableMqtt: false,
    mqttBrokerUrl: 'mqtt://localhost:1883',
    autoCleanEnabled: false,
    autoCleanIntervalCount: 1000,
    maxTemperatureThreshold: 65,
    voltageWarningLimit: 22.5,
    emergencyStopBehavior: 'FREEZE'
  },
  recipes: [
    { id: 'REC-01', name: 'Standart Şişe (500ml)', volumeMl: 500, targetCount: 3, fillTimeMs: 4000, settlingTimeMs: 800, dripWaitTimeMs: 1200, description: 'Yarım litrelik pet şişeler için standart üretim reçetesi.' },
    { id: 'REC-02', name: 'Büyük Şişe (1.5L)', volumeMl: 1500, targetCount: 3, fillTimeMs: 8500, settlingTimeMs: 1500, dripWaitTimeMs: 2500, description: '1.5 litrelik aile boyu şişeler için yüksek volumlü dolum.' },
    { id: 'REC-03', name: 'Küçük Cam Şişe (250ml)', volumeMl: 250, targetCount: 3, fillTimeMs: 2500, settlingTimeMs: 500, dripWaitTimeMs: 800, description: 'Cam şişeler için hızlı dolum ve düşük bekleme süresi.' },
  ],
  isWashingDone: false,
  isWashingRequired: false,
  stopAfterCycleRequested: false,
  activePrompt: null,
  isEngineerMode: false,
  metrics: {
    averageBpm: 0,
    lastCycleDurationMs: 0,
    totalBottlesToday: 0,
    efficiencyPercent: 0,
    currentDistance: 0
  }
};

export function useSystemSimulator() {

  const [data, setData] = useState<SystemData>(INITIAL_STATE);

  // Fetch initial data from DB
  useEffect(() => {
    const fetchData = async () => {
       try {
          const res = await fetch('http://localhost:8000/data');
          const dbData = await res.json();
          
          setData(p => {
             const newData = {
                ...p,
                recipes: dbData.recipes.length > 0 ? dbData.recipes : p.recipes,
                config: dbData.config ? { ...p.config, ...dbData.config } : p.config,
                cycleHistory: dbData.history || []
             };
             // Sync hardware after loading DB data
             socket.emit('SYNC_HARDWARE', {
                valves: newData.valves.filter(v => v.enabled),
                gates: [newData.inputGate, newData.outputGate, ...newData.extraGates.filter(g => g.enabled)]
             });
             return newData;
          });
       } catch (err) {
          console.warn("DB Connection failed, falling back to localStorage", err);
          const saved = localStorage.getItem('plgazoz_state');
          if (saved) {
             const parsed = JSON.parse(saved);
             setData(p => ({
                ...p,
                config: parsed.config || INITIAL_STATE.config,
                recipes: parsed.recipes || INITIAL_STATE.recipes,
                cycleHistory: parsed.cycleHistory || []
             }));
          }
       }
    };
    fetchData();
  }, []);
  
  // Simulator internals
  const [cycleStartTs, setCycleStartTs] = useState<number>(0);

  // Persistence effect
  useEffect(() => {
    const toSave = {
      config: data.config,
      recipes: data.recipes,
      valves: data.valves,
      sensors: data.sensors,
      inputGate: data.inputGate,
      outputGate: data.outputGate,
      extraGates: data.extraGates,
      nanos: data.nanos,
      metrics: data.metrics
    };
    localStorage.setItem('plgazoz_state', JSON.stringify(toSave));
  }, [data.config, data.recipes, data.valves, data.sensors, data.inputGate, data.outputGate, data.extraGates, data.nanos, data.metrics]);

  // Socket.io integration
  useEffect(() => {
    const handleSensorStates = (states: Record<string, boolean>) => {
      setData(p => ({
        ...p,
        sensors: p.sensors.map(s => {
          if (states[s.pin] !== undefined) {
            return { ...s, isTriggered: states[s.pin] };
          }
          return s;
        })
      }));
    };

    const handleDistanceUpdate = (payload: { value: number }) => {
       setData(p => ({
          ...p,
          metrics: { ...p.metrics, currentDistance: payload.value }
       }));
    };


    const handleProductionUpdate = (payload: any) => {
       setData(p => ({
          ...p,
          state: payload.state, // Note: system type has autoState, let's keep consistency
          autoState: payload.state,
          inputCount: payload.inputCount,
          outputCount: payload.outputCount,
          mode: payload.mode
       }));
    };

    socket.on('SENSOR_STATES', handleSensorStates);
    socket.on('DISTANCE_UPDATE', handleDistanceUpdate);
    socket.on('PRODUCTION_UPDATE', handleProductionUpdate);
    socket.on('connect', () => console.log('Backend connected'));

    return () => {
      socket.off('SENSOR_STATES', handleSensorStates);
      socket.off('DISTANCE_UPDATE', handleDistanceUpdate);
      socket.off('PRODUCTION_UPDATE', handleProductionUpdate);
      socket.off('connect');
    };
  }, []);

  const toggleEngineerMode = useCallback(() => {
    setData(p => ({ ...p, isEngineerMode: !p.isEngineerMode }));
  }, []);

  const requestStopAfterCycle = useCallback(() => {
    setData(p => ({ ...p, stopAfterCycleRequested: true }));
  }, []);

  const updateConfig = useCallback((updates: Partial<SystemData['config']>) => {
    setData(p => {
       const newConfig = { ...p.config, ...updates };
       // Save to DB
       fetch('http://localhost:8000/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newConfig)
       }).catch(e => console.error("Config save failed", e));

       return { ...p, config: newConfig };
    });
  }, []);

  const updateRecipe = useCallback((id: string, updates: Partial<Recipe>) => {
    setData(p => {
       const newRecipes = p.recipes.map(r => r.id === id ? { ...r, ...updates } : r);
       const updatedRecipe = newRecipes.find(r => r.id === id);
       if (updatedRecipe) {
          fetch('http://localhost:8000/recipes', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(updatedRecipe)
          });
       }
       return { ...p, recipes: newRecipes };
    });
  }, []);

  const addRecipe = useCallback((recipe: Recipe) => {
    setData(p => {
       fetch('http://localhost:8000/recipes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(recipe)
       });
       return { ...p, recipes: [...p.recipes, recipe] };
    });
  }, []);

  const removeRecipe = useCallback((id: string) => {
    setData(p => {
       fetch(`http://localhost:8000/recipes/${id}`, { method: 'DELETE' });
       
       const recipeName = p.recipes.find(r => r.id === id)?.name || id;
       const newRecipes = p.recipes.filter(r => r.id !== id);
       let newConfig = p.config;
       const newLogs = [...p.terminalLogs, `[${new Date().toLocaleTimeString()}] [SYS] Reçete silindi: ${recipeName}`];
       
       if (p.config.recipeId === id && newRecipes.length > 0) {
         const fallback = newRecipes[0];
         newConfig = {
           ...p.config,
           recipeId: fallback.id,
           volumeMl: fallback.volumeMl,
           targetCount: fallback.targetCount,
           fillTimeMs: fallback.fillTimeMs,
           settlingTimeMs: fallback.settlingTimeMs,
           dripWaitTimeMs: fallback.dripWaitTimeMs
         };
         // Save updated config to DB
         fetch('http://localhost:8000/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newConfig)
         });
       }
       
       return {
         ...p,
         recipes: newRecipes,
         config: newConfig,
         terminalLogs: newLogs.slice(-100)
       };
    });
  }, []);

  const selectRecipe = useCallback((id: string) => {
    setData(p => {
      // Check if system is busy
      if (p.mode !== 'BEKLEMEDE' || p.autoState !== 'BEKLEMEDE') {
         // Prevent change and alert
         const alertId = `ALR-BUSY-${Date.now()}`;
         return {
            ...p,
            activeAlerts: [{
               id: alertId,
               code: 'ERR_BUSY',
               severity: 'WARNING',
               message: 'Sistem Meşgul',
               suggestion: 'Reçete değiştirmek için döngünün bitmesini ve sistemin Bekleme moduna geçmesini bekleyin.',
               timestamp: Date.now(),
               resolved: false
            }, ...p.activeAlerts]
         };
      }

      const recipe = p.recipes.find(r => r.id === id);
      if (!recipe) return p;
      
      const newConfig: any = {
        ...p.config,
        recipeId: recipe.id,
        volumeMl: recipe.volumeMl,
        targetCount: recipe.targetCount,
        fillTimeMs: recipe.fillTimeMs,
        settlingTimeMs: recipe.settlingTimeMs,
        dripWaitTimeMs: recipe.dripWaitTimeMs
      };

      // Save new config to DB
      fetch('http://localhost:8000/config', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(newConfig)
      });
      
      return {
        ...p,
        isWashingRequired: true, 
        isWashingDone: false,
        config: newConfig,
        activeAlerts: [{
          id: `ALR-WASH-${Date.now()}`,
          code: 'WASH_REQUIRED',
          severity: 'WARNING',
          message: 'Yıkama Zorunlu',
          suggestion: 'Reçete değişti. Üretime başlamadan önce Yıkama döngüsünü tamamlamanız gerekmektedir.',
          timestamp: Date.now(),
          resolved: false
        }, ...p.activeAlerts]
      };
    });
  }, []);

  const setMode = useCallback((mode: SystemMode) => setData(p => {
    socket.emit('SET_MODE', mode);
    // If entering washing mode, ensure gates are open
    if (mode === 'YIKAMA') {
      return {
        ...p,
        mode,
        isWashingDone: true, 
        isWashingRequired: false,
        inputGate: { ...p.inputGate, isOpen: true, position: 100 },
        outputGate: { ...p.outputGate, isOpen: true, position: 100 }
      };
    }
    return { ...p, mode };
  }), []);
  
  const acknowledgeStartup = useCallback(() => {
    setData(p => ({ ...p, mode: 'BEKLEMEDE' as SystemMode, autoState: 'BEKLEMEDE' }));
  }, []);

  const acknowledgeFault = useCallback(() => {
    setData(p => ({ ...p, mode: 'BEKLEMEDE' as SystemMode, autoState: 'BEKLEMEDE', activeAlerts: p.activeAlerts.map(a => ({...a, resolved: true})) }));
  }, []);

  const startAutoCycle = useCallback(() => {
    setData(p => {
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
      socket.emit('SET_MODE', 'OTOMATİK');
      socket.emit('START_AUTO_CYCLE');
      return { 
        ...p, 
        mode: 'OTOMATİK', 
        autoState: 'GIRIS_SAYILIYOR',
        inputCount: 0, 
        outputCount: 0,
        inputGate: { ...p.inputGate, isOpen: true, position: 100 },
        outputGate: { ...p.outputGate, isOpen: false, position: 0 }
      };
    });
  }, []);

  const answerPrompt = useCallback((answer: boolean) => {
    setData(p => {
      if (p.activePrompt === 'BOTTLE_CHECK') {
        if (!answer) {
          // No bottle in area -> Start counting in
          setCycleStartTs(Date.now());
          return {
            ...p,
            activePrompt: null,
            autoState: 'GIRIS_SAYILIYOR',
            inputGate: { ...p.inputGate, isOpen: true, position: 100 }
          };
        } else {
          // Bottle in area -> Keep gates closed, maybe trigger an alert
          return {
            ...p,
            activePrompt: null,
            mode: 'ARIZA',
            activeAlerts: [
              { id: `ALR-${Date.now()}`, code: 'ERR_BOTTLE_IN_AREA', severity: 'CRITICAL', message: 'Dolum Alanı Dolu', suggestion: 'Lütfen dolum alanındaki şişeleri tahliye edin ve üretimi tekrar başlatın.', timestamp: Date.now(), resolved: false },
              ...p.activeAlerts
            ]
          };
        }
      }
      return { ...p, activePrompt: null };
    });
  }, []);

  const toggleValve = useCallback((id: number) => {
    setData(p => {
      const valve = p.valves.find(v => v.id === id);
      if (!valve || !valve.enabled) return p;
      const newState = !valve.isOpen;
      
      // Backend'e gönder
      socket.emit('VALVE_CONTROL', { 
        port: valve.nanoId === 'NANO-2' ? 'COM4' : 'COM3', 
        id: valve.id, 
        state: newState 
      });

      if (newState) {
        if (p.mode === 'MANUEL' && p.config.manualValveMaxOpenTimeMs > 0) {
            setTimeout(() => {
                setData(current => {
                   const v = current.valves.find(v => v.id === id);
                   if (v && v.isOpen) {
                      socket.emit('VALVE_CONTROL', { port: v.nanoId === 'NANO-2' ? 'COM4' : 'COM3', id, state: false });
                      return {
                        ...current,
                        valves: current.valves.map(v => v.id === id ? { ...v, isOpen: false } : v)
                      };
                   }
                   return current;
                });
            }, p.config.manualValveMaxOpenTimeMs);
        }

        if (valve.mode === 'PULSE') {
            setTimeout(() => {
                setData(current => {
                   const v = current.valves.find(v => v.id === id);
                   if (v && v.isOpen) {
                      socket.emit('VALVE_CONTROL', { port: v.nanoId === 'NANO-2' ? 'COM4' : 'COM3', id, state: false });
                      return {
                        ...current,
                        valves: current.valves.map(v => v.id === id ? { ...v, isOpen: false } : v)
                      };
                   }
                   return current;
                });
            }, valve.pulseDuration || 1000);
        }
      }

      return {
        ...p,
        valves: p.valves.map(v => v.id === id ? { ...v, isOpen: newState } : v),
        terminalLogs: [`[${new Date().toLocaleTimeString()}] [VALVE] V${id} ${newState ? 'OPENED' : 'CLOSED'}`, ...p.terminalLogs.slice(0, 49)]
      };
    });
  }, []);

  const setValveMode = useCallback((id: number, mode: 'PULSE' | 'CONTINUOUS') => {
    setData(p => ({
      ...p,
      valves: p.valves.map(v => v.id === id ? { ...v, mode } : v)
    }));
  }, []);

  const setValvePulseDuration = useCallback((id: number, duration: number) => {
    setData(p => ({
      ...p,
      valves: p.valves.map(v => v.id === id ? { ...v, pulseDuration: duration } : v)
    }));
  }, []);

  const operateGate = useCallback((target: 'inputGate' | 'outputGate', position: number) => {
      setData(p => {
        if (!p[target].enabled) return p;
        const gate = p[target];
        
        // Backend'e gönder
        socket.emit('GATE_CONTROL', { 
           port: gate.nanoId || 'COM3', 
           id: target === 'inputGate' ? 1 : 2, 
           pos: position 
        });

        return {
          ...p,
          [target]: { ...p[target], isOpen: position > 0, position },
          terminalLogs: [`[${new Date().toLocaleTimeString()}] [GATE] ${target.toUpperCase()} POS: ${position}`, ...p.terminalLogs.slice(0, 49)]
        };
      });
  }, []);

  const toggleGateEnabled = useCallback((target: 'inputGate' | 'outputGate') => {
    setData(p => ({
      ...p,
      [target]: { ...p[target], enabled: !p[target].enabled, isOpen: p[target].enabled ? false : p[target].isOpen, position: p[target].enabled ? 0 : p[target].position }
    }));
  }, []);

  const updateNanoConfig = useCallback((id: string, config: Partial<NanoState>) => {
    setData(p => ({
      ...p,
      nanos: p.nanos.map(n => n.id === id ? { ...n, ...config } : n)
    }));
  }, []);

  const addNano = useCallback(() => {
    setData(p => {
      const idNum = p.nanos.length > 0 ? Math.max(...p.nanos.map(n => parseInt(n.id.split('-')[1]) || 0)) + 1 : 1;
      return {
        ...p,
        nanos: [...p.nanos, { id: `NANO-${idNum}`, name: `NANO ${idNum}`, status: 'OFFLINE', pingMs: 0, port: '', baudRate: 115200 }]
      };
    });
  }, []);

  const removeNano = useCallback((id: string) => {
    setData(p => ({
      ...p,
      nanos: p.nanos.filter(n => n.id !== id)
    }));
  }, []);

  const toggleSensorEnabled = useCallback((id: string) => {
    setData(p => ({
      ...p,
      sensors: p.sensors.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s)
    }));
  }, []);

  const addSensor = useCallback(() => {
    setData(p => {
      const idNum = p.sensors.length > 0 ? Math.max(...p.sensors.map(s => parseInt(s.id.split('-')[1]) || 0)) + 1 : 1;
      return {
        ...p,
        sensors: [...p.sensors, { id: `SENS-${idNum}`, name: `Yeni Sensör ${idNum}`, enabled: true, pin: `GPIO${idNum + 10}`, device: 'RASPI', type: 'INPUT' }]
      };
    });
  }, []);

  const removeSensor = useCallback((id: string) => {
    setData(p => ({
      ...p,
      sensors: p.sensors.filter(s => s.id !== id)
    }));
  }, []);

  const addGate = useCallback(() => {
    setData(p => {
      const idNum = p.extraGates.length > 0 ? Math.max(...p.extraGates.map(g => parseInt(g.id?.split('-')[1] || '0') || 0)) + 1 : 1;
      return {
        ...p,
        extraGates: [...p.extraGates, { id: `GATE-${idNum}`, name: `Ek Kilit ${idNum}`, isOpen: false, position: 0, enabled: true }]
      };
    });
  }, []);

  const removeGate = useCallback((id: string) => {
    setData(p => ({
      ...p,
      extraGates: p.extraGates.filter(g => g.id !== id)
    }));
  }, []);

  const toggleExtraGateEnabled = useCallback((id: string) => {
    setData(p => ({
      ...p,
      extraGates: p.extraGates.map(g => g.id === id ? { ...g, enabled: !g.enabled, isOpen: g.enabled ? false : g.isOpen, position: g.enabled ? 0 : g.position } : g)
    }));
  }, []);

  const operateExtraGate = useCallback((id: string, position: number) => {
    setData(p => ({
      ...p,
      extraGates: p.extraGates.map(g => 
        (g.id === id && g.enabled) ? { ...g, isOpen: position > 0, position } : g
      )
    }));
  }, []);

  const updateValve = useCallback((id: number, updates: Partial<ValveState>) => {
    setData(p => {
       const newValves = p.valves.map(v => v.id === id ? { ...v, ...updates } : v);
       const updated = newValves.find(v => v.id === id);
       if (updated) socket.emit('SYNC_HARDWARE', { valves: [updated], gates: [] });
       return { ...p, valves: newValves };
    });
  }, []);

  const updateSensor = useCallback((id: string, updates: Partial<SensorState>) => {
    setData(p => ({
      ...p,
      sensors: p.sensors.map(s => s.id === id ? { ...s, ...updates } : s)
    }));
  }, []);

  const updateGate = useCallback((id: string, updates: Partial<GateState>) => {
    setData(p => {
       const newGates = p.extraGates.map(g => g.id === id ? { ...g, ...updates } : g);
       const updated = newGates.find(g => g.id === id);
       if (updated) socket.emit('SYNC_HARDWARE', { valves: [], gates: [updated] });
       return { ...p, extraGates: newGates };
    });
  }, []);

  const updateSystemGate = useCallback((target: 'inputGate' | 'outputGate', updates: Partial<GateState>) => {
    setData(p => {
       const newGate = { ...p[target], ...updates };
       socket.emit('SYNC_HARDWARE', { valves: [], gates: [newGate] });
       return { ...p, [target]: newGate };
    });
  }, []);

  const addHardware = useCallback(() => {
    setData(p => {
      const maxId = p.valves.length > 0 ? Math.max(...p.valves.map(v => v.id)) : 0;
      return {
        ...p,
        valves: [...p.valves, { id: maxId + 1, isOpen: false, mode: 'CONTINUOUS', enabled: true, pulseDuration: 1000 }]
      };
    });
  }, []);

  const removeHardware = useCallback((id: number) => {
    setData(p => ({
      ...p,
      valves: p.valves.filter(v => v.id !== id)
    }));
  }, []);

  const toggleHardwareStatus = useCallback((id: number) => {
    setData(p => ({
      ...p,
      valves: p.valves.map(v => v.id === id ? { ...v, enabled: !v.enabled, isOpen: false } : v)
    }));
  }, []);

  const sendNanoCommand = useCallback((nanoId: string, cmd: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setData(p => {
        let response = 'ERR: BILINMEYEN KOMUT';
        const upperCmd = cmd.toUpperCase();
        
        if (upperCmd === 'CLEAR') {
          return {
            ...p,
            terminalLogs: [`[${timestamp}] [SYS] Terminal logs cleared by user.`]
          };
        }

        if (upperCmd === 'PING') response = 'ACK (Latency: 12ms)';
        else if (upperCmd === 'RESET') response = 'OK WDT_RESET_SUCCESS';
        else if (upperCmd === 'STATUS') response = `OK MODE:${p.mode} AUTO_STATE:${p.autoState} IN:${p.inputCount} OUT:${p.outputCount}`;
        else if (upperCmd === 'WHOAMI' || upperCmd === 'SYS_INFO') {
           const nano = p.nanos.find(n => n.id === nanoId);
           response = `BIEL_PLC_RT | ID:${nanoId} | NAME:${nano?.name || 'UNKNOWN'} | VER:2.1.0 | PORT:${nano?.port || 'N/A'}`;
        }
        else if (upperCmd.startsWith('VALVE_') && upperCmd.endsWith('_TEST')) {
           const vId = parseInt(upperCmd.split('_')[1]);
           if (!isNaN(vId)) response = `OK VALVE_${vId}_TEST_SIGNAL_SENT_SUCCESS`;
        }
        else if (upperCmd === 'SENS_IN_READ') {
           const sens = p.sensors.find(s => s.id === 'SENS-IN');
           response = `OK SENS_IN_LEVEL:${sens?.enabled ? 'HIGH' : 'LOW'} (V:3.31V)`;
        }
        else if (upperCmd === 'SENS_OUT_READ') {
           const sens = p.sensors.find(s => s.id === 'SENS-OUT');
           response = `OK SENS_OUT_LEVEL:${sens?.enabled ? 'HIGH' : 'LOW'} (V:3.28V)`;
        }
        else if (upperCmd === 'HELP') response = 'KOMUTLAR: PING, RESET, STATUS, WHOAMI, VALVE_[N]_TEST, SENS_IN_READ, SENS_OUT_READ, HELP, CLEAR';

        return {
            ...p,
            terminalLogs: [
              `[${timestamp}] <- ${nanoId}: ${response}`,
              `[${timestamp}] -> ${nanoId}: ${cmd}`,
              ...p.terminalLogs
            ].slice(0, 100)
        };
    });
  }, []);

  const resetCounter = useCallback((target: 'input' | 'output') => {
    setData(p => ({ ...p, [target === 'input' ? 'inputCount' : 'outputCount']: 0 }));
  }, []);

  const triggerFault = useCallback((type: 'VALVE_STUCK' | 'SENSOR_UNSTABLE' | 'COMM_LOSS' | 'TIMEOUT_SETTLE') => {
    setData(p => {
      let code = '';
      let message = '';
      let suggestion = '';
      let severity: 'WARNING' | 'CRITICAL' = 'CRITICAL';
      
      switch (type) {
        case 'VALVE_STUCK':
          code = 'ERR_VALF_SIKISIK';
          message = 'Valf 3 tam kapanamadı.';
          suggestion = 'Valf 3 sıkışmış olabilir. Manuel modda kontrol edin veya mekanik contayı inceleyin.';
          severity = 'CRITICAL';
          break;
        case 'SENSOR_UNSTABLE':
          code = 'WARN_SENSOR_GURULTUSU';
          message = 'Giriş sensörü okumaları yüksek oranda kararsız.';
          suggestion = 'Giriş sensörü gürültülü okuma yapıyor, sinyal gürültü filtresi (debounce) toleransını artırın veya merceği temizleyin.';
          severity = 'WARNING';
          break;
        case 'COMM_LOSS':
          code = 'ERR_ILETISIM_KOPTU';
          message = 'Nano 2 (Valfler) ile bağlantı kesildi.';
          suggestion = 'UART kablo bağlantılarını kontrol edin ve Yapılandırma panelinden kartı sıfırlayın.';
          severity = 'CRITICAL';
          break;
        case 'TIMEOUT_SETTLE':
          code = 'ERR_ZAMAN_ASIMI';
          message = 'Dengelenme durumu izin verilen maksimum süreyi aştı.';
          suggestion = 'Titreşim güvenli sınırların üzerinde. Reçetedeki dengelenme süresini artırın veya dış titreşim kaynaklarını ortadan kaldırın.';
          severity = 'CRITICAL';
          break;
      }
      
      const newAlert = {
         id: `ALR-${Date.now()}`,
         code,
         severity,
         message,
         suggestion,
         timestamp: Date.now(),
         resolved: false
      };
      
      const isCritical = severity === 'CRITICAL';
      
      if (isCritical) {
        socket.emit('GATE_CONTROL', { port: p.inputGate.nanoId || 'COM3', id: 1, pos: 100 });
        socket.emit('GATE_CONTROL', { port: p.outputGate.nanoId || 'COM3', id: 2, pos: 100 });
        // Valfleri kapat
        p.valves.forEach(v => {
           if (v.isOpen) socket.emit('VALVE_CONTROL', { port: v.nanoId || 'COM4', id: v.id, state: false });
        });
      }

      return { 
        ...p, 
        mode: isCritical ? 'ARIZA' : p.mode,
        autoState: isCritical ? 'BEKLEMEDE' : p.autoState,
        inputGate: isCritical ? { ...p.inputGate, isOpen: true, position: 100 } : p.inputGate,
        outputGate: isCritical ? { ...p.outputGate, isOpen: true, position: 100 } : p.outputGate,
        valves: isCritical ? p.valves.map(v => ({ ...v, isOpen: false })) : p.valves,
        activeAlerts: [newAlert, ...p.activeAlerts]
      };
    });
  }, []);

  // Washing loop simulation (Keep this for now as it's a visual effect, or we could move it to backend too)
  useEffect(() => {
    if (data.mode !== 'YIKAMA') return;

    const interval = setInterval(() => {
      setData(p => ({
        ...p,
        valves: p.valves.map(v => v.enabled ? { ...v, isOpen: !v.isOpen } : v)
      }));
    }, 500);

    return () => {
      clearInterval(interval);
      setData(p => ({
        ...p,
        valves: p.valves.map(v => ({ ...v, isOpen: false }))
      }));
    };
  }, [data.mode]);

  return {
    data,
    setMode,
    startAutoCycle,
    acknowledgeStartup,
    acknowledgeFault,
    toggleValve,
    setValveMode,
    setValvePulseDuration,
    operateGate,
    toggleGateEnabled,
    triggerFault,
    updateConfig,
    addHardware,
    removeHardware,
    toggleHardwareStatus,
    sendNanoCommand,
    updateNanoConfig,
    updateValve,
    updateSensor,
    updateGate,
    updateSystemGate,
    toggleSensorEnabled,
    addSensor,
    removeSensor,
    addGate,
    removeGate,
    toggleExtraGateEnabled,
    operateExtraGate,
    addNano,
    removeNano,
    resetCounter,
    selectRecipe,
    updateRecipe,
    addRecipe,
    removeRecipe,
    answerPrompt,
    requestStopAfterCycle,
    toggleEngineerMode,
    stopWashing: () => setMode('BEKLEMEDE')
  };
}

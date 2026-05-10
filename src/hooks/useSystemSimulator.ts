import { useState, useEffect, useCallback } from 'react';
import { SystemData, SystemMode, AutoState, CyclePassport, ValveState, NanoState, SensorState, GateState, Recipe } from '../types/system';

// Initial state mimicking a factory reset / boot up state
export const INITIAL_STATE: SystemData = {
  mode: 'BASLATMA',
  autoState: 'BEKLEMEDE',
  inputCount: 0,
  outputCount: 0,
  
  valves: Array.from({ length: 9 }, (_, i) => ({
    id: i + 1,
    isOpen: false,
    mode: 'CONTINUOUS',
    enabled: true,
    pulseDuration: 1000
  })),
  nanos: [
    { id: 'NANO-1', name: 'NANO 1 (KAPILAR)', status: 'ONLINE', pingMs: 12, port: 'COM3', baudRate: 115200 },
    { id: 'NANO-2', name: 'NANO 2 (VALFLER)', status: 'ONLINE', pingMs: 14, port: 'COM4', baudRate: 115200 }
  ],
  sensors: [
    { id: 'SENS-IN', name: 'Giriş Lazer', enabled: true, pin: 'GPIO2', device: 'RASPI', type: 'INPUT' },
    { id: 'SENS-OUT', name: 'Çıkış Lazer', enabled: true, pin: 'GPIO3', device: 'RASPI', type: 'OUTPUT' }
  ],
  terminalLogs: [`[${new Date().toLocaleTimeString()}] [SYS] Master terminal initialized.`],
  inputGate: { isOpen: false, position: 0, enabled: true },
  outputGate: { isOpen: false, position: 0, enabled: true },
  extraGates: [],
  
  cycleHistory: [
    { id: 'CYC-0001', timestamp: Date.now() - 3600000, recipeId: 'REC-01', duration: 42000, inputCount: 9, outputCount: 9, validationStatus: 'PASS', operatorId: 'OP-123' },
    { id: 'CYC-0002', timestamp: Date.now() - 3000000, recipeId: 'REC-01', duration: 43500, inputCount: 9, outputCount: 9, validationStatus: 'PASS', operatorId: 'OP-123' },
  ],
  activeAlerts: [
    { id: 'ALR-STARTUP', code: 'SYS_ACTIVE', severity: 'WARNING', message: 'Sistem Aktif', suggestion: 'Üretime başlamak için reçete seçin ve yıkama kontrolü yapın.', timestamp: Date.now(), resolved: false }
  ],
  config: {
    recipeId: 'REC-01',
    volumeMl: 40,
    targetCount: 9, 
    fillTimeMs: 1500, 
    settlingTimeMs: 800, 
    dripWaitTimeMs: 400, 
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
    emergencyStopBehavior: 'FREEZE',
    washDurationMs: 60000,
    washValveIntervalMs: 5000
  },
  recipes: [
    { id: 'REC-01', name: 'Şerbet Dolum (40ml)', volumeMl: 40, targetCount: 9, fillTimeMs: 1500, settlingTimeMs: 800, dripWaitTimeMs: 400, description: '40ml şerbet dolumu. 9 başlık, 400ms tahliye beklemesi.' },
    { id: 'REC-02', name: 'Büyük Şişe (1.5L)', volumeMl: 1500, targetCount: 9, fillTimeMs: 8500, settlingTimeMs: 1500, dripWaitTimeMs: 400, description: '1.5 litrelik aile boyu şişeler için yüksek volumlü dolum.' },
    { id: 'REC-03', name: 'Küçük Cam Şişe (250ml)', volumeMl: 250, targetCount: 9, fillTimeMs: 2500, settlingTimeMs: 500, dripWaitTimeMs: 400, description: 'Cam şişeler için hızlı dolum ve düşük bekleme süresi.' },
  ],
  isWashingDone: false,
  isWashingRequired: false,
  stopAfterCycleRequested: false,
  activePrompt: null
};

export function useSystemSimulator() {
  const [data, setData] = useState<SystemData>(INITIAL_STATE);
  
  // Simulator internals
  const [cycleStartTs, setCycleStartTs] = useState<number>(0);

  const requestStopAfterCycle = useCallback(() => {
    setData(p => ({ ...p, stopAfterCycleRequested: true }));
  }, []);

  const updateConfig = useCallback((newConfig: Partial<SystemData['config']>) => {
    setData(p => ({ ...p, config: { ...p.config, ...newConfig } }));
  }, []);

  const updateRecipe = useCallback((id: string, updates: Partial<Recipe>) => {
    setData(p => ({
      ...p,
      recipes: p.recipes.map(r => r.id === id ? { ...r, ...updates } : r)
    }));
  }, []);

  const addRecipe = useCallback((recipe: Recipe) => {
    setData(p => ({
      ...p,
      recipes: [...p.recipes, recipe]
    }));
  }, []);

  const removeRecipe = useCallback((id: string) => {
    setData(p => {
      const recipeName = p.recipes.find(r => r.id === id)?.name || id;
      const newRecipes = p.recipes.filter(r => r.id !== id);
      let newConfig = p.config;
      const newLogs = [...p.terminalLogs, `[${new Date().toLocaleTimeString()}] [SYS] Reçete silindi: ${recipeName}`];
      
      // If we're deleting the currently active recipe, switch to another one
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
      
      return {
        ...p,
        isWashingRequired: true, // Force washing after recipe change
        isWashingDone: false,
        config: {
          ...p.config,
          recipeId: recipe.id,
          volumeMl: recipe.volumeMl,
          targetCount: recipe.targetCount,
          fillTimeMs: recipe.fillTimeMs,
          settlingTimeMs: recipe.settlingTimeMs,
          dripWaitTimeMs: recipe.dripWaitTimeMs
        },
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
    // If entering washing mode, ensure gates are open
    if (mode === 'YIKAMA') {
      return {
        ...p,
        mode,
        isWashingDone: true, 
        isWashingRequired: false, // Requirement met
        inputGate: { ...p.inputGate, isOpen: true, position: 100 },
        outputGate: { ...p.outputGate, isOpen: true, position: 100 }
      };
    }
    if (mode === 'TAHLIYE') {
      return {
        ...p,
        mode,
        autoState: 'BEKLEMEDE',
        inputGate: { ...p.inputGate, isOpen: true, position: 100 },
        outputGate: { ...p.outputGate, isOpen: true, position: 100 },
        valves: p.valves.map(v => ({ ...v, isOpen: false }))
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
      return { 
        ...p, 
        mode: 'OTOMATİK', 
        autoState: 'BEKLEMEDE', // Wait for prompt
        inputCount: 0, 
        outputCount: 0,
        inputGate: { ...p.inputGate, isOpen: false, position: 0 },
        outputGate: { ...p.outputGate, isOpen: false, position: 0 },
        activePrompt: 'BOTTLE_CHECK'
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
      if (valve.isOpen) {
        // Just close it
        return {
          ...p,
          valves: p.valves.map(v => v.id === id ? { ...v, isOpen: false } : v)
        };
      } else {
        // Open it
        if (p.mode === 'MANUEL' && p.config.manualValveMaxOpenTimeMs > 0) {
           setTimeout(() => {
               setData(current => ({
                  ...current,
                  valves: current.valves.map(v => (v.id === id && v.isOpen) ? { ...v, isOpen: false } : v)
               }));
           }, p.config.manualValveMaxOpenTimeMs);
        }

        if (valve.mode === 'PULSE') {
           setTimeout(() => {
               setData(current => ({
                  ...current,
                  valves: current.valves.map(v => v.id === id ? { ...v, isOpen: false } : v)
               }));
           }, valve.pulseDuration || 1000);
        }
        return {
          ...p,
          valves: p.valves.map(v => v.id === id ? { ...v, isOpen: true } : v)
        };
      }
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
        return {
          ...p,
          [target]: { ...p[target], isOpen: position > 0, position }
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
    setData(p => ({
      ...p,
      valves: p.valves.map(v => v.id === id ? { ...v, ...updates } : v)
    }));
  }, []);

  const updateSensor = useCallback((id: string, updates: Partial<SensorState>) => {
    setData(p => ({
      ...p,
      sensors: p.sensors.map(s => s.id === id ? { ...s, ...updates } : s)
    }));
  }, []);

  const updateGate = useCallback((id: string, updates: Partial<GateState>) => {
    setData(p => ({
      ...p,
      extraGates: p.extraGates.map(g => g.id === id ? { ...g, ...updates } : g)
    }));
  }, []);

  const updateSystemGate = useCallback((target: 'inputGate' | 'outputGate', updates: Partial<GateState>) => {
    setData(p => ({
      ...p,
      [target]: { ...p[target], ...updates }
    }));
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
      
      return { 
        ...p, 
        mode: severity === 'CRITICAL' ? 'ARIZA' : p.mode,
        autoState: severity === 'CRITICAL' ? 'BEKLEMEDE' : p.autoState,
        activeAlerts: [newAlert, ...p.activeAlerts]
      };
    });
  }, []);

  // Washing loop simulation
  useEffect(() => {
    if (data.mode !== 'YIKAMA') return;

    const interval = setInterval(() => {
      setData(p => ({
        ...p,
        valves: p.valves.map(v => v.enabled ? { ...v, isOpen: !v.isOpen } : v)
      }));
    }, 500); // Pulse every 500ms

    return () => {
      clearInterval(interval);
      // Ensure valves are closed when leaving washing mode
      setData(p => ({
        ...p,
        valves: p.valves.map(v => ({ ...v, isOpen: false }))
      }));
    };
  }, [data.mode]);

  // Main simulation loop
  useEffect(() => {
    if (data.mode !== 'OTOMATİK') return;

    let timeout: NodeJS.Timeout;

    const transitionTo = (nextState: AutoState, delayMs: number) => {
      timeout = setTimeout(() => {
        setData(p => ({ ...p, autoState: nextState }));
      }, delayMs);
    };

    switch (data.autoState) {
      case 'GIRIS_SAYILIYOR':
        // Simulate lasers counting inputs
        timeout = setTimeout(() => {
          setData(p => {
             const activeTargetCount = Math.min(p.config.targetCount, p.valves.filter(v => v.enabled).length);
             if (p.inputCount < activeTargetCount) {
                 return { ...p, inputCount: p.inputCount + 1 };
             }
             // Goal reached, next state
             return { ...p, autoState: 'GIRIS_KILITLI', inputGate: { isOpen: false, position: 0 } };
          });
        }, 300); // 300ms per bottle detected
        break;
        
      case 'GIRIS_KILITLI':
        transitionTo('DENGELEME', 1000); // Ack lock in delay
        break;
        
      case 'DENGELEME':
        transitionTo('DOLUM', data.config.settlingTimeMs); // Vibration decay delay
        break;
        
      case 'DOLUM':
        // Open all enabled valves
        setData(p => ({ ...p, valves: p.valves.map(v => ({ ...v, isOpen: v.enabled })) }));
        
        timeout = setTimeout(() => {
           setData(p => ({ ...p, autoState: 'DAMLA_BEKLEME', valves: p.valves.map(v => ({ ...v, isOpen: false })) }));
        }, data.config.fillTimeMs);
        break;
        
      case 'DAMLA_BEKLEME':
        transitionTo('TAHLIYE', data.config.dripWaitTimeMs);
        break;

      case 'TAHLIYE':
        // Simulating bottles moving out one by one
        timeout = setTimeout(() => {
          setData(p => {
             if (p.outputCount < p.inputCount) {
                 if (!p.outputGate.isOpen) {
                    return { ...p, outputGate: { isOpen: true, position: 100 } };
                 }
                 return { ...p, outputCount: p.outputCount + 1 };
             }
             // All bottles out
             return { ...p, autoState: 'DOGRULAMA', outputGate: { isOpen: false, position: 0 } };
          });
        }, 500); // 500ms per bottle exiting
        break;
        
      case 'DOGRULAMA':
        // Validation rules:
        const activeTargetCount = Math.min(data.config.targetCount, data.valves.filter(v => v.enabled).length);
        const isValid = data.inputCount === activeTargetCount && data.inputCount === data.outputCount;
        
        timeout = setTimeout(() => {
           setData(p => {
              const duration = Date.now() - cycleStartTs;
              const passport: any = {
                 id: `PASS-${Date.now()}`,
                 recipeName: p.recipes.find(r => r.id === p.config.recipeId)?.name || 'Bilinmeyen',
                 timestamp: Date.now(),
                 duration,
                 inputCount: p.inputCount,
                 outputCount: p.outputCount,
                 status: isValid ? 'GEÇTİ' : 'KALDI'
              };

              const newAlerts = isValid ? p.activeAlerts : [
                {
                  id: `ALR-VAL-${Date.now()}`,
                  code: 'ERR_COUNT',
                  severity: 'WARNING',
                  message: 'Doğrulama Hatası',
                  suggestion: 'Giriş ve çıkış sayıları uyuşmuyor.',
                  timestamp: Date.now(),
                  resolved: false
                },
                ...p.activeAlerts
              ];

              const willContinue = isValid && !p.stopAfterCycleRequested;

              return {
                ...p,
                mode: isValid ? (p.stopAfterCycleRequested ? 'BEKLEMEDE' : 'OTOMATİK') : 'ARIZA', 
                autoState: 'BEKLEMEDE',
                stopAfterCycleRequested: false,
                inputCount: 0,
                outputCount: 0,
                activePrompt: willContinue ? 'BOTTLE_CHECK' : null,
                cycleHistory: [passport, ...p.cycleHistory],
                activeAlerts: newAlerts
              };
           });
        }, 1500);
        break;
    }

    return () => clearTimeout(timeout);
  }, [data.mode, data.autoState, data.inputCount, data.outputCount, data.config, data.inputGate.isOpen, data.outputGate.isOpen, cycleStartTs]);

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
    stopWashing: () => setMode('BEKLEMEDE'),
    startFlush: () => setMode('TAHLIYE'),
    stopFlush: () => setMode('BEKLEMEDE')
  };
}

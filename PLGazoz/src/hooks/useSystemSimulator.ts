import { useState, useEffect, useCallback, useRef } from 'react';
import { SystemData, SystemMode, Recipe, SystemConfig } from '../types/system';

// Initial state matching the backend seed structure
const INITIAL_STATE: SystemData = {
  mode: 'BASLATMA',
  autoState: 'BEKLEMEDE',
  inputCount: 0,
  outputCount: 0,
  valves: [],
  nanos: [
    { id: 'NANO-1', name: 'NANO 1 (VALF/DOLUM BAŞLIĞI - PI 5 serial UART)', status: 'ONLINE', pingMs: 12 },
    { id: 'NANO-2', name: 'NANO 2 (SENSÖRLER VE KİLİTLER)', status: 'ONLINE', pingMs: 14 }
  ],
  devices: [],
  sensors: [],
  terminalLogs: ['[SYS] Master terminal connecting to backend...'],
  inputGate: { isOpen: false, position: 0, enabled: true },
  outputGate: { isOpen: false, position: 0, enabled: true },
  extraGates: [],
  cycleHistory: [],
  activeAlerts: [],
  config: {
    recipeId: 'REC-SADE',
    volumeMl: 250,
    targetCount: 4,
    fillTimeMs: 2400,
    settlingTimeMs: 600,
    dripWaitTimeMs: 1000,
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
  recipes: [],
  isWashingDone: false,
  isWashingRequired: false,
  stopAfterCycleRequested: false,
  activePrompt: null,
  syrupTankVolumeLiters: 50,
  syrupTankCurrentVolumeMl: 50000,
  laserSensorDistanceMm: 15
};

export function useSystemSimulator() {
  const [data, setData] = useState<SystemData>(INITIAL_STATE);
  const wsRef = useRef<WebSocket | null>(null);
  const retryTimerRef = useRef<number | null>(null);

  // Helper to construct backend hostnames dynamically (enables tablet/HMI display over network)
  const getBackendUrl = (protocol: 'ws' | 'http') => {
    const host = window.location.hostname || 'localhost';
    const port = '8000'; // FastAPI default port
    return protocol === 'ws' 
      ? `ws://${host}:${port}/ws`
      : `http://${host}:${port}`;
  };

  // --- WEBSOCKET REALTIME TELEMETRY SYSTEM ---
  const connectWebSocket = useCallback(() => {
    const wsUrl = getBackendUrl('ws');
    console.log(`Connecting to PLGazoz backend at: ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Successfully connected to PLGazoz industrial backend WebSocket.');
      setData(prev => ({
        ...prev,
        terminalLogs: [`[${new Date().toLocaleTimeString()}] [SYS] Canlı backend bağlantısı kuruldu.`, ...prev.terminalLogs].slice(0, 60)
      }));
    };

    ws.onmessage = (event) => {
      try {
        const backendState = JSON.parse(event.data);
        
        // Map backend structures to UI state parameters
        // The backend exposes separate gates list and tank measurements
        const mappedData: SystemData = {
          ...INITIAL_STATE,
          ...backendState,
          // Extract specific gate configurations
          inputGate: backendState.gates?.find((g: any) => g.id === 'GATE-IN') || INITIAL_STATE.inputGate,
          outputGate: backendState.gates?.find((g: any) => g.id === 'GATE-OUT') || INITIAL_STATE.outputGate,
        };
        
        setData(mappedData);
      } catch (err) {
        console.error('Error parsing backend state data:', err);
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };

    ws.onclose = () => {
      console.warn('WebSocket connection lost. Retrying in 2 seconds...');
      wsRef.current = null;
      
      // Auto-retry connection loop
      if (retryTimerRef.current === null) {
        retryTimerRef.current = window.setTimeout(() => {
          retryTimerRef.current = null;
          connectWebSocket();
        }, 2000);
      }
    };
  }, []);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, [connectWebSocket]);

  // --- HTTP ACTION TRIGGERS ---

  const postAction = async (endpoint: string, payload?: any) => {
    try {
      const url = `${getBackendUrl('http')}${endpoint}`;
      const options: RequestInit = {
        method: 'POST',
      };
      
      if (payload !== undefined) {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(payload);
      }
      
      const res = await fetch(url, options);
      if (!res.ok) {
        const errDetail = await res.json();
        throw new Error(errDetail.detail || 'İşlem başarısız oldu.');
      }
      return await res.json();
    } catch (err: any) {
      console.error(`Error executing action at ${endpoint}:`, err);
      // Trigger a temporary UI notification inside the logs
      setData(prev => ({
        ...prev,
        terminalLogs: [`[${new Date().toLocaleTimeString()}] [HATA] ${err.message}`, ...prev.terminalLogs].slice(0, 60)
      }));
    }
  };

  const startAutoCycle = useCallback(() => {
    postAction('/api/start');
  }, []);

  const setMode = useCallback((mode: SystemMode) => {
    if (mode === 'ARIZA') {
      postAction('/api/stop');
    } else if (mode === 'YIKAMA') {
      postAction('/api/start_washing');
    }
  }, []);

  const acknowledgeStartup = useCallback(() => {
    postAction('/api/acknowledge_startup');
  }, []);

  const acknowledgeFault = useCallback(() => {
    postAction('/api/acknowledge_fault');
  }, []);

  const toggleValve = useCallback((id: number) => {
    postAction(`/api/manual/valves/${id}/toggle`);
  }, []);

  const operateGate = useCallback((target: 'inputGate' | 'outputGate', position: number) => {
    const gateId = target === 'inputGate' ? 'GATE-IN' : 'GATE-OUT';
    postAction(`/api/manual/gates/${gateId}/operate`, { position });
  }, []);

  const updateConfig = useCallback((newConfig: Partial<SystemConfig>) => {
    postAction('/api/settings/config', { settings: newConfig });
  }, []);

  const updateValve = useCallback((id: number, updates: Partial<any>) => {
    postAction('/api/settings/hardware/valves', {
      id: id.toString(),
      device_id: updates.device_id,
      pin: updates.pin,
      enabled: updates.enabled !== false
    });
  }, []);

  const updateSensor = useCallback((id: string, updates: Partial<any>) => {
    postAction('/api/settings/hardware/sensors', {
      id,
      device_id: updates.device_id,
      pin: updates.pin,
      enabled: updates.enabled !== false
    });
  }, []);

  const updateGate = useCallback((id: string, updates: Partial<any>) => {
    postAction('/api/settings/hardware/gates', {
      id,
      device_id: updates.device_id,
      pin: updates.pin,
      enabled: updates.enabled !== false
    });
  }, []);

  const updateSystemGate = useCallback((target: 'inputGate' | 'outputGate', updates: Partial<any>) => {
    const id = target === 'inputGate' ? 'GATE-IN' : 'GATE-OUT';
    postAction('/api/settings/hardware/gates', {
      id,
      device_id: updates.device_id,
      pin: updates.pin,
      enabled: updates.enabled !== false
    });
  }, []);

  const updateDeviceConfig = useCallback((id: string, updates: Partial<any>) => {
    postAction('/api/settings/hardware/devices', {
      id,
      port: updates.port,
      baudrate: Number(updates.baudrate || 115200),
      enabled: updates.enabled !== false
    });
  }, []);

  const resetCounter = useCallback((target: 'input' | 'output') => {
    // Resetting sets value to 0, which is an adjustment by current negative value
    const currentVal = target === 'input' ? data.inputCount : data.outputCount;
    postAction(`/api/manual/counters/${target}/adjust`, { amount: -currentVal });
  }, [data.inputCount, data.outputCount]);

  const adjustCounter = useCallback((target: 'input' | 'output', amount: number) => {
    postAction(`/api/manual/counters/${target}/adjust`, { amount });
  }, []);

  const selectRecipe = useCallback((id: string) => {
    postAction(`/api/settings/recipes/${id}/select`);
  }, []);

  const updateRecipe = useCallback((id: string, updates: Partial<Recipe>) => {
    postAction(`/api/settings/recipes/${id}`, updates);
  }, []);

  const addRecipe = useCallback((recipe: Recipe) => {
    postAction('/api/settings/recipes', recipe);
  }, []);

  const removeRecipe = useCallback((id: string) => {
    try {
      const url = `${getBackendUrl('http')}/api/settings/recipes/${id}`;
      fetch(url, { method: 'DELETE' }).then(res => {
        if (!res.ok) throw new Error('Reçete silinemedi.');
      });
    } catch (err: any) {
      console.error(err);
    }
  }, []);

  const answerPrompt = useCallback((answer: boolean) => {
    postAction('/api/answer_prompt', { answer });
  }, []);

  const requestStopAfterCycle = useCallback(() => {
    postAction('/api/stop_after_cycle');
  }, []);

  const refillSyrupTank = useCallback(() => {
    postAction('/api/refill_syrup');
  }, []);

  return {
    data,
    refillSyrupTank,
    setMode,
    startAutoCycle,
    acknowledgeStartup,
    acknowledgeFault,
    toggleValve,
    operateGate,
    updateConfig,
    updateValve,
    updateSensor,
    updateGate,
    updateSystemGate,
    updateDeviceConfig,
    resetCounter,
    adjustCounter,
    selectRecipe,
    updateRecipe,
    addRecipe,
    removeRecipe,
    answerPrompt,
    requestStopAfterCycle,
    stopWashing: () => postAction('/api/stop_washing')
  };
}

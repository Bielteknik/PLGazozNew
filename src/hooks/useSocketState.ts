/// <reference types="vite/client" />
import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { SystemData, SystemMode, AutoState, ValveState, GateState, NanoState, SensorState, SystemConfig, Recipe } from '../types/system';
import { INITIAL_STATE } from './useSystemSimulator';

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || `http://${window.location.hostname}:8000`;

export function useSocketState() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [data, setData] = useState<SystemData>(INITIAL_STATE);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    
    newSocket.on('connect', () => {
      console.log('[Socket] Connected to Backend');
      setIsConnected(true);
      newSocket.emit('GET_STATE');
    });

    newSocket.on('disconnect', () => {
      console.log('[Socket] Disconnected from Backend');
      setIsConnected(false);
    });

    newSocket.on('STATE_UPDATE', (newState: SystemData) => {
      setData(newState);
    });

    newSocket.on('AVAILABLE_PORTS', (ports: string[]) => {
      setData(prev => ({ ...prev, serialPorts: ports }));
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const emitAction = useCallback((actionType: string, payload?: any) => {
    if (socket && isConnected) {
      console.log(`[Socket] Action: ${actionType}`, payload);
      socket.emit('ACTION', { type: actionType, payload });
    }
  }, [socket, isConnected]);

  return {
    socket,
    data,
    isConnected,
    manualToken: "AUTHORIZED", // Mock token for compatibility
    manualExpires: null,
    manualLogin: () => {}, // No longer needed
    manualLogout: () => {
      emitAction('EXIT_APPLICATION');
    },
    setMode: (mode: SystemMode) => emitAction('SET_MODE', { mode }),
    startAutoCycle: () => emitAction('START_AUTO_CYCLE'),
    acknowledgeStartup: () => emitAction('ACKNOWLEDGE_STARTUP'),
    acknowledgeFault: () => emitAction('ACKNOWLEDGE_FAULT'),
    toggleValve: (id: number) => emitAction('TOGGLE_VALVE', { id }),
    setValveMode: (id: number, mode: 'MANUAL' | 'AUTO' | 'PULSE' | 'CONTINUOUS') => emitAction('SET_VALVE_MODE', { id, mode }),
    setValvePulseDuration: (id: number, duration: number) => emitAction('SET_VALVE_PULSE', { id, duration }),
    operateGate: (target: 'inputGate' | 'outputGate', position: number) => emitAction('OPERATE_GATE', { target, position }),
    toggleGateEnabled: (target: 'inputGate' | 'outputGate') => emitAction('TOGGLE_GATE_ENABLED', { target }),
    triggerFault: () => emitAction('TRIGGER_FAULT'),
    updateConfig: (config: Partial<SystemConfig>) => emitAction('UPDATE_CONFIG', { config }),
    addHardware: () => {
      const nextId = Math.max(0, ...data.valves.map(v => v.id)) + 1;
      emitAction('ADD_VALVE', { valve: { id: nextId, name: `Valf #${nextId}`, isOpen: false, mode: 'CONTINUOUS', enabled: true, pin: '0' } });
    },
    removeHardware: (id: number) => emitAction('REMOVE_VALVE', { id }),
    toggleHardwareStatus: (id: number) => emitAction('TOGGLE_HARDWARE_STATUS', { id }),
    sendNanoCommand: (nanoId: string, cmd: string) => emitAction('SEND_NANO_COMMAND', { nanoId, cmd }),
    updateNanoConfig: (id: string, config: Partial<NanoState>) => emitAction('UPDATE_NANO_CONFIG', { id, config }),
    updateValve: (id: number, updates: Partial<ValveState>) => emitAction('UPDATE_VALVE', { id, updates }),
    updateSensor: (id: string, updates: Partial<SensorState>) => emitAction('UPDATE_SENSOR', { id, updates }),
    updateGate: (id: string, updates: Partial<GateState>) => emitAction('UPDATE_GATE', { id, updates }),
    updateSystemGate: (target: 'inputGate' | 'outputGate', updates: Partial<GateState>) => emitAction('UPDATE_SYSTEM_GATE', { target, updates }),
    toggleSensorEnabled: (id: string) => emitAction('TOGGLE_SENSOR_ENABLED', { id }),
    addSensor: () => {
      const hasIn = data.sensors.some(s => s.id === 'SENS-IN');
      const sensor = !hasIn 
        ? { id: 'SENS-IN', name: 'Giriş Lazeri', type: 'INPUT', pin: '17', enabled: true, device: 'RASPI' as const }
        : { id: 'SENS-OUT', name: 'Çıkış Lazeri', type: 'OUTPUT', pin: '27', enabled: true, device: 'RASPI' as const };
      emitAction('ADD_SENSOR', { sensor });
    },
    removeSensor: (id: string) => emitAction('REMOVE_SENSOR', { id }),
    addGate: () => emitAction('ADD_GATE', { gate: { id: `GATE-${Date.now()}`, name: 'Yeni Kilit', pin: '0', isOpen: false, enabled: true, position: 0 } }),
    removeGate: (id: string) => emitAction('REMOVE_GATE', { id }),
    toggleExtraGateEnabled: (id: string) => emitAction('TOGGLE_GATE_ENABLED', { id }),
    operateExtraGate: (id: string) => emitAction('OPERATE_EXTRA_GATE', { id }),
    addNano: () => emitAction('ADD_HARDWARE', { nano: { id: `NANO-${Date.now()}`, name: 'Yeni Nano', port: '/dev/ttyUSB0', status: 'OFFLINE', pingMs: 0, baudRate: 9600 } }),
    removeNano: (id: string) => emitAction('REMOVE_HARDWARE', { id }),
    resetCounter: (target: 'input' | 'output', op: 'inc' | 'dec' | 'reset' = 'reset') => emitAction('MANAGE_COUNTER', { target, op }),
    testValvePulse: (id: number, duration: number) => emitAction('TEST_VALVE_PULSE', { id, duration }),
    selectRecipe: (id: string) => emitAction('SELECT_RECIPE', { id }),
    updateRecipe: (id: string, updates: Partial<Recipe>) => emitAction('UPDATE_RECIPE', { id, updates }),
    addRecipe: (recipe: Recipe) => emitAction('ADD_RECIPE', { recipe }),
    removeRecipe: (id: string) => emitAction('REMOVE_RECIPE', { id }),
    answerPrompt: (answer: boolean) => emitAction('ANSWER_PROMPT', { answer }),
    requestStopAfterCycle: () => emitAction('REQUEST_STOP_AFTER_CYCLE'),
    stopWashing: () => emitAction('SET_MODE', { mode: 'BEKLEMEDE' }),
    startFlush: () => emitAction('SET_MODE', { mode: 'TAHLIYE' }),
    stopFlush: () => emitAction('SET_MODE', { mode: 'BEKLEMEDE' })
  };
}

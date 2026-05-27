export type SystemMode = 'BASLATMA' | 'BEKLEMEDE' | 'OTOMATİK' | 'MANUEL' | 'YIKAMA' | 'ARIZA';

export type AutoState = 
  | 'BEKLEMEDE'
  | 'GIRIS_SAYILIYOR' 
  | 'GIRIS_KILITLI' 
  | 'DENGELEME' 
  | 'DOLUM' 
  | 'DAMLA_BEKLEME' 
  | 'TAHLIYE' 
  | 'DOGRULAMA'
  | 'YIKAMA_DONGUSU';

export interface ValveState {
  id: number;
  isOpen: boolean;
  mode: 'PULSE' | 'CONTINUOUS';
  enabled: boolean;
  pulseDuration?: number; // in ms
  nanoId?: string;
  pin?: string;
  relayType?: 'NO' | 'NC';
  signalType?: 'DIGITAL' | 'PWM';
  speed?: number; // 0-100% or PWM val
}

export interface GateState {
  id?: string;
  name?: string;
  isOpen: boolean;
  position: number; // 0-100%
  enabled: boolean;
  nanoId?: string;
  pin?: string;
  mode?: 'PULSE' | 'CONTINUOUS';
  pulseDuration?: number; // in ms
  relayType?: 'NO' | 'NC';
  signalType?: 'DIGITAL' | 'PWM';
  speed?: number;
}

export interface NanoState {
  id: string;
  name: string;
  status: 'ONLINE' | 'OFFLINE' | 'ERROR';
  pingMs: number;
  port?: string;
  baudRate?: number;
}

export interface DeviceState {
  id: string;
  name: string;
  connection_type: 'UART' | 'USB' | 'INTERNAL';
  port: string | null;
  baudrate: number | null;
  enabled: boolean;
}

export interface SensorState {
  id: string;
  name: string;
  enabled: boolean;
  pin: string;
  device?: 'RASPI' | 'NANO';
  connectionId?: string; // Nano ID if device is NANO
  type?: 'INPUT' | 'OUTPUT';
  resistorType?: 'PULLUP' | 'PULLDOWN' | 'NONE';
  debounceMs?: number;
}

export interface CyclePassport {
  id: string;
  timestamp: number;
  recipeId: string;
  duration: number;
  inputCount: number;
  outputCount: number;
  validationStatus: 'PASS' | 'FAIL';
  operatorId: string;
  faults?: string[];
}

export interface SystemAlert {
  id: string;
  code: string;
  severity: 'WARNING' | 'CRITICAL';
  message: string;
  suggestion: string;
  timestamp: number;
  resolved: boolean;
}

export interface SystemConfig {
  recipeId: string;
  volumeMl: number;
  targetCount: number;
  fillTimeMs: number;
  settlingTimeMs: number;
  dripWaitTimeMs: number;
  inputDebounceMs: number;
  outputDebounceMs: number;
  gateSpeedPercent: number;
  watchdogTimeoutMs: number;
  maxRetries: number;
  relayInversion: boolean;
  autoRecovery: boolean;
  manualValveMaxOpenTimeMs: number;
  
  // Advanced Configuration
  logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  heartbeatIntervalMs: number;
  enableMqtt: boolean;
  mqttBrokerUrl: string;
  autoCleanEnabled: boolean;
  autoCleanIntervalCount: number;
  maxTemperatureThreshold: number;
  voltageWarningLimit: number;
  emergencyStopBehavior: 'FREEZE' | 'RELEASE_PRESSURE' | 'SAFE_HOME';
}

export interface Recipe {
  id: string;
  name: string;
  volumeMl: number;
  targetCount: number;
  fillTimeMs: number;
  settlingTimeMs: number;
  dripWaitTimeMs: number;
  description: string;
  activeValves?: number[];
  valveDurations?: Record<number, number>;
  // Gazoz/Soda production enriched variables
  co2PressureBar?: number;
  syrupRatioPercent?: number;
  targetTempCelsius?: number;
  beverageType?: 'Sade' | 'Meyveli' | 'Aromatik' | 'Karışık';
  carbonationLevel?: 'DÜŞÜK' | 'ORTA' | 'YÜKSEK';
  cappingTorqueNm?: number;
}

export interface SystemData {
  mode: SystemMode;
  autoState: AutoState;
  
  // Realtime hardware data
  inputCount: number;
  outputCount: number;
  
  valves: ValveState[];
  nanos: NanoState[];
  devices: DeviceState[];
  sensors: SensorState[];
  terminalLogs: string[];
  inputGate: GateState;
  outputGate: GateState;
  extraGates: GateState[];
  
  // Passports
  cycleHistory: CyclePassport[];
  
  // Alerts
  activeAlerts: SystemAlert[];

  // Config
  config: SystemConfig;

  // Production Workflow Data
  recipes: Recipe[];
  isWashingDone: boolean;
  isWashingRequired: boolean;
  stopAfterCycleRequested: boolean;
  activePrompt: 'BOTTLE_CHECK' | null;

  // 50L Syrup Tank & Laser Level Sensor
  syrupTankVolumeLiters: number;
  syrupTankCurrentVolumeMl: number;
  laserSensorDistanceMm: number;
}

import React from 'react';
import { 
  Shield, 
  Unlock, 
  ArrowDown, 
  ArrowUp, 
  AlertCircle, 
  Cpu, 
  Droplet, 
  Lock, 
  Target, 
  RefreshCw, 
  Timer, 
  Power 
} from 'lucide-react';
import { SystemData, SystemMode, ValveState, GateState, NanoState, SensorState, SystemConfig, Recipe } from '../../types/system';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface ManualControlProps {
  data: SystemData;
  setMode: (mode: SystemMode) => void;
  toggleValve: (id: number) => void;
  operateGate: (target: 'inputGate' | 'outputGate', position: number) => void;
  setValveMode: (id: number, mode: 'MANUAL' | 'AUTO') => void;
  setValvePulseDuration: (id: number, duration: number) => void;
  toggleGateEnabled: (target: 'inputGate' | 'outputGate') => void;
  onResetCounter: (type: 'input' | 'output') => void;
  manualLogin: (password: string) => void;
  manualToken: string | null;
  manualExpires: number | null;
}

export function ManualControl({ 
  data, 
  setMode, 
  toggleValve, 
  operateGate, 
  setValveMode, 
  setValvePulseDuration, 
  toggleGateEnabled, 
  onResetCounter,
  manualLogin,
  manualToken,
  manualExpires
}: ManualControlProps) {
  const [password, setPassword] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'ESKI' | 'YENI'>('YENI');
  
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    manualLogin(password);
    setPassword('');
  };

  const isManual = data.mode === 'MANUEL';
  const timeLeft = manualExpires ? Math.max(0, Math.floor((manualExpires - Date.now()) / 1000 / 60)) : 0;

  const renderOldVersion = () => {
    const rawMetrics = {
      timestamp: new Date().toISOString(),
      machine_id: "BIEL-RT-01",
      active_valves: data.valves.filter(v => v.isOpen).length,
      sensors: data.sensors.reduce((acc, s) => ({ ...acc, [s.id]: s.enabled ? 1 : 0 }), {}),
      counters: { in: data.inputCount, out: data.outputCount },
      config: data.config
    };

    return (
      <div className="flex-1 space-y-4 overflow-hidden flex flex-col pb-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
          {[
            { label: 'SİSTEM DURUMU', value: data.mode, color: data.mode === 'MANUEL' ? 'text-orange-500' : 'text-emerald-500' },
            { label: 'GİRİŞ ADET', value: data.inputCount, color: 'text-blue-400' },
            { label: 'ÇIKIŞ ADET', value: data.outputCount, color: 'text-emerald-400' },
            { label: 'VERIM (%)', value: data.inputCount > 0 ? Math.round((data.outputCount / data.inputCount) * 100) : 100, color: 'text-purple-400' },
          ].map((stat, i) => (
            <div key={i} className="bg-[#151921] border border-[#2D333F] p-3 rounded flex flex-col items-center justify-center">
              <span className="text-[8px] font-bold text-gray-500 tracking-[0.2em]">{stat.label}</span>
              <span className={cn("text-lg font-black font-mono mt-1", stat.color)}>{stat.value}</span>
            </div>
          ))}
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 min-h-0">
          <div className="md:col-span-2 bg-[#151921] border border-[#2D333F] rounded flex flex-col overflow-hidden">
            <div className="p-2 bg-[#1C2029] border-b border-[#2D333F] flex justify-between items-center">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center">
                 <Cpu size={12} className="mr-2" /> Donanım Status Terminal (I/O)
              </h3>
              <div className="flex gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[8px] font-mono text-emerald-500 font-bold">LINK_ACTIVE</span>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-6">
              <div className="space-y-3">
                <div className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mb-2 border-b border-gray-800 pb-1">DOLUM VALFLERİ (V-BUS)</div>
                <div className="grid grid-cols-2 gap-3">
                  {data.valves.map(valve => (
                    <div key={valve.id} className="flex items-center justify-between p-2 bg-[#0D1016] border border-[#1F2937] rounded">
                      <div className="flex items-center gap-3">
                         <div className={cn("w-2 h-2 rounded-full", valve.isOpen ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "bg-gray-800")} />
                         <span className="text-xs font-mono text-gray-400">VALVE_0{valve.id}</span>
                      </div>
                      <button 
                        onClick={() => toggleValve(valve.id)}
                        className={cn(
                          "px-4 py-1 rounded text-[9px] font-bold transition-all border uppercase",
                          valve.isOpen ? "bg-blue-600 border-blue-500 text-white" : "bg-gray-800 border-gray-700 text-gray-500"
                        )}
                      >
                        {valve.isOpen ? 'FORCE_OFF' : 'FORCE_ON'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mb-2 border-b border-gray-800 pb-1">PNÖMATİK BARİYERLER (P-BUS)</div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: 'inputGate', label: 'BARRIER_IN_CMD', state: data.inputGate.isOpen },
                    { id: 'outputGate', label: 'BARRIER_OUT_CMD', state: data.outputGate.isOpen }
                  ].map(gate => (
                    <div key={gate.id} className="p-3 bg-[#0D1016] border border-[#1F2937] rounded flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className={cn("w-2 h-2 rounded-full", gate.state ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]")} />
                          <span className="text-xs font-mono text-gray-400">{gate.label}</span>
                       </div>
                       <div className="flex gap-1">
                          <button onClick={() => operateGate(gate.id as any, 100)} className={cn("px-2 py-1 rounded text-[8px] font-bold border", gate.state ? "bg-emerald-600 border-emerald-500 text-white" : "bg-gray-800 border-gray-700 text-gray-500")}>OPEN</button>
                          <button onClick={() => operateGate(gate.id as any, 0)} className={cn("px-2 py-1 rounded text-[8px] font-bold border", !gate.state ? "bg-red-600 border-red-500 text-white" : "bg-gray-800 border-gray-700 text-gray-500")}>CLOSE</button>
                       </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex-1 bg-[#0D1016] border border-[#2D333F] rounded flex flex-col overflow-hidden">
               <div className="p-2 bg-[#1C2029] border-b border-[#2D333F] flex items-center">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest underline decoration-orange-500 underline-offset-4">Ham Veri İzleme (RAW_TELEMETRY)</span>
               </div>
               <div className="flex-1 p-3 overflow-auto custom-scrollbar">
                  <pre className="text-[9px] font-mono text-blue-400 leading-relaxed">
                    {JSON.stringify(rawMetrics, null, 2)}
                  </pre>
               </div>
            </div>

            <div className="h-1/3 bg-[#0D1016] border border-[#2D333F] rounded flex flex-col overflow-hidden">
               <div className="p-2 bg-[#1C2029] border-b border-[#2D333F] flex items-center">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sistem Olay Günlüğü</span>
               </div>
               <div className="flex-1 p-2 overflow-y-auto space-y-1 font-mono custom-scrollbar">
                  <div className="text-[8px] text-emerald-500">[OK] Başlatma dizisi tamamlandı</div>
                  <div className="text-[8px] text-gray-500">[{new Date().toLocaleTimeString()}] Manuel mod erişimi sağlandı</div>
                  <div className="text-[8px] text-blue-500">[{new Date().toLocaleTimeString()}] Broker bağlantısı stabil</div>
                  <div className="text-[8px] text-orange-500">[{new Date().toLocaleTimeString()}] Güvenlik protokolleri aktif</div>
               </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-[#151921] border border-[#374151] p-3 rounded shrink-0 shadow-lg gap-4 md:gap-0">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded border",
            isManual ? "bg-orange-500/10 border-orange-500/20 text-orange-500" : "bg-gray-800 border-gray-700 text-gray-500"
          )}>
            <Unlock size={20} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight leading-none uppercase">
              MANUEL KONTROL MERKEZİ
            </h2>
            <p className="text-[10px] text-gray-500 mt-1 font-medium">
              Saha Donanımı Doğrudan Erişim Terminali
            </p>
          </div>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={() => setMode('OTOMATİK')}
            disabled={!isManual}
            className={cn(
              "flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded font-bold text-[10px] transition-all border active:scale-95",
              !isManual 
                 ? "bg-gray-800/10 text-gray-700 border-gray-800 cursor-not-allowed opacity-50" 
                 : "bg-[#052e16] text-[#4ade80] border-emerald-500/30 hover:bg-[#14532d]"
            )}
          >
            <RefreshCw size={14} />
            OTOMATİK
          </button>
          <button
            onClick={() => setMode('MANUEL')}
            disabled={isManual}
            className={cn(
              "flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded font-bold text-[10px] transition-all border active:scale-95",
              isManual 
                 ? "bg-orange-600 text-white border-orange-500 shadow-lg shadow-orange-900/20" 
                 : "bg-[#381a03] text-orange-400 border-orange-500/20 hover:bg-[#7c2d12]"
            )}
          >
            <Power size={14} />
            MANUEL
          </button>
        </div>
      </div>

      <div className="flex space-x-2 border-b border-[#2D333F] shrink-0">
        <button 
          onClick={() => setActiveTab('ESKI')}
          className={cn(
            "px-4 py-2 text-[10px] font-bold transition-all border-b-2 uppercase tracking-widest",
            activeTab === 'ESKI' ? "border-orange-500 text-orange-400 bg-orange-500/5" : "border-transparent text-gray-500 hover:text-gray-300"
          )}
        >
          Klasik (Eski)
        </button>
        <button 
          onClick={() => setActiveTab('YENI')}
          className={cn(
            "px-4 py-2 text-[10px] font-bold transition-all border-b-2 uppercase tracking-widest",
            activeTab === 'YENI' ? "border-orange-500 text-orange-400 bg-orange-500/5" : "border-transparent text-gray-500 hover:text-gray-300"
          )}
        >
          Modern (Yeni)
        </button>
      </div>

      {!isManual ? (
        <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-[#2D333F] rounded bg-[#0D1016]">
          <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mb-4 border border-gray-800">
             <Shield size={32} className="text-gray-600" />
          </div>
          <h3 className="text-lg text-gray-400 font-bold tracking-tight">Erişim Yetkisi Gerekiyor</h3>
          <p className="text-xs text-gray-500 max-w-sm text-center mt-2 leading-relaxed font-medium px-4">
             Manuel kontrolleri kullanmak için sistem modunu <span className="text-orange-500 font-bold uppercase">Manuel</span> olarak değiştirmeniz gerekmektedir.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto lg:overflow-hidden">
          {activeTab === 'ESKI' ? renderOldVersion() : (
            <div className="h-full grid grid-cols-12 gap-4 min-h-0 overflow-y-auto lg:overflow-hidden">
              <div className="col-span-12 lg:col-span-9 bg-[#151921] border border-[#2D333F] rounded p-4 flex flex-col relative overflow-hidden shadow-inner min-h-[500px]">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[10px] font-bold text-gray-400 border-l-2 border-[#F97316] pl-2 flex items-center tracking-widest uppercase">
                    <Cpu size={12} className="mr-2"/> Manuel Görsel Akış Kontrolü
                  </h2>
                  <div className="px-3 py-1 bg-orange-500/10 rounded border border-orange-500/20 text-[9px] font-bold text-orange-400">
                    CANLI MÜDAHALE AKTİF
                  </div>
                </div>
                
                <div className="flex-1 flex flex-col justify-center items-center relative w-full pt-8">
                  {/* Visual UI Elements */}
                    <div className="flex-1 flex items-center justify-between gap-12 max-w-5xl mx-auto">
                       {/* Input Gate */}
                       <div className="flex flex-col items-center gap-3">
                          <span className="text-[10px] font-bold text-gray-500 uppercase">GİRİŞ KİLİDİ</span>
                          <button 
                            onClick={() => operateGate('inputGate', data.inputGate.isOpen ? 0 : 100)}
                            className={cn(
                              "w-16 h-16 rounded border-4 flex items-center justify-center transition-all",
                              data.inputGate.isOpen ? "bg-emerald-600 border-emerald-400 shadow-lg shadow-emerald-500/50" : "bg-gray-800 border-gray-700"
                            )}
                          >
                             <Lock size={24} className={data.inputGate.isOpen ? "text-white" : "text-gray-600"} />
                          </button>
                          <div className="flex items-center gap-2">
                             <div className={cn("w-3 h-3 rounded-full", data.sensors.find(s=>s.id==='SENS-IN')?.enabled ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-red-500")} />
                             <span className="text-[9px] font-mono text-gray-400">LAZER 1</span>
                          </div>
                       </div>

                       {/* Valves Group */}
                       <div className="flex items-center gap-4 py-4 px-8 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                          {data.valves.map(v => (
                            <div key={v.id} className="flex flex-col items-center gap-2">
                               <button 
                                 onClick={() => toggleValve(v.id)}
                                 className={cn(
                                   "w-12 h-12 rounded-full border-4 flex items-center justify-center transition-all",
                                   v.isOpen ? "bg-blue-600 border-blue-400 shadow-lg shadow-blue-500/50" : "bg-gray-800 border-gray-700"
                                 )}
                               >
                                  <Droplet size={20} className={v.isOpen ? "text-white" : "text-gray-600"} />
                               </button>
                               <span className="text-[8px] font-bold text-gray-500">VALF {v.id}</span>
                            </div>
                          ))}
                       </div>

                       {/* Output Gate */}
                       <div className="flex flex-col items-center gap-3">
                          <span className="text-[10px] font-bold text-gray-500 uppercase">ÇIKIŞ KİLİDİ</span>
                          <button 
                            onClick={() => operateGate('outputGate', data.outputGate.isOpen ? 0 : 100)}
                            className={cn(
                              "w-16 h-16 rounded border-4 flex items-center justify-center transition-all",
                              data.outputGate.isOpen ? "bg-emerald-600 border-emerald-400 shadow-lg shadow-emerald-500/50" : "bg-gray-800 border-gray-700"
                            )}
                          >
                             <Lock size={24} className={data.outputGate.isOpen ? "text-white" : "text-gray-600"} />
                          </button>
                          <div className="flex items-center gap-2">
                             <div className={cn("w-3 h-3 rounded-full", data.sensors.find(s=>s.id==='SENS-OUT')?.enabled ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-red-500")} />
                             <span className="text-[9px] font-mono text-gray-400">LAZER 2</span>
                          </div>
                       </div>
                    </div>
                </div>
              </div>
              
              <div className="col-span-12 lg:col-span-3 flex flex-col gap-4">
                 <div className="bg-[#151921] border border-[#2D333F] rounded p-4 flex flex-col gap-4">
                    <div className="flex justify-between items-center p-2 bg-[#0D1016] rounded border border-gray-800">
                       <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-gray-500 uppercase leading-none">Giriş Adet</span>
                          <button 
                            onClick={() => onResetCounter('input')}
                            className="text-[8px] text-orange-500/50 hover:text-orange-500 font-bold mt-1 text-left transition-colors"
                          >
                            SIFIRLA
                          </button>
                       </div>
                       <span className="text-xl font-mono text-orange-500 font-black">{data.inputCount}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-[#0D1016] rounded border border-gray-800">
                       <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-gray-500 uppercase leading-none">Çıkış Adet</span>
                          <button 
                            onClick={() => onResetCounter('output')}
                            className="text-[8px] text-emerald-500/50 hover:text-emerald-500 font-bold mt-1 text-left transition-colors"
                          >
                            SIFIRLA
                          </button>
                       </div>
                       <span className="text-xl font-mono text-emerald-500 font-black">{data.outputCount}</span>
                    </div>
                 </div>
                 <div className="flex-1 bg-orange-950/10 border border-orange-500/10 rounded p-4 flex flex-col">
                    <div className="flex items-center gap-2 mb-4">
                       <AlertCircle size={16} className="text-orange-500" />
                       <h3 className="text-[10px] font-bold text-gray-300 uppercase">Güvenlik</h3>
                    </div>
                    <p className="text-[10px] text-orange-400/80 italic leading-relaxed">
                       Manuel modda donanım limitleri denetlenmez. Tüm operasyonlardan operatör sorumludur.
                    </p>
                 </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

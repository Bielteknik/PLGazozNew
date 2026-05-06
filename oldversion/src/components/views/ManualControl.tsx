import React from 'react';
import { SystemData } from '../../types/system';
import { Shield, Unlock, ArrowDown, ArrowUp, AlertCircle, Cpu, Droplet, Lock, Target, RefreshCw, Infinity, Timer, Power } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

interface ManualControlProps {
  data: SystemData;
  setMode: (mode: 'OTOMATİK' | 'MANUEL') => void;
  toggleValve: (id: number) => void;
  operateGate: (target: 'inputGate' | 'outputGate', position: number) => void;
  setValveMode: (id: number, mode: 'PULSE' | 'CONTINUOUS') => void;
  setValvePulseDuration: (id: number, duration: number) => void;
  toggleGateEnabled: (target: 'inputGate' | 'outputGate') => void;
  onResetCounter: (target: 'input' | 'output') => void;
}

export function ManualControl({ 
  data, 
  setMode, 
  toggleValve, 
  operateGate, 
  setValveMode, 
  setValvePulseDuration, 
  toggleGateEnabled, 
  onResetCounter 
}: ManualControlProps) {
  const [activeTab, setActiveTab] = React.useState<'ESKI' | 'YENI'>('YENI');
  const isManual = data.mode === 'MANUEL';

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
        {/* Top Stats Strip */}
        <div className="grid grid-cols-4 gap-4 shrink-0">
          {[
            { label: 'SİSTEM DURUMU', value: data.mode, color: data.mode === 'MANUEL' ? 'text-orange-500' : 'text-emerald-500' },
            { label: 'GİRİŞ ADET', value: data.inputCount, color: 'text-blue-400' },
            { label: 'ÇIKIŞ ADET', value: data.outputCount, color: 'text-emerald-400' },
            { label: 'VERKIM (%)', value: data.inputCount > 0 ? Math.round((data.outputCount / data.inputCount) * 100) : 100, color: 'text-purple-400' },
          ].map((stat, i) => (
            <div key={i} className="bg-[#151921] border border-[#2D333F] p-3 rounded flex flex-col items-center justify-center">
              <span className="text-[8px] font-bold text-gray-500 tracking-[0.2em]">{stat.label}</span>
              <span className={cn("text-lg font-black font-mono mt-1", stat.color)}>{stat.value}</span>
            </div>
          ))}
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 min-h-0">
          {/* Hardware Status Terminal */}
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
              {/* Valve Matrix */}
              <div className="space-y-3">
                <div className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mb-2 border-b border-gray-800 pb-1">DOLUM VALFLERİ (V-BUS)</div>
                <div className="grid grid-cols-2 gap-3">
                  {data.valves.map(valve => (
                    <div key={valve.id} className="flex items-center justify-between p-2 bg-[#0D1016] border border-[#1F2937] rounded">
                      <div className="flex items-center gap-3">
                         <div className={cn("w-2 h-2 rounded-full", valve.isOpen ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "bg-gray-800")} />
                         <span className="text-xs font-mono text-gray-400">OUT_GATE_0{valve.id}</span>
                      </div>
                      <button 
                        onClick={() => toggleValve(valve.id)}
                        className={cn(
                          "px-4 py-1 rounded text-[9px] font-bold transition-all border uppercase",
                          valve.isOpen ? "bg-blue-600 border-blue-500 text-white" : "bg-gray-800 border-gray-700 text-gray-500"
                        )}
                      >
                        {valve.isOpen ? 'FORCE_ON' : 'RELEASE'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gate Controls */}
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

          {/* Raw Monitoring Column */}
          <div className="flex flex-col gap-4">
            {/* Raw JSON View */}
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

            {/* Olay Günlüğü */}
            <div className="h-1/3 bg-[#0D1016] border border-[#2D333F] rounded flex flex-col overflow-hidden">
               <div className="p-2 bg-[#1C2029] border-b border-[#2D333F] flex items-center">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sistem Olay Günlüğü</span>
               </div>
               <div className="flex-1 p-2 overflow-y-auto space-y-1 font-mono custom-scrollbar">
                  <div className="text-[8px] text-emerald-500">[OK] Başlatma dizisi tamamlandı</div>
                  <div className="text-[8px] text-gray-500">[{new Date().toLocaleTimeString()}] Manuel mod erişimi sağlandı</div>
                  <div className="text-[8px] text-blue-500">[{new Date().toLocaleTimeString()}] Broker bağlantısı stabil</div>
                  <div className="text-[8px] text-orange-500">[{new Date().toLocaleTimeString()}] Güvenlik protokolleri atlanıyor</div>
                  <div className="text-[8px] text-gray-600 italic">...dinleniyor...</div>
               </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      
      {/* Header with Mode Toggle */}
      <div className="flex items-center justify-between bg-[#151921] border border-[#374151] p-3 rounded shrink-0 shadow-lg">
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
        
        <div className="flex gap-2">
          <button
            onClick={() => setMode('OTOMATİK')}
            disabled={!isManual}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded font-bold text-[10px] transition-all border active:scale-95",
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
              "flex items-center gap-2 px-4 py-2 rounded font-bold text-[10px] transition-all border active:scale-95",
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

      {/* Tabs */}
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
        <div className="flex-1 overflow-hidden">
          {activeTab === 'ESKI' ? renderOldVersion() : (
            <div className="h-full grid grid-cols-12 gap-4 min-h-0">
          
          {/* Left Column: Interactive Visualization */}
          <div className="col-span-9 bg-[#151921] border border-[#2D333F] rounded p-4 flex flex-col relative overflow-hidden shadow-inner">
             <div className="flex items-center justify-between mb-4">
                <h2 className="text-[10px] font-bold text-gray-400 border-l-2 border-[#F97316] pl-2 flex items-center tracking-widest uppercase">
                   <Cpu size={12} className="mr-2"/> Manuel Görsel Akış Kontrolü
                </h2>
                <div className="px-3 py-1 bg-orange-500/10 rounded border border-orange-500/20 text-[9px] font-bold text-orange-400">
                   CANLI MÜDAHALE AKTİF
                </div>
             </div>
             
             <div className="flex-1 flex flex-col justify-center items-center relative w-full pt-8">
                
                {/* Target / Progress Line */}
                <div className="absolute top-4 w-full flex justify-between px-8 z-30">
                   <div 
                      onClick={() => onResetCounter('input')}
                      className="bg-[#0D1016] p-3 rounded border border-[#1F2937] text-center w-28 relative flex flex-col items-center cursor-pointer hover:bg-[#1C2029] transition-colors group"
                   >
                      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 flex flex-col items-center">
                         <div className={cn("w-8 h-1.5 rounded-full", data.sensors.find(s=>s.id=='SENS-IN')?.enabled ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]")} />
                      </div>
                      <div className="text-[9px] text-gray-500 mb-1 font-bold tracking-widest group-hover:text-gray-300 transition-colors">GİRİŞ SENSÖR</div>
                      <div className="text-2xl font-mono text-white leading-none">{data.inputCount}</div>
                   </div>
                   
                   <div className="bg-[#1e1b4b] p-3 rounded border border-[#312e81] text-center w-28 shadow-lg">
                      <div className="text-[9px] text-blue-400 mb-1 font-bold tracking-widest uppercase">Hedef Adet</div>
                      <div className="text-2xl font-mono text-blue-300 leading-none">{data.config.targetCount}</div>
                   </div>

                   <div 
                      onClick={() => onResetCounter('output')}
                      className="bg-[#0D1016] p-3 rounded border border-[#1F2937] text-center w-28 relative flex flex-col items-center cursor-pointer hover:bg-[#1C2029] transition-colors group"
                   >
                      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 flex flex-col items-center">
                         <div className={cn("w-8 h-1.5 rounded-full", data.sensors.find(s=>s.id=='SENS-OUT')?.enabled ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]")} />
                      </div>
                      <div className="text-[9px] text-gray-500 mb-1 font-bold tracking-widest group-hover:text-gray-300 transition-colors">ÇIKIŞ SENSÖR</div>
                      <div className="text-2xl font-mono text-white leading-none">{data.outputCount}</div>
                   </div>
                </div>

                {/* Conveyor graphic */}
                <div className="w-full h-56 border-y-4 border-[#374151] bg-[#0D1016]/50 flex items-center justify-between px-20 relative mt-12 mb-12">
                   
                   {/* Interactive Input Gate */}
                   <div className="absolute left-10 -bottom-20 flex flex-col items-center z-20">
                      <button 
                        onClick={() => operateGate('inputGate', data.inputGate.isOpen ? 0 : 100)}
                        className="h-48 w-8 flex items-end overflow-hidden group cursor-pointer"
                      >
                         <motion.div 
                           initial={false}
                           animate={{ y: data.inputGate.isOpen ? '100%' : '0%' }}
                           transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                           className={cn(
                             "w-full h-36 rounded-t-md transition-all border-x-4 border-t-4", 
                             data.inputGate.isOpen 
                               ? "bg-emerald-500/20 border-emerald-500/30 group-hover:bg-emerald-500/10" 
                               : "bg-red-600 border-red-800 group-hover:bg-red-500 shadow-xl"
                           )}
                         />
                      </button>
                      <div 
                        onClick={() => operateGate('inputGate', data.inputGate.isOpen ? 0 : 100)}
                        className="w-20 h-16 bg-[#1C2029] border-2 border-[#3E4C59] rounded-b-lg flex flex-col items-center justify-center z-10 shadow-xl relative -top-2 cursor-pointer hover:bg-[#2D333F] transition-colors group"
                      >
                         <div className="absolute -top-4 bg-[#151921] rounded-full p-1.5 z-20 flex items-center justify-center h-8 w-8 shadow-lg border border-orange-500/50">
                            {data.inputGate.isOpen ? <Unlock size={16} className="text-emerald-500" /> : <Lock size={16} className="text-red-500" />}
                         </div>
                         <div className={cn("w-8 h-2 rounded-full mb-1", data.inputGate.isOpen ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]" : "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)]")} />
                         <div className="text-[10px] text-white font-black tracking-widest mt-1 group-hover:text-orange-400">GİRİŞ</div>
                      </div>
                   </div>
                   
                   {/* Interactive Valves */}
                   <div className="absolute left-36 right-36 top-0 flex justify-center gap-1 -mt-6 z-10">
                      {[...data.valves].reverse().map((valve) => (
                        <div key={valve.id} className="flex flex-col items-center w-14">
                           <button 
                             onClick={() => toggleValve(valve.id)}
                             className={cn(
                               "w-12 h-12 rounded-xl shadow-xl border-4 relative transition-all flex items-center justify-center active:scale-90", 
                               valve.isOpen 
                                ? "bg-blue-600 border-blue-400 text-white shadow-[0_0_20px_rgba(59,130,246,0.6)]" 
                                : "bg-[#2D333F] border-[#1F2937] text-gray-500 hover:border-gray-500"
                             )}
                           >
                             <Droplet size={20} className={cn(valve.isOpen && "animate-pulse")} />
                             <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gray-900 border border-gray-700 px-1 rounded text-[8px] font-bold text-gray-400">V{valve.id}</span>
                           </button>
                           <div className="w-3 h-8 bg-[#1F2937] mt-1 rounded-b-sm relative z-20 border-x border-gray-700" />
                           {/* Fluid drip animation */}
                           <AnimatePresence>
                             {valve.isOpen && (
                                <motion.div 
                                  initial={{ height: 0, opacity: 1 }}
                                  animate={{ height: 80, opacity: 0 }}
                                  transition={{ repeat: Infinity, duration: 0.5 }}
                                  className="w-2 mt-0.5 absolute top-[70px] rounded-full z-10 bg-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.8)]"
                                />
                             )}
                           </AnimatePresence>
                        </div>
                      ))}
                   </div>
                   
                   {/* Interactive Output Gate */}
                   <div className="absolute right-10 -bottom-20 flex flex-col items-center z-20">
                      <button 
                         onClick={() => operateGate('outputGate', data.outputGate.isOpen ? 0 : 100)}
                         className="h-48 w-8 flex items-end overflow-hidden group cursor-pointer"
                      >
                         <motion.div 
                           initial={false}
                           animate={{ y: data.outputGate.isOpen ? '100%' : '0%' }}
                           transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                           className={cn(
                             "w-full h-36 rounded-t-md transition-all border-x-4 border-t-4", 
                             data.outputGate.isOpen 
                               ? "bg-emerald-500/20 border-emerald-500/30 group-hover:bg-emerald-500/10" 
                               : "bg-red-600 border-red-800 group-hover:bg-red-500 shadow-xl"
                           )}
                         />
                      </button>
                      <div 
                        onClick={() => operateGate('outputGate', data.outputGate.isOpen ? 0 : 100)}
                        className="w-20 h-16 bg-[#1C2029] border-2 border-[#3E4C59] rounded-b-lg flex flex-col items-center justify-center z-10 shadow-xl relative -top-2 cursor-pointer hover:bg-[#2D333F] transition-colors group"
                      >
                         <div className="absolute -top-4 bg-[#151921] rounded-full p-1.5 z-20 flex items-center justify-center h-8 w-8 shadow-lg border border-orange-500/50">
                            {data.outputGate.isOpen ? <Unlock size={16} className="text-emerald-500" /> : <Lock size={16} className="text-red-500" />}
                         </div>
                         <div className={cn("w-8 h-2 rounded-full mb-1", data.outputGate.isOpen ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]" : "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)]")} />
                         <div className="text-[10px] text-white font-black tracking-widest mt-1 group-hover:text-orange-400">ÇIKIŞ</div>
                      </div>
                   </div>
                </div>
             </div>

             {/* Footer hint */}
             <div className="mt-auto pt-4 flex items-center justify-center gap-4 text-[10px] text-gray-500 font-bold tracking-wider italic bg-[#0A0D14]/30 p-2 rounded">
                <div className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full bg-blue-600 animate-pulse" />
                   <span>VALF ETKİLEŞİMİ AKTİF</span>
                </div>
                <div className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full bg-red-600" />
                   <span>BARİYER KİLİDİ AKTİF</span>
                </div>
                {data.config.manualValveMaxOpenTimeMs > 0 && (
                  <div className="flex items-center gap-2 px-2 py-0.5 bg-orange-500/10 border border-orange-500/20 rounded text-orange-400">
                    <Timer size={12} />
                    <span>GÜVENLİK ZAMAN AŞIMI: {data.config.manualValveMaxOpenTimeMs}ms</span>
                  </div>
                )}
                <div className="ml-4 opacity-50 underline underline-offset-4">Dokunarak doğrudan komut gönderin</div>
             </div>
          </div>
          
          {/* Right Column: Mini Dashboard */}
          <div className="col-span-3 flex flex-col gap-4 overflow-hidden">
             
             {/* Simple Stats Grid */}
             <div className="bg-[#151921] border border-[#2D333F] rounded p-4 grid grid-cols-1 gap-3">
                <div className="flex justify-between items-center p-2 bg-[#0D1016] rounded border border-gray-800">
                   <span className="text-[10px] font-bold text-gray-500">GİRİŞ ADET:</span>
                   <div className="flex items-center gap-3">
                      <span className="text-lg font-mono text-orange-500 font-black">{data.inputCount}</span>
                      <button onClick={() => onResetCounter('input')} className="p-1.5 bg-gray-800 rounded hover:bg-gray-700 text-gray-400 transition-colors">
                         <RefreshCw size={12} />
                      </button>
                   </div>
                </div>
                <div className="flex justify-between items-center p-2 bg-[#0D1016] rounded border border-gray-800">
                   <span className="text-[10px] font-bold text-gray-500">ÇIKIŞ ADET:</span>
                   <div className="flex items-center gap-3">
                      <span className="text-lg font-mono text-emerald-500 font-black">{data.outputCount}</span>
                      <button onClick={() => onResetCounter('output')} className="p-1.5 bg-gray-800 rounded hover:bg-gray-700 text-gray-400 transition-colors">
                         <RefreshCw size={12} />
                      </button>
                   </div>
                </div>
             </div>

             {/* System Warnings View */}
             <div className="flex-1 bg-orange-950/10 border border-orange-500/10 rounded p-4 flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                   <AlertCircle size={16} className="text-orange-500" />
                   <h3 className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Güvenlik Protokolü</h3>
                </div>
                <p className="text-[10px] text-orange-400/80 italic leading-relaxed mb-4">
                   Manuel modda donanım limitleri yazılım tarafından denetlenmez. Tüm operasyonlardan operatör sorumludur.
                </p>
                
                <div className="mt-auto space-y-2">
                   <div className="text-[8px] font-bold text-gray-600 uppercase tracking-[0.2em] mb-1">Cihaz Kimliği</div>
                   <div className="text-[10px] font-mono text-gray-400 bg-black/40 p-2 rounded border border-gray-800">
                      DEV_TYPE: BIEL_PLC_RT<br/>
                      UID: 0x82_91_FE_4A<br/>
                      VER: 2.1.0-STABLE
                   </div>
                </div>
             </div>
          </div>

        </div>
      )}
    </div>
  )}
</div>
);
}

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { SystemData } from '../../types/system';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Square, RefreshCcw, ShieldAlert, Cpu, AlertTriangle, Unlock, Shield, Target, RefreshCw, Lock, Droplet, History } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DashboardProps {
  data: SystemData;
  onStart: () => void;
  onStop: () => void;
  onStartWashing: () => void;
  onStopWashing: () => void;
  onResetCounter: (target: 'input' | 'output') => void;
  onSelectRecipe: (id: string) => void;
  onAnswerPrompt: (answer: boolean) => void;
  onStopAfterCycle: () => void;
  onStartFlush: () => void;
  onStopFlush: () => void;
  onToggleHardwareStatus: (id: number) => void;
}

export function Dashboard({ 
  data, 
  onStart, 
  onStop, 
  onStopAfterCycle,
  onStartWashing, 
  onStopWashing, 
  onResetCounter,
  onSelectRecipe,
  onAnswerPrompt,
  onStartFlush,
  onStopFlush,
  onToggleHardwareStatus
}: DashboardProps) {
  const isAuto = data.mode === 'OTOMATİK';
  const isWashing = data.mode === 'YIKAMA';
  const activeRecipe = data?.recipes?.find(r => r.id === data?.config?.recipeId) || data?.recipes?.[0];
  
  const autoStateLabels: Record<string, string> = {
    BEKLEMEDE: 'Beklemede',
    GIRIS_SAYILIYOR: 'Giriş Sayılıyor',
    GIRIS_KILITLI: 'Giriş Kapısı Kilitleniyor',
    DENGELEME: 'Sıvı / Titreşim Dengeleniyor',
    DOLUM: 'Valfler Açık (Dolum)',
    DAMLA_BEKLEME: 'Damlama Bekleniyor',
    TAHLIYE: 'Çıkış Açık (Boşaltım)',
    DOGRULAMA: 'Döngü Pasaportu Doğrulanıyor'
  };

  const progress = isAuto && data.config.targetCount > 0 
      ? Math.min(100, Math.round(((data.autoState === 'TAHLIYE' || data.autoState === 'DOGRULAMA' 
          ? data.outputCount 
          : data.inputCount) / data.config.targetCount) * 100))
      : 0;

  return (
    <div className="flex flex-col h-full space-y-4 overflow-hidden">
      
      {/* Top action bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-[#151921] border border-[#374151] p-3 rounded shadow-lg flex-shrink-0 gap-4 md:gap-0">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h2 className="text-sm font-bold tracking-tight text-white flex items-center">
              {isAuto ? (
                 <><RefreshCcw className="mr-2 text-green-400 animate-spin-slow" size={14} /> Üretim Devam Ediyor</>
              ) : isWashing ? (
                 <><Droplet className="mr-2 text-blue-400 animate-bounce" size={14} /> Yıkama Modu Aktif</>
              ) : data.mode === 'TAHLIYE' ? (
                 <><RefreshCcw className="mr-2 text-cyan-400 animate-spin" size={14} /> Tahliye Modu Aktif</>
              ) : (
                 <><Square className="mr-2 text-gray-500" size={14} /> Hazır Durumda</>
              )}
            </h2>
            <p className="text-[10px] text-gray-500 mt-0.5 font-mono">
              {isWashing ? 'Tüm Valfler Pulsing Modunda Çalkalanıyor' : (autoStateLabels[data.autoState] || data.autoState)} 
              {isAuto && <span className="ml-2 text-blue-400 font-bold">({progress}%)</span>}
            </p>
          </div>

          {!isAuto && !isWashing && (
             <div className={cn(
               "px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1.5",
               data.isWashingDone ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]"
             )}>
                {data.isWashingDone ? <Shield size={10} /> : <AlertTriangle size={10} />}
                {data.isWashingDone ? 'YIKAMA TAMAM' : 'YIKAMA GEREKLİ'}
             </div>
          )}
        </div>
        
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {!isWashing && !isAuto && (
            <button
              onClick={onStartWashing}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#1e1b4b] border border-[#312e81] hover:bg-[#312e81] text-blue-400 px-4 md:px-6 py-2 rounded font-bold text-[11px] transition-all shadow-md active:scale-95 whitespace-nowrap"
            >
              <Droplet size={14} />
              <span>YIKAMAYI BAŞLAT</span>
            </button>
          )}

          {isWashing && (
            <button
              onClick={onStopWashing}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600/20 border border-blue-500 hover:bg-blue-600/40 text-blue-400 px-4 md:px-6 py-2 rounded font-bold text-[11px] transition-all whitespace-nowrap"
            >
              <Square size={14} />
              <span>YIKAMAYI DURDUR</span>
            </button>
          )}

          <button
            onClick={onStart}
            disabled={isAuto || isWashing || data.mode === 'ARIZA' || data.mode === 'BASLATMA'}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#052e16] border border-[#14532d] hover:bg-[#14532d] disabled:opacity-50 disabled:cursor-not-allowed text-[#4ade80] px-4 md:px-8 py-2 rounded font-bold text-[11px] transition-all shadow-lg active:scale-95 whitespace-nowrap"
          >
            <Play size={14} />
            <span>ÜRETİMİ BAŞLAT</span>
          </button>
          
          {isAuto && (
            <button
              onClick={onStopAfterCycle}
              className={cn(
                "flex-1 md:flex-none flex items-center justify-center gap-2 px-4 md:px-6 py-2 rounded font-bold text-[11px] transition-all active:scale-95 border whitespace-nowrap",
                data.stopAfterCycleRequested 
                  ? "bg-amber-600/20 border-amber-500 text-amber-500 animate-pulse" 
                  : "bg-orange-900/40 border-orange-800 hover:bg-orange-900 text-orange-500"
              )}
            >
              <RefreshCw size={14} className={cn(data.stopAfterCycleRequested && "animate-spin")} />
              <span>{data.stopAfterCycleRequested ? 'DÖNGÜ SONU...' : 'BEKLEME MODU'}</span>
            </button>
          )}

          <button
            onClick={onStop}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-red-900/40 border border-red-800 hover:bg-red-900 text-red-500 px-4 md:px-6 py-2 rounded font-bold text-[11px] transition-all active:scale-95 whitespace-nowrap"
          >
            <ShieldAlert size={14} />
            <span>ACİL DURDUR</span>
          </button>
          
          {data.mode === 'TAHLIYE' ? (
             <button
               onClick={onStopFlush}
               className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-cyan-900/40 border border-cyan-800 hover:bg-cyan-900 text-cyan-400 px-4 md:px-6 py-2 rounded font-bold text-[11px] transition-all active:scale-95 whitespace-nowrap"
             >
               <Square size={14} />
               <span>TAHLİYEYİ DURDUR</span>
             </button>
          ) : (
             <button
               onClick={onStartFlush}
               disabled={isAuto || isWashing}
               className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#151921] border border-cyan-800 hover:bg-cyan-900/40 text-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 md:px-6 py-2 rounded font-bold text-[11px] transition-all active:scale-95 whitespace-nowrap"
             >
               <RefreshCcw size={14} />
               <span>TAHLİYE (FLUSH)</span>
             </button>
          )}
        </div>
      </div>

      {/* Recipe Selector - Large targets for HMI */}
      {!isAuto && !isWashing && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 flex-shrink-0">
          {data.recipes.map((recipe) => (
            <button
              key={recipe.id}
              onClick={() => onSelectRecipe(recipe.id)}
              className={cn(
                "p-2 rounded border-2 transition-all flex flex-col items-start gap-1 relative overflow-hidden",
                data.config.recipeId === recipe.id 
                  ? "bg-blue-900/20 border-blue-500 ring-4 ring-blue-500/10" 
                  : "bg-[#151921] border-[#2D333F] hover:border-gray-500"
              )}
            >
              <div className="flex justify-between w-full items-center">
                <span className={cn("text-xs font-bold truncate", data.config.recipeId === recipe.id ? "text-blue-400" : "text-white")}>
                  {recipe.name}
                </span>
                {data.config.recipeId === recipe.id && (
                  <div className="p-0.5 bg-blue-500 rounded-full flex-shrink-0">
                    <Shield size={8} className="text-white" />
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-1 font-mono text-[9px]">
                <div className="flex items-center gap-1 text-gray-400">
                   <Target size={10} /> {recipe.targetCount} Adet
                </div>
                <div className="flex items-center gap-1 text-gray-400">
                   <RefreshCw size={10} /> {recipe.fillTimeMs/1000}s
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Main Flow Visualization */}
      <div className="grid grid-cols-12 gap-3 flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
        
        {/* Left Column: Flow representation */}
        <div className="col-span-12 lg:col-span-8 bg-[#151921] border border-[#2D333F] rounded p-3 flex flex-col relative overflow-hidden shadow-inner min-h-[400px]">
           <h2 className="text-[10px] font-bold text-gray-400 mb-2 border-l-2 border-[#F97316] pl-2 flex items-center">
              <Cpu size={12} className="mr-2"/> Görsel Akış Kontrolü
           </h2>
           
           <div className="flex-1 flex flex-col justify-center items-center relative w-full">
              
              {/* Target / Progress Line */}
              <div className="absolute top-0 w-full flex justify-between px-8">
                 <div className="bg-[#0D1016] p-2 rounded border border-[#1F2937] text-center w-24 relative flex flex-col items-center">
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex flex-col items-center">
                       <div className={cn("w-6 h-1 rounded-full", data.sensors.find(s=>s.id=='SENS-IN')?.enabled ? "bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" : "bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]")} />
                    </div>
                    <div className="text-[10px] text-gray-500 mb-1 font-bold">GİRİŞ</div>
                    <div className="text-2xl font-mono text-[#F97316] leading-none">{data.inputCount}</div>
                 </div>
                 <div className="bg-[#1e1b4b] p-2 rounded border border-[#312e81] text-center w-24">
                    <div className="text-[10px] text-gray-400 mb-1 font-bold">HEDEF</div>
                    <div className="text-2xl font-mono text-blue-400 leading-none">{data.config.targetCount}</div>
                 </div>
                 <div className="bg-[#0D1016] p-2 rounded border border-[#1F2937] text-center w-24 relative flex flex-col items-center">
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex flex-col items-center">
                       <div className={cn("w-6 h-1 rounded-full", data.sensors.find(s=>s.id=='SENS-OUT')?.enabled ? "bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" : "bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]")} />
                    </div>
                    <div className="text-[10px] text-gray-500 mb-1 font-bold">ÇIKIŞ</div>
                    <div className="text-2xl font-mono text-green-400 leading-none">{data.outputCount}</div>
                 </div>
              </div>

              {/* Conveyor graphic */}
              <div className="w-full mt-4 h-48 border-y-4 border-[#374151] bg-[#0D1016]/50 flex items-center justify-between px-16 relative">
                 
                 {/* Input Gate */}
                 <div className="absolute left-10 -bottom-16 flex flex-col items-center z-20">
                    <div className="h-44 w-6 flex items-end overflow-hidden">
                       <motion.div 
                         initial={false}
                         animate={{ y: data.inputGate.isOpen ? '100%' : '0%' }}
                         transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                         className={cn("w-full h-32 rounded-t-md transition-colors border-2", data.inputGate.isOpen ? "bg-green-500/80 border-green-400" : "bg-red-500 border-red-700")}
                       />
                    </div>
                    <div className="w-16 h-14 bg-[#1C2029] border-2 border-[#3E4C59] rounded-b-lg flex flex-col items-center justify-center z-10 shadow-xl relative -top-2">
                       <div className="absolute -top-3.5 bg-[#151921] rounded-full p-1 z-20 flex items-center justify-center h-7 w-7 shadow-lg border border-[#374151]">
                          <Lock size={14} className={cn(data.inputGate.isOpen ? "text-green-500 hidden" : "text-red-500")} />
                          <Unlock size={14} className={cn(data.inputGate.isOpen ? "text-green-500" : "hidden")} />
                       </div>
                       <div className={cn("w-6 h-2 rounded-full mb-1", data.inputGate.isOpen ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]")} />
                       <div className="text-[9px] text-gray-500 font-bold tracking-wider leading-none">GİRİŞ</div>
                    </div>
                 </div>
                 
                 {/* Valves */}
                 <div className="absolute left-32 right-32 top-0 flex justify-between px-2 -mt-4 z-10">
                    {[...data.valves].reverse().map((valve, i) => (
                       <div key={valve.id} className="flex flex-col items-center w-10">
                          <button 
                            onClick={() => onToggleHardwareStatus(valve.id)}
                            disabled={isAuto || isWashing}
                            title={valve.enabled ? 'Bypass Yap (İptal Et)' : 'Aktif Et'}
                            className={cn(
                             "w-10 h-10 rounded shadow-md border-2 relative transition-colors flex items-center justify-center disabled:cursor-not-allowed hover:ring-2 ring-white/20", 
                             !valve.enabled
                              ? "bg-red-900/50 border-red-800 text-red-500 opacity-50"
                              : (valve.isOpen || data.mode === 'YIKAMA') 
                                ? (data.mode === 'YIKAMA' ? "bg-blue-600 border-blue-400 text-white shadow-[0_0_12px_rgba(59,130,246,0.6)]" : "bg-fuchsia-600 border-fuchsia-400 shadow-[0_0_12px_rgba(217,70,239,0.8)] text-white") 
                                : "bg-[#2D333F] border-[#1F2937] text-gray-500"
                           )}>
                            <span className="text-[10px] font-bold">V{valve.id}</span>
                            {!valve.enabled && <div className="absolute inset-0 flex items-center justify-center"><div className="w-8 h-0.5 bg-red-500 -rotate-45" /></div>}
                          </button>
                          <div className={cn("w-2.5 h-6 mt-1 rounded-b-sm relative z-20", !valve.enabled ? "bg-red-900/50 opacity-50" : "bg-[#1F2937]")} />
                         {/* Fluid drip animation */}
                         <AnimatePresence>
                           {(valve.isOpen || data.mode === 'YIKAMA') && (
                              <motion.div 
                                initial={{ height: 0, opacity: 1 }}
                                animate={{ height: 60, opacity: 0 }}
                                transition={{ 
                                  repeat: Infinity, 
                                  duration: data.mode === 'YIKAMA' ? 0.3 : 0.5 
                                }}
                                className={cn(
                                  "w-1.5 mt-0.5 absolute top-[60px] rounded-full z-10",
                                  data.mode === 'YIKAMA' ? "bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]" : "bg-fuchsia-500 shadow-[0_0_8px_rgba(217,70,239,0.6)]"
                                )}
                              />
                           )}
                         </AnimatePresence>
                      </div>
                    ))}
                 </div>
                 
                 {/* Output Gate */}
                 <div className="absolute right-10 -bottom-16 flex flex-col items-center z-20">
                    <div className="h-44 w-6 flex items-end overflow-hidden">
                       <motion.div 
                         initial={false}
                         animate={{ y: data.outputGate.isOpen ? '100%' : '0%' }}
                         transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                         className={cn("w-full h-32 rounded-t-md transition-colors border-2", data.outputGate.isOpen ? "bg-green-500/80 border-green-400" : "bg-red-500 border-red-700")}
                       />
                    </div>
                    <div className="w-16 h-14 bg-[#1C2029] border-2 border-[#3E4C59] rounded-b-lg flex flex-col items-center justify-center z-10 shadow-xl relative -top-2">
                       <div className="absolute -top-3.5 bg-[#151921] rounded-full p-1 z-20 flex items-center justify-center h-7 w-7 shadow-lg border border-[#374151]">
                          <Lock size={14} className={cn(data.outputGate.isOpen ? "text-green-500 hidden" : "text-red-500")} />
                          <Unlock size={14} className={cn(data.outputGate.isOpen ? "text-green-500" : "hidden")} />
                       </div>
                       <div className={cn("w-6 h-2 rounded-full mb-1", data.outputGate.isOpen ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]")} />
                       <div className="text-[9px] text-gray-500 font-bold tracking-wider leading-none">ÇIKIŞ</div>
                    </div>
                 </div>
                 
                 {/* Bottles mapping */}
                 <div className="absolute left-32 right-32 bottom-0 flex justify-between px-2 z-0">
                    {[...data.valves].reverse().map((valve, i) => (
                       <div key={'bottle-'+valve.id} className="flex justify-center w-10">
                          {data.inputCount > 0 && (
                             <motion.div 
                               initial={{ opacity: 0, y: 10 }} 
                               animate={{ opacity: 1, y: 0 }}
                               className="w-10 h-20 bg-gradient-to-t from-[#374151] to-[#4B5563] rounded-t-lg border-b-2 border-gray-600 shadow-sm relative flex flex-col items-center justify-start pt-1"
                             >
                                <div className="absolute -top-4 w-4 h-5 bg-[#4B5563] rounded-t-sm border border-gray-500" />
                                <div className="w-6 h-px bg-white/10 mt-2" />
                             </motion.div>
                          )}
                       </div>
                    ))}
                 </div>

              </div>
           </div>

           {/* Terminal Logs */}
           <div className="w-full bg-[#0A0D14] p-3 border-t border-[#2D333F] h-40 overflow-y-auto mt-auto flex-shrink-0">
             <h3 className="text-[10px] font-bold text-gray-400 mb-2 border-b border-[#1F2937] pb-1 sticky top-0 bg-[#0A0D14] z-10">SİSTEM DURUMU / HABERLEŞME MESAJLARI</h3>
             <div className="space-y-1 font-mono text-[9px]">
               {data.terminalLogs.slice(0, 30).map((log, i) => (
                 <div key={i} className={log.includes('ERR') ? 'text-red-400' : 'text-emerald-400/80'}>{log}</div>
               ))}
             </div>
           </div>
        </div>
        
        {/* Right Column: Status & Alerts */}
        <div className="col-span-12 lg:col-span-4 flex flex-col space-y-3 min-h-0">
           
           {/* Alerts Panel */}
           <div className="bg-[#151921] p-3 rounded border border-[#2D333F] flex-1 flex flex-col min-h-0 overflow-hidden">
              <h2 className="text-[10px] uppercase font-bold text-gray-400 mb-2 border-l-2 border-[#F97316] pl-2 flex items-center">
                 <ShieldAlert size={12} className="mr-2"/> Aktif Uyarılar
              </h2>
              
              <div className="flex-1 overflow-y-auto space-y-1.5 mt-2 transition-all duration-300 custom-scrollbar pr-1">
                 {data?.activeAlerts?.filter(a => !a.resolved).length === 0 ? (
                    <div className="h-full flex items-center justify-center text-gray-500 text-[10px] font-mono">
                       AKTIF_ALARM_YOK
                    </div>
                 ) : (
                    data?.activeAlerts?.filter(a => !a.resolved).map((alert, i) => (
                       <motion.div 
                         initial={{ opacity: 0, x: 20 }}
                         animate={{ opacity: 1, x: 0 }}
                         key={alert.id || i} 
                         className={cn(
                           "border p-2 rounded text-[10px] font-mono flex items-start",
                           alert.severity === 'CRITICAL' ? "bg-red-900/30 border-red-800 text-red-400" : "bg-amber-900/30 border-amber-800 text-amber-400"
                         )}
                       >
                         <AlertTriangle size={12} className="mr-2 shrink-0 mt-0.5" />
                         <div>
                           <span className="font-bold">{alert.code}</span>
                           <div className="mt-0.5 opacity-80">{alert.message}</div>
                         </div>
                       </motion.div>
                    ))
                 )}
              </div>
           </div>
           
           {/* Cycle Metrics & OEE */}
           <div className="bg-[#151921] p-3 rounded border border-[#2D333F] flex-shrink-0">
              <h2 className="text-[10px] uppercase font-bold text-gray-400 mb-2 border-l-2 border-[#F97316] pl-2 flex items-center justify-between">
                 <span>Mevcut Üretim Planı & OEE</span>
              </h2>
              <div className="space-y-1.5 mt-2">
                 <div className="flex justify-between items-center text-[11px] border-b border-gray-800 pb-1">
                    <span className="text-gray-500">Reçete:</span>
                    <span className="font-mono text-white truncate max-w-[150px]">{activeRecipe.name}</span>
                 </div>
                 <div className="flex justify-between items-center text-[11px] border-b border-gray-800 pb-1">
                    <span className="text-gray-500">Hedef:</span>
                    <span className="font-mono text-blue-400">{Math.min(activeRecipe.targetCount, data.valves.filter(v=>v.enabled).length)} Adet</span>
                 </div>
                 
                 <div className="flex justify-between items-center pt-2 mt-2 gap-2">
                    <div className="flex-1 bg-[#0D1016] border border-[#1F2937] rounded p-2 text-center">
                       <div className="text-[9px] text-gray-500 font-bold mb-1">HIZ (BPM)</div>
                       <div className="text-lg font-mono text-emerald-400 leading-none">
                          {data.cycleHistory.length > 0 ? Math.round((60000 / (data.cycleHistory.slice(0,5).reduce((a,c)=>a+c.duration,0)/Math.min(data.cycleHistory.length,5))) * data.cycleHistory[0].outputCount) : 0}
                       </div>
                    </div>
                    <div className="flex-1 bg-[#0D1016] border border-[#1F2937] rounded p-2 text-center">
                       <div className="text-[9px] text-gray-500 font-bold mb-1">OEE SKORU</div>
                       <div className={cn("text-lg font-mono leading-none", data.mode === 'ARIZA' ? "text-red-500" : "text-blue-400")}>
                          {data.mode === 'ARIZA' ? '0%' : (data.mode === 'OTOMATİK' ? '98%' : '85%')}
                       </div>
                    </div>
                 </div>
              </div>
           </div>

           {/* Cycle Time Chart */}
           <div className="bg-[#151921] p-3 rounded border border-[#2D333F] flex-shrink-0 h-48 flex flex-col">
              <h2 className="text-[10px] uppercase font-bold text-gray-400 mb-2 border-l-2 border-[#F97316] pl-2 flex items-center">
                 <History size={12} className="mr-2"/> Döngü Süresi (ms)
              </h2>
              <div className="flex-1 mt-2 -ml-6">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[...data.cycleHistory].reverse().slice(-10)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2D333F" vertical={false} />
                    <XAxis 
                      dataKey="id" 
                      hide 
                    />
                    <YAxis 
                      stroke="#4B5563" 
                      fontSize={8} 
                      tickFormatter={(val) => `${val}ms`}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#151921', borderColor: '#374151', fontSize: '10px', color: '#fff' }}
                      itemStyle={{ color: '#F97316' }}
                      labelStyle={{ display: 'none' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="duration" 
                      stroke="#F97316" 
                      strokeWidth={2} 
                      dot={{ r: 3, fill: '#F97316', strokeWidth: 0 }} 
                      activeDot={{ r: 5, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
           </div>

        </div>

      </div>

      {/* Prompt Overlays */}
      <AnimatePresence>
         {data.activePrompt === 'BOTTLE_CHECK' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
            >
               <motion.div 
                 initial={{ scale: 0.9, y: 20 }}
                 animate={{ scale: 1, y: 0 }}
                 className="bg-[#151921] border-2 border-blue-500 rounded-xl max-w-lg w-full p-8 shadow-[0_0_50px_rgba(59,130,246,0.3)]"
               >
                  <div className="flex flex-col items-center text-center">
                     <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mb-6">
                        <Droplet size={40} className="text-blue-400" />
                     </div>
                     <h3 className="text-2xl font-bold text-white mb-2">Dolum Alanı Kontrolü</h3>
                     <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                        Üretim döngüsü başlamadan önce lütfen kontrol edin:<br/>
                        <span className="text-white font-bold">Dolum alanında (şişe baskı bölgesinde) ürün var mı?</span>
                     </p>
                     
                     <div className="grid grid-cols-2 gap-4 w-full">
                        <button 
                          onClick={() => onAnswerPrompt(true)}
                          className="bg-red-500 hover:bg-red-600 text-white py-6 rounded-lg font-bold text-xl transition-colors shadow-lg flex flex-col items-center gap-2 active:scale-95"
                        >
                           <ShieldAlert size={28} />
                           EVET, VAR
                        </button>
                        <button 
                          onClick={() => onAnswerPrompt(false)}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white py-6 rounded-lg font-bold text-xl transition-colors shadow-lg flex flex-col items-center gap-2 active:scale-95"
                        >
                           <Target size={28} />
                           HAYIR, BOŞ
                        </button>
                     </div>
                     <p className="mt-6 text-gray-500 text-sm italic">
                        * Üretimin sağlıklı başlaması için alanın boş olması gerekmektedir.
                     </p>
                  </div>
               </motion.div>
            </motion.div>
         )}
      </AnimatePresence>

    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { SystemData, SystemMode, Recipe } from '../../types/system';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, Square, RefreshCcw, ShieldAlert, Cpu, AlertTriangle, 
  Unlock, Shield, Target, RefreshCw, Lock, Droplet, History, 
  ArrowUp, ArrowDown, ChevronRight, CheckCircle2, UserCheck
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface OperatorControlProps {
  data: SystemData;
  setMode: (mode: SystemMode) => void;
  onStartAutoCycle: () => void;
  operateGate: (target: 'inputGate' | 'outputGate', position: number) => void;
  toggleValve: (id: number) => void;
  testValvePulse: (id: number, duration: number) => void;
  resetCounter: (target: 'input' | 'output', op?: 'inc' | 'dec' | 'reset') => void;
  onSelectRecipe: (id: string) => void;
}

export function OperatorControl({ 
  data, setMode, onStartAutoCycle, operateGate, toggleValve, 
  testValvePulse, resetCounter, onSelectRecipe 
}: OperatorControlProps) {
  
  const activeRecipe = data?.recipes?.find(r => r.id === data?.config?.recipeId) || data?.recipes?.[0];
  const [isFilling, setIsFilling] = useState(false);
  const [fillProgress, setFillProgress] = useState(0);

  // Logic for automatic gate closing in Operator Mode (Safety feature)
  useEffect(() => {
    if (data.inputGate.isOpen && data.inputCount >= data.config.targetCount) {
      operateGate('inputGate', 0);
    }
  }, [data.inputCount, data.config.targetCount, data.inputGate.isOpen]);

  const handleStartFilling = () => {
    if (isFilling) return;
    setIsFilling(true);
    setFillProgress(0);
    
    // Start timing
    const duration = data.config.fillTimeMs || 3000;
    const interval = 50;
    let elapsed = 0;

    // Toggle enabled valves
    data.valves.filter(v => v.enabled).forEach(v => toggleValve(v.id));

    const timer = setInterval(() => {
      elapsed += interval;
      setFillProgress((elapsed / duration) * 100);
      
      if (elapsed >= duration) {
        clearInterval(timer);
        setIsFilling(false);
        setFillProgress(0);
        // Close all open valves
        data.valves.filter(v => v.isOpen).forEach(v => toggleValve(v.id));
      }
    }, interval);
  };

  return (
    <div className="flex flex-col h-full space-y-4 overflow-hidden">
      
      {/* Top action bar - MODIFIED FOR OPERATOR CONTROL */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-[#151921] border border-[#374151] p-3 rounded shadow-lg flex-shrink-0 gap-4 md:gap-0">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h2 className="text-sm font-bold tracking-tight text-white flex items-center">
              <UserCheck className="mr-2 text-blue-400" size={14} /> 
              OPERATÖR KONTROLÜ AKTİF
            </h2>
            <p className="text-[10px] text-gray-500 mt-0.5 font-mono uppercase tracking-widest">
              Tüm süreç manuel tetikleme bekliyor
            </p>
          </div>
          
          <div className="px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-[9px] font-black uppercase tracking-tighter italic">
             Yarı-Otomatik
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {/* Step 1: Entry */}
          <button
            onClick={() => operateGate('inputGate', data.inputGate.isOpen ? 0 : 400)}
            className={cn(
              "flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded font-bold text-[11px] transition-all active:scale-95 border whitespace-nowrap",
              data.inputGate.isOpen 
                ? "bg-red-900/20 border-red-800 text-red-500" 
                : "bg-emerald-900/40 border-emerald-800 text-emerald-400 hover:bg-emerald-900"
            )}
          >
            {data.inputGate.isOpen ? <Square size={14} /> : <Play size={14} />}
            <span>{data.inputGate.isOpen ? 'GİRİŞİ KAPAT' : 'GİRİŞİ BAŞLAT'}</span>
          </button>

          {/* Step 2: Fill */}
          <button
            onClick={handleStartFilling}
            disabled={isFilling}
            className={cn(
              "flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded font-bold text-[11px] transition-all active:scale-95 border whitespace-nowrap relative overflow-hidden",
              isFilling 
                ? "bg-blue-600/20 border-blue-500 text-blue-400" 
                : "bg-blue-900/40 border-blue-800 text-blue-400 hover:bg-blue-900 disabled:opacity-50"
            )}
          >
            {isFilling && (
              <motion.div 
                className="absolute bottom-0 left-0 h-0.5 bg-blue-400" 
                initial={{ width: 0 }} 
                animate={{ width: `${fillProgress}%` }}
              />
            )}
            <Droplet size={14} className={cn(isFilling && "animate-bounce")} />
            <span>{isFilling ? 'DOLUM YAPILIYOR...' : 'DOLUMU BAŞLAT'}</span>
          </button>

          {/* Step 3: Exit */}
          <button
            onClick={() => operateGate('outputGate', data.outputGate.isOpen ? 0 : 400)}
            className={cn(
              "flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded font-bold text-[11px] transition-all active:scale-95 border whitespace-nowrap",
              data.outputGate.isOpen 
                ? "bg-orange-900/20 border-orange-800 text-orange-500" 
                : "bg-orange-600/20 border-orange-500 text-orange-400 hover:bg-orange-600/40"
            )}
          >
            {data.outputGate.isOpen ? <Square size={14} /> : <RefreshCw size={14} />}
            <span>{data.outputGate.isOpen ? 'TAHLİYEYİ DURDUR' : 'TAHLİYEYİ BAŞLAT'}</span>
          </button>

          <div className="w-px h-8 bg-gray-800 mx-1 hidden md:block" />

          <button
            onClick={() => setMode('BEKLEMEDE')}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-red-900/40 border border-red-800 hover:bg-red-900 text-red-500 px-4 py-2 rounded font-bold text-[11px] transition-all active:scale-95 whitespace-nowrap"
          >
            <ShieldAlert size={14} />
            <span>MODDAN ÇIK</span>
          </button>
        </div>
      </div>

      {/* Recipe Selector - Kept same as Dashboard */}
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

      {/* Main Flow Visualization - Same as Dashboard */}
      <div className="grid grid-cols-12 gap-3 flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
        
        {/* Left Column: Flow representation */}
        <div className="col-span-12 lg:col-span-8 bg-[#151921] border border-[#2D333F] rounded p-3 flex flex-col relative overflow-hidden shadow-inner min-h-[400px]">
           <h2 className="text-[10px] font-bold text-gray-400 mb-2 border-l-2 border-[#F97316] pl-2 flex items-center">
              <Cpu size={12} className="mr-2"/> Operatör Görsel Akış Paneli
           </h2>
           
           <div className="flex-1 flex flex-col justify-center items-center relative w-full">
              
              {/* Target / Progress Line */}
              <div className="absolute top-0 w-full flex justify-between px-8">
                  <div className="bg-[#0D1016] p-2 rounded border border-[#1F2937] text-center w-28 relative flex flex-col items-center">
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex flex-col items-center">
                       <div className={cn("w-6 h-1 rounded-full", data.sensors.find(s=>s.id=='SENS-IN')?.enabled ? "bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" : "bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]")} />
                    </div>
                    <div className="text-[10px] text-gray-500 mb-1 font-bold">GİRİŞ</div>
                    <div className="flex items-center gap-2">
                       <button onClick={() => resetCounter('input', 'reset')} className="p-1 hover:bg-gray-800 rounded transition-colors text-orange-500/50 hover:text-orange-500"><RefreshCw size={10} /></button>
                       <div className="text-2xl font-mono text-[#F97316] leading-none">{data.inputCount}</div>
                       <div className="flex flex-col gap-0.5">
                          <button onClick={() => resetCounter('input', 'inc')} className="p-0.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white"><ArrowUp size={8} /></button>
                          <button onClick={() => resetCounter('input', 'dec')} className="p-0.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white"><ArrowDown size={8} /></button>
                       </div>
                    </div>
                 </div>
                 <div className="bg-[#1e1b4b] p-2 rounded border border-[#312e81] text-center w-24">
                    <div className="text-[10px] text-gray-400 mb-1 font-bold">HEDEF</div>
                    <div className="text-2xl font-mono text-blue-400 leading-none">{data.config.targetCount}</div>
                 </div>
                 <div className="bg-[#0D1016] p-2 rounded border border-[#1F2937] text-center w-28 relative flex flex-col items-center">
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex flex-col items-center">
                       <div className={cn("w-6 h-1 rounded-full", data.sensors.find(s=>s.id=='SENS-OUT')?.enabled ? "bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" : "bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]")} />
                    </div>
                    <div className="text-[10px] text-gray-500 mb-1 font-bold">ÇIKIŞ</div>
                    <div className="flex items-center gap-2">
                       <button onClick={() => resetCounter('output', 'reset')} className="p-1 hover:bg-gray-800 rounded transition-colors text-emerald-500/50 hover:text-emerald-500"><RefreshCw size={10} /></button>
                       <div className="text-2xl font-mono text-green-400 leading-none">{data.outputCount}</div>
                       <div className="flex flex-col gap-0.5">
                          <button onClick={() => resetCounter('output', 'inc')} className="p-0.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white"><ArrowUp size={8} /></button>
                          <button onClick={() => resetCounter('output', 'dec')} className="p-0.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white"><ArrowDown size={8} /></button>
                       </div>
                    </div>
                 </div>
              </div>

              {/* Conveyor graphic */}
              <div className="w-full mt-4 h-48 border-y-4 border-[#374151] bg-[#0D1016]/50 flex items-center justify-between px-16 relative">
                 
                 {/* Input Gate */}
                 <div 
                   onClick={() => operateGate('inputGate', data.inputGate.isOpen ? 0 : 400)}
                   className="absolute left-10 -bottom-16 flex flex-col items-center z-20 cursor-pointer group"
                 >
                    <div className="h-44 w-6 flex items-end overflow-hidden">
                       <motion.div 
                         initial={false}
                         animate={{ y: data.inputGate.isOpen ? '100%' : '0%' }}
                         transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                         className={cn("w-full h-32 rounded-t-md transition-colors border-2 group-hover:ring-4 ring-white/10", data.inputGate.isOpen ? "bg-green-500/80 border-green-400" : "bg-red-500 border-red-700")}
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
                            onClick={() => toggleValve(valve.id)}
                            className={cn(
                             "w-10 h-10 rounded shadow-md border-2 relative transition-colors flex items-center justify-center hover:ring-2 ring-white/20", 
                             !valve.enabled
                               ? "bg-red-950/20 border-red-900 text-red-900 opacity-50"
                               : (valve.isOpen) 
                                 ? "bg-blue-600 border-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.6)] text-white" 
                                 : "bg-[#2D333F] border-[#1F2937] text-gray-500"
                           )}>
                            <span className="text-[10px] font-bold">{i + 1}</span>
                            {!valve.enabled && <div className="absolute inset-0 flex items-center justify-center"><div className="w-8 h-0.5 bg-red-500 -rotate-45" /></div>}
                          </button>
                          <div className={cn("w-2.5 h-6 mt-1 rounded-b-sm relative z-20", !valve.enabled ? "bg-red-900/50 opacity-50" : "bg-[#1F2937]")} />
                         {/* Fluid drip animation */}
                         <AnimatePresence>
                           {(valve.isOpen || (isFilling && valve.enabled)) && (
                              <motion.div 
                                initial={{ height: 0, opacity: 1 }}
                                animate={{ height: 60, opacity: 0 }}
                                transition={{ repeat: Infinity, duration: 0.5 }}
                                className="w-1.5 mt-0.5 absolute top-[60px] rounded-full z-10 bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]"
                              />
                           )}
                         </AnimatePresence>
                       </div>
                    ))}
                 </div>
                 
                 {/* Output Gate */}
                 <div 
                   onClick={() => operateGate('outputGate', data.outputGate.isOpen ? 0 : 400)}
                   className="absolute right-10 -bottom-16 flex flex-col items-center z-20 cursor-pointer group"
                 >
                    <div className="h-44 w-6 flex items-end overflow-hidden">
                       <motion.div 
                         initial={false}
                         animate={{ y: data.outputGate.isOpen ? '100%' : '0%' }}
                         transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                         className={cn("w-full h-32 rounded-t-md transition-colors border-2 group-hover:ring-4 ring-white/10", data.outputGate.isOpen ? "bg-green-500/80 border-green-400" : "bg-red-500 border-red-700")}
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
                          {data.inputCount > i && (
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
             <h3 className="text-[10px] font-bold text-gray-400 mb-2 border-b border-[#1F2937] pb-1 sticky top-0 bg-[#0A0D14] z-10">HABERLEŞME MESAJLARI (OPERATÖR)</h3>
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
                 <span>Operatör Verimliliği</span>
              </h2>
              <div className="space-y-1.5 mt-2">
                 <div className="flex justify-between items-center text-[11px] border-b border-gray-800 pb-1">
                    <span className="text-gray-500">Aktif Reçete:</span>
                    <span className="font-mono text-white truncate max-w-[150px]">{activeRecipe.name}</span>
                 </div>
                 <div className="flex justify-between items-center text-[11px] border-b border-gray-800 pb-1">
                    <span className="text-gray-500">İşlem Süresi:</span>
                    <span className="font-mono text-blue-400">{activeRecipe.fillTimeMs} ms</span>
                 </div>
                 
                 <div className="flex justify-between items-center pt-2 mt-2 gap-2">
                    <div className="flex-1 bg-[#0D1016] border border-[#1F2937] rounded p-2 text-center">
                       <div className="text-[9px] text-gray-500 font-bold mb-1">GİRİŞ SAYAÇ</div>
                       <div className="text-lg font-mono text-emerald-400 leading-none">{data.inputCount}</div>
                    </div>
                    <div className="flex-1 bg-[#0D1016] border border-[#1F2937] rounded p-2 text-center">
                       <div className="text-[9px] text-gray-500 font-bold mb-1">ÇIKIŞ SAYAÇ</div>
                       <div className="text-lg font-mono text-blue-400 leading-none">{data.outputCount}</div>
                    </div>
                 </div>
              </div>
           </div>

           {/* Cycle Time Chart */}
           <div className="bg-[#151921] p-3 rounded border border-[#2D333F] flex-shrink-0 h-48 flex flex-col">
              <h2 className="text-[10px] uppercase font-bold text-gray-400 mb-2 border-l-2 border-[#F97316] pl-2 flex items-center">
                 <History size={12} className="mr-2"/> Manuel Performans
              </h2>
              <div className="flex-1 mt-2 -ml-6">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[...data.cycleHistory].reverse().slice(-10)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2D333F" vertical={false} />
                    <XAxis dataKey="id" hide />
                    <YAxis stroke="#4B5563" fontSize={8} tickFormatter={(val) => `${val}ms`} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#151921', borderColor: '#374151', fontSize: '10px', color: '#fff' }} itemStyle={{ color: '#F97316' }} labelStyle={{ display: 'none' }} />
                    <Line type="monotone" dataKey="duration" stroke="#F97316" strokeWidth={2} dot={{ r: 3, fill: '#F97316', strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
           </div>

        </div>

      </div>

    </div>
  );
}

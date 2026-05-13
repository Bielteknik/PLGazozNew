import React, { useState, useEffect } from 'react';
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
  Power,
  Play,
  Activity,
  ArrowDownUp,
  Eye,
  Settings2
} from 'lucide-react';
import { SystemData, SystemMode, Recipe } from '../../types/system';
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
  onResetCounter: (target: 'input' | 'output', op?: 'inc' | 'dec' | 'reset') => void;
  onToggleHardwareStatus: (id: number | string) => void;
  onUpdateRecipe: (id: string, updates: Partial<Recipe>) => void;
  onUpdateSystemGate: (target: 'inputGate' | 'outputGate', updates: any) => void;
  onUpdateSensor: (id: string, updates: any) => void;
  testValvePulse: (id: number, duration: number) => void;
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
  onToggleHardwareStatus,
  onUpdateRecipe,
  onUpdateSystemGate,
  onUpdateSensor,
  testValvePulse,
  manualLogin,
  manualToken,
  manualExpires
}: ManualControlProps) {
  const [password, setPassword] = useState('');
  const [selectedTab, setSelectedTab] = useState<'visual' | 'calibration'>('visual');
  const [calSubTab, setCalSubTab] = useState<'valves' | 'gates' | 'sensors'>('valves');
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>(data.config?.recipeId || '');
  const [selectedValveId, setSelectedValveId] = useState<number | null>(null);
  const [testDuration, setTestDuration] = useState<number>(1000);
  
  // Gate Calibration States
  const [gateCal, setGateCal] = useState({
     target: 'inputGate' as 'inputGate' | 'outputGate',
     steps: 400,
     direction: 1
  });

  // Sensor Calibration States
  const [sensorCal, setSensorCal] = useState({
     id: 'SENS-IN',
     debounce: data.config?.inputDebounceMs || 200
  });

  const selectedRecipe = data.recipes?.find(r => r.id === selectedRecipeId);
  
  useEffect(() => {
    if (selectedRecipe) {
      setTestDuration(selectedRecipe.fillTimeMs || 1000);
      const firstActiveValve = data.valves?.find(v => v.enabled);
      if (firstActiveValve) setSelectedValveId(firstActiveValve.id);
    }
  }, [selectedRecipeId, data.recipes, selectedRecipe, data.valves]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    manualLogin(password);
    setPassword('');
  };

  const isManual = data.mode === 'MANUEL';
  const timeLeft = manualExpires ? Math.max(0, Math.floor((manualExpires - Date.now()) / 1000 / 60)) : 0;

  if (!manualToken) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#151921] border border-[#2D333F] rounded-xl p-8 shadow-2xl">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mb-4">
              <Shield className="text-orange-500" size={32} />
            </div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Güvenli Erişim</h2>
            <p className="text-xs text-gray-500 mt-2">Manuel kontrol yetkisi için şifrenizi giriniz.</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              className="w-full bg-[#0D1016] border border-[#2D333F] rounded-lg p-4 text-center text-2xl tracking-[0.5em] focus:border-orange-500 outline-none text-white transition-all"
              autoFocus
            />
            <button className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 rounded-lg shadow-lg shadow-orange-500/20 transition-all active:scale-95">
              GİRİŞ YAP
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-6 min-h-0">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-black text-white tracking-tighter flex items-center italic">
            <Shield className="mr-3 text-orange-500" size={28} /> MANUEL KONTROL MERKEZİ
          </h1>
          <div className="flex gap-1 bg-[#0D1016] p-1 rounded-lg border border-[#1F2937]">
            <button
              onClick={() => setSelectedTab('visual')}
              className={cn(
                "px-4 py-1.5 rounded-md text-[10px] font-bold transition-all uppercase tracking-wider",
                selectedTab === 'visual' ? "bg-[#F97316] text-white shadow-lg" : "text-gray-500 hover:text-gray-300"
              )}
            >
              AKIŞ TAKİBİ
            </button>
            <button
              onClick={() => setSelectedTab('calibration')}
              className={cn(
                "px-4 py-1.5 rounded-md text-[10px] font-bold transition-all uppercase tracking-wider",
                selectedTab === 'calibration' ? "bg-[#F97316] text-white shadow-lg" : "text-gray-500 hover:text-gray-300"
              )}
            >
              KALİBRASYON
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 rounded-full border border-orange-500/20">
            <Timer size={14} className="text-orange-500" />
            <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">{timeLeft} DK KALDI</span>
          </div>
          <button 
            onClick={() => setMode(isManual ? 'BEKLEMEDE' : 'MANUEL')}
            className={cn(
              "px-6 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2 shadow-lg",
              isManual ? "bg-orange-600 text-white shadow-orange-500/20" : "bg-gray-800 text-gray-400"
            )}
          >
            <Power size={14} />
            {isManual ? 'MANUEL MOD AKTİF' : 'MANUEL MODA GEÇ'}
          </button>
        </div>
      </div>

      {!isManual ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-gray-800/50 rounded-full flex items-center justify-center mx-auto border-4 border-gray-800 border-dashed animate-spin-slow">
              <AlertCircle className="text-gray-600" size={32} />
            </div>
            <p className="text-gray-500 text-sm font-medium">Lütfen manuel modu aktif hale getirin.</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          {selectedTab === 'visual' ? (
            <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
              <div className="col-span-12 lg:col-span-9 bg-[#151921] border border-[#2D333F] rounded p-4 flex flex-col relative overflow-hidden shadow-inner min-h-[500px]">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[10px] font-bold text-gray-400 border-l-2 border-[#F97316] pl-2 flex items-center tracking-widest uppercase">
                    <Cpu size={12} className="mr-2"/> Manuel Görsel Akış Kontrolü
                  </h2>
                  <div className="px-3 py-1 bg-orange-500/10 rounded border border-orange-500/20 text-[9px] font-bold text-orange-400">
                    CANLI MÜDAHALE AKTİF
                  </div>
                </div>
                
                <div className="flex-1 flex flex-col justify-center items-center relative w-full">
                  {/* Conveyor graphic */}
                  <div className="w-full mt-4 h-48 border-y-4 border-[#374151] bg-[#0D1016]/50 flex items-center justify-between px-16 relative">
                     
                     {/* Input Gate */}
                     <div className="absolute left-10 -bottom-16 flex flex-col items-center z-20">
                        <div className="h-44 w-6 flex items-end overflow-hidden">
                           <motion.div 
                             initial={false}
                             animate={{ y: data.inputGate?.isOpen ? '100%' : '0%' }}
                             transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                             className={cn("w-full h-32 rounded-t-md transition-colors border-2", data.inputGate?.isOpen ? "bg-green-500/80 border-green-400" : "bg-red-500 border-red-700")}
                           />
                        </div>
                        <div className="w-16 h-14 bg-[#1C2029] border-2 border-[#3E4C59] rounded-b-lg flex flex-col items-center justify-center z-10 shadow-xl relative -top-2">
                           <button 
                             onClick={() => operateGate('inputGate', data.inputGate?.isOpen ? 0 : 1)}
                             className="absolute -top-3.5 bg-[#151921] rounded-full p-1 z-20 flex items-center justify-center h-8 w-8 shadow-lg border border-[#374151] hover:scale-110 transition-transform active:scale-95"
                           >
                              <Lock size={14} className={cn(data.inputGate?.isOpen ? "text-green-500 hidden" : "text-red-500")} />
                              <Unlock size={14} className={cn(data.inputGate?.isOpen ? "text-green-500" : "hidden")} />
                           </button>
                           <div className={cn("w-6 h-2 rounded-full mb-1", data.inputGate?.isOpen ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]")} />
                           <div className="text-[9px] text-gray-500 font-bold tracking-wider leading-none uppercase">Giriş</div>
                        </div>
                     </div>
                     
                     {/* Valves */}
                     <div className="absolute left-32 right-32 top-0 flex justify-between px-2 -mt-4 z-10">
                        {[...(data.valves || [])].reverse().map((valve) => (
                           <div key={valve.id} className="flex flex-col items-center w-10">
                              <button 
                                onClick={() => toggleValve(valve.id)}
                                className={cn(
                                 "w-10 h-10 rounded shadow-md border-2 relative transition-colors flex items-center justify-center hover:ring-2 ring-white/20", 
                                 !valve.enabled
                                  ? "bg-red-900/50 border-red-800 text-red-500 opacity-50"
                                  : (valve.isOpen) 
                                    ? "bg-fuchsia-600 border-fuchsia-400 shadow-[0_0_12px_rgba(217,70,239,0.8)] text-white" 
                                    : "bg-[#2D333F] border-[#1F2937] text-gray-500"
                               )}>
                                 <span className="text-[10px] font-bold">{valve.name || valve.id}</span>
                              </button>
                              <div className={cn("w-2.5 h-6 mt-1 rounded-b-sm relative z-20", !valve.enabled ? "bg-red-900/50 opacity-50" : "bg-[#1F2937]")} />
                              <AnimatePresence>
                                {valve.isOpen && (
                                  <motion.div 
                                    initial={{ height: 0, opacity: 1 }}
                                    animate={{ height: 60, opacity: 0 }}
                                    transition={{ repeat: Infinity, duration: 0.5 }}
                                    className="w-1.5 mt-0.5 absolute top-[60px] rounded-full z-10 bg-fuchsia-500 shadow-[0_0_8px_rgba(217,70,239,0.6)]"
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
                             animate={{ y: data.outputGate?.isOpen ? '100%' : '0%' }}
                             transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                             className={cn("w-full h-32 rounded-t-md transition-colors border-2", data.outputGate?.isOpen ? "bg-green-500/80 border-green-400" : "bg-red-500 border-red-700")}
                           />
                        </div>
                        <div className="w-16 h-14 bg-[#1C2029] border-2 border-[#3E4C59] rounded-b-lg flex flex-col items-center justify-center z-10 shadow-xl relative -top-2">
                           <button 
                             onClick={() => operateGate('outputGate', data.outputGate?.isOpen ? 0 : 1)}
                             className="absolute -top-3.5 bg-[#151921] rounded-full p-1 z-20 flex items-center justify-center h-8 w-8 shadow-lg border border-[#374151] hover:scale-110 transition-transform active:scale-95"
                           >
                              <Lock size={14} className={cn(data.outputGate?.isOpen ? "text-green-500 hidden" : "text-red-500")} />
                              <Unlock size={14} className={cn(data.outputGate?.isOpen ? "text-green-500" : "hidden")} />
                           </button>
                           <div className={cn("w-6 h-2 rounded-full mb-1", data.outputGate?.isOpen ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]")} />
                           <div className="text-[9px] text-gray-500 font-bold tracking-wider leading-none uppercase">Çıkış</div>
                        </div>
                     </div>
                  </div>
                </div>
              </div>
              
              <div className="col-span-12 lg:col-span-3 flex flex-col gap-4">
                 <div className="bg-[#151921] border border-[#2D333F] rounded p-4 flex flex-col gap-4 shadow-xl">
                    <div className="flex justify-between items-center p-3 bg-[#0D1016] rounded border border-gray-800">
                       <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-gray-500 uppercase leading-none mb-1">Giriş Adet</span>
                          <button onClick={() => onResetCounter('input', 'reset')} className="p-1 w-fit bg-gray-800 rounded text-orange-500/50 hover:text-orange-500 transition-colors"><RefreshCw size={10} /></button>
                       </div>
                       <div className="flex items-center gap-4">
                          <span className="text-2xl font-mono text-orange-500 font-black">{data.inputCount}</span>
                          <div className="flex flex-col gap-1">
                             <button onClick={() => onResetCounter('input', 'inc')} className="p-1 bg-gray-800 rounded text-gray-400 hover:text-white"><ArrowUp size={10} /></button>
                             <button onClick={() => onResetCounter('input', 'dec')} className="p-1 bg-gray-800 rounded text-gray-400 hover:text-white"><ArrowDown size={10} /></button>
                          </div>
                       </div>
                    </div>
                    
                    <div className="flex justify-between items-center p-3 bg-[#0D1016] rounded border border-gray-800">
                       <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-gray-500 uppercase leading-none mb-1">Çıkış Adet</span>
                          <button onClick={() => onResetCounter('output', 'reset')} className="p-1 w-fit bg-gray-800 rounded text-emerald-500/50 hover:text-emerald-500 transition-colors"><RefreshCw size={10} /></button>
                       </div>
                       <div className="flex items-center gap-4">
                          <span className="text-2xl font-mono text-emerald-500 font-black">{data.outputCount}</span>
                          <div className="flex flex-col gap-1">
                             <button onClick={() => onResetCounter('output', 'inc')} className="p-1 bg-gray-800 rounded text-gray-400 hover:text-white"><ArrowUp size={10} /></button>
                             <button onClick={() => onResetCounter('output', 'dec')} className="p-1 bg-gray-800 rounded text-gray-400 hover:text-white"><ArrowDown size={10} /></button>
                          </div>
                       </div>
                    </div>
                 </div>
                 
                 <div className="flex-1 bg-orange-950/10 border border-orange-500/10 rounded p-4 flex flex-col">
                    <div className="flex items-center gap-2 mb-4">
                       <AlertCircle size={16} className="text-orange-500" />
                       <h3 className="text-[10px] font-bold text-gray-300 uppercase">Güvenlik Uyarısı</h3>
                    </div>
                    <p className="text-[10px] text-orange-400/80 italic leading-relaxed">
                       Manuel modda tüm donanım limitleri (lazer sensörler, kilit mevcudiyeti vb.) devre dışıdır. Hareketlerden operatör sorumludur.
                    </p>
                 </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6 flex-1">
              {/* Calibration Content Area */}
              <div className="grid grid-cols-12 gap-6 p-6 bg-[#0D1117] rounded-xl border border-gray-800 shadow-2xl flex-1">
                <div className="col-span-12 lg:col-span-8 space-y-6">
                  
                  {calSubTab === 'valves' && (
                    <div className="bg-[#161B22] p-6 rounded-lg border border-gray-700 animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex items-center gap-3 mb-6 border-b border-gray-800 pb-4">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                          <Activity className="text-blue-500" size={20} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white uppercase tracking-tight">Hassas Valf Kalibrasyonu</h3>
                          <p className="text-[10px] text-gray-500">Seçili vana üzerinde dolum sürelerini (ms) optimize edin.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <label className="block text-[10px] font-bold text-gray-400 uppercase">1. Reçete Seçimi</label>
                          <select 
                            value={selectedRecipeId}
                            onChange={(e) => setSelectedRecipeId(e.target.value)}
                            className="w-full bg-[#0D1117] border border-gray-600 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none"
                          >
                            {(data.recipes || []).map(r => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-4">
                          <label className="block text-[10px] font-bold text-gray-400 uppercase">2. Test Edilecek Vana</label>
                          <select 
                            value={selectedValveId || ''}
                            onChange={(e) => setSelectedValveId(Number(e.target.value))}
                            className="w-full bg-[#0D1117] border border-gray-600 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none"
                          >
                            {(data.valves || []).filter(v => v.enabled).map(v => (
                              <option key={v.id} value={v.id}>
                                {v.name || `Vana (Pin ${v.id})`}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="mt-8 pt-8 border-t border-gray-800">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                            <div className="space-y-4">
                              <label className="block text-[10px] font-bold text-gray-400 uppercase">3. Test Süresi (Milisaniye)</label>
                              <div className="flex flex-wrap gap-2 mb-3">
                                {[500, 1000, 1500, 2000, 3000].map(ms => (
                                  <button 
                                    key={ms}
                                    onClick={() => setTestDuration(ms)}
                                    className={cn(
                                      "px-2 py-1 rounded text-[9px] font-bold transition-all border",
                                      testDuration === ms ? "bg-blue-600 border-blue-400 text-white" : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500"
                                    )}
                                  >
                                    {ms}ms
                                  </button>
                                ))}
                              </div>
                              <div className="relative">
                                <input 
                                  type="number"
                                  value={testDuration}
                                  onChange={(e) => setTestDuration(Number(e.target.value))}
                                  className="w-full bg-[#0D1117] border border-gray-600 rounded-lg p-4 text-2xl font-mono text-blue-400 focus:border-blue-500 outline-none"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 font-bold">MS</span>
                              </div>
                            </div>
                            
                            <div className="flex gap-3 h-[64px]">
                              <button 
                                disabled={!selectedValveId}
                                onClick={() => selectedValveId && testValvePulse(selectedValveId, testDuration)}
                                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-bold rounded-lg shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-3 active:scale-95"
                              >
                                <Play size={20} />
                                TESTİ BAŞLAT
                              </button>
                              
                              <button 
                                disabled={!selectedRecipeId || testDuration === selectedRecipe?.fillTimeMs}
                                onClick={() => {
                                  if (selectedRecipeId) {
                                    onUpdateRecipe(selectedRecipeId, { fillTimeMs: testDuration });
                                  }
                                }}
                                className="px-6 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800/50 disabled:text-gray-600 text-white font-bold rounded-lg shadow-lg shadow-emerald-500/10 transition-all flex items-center justify-center gap-2 active:scale-95 border border-emerald-500/20"
                              >
                                <RefreshCw size={18} />
                                REÇETEYİ GÜNCELLE
                              </button>
                            </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {calSubTab === 'gates' && (
                    <div className="bg-[#161B22] p-6 rounded-lg border border-gray-700 animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex items-center gap-3 mb-6 border-b border-gray-800 pb-4">
                        <div className="p-2 bg-orange-500/10 rounded-lg">
                          <ArrowDownUp className="text-orange-500" size={20} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white uppercase tracking-tight">Kapı Kalibrasyon Merkezi</h3>
                          <p className="text-[10px] text-gray-500">Step motor adım sayılarını ve yönlerini belirleyin.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-8">
                         <div className="space-y-4">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase">1. Hedef Kapı</label>
                            <div className="flex gap-2">
                               <button 
                                  onClick={() => setGateCal(prev => ({ ...prev, target: 'inputGate' }))}
                                  className={cn("flex-1 p-3 rounded-lg border text-xs font-bold transition-all", gateCal.target === 'inputGate' ? "bg-orange-500/20 border-orange-500 text-orange-500" : "bg-gray-800 border-gray-700 text-gray-500")}
                               >
                                  GİRİŞ KAPISI
                               </button>
                               <button 
                                  onClick={() => setGateCal(prev => ({ ...prev, target: 'outputGate' }))}
                                  className={cn("flex-1 p-3 rounded-lg border text-xs font-bold transition-all", gateCal.target === 'outputGate' ? "bg-orange-500/20 border-orange-500 text-orange-500" : "bg-gray-800 border-gray-700 text-gray-500")}
                               >
                                  ÇIKIŞ KAPISI
                               </button>
                            </div>
                         </div>
                         
                         <div className="space-y-4">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase">2. Kalibrasyon Adımı</label>
                            <input 
                              type="number"
                              value={gateCal.steps}
                              onChange={(e) => setGateCal(prev => ({ ...prev, steps: Number(e.target.value) }))}
                              className="w-full bg-[#0D1117] border border-gray-600 rounded-lg p-3 text-sm text-white outline-none"
                            />
                         </div>
                      </div>

                      <div className="mt-8 pt-8 border-t border-gray-800 grid grid-cols-2 gap-8">
                         <div className="space-y-4">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase">3. Manuel Hareket Testi</label>
                            <div className="grid grid-cols-2 gap-3">
                               <button 
                                  onClick={() => operateGate(gateCal.target, -gateCal.steps)}
                                  className="p-4 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-bold text-xs flex flex-col items-center gap-2 border border-gray-700 active:scale-95 transition-all"
                               >
                                  <ArrowUp size={16} />
                                  KAPIYI KAPAT
                               </button>
                               <button 
                                  onClick={() => operateGate(gateCal.target, gateCal.steps)}
                                  className="p-4 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-bold text-xs flex flex-col items-center gap-2 border border-gray-700 active:scale-95 transition-all"
                               >
                                  <ArrowDown size={16} />
                                  KAPIYI AÇ
                               </button>
                            </div>
                         </div>

                         <div className="flex items-end pb-1">
                            <button 
                               onClick={() => {
                                  const currentGate = data[gateCal.target];
                                  onUpdateSystemGate(gateCal.target, { ...currentGate, position: gateCal.steps });
                               }}
                               className="w-full h-[58px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
                            >
                               <RefreshCw size={18} />
                               ADIM SAYISINI KAYDET
                            </button>
                         </div>
                      </div>
                    </div>
                  )}

                  {calSubTab === 'sensors' && (
                    <div className="bg-[#161B22] p-6 rounded-lg border border-gray-700 animate-in fade-in slide-in-from-bottom-2">
                       <div className="flex items-center gap-3 mb-6 border-b border-gray-800 pb-4">
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                          <Eye className="text-emerald-500" size={20} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white uppercase tracking-tight">Sensör Hassasiyet Ayarı</h3>
                          <p className="text-[10px] text-gray-500">Lazer sensörlerin okuma gecikmelerini (Debounce) optimize edin.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-8">
                         <div className="space-y-4">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase">1. Sensör Seçimi</label>
                            <select 
                               value={sensorCal.id}
                               onChange={(e) => setSensorCal(prev => ({ ...prev, id: e.target.value }))}
                               className="w-full bg-[#0D1117] border border-gray-600 rounded-lg p-3 text-sm text-white outline-none"
                            >
                               {data.sensors.map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                               ))}
                            </select>
                         </div>
                         
                         <div className="space-y-4">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase">2. Gecikme Süresi (Debounce)</label>
                            <div className="relative">
                               <input 
                                 type="number"
                                 value={sensorCal.debounce}
                                 onChange={(e) => setSensorCal(prev => ({ ...prev, debounce: Number(e.target.value) }))}
                                 className="w-full bg-[#0D1117] border border-gray-600 rounded-lg p-3 text-sm text-white outline-none"
                               />
                               <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 font-bold text-[10px]">MS</span>
                            </div>
                         </div>
                      </div>

                      <div className="mt-8 pt-8 border-t border-gray-800 flex justify-end">
                         <button 
                            onClick={() => onUpdateSensor(sensorCal.id, { debounce: sensorCal.debounce })}
                            className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
                         >
                            <RefreshCw size={18} />
                            HASSASİYETİ KAYDET
                         </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Side Info Panel */}
                <div className="col-span-12 lg:col-span-4 space-y-4">
                  <div className="bg-[#161B22] p-5 rounded-lg border border-gray-700">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
                      <Target size={12} className="text-orange-500" /> Kalibrasyon Kılavuzu
                    </h4>
                    
                    {calSubTab === 'valves' && (
                      <div className="space-y-3 animate-in fade-in">
                        <p className="text-[9px] text-gray-400 leading-relaxed italic">1000ms dolum yapıp tartın. Eğer 250ml olması gereken şişede 240ml varsa süreyi %4 artırın.</p>
                      </div>
                    )}
                    
                    {calSubTab === 'gates' && (
                      <div className="space-y-3 animate-in fade-in">
                        <p className="text-[9px] text-gray-400 leading-relaxed italic">Kapıyı önce manuel butonlarla tam açık pozisyona getirin. Adım sayısını not edip "Kaydet" deyin.</p>
                      </div>
                    )}

                    {calSubTab === 'sensors' && (
                      <div className="space-y-3 animate-in fade-in">
                        <p className="text-[9px] text-gray-400 leading-relaxed italic">Şişeler çok hızlı geçiyorsa debounce süresini düşürün (örn: 50ms). Eğer tek şişeyi 2 kere sayıyorsa artırın.</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-lg">
                    <div className="text-[10px] font-bold text-blue-400 mb-2 uppercase tracking-widest">Sistem Notu</div>
                    <p className="text-[9px] text-blue-300/60 leading-relaxed">
                      Kalibrasyon sırasında makineyi manuel modda tutun. Yapılan tüm değişiklikler anında veritabanına işlenir.
                    </p>
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

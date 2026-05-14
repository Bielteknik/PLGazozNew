import React, { useState, useEffect } from 'react';
import { 
  Play, Square, Droplet, Lock, Unlock, Target, RefreshCw, 
  ChevronRight, CheckCircle2, AlertCircle, Layers, Settings2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { SystemData, SystemMode } from '../../types/system';

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

type Step = 'IDLE' | 'ENTRY' | 'FILLING' | 'EXIT' | 'COMPLETE';

export const OperatorControl: React.FC<OperatorControlProps> = ({ 
  data, setMode, onStartAutoCycle, operateGate, toggleValve, 
  testValvePulse, resetCounter, onSelectRecipe 
}) => {
  const [activeStep, setActiveStep] = useState<Step>('IDLE');
  const [selectedValves, setSelectedValves] = useState<number[]>([]);
  const [isFilling, setIsFilling] = useState(false);

  const activeRecipe = data?.recipes?.find(r => r.id === data?.config?.recipeId) || data?.recipes?.[0];
  const targetCount = activeRecipe?.targetCount || 0;
  const fillTime = activeRecipe?.fillTimeMs || 3000;

  // Initialize selected valves
  useEffect(() => {
    if (data.valves && selectedValves.length === 0) {
      setSelectedValves(data.valves.filter(v => v.enabled).map(v => v.id));
    }
  }, [data.valves]);

  // Logic for automatic gate closing in ENTRY step
  useEffect(() => {
    if (activeStep === 'ENTRY' && data.inputCount >= targetCount && data.inputGate.isOpen) {
      operateGate('inputGate', 0);
      setActiveStep('FILLING');
    }
  }, [data.inputCount, targetCount, activeStep, data.inputGate.isOpen]);

  // Logic for EXIT step completion
  useEffect(() => {
    if (activeStep === 'EXIT' && data.outputCount >= data.inputCount && data.outputGate.isOpen && data.inputCount > 0) {
      operateGate('outputGate', 0);
      setActiveStep('COMPLETE');
    }
  }, [data.outputCount, data.inputCount, activeStep, data.outputGate.isOpen]);

  const handleStartEntry = () => {
    resetCounter('input', 'reset');
    resetCounter('output', 'reset');
    operateGate('inputGate', 400);
    setActiveStep('ENTRY');
  };

  const handleStartFilling = async () => {
    setIsFilling(true);
    // Open selected valves
    selectedValves.forEach(id => toggleValve(id));
    
    // Wait for fill time
    setTimeout(() => {
      // Close all valves
      data.valves.forEach(v => {
        if (v.isOpen) toggleValve(v.id);
      });
      setIsFilling(false);
      setActiveStep('EXIT');
    }, fillTime);
  };

  const handleStartExit = () => {
    operateGate('outputGate', 400);
    setActiveStep('EXIT');
  };

  const toggleValveSelection = (id: number) => {
    setSelectedValves(prev => 
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex flex-col h-full space-y-4 overflow-hidden">
      {/* Header Panel */}
      <div className="bg-[#151921] border border-[#374151] p-4 rounded shadow-2xl flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
            <Layers className="text-blue-400" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tighter uppercase italic">Operatör Dolum Modu</h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Reçete Güdümlü Yarı-Otomatik Kontrol</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[9px] text-gray-500 font-black uppercase">Aktif Reçete</span>
            <span className="text-sm font-bold text-blue-400 font-mono">{activeRecipe?.name}</span>
          </div>
          <div className="h-10 w-px bg-gray-800" />
          <div className="flex flex-col items-end">
            <span className="text-[9px] text-gray-500 font-black uppercase">Hedef Şişe</span>
            <span className="text-sm font-bold text-orange-400 font-mono">{targetCount} ADET</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        {/* Left Column: Process Steps */}
        <div className="col-span-12 lg:col-span-8 flex flex-col space-y-4 overflow-y-auto pr-1 custom-scrollbar">
          
          {/* Step 1: Entry Control */}
          <StepCard 
            title="ADIM 1: Şişe Girişi ve Sayım"
            isActive={activeStep === 'ENTRY' || activeStep === 'IDLE'}
            isCompleted={activeStep === 'FILLING' || activeStep === 'EXIT' || activeStep === 'COMPLETE'}
            icon={<Target size={20} />}
          >
            <div className="flex items-center justify-between">
              <div className="flex gap-4">
                <div className="bg-black/30 p-4 rounded-2xl border border-gray-800 text-center w-32">
                  <div className="text-[10px] text-gray-500 font-bold mb-1 uppercase">Mevcut</div>
                  <div className="text-4xl font-mono font-black text-orange-500">{data.inputCount}</div>
                </div>
                <div className="flex items-center text-gray-600">
                  <ChevronRight size={24} />
                </div>
                <div className="bg-blue-500/5 p-4 rounded-2xl border border-blue-500/20 text-center w-32">
                  <div className="text-[10px] text-blue-500/50 font-bold mb-1 uppercase">Hedef</div>
                  <div className="text-4xl font-mono font-black text-blue-400">{targetCount}</div>
                </div>
              </div>

              {activeStep === 'IDLE' && (
                <button 
                  onClick={handleStartEntry}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-2xl font-black text-sm flex items-center gap-3 transition-all active:scale-95 shadow-lg shadow-emerald-900/20"
                >
                  <Play size={18} fill="currentColor" /> GİRİŞİ BAŞLAT
                </button>
              )}

              {activeStep === 'ENTRY' && (
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2 text-emerald-500 animate-pulse">
                    <RefreshCw size={14} className="animate-spin" />
                    <span className="text-xs font-bold uppercase tracking-widest">Şişe Bekleniyor...</span>
                  </div>
                  <button 
                    onClick={() => { operateGate('inputGate', 0); setActiveStep('FILLING'); }}
                    className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-xl font-bold text-[11px] transition-all"
                  >
                    KAPIYI ZORLA KAPAT
                  </button>
                </div>
              )}
            </div>
          </StepCard>

          {/* Step 2: Filling Control */}
          <StepCard 
            title="ADIM 2: Dolum Kontrolü"
            isActive={activeStep === 'FILLING'}
            isCompleted={activeStep === 'EXIT' || activeStep === 'COMPLETE'}
            icon={<Droplet size={20} />}
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings2 size={14} className="text-gray-500" />
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Aktif Valf Seçimi</span>
                </div>
                <div className="text-[10px] font-mono text-blue-400 font-bold">{fillTime}ms Otomatik Süre</div>
              </div>

              <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
                {data.valves.map((v, i) => (
                  <button
                    key={v.id}
                    disabled={!v.enabled || isFilling}
                    onClick={() => toggleValveSelection(v.id)}
                    className={cn(
                      "aspect-square rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all relative overflow-hidden",
                      !v.enabled ? "bg-red-950/20 border-red-900/30 text-red-900 cursor-not-allowed" :
                      selectedValves.includes(v.id) 
                        ? "bg-blue-600 border-blue-400 text-white shadow-lg" 
                        : "bg-black/20 border-gray-800 text-gray-600 hover:border-gray-700"
                    )}
                  >
                    <span className="text-xs font-black">{i + 1}</span>
                    {selectedValves.includes(v.id) && v.enabled && <div className="absolute bottom-1 w-1 h-1 bg-white rounded-full animate-ping" />}
                  </button>
                ))}
              </div>

              <div className="flex justify-center pt-4">
                <button 
                  disabled={activeStep !== 'FILLING' || isFilling || selectedValves.length === 0}
                  onClick={handleStartFilling}
                  className={cn(
                    "w-full max-w-sm py-5 rounded-2xl font-black text-xl flex items-center justify-center gap-4 transition-all shadow-2xl relative overflow-hidden",
                    isFilling 
                      ? "bg-blue-600 text-white cursor-wait" 
                      : "bg-blue-900/40 border-2 border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {isFilling ? (
                    <>
                      <RefreshCw size={24} className="animate-spin" />
                      DOLUM YAPILIYOR...
                      <motion.div 
                        initial={{ x: '-100%' }}
                        animate={{ x: '100%' }}
                        transition={{ duration: fillTime / 1000, ease: "linear" }}
                        className="absolute bottom-0 left-0 h-1 bg-white/30 w-full"
                      />
                    </>
                  ) : (
                    <>
                      <Droplet size={24} /> {selectedValves.length === data.valves.length ? 'TOPLU DOLUM BAŞLAT' : 'SEÇİLİ VALFLERİ AÇ'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </StepCard>

          {/* Step 3: Exit Control */}
          <StepCard 
            title="ADIM 3: Şişe Çıkışı"
            isActive={activeStep === 'EXIT'}
            isCompleted={activeStep === 'COMPLETE'}
            icon={<RefreshCw size={20} />}
          >
            <div className="flex items-center justify-between">
              <div className="flex gap-4">
                <div className="bg-black/30 p-4 rounded-2xl border border-gray-800 text-center w-32">
                  <div className="text-[10px] text-gray-500 font-bold mb-1 uppercase">Beklenen</div>
                  <div className="text-4xl font-mono font-black text-blue-400">{data.inputCount}</div>
                </div>
                <div className="flex items-center text-gray-600">
                  <ChevronRight size={24} />
                </div>
                <div className="bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/20 text-center w-32">
                  <div className="text-[10px] text-emerald-500/50 font-bold mb-1 uppercase">Çıkan</div>
                  <div className="text-4xl font-mono font-black text-emerald-500">{data.outputCount}</div>
                </div>
              </div>

              {activeStep === 'FILLING' || (activeStep === 'EXIT' && !data.outputGate.isOpen) ? (
                <button 
                  disabled={activeStep === 'COMPLETE'}
                  onClick={handleStartExit}
                  className="bg-orange-600 hover:bg-orange-500 text-white px-8 py-4 rounded-2xl font-black text-sm flex items-center gap-3 transition-all active:scale-95 shadow-lg shadow-orange-900/20"
                >
                  <Unlock size={18} /> ÇIKIŞI BAŞLAT
                </button>
              ) : activeStep === 'EXIT' && data.outputGate.isOpen ? (
                <div className="flex items-center gap-3 text-orange-500 font-black animate-pulse">
                  <RefreshCw size={18} className="animate-spin" />
                  TAHLİYE OLUYOR...
                </div>
              ) : null}
            </div>
          </StepCard>

          {activeStep === 'COMPLETE' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-emerald-500/10 border-2 border-emerald-500/30 rounded-3xl p-8 text-center space-y-4"
            >
              <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="text-white" size={32} />
              </div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">Döngü Başarıyla Tamamlandı</h3>
              <p className="text-gray-400 text-sm max-w-md mx-auto">Tüm şişeler sayıldı ve dolum yapıldı. Yeni bir döngü için sistemi sıfırlayabilirsiniz.</p>
              <button 
                onClick={() => setActiveStep('IDLE')}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-12 py-4 rounded-2xl font-black text-lg transition-all active:scale-95 mt-4"
              >
                YENİ DÖNGÜYE BAŞLA
              </button>
            </motion.div>
          )}

        </div>

        {/* Right Column: Visualizer & Info */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          <div className="bg-[#151921] border border-[#2D333F] rounded-2xl p-4 flex flex-col h-full overflow-hidden">
             <div className="flex items-center gap-2 mb-4 border-b border-gray-800 pb-2">
                <AlertCircle size={14} className="text-blue-500" />
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Süreç Bilgilendirme</h3>
             </div>

             <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar">
                <InfoItem 
                   label="Mod Durumu" 
                   value={activeStep} 
                   color={activeStep === 'IDLE' ? 'text-gray-500' : 'text-blue-400'} 
                />
                <InfoItem 
                   label="Giriş Kapısı" 
                   value={data.inputGate.isOpen ? 'AÇIK' : 'KAPALI'} 
                   color={data.inputGate.isOpen ? 'text-emerald-500' : 'text-red-500'} 
                />
                <InfoItem 
                   label="Çıkış Kapısı" 
                   value={data.outputGate.isOpen ? 'AÇIK' : 'KAPALI'} 
                   color={data.outputGate.isOpen ? 'text-emerald-500' : 'text-red-500'} 
                />
                
                <div className="mt-8 p-4 bg-orange-500/5 border border-orange-500/10 rounded-2xl space-y-3">
                   <h4 className="text-[10px] font-black text-orange-500 uppercase tracking-widest flex items-center gap-2">
                      <Lock size={12} /> Güvenlik Protokolü
                   </h4>
                   <ul className="text-[10px] text-gray-500 space-y-2 list-disc pl-4 italic">
                      <li>Giriş kapısı hedef sayıya ulaştığında otomatik kapanır.</li>
                      <li>Dolum sırasında tüm kapılar kilitli tutulur.</li>
                      <li>Çıkış kapısı şişeler tam tahliye olana kadar açık kalır.</li>
                   </ul>
                </div>
             </div>

             <div className="mt-auto pt-4 border-t border-gray-800">
                <button 
                  onClick={() => setMode('BEKLEMEDE')}
                  className="w-full py-4 bg-red-900/20 border border-red-500/30 text-red-500 rounded-xl font-bold text-[11px] hover:bg-red-500 hover:text-white transition-all active:scale-95"
                >
                  OPERATÖR MODUNDAN ÇIK
                </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper Components
const StepCard: React.FC<{ 
  title: string; 
  isActive: boolean; 
  isCompleted: boolean; 
  icon: React.ReactNode; 
  children: React.ReactNode 
}> = ({ title, isActive, isCompleted, icon, children }) => (
  <div className={cn(
    "bg-[#151921] border transition-all duration-500 rounded-3xl p-6 relative overflow-hidden",
    isActive ? "border-blue-500/50 shadow-lg shadow-blue-500/5" : "border-[#2D333F] opacity-50 grayscale",
    isCompleted && "border-emerald-500/50 opacity-100 grayscale-0"
  )}>
    {isCompleted && (
      <div className="absolute top-0 right-0 p-4">
        <CheckCircle2 className="text-emerald-500" size={24} />
      </div>
    )}
    <div className="flex items-center gap-3 mb-6">
      <div className={cn(
        "p-2 rounded-xl border",
        isActive ? "bg-blue-500/10 border-blue-500/20 text-blue-400" : 
        isCompleted ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-gray-800 border-gray-700 text-gray-600"
      )}>
        {icon}
      </div>
      <h3 className={cn(
        "text-sm font-black uppercase tracking-tight italic",
        isActive ? "text-white" : isCompleted ? "text-emerald-500" : "text-gray-600"
      )}>
        {title}
      </h3>
    </div>
    {children}
  </div>
);

const InfoItem: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <div className="flex justify-between items-center py-2 border-b border-gray-800/50">
    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{label}</span>
    <span className={cn("text-[11px] font-mono font-bold", color || "text-white")}>{value}</span>
  </div>
);

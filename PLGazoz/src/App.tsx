import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Power, AlertOctagon } from 'lucide-react';
import { Sidebar } from './components/layout/Sidebar';
import { Dashboard } from './components/views/Dashboard';
import { OperatorPanel } from './components/views/OperatorPanel';
import { History } from './components/views/History';
import { Settings } from './components/views/Settings';
import { useSystemSimulator } from './hooks/useSystemSimulator';

export default function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  
  const {
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
    resetCounter,
    adjustCounter,
    selectRecipe,
    updateRecipe,
    addRecipe,
    removeRecipe,
    answerPrompt,
    requestStopAfterCycle,
    stopWashing,
    updateDeviceConfig
  } = useSystemSimulator();

  // Onay penceresi state'leri ve operasyon yardımcıları
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {}
  });

  const requestConfirmation = (title: string, description: string, onConfirm: () => void) => {
    setConfirmModal({
      isOpen: true,
      title,
      description,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(p => ({ ...p, isOpen: false }));
      }
    });
  };

  const activeRecipe = data.recipes.find(r => r.id === data.config.recipeId);

  // Sarmalanmış Güvenli Geri Çağırma Fonksiyonları
  const isCycleActive = (data.mode === 'OTOMATİK' && data.autoState !== 'BEKLEMEDE') || data.mode === 'YIKAMA';

  const handleStartProduction = () => {
    if (!isCycleActive) {
      startAutoCycle();
    } else {
      requestConfirmation(
        "ÜRETİM BAŞLATMA ONAYI",
        `Şu an seçili olan reçete ile ("${activeRecipe?.name || 'Varsayılan'}") otomatik üretimi başlatmak istiyorsunuz. Konveyör ve kapı hizalama sekansı devreye girecektir. Devam etmek istiyor musunuz?`,
        startAutoCycle
      );
    }
  };

  const handleStartWashing = () => {
    if (!isCycleActive) {
      setMode('YIKAMA');
    } else {
      requestConfirmation(
        "TEMİZLEME / YIKAMA BAŞLATMA ONAYI",
        "Sistemi Yıkama Moduna geçirmek ve valf durulama sekansını başlatmak istiyorsunuz. Bu işlem devam ederken acil durdurma hariç diğer işlemler kilitlenecektir. Emin misiniz?",
        () => setMode('YIKAMA')
      );
    }
  };

  const handleResetCounter = (type: 'input' | 'output') => {
    if (!isCycleActive) {
      resetCounter(type);
    } else {
      requestConfirmation(
        "SAYAÇ SIFIRLAMA ONAYI",
        `${type === 'input' ? 'Giriş' : 'Çıkış'} şişe miktarı sayacı sıfırlanacaktır. Bu işlem birikmiş verilerinizi temizler. Emin misiniz?`,
        () => resetCounter(type)
      );
    }
  };

  const handleSelectRecipe = (id: string) => {
    const target = data.recipes.find(r => r.id === id);
    if (!isCycleActive) {
      selectRecipe(id);
    } else {
      requestConfirmation(
        "REÇETE SEÇİM ONAYI",
        `Aktif dolum reçetesini "${target?.name || id}" olarak değiştirmek istiyorsunuz. Reçete değiştiğinde sistem temizliği için Yıkama Döngüsü zorunlu kılınacaktır. Onaylıyor musunuz?`,
        () => selectRecipe(id)
      );
    }
  };

  const handleSetMode = (newMode: 'OTOMATİK' | 'MANUEL' | 'YIKAMA') => {
    const fromMode = data.mode;
    if (!isCycleActive) {
      setMode(newMode);
    } else {
      if (newMode === 'OTOMATİK') {
        requestConfirmation(
          "OTOMATİK MODA GEÇİŞ ONAYI",
          `Sistemi ${fromMode} modundan OTOMATİK kontrol moduna almak istiyorsunuz. Sistem tüm sensör girdilerini ve sekansı otomatik olarak yönetecektir. Emin misiniz?`,
          () => setMode('OTOMATİK')
        );
      } else if (newMode === 'MANUEL') {
        requestConfirmation(
          "MANUEL MODA GEÇİŞ ONAYI",
          `Sistemi OTOMATİK moddan MANUEL (Canlı Operatör Müdahale) kontrol moduna almak istiyorsunuz. Güvenlik önlemlerine dikkat ediniz. Emin misiniz?`,
          () => setMode('MANUEL')
        );
      } else {
        setMode(newMode);
      }
    }
  };

  return (
    <div className="flex h-screen bg-[#0B0D11] text-[#E0E0E0] overflow-hidden font-sans border-4 border-[#1F2937]">
      <Sidebar 
        currentTab={currentTab} 
        onChangeTab={setCurrentTab}
        data={data}
      />
      
      <main className="flex-1 p-3 h-full overflow-hidden bg-[#0a0f18] flex flex-col relative">
        {/* Global Security / Startup Status Alert Banner */}
        {data.mode === 'BASLATMA' && (
          <div className="bg-[#1c1404] border border-[#a16207]/40 rounded p-2.5 mb-3 flex items-center justify-between shrink-0 shadow-lg animate-fade-in font-sans">
            <div className="flex items-center space-x-3">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)] shrink-0" />
              <div>
                <h4 className="text-[11px] font-black text-amber-500 tracking-wider uppercase flex items-center">
                  <Power size={13} className="mr-1.5" /> SİSTEM ETKİNLEŞTİRME KİLİDİ AKTİF
                </h4>
                <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                  Tüm mikrodenetleyiciler ve sensörler başarıyla test edildi. Üretime başlamak için operatör onayı bekleniyor.
                </p>
              </div>
            </div>
            <button
              onClick={acknowledgeStartup}
              className="bg-amber-600 hover:bg-amber-500 text-black font-black text-[10px] px-3.5 py-1 rounded shadow-md transition-all active:scale-95 cursor-pointer font-mono"
            >
              SİSTEMİ ONAYLA VE AKTİF ET
            </button>
          </div>
        )}

        {data.mode === 'ARIZA' && (
          <div className="bg-[#1a0505] border border-[#b91c1c]/40 rounded p-2.5 mb-3 flex items-center justify-between shrink-0 shadow-lg animate-bounce-subtle font-sans">
            <div className="flex items-center space-x-3">
              <div className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping shadow-[0_0_8px_rgba(239,68,68,0.7)] shrink-0" />
              <div>
                <h4 className="text-[11px] font-black text-red-500 tracking-wider uppercase flex items-center">
                  <AlertOctagon size={13} className="mr-1.5" /> ACİL DURDURMA / SİSTEM ARIZASI ALGILANDI
                </h4>
                <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                  Sistem güvenli duruşa geçti. Hat temizlendikten sonra devam etmek için arıza kaydını resetleyin.
                </p>
              </div>
            </div>
            <button
              onClick={acknowledgeFault}
              className="bg-red-600 hover:bg-red-500 text-white font-black text-[10px] px-3.5 py-1 rounded shadow-md transition-all active:scale-95 cursor-pointer font-mono"
            >
              ARIZAYI ONAYLA VE ADIMLARI SIFIRLA
            </button>
          </div>
        )}

        {currentTab === 'dashboard' && (
          <Dashboard 
            data={data} 
            onStart={handleStartProduction} 
            onStop={() => setMode('ARIZA')} 
            onStopAfterCycle={requestStopAfterCycle}
            onStartWashing={handleStartWashing}
            onStopWashing={stopWashing}
            onResetCounter={handleResetCounter}
            onSelectRecipe={handleSelectRecipe}
            onAnswerPrompt={answerPrompt}
            onRefillSyrup={refillSyrupTank}
          />
        )}
        {currentTab === 'operator' && (
          <OperatorPanel 
             data={data}
             toggleValve={toggleValve}
             onUpdateValve={updateValve}
             operateGate={operateGate}
             onResetCounter={handleResetCounter}
             onSelectRecipe={handleSelectRecipe}
             onAdjustCounter={adjustCounter}
          />
        )}
        {currentTab === 'history' && (
          <History data={data} />
        )}
        {currentTab === 'settings' && (
          <Settings 
             data={data}
             onUpdateConfig={updateConfig}
             onUpdateRecipe={updateRecipe}
             onAddRecipe={addRecipe}
             onRemoveRecipe={removeRecipe}
             onSelectRecipe={handleSelectRecipe}
             onUpdateValve={updateValve}
             onUpdateSensor={updateSensor}
             onUpdateGate={updateGate}
             onUpdateSystemGate={updateSystemGate}
             onUpdateDeviceConfig={updateDeviceConfig}
          />
        )}
      </main>

      {/* Onay penceresi (Operational Confirmation Modal Dialog) */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-sans">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0D1016] border-2 border-orange-500 rounded-lg p-5 max-w-sm w-full shadow-[0_0_30px_rgba(249,115,22,0.15)] space-y-4"
            >
              <div className="flex items-center gap-2 border-b border-orange-500/10 pb-2.5 text-orange-400">
                <AlertTriangle size={16} />
                <span className="text-[10px] font-black tracking-widest uppercase">{confirmModal.title}</span>
              </div>
              
              <p className="text-[10.5px] text-gray-300 font-bold leading-relaxed bg-[#151921]/70 p-3 rounded border border-gray-800/40">
                {confirmModal.description}
              </p>
              
              <div className="flex items-center justify-end gap-2 pt-1 font-mono">
                <button
                  type="button"
                  onClick={() => setConfirmModal(p => ({ ...p, isOpen: false }))}
                  className="bg-[#151921] border border-[#2D333F] font-bold text-gray-400 hover:text-white px-3.5 py-1 rounded text-[9px] transition-all cursor-pointer"
                >
                  İPTAL
                </button>
                <button
                  type="button"
                  onClick={confirmModal.onConfirm}
                  className="bg-orange-500 hover:bg-orange-600 border border-orange-400 font-black text-black px-4 py-1 rounded text-[9px] shadow-lg shadow-orange-500/10 transition-all cursor-pointer"
                >
                  İŞLEMİ ONAYLA
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

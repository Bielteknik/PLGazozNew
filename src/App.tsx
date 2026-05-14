import { useState } from 'react';
import { RefreshCw, Power } from 'lucide-react';
import { Sidebar } from './components/layout/Sidebar';
import { Dashboard } from './components/views/Dashboard';
import { ManualControl } from './components/views/ManualControl';
import { History } from './components/views/History';
import { Diagnostics } from './components/views/Diagnostics';
import { Settings } from './components/views/Settings';
import { Hardware } from './components/views/Hardware';
import { OperatorControl } from './components/views/OperatorControl';
import { useSocketState } from './hooks/useSocketState';

export default function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  
  const {
    socket,
    data,
    setMode,
    startAutoCycle,
    acknowledgeStartup,
    acknowledgeFault,
    toggleValve,
    setValveMode,
    setValvePulseDuration,
    operateGate,
    toggleGateEnabled,
    triggerFault,
    updateConfig,
    addHardware,
    removeHardware,
    toggleHardwareStatus,
    sendNanoCommand,
    updateNanoConfig,
    updateValve,
    updateSensor,
    updateGate,
    updateSystemGate,
    toggleSensorEnabled,
    addSensor,
    removeSensor,
    addGate,
    removeGate,
    toggleExtraGateEnabled,
    operateExtraGate,
    addNano,
    removeNano,
    resetCounter,
    testValvePulse,
    stopWashing,
    selectRecipe,
    updateRecipe,
    addRecipe,
    removeRecipe,
    answerPrompt,
    requestStopAfterCycle,
    startFlush,
    stopFlush,
    manualLogin,
    manualLogout,
    manualToken,
    manualExpires
  } = useSocketState();

  return (
    <div className="flex h-screen bg-[#0B0D11] text-[#E0E0E0] overflow-hidden font-sans border-4 border-[#1F2937]">
      <Sidebar 
        currentTab={currentTab} 
        onChangeTab={setCurrentTab}
        data={data}
        onLogout={manualLogout}
      />
      
      <main className="flex-1 p-3 h-full overflow-hidden bg-[#0a0f18] flex flex-col">
        {currentTab === 'dashboard' && (
          <Dashboard 
            data={data} 
            onStart={startAutoCycle} 
            onStop={() => setMode('ARIZA')} 
            onStopAfterCycle={requestStopAfterCycle}
            onStartWashing={() => setMode('YIKAMA')}
            onStopWashing={stopWashing}
            onResetCounter={resetCounter}
            onSelectRecipe={selectRecipe}
            onAnswerPrompt={answerPrompt}
            onStartFlush={startFlush}
            onStopFlush={stopFlush}
            onToggleHardwareStatus={toggleHardwareStatus}
          />
        )}
        {currentTab === 'operator' && (
          <OperatorControl 
             data={data}
             setMode={setMode}
             onStartAutoCycle={startAutoCycle}
             operateGate={operateGate}
             toggleValve={toggleValve}
             testValvePulse={testValvePulse}
             resetCounter={resetCounter}
             onSelectRecipe={selectRecipe}
          />
        )}
        {currentTab === 'manual' && (
          <ManualControl 
             data={data}
             setMode={setMode}
             toggleValve={toggleValve}
             operateGate={operateGate}
             onUpdateRecipe={updateRecipe}
             onUpdateSystemGate={updateSystemGate}
             onUpdateSensor={updateSensor}
             testValvePulse={testValvePulse}
             sendNanoCommand={sendNanoCommand}
          />
        )}
        {currentTab === 'history' && (
          <History data={data} />
        )}
        {currentTab === 'diagnostics' && (
          <Diagnostics 
             data={data}
             onAcknowledgeStartup={acknowledgeStartup}
             onAcknowledgeFault={acknowledgeFault}
             onTriggerFault={triggerFault}
          />
        )}
        {currentTab === 'hardware' && (
          <Hardware 
             socket={socket}
             data={data}
             onAddHardware={addHardware}
             onRemoveHardware={removeHardware}
             onToggleHardwareStatus={toggleHardwareStatus}
             onSendNanoCommand={sendNanoCommand}
             onUpdateNanoConfig={updateNanoConfig}
             onUpdateValve={updateValve}
             onUpdateSensor={updateSensor}
             onUpdateGate={updateGate}
             onUpdateSystemGate={updateSystemGate}
             onToggleSensorEnabled={toggleSensorEnabled}
             onToggleGateEnabled={toggleGateEnabled}
             onAddSensor={addSensor}
             onRemoveSensor={removeSensor}
             onAddGate={addGate}
             onRemoveGate={removeGate}
             onToggleExtraGateEnabled={toggleExtraGateEnabled}
             onAddNano={addNano}
             onRemoveNano={removeNano}
          />
        )}
        {currentTab === 'settings' && (
          <Settings 
             data={data}
             onUpdateConfig={updateConfig}
             onUpdateRecipe={updateRecipe}
             onAddRecipe={addRecipe}
             onRemoveRecipe={removeRecipe}
             onSelectRecipe={selectRecipe}
             onUpdateValve={updateValve}
             onUpdateSensor={updateSensor}
             onUpdateGate={updateGate}
             onUpdateSystemGate={updateSystemGate}
          />
        )}
      </main>

      {/* Tahliye (Flush) Overlay */}
      {data.mode === 'TAHLIYE' && (
        <div className="fixed inset-0 z-[100] bg-[#0B0D11]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
          <div className="w-24 h-24 bg-orange-600/20 rounded-full flex items-center justify-center mb-8">
            <RefreshCw className="text-orange-500 animate-spin-slow" size={48} />
          </div>
          
          <h1 className="text-4xl font-black text-white mb-4 tracking-tighter uppercase">Tahliye Başladı</h1>
          <p className="text-gray-400 max-w-md mb-12">İçerideki şişeler tahliye ediliyor. Lütfen işlem bitene kadar bekleyin veya manuel olarak durdurun.</p>
          
          <div className="grid grid-cols-2 gap-8 mb-12 w-full max-w-lg">
             <div className="bg-[#151921] border border-[#2D333F] rounded-2xl p-6">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Giren Şişe</div>
                <div className="text-5xl font-mono font-bold text-white">{data.inputCount}</div>
             </div>
             <div className="bg-[#151921] border border-orange-500/30 rounded-2xl p-6 shadow-lg shadow-orange-500/5">
                <div className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-2">Çıkan Şişe</div>
                <div className="text-5xl font-mono font-bold text-white">{data.outputCount}</div>
             </div>
          </div>

          <button 
            onClick={() => setMode('BEKLEMEDE')}
            className="group flex items-center gap-4 bg-red-600 hover:bg-red-500 text-white px-10 py-5 rounded-2xl font-black text-xl transition-all shadow-2xl shadow-red-500/20 active:scale-95"
          >
            <Power size={28} />
            TAHLİYE İŞLEMİNİ DURDUR
          </button>
          
          <div className="mt-12 flex items-center gap-2 text-xs text-gray-500">
             <div className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
             Sensörler Aktif ve Sayım Yapılıyor
          </div>
        </div>
      )}
    </div>
  );
}

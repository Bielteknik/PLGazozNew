import { useState } from 'react';
import { Lock } from 'lucide-react';
import { cn } from './lib/utils';
import { Sidebar } from './components/layout/Sidebar';
import { Dashboard } from './components/views/Dashboard';
import { ManualControl } from './components/views/ManualControl';
import { History } from './components/views/History';
import { Diagnostics } from './components/views/Diagnostics';
import { Settings } from './components/views/Settings';
import { Hardware } from './components/views/Hardware';
import { useSystemSimulator } from './hooks/useSystemSimulator';

export default function App() {
  console.log("App: Bileşen başlatıldı.");
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [isSecurityLocked, setIsSecurityLocked] = useState(false);
  
  const {
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
    stopWashing,
    selectRecipe,
    updateRecipe,
    addRecipe,
    removeRecipe,
    answerPrompt,
    requestStopAfterCycle,
    toggleEngineerMode
  } = useSystemSimulator();

  console.log("App Rendering - Tab:", currentTab, "Mode:", data?.mode);
  console.log("App: Render aşamasına geçiliyor...");

  return (
    <div className="flex h-screen bg-[#0B0D11] text-[#E0E0E0] overflow-hidden font-sans border-4 border-[#1F2937]">
      <Sidebar 
        currentTab={currentTab} 
        onChangeTab={setCurrentTab}
        systemMode={data.mode} 
        isEngineerMode={data.isEngineerMode}
        onToggleEngineerMode={toggleEngineerMode}
        isSecurityLocked={isSecurityLocked}
        onToggleSecurityLock={() => setIsSecurityLocked(!isSecurityLocked)}
      />
      
        <div className={cn("flex-1 relative", isSecurityLocked && "pointer-events-none opacity-80")}>
           {isSecurityLocked && (
             <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
               <div className="bg-[#450a0a] border border-[#7f1d1d] text-[#fca5a5] px-4 py-2 rounded-full flex items-center space-x-2 shadow-2xl animate-pulse">
                 <Lock size={16} />
                 <span className="text-xs font-black tracking-widest">SİSTEM KİLİTLİ</span>
               </div>
             </div>
           )}
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
             />
           )}
           {currentTab === 'manual' && (
             <ManualControl 
                data={data}
                setMode={setMode}
                toggleValve={toggleValve}
                operateGate={operateGate}
                setValveMode={setValveMode}
                setValvePulseDuration={setValvePulseDuration}
                toggleGateEnabled={toggleGateEnabled}
                onResetCounter={resetCounter}
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
             />
           )}
        </div>
    </div>
  );
}

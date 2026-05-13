import { useState } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Dashboard } from './components/views/Dashboard';
import { ManualControl } from './components/views/ManualControl';
import { History } from './components/views/History';
import { Diagnostics } from './components/views/Diagnostics';
import { Settings } from './components/views/Settings';
import { Hardware } from './components/views/Hardware';
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
             onToggleHardwareStatus={toggleHardwareStatus}
             onUpdateRecipe={updateRecipe}
             testValvePulse={testValvePulse}
             manualLogin={manualLogin}
             manualToken={manualToken}
             manualExpires={manualExpires}
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
    </div>
  );
}

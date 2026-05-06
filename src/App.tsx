import { useState } from 'react';
import { useSystemSimulator } from './hooks/useSystemSimulator';
import { Sidebar } from './components/layout/Sidebar';
import { Dashboard } from './components/views/Dashboard';
import { ManualControl } from './components/views/ManualControl';
import { Hardware } from './components/views/Hardware';
import { Settings } from './components/views/Settings';
import { History } from './components/views/History';
import { Diagnostics } from './components/views/Diagnostics';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { SystemMode } from './types/system';

export default function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [isSecurityLocked, setIsSecurityLocked] = useState(false);
  const system = useSystemSimulator();

  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return (
          <Dashboard 
            data={system.data}
            onStart={system.startAutoCycle}
            onStop={() => system.setMode('ARIZA')}
            onStopAfterCycle={system.requestStopAfterCycle}
            onStartWashing={() => system.setMode('YIKAMA')}
            onStopWashing={() => system.setMode('BEKLEMEDE')}
            onResetCounter={system.resetCounter}
            onSelectRecipe={system.selectRecipe}
            onAnswerPrompt={system.answerPrompt}
          />
        );
      case 'manual':
        return (
          <ManualControl 
            data={system.data}
            setMode={system.setMode}
            toggleValve={system.toggleValve}
            setValveMode={system.setValveMode}
            setValvePulseDuration={system.setValvePulseDuration}
            operateGate={system.operateGate}
            toggleGateEnabled={system.toggleGateEnabled}
            onResetCounter={system.resetCounter}
          />
        );
      case 'hardware':
        return (
          <Hardware 
            data={system.data}
            onUpdateValve={system.updateValve}
            onUpdateSensor={system.updateSensor}
            onUpdateGate={system.updateGate}
            onUpdateSystemGate={system.updateSystemGate}
            onAddHardware={system.addHardware}
            onRemoveHardware={system.removeHardware}
            onToggleHardwareStatus={system.toggleHardwareStatus}
            onAddSensor={system.addSensor}
            onRemoveSensor={system.removeSensor}
            onToggleSensorEnabled={system.toggleSensorEnabled}
            onToggleGateEnabled={system.toggleGateEnabled}
            onAddGate={system.addGate}
            onRemoveGate={system.removeGate}
            onToggleExtraGateEnabled={system.toggleExtraGateEnabled}
            onAddNano={system.addNano}
            onRemoveNano={system.removeNano}
            onUpdateNanoConfig={system.updateNanoConfig}
            onRefreshPorts={system.refreshPorts}
            onSetPortMapping={system.setPortMapping}
            onSendNanoCommand={system.sendNanoCommand}
          />
        );
      case 'settings':
        return (
          <Settings 
            data={system.data}
            onUpdateConfig={system.updateConfig}
            onUpdateRecipe={system.updateRecipe}
            onAddRecipe={system.addRecipe}
            onRemoveRecipe={system.removeRecipe}
            onSelectRecipe={system.selectRecipe}
          />
        );
      case 'history':
        return <History data={system.data} />;
      case 'diagnostics':
        return (
          <Diagnostics 
            data={system.data}
            onAcknowledgeStartup={system.acknowledgeStartup}
            onAcknowledgeFault={system.acknowledgeFault}
            onTriggerFault={system.triggerFault}
          />
        );
      default:
        return <div>Tab not found</div>;
    }
  };

  return (
    <div className="flex h-screen bg-[#0B0D11] text-white overflow-hidden font-sans">
      <Sidebar 
        currentTab={currentTab} 
        onChangeTab={setCurrentTab}
        systemMode={system.data.mode}
        isEngineerMode={system.data.isEngineerMode}
        onToggleEngineerMode={system.toggleEngineerMode}
        isSecurityLocked={isSecurityLocked}
        onToggleSecurityLock={() => setIsSecurityLocked(!isSecurityLocked)}
      />
      
      <main className="flex-1 p-4 overflow-hidden relative">
        <ErrorBoundary>
          {renderContent()}
        </ErrorBoundary>

        {/* Global Loading / Status Overlays */}
        {system.data.mode === 'BASLATMA' && (
          <div className="absolute inset-0 z-[200] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center">
            <h1 className="text-4xl font-bold text-[#F97316] mb-4 animate-pulse">Palandöken Gazoz HMI</h1>
            <p className="text-gray-400 mb-8">Sistem Başlatılıyor, Lütfen Bekleyin...</p>
            <button 
              onClick={system.acknowledgeStartup}
              className="px-8 py-3 bg-[#F97316] hover:bg-orange-600 text-white font-bold rounded-lg transition-all active:scale-95"
            >
              SİSTEMİ AÇ
            </button>
          </div>
        )}

        {system.data.mode === 'ARIZA' && (
          <div className="absolute bottom-4 right-4 z-[150] w-96">
            <div className="bg-red-900/80 border-2 border-red-500 rounded-xl p-4 backdrop-blur-sm shadow-[0_0_30px_rgba(239,68,68,0.3)]">
              <h3 className="text-lg font-bold flex items-center gap-2 mb-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                SİSTEM DURDURULDU
              </h3>
              <p className="text-sm text-gray-200 mb-4">Acil durum veya kritik hata tespit edildi. Lütfen uyarıları kontrol edin.</p>
              <button 
                onClick={system.acknowledgeFault}
                className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded shadow-lg transition-colors"
              >
                HATAYI ONAYLA VE SIFIRLA
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

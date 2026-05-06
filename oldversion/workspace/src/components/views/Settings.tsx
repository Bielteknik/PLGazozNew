import React, { useState } from 'react';
import { Save, RefreshCw, AlertTriangle, Sliders, Timer, Zap, Shield, Database, Wrench, Network, Activity, FileText, ChevronRight, Settings as SettingsIcon } from 'lucide-react';
import { SystemData } from '../../types/system';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface SettingsProps {
  data: SystemData;
  onUpdateConfig: (config: Partial<SystemData['config']>) => void;
}

type TabType = 'production' | 'hardware' | 'network' | 'system';

export function Settings({ data, onUpdateConfig }: SettingsProps) {
  const { config } = data;
  const isAuto = data.mode === 'AUTO';
  const [activeTab, setActiveTab] = useState<TabType>('production');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      onUpdateConfig({ [name]: checked });
    } else if (name === 'recipeId' || name === 'mqttBrokerUrl' || name === 'logLevel' || name === 'emergencyStopBehavior') {
      onUpdateConfig({ [name]: value });
    } else {
      onUpdateConfig({ [name]: parseFloat(value) });
    }
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'production', label: 'ÜRETİM / REÇETE', icon: <Database size={16} /> },
    { id: 'hardware', label: 'DONANIM / MOTOR', icon: <Timer size={16} /> },
    { id: 'network', label: 'AĞ / IOT', icon: <Network size={16} /> },
    { id: 'system', label: 'SİSTEM / GÜVENLİK', icon: <Shield size={16} /> },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden space-y-2">
      {/* HMI Header */}
      <div className="flex items-center justify-between bg-[#151921] border border-[#374151] p-3 px-4 rounded-xl shadow-lg shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/10 rounded-lg border border-orange-500/20">
             <SettingsIcon className="text-orange-500" size={20} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight leading-none uppercase">
              Sistem Konfigürasyonu
            </h2>
            <p className="text-[10px] text-gray-500 mt-1 font-medium font-mono">
              v2.1.0-STABLE | RPI-4B-V1
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
           {/* Mini Health Status */}
           <div className="flex gap-4 items-center bg-black/20 px-3 py-1.5 rounded-lg border border-gray-800">
              <div className="flex flex-col border-r border-gray-800 pr-4">
                 <span className="text-[8px] text-gray-500 font-bold uppercase">CPU</span>
                 <span className="text-[10px] font-mono text-emerald-500">%14</span>
              </div>
              <div className="flex flex-col">
                 <span className="text-[8px] text-gray-500 font-bold uppercase">MEM</span>
                 <span className="text-[10px] font-mono text-blue-500">124MB</span>
              </div>
           </div>

           {isAuto && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center text-amber-500 text-[10px] font-bold bg-amber-900/30 px-3 py-1.5 rounded-lg border border-amber-500/40"
              >
                <AlertTriangle size={14} className="mr-2 animate-pulse" />
                AYARLAR KİLİTLİ
              </motion.div>
           )}
        </div>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">
        
        {/* Horizontal Tabs Area */}
        <div className="flex gap-1 px-1 pt-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-t-xl transition-all text-xs font-bold relative active:scale-95",
                activeTab === tab.id 
                  ? "bg-[#1C2029] text-orange-500 border-t border-x border-[#374151] after:absolute after:bottom-[-2px] after:left-0 after:right-0 after:h-[2px] after:bg-[#1C2029] after:z-10" 
                  : "text-gray-500 bg-[#0D1016]/50 hover:bg-[#151921] border-transparent"
              )}
            >
              {tab.icon}
              <span className="tracking-widest">{tab.label}</span>
              {activeTab === tab.id && (
                <motion.div layoutId="settingTabLine" className="absolute top-0 left-0 right-0 h-0.5 bg-orange-500 rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 bg-[#1C2029] border border-[#374151] rounded-b-xl rounded-tr-xl overflow-hidden shadow-2xl flex flex-col p-8">
           <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="h-full overflow-y-auto space-y-8 pr-4 custom-scrollbar"
              >
                 {activeTab === 'production' && (
                    <div className="grid grid-cols-2 gap-10">
                       <section className="space-y-6">
                          <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                             <h3 className="text-sm font-bold text-blue-400 flex items-center">
                                <Database className="mr-3" size={18} /> Aktif Reçete Parametreleri
                             </h3>
                          </div>
                          <div className="space-y-6">
                             <div>
                                <label className="block text-xs font-bold text-gray-500 mb-2 tracking-wide">REÇETE KİMLİĞİ (RECIPE_ID)</label>
                                <input
                                  type="text"
                                  name="recipeId"
                                  value={config.recipeId}
                                  onChange={handleChange}
                                  disabled={isAuto}
                                  className="w-full h-14 bg-[#0D1016] border border-[#374151] rounded-xl px-5 text-base text-gray-200 focus:border-blue-500 outline-none transition-all disabled:opacity-50 font-mono"
                                />
                             </div>
                             <div>
                                <label className="block text-xs font-bold text-gray-500 mb-2 tracking-wide">HEDEF ÜRETİM SAYISI (ADET)</label>
                                <input
                                  type="number"
                                  name="targetCount"
                                  value={config.targetCount}
                                  onChange={handleChange}
                                  disabled={isAuto}
                                  className="w-full h-14 bg-[#0D1016] border border-[#374151] rounded-xl px-5 text-lg text-white focus:border-blue-500 outline-none transition-all disabled:opacity-50 font-mono"
                                />
                             </div>
                          </div>
                       </section>
                       
                       <section className="space-y-6">
                          <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                             <h3 className="text-sm font-bold text-blue-400 flex items-center">
                                <Timer className="mr-3" size={18} /> Zamanlama Verileri
                             </h3>
                          </div>
                          <div className="space-y-5">
                             <div>
                                <label className="block text-xs font-bold text-gray-500 mb-2 tracking-wide">SIVI DOLUM SÜRESİ (MILISANIYE)</label>
                                <div className="relative">
                                   <input
                                     type="number"
                                     name="fillTimeMs"
                                     value={config.fillTimeMs}
                                     onChange={handleChange}
                                     disabled={isAuto}
                                     className="w-full h-14 bg-[#0D1016] border border-[#374151] rounded-xl px-5 text-lg text-white focus:border-blue-500 outline-none transition-all disabled:opacity-50 font-mono"
                                   />
                                   <span className="absolute right-4 top-4 text-gray-600 font-bold">ms</span>
                                </div>
                             </div>
                             <div className="grid grid-cols-2 gap-6">
                                <div>
                                   <label className="block text-[10px] font-bold text-gray-500 mb-2 tracking-widest">DENGELEME (MS)</label>
                                   <input
                                     type="number"
                                     name="settlingTimeMs"
                                     value={config.settlingTimeMs}
                                     onChange={handleChange}
                                     disabled={isAuto}
                                     className="w-full h-12 bg-[#0D1016] border border-[#374151] rounded-xl px-4 text-sm text-gray-200 outline-none transition-all font-mono"
                                   />
                                </div>
                                <div>
                                   <label className="block text-[10px] font-bold text-gray-500 mb-2 tracking-widest">DAMLAMA (MS)</label>
                                   <input
                                     type="number"
                                     name="dripWaitTimeMs"
                                     value={config.dripWaitTimeMs}
                                     onChange={handleChange}
                                     disabled={isAuto}
                                     className="w-full h-12 bg-[#0D1016] border border-[#374151] rounded-xl px-4 text-sm text-gray-200 outline-none transition-all font-mono"
                                   />
                                </div>
                             </div>
                          </div>
                       </section>
                    </div>
                 )}

                 {activeTab === 'hardware' && (
                    <div className="grid grid-cols-2 gap-10">
                       <section className="space-y-8">
                          <div>
                             <h3 className="text-sm font-bold text-orange-400 flex items-center border-b border-gray-800 pb-3 mb-6">
                                <Zap className="mr-3" size={18} /> Sensör Filtre Algoritmaları
                             </h3>
                             <div className="space-y-10">
                                <div>
                                   <div className="flex justify-between mb-4">
                                      <label className="text-xs font-bold text-white uppercase tracking-wider">Giriş Lazer (Anti-Noise)</label>
                                      <span className="text-orange-400 font-mono text-sm leading-none bg-orange-400/10 px-3 py-1 rounded border border-orange-400/20">{config.inputDebounceMs} MS</span>
                                   </div>
                                   <input
                                     type="range"
                                     name="inputDebounceMs"
                                     min="5" max="250"
                                     value={config.inputDebounceMs}
                                     onChange={handleChange}
                                     disabled={isAuto}
                                     className="w-full h-4 bg-[#0D1016] rounded-xl appearance-none cursor-pointer accent-orange-500 border border-[#374151]"
                                   />
                                </div>
                                <div>
                                   <div className="flex justify-between mb-4">
                                      <label className="text-xs font-bold text-white uppercase tracking-wider">Çıkış Lazer (Anti-Noise)</label>
                                      <span className="text-orange-400 font-mono text-sm leading-none bg-orange-400/10 px-3 py-1 rounded border border-orange-400/20">{config.outputDebounceMs} MS</span>
                                   </div>
                                   <input
                                     type="range"
                                     name="outputDebounceMs"
                                     min="5" max="250"
                                     value={config.outputDebounceMs}
                                     onChange={handleChange}
                                     disabled={isAuto}
                                     className="w-full h-4 bg-[#0D1016] rounded-xl appearance-none cursor-pointer accent-orange-500 border border-[#374151]"
                                   />
                                </div>
                             </div>
                          </div>
                       </section>Section with pneumatic and motor configuration components
                       <section className="space-y-8">
                          <div>
                             <h3 className="text-sm font-bold text-orange-400 flex items-center border-b border-gray-800 pb-3 mb-6">
                                <Wrench className="mr-3" size={18} /> Pnömatik & Motor Tahrik
                             </h3>
                             <div className="space-y-8">
                                <div>
                                   <div className="flex justify-between mb-4">
                                      <label className="text-xs font-bold text-white uppercase tracking-wider">NEMA17 Tork/Hız Limiti</label>
                                      <span className="text-blue-400 font-mono text-base font-bold bg-blue-400/10 px-3 py-1 rounded border border-blue-400/20">%{config.gateSpeedPercent}</span>
                                   </div>
                                   <input
                                     type="range"
                                     name="gateSpeedPercent"
                                     min="10" max="100"
                                     value={config.gateSpeedPercent}
                                     onChange={handleChange}
                                     disabled={isAuto}
                                     className="w-full h-4 bg-[#0D1016] rounded-xl appearance-none cursor-pointer accent-blue-500 border border-[#374151]"
                                   />
                                </div>
                                <div className="p-6 bg-[#0D1016] rounded-2xl border border-gray-800 flex items-center justify-between shadow-lg">
                                   <div className="flex items-center gap-4">
                                      <div className={cn("p-3 rounded-lg", config.relayInversion ? "bg-orange-500 text-white" : "bg-gray-800 text-gray-500")}>
                                         <Activity size={24} />
                                      </div>
                                      <div>
                                         <div className="text-sm font-bold text-white uppercase">Röle Sinyal Inversion</div>
                                         <div className="text-[10px] text-gray-500 mt-1 uppercase">Active-Low (VCC/GND Jump)</div>
                                      </div>
                                   </div>
                                   <label className="relative inline-flex items-center cursor-pointer">
                                      <input type="checkbox" name="relayInversion" checked={config.relayInversion} onChange={handleChange} disabled={isAuto} className="sr-only peer" />
                                      <div className="w-14 h-8 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-orange-500"></div>
                                   </label>
                                </div>
                             </div>
                          </div>
                       </section>
                    </div>
                 )}

                 {activeTab === 'network' && (
                    <div className="max-w-4xl space-y-6">
                       <h3 className="text-sm font-bold text-emerald-400 flex items-center border-b border-gray-800 pb-3 mb-4">
                          <Network className="mr-3" size={18} /> IoT Endüstri 4.0 & MQTT Parametreleri
                       </h3>
                       <div className="bg-[#0D1016] rounded-2xl border border-gray-800 p-8 space-y-8 shadow-xl">
                          <label className="flex items-center justify-between p-6 bg-[#151921] rounded-2xl border border-gray-800 cursor-pointer hover:border-emerald-500/50 transition-colors">
                             <div className="flex gap-4 items-center">
                                <div className={cn("p-4 rounded-xl transition-all shadow-md", config.enableMqtt ? "bg-emerald-500 text-white" : "bg-gray-800 text-gray-500")}>
                                   <Network size={28} />
                                </div>
                                <div>
                                   <div className="text-xl font-bold text-white tracking-tight">BULUT VERİ AKTARIMI AKTİF</div>
                                   <div className="text-xs text-gray-500 font-medium mt-1">Telemetri verilerini MQTT Broker üzerinden anlık olarak ilet.</div>
                                </div>
                             </div>
                             <input type="checkbox" name="enableMqtt" checked={config.enableMqtt} onChange={handleChange} disabled={isAuto} className="w-8 h-8 accent-emerald-500 rounded-lg" />
                          </label>
                          
                          <div className={cn("grid grid-cols-2 gap-8 transition-opacity duration-300", !config.enableMqtt && "opacity-20 pointer-events-none")}>
                             <div className="space-y-2">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">BROKER ADRESİ / HOST</label>
                                <input
                                  type="text"
                                  name="mqttBrokerUrl"
                                  value={config.mqttBrokerUrl}
                                  onChange={handleChange}
                                  className="w-full h-14 bg-[#151921] border border-[#374151] rounded-xl px-5 text-base text-white focus:border-emerald-500 outline-none font-mono"
                                />
                             </div>
                             <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                   <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">HEARTBEAT (MS)</label>
                                   <input
                                     type="number"
                                     name="heartbeatIntervalMs"
                                     value={config.heartbeatIntervalMs}
                                     onChange={handleChange}
                                     className="w-full h-14 bg-[#151921] border border-[#374151] rounded-xl px-4 text-white outline-none font-mono"
                                   />
                                </div>
                                <div className="space-y-2">
                                   <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">MAX RETRY</label>
                                   <input
                                     type="number"
                                     name="maxRetries"
                                     value={config.maxRetries}
                                     onChange={handleChange}
                                     className="w-full h-14 bg-[#151921] border border-[#374151] rounded-xl px-4 text-white outline-none font-mono"
                                   />
                                </div>
                             </div>
                          </div>
                       </div>
                    </div>
                 )}

                 {activeTab === 'system' && (
                    <div className="grid grid-cols-2 gap-10">
                       <section className="space-y-8 text-system-security-section">
                          <h3 className="text-sm font-bold text-purple-400 flex items-center border-b border-gray-800 pb-3 mb-6">
                             <Shield className="mr-3" size={18} /> Gelişmiş Güvenlik & Watchdog
                          </h3>
                          <div className="space-y-8">
                             <div>
                                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">Watchdog Timer (Hata Toleransı)</label>
                                <div className="relative">
                                   <input
                                     type="number"
                                     name="watchdogTimeoutMs"
                                     value={config.watchdogTimeoutMs}
                                     onChange={handleChange}
                                     disabled={isAuto}
                                     className="w-full h-14 bg-[#0D1016] border border-[#374151] rounded-xl px-5 text-white outline-none focus:border-purple-500 font-mono"
                                   />
                                   <span className="absolute right-4 top-4 text-gray-600 font-bold">ms</span>
                                </div>
                             </div>
                             <div className="p-6 bg-[#0D1016] rounded-2xl border border-gray-800 flex items-center justify-between shadow-lg">
                                <div className="flex items-center gap-4">
                                   <div className={cn("p-3 rounded-lg", config.autoRecovery ? "bg-purple-500 text-white" : "bg-gray-800 text-gray-500")}>
                                      <RefreshCw size={24} />
                                   </div>
                                   <div>
                                      <div className="text-sm font-bold text-white uppercase tracking-tight">Hata Kurtarma (Auto-Recovery)</div>
                                      <div className="text-[10px] text-gray-500 mt-1">SİSTEM KRİTİK HATALARDAN SONRA KENDİNİ RESETLER</div>
                                   </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                   <input type="checkbox" name="autoRecovery" checked={config.autoRecovery} onChange={handleChange} disabled={isAuto} className="sr-only peer" />
                                   <div className="w-14 h-8 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-purple-500"></div>
                                </label>
                             </div>
                             <div>
                                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">Acil Durum (E-STOP) Mantığı</label>
                                <select
                                  name="emergencyStopBehavior"
                                  value={config.emergencyStopBehavior}
                                  onChange={handleChange}
                                  disabled={isAuto}
                                  className="w-full h-14 bg-[#0D1016] border border-[#374151] rounded-xl px-5 text-sm text-white outline-none focus:border-purple-500 appearance-none bg-no-repeat bg-[right_1.25rem_center] cursor-pointer"
                                  style={{ backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down"><path d="m6 9 6 6 6-6"/></svg>')`, backgroundSize: '1.2em' }}
                                >
                                  <option value="FREEZE">SİSTEMİ DONDUR (VALFLER KAPALI)</option>
                                  <option value="RELEASE_PRESSURE">BASINÇLI HAVAYI TAHLİYE ET</option>
                                  <option value="SAFE_HOME">GÜVENLİ POZİSYONA DÖN (HOMING)</option>
                                </select>
                             </div>
                          </div>
                       </section>
                       
                       <section className="space-y-8 logs-and-diagnostic-section">
                          <h3 className="text-sm font-bold text-purple-400 flex items-center border-b border-gray-800 pb-3 mb-6">
                             <FileText className="mr-3" size={18} /> Diagnostik & Veri Günlüğü
                          </h3>
                          <div className="space-y-8">
                             <div className="space-y-2">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest font-bold">LOG_LEVEL (KAYIT SEVİYESİ)</label>
                                <select
                                  name="logLevel"
                                  value={config.logLevel}
                                  onChange={handleChange}
                                  disabled={isAuto}
                                  className="w-full h-14 bg-[#0D1016] border border-[#374151] rounded-xl px-5 text-sm text-white outline-none focus:border-purple-500 appearance-none bg-no-repeat bg-[right_1.25rem_center] cursor-pointer"
                                  style={{ backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down"><path d="m6 9 6 6 6-6"/></svg>')`, backgroundSize: '1.2em' }}
                                >
                                  <option value="DEBUG">DEBUG (GELİŞTİRİCİ MODU)</option>
                                  <option value="INFO">INFO (STANDART)</option>
                                  <option value="WARN">WARN (UYARILAR)</option>
                                  <option value="ERROR">ERROR (SADECE KRİTİK HATALAR)</option>
                                </select>
                             </div>
                             <div className="p-8 bg-gradient-to-br from-[#0D1016] to-[#151921] rounded-2xl border border-gray-800 flex flex-col items-center gap-2 shadow-inner">
                                <div className="text-gray-600 text-[10px] uppercase font-bold tracking-[0.25em] mb-4">DONANIM SERTİFİKASI</div>
                                <div className="text-lg font-mono text-gray-200 tracking-tight">ID: RPI-4B-PRO-0X9428</div>
                                <div className="px-3 py-1 bg-gray-800/50 rounded border border-gray-700 text-[10px] font-mono text-gray-500 uppercase mt-2">Core OS: Linux 5.15.0-rt ARM64</div>
                                <div className="mt-4 flex gap-4">
                                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                                   <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                                </div>
                             </div>
                          </div>
                       </section>
                    </div>
                 )}
              </motion.div>
           </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

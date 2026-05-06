import React from 'react';
import { SystemData } from '../../types/system';
import { Fingerprint, CheckSquare, Settings, AlertTriangle, Bug } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DiagnosticsProps {
  data: SystemData;
  onAcknowledgeStartup: () => void;
  onAcknowledgeFault: () => void;
  onTriggerFault: (type: 'VALVE_STUCK' | 'SENSOR_UNSTABLE' | 'COMM_LOSS' | 'TIMEOUT_SETTLE') => void;
}

export function Diagnostics({ data, onAcknowledgeStartup, onAcknowledgeFault, onTriggerFault }: DiagnosticsProps) {
  
  return (
    <div className="flex flex-col h-full space-y-3">
      
      {/* State Overview */}
      <div className={cn(
         "border p-4 rounded",
         data.mode === 'BASLATMA' ? "bg-[#381a03] border-[#7c2d12]" :
         data.mode === 'ARIZA' ? "bg-[#450a0a] border-[#7f1d1d]" :
         "bg-[#052e16] border-[#14532d]"
      )}>
         <h2 className={cn(
            "text-base font-bold flex items-center mb-1",
            data.mode === 'BASLATMA' ? "text-[#fdba74]" :
            data.mode === 'ARIZA' ? "text-[#fca5a5]" :
            "text-[#4ade80]"
         )}>
           {data.mode === 'BASLATMA' && "Üretim Öncesi Doğrulama Bekleniyor"}
           {data.mode === 'ARIZA' && "Sistem Hatası Algılandı"}
           {(data.mode === 'OTOMATİK' || data.mode === 'MANUEL' || data.mode === 'BEKLEMEDE') && "Tüm Sistemler Operasyonel"}
         </h2>
         <p className="text-gray-400 text-[10px]">
           {data.mode === 'BASLATMA' && "Master ve köle cihazlar başlatıldı. Otomatik test başarılı. PRODUCTION_LOCK kaldırmak için operatör onayı gerekiyor."}
           {data.mode === 'ARIZA' && "Sistem düzeltilemez bir hata nedeniyle durduruldu. Lütfen aktif uyarıları aşağıdan inceleyin."}
           {(data.mode === 'OTOMATİK' || data.mode === 'MANUEL' || data.mode === 'BEKLEMEDE') && "Otomatik hata teşhisi normal. Alt sistemler doğru yanıt veriyor."}
         </p>
         
         {data.mode === 'BASLATMA' && (
            <button 
              onClick={onAcknowledgeStartup}
              className="mt-4 bg-[#F97316] hover:bg-[#c2410c] text-black px-4 py-1.5 rounded font-bold text-[10px] flex items-center transition-colors border border-[#F97316]"
            >
              <Fingerprint className="mr-2" size={14} /> OPERATÖR ONAYI (PIN GEREKLİ)
            </button>
         )}

         {data.mode === 'ARIZA' && (
            <button 
              onClick={onAcknowledgeFault}
              className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded font-bold text-[10px] flex items-center transition-colors border border-red-500"
            >
              <CheckSquare className="mr-2" size={14} /> HATALARI ONAYLA VE TEMİZLE
            </button>
         )}
      </div>

      {/* Error Management Details */}
      {data.activeAlerts.length > 0 && (
         <div className="bg-[#151921] border border-[#2D333F] rounded p-3 overflow-y-auto max-h-[300px]">
             <h3 className="text-[10px] uppercase font-bold text-gray-400 mb-2 border-l-2 border-[#F97316] pl-2 sticky top-0 bg-[#151921] pt-1 pb-2">Hata Günlüğü & Aktif Arızalar</h3>
             <div className="space-y-2">
                {data.activeAlerts.map(alert => (
                   <div key={alert.id} className={cn(
                      "border rounded p-3 flex gap-3 transition-opacity",
                      !alert.resolved ? (alert.severity === 'CRITICAL' ? "bg-[#2D0606] border-red-900" : "bg-[#2D1A06] border-amber-900") : "bg-[#0D1016] border-[#1F2937] opacity-60"
                   )}>
                      <div className="mt-0.5">
                         <AlertTriangle size={24} className={cn(
                            !alert.resolved ? (alert.severity === 'CRITICAL' ? "text-red-500" : "text-amber-500") : "text-gray-600"
                         )} />
                      </div>
                      <div className="flex-1">
                         <div className="flex justify-between items-start mb-1">
                            <span className={cn(
                               "font-mono font-bold text-xs",
                               !alert.resolved ? (alert.severity === 'CRITICAL' ? "text-red-400" : "text-amber-400") : "text-gray-400"
                            )}>
                               {alert.resolved ? '[ÇÖZÜLDÜ] ' : ''}{alert.code}
                            </span>
                            <span className="text-gray-500 font-mono text-[9px]">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                         </div>
                         <p className="text-gray-300 text-[11px] mb-2">{alert.message}</p>
                         <div className="bg-[#1a1c23] p-2 rounded border border-[#2D333F] text-gray-400 text-[10px]">
                           <strong>Önerilen Aksiyon:</strong> {alert.suggestion}
                         </div>
                      </div>
                   </div>
                ))}
             </div>
         </div>
      )}

      <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
        
        {/* Startup Checklist */}
        <div className="bg-[#151921] border border-[#2D333F] rounded p-3 overflow-y-auto">
            <h3 className="text-[10px] uppercase font-bold text-gray-400 mb-3 border-l-2 border-[#F97316] pl-2 flex justify-between">
              Başlatma Dizisi Günlüğü
           </h3>
           <div className="space-y-1.5 font-mono text-[10px]">
              <div className="flex justify-between items-center text-gray-300">
                <span>[0.0s] Master (Raspberry Pi) Başlatılıyor</span>
                <span className="text-green-400">TAMAM</span>
              </div>
              <div className="flex justify-between items-center text-gray-300">
                <span>[1.2s] UART PING {'->'} Nano 1 (Kapılar)</span>
                <span className="text-green-400">ONAY</span>
              </div>
              <div className="flex justify-between items-center text-gray-300">
                <span>[1.3s] UART PING {'->'} Nano 2 (Valfler)</span>
                <span className="text-green-400">ONAY</span>
              </div>
              <div className="flex justify-between items-center text-gray-300">
                <span>[2.0s] Durum Makinesi Başlatılıyor</span>
                <span className="text-green-400">TAMAM</span>
              </div>
              <div className="flex justify-between items-center text-[#F97316]">
                <span>[2.5s] Röle test rutini</span>
                <span>ATLANDI</span>
              </div>
              <div className="flex justify-between items-center text-gray-300">
                <span>[3.1s] Lazer referans okuması (Giriş/Çıkış)</span>
                <span className="text-green-400">NET</span>
              </div>
              <div className="flex justify-between items-center text-gray-300 border-t border-[#374151] pt-2 mt-2">
                <span className="font-bold text-gray-400">ÜRETİM_KİLİDİ (PRODUCTION_LOCK)</span>
                <span className={cn("font-bold px-1.5 rounded", data.mode === 'BASLATMA' ? "bg-red-900/40 text-red-400 border border-red-800" : "bg-green-900/40 text-green-400 border border-green-800")}>
                  {data.mode === 'BASLATMA' ? "DEVREDE" : "KALDIRILDI"}
                </span>
              </div>
           </div>
        </div>

        {/* Dynamic Config Viewer & Fault Injector */}
        <div className="flex flex-col space-y-3">
           <div className="bg-[#151921] border border-[#2D333F] rounded p-3 overflow-y-auto flex-1">
              <h3 className="text-[10px] uppercase font-bold text-gray-400 mb-3 border-l-2 border-[#F97316] pl-2 flex items-center">
                 <Settings className="mr-2" size={12} /> Dinamik Yapılandırma
              </h3>
              <div className="text-[10px] font-mono text-blue-300 bg-[#0D1016] p-3 rounded border border-[#1F2937] overflow-x-auto h-full">
                <pre className="leading-relaxed">{JSON.stringify({
                  current_recipe: {
                    id: data.config.recipeId,
                    target_count: data.config.targetCount,
                    settle_delay_ms: data.config.settlingTimeMs,
                    fill_duration_ms: data.config.fillTimeMs,
                    drip_wait_ms: data.config.dripWaitTimeMs,
                    input_debounce_ms: data.config.inputDebounceMs,
                    output_debounce_ms: data.config.outputDebounceMs
                  },
                  hardware_map: {
                    nano1_uart: "/dev/ttyUSB0",
                    nano2_uart: "/dev/ttyUSB1",
                    relay_inversion: data.config.relayInversion,
                    gate_speed: data.config.gateSpeedPercent,
                    watchdog_ms: data.config.watchdogTimeoutMs,
                    auto_recovery: data.config.autoRecovery
                  }
                }, null, 2)}</pre>
              </div>
           </div>

           {/* Fault Simulator */}
           <div className="bg-[#151921] border border-[#2D333F] rounded p-3">
               <h3 className="text-[10px] uppercase font-bold text-gray-400 mb-2 border-l-2 border-red-500 pl-2 flex items-center">
                  <Bug className="mr-2 text-red-500" size={12} /> Hata Simülatörü (Test)
               </h3>
               <div className="grid grid-cols-2 gap-2 mt-2">
                  <button onClick={() => onTriggerFault('VALVE_STUCK')} className="bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800 rounded p-1.5 text-[9px] font-bold transition-colors">Sıkışık Valf</button>
                  <button onClick={() => onTriggerFault('SENSOR_UNSTABLE')} className="bg-amber-900/30 hover:bg-amber-900/50 text-amber-400 border border-amber-800 rounded p-1.5 text-[9px] font-bold transition-colors">Sensör Gürültüsü</button>
                  <button onClick={() => onTriggerFault('COMM_LOSS')} className="bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800 rounded p-1.5 text-[9px] font-bold transition-colors">İletişim Kaybı</button>
                  <button onClick={() => onTriggerFault('TIMEOUT_SETTLE')} className="bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800 rounded p-1.5 text-[9px] font-bold transition-colors">Durum Zaman Aşımı</button>
               </div>
           </div>
        </div>

      </div>
    </div>
  );
}

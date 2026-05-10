import React, { useState } from 'react';
import { LayoutDashboard, Sliders, History, AlertTriangle, Settings, Server, ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SystemData } from '../../types/system';

interface SidebarProps {
  currentTab: string;
  onChangeTab: (tab: string) => void;
  data: SystemData;
  onLogout: () => void;
}

export function Sidebar({ currentTab, onChangeTab, data, onLogout }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const systemMode = data.mode;
  const isProcessActive = systemMode === 'OTOMATİK' || systemMode === 'BASLATMA' || systemMode === 'YIKAMA';

  const onlineNanos = data.nanos.filter(n => n.status === 'ONLINE').length;
  const activeAlerts = data.activeAlerts.filter(a => !a.resolved).length;
  const criticalAlerts = data.activeAlerts.filter(a => !a.resolved && a.severity === 'CRITICAL').length;
  
  const healthScore = criticalAlerts > 0 ? 'CRITICAL' : activeAlerts > 2 ? 'WARNING' : 'HEALTHY';
  
  const tabs = [
    { id: 'dashboard', label: 'İzleme Ekranı', icon: LayoutDashboard },
    { id: 'hardware', label: 'Donanım', icon: Server },
    { id: 'manual', label: 'Manuel Kontrol', icon: Sliders },
    { id: 'history', label: 'Üretim Geçmişi', icon: History },
    { id: 'diagnostics', label: 'Arıza Teşhis', icon: AlertTriangle },
  ];

  return (
    <div className={cn("bg-[#151921] border-r border-[#374151] text-[#E0E0E0] flex flex-col h-full shrink-0 transition-all duration-300", isCollapsed ? "w-14" : "w-56")}>
      <div className={cn("h-14 flex items-center border-b border-[#374151]", isCollapsed ? "justify-center px-1" : "justify-between px-3")}>
        {!isCollapsed && (
          <div className="flex items-center space-x-2 truncate">
            <div className="bg-[#F97316] text-black font-black px-2 py-0.5 rounded text-[10px] tracking-tighter">PALANDÖKEN</div>
            <h1 className="font-bold text-sm tracking-tight text-white mb-0">GAZOZ</h1>
          </div>
        )}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)} 
          className="p-1 text-gray-400 hover:text-white hover:bg-[#1C2029] rounded transition-colors"
          title={isCollapsed ? "Menüyü Genişlet" : "Menüyü Daralt"}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
      
      <div className={cn("p-2", !isCollapsed && "p-3")}>
        {/* Health Indicator */}
        <div className={cn("mb-4 group cursor-help", isCollapsed ? "flex justify-center" : "px-1")}>
           {!isCollapsed && <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 border-l-2 border-[#F97316] pl-2">Sistem Sağlığı</div>}
           <div className={cn(
             "p-2 rounded border flex flex-col gap-1 transition-all",
             healthScore === 'HEALTHY' && "bg-emerald-500/5 border-emerald-500/20",
             healthScore === 'WARNING' && "bg-amber-500/5 border-amber-500/20",
             healthScore === 'CRITICAL' && "bg-red-500/5 border-red-500/20"
           )}>
              <div className="flex items-center justify-between">
                 <div className={cn(
                   "w-2 h-2 rounded-full",
                   healthScore === 'HEALTHY' && "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse",
                   healthScore === 'WARNING' && "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse",
                   healthScore === 'CRITICAL' && "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse"
                 )}></div>
                 {!isCollapsed && (
                    <span className={cn(
                      "text-[9px] font-black uppercase font-mono",
                      healthScore === 'HEALTHY' && "text-emerald-500",
                      healthScore === 'WARNING' && "text-amber-500",
                      healthScore === 'CRITICAL' && "text-red-500"
                    )}>
                       {healthScore === 'HEALTHY' ? 'NORMAL' : healthScore === 'WARNING' ? 'DİKKAT' : 'KRİTİK'}
                    </span>
                 )}
              </div>
              
              {!isCollapsed && (
                <div className="grid grid-cols-2 gap-1 mt-1">
                   <div className="bg-[#0D1016] p-1 rounded border border-[#1F2937] text-center">
                      <div className="text-[7px] text-gray-500 font-bold uppercase">NANOS</div>
                      <div className="text-[9px] font-mono text-blue-400 font-bold">{onlineNanos}/{data.nanos.length}</div>
                   </div>
                   <div className="bg-[#0D1016] p-1 rounded border border-[#1F2937] text-center">
                      <div className="text-[7px] text-gray-500 font-bold uppercase">ALERTS</div>
                      <div className={cn("text-[9px] font-mono font-bold", activeAlerts > 0 ? "text-amber-500" : "text-gray-500")}>{activeAlerts}</div>
                   </div>
                </div>
              )}
           </div>
        </div>

        <nav className="space-y-1">
          {tabs.map((tab) => {
            const active = currentTab === tab.id;
            const Icon = tab.icon;
            
            return (
              <button
                key={tab.id}
                title={isCollapsed ? tab.label : undefined}
                onClick={() => onChangeTab(tab.id)}
                className={cn(
                  "w-full flex items-center rounded text-[11px] font-bold transition-colors border",
                  isCollapsed ? "justify-center py-2 px-0" : "space-x-2 px-2 py-2",
                  active 
                    ? "bg-[#0D1016] text-[#F97316] border-[#374151]" 
                    : "text-gray-400 hover:bg-[#1C2029] hover:text-gray-200 border-transparent"
                )}
              >
                <Icon size={16} />
                {!isCollapsed && <span>{tab.label}</span>}
              </button>
            );
          })}

          <div className="my-2 border-t border-[#374151]" />

          <button 
             title={isCollapsed ? "Yapılandırma" : undefined}
             onClick={() => onChangeTab('settings')}
             className={cn(
               "w-full flex items-center rounded text-[11px] font-bold transition-colors border",
               isCollapsed ? "justify-center py-2 px-0" : "space-x-2 px-2 py-2",
               currentTab === 'settings' 
                  ? "bg-[#0D1016] text-[#F97316] border-[#374151]" 
                  : "text-gray-400 hover:bg-[#1C2029] hover:text-gray-200 border-transparent"
             )}
          >
            <Settings size={16} />
            {!isCollapsed && <span>Yapılandırma</span>}
          </button>
        </nav>
      </div>
      
      <div className={cn("mt-auto border-t border-[#374151]", isCollapsed ? "p-2" : "p-3")}>
        <button 
           disabled={isProcessActive}
           title={isCollapsed ? (isProcessActive ? "Sistem Aktif - Çıkış Yapılamaz" : "Çıkış") : undefined}
           onClick={onLogout}
           className={cn(
             "w-full flex items-center mt-1 rounded text-[11px] font-bold transition-all",
             isCollapsed ? "justify-center py-2 px-0" : "space-x-2 px-2 py-2",
             isProcessActive 
               ? "text-gray-600 cursor-not-allowed opacity-50" 
               : "text-red-500/70 hover:text-red-500 hover:bg-red-500/5"
           )}
        >
          <LogOut size={16} />
          {!isCollapsed && <span>Oturumu Kapat</span>}
        </button>

        {!isCollapsed && (
          <div className="mt-2 text-[9px] text-gray-500 text-center font-mono truncate">
            Yazılım: 2.1.4a | API: TAMAM
          </div>
        )}
      </div>
    </div>
  );
}

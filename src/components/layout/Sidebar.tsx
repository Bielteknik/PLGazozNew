import React, { useState } from 'react';
import { LayoutDashboard, Sliders, History, AlertTriangle, Settings, Power, Server, ChevronLeft, ChevronRight, Lock, Unlock, ShieldCheck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SystemMode } from '../../types/system';

interface SidebarProps {
  currentTab: string;
  onChangeTab: (tab: string) => void;
  systemMode: SystemMode;
  isEngineerMode: boolean;
  onToggleEngineerMode: () => void;
}

export function Sidebar({ currentTab, onChangeTab, systemMode, isEngineerMode, onToggleEngineerMode }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);

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
        <div className="mb-4">
           {!isCollapsed && <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 border-l-2 border-[#F97316] pl-2 px-2">Sistem Durumu</div>}
           <div 
             title={systemMode === 'OTOMATİK' ? 'OTOMATİK' : systemMode === 'ARIZA' ? 'HATA' : systemMode === 'BEKLEMEDE' ? 'BEKLEMEDE' : systemMode === 'BASLATMA' ? 'AÇILIŞ' : 'MANUEL'}
             className={cn(
             "py-1.5 rounded flex items-center font-mono text-[10px]",
             isCollapsed ? "justify-center px-0" : "px-2 space-x-2",
             systemMode === 'OTOMATİK' && "bg-[#052e16] text-[#4ade80] border border-[#14532d]",
             systemMode === 'MANUEL' && "bg-[#381a03] text-[#fdba74] border border-[#7c2d12]",
             systemMode === 'ARIZA' && "bg-[#450a0a] text-[#fca5a5] border border-[#7f1d1d]",
             (systemMode === 'BASLATMA' || systemMode === 'BEKLEMEDE') && "bg-[#0D1016] text-gray-400 border border-[#1F2937]"
           )}>
             <Power size={isCollapsed ? 16 : 12} />
             {!isCollapsed && <span>{systemMode === 'OTOMATİK' ? 'OTOMATİK' : systemMode === 'ARIZA' ? 'HATA' : systemMode === 'BEKLEMEDE' ? 'BEKLEMEDE' : systemMode === 'BASLATMA' ? 'AÇILIŞ' : 'MANUEL'}</span>}
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
        </nav>
      </div>
      
      <div className={cn("mt-auto border-t border-[#374151]", isCollapsed ? "p-1" : "p-3")}>
        <button 
           title={isCollapsed ? "Mühendis Modu" : undefined}
           onClick={onToggleEngineerMode}
           className={cn(
             "w-full mb-1 flex items-center rounded text-[10px] font-black transition-all border",
             isCollapsed ? "justify-center py-2 px-0" : "space-x-2 px-2 py-1.5",
             isEngineerMode 
               ? "bg-[#422006] text-[#fbbf24] border-[#92400e] shadow-[0_0_10px_rgba(251,191,36,0.15)]" 
               : "bg-[#0D1016] text-gray-500 border-transparent hover:border-gray-700"
           )}
        >
          {isEngineerMode ? <ShieldCheck size={16} /> : <Lock size={16} />}
          {!isCollapsed && <span>{isEngineerMode ? 'MÜHENDİS MODU' : 'OPERATÖR MODU'}</span>}
        </button>

        <button 
           title={isCollapsed ? "Yapılandırma" : undefined}
           onClick={() => onChangeTab('settings')}
           className={cn(
             "w-full flex items-center rounded text-[11px] font-bold transition-colors",
             isCollapsed ? "justify-center py-2 px-0" : "space-x-2 px-2 py-2",
             currentTab === 'settings' ? "bg-[#0D1016] text-[#F97316]" : "text-gray-400 hover:bg-[#1C2029] hover:text-gray-200"
           )}
        >
          <Settings size={16} />
          {!isCollapsed && <span>Yapılandırma</span>}
        </button>
        {!isCollapsed && (
          <div className="mt-2 text-[8px] text-gray-500 text-center font-mono truncate leading-none">
            PALANDÖKEN V2.1 | API: TAMAM
          </div>
        )}
      </div>
    </div>
  );
}

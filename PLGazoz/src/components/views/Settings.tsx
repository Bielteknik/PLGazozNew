import React, { useState } from 'react';
import { 
  Database, 
  Settings as SettingsIcon,
  Plus,
  Trash2,
  ChevronRight,
  Save,
  X,
  Droplet,
  Timer,
  Zap,
  Network,
  Shield,
  Activity,
  FileText,
  Info,
  Clock,
  Box
} from 'lucide-react';
import { SystemData, Recipe, SystemConfig } from '../../types/system';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface SettingsProps {
  data: SystemData;
  onUpdateConfig: (config: Partial<SystemConfig>) => void;
  onUpdateRecipe: (id: string, updates: Partial<Recipe>) => void;
  onAddRecipe: (recipe: Recipe) => void;
  onRemoveRecipe: (id: string) => void;
  onSelectRecipe: (id: string) => void;
  onUpdateValve: (id: number, updates: Partial<any>) => void;
  onUpdateSensor: (id: string, updates: Partial<any>) => void;
  onUpdateGate: (id: string, updates: Partial<any>) => void;
  onUpdateSystemGate: (target: 'inputGate' | 'outputGate', updates: Partial<any>) => void;
  onUpdateDeviceConfig: (id: string, updates: Partial<any>) => void;
}

type SettingsTab = 'RECIPES' | 'HARDWARE' | 'NETWORK' | 'SYSTEM';

export function Settings({ 
  data, 
  onUpdateConfig, 
  onUpdateRecipe, 
  onAddRecipe, 
  onRemoveRecipe,
  onSelectRecipe,
  onUpdateValve,
  onUpdateSensor,
  onUpdateGate,
  onUpdateSystemGate,
  onUpdateDeviceConfig
}: SettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('RECIPES');
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [recipeSubTab, setRecipeSubTab] = useState<'BASIC' | 'SODA_PARAMS' | 'VALVES'>('BASIC');
  const [recipeSortOrder, setRecipeSortOrder] = useState<'asc' | 'desc'>('asc');

  const [devicePorts, setDevicePorts] = useState<Record<string, string>>({});
  const [deviceBaudrates, setDeviceBaudrates] = useState<Record<string, number>>({});

  const getDevicePort = (id: string, defaultPort: string | null) => {
    return devicePorts[id] !== undefined ? devicePorts[id] : (defaultPort || '');
  };

  const getDeviceBaudrate = (id: string, defaultBaudrate: number | null) => {
    return deviceBaudrates[id] !== undefined ? deviceBaudrates[id] : (defaultBaudrate || 115200);
  };
  
  const sortedRecipes = [...data.recipes].sort((a, b) => {
    if (recipeSortOrder === 'asc') return a.name.localeCompare(b.name);
    return b.name.localeCompare(a.name);
  });
  
  const editingRecipe = data.recipes.find(r => r.id === editingRecipeId);

  const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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

  const handleAddRecipe = () => {
    const newId = `REC-${Date.now()}`;
    const newRecipe: Recipe = {
      id: newId,
      name: 'Yeni Gazoz Reçetesi',
      volumeMl: 250,
      targetCount: 4,
      fillTimeMs: 2500,
      settlingTimeMs: 600,
      dripWaitTimeMs: 1000,
      description: 'Hassas dolum ünitesi üzerinden üretilen zenginleştirilmiş yeni gazoz formülü.',
      activeValves: [1, 2, 3, 4],
      co2PressureBar: 3.5,
      syrupRatioPercent: 12.0,
      targetTempCelsius: 4.0,
      beverageType: 'Sade',
      carbonationLevel: 'ORTA',
      cappingTorqueNm: 2.2
    };
    onAddRecipe(newRecipe);
    setEditingRecipeId(newId);
    setRecipeSubTab('BASIC');
  };

  return (
    <div className="flex flex-col h-full overflow-hidden space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-[#1C2029] border border-[#374151] p-3 rounded shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-1.5 bg-orange-500/10 rounded border border-orange-500/20">
            <SettingsIcon className="text-orange-500" size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-200">SİSTEM KONFİGÜRASYONU</h2>
            <p className="text-[10px] text-gray-500">Üretim reçetelerini, donanım limitlerini ve ağ ayarlarını yönetin.</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 border-b border-[#2D333F] shrink-0">
        {[
          { id: 'RECIPES', label: 'ÜRETİM REÇETELERİ', icon: Database },
          { id: 'HARDWARE', label: 'DONANIM PARAMETRELERİ', icon: Zap },
          { id: 'NETWORK', label: 'AĞ & IOT', icon: Network },
          { id: 'SYSTEM', label: 'SİSTEM GÜVENLİĞİ', icon: Shield },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as SettingsTab);
              setEditingRecipeId(null);
            }}
            className={cn(
              "flex items-center space-x-2 px-4 py-2 text-[10px] font-bold transition-all border-b-2",
              activeTab === tab.id 
                ? "border-orange-500 text-orange-400 bg-orange-500/5" 
                : "border-transparent text-gray-500 hover:text-gray-300"
            )}
          >
            <tab.icon size={14} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {activeTab === 'RECIPES' && (
            <motion.div
              key="recipes"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="h-full flex flex-col md:flex-row gap-4 overflow-y-auto md:overflow-hidden pb-4 md:pb-0"
            >
              {/* Recipe List */}
              <div className={cn(
                "transition-all duration-300 flex flex-col shrink-0",
                editingRecipeId ? "w-full md:w-1/3" : "w-full"
              )}>
                <div className="bg-[#151921] border border-[#2D333F] rounded flex flex-col h-full overflow-hidden">
                  <div className="p-3 border-b border-[#2D333F] flex justify-between items-center bg-[#1C2029]">
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center">
                      <Database size={12} className="mr-2" /> Kayıtlı Reçeteler
                    </h3>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setRecipeSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                        className="p-1 hover:bg-gray-800 rounded transition-colors text-gray-500 flex items-center gap-1"
                        title={recipeSortOrder === 'asc' ? 'A-Z Sıralı' : 'Z-A Sıralı'}
                      >
                        <Activity size={10} className={cn("transition-transform", recipeSortOrder === 'desc' && "rotate-180")} />
                        <span className="text-[8px] font-bold">{recipeSortOrder === 'asc' ? 'A-Z' : 'Z-A'}</span>
                      </button>
                      <button 
                        onClick={handleAddRecipe}
                        disabled={data.mode === 'OTOMATİK'}
                        className="px-2 py-1 bg-green-900/30 border border-green-700/50 text-green-400 text-[9px] font-bold rounded hover:bg-green-800 transition-colors flex items-center gap-1 disabled:opacity-50"
                      >
                        <Plus size={10} />
                        YENİ REÇETE
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                    {sortedRecipes.map((recipe) => (
                      <button
                        key={recipe.id}
                        onClick={() => setEditingRecipeId(recipe.id)}
                        className={cn(
                          "w-full text-left p-3 rounded border transition-all group relative overflow-hidden",
                          editingRecipeId === recipe.id
                            ? "bg-[#1C2029] border-orange-500/50 shadow-lg shadow-orange-500/5"
                            : "bg-[#0D1016] border-[#1F2937] hover:border-[#374151]"
                        )}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className={cn(
                            "text-xs font-bold transition-colors",
                            editingRecipeId === recipe.id ? "text-orange-400" : "text-gray-300"
                          )}>
                            {recipe.name}
                          </span>
                          <span className="text-[9px] font-mono text-gray-600 font-bold">{recipe.id}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                           <div className="flex items-center text-[9px] text-gray-500 font-bold">
                              <Droplet size={10} className="mr-1 text-blue-500" />
                              {recipe.volumeMl}ml
                           </div>
                           <div className="flex items-center text-[9px] text-gray-500 font-bold">
                              <Clock size={10} className="mr-1 text-orange-500" />
                              {recipe.fillTimeMs}ms
                           </div>
                           {data.config.recipeId === recipe.id && (
                             <span className="ml-auto bg-blue-500/10 text-blue-400 text-[8px] px-1.5 py-0.5 rounded border border-blue-500/20 font-bold uppercase italic">Aktif</span>
                           )}
                        </div>
                        {editingRecipeId === recipe.id && (
                          <div className="absolute right-0 top-0 bottom-0 w-1 bg-orange-500" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Detail Panel */}
              <AnimatePresence>
                {editingRecipeId && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex-1 bg-[#151921] border border-[#2D333F] rounded flex flex-col overflow-hidden"
                  >
                    <div className="p-3 border-b border-[#2D333F] flex justify-between items-center bg-[#1C2029]">
                       <div className="flex items-center gap-3">
                          <div className="p-1 bg-orange-500/10 rounded">
                             <SettingsIcon size={14} className="text-orange-400" />
                          </div>
                          <h3 className="text-xs font-bold text-gray-200">REÇETE DETAYI</h3>
                       </div>
                       <div className="flex items-center gap-2">
                          {data.config.recipeId !== editingRecipe?.id && (
                             <button
                                onClick={() => onSelectRecipe(editingRecipeId)}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded transition-colors shadow-lg shadow-blue-900/20"
                             >
                                REÇETEYİ AKTİFLEŞTİR
                             </button>
                          )}
                          <button 
                            onClick={() => setEditingRecipeId(null)}
                            className="p-1 hover:bg-gray-800 rounded transition-colors text-gray-500"
                          >
                             <X size={16} />
                          </button>
                       </div>
                    </div>

                    {/* Tabbed Card Navigation */}
                    <div className="flex bg-[#11141D] border-b border-[#2D333F] shrink-0 p-1 gap-1">
                      {[
                        { id: 'BASIC', label: 'Temel Bilgiler', desc: 'İsim, Tip, Boyut', activeColor: 'border-orange-500 text-orange-400 bg-orange-500/5' },
                        { id: 'SODA_PARAMS', label: 'Gazoz Ayarları', desc: 'CO2, Şurup, Tork', activeColor: 'border-emerald-500 text-emerald-400 bg-emerald-500/5' },
                        { id: 'VALVES', label: 'Valfler', desc: 'Aktif Kanallar', activeColor: 'border-blue-500 text-blue-400 bg-blue-500/5' }
                      ].map((t) => {
                        const isActive = recipeSubTab === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setRecipeSubTab(t.id as any)}
                            className={cn(
                              "flex-1 py-1 px-1.5 rounded-sm border-b-2 text-center flex flex-col items-center justify-center transition-all",
                              isActive 
                                ? t.activeColor + " border-b-2 font-black" 
                                : "border-transparent text-gray-400 hover:text-gray-200 hover:bg-[#1C2029]/35"
                            )}
                          >
                            <span className="text-[10px] font-bold uppercase tracking-wider">{t.label}</span>
                            <span className="text-[7.5px] text-gray-500 tracking-tight">{t.desc}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                      {editingRecipe && (
                        <div className="space-y-4">
                          {/* SUB-TAB 1: BASIC INFO */}
                          {recipeSubTab === 'BASIC' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                               <div className="col-span-2 space-y-1.5">
                                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Reçete / Ürün Adı</label>
                                  <input 
                                    type="text"
                                    value={editingRecipe.name}
                                    onChange={(e) => onUpdateRecipe(editingRecipe.id, { name: e.target.value })}
                                    disabled={data.mode === 'OTOMATİK'}
                                    className="w-full bg-[#0D1016] border border-[#374151] rounded px-3 py-2 text-xs text-gray-200 focus:border-orange-500/50 outline-none transition-all disabled:opacity-50"
                                    placeholder="Örn: Klasik Sade Gazoz (250ml)"
                                  />
                               </div>

                               <div className="space-y-1.5">
                                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Gazoz Grubu</label>
                                  <select
                                    value={editingRecipe.beverageType || 'Sade'}
                                    onChange={(e) => onUpdateRecipe(editingRecipe.id, { beverageType: e.target.value as any })}
                                    disabled={data.mode === 'OTOMATİK'}
                                    className="w-full bg-[#0D1016] border border-[#374151] rounded px-3 py-2 text-xs text-gray-300 font-bold focus:border-orange-500/50 outline-none transition-all disabled:opacity-50"
                                  >
                                    <option value="Sade">Sade (Klasik)</option>
                                    <option value="Meyveli">Meyveli (Doğal Özlü)</option>
                                    <option value="Aromatik">Aromatik (Zencefil vs.)</option>
                                    <option value="Karışık">Özel Karışım (Gurme)</option>
                                  </select>
                               </div>

                               <div className="space-y-1.5">
                                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Hedef Hacim (ml)</label>
                                  <input 
                                    type="number"
                                    value={editingRecipe.volumeMl}
                                    onChange={(e) => onUpdateRecipe(editingRecipe.id, { volumeMl: Number(e.target.value) })}
                                    disabled={data.mode === "OTOMATİK"}
                                    className="w-full bg-[#0D1016] border border-[#374151] rounded px-3 py-2 text-xs text-blue-400 font-black focus:border-[#374151] outline-none transition-all disabled:opacity-50"
                                  />
                               </div>

                               <div className="space-y-1.5">
                                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Dolum Süresi (ms)</label>
                                  <input 
                                    type="number"
                                    value={editingRecipe.fillTimeMs}
                                    onChange={(e) => onUpdateRecipe(editingRecipe.id, { fillTimeMs: Number(e.target.value) })}
                                    disabled={data.mode === "OTOMATİK"}
                                    className="w-full bg-[#0D1016] border border-[#374151] rounded px-3 py-2 text-xs text-orange-400 font-black focus:border-[#374151] outline-none transition-all disabled:opacity-50"
                                  />
                               </div>

                               <div className="space-y-1.5">
                                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider font-mono">Hedef Şişe Sayısı</label>
                                  <input 
                                    type="number"
                                    value={editingRecipe.targetCount}
                                    onChange={(e) => onUpdateRecipe(editingRecipe.id, { targetCount: Number(e.target.value) })}
                                    disabled={data.mode === "OTOMATİK"}
                                    className="w-full bg-[#0D1016] border border-[#374151] rounded px-3 py-2 text-xs text-emerald-400 font-black focus:border-[#374151] outline-none transition-all disabled:opacity-50"
                                  />
                                </div>

                               <div className="col-span-2 space-y-1.5 pt-2 border-t border-[#1C2029]">
                                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Reçete Notları / Açıklama</label>
                                  <textarea 
                                    value={editingRecipe.description || ''}
                                    onChange={(e) => onUpdateRecipe(editingRecipe.id, { description: e.target.value })}
                                    disabled={data.mode === "OTOMATİK"}
                                    rows={3}
                                    className="w-full bg-[#0D1016] border border-[#374151] rounded px-3 py-2 text-xs text-gray-400 focus:border-[#374151] outline-none transition-all resize-none disabled:opacity-50 font-medium"
                                    placeholder="Bu formüle özel üretim tüyoları veya kalite hedefleri yazın..."
                                  />
                               </div>
                            </div>
                          )}

                          {/* SUB-TAB 2: SODA PRODUCTION PARAMETERS (ENRICHED) */}
                          {recipeSubTab === 'SODA_PARAMS' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                               <div className="col-span-2 bg-[#10141D]/40 p-2 rounded border border-[#232936] flex items-center justify-between">
                                  <h4 className="text-[9.5px] font-bold text-emerald-400 uppercase tracking-wider flex items-center">
                                     <Zap size={11} className="mr-1.5 my-auto animate-pulse" /> Gazoz Üretim Parametresi
                                  </h4>
                                  <span className="text-[8px] font-mono text-gray-400 font-bold uppercase italic border border-[#1C2029] px-1 rounded">Basınç & Fiziksel Karışım</span>
                               </div>

                               <div className="space-y-1.5">
                                  <div className="flex justify-between items-center">
                                     <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Likit CO2 Basıncı</label>
                                     <span className="text-[9.5px] font-mono font-black text-emerald-400">{(editingRecipe.co2PressureBar ?? 3.5).toFixed(1)} Bar</span>
                                  </div>
                                  <input 
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="6"
                                    value={editingRecipe.co2PressureBar ?? 3.5}
                                    onChange={(e) => onUpdateRecipe(editingRecipe.id, { co2PressureBar: Number(e.target.value) })}
                                    disabled={data.mode === "OTOMATİK"}
                                    className="w-full bg-[#0D1016] border border-[#374151] rounded px-2.5 py-1.5 text-xs text-emerald-400 font-black focus:border-[#374151] outline-none transition-all disabled:opacity-50"
                                  />
                                  <p className="text-[8px] text-gray-500 uppercase">Gazlama tankı karbonatör basınç hedefi.</p>
                               </div>

                               <div className="space-y-1.5">
                                  <div className="flex justify-between items-center">
                                     <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Konsantre Şurup Oranı</label>
                                     <span className="text-[9.5px] font-mono font-black text-blue-400">{(editingRecipe.syrupRatioPercent ?? 12.0).toFixed(1)} %</span>
                                  </div>
                                  <input 
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="50"
                                    value={editingRecipe.syrupRatioPercent ?? 12.0}
                                    onChange={(e) => onUpdateRecipe(editingRecipe.id, { syrupRatioPercent: Number(e.target.value) })}
                                    disabled={data.mode === "OTOMATİK"}
                                    className="w-full bg-[#0D1016] border border-[#374151] rounded px-2.5 py-1.5 text-xs text-blue-400 font-black focus:border-[#374151] outline-none transition-all disabled:opacity-50"
                                  />
                                  <p className="text-[8px] text-gray-500 uppercase">Şeker-meyve özü karışım mikser oranı.</p>
                               </div>

                               <div className="space-y-1.5">
                                  <div className="flex justify-between items-center">
                                     <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Dolum Sıcaklığı</label>
                                     <span className="text-[9.5px] font-mono font-black text-rose-400">{(editingRecipe.targetTempCelsius ?? 4.0).toFixed(1)} °C</span>
                                  </div>
                                  <input 
                                    type="number"
                                    step="0.1"
                                    value={editingRecipe.targetTempCelsius ?? 4.0}
                                    onChange={(e) => onUpdateRecipe(editingRecipe.id, { targetTempCelsius: Number(e.target.value) })}
                                    disabled={data.mode === "OTOMATİK"}
                                    className="w-full bg-[#0D1016] border border-[#374151] rounded px-2.5 py-1.5 text-xs text-rose-400 font-black focus:border-[#374151] outline-none transition-all disabled:opacity-50"
                                  />
                                  <p className="text-[8px] text-gray-500 uppercase">Optimum CO2 absorbsiyonu için &lt; 5.0°C olmalı.</p>
                               </div>

                               <div className="space-y-1.5">
                                  <div className="flex justify-between items-center">
                                     <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Kapak Tork Gücü</label>
                                     <span className="text-[9.5px] font-mono font-black text-orange-400">{(editingRecipe.cappingTorqueNm ?? 2.2).toFixed(1)} Nm</span>
                                  </div>
                                  <input 
                                    type="number"
                                    step="0.1"
                                    min="0.5"
                                    max="5"
                                    value={editingRecipe.cappingTorqueNm ?? 2.2}
                                    onChange={(e) => onUpdateRecipe(editingRecipe.id, { cappingTorqueNm: Number(e.target.value) })}
                                    disabled={data.mode === "OTOMATİK"}
                                    className="w-full bg-[#0D1016] border border-[#374151] rounded px-2.5 py-1.5 text-xs text-orange-400 font-black focus:border-[#374151] outline-none transition-all disabled:opacity-50"
                                  />
                                  <p className="text-[8px] text-gray-500 uppercase">Kapatıcı kafa tork gücü.</p>
                               </div>

                               <div className="col-span-2 space-y-2 pt-2 border-t border-[#1C2029]">
                                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Gazlama Seviyesi</label>
                                  <div className="grid grid-cols-3 gap-2">
                                     {['DÜŞÜK', 'ORTA', 'YÜKSEK'].map((level) => {
                                        const isSelected = (editingRecipe.carbonationLevel || 'ORTA') === level;
                                        return (
                                           <button
                                              key={level}
                                              type="button"
                                              disabled={data.mode === "OTOMATİK"}
                                              onClick={() => onUpdateRecipe(editingRecipe.id, { carbonationLevel: level as any })}
                                              className={cn(
                                                 "py-1 px-1.5 rounded font-black text-[10px] border transition-all uppercase",
                                                 isSelected
                                                    ? "bg-emerald-600/15 border-emerald-500 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.1)]"
                                                    : "bg-[#0D1016] border-[#1F2937] text-gray-500"
                                              )}
                                           >
                                              {level}
                                           </button>
                                        );
                                     })}
                                  </div>
                               </div>

                               <div className="space-y-1.5 pt-1.5">
                                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Sıvı Dengeleme (ms)</label>
                                  <input 
                                    type="number"
                                    value={editingRecipe.settlingTimeMs}
                                    onChange={(e) => onUpdateRecipe(editingRecipe.id, { settlingTimeMs: Number(e.target.value) })}
                                    disabled={data.mode === "OTOMATİK"}
                                    className="w-full bg-[#0D1016] border border-[#374151] rounded px-3 py-2 text-xs text-gray-300 font-bold focus:border-[#374151] outline-none transition-all disabled:opacity-50"
                                  />
                                  <p className="text-[8px] text-gray-500 uppercase">Köpük sönme fazı süresi.</p>
                               </div>

                               <div className="space-y-1.5 pt-1.5">
                                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">İğne Damla Temizleme (ms)</label>
                                  <input 
                                    type="number"
                                    value={editingRecipe.dripWaitTimeMs}
                                    onChange={(e) => onUpdateRecipe(editingRecipe.id, { dripWaitTimeMs: Number(e.target.value) })}
                                    disabled={data.mode === "OTOMATİK"}
                                    className="w-full bg-[#0D1016] border border-[#374151] rounded px-3 py-2 text-xs text-gray-300 font-bold focus:border-[#374151] outline-none transition-all disabled:opacity-50"
                                  />
                                  <p className="text-[8px] text-gray-500 uppercase">Damla süzülme bekleme süresi.</p>
                                </div>
                            </div>
                          )}

                          {/* SUB-TAB 3: VALVES SETTINGS */}
                          {recipeSubTab === 'VALVES' && (
                            <div className="space-y-3">
                               <div className="flex justify-between items-center bg-[#11141d]/50 p-2 rounded border border-[#232936]/40">
                                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center">
                                     <Droplet size={12} className="mr-2 text-blue-400 animate-pulse" /> Aktif Valf Seçimi (Maks. 8 Valf Dolum Başlığı)
                                  </label>
                                  <span className="text-[10px] font-mono font-bold text-blue-400 uppercase tracking-widest bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/25">
                                     {(editingRecipe.activeValves || Array.from({ length: 8 }, (_, idx) => idx + 1)).length} / 8 Aktif
                                  </span>
                               </div>
                               <p className="text-[9px] text-gray-400 uppercase font-semibold leading-relaxed">
                                  Bu reçetede aktif olmasını istediğiniz silindir valflerini etkinleştirin (Haberleşme üzerinden Raspberry Pi 5 UART ile Nano 1'e iletilir). Sistem, aktif valf sayısı kadar ({(editingRecipe.activeValves || Array.from({ length: 8 }, (_, idx) => idx + 1)).length} adet) şişe geçtiğinde kapıyı kapatıp doluma başlayacaktır.
                                </p>
                               <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 pt-1 font-bold">
                                  {Array.from({ length: 8 }, (_, i) => {
                                     const valveId = i + 1;
                                     const activeValvesList = editingRecipe.activeValves || Array.from({ length: 8 }, (_, idx) => idx + 1);
                                     const isActive = activeValvesList.includes(valveId);
                                     return (
                                        <div key={valveId} className="flex flex-col items-center space-y-1 bg-[#11141D] p-1.5 rounded border border-[#232936]">
                                           <button
                                              type="button"
                                              disabled={data.mode === "OTOMATİK"}
                                              onClick={() => {
                                                 const isValveActive = activeValvesList.includes(valveId);
                                                 const newActiveValves = isValveActive 
                                                   ? activeValvesList.filter(id => id !== valveId) 
                                                   : [...activeValvesList, valveId].sort((a,b)=>a-b);
                                                 onUpdateRecipe(editingRecipe.id, { 
                                                   activeValves: newActiveValves,
                                                   targetCount: newActiveValves.length
                                                 });
                                              }}
                                              className={cn(
                                                 "w-full p-1.5 rounded border text-[10px] font-bold transition-all flex flex-col items-center justify-center gap-0.5 focus:outline-none disabled:opacity-40",
                                                 isActive
                                                   ? "bg-blue-600/15 border-blue-500 text-blue-400 font-extrabold shadow-[0_0_12px_rgba(59,130,246,0.15)]"
                                                   : "bg-[#0A0D14] border-[#1F2937] text-gray-500 hover:border-gray-700"
                                              )}
                                           >
                                              <span className="text-[7.5px] uppercase text-gray-500">Valf</span>
                                              <span className="text-xs font-black font-mono">{valveId}</span>
                                           </button>
                                           <div className="relative w-full">
                                              <input
                                                 type="number"
                                                 placeholder={`${editingRecipe.fillTimeMs}`}
                                                 disabled={data.mode === "OTOMATİK" || !isActive}
                                                 value={editingRecipe.valveDurations?.[valveId] ?? ""}
                                                 onChange={(e) => {
                                                    const val = e.target.value === "" ? undefined : Number(e.target.value);
                                                    const currentDurations = editingRecipe.valveDurations || {};
                                                    const nextDurations = { ...currentDurations };
                                                    if (val === undefined) {
                                                       delete nextDurations[valveId];
                                                    } else {
                                                       nextDurations[valveId] = val;
                                                    }
                                                    onUpdateRecipe(editingRecipe.id, {
                                                       valveDurations: nextDurations
                                                    });
                                                 }}
                                                 className="w-full bg-[#07090E] border border-[#1F2937] rounded px-1 py-1 text-center text-[9px] font-mono font-black text-blue-300 placeholder-gray-600 focus:border-blue-500/50 outline-none transition-all disabled:opacity-30 disabled:pointer-events-none"
                                              />
                                              <span className="absolute right-0.5 top-1/2 -translate-y-1/2 text-[6.5px] text-gray-600 font-black uppercase pointer-events-none pr-0.5 font-mono">MS</span>
                                           </div>
                                        </div>
                                     );
                                  })}
                               </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="p-3 border-t border-[#2D333F] bg-[#1C2029] flex justify-between items-center">
                       <button
                         onClick={() => {
                            if (editingRecipeId) {
                               onRemoveRecipe(editingRecipeId);
                               setEditingRecipeId(null);
                            }
                         }}
                         disabled={data.mode === 'OTOMATİK' || data.recipes.length <= 1}
                         className="flex items-center gap-2 text-red-500 text-[10px] font-bold hover:text-red-400 transition-colors disabled:opacity-30"
                       >
                          <Trash2 size={12} />
                          REÇETEYİ KALICI OLARAK SİL
                       </button>
                       <div className="text-[9px] font-medium text-gray-500 italic">
                          Değişiklikler anlık olarak kaydedilir.
                       </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {activeTab === 'HARDWARE' && (
            <motion.div
              key="hardware"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full overflow-y-auto pr-2 custom-scrollbar"
            >
              <div className="bg-[#151921] border border-[#2D333F] rounded p-4 space-y-6">
                <h3 className="text-[11px] font-bold text-gray-300 border-l-2 border-orange-500 pl-2 uppercase tracking-wider mb-4 flex items-center">
                   <Timer size={14} className="mr-2 text-orange-500" /> Sinyal Zamanlama (Debounce)
                </h3>
                
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between mb-2 px-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Giriş Lazer Debounce</label>
                      <span className="text-orange-400 font-mono text-[10px] font-bold">{data.config.inputDebounceMs} MS</span>
                    </div>
                    <input 
                      type="range" 
                      name="inputDebounceMs"
                      min="5" max="250"
                      value={data.config.inputDebounceMs}
                      onChange={handleConfigChange}
                      disabled={data.mode === 'OTOMATİK'}
                      className="w-full h-1.5 bg-[#0D1016] rounded-full appearance-none cursor-pointer accent-orange-500"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2 px-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Çıkış Lazer Debounce</label>
                      <span className="text-orange-400 font-mono text-[10px] font-bold">{data.config.outputDebounceMs} MS</span>
                    </div>
                    <input 
                      type="range" 
                      name="outputDebounceMs"
                      min="5" max="250"
                      value={data.config.outputDebounceMs}
                      onChange={handleConfigChange}
                      disabled={data.mode === 'OTOMATİK'}
                      className="w-full h-1.5 bg-[#0D1016] rounded-full appearance-none cursor-pointer accent-orange-500"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-[#151921] border border-[#2D333F] rounded p-4 space-y-6">
                <h3 className="text-[11px] font-bold text-gray-300 border-l-2 border-blue-500 pl-2 uppercase tracking-wider mb-4 flex items-center">
                   <Activity size={14} className="mr-2 text-blue-500" /> Solenoid Kilit & Röle Parametreleri
                </h3>
                
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between mb-2 px-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Gate (Kapı) Hız Çarpanı</label>
                      <span className="text-blue-400 font-mono text-[10px] font-bold">%{data.config.gateSpeedPercent}</span>
                    </div>
                    <input 
                      type="range" 
                      name="gateSpeedPercent"
                      min="10" max="100"
                      value={data.config.gateSpeedPercent}
                      onChange={handleConfigChange}
                      disabled={data.mode === 'OTOMATİK'}
                      className="w-full h-1.5 bg-[#0D1016] rounded-full appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>
                  
                  <div className="p-3 bg-[#0D1016] border border-[#1F2937] rounded flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-gray-300 uppercase">Röle Inversion (Active-Low)</div>
                      <div className="text-[8px] text-gray-600 uppercase font-mono mt-0.5">Sinyal terslemesi gerekir mi?</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" name="relayInversion" checked={data.config.relayInversion} onChange={handleConfigChange} disabled={data.mode === 'OTOMATİK'} className="sr-only peer" />
                      <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Mikrodenetleyici Bağlantı Ayarları */}
              <div className="col-span-1 md:col-span-2 bg-[#151921] border border-[#2D333F] rounded p-4">
                 <h3 className="text-[11px] font-bold text-gray-300 border-l-2 border-orange-500 pl-2 uppercase tracking-wider mb-4 flex items-center">
                    <Network size={14} className="mr-2 text-orange-500" /> Mikrodenetleyici Bağlantıları ve Port Ayarları (Device Serial Config)
                 </h3>
                 
                 <p className="text-[9px] text-gray-400 uppercase font-semibold leading-relaxed mb-4">
                    Sistemdeki kontrol kartlarının (Nano 1, Nano 2 vb.) bağlantı portlarını ve haberleşme hızlarını (Baudrate) buradan yapılandırabilirsiniz. Değişiklikler kaydedildiğinde sistem otomatik olarak canlı bağlantıyı kapatıp yeni port üzerinden asenkron el sıkışma (WHOAMI) başlatacaktır.
                 </p>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(data.devices || []).map(dev => {
                       const isInternal = dev.connection_type === 'INTERNAL';
                       const currentPort = getDevicePort(dev.id, dev.port);
                       const currentBaudrate = getDeviceBaudrate(dev.id, dev.baudrate);

                       return (
                          <div key={dev.id} className="bg-[#0D1016] border border-[#1F2937] p-3 rounded flex flex-col justify-between space-y-3 relative overflow-hidden">
                             {/* Header */}
                             <div className="flex justify-between items-center border-b border-[#1F2937] pb-2">
                                <div className="flex flex-col">
                                   <span className="text-[10px] font-black text-gray-200 uppercase">{dev.name}</span>
                                   <span className="text-[8px] font-mono text-gray-500 font-bold uppercase mt-0.5">ID: {dev.id}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                   <span className={cn(
                                      "px-1.5 py-0.5 rounded text-[8px] font-black border uppercase tracking-widest font-mono",
                                      dev.connection_type === 'UART' && "bg-orange-500/10 border-orange-500/35 text-orange-400",
                                      dev.connection_type === 'USB' && "bg-blue-500/10 border-blue-500/35 text-blue-400",
                                      dev.connection_type === 'INTERNAL' && "bg-purple-500/10 border-purple-500/35 text-purple-400"
                                   )}>
                                      {dev.connection_type}
                                   </span>
                                </div>
                             </div>

                             {/* Fields */}
                             <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                   <label className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Haberleşme Portu</label>
                                   <input
                                      type="text"
                                      disabled={isInternal || data.mode === 'OTOMATİK'}
                                      value={isInternal ? 'DAHİLİ' : currentPort}
                                      placeholder="/dev/ttyUSB0"
                                      className="w-full bg-[#07090e] border border-[#2D333F] rounded px-2.5 py-1.5 text-[10px] font-mono text-orange-400 outline-none disabled:opacity-40"
                                      onChange={(e) => setDevicePorts({ ...devicePorts, [dev.id]: e.target.value })}
                                   />
                                </div>

                                <div className="space-y-1">
                                   <label className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Baudrate (Hız)</label>
                                   <select
                                      disabled={isInternal || data.mode === 'OTOMATİK'}
                                      value={isInternal ? 115200 : currentBaudrate}
                                      className="w-full bg-[#07090e] border border-[#2D333F] rounded px-2 py-1.5 text-[10px] font-mono text-blue-400 outline-none disabled:opacity-40"
                                      onChange={(e) => setDeviceBaudrates({ ...deviceBaudrates, [dev.id]: Number(e.target.value) })}
                                   >
                                      <option value={9600}>9600 BAUD</option>
                                      <option value={19200}>19200 BAUD</option>
                                      <option value={38400}>38400 BAUD</option>
                                      <option value={57600}>57600 BAUD</option>
                                      <option value={115200}>115200 BAUD</option>
                                   </select>
                                </div>
                             </div>

                             {/* Actions */}
                             <div className="flex items-center justify-between pt-1 border-t border-[#1F2937]/50">
                                <div className="flex items-center space-x-2">
                                   <span className="text-[8px] font-bold text-gray-500 uppercase">Aktif mi?</span>
                                   <label className="relative inline-flex items-center cursor-pointer">
                                      <input 
                                         type="checkbox" 
                                         disabled={isInternal || data.mode === 'OTOMATİK'} 
                                         checked={!!dev.enabled} 
                                         onChange={() => {
                                            onUpdateDeviceConfig(dev.id, {
                                               port: currentPort,
                                               baudrate: currentBaudrate,
                                               enabled: !dev.enabled
                                            });
                                         }} 
                                         className="sr-only peer" 
                                      />
                                      <div className="w-7 h-4 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-orange-500"></div>
                                   </label>
                                </div>

                                {!isInternal && (
                                   <button
                                      type="button"
                                      disabled={data.mode === 'OTOMATİK'}
                                      onClick={() => {
                                         onUpdateDeviceConfig(dev.id, {
                                            port: currentPort,
                                            baudrate: currentBaudrate,
                                            enabled: dev.enabled
                                         });
                                      }}
                                      className="px-2 py-0.5 bg-orange-600/10 border border-orange-500/35 hover:bg-orange-500 hover:text-black font-black text-[9px] text-orange-400 rounded transition-all flex items-center gap-1 active:scale-95 disabled:opacity-40"
                                   >
                                      <Save size={10} />
                                      BAĞLANTIYI GÜNCELLE
                                   </button>
                                )}
                             </div>
                          </div>
                       );
                    })}
                 </div>
              </div>

              {/* Pin Configurations */}
              <div className="col-span-1 md:col-span-2 bg-[#151921] border border-[#2D333F] rounded p-4">
                 <h3 className="text-[11px] font-bold text-gray-300 border-l-2 border-emerald-500 pl-2 uppercase tracking-wider mb-4 flex items-center">
                    <Network size={14} className="mr-2 text-emerald-500" /> Donanım Pin Atamaları (I/O Map)
                 </h3>
                 
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-4">
                       <h4 className="text-[9px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-1">Valf Pinleri (Digital Output)</h4>
                       {data.valves.map(valve => (
                          <div key={valve.id} className="flex items-center justify-between gap-2">
                             <span className="text-[10px] text-gray-400 font-mono">Valf {valve.id}</span>
                             <input 
                                type="text"
                                value={valve.pin || ''}
                                placeholder="D1, D2..."
                                className="w-16 bg-[#0D1016] border border-[#374151] rounded px-2 py-1 text-[10px] font-mono text-emerald-400 outline-none"
                                onChange={(e) => onUpdateValve(valve.id, { pin: e.target.value })}
                             />
                          </div>
                       ))}
                    </div>

                    <div className="space-y-4">
                       <h4 className="text-[9px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-1">Sensör Pinleri (Digital Input)</h4>
                       {data.sensors.map(sensor => (
                          <div key={sensor.id} className="flex items-center justify-between gap-2">
                             <span className="text-[10px] text-gray-400 font-mono">{sensor.name}</span>
                             <input 
                                type="text"
                                value={sensor.pin || ''}
                                placeholder="GPIO..."
                                className="w-16 bg-[#0D1016] border border-[#374151] rounded px-2 py-1 text-[10px] font-mono text-blue-400 outline-none"
                                onChange={(e) => onUpdateSensor(sensor.id, { pin: e.target.value })}
                             />
                          </div>
                       ))}
                    </div>

                    <div className="space-y-4">
                       <h4 className="text-[9px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-1">Solenoid Kilit Valf Pinleri (Nano 2)</h4>
                       <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-gray-400 font-mono">Giriş Selenoid Kilidi</span>
                          <input 
                             type="text"
                             value={data.inputGate.pin || ''}
                             placeholder="P1"
                             className="w-16 bg-[#0D1016] border border-[#374151] rounded px-2 py-1 text-[10px] font-mono text-orange-400 outline-none"
                             onChange={(e) => onUpdateSystemGate('inputGate', { pin: e.target.value })}
                          />
                       </div>
                       <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-gray-400 font-mono">Çıkış Selenoid Kilidi</span>
                          <input 
                             type="text"
                             value={data.outputGate.pin || ''}
                             placeholder="P2"
                             className="w-16 bg-[#0D1016] border border-[#374151] rounded px-2 py-1 text-[10px] font-mono text-orange-400 outline-none"
                             onChange={(e) => onUpdateSystemGate('outputGate', { pin: e.target.value })}
                          />
                       </div>
                    </div>
                 </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'NETWORK' && (
            <motion.div
              key="network"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-2xl"
            >
              <div className="bg-[#151921] border border-[#2D333F] rounded p-4 space-y-6">
                <h3 className="text-[11px] font-bold text-gray-300 border-l-2 border-emerald-500 pl-2 uppercase tracking-wider mb-4 flex items-center">
                   <Network size={14} className="mr-2 text-emerald-500" /> Endüstriyel IoT (MQTT)
                </h3>

                <div className="p-4 bg-[#0D1016] border border-[#1F2937] rounded flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className={cn("p-2 rounded", data.config.enableMqtt ? "bg-emerald-500/20 text-emerald-500" : "bg-gray-800 text-gray-600")}>
                       <Network size={20} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-200 uppercase">Telemetri Yayınlama</div>
                      <div className="text-[9px] text-gray-500 uppercase font-mono">Sistem verilerini buluta aktar</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" name="enableMqtt" checked={data.config.enableMqtt} onChange={handleConfigChange} disabled={data.mode === 'OTOMATİK'} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                <div className={cn("space-y-4 transition-all duration-300", !data.config.enableMqtt && "opacity-30 pointer-events-none")}>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Broker URL</label>
                         <input 
                           type="text"
                           name="mqttBrokerUrl"
                           value={data.config.mqttBrokerUrl}
                           onChange={handleConfigChange}
                           placeholder="mqtt://192.168.1.1:1883"
                           className="w-full bg-[#0D1016] border border-[#374151] rounded px-3 py-2 text-xs text-gray-300 font-mono focus:border-emerald-500/50 outline-none"
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Yayın Hızı (Heartbeat ms)</label>
                         <input 
                           type="number"
                           name="heartbeatIntervalMs"
                           value={data.config.heartbeatIntervalMs}
                           onChange={handleConfigChange}
                           className="w-full bg-[#0D1016] border border-[#374151] rounded px-3 py-2 text-xs text-gray-300 font-mono focus:border-emerald-500/50 outline-none"
                         />
                      </div>
                   </div>
                </div>

                <div className="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded flex items-start gap-3 mt-4">
                   <Info size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                   <div className="text-[9px] text-gray-400 font-medium leading-relaxed italic">
                      MQTT bağlantısı üzerinden tüm valf durumları, lazer sayaçları ve hata kodları JSON formatında yayınlanmaktadır. JSON Schema standardı: v1.2.4
                   </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'SYSTEM' && (
            <motion.div
              key="system"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full overflow-y-auto pr-2 custom-scrollbar"
            >
              <div className="bg-[#151921] border border-[#2D333F] rounded p-4 space-y-6">
                <h3 className="text-[11px] font-bold text-gray-300 border-l-2 border-purple-500 pl-2 uppercase tracking-wider mb-4 flex items-center">
                   <Shield size={14} className="mr-2 text-purple-500" /> Güvenlik & Failsafe
                </h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Master Watchdog (ms)</label>
                    <input 
                      type="number" 
                      name="watchdogTimeoutMs"
                      value={data.config.watchdogTimeoutMs}
                      onChange={handleConfigChange}
                      disabled={data.mode === 'OTOMATİK'}
                      className="w-full bg-[#0D1016] border border-[#374151] rounded px-3 py-2 text-xs font-mono text-gray-300 focus:border-purple-500/50 outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Valf açık kalma süresi maksimum (ms)</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        name="manualValveMaxOpenTimeMs"
                        value={data.config.manualValveMaxOpenTimeMs}
                        onChange={handleConfigChange}
                        disabled={data.mode === 'OTOMATİK'}
                        className="w-full bg-[#0D1016] border border-[#374151] rounded px-3 py-2 text-xs font-mono text-orange-400 focus:border-orange-500/50 outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-600">MS</span>
                    </div>
                    <p className="text-[8px] text-gray-600 uppercase font-bold italic">Unutulan valfler için güvenlik limiti</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Acil Durum (E-Stop) Modu</label>
                    <select 
                      name="emergencyStopBehavior"
                      value={data.config.emergencyStopBehavior}
                      onChange={handleConfigChange}
                      disabled={data.mode === 'OTOMATİK'}
                      className="w-full bg-[#0D1016] border border-[#374151] rounded px-3 py-2 text-xs font-bold text-gray-300 outline-none"
                    >
                      <option value="FREEZE">TÜM SİSTEMİ DURDUR (FREEZE)</option>
                      <option value="RELEASE_PRESSURE">BASINCI BOŞALT (RELEASE)</option>
                      <option value="SAFE_HOME">GÜVENLİ PARKLANMAYA GİT (HOME)</option>
                    </select>
                  </div>

                  <div className="p-3 bg-[#0D1016] border border-[#1F2937] rounded flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-gray-300 uppercase">Otomatik Hata Kurtarma</div>
                      <div className="text-[8px] text-gray-600 uppercase font-mono mt-0.5">Recovery Mode</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" name="autoRecovery" checked={data.config.autoRecovery} onChange={handleConfigChange} disabled={data.mode === 'OTOMATİK'} className="sr-only peer" />
                      <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-500"></div>
                    </label>
                  </div>
                </div>
              </div>

              <div className="bg-[#151921] border border-[#2D333F] rounded p-4 space-y-6 flex flex-col">
                <h3 className="text-[11px] font-bold text-gray-300 border-l-2 border-blue-500 pl-2 uppercase tracking-wider mb-4 flex items-center">
                   <FileText size={14} className="mr-2 text-blue-500" /> Diagnostik & Log Seviyesi
                </h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Logger Seviyesi</label>
                    <select 
                      name="logLevel"
                      value={data.config.logLevel}
                      onChange={handleConfigChange}
                      disabled={data.mode === 'OTOMATİK'}
                      className="w-full bg-[#0D1016] border border-[#374151] rounded px-3 py-2 text-xs font-mono text-gray-300 outline-none"
                    >
                      <option value="DEBUG">DEBUG (FULL TRACE)</option>
                      <option value="INFO">INFO (STANDART)</option>
                      <option value="WARN">WARN (WARN/ERROR)</option>
                      <option value="ERROR">ERROR (ONLY ERRORS)</option>
                    </select>
                  </div>
                </div>

                <div className="flex-1 mt-6 p-4 bg-black/40 border border-[#1F2937] rounded flex flex-col items-center justify-center space-y-3 relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                      <Box size={80} />
                   </div>
                   <div className="text-[10px] font-mono text-gray-600 uppercase tracking-[0.3em]">Runtime UUID</div>
                   <div className="text-xl font-mono text-gray-400">#9428-RT-64</div>
                   <div className="text-[8px] font-mono p-1 bg-white/5 text-gray-500 rounded border border-white/5 uppercase">Linux-RT 5.15-ARM64</div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

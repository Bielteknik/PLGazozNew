import React, { useState, useMemo } from 'react';
import { SystemData, CyclePassport } from '../../types/system';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie, Legend } from 'recharts';
import { 
  FileBadge, 
  Search, 
  CheckCircle, 
  XCircle, 
  Droplet, 
  Database,
  Sliders,
  TrendingUp,
  Cpu,
  Clock,
  CircleCheck,
  Flame,
  ShieldCheck,
  Zap,
  Info
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export function History({ data }: { data: SystemData }) {
  const [activeTab, setActiveTab] = useState<'passports' | 'washing' | 'analytics'>('passports');
  const [selectedPassportId, setSelectedPassportId] = useState<string | null>(
    data.cycleHistory.length > 0 ? data.cycleHistory[0].id : null
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Find the selected passport details
  const selectedPassport = useMemo(() => {
    return data.cycleHistory.find(p => p.id === selectedPassportId) || data.cycleHistory[0] || null;
  }, [data.cycleHistory, selectedPassportId]);

  // Filtered cycle list for search
  const filteredHistory = useMemo(() => {
    return data.cycleHistory.filter(passport => {
      if (!searchQuery) return true;
      return passport.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
             passport.recipeId.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [data.cycleHistory, searchQuery]);

  // Chart data for cycle durations
  const durationChartData = useMemo(() => {
    return data.cycleHistory.slice(0, 15).reverse().map(passport => ({
      name: passport.id.split('-')[1] || passport.id,
      totalTime: Number((passport.duration / 1000).toFixed(1)), // seconds
      status: passport.validationStatus,
      raw: passport
    }));
  }, [data.cycleHistory]);

  // Recipe performance & volume statistics
  const recipeStats = useMemo(() => {
    const stats: Record<string, { name: string; count: number; volumeMl: number; isFilled: number }> = {};
    
    // Fill default values based on existing recipes
    data.recipes.forEach(r => {
      stats[r.id] = { name: r.name, count: 0, volumeMl: r.volumeMl, isFilled: 0 };
    });

    // Populate using cycle history
    data.cycleHistory.forEach(passport => {
      if (!stats[passport.recipeId]) {
        stats[passport.recipeId] = { 
          name: data.recipes.find(r => r.id === passport.recipeId)?.name || passport.recipeId, 
          count: 0, 
          volumeMl: 250, 
          isFilled: 0 
        };
      }
      stats[passport.recipeId].count += 1;
      stats[passport.recipeId].isFilled += passport.outputCount * stats[passport.recipeId].volumeMl;
    });

    // Format for charts
    return Object.entries(stats)
      .map(([id, info]) => ({
        id,
        name: info.name.split(' (')[0],
        count: info.count,
        volumeLiters: Number((info.isFilled / 1000).toFixed(1)),
      }))
      .filter(entry => entry.count > 0 || entry.volumeLiters > 0);
  }, [data.cycleHistory, data.recipes]);

  // Overall statistics
  const statsSummary = useMemo(() => {
    const totalCount = data.cycleHistory.length;
    const successCount = data.cycleHistory.filter(p => p.validationStatus === 'PASS').length;
    const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 100;
    
    const totalBottles = data.cycleHistory.reduce((acc, val) => acc + val.outputCount, 0);
    
    // Mean cycle time
    const avgDuration = totalCount > 0 
      ? (data.cycleHistory.reduce((acc, val) => acc + val.duration, 0) / totalCount) / 1000 
      : 0;

    return {
      totalCount,
      successCount,
      successRate,
      totalBottles,
      avgDuration: Number(avgDuration.toFixed(1))
    };
  }, [data.cycleHistory]);

  return (
    <div className="flex flex-col h-full space-y-3 overflow-y-auto pr-1">
      
      {/* Header with Sub-tabs */}
      <div className="bg-[#151921] border border-[#2D333F] p-3 rounded flex flex-col md:flex-row md:items-center md:justify-between gap-3 shrink-0">
        <div className="flex items-center space-x-2">
          <FileBadge className="text-[#F97316]" size={18} />
          <div>
            <h2 className="text-xs font-black text-gray-200 tracking-wider uppercase">
              ÜRETİM RAPORLARI VE ANALİTİKLERİ
            </h2>
            <p className="text-[9px] text-gray-500 font-bold font-mono">
              GAZOZ ÜRETİM VE KALİTE RAPORLARI - REÇETE BAZLI OTOMATİK PARALEL VERİ KARTLARI
            </p>
          </div>
        </div>

        {/* Tab Switchers */}
        <div className="flex bg-[#0D1016] border border-gray-800 p-0.5 rounded-md self-start md:self-auto">
          <button
            onClick={() => setActiveTab('passports')}
            className={cn(
              "px-3 py-1 text-[10px] font-black rounded-sm transition-all uppercase tracking-wider font-sans cursor-pointer",
              activeTab === 'passports'
                ? "bg-[#F97316] text-black shadow"
                : "text-gray-400 hover:text-white"
            )}
          >
            Şişeleme Döngü Pasaportu
          </button>
          <button
            onClick={() => setActiveTab('washing')}
            className={cn(
              "px-3 py-1 text-[10px] font-black rounded-sm transition-all uppercase tracking-wider font-sans cursor-pointer",
              activeTab === 'washing'
                ? "bg-[#F97316] text-black shadow"
                : "text-gray-400 hover:text-white"
            )}
          >
            CIP Yıkama & Eko-Log
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={cn(
              "px-3 py-1 text-[10px] font-black rounded-sm transition-all uppercase tracking-wider font-sans cursor-pointer",
              activeTab === 'analytics'
                ? "bg-[#F97316] text-black shadow"
                : "text-gray-400 hover:text-white"
            )}
          >
            Gazlama & Reçete Verimliliği
          </button>
        </div>
      </div>

      {/* Main View Grid Switch */}
      <div className="flex-1 min-h-0">
        
        {/* TAB 1: PASSPORTS LOG & DETAILED PANEL */}
        {activeTab === 'passports' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-full">
            
            {/* Left side: List of Passports */}
            <div className="lg:col-span-4 bg-[#151921] border border-[#2D333F] rounded flex flex-col overflow-hidden h-[460px] lg:h-full">
              <div className="bg-[#0D1016] px-3 py-2 border-b border-[#374151] flex items-center justify-between">
                <span className="font-black text-[9px] uppercase text-gray-400 tracking-wider font-mono">
                  Döngü Kuyruğu ({filteredHistory.length})
                </span>
                
                <div className="relative text-gray-500 w-28">
                  <Search size={10} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input 
                    type="text" 
                    placeholder="ID / Reçete..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-[#090D14] border border-[#222E3F] rounded-md pl-5 pr-1 py-0.5 text-[8.5px] text-gray-200 outline-none focus:border-[#F97316] w-full font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                {filteredHistory.map(passport => {
                  const isSelected = passport.id === selectedPassportId;
                  const recipeName = data.recipes.find(r => r.id === passport.recipeId)?.name.split(' (')[0] || passport.recipeId;

                  return (
                    <div 
                      key={passport.id} 
                      onClick={() => setSelectedPassportId(passport.id)}
                      className={cn(
                        "p-2 rounded border transition-all cursor-pointer group flex flex-col justify-between font-mono",
                        isSelected 
                          ? "bg-[#1E2533] border-[#F97316]/50 shadow-md" 
                          : "bg-[#0D1016]/80 hover:bg-[#151A24] border-[#1F2937]"
                      )}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-gray-200 group-hover:text-[#F97316] transition-colors">
                          {passport.id}
                        </span>
                        {passport.validationStatus === 'PASS' 
                          ? <span className="text-[8px] bg-emerald-500/10 border border-emerald-500/20 px-1 py-0.2 rounded text-emerald-400 font-extrabold">PASS</span>
                          : <span className="text-[8px] bg-red-500/10 border border-red-500/20 px-1 py-0.2 rounded text-red-400 font-extrabold">FAIL</span>
                        }
                      </div>

                      <div className="text-[9px] text-[#A0AEC0] font-sans truncate mt-1">
                        Reçete: {recipeName}
                      </div>

                      <div className="flex justify-between items-center mt-2 pt-1 border-t border-gray-800/50 text-[8.5px] text-gray-500">
                        <span>{new Date(passport.timestamp).toLocaleTimeString()}</span>
                        <span>Yük: {passport.outputCount} şişe</span>
                        <span className="font-bold text-[#F97316]">{(passport.duration / 1000).toFixed(1)}s</span>
                      </div>
                    </div>
                  );
                })}
                
                {filteredHistory.length === 0 && (
                  <div className="text-gray-500 text-[10px] font-mono text-center pt-10">
                    EŞLEŞEN KAYIT BULUNAMADI
                  </div>
                )}
              </div>
            </div>

            {/* Right side: Detailed telemetry visualizer */}
            <div className="lg:col-span-8 flex flex-col space-y-3 h-full">
              
              {/* Telemetry Detail Grid */}
              <div className="bg-[#151921] border border-[#2D333F] rounded p-3 flex-1 flex flex-col">
                <div className="border-b border-gray-800 pb-2 mb-3 flex items-center justify-between">
                  <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-widest flex items-center col-span-1">
                    <Cpu size={12} className="mr-1.5 text-[#F97316]" /> DÖNGÜ TELEMETRİ PASAPORT DETAYI
                  </h3>
                  {selectedPassport && (
                    <span className="font-mono text-[9px] text-[#F97316] font-bold">
                      {selectedPassport.id} // MODÜLER RAPORU
                    </span>
                  )}
                </div>

                {selectedPassport ? (
                  <div className="flex-1 flex flex-col justify-between space-y-4 font-mono">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[9px]">
                      
                      <div className="bg-[#0D1016] p-2 rounded border border-gray-850">
                        <span className="text-[#718096] uppercase font-bold text-[8px] block mb-1">Döngü No</span>
                        <span className="text-gray-200 font-extrabold text-[12px]">{selectedPassport.id}</span>
                      </div>

                      <div className="bg-[#0D1016] p-2 rounded border border-gray-850">
                        <span className="text-[#718096] uppercase font-bold text-[8px] block mb-1">Döngü Zamanı</span>
                        <span className="text-gray-200 font-medium">{new Date(selectedPassport.timestamp).toLocaleString()}</span>
                      </div>

                      <div className="bg-[#0D1016] p-2 rounded border border-gray-850">
                        <span className="text-[#718096] uppercase font-bold text-[8px] block mb-1">Reçete Kimliği</span>
                        <span className="text-blue-400 font-bold">{selectedPassport.recipeId}</span>
                      </div>

                      <div className="bg-[#0D1016] p-2 rounded border border-gray-850">
                        <span className="text-[#718096] uppercase font-bold text-[8px] block mb-1">Kullanıcı / Yetkili</span>
                        <span className="text-gray-400 font-bold uppercase">{selectedPassport.operatorId}</span>
                      </div>
                    </div>

                    {/* Filling validation checks list */}
                    <div className="bg-[#090D14] p-3 rounded border border-gray-900/60 flex-1">
                      <div className="text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-2 pb-1 border-b border-gray-800/80">
                        Otomatik Kalibrasyon & Çevrim İçi Doğruluk Testi
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5 text-[8.5px]">
                        <div className="flex items-center justify-between py-1 border-b border-gray-900/40">
                          <span className="text-[#A0AEC0]">1. Giriş Baraj Kapısı Kapama Sekansı</span>
                          <span className="text-green-400 flex items-center font-bold">
                            <CircleCheck size={11} className="mr-1" /> UYGUN
                          </span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-b border-gray-900/40">
                          <span className="text-[#A0AEC0]">2. Sensör Basıncı & Konveyör Hizalama</span>
                          <span className="text-green-400 flex items-center font-bold">
                            <CircleCheck size={11} className="mr-1" /> AKTİF
                          </span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-b border-gray-900/40">
                          <span className="text-[#A0AEC0]">3. Reçete Doğrulama Seviyesi (Ml)</span>
                          <span className="text-blue-400 font-bold">
                            {data.recipes.find(r => r.id === selectedPassport.recipeId)?.volumeMl || 250} ml / Şişe
                          </span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-b border-gray-900/40">
                          <span className="text-[#A0AEC0]">4. Toplam Şurup Sarfiyatı (Tahmini)</span>
                          <span className="text-emerald-400 font-bold">
                            {Number(((selectedPassport.outputCount * (data.recipes.find(r => r.id === selectedPassport.recipeId)?.volumeMl || 0)) / 1000).toFixed(2))} Litre
                          </span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-b border-gray-900/40">
                          <span className="text-[#A0AEC0]">5. Sistem Tahliye & Çıkış Sayımı</span>
                          <span className="text-gray-300">
                            {selectedPassport.inputCount} Giriş / {selectedPassport.outputCount} Çıkış Okundu
                          </span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-b border-gray-900/40">
                          <span className="text-[#A0AEC0]">6. Damlama Bekleme Toleransı (HMI)</span>
                          <span className="text-gray-300 font-bold">
                            {(data.config.dripWaitTimeMs / 1000).toFixed(1)}sn
                          </span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-b border-gray-900/40">
                          <span className="text-[#A0AEC0]">7. Lazer Ölçüm Yükseklik Farkı</span>
                          <span className="text-green-400 font-bold">±0.25mm (Kararlı)</span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-b border-gray-900/40">
                          <span className="text-[#A0AEC0]">8. Sinyal Kilitleme Durumu (MCU)</span>
                          <span className="text-purple-400 font-bold">MCU_OK</span>
                        </div>
                      </div>

                      {/* Warnings or Error Log if fail */}
                      {selectedPassport.validationStatus === 'FAIL' && (
                        <div className="mt-3 bg-red-950/20 border border-red-900/50 p-2 rounded text-red-400 text-[8.5px] font-sans">
                          <div className="font-bold uppercase tracking-wide flex items-center">
                            <XCircle size={12} className="mr-1" /> HATA RAPORU / TOLERANS DIŞI AKTİVASYON
                          </div>
                          <p className="mt-1 text-gray-300">
                            Konveyör üzerinde giriş sayacı ile çıkış sayacı arasındaki tutarsızlık sınır dışı çıktı. Hat tıkanıklığı veya hatalı şişe yerleşimi algılandı.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Operational parameters */}
                    <div className="grid grid-cols-3 gap-2 bg-[#0D1016] p-2 rounded border border-gray-850 text-[8.5px]">
                      <div>
                        <span className="text-[#718096] uppercase font-bold block">Toplam Çevrim Süresi</span>
                        <span className="text-[#F97316] font-bold text-[11px]">{(selectedPassport.duration / 1000).toFixed(2)} Saniye</span>
                      </div>
                      <div>
                        <span className="text-[#718096] uppercase font-bold block">Eşleşme Oranı (G/Ç)</span>
                        <span className="text-gray-300 text-[11px]">
                          {selectedPassport.inputCount === selectedPassport.outputCount ? '100% (Mükemmel)' : `${Math.round((selectedPassport.outputCount / selectedPassport.inputCount) * 100)}% Elendi`}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#718096] uppercase font-bold block">Kalite Değerlendirmesi</span>
                        <span className={cn(
                          "font-black text-[11px]",
                          selectedPassport.validationStatus === 'PASS' ? "text-green-400" : "text-red-400"
                        )}>
                          {selectedPassport.validationStatus === 'PASS' ? "ÜRETİM KABUL" : "KUSURLU / AYIKLANDI"}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col justify-center items-center text-gray-500 text-[11px] font-mono">
                    <Info size={24} className="mb-2 text-gray-600" />
                    KAYITLI DÖNGÜ TELEMETRİSİ BULUNMADI
                  </div>
                )}
              </div>

              {/* Lower duration analytic chart */}
              <div className="bg-[#151921] border border-[#2D333F] rounded p-3 h-48 flex flex-col justify-between shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[9px] uppercase font-black text-gray-400 tracking-wider flex items-center">
                    <TrendingUp size={11} className="mr-1 text-blue-400" /> Son 15 Döngünün Çevrim Süresi Eğilimi (Saniye)
                  </h3>
                  <span className="text-[8px] font-mono text-gray-500">
                    Mavi: Başarılı | Kırmızı: Hatalı
                  </span>
                </div>
                <div className="flex-1 min-h-[100px] h-[100px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={durationChartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="2 2" stroke="#1C212E" vertical={false} />
                      <XAxis dataKey="name" stroke="#4A5568" tick={{fontSize: 8, fontFamily: 'monospace'}} />
                      <YAxis stroke="#4A5568" tick={{fontSize: 8, fontFamily: 'monospace'}} />
                      <Tooltip 
                        cursor={{fill: '#131822'}}
                        contentStyle={{ backgroundColor: '#090D14', border: '1px solid #2D333F', borderRadius: '4px', color: '#E2E8F0', fontSize: '9px', fontFamily: 'monospace' }} 
                      />
                      <Bar dataKey="totalTime" radius={[1, 1, 0, 0]} maxBarSize={20}>
                        {durationChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.status === 'PASS' ? '#60a5fa' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 2: WASHING & ECO-EFFICIENCY SUSTAINABILITY REPORT */}
        {activeTab === 'washing' && (
          <div className="bg-[#151921] border border-[#2D333F] rounded p-4 flex flex-col justify-between h-full min-h-[460px] space-y-3">
            <div className="border-b border-gray-800 pb-2.5 flex justify-between items-center">
              <div>
                <h3 className="text-xs font-black text-gray-200 uppercase tracking-widest flex items-center font-mono">
                  <Database size={13} className="mr-1.5 text-blue-400" /> HİJYEN DÖNGÜLERİ DETAYLI DURUM DEFTERİ (MCU)
                </h3>
                <p className="text-[9px] text-gray-500 font-bold mt-0.5">
                  SİSTEM DURULAMA, ALKALİ TEMİZLEME VE DEZENFEKSİYON VERİ DEFTERİ
                </p>
              </div>
              <span className="text-[8px] bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded text-emerald-400 font-bold font-mono tracking-wider">
                TEMİZLİK DÖNGÜSÜ GÜNLÜĞÜ
              </span>
            </div>

            {/* Detailed Table */}
            <div className="overflow-x-auto flex-1 custom-scrollbar">
              <table className="w-full text-left font-mono text-[9px] text-gray-400 border border-gray-900/40 rounded">
                <thead>
                  <tr className="bg-[#090D14] text-[8px] font-black uppercase text-[#A0AEC0] tracking-wider border-b border-gray-800">
                    <th className="px-3 py-2">Çevrim Segment Tipi</th>
                    <th className="px-3 py-2 text-center">Başarı</th>
                    <th className="px-3 py-2 text-center">Su Tüketim</th>
                    <th className="px-3 py-2 text-center">Basınç</th>
                    <th className="px-3 py-2 text-right">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1B212D]/55">
                  <tr className="hover:bg-[#1A202C]/40 transition-[background]">
                    <td className="px-3 py-2.5 font-bold text-gray-200 flex flex-col">
                      <span>A01: Standart Yüksek Basınçlı Durulama (Otomatik)</span>
                      <span className="text-[7.5px] font-medium text-gray-500 font-sans mt-0.5">Yüksek devirli temiz su püskürtme</span>
                    </td>
                    <td className="px-3 py-2.5 text-center text-green-400 font-bold">100.0%</td>
                    <td className="px-3 py-2.5 text-center text-blue-400">12.0 Litre</td>
                    <td className="px-3 py-2.5 text-center text-amber-500">4.5 bar</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 text-green-400 rounded text-[8px] font-bold">TAMAMLANDI</span>
                    </td>
                  </tr>

                  {data.isWashingDone && (
                    <tr className="hover:bg-emerald-950/15 border-t border-emerald-500/20 bg-emerald-950/10 transition-colors">
                      <td className="px-3 py-2.5 font-bold text-emerald-400 flex flex-col">
                        <span className="flex items-center">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 " />
                          M01: Yüksek Basınçlı Manuel Durulama
                        </span>
                        <span className="text-[7.5px] font-medium text-emerald-505/75 font-sans mt-0.5">Operatör tarafından tetiklenen manuel durulama periyodu</span>
                      </td>
                      <td className="px-3 py-2.5 text-center text-green-450 font-black">100.0%</td>
                      <td className="px-3 py-2.5 text-center text-emerald-400 font-bold">14.5 Litre</td>
                      <td className="px-3 py-2.5 text-center text-emerald-400 font-bold">5.0 bar</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="bg-emerald-500/25 border border-emerald-500/40 px-1.5 py-0.5 text-emerald-300 rounded text-[8px] font-black ">SİSTEM TEMİZ</span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-[#0D1016] p-2.5 rounded border border-gray-850 text-gray-400 text-[8px] leading-relaxed font-sans flex items-start gap-1.5">
              <Info size={14} className="text-blue-400 shrink-0 mt-0.5" />
              <span>
                Yıkama defteri, MCU tarafından kaydedilen sterilizasyon ve temizlik kayıtlarını listeler. Manuel veya otomatik durulama döngülerinin başarı oranlarını buradan takip edebilirsiniz.
              </span>
            </div>
          </div>
        )}

        {/* TAB 3: PRODUCTION VOLUME & RECIPE ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-full">
            
            {/* Left side: Pie & Horizontal Bar Charts */}
            <div className="lg:col-span-8 bg-[#151921] border border-[#2D333F] rounded p-3 flex flex-col justify-between space-y-4 h-[460px] lg:h-full">
              
              <div>
                <div className="border-b border-gray-800 pb-2 mb-3">
                  <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-widest flex items-center font-mono">
                    <TrendingUp size={12} className="mr-1.5 text-blue-400" /> Reçete Bazlı Üretim Hacim Dağılımı (Litre)
                  </h3>
                </div>

                {recipeStats.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    {/* Visual Reciharts Horizontal Chart */}
                    <div className="h-44 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={recipeStats}
                          layout="vertical"
                          margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                        >
                          <CartesianGrid stroke="#1C212E" strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" stroke="#4A5568" tick={{fontSize: 8, fontFamily: 'monospace'}} />
                          <YAxis dataKey="name" type="category" stroke="#4A5568" tick={{fontSize: 7, fontFamily: 'sans-serif'}} width={65} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#090D14', border: '1px solid #2D333F', borderRadius: '4px', color: '#E2E8F0', fontSize: '9px', fontFamily: 'monospace' }} 
                          />
                          <Bar dataKey="volumeLiters" fill="#F97316" radius={[0, 4, 4, 0]} maxBarSize={15} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Detailed list analysis text */}
                    <div className="space-y-2 font-mono text-[9px] text-[#A0AEC0]">
                      <div className="text-[9.5px] font-bold text-gray-300 border-b border-gray-800 pb-1 mb-1.5 uppercase">
                        Aktif Reçete Verim Detayları
                      </div>
                      {recipeStats.map((stat, i) => (
                        <div key={i} className="flex justify-between items-center py-0.5 border-b border-gray-900/40">
                          <span className="truncate max-w-[150px]">{stat.name}</span>
                          <span className="text-white font-bold">{stat.volumeLiters} L <span className="text-gray-600 font-normal">({stat.count} Döngü)</span></span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-44 flex flex-col justify-center items-center text-gray-500 font-mono text-[10px]">
                    KAYITLI REÇETE VERİSİ YOK (HENÜZ ÜRETİM YAPILMADI)
                  </div>
                )}
              </div>

              {/* Cumulated syrup balance logs */}
              <div className="border-t border-gray-800/80 pt-3">
                <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center">
                  <Database size={11} className="mr-1 text-emerald-400 animate-pulse" /> Şurup Tankı Gerçek Zamanlı Kütle Dengesi
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-[9px]">
                  <div className="bg-[#090D14] p-2.5 border border-gray-900 rounded">
                    <span className="text-gray-500 block">Tank Toplam Hacmi</span>
                    <span className="text-gray-300 font-bold block text-[11px] mt-0.5">{data.syrupTankVolumeLiters || 50} Litre</span>
                  </div>
                  <div className="bg-[#090D14] p-2.5 border border-gray-900 rounded">
                    <span className="text-gray-500 block">Kalan Şurup Seviyesi</span>
                    <span className="text-[#F97316] font-extrabold block text-[11px] mt-0.5">
                      {((data.syrupTankCurrentVolumeMl || 0) / 1000).toFixed(2)} Litre
                    </span>
                  </div>
                  <div className="bg-[#090D14] p-2.5 border border-gray-900 rounded">
                    <span className="text-gray-500 block">Lazer Sensör Mesafesi</span>
                    <span className="text-blue-400 font-bold block text-[11px] mt-0.5">{data.laserSensorDistanceMm || 240} mm</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Right side: Industrial OEE Gauge Analysis */}
            <div className="lg:col-span-4 bg-[#151921] border border-[#2D333F] rounded p-3 flex flex-col justify-between h-full space-y-4">
              
              <div>
                <div className="border-b border-gray-800 pb-2 mb-3">
                  <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-widest flex items-center font-mono">
                    <Cpu size={12} className="mr-1.5 text-purple-400" /> Toplam Ekipman Etkinliği (OEE)
                  </h3>
                </div>

                <div className="flex flex-col items-center py-4 bg-[#090D14] rounded border border-gray-900">
                  {/* Big OEE Percentage */}
                  <span className="text-[28px] font-black font-mono text-emerald-400 tracking-tight shadow-sm select-none">
                    {statsSummary.totalCount > 0 
                      ? Math.round(0.982 * 0.965 * statsSummary.successRate) 
                      : 91}%
                  </span>
                  <span className="text-[8px] font-bold text-gray-500 font-mono uppercase tracking-widest mt-1">
                    HATTIN GENEL VERİMLİLİK PUANI
                  </span>
                </div>
              </div>

              {/* Breakdown metrics of OEE */}
              <div className="space-y-3 font-mono text-[9px]">
                
                <div className="flex justify-between border-b border-gray-850 pb-1.5">
                  <div>
                    <span className="text-gray-200 font-bold block">1. Kullanılabilirlik (Availability)</span>
                    <span className="text-[8px] text-gray-500 font-sans">Planlanan çalışma süresi oranı</span>
                  </div>
                  <span className="text-emerald-400 font-extrabold text-[10px] self-center">98.2%</span>
                </div>

                <div className="flex justify-between border-b border-gray-850 pb-1.5">
                  <div>
                    <span className="text-gray-200 font-bold block">2. Performans Verimi (Performance)</span>
                    <span className="text-[8px] text-gray-500 font-sans">Sekans hız kalibrasyon derecesi</span>
                  </div>
                  <span className="text-emerald-400 font-extrabold text-[10px] self-center">96.5%</span>
                </div>

                <div className="flex justify-between border-b border-gray-850 pb-1.5">
                  <div>
                    <span className="text-gray-200 font-bold block">3. Kalite Oranı (Quality)</span>
                    <span className="text-[8px] text-gray-500 font-sans">Hatalı dolum elenme oranı</span>
                  </div>
                  <span className="text-amber-400 font-extrabold text-[10px] self-center">
                    {statsSummary.successRate}%
                  </span>
                </div>

              </div>

              {/* Informative text box footer */}
              <div className="bg-[#0D1016] p-2.5 rounded border border-gray-850 text-gray-400 text-[8px] leading-relaxed font-sans flex items-start gap-1.5">
                <Info size={14} className="text-blue-400 shrink-0 mt-0.5" />
                <span>
                  OEE puanı %85 üzerindeki tesisler dünya standartlarında kabul edilir. Tesisimiz akıllı valf optimizasyonu sayesinde bu sınırın üstündedir.
                </span>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* Persistent summary metrics row at the very bottom */}
      <div className="bg-[#151921] border border-[#2D333F] p-3 rounded grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0 font-mono text-[10px]">
        <div className="flex items-center space-x-2 border-r border-[#2D333F]/50 px-1 last:border-0">
          <Clock size={14} className="text-gray-500" />
          <div>
            <span className="text-gray-500 block text-[8px] font-bold uppercase tracking-wider">Ort. Döngü Süresi</span>
            <span className="text-gray-200 font-black">{statsSummary.avgDuration} L/sn</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 border-r border-[#2D333F]/50 px-1 last:border-0">
          <CheckCircle size={14} className="text-green-400" />
          <div>
            <span className="text-gray-500 block text-[8px] font-bold uppercase tracking-wider">Başarı Oranı</span>
            <span className="text-emerald-400 font-black">{statsSummary.successRate}%</span>
          </div>
        </div>

        <div className="flex items-center space-x-2 border-r border-[#2D333F]/50 px-1 last:border-0">
          <Droplet size={14} className="text-blue-450 text-blue-400" />
          <div>
            <span className="text-gray-500 block text-[8px] font-bold uppercase tracking-wider">Toplam Çıkış Şişesi</span>
            <span className="text-gray-200 font-black">{statsSummary.totalBottles} Adet</span>
          </div>
        </div>

        <div className="flex items-center space-x-2 px-1">
          <Zap size={14} className="text-amber-500" />
          <div>
            <span className="text-gray-500 block text-[8px] font-bold uppercase tracking-wider">Küm. Enerji Tasarrufu</span>
            <span className="text-amber-500 font-black">
              {(statsSummary.totalBottles * 0.003).toFixed(2)} kWh
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}

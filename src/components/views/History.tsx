import React, { useMemo } from 'react';
import { SystemData, CyclePassport } from '../../types/system';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { FileBadge, Search, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

export function History({ data }: { data: SystemData }) {
  
  const chartData = useMemo(() => {
    return data.cycleHistory.slice(0, 20).reverse().map(passport => ({
       name: passport.id.split('-')[1],
       totalTime: Number((passport.duration / 1000).toFixed(1)), // Seconds
       status: passport.validationStatus,
       raw: passport
    }));
  }, [data.cycleHistory]);

  return (
    <div className="flex flex-col h-full space-y-3 overflow-y-auto">
      
      {/* Header */}
      <div className="bg-[#151921] border border-[#2D333F] p-3 rounded flex flex-col sm:items-center sm:justify-between sm:flex-row gap-2">
        <h2 className="text-sm font-bold text-gray-200 flex items-center">
          <FileBadge className="mr-2 text-[#F97316]" size={14} /> DÖNGÜ PASAPORTLARI 
        </h2>
        
        <div className="relative text-gray-500 w-full sm:w-auto">
           <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2" />
           <input 
             type="text" 
             placeholder="CYC-ID Ara..." 
             className="bg-[#0D1016] border border-[#374151] rounded pl-6 pr-2 py-1 text-[10px] text-gray-200 outline-none focus:border-[#4ade80] w-full"
           />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 flex-1 min-h-0">
        
        {/* Pass/Fail History Table */}
        <div className="col-span-1 md:col-span-4 bg-[#151921] border border-[#2D333F] rounded flex flex-col overflow-hidden">
           <div className="bg-[#0D1016] px-3 py-2 border-b border-[#374151] font-bold text-[10px] uppercase text-gray-400 tracking-wider">
              Son Pasaportlar
           </div>
           <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {data.cycleHistory.map(passport => (
                <div key={passport.id} className="bg-[#0D1016] hover:bg-[#1C2029] p-2 rounded border border-[#1F2937] transition-colors cursor-pointer group">
                  <div className="flex justify-between items-center mb-0.5">
                     <span className="font-mono text-blue-400 text-[10px] font-bold">{passport.id}</span>
                     {passport.validationStatus === 'PASS' 
                        ? <CheckCircle size={12} className="text-green-400" />
                        : <XCircle size={12} className="text-red-500" />
                     }
                  </div>
                  <div className="text-[9px] text-gray-500 font-mono">
                     {new Date(passport.timestamp).toLocaleString()}
                  </div>
                  <div className="flex justify-between items-center mt-1 text-[9px]">
                     <span className="text-gray-400">Giren: {passport.inputCount} | Çıkan: {passport.outputCount}</span>
                     <span className="text-gray-400 font-mono">{(passport.duration / 1000).toFixed(1)}s</span>
                  </div>
                </div>
              ))}
              
              {data.cycleHistory.length === 0 && (
                <div className="text-gray-500 text-[10px] font-mono text-center pt-6">KAYITLI PASAPORT YOK</div>
              )}
           </div>
        </div>
        
        {/* Analytics */}
        <div className="col-span-1 md:col-span-8 flex flex-col bg-[#151921] border border-[#2D333F] rounded overflow-hidden p-3">
           <h3 className="text-[10px] uppercase font-bold text-gray-400 mb-3 border-l-2 border-[#F97316] pl-2">DÖNGÜ SÜRESİ ANALİZİ (SANİYE)</h3>
           <div className="flex-1 min-h-[200px]">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="2 2" stroke="#1F2937" vertical={false} />
                 <XAxis dataKey="name" stroke="#6B7280" tick={{fontSize: 9, fontFamily: 'monospace'}} />
                 <YAxis stroke="#6B7280" tick={{fontSize: 9, fontFamily: 'monospace'}} />
                 <Tooltip 
                   cursor={{fill: '#1C2029'}}
                   contentStyle={{ backgroundColor: '#0D1016', border: '1px solid #374151', borderRadius: '4px', color: '#E0E0E0', fontSize: '10px', fontFamily: 'monospace' }} 
                 />
                 <Bar dataKey="totalTime" radius={[2, 2, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.status === 'PASS' ? '#60a5fa' : '#f87171'} />
                    ))}
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
           </div>
           
           <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[#374151] pt-4">
              <div>
                 <div className="text-[9px] text-gray-500 uppercase font-bold">Ort. Döngü Süresi</div>
                 <div className="text-lg font-mono text-gray-200 mt-0.5">42.1s</div>
              </div>
              <div>
                 <div className="text-[9px] text-gray-500 uppercase font-bold">Başarı Oranı</div>
                 <div className="text-lg font-mono text-green-400 mt-0.5">
                    {data.cycleHistory.length > 0 
                      ? Math.round((data.cycleHistory.filter(c => c.validationStatus==='PASS').length / data.cycleHistory.length) * 100) 
                      : 0}%
                 </div>
              </div>
              <div>
                 <div className="text-[9px] text-gray-500 uppercase font-bold">Toplam Şişe</div>
                 <div className="text-lg font-mono text-gray-200 mt-0.5">
                    {data.cycleHistory.reduce((acc, val) => acc + val.outputCount, 0)}
                 </div>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
}

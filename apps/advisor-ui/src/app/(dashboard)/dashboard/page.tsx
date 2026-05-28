'use client';

import { useAuthStore } from '@/store/auth.store';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Clock, Users, Activity, Target } from 'lucide-react';
import { useRouter } from 'next/navigation';

const performanceData = [
  { month: 'Jan', value: 8287 },
  { month: 'Feb', value: 13778 },
  { month: 'Mar', value: 36566 },
  { month: 'Apr', value: 27378 },
  { month: 'May', value: 29599 },
  { month: 'Jun', value: 48750 },
];

const allocationData = [
  { name: 'US Equities', value: 45, color: '#3b82f6' },
  { name: 'Bonds', value: 25, color: '#10b981' },
  { name: 'Intl', value: 15, color: '#f59e0b' },
  { name: 'Cash', value: 10, color: '#6366f1' },
  { name: 'Alternatives', value: 5, color: '#8b5cf6' },
];

// Static variables removed

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [metrics, setMetrics] = useState<{ totalAum: number, activeClients: number, role: string, firmId: string } | null>(null);
  const [topClients, setTopClients] = useState<any[]>([]);
  const [marketTrends, setMarketTrends] = useState<any>(null);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [timeframe, setTimeframe] = useState('6 Months');

  useEffect(() => {
    async function loadMetrics() {
      try {
        const [metricsData, clientsData, trendsData, integrationsData] = await Promise.all([
            apiClient.get<any>("/dashboard/metrics"),
            apiClient.get<any>("/dashboard/top-clients"),
            apiClient.get<any>("/dashboard/market-trends"),
            apiClient.get<any>("/system/integrations")
        ]);
        setMetrics(metricsData);
        setTopClients(clientsData);
        setMarketTrends(trendsData);
        setIntegrations(integrationsData);
      } catch (err) {
        console.error("Failed to load metrics", err);
      }
    }
    loadMetrics();
  }, []);

  return (
    <div className="p-8 space-y-6 bg-slate-50 min-h-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Welcome back, {user?.name || 'Sarah Jenkins'}</h1>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => router.push('/recommendations')}
            className="px-4 py-2 bg-white text-blue-600 border border-blue-200 font-semibold rounded-lg shadow-sm hover:bg-blue-50 transition-colors"
          >
            + New Insight
          </button>
          <button 
            onClick={() => router.push('/markets')}
            className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-sm hover:bg-blue-700 transition-colors"
          >
            + Market View
          </button>
        </div>
      </div>

      {/* Top Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* AUM Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div>
            <h3 className="text-slate-500 font-medium text-sm mb-1">Total Assets Under Management (AUM)</h3>
            <div className="text-4xl font-bold text-teal-500 mb-2">${metrics ? (metrics.totalAum / 1000000).toFixed(2) + 'M' : '...'}</div>
            <div className="flex items-center text-teal-500 text-sm font-medium">
              <ArrowUpRight className="w-4 h-4 mr-1" />
              +2.4% Today
            </div>
          </div>
          <div className="h-24 mt-4">
             <ResponsiveContainer width="100%" height="100%">
               <LineChart data={performanceData.slice(3)}>
                 <Line type="monotone" dataKey="value" stroke="#14b8a6" strokeWidth={3} dot={false} />
               </LineChart>
             </ResponsiveContainer>
          </div>
        </div>

        {/* Active Clients Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div>
             <h3 className="text-slate-500 font-medium text-sm mb-1">Active Clients</h3>
             <div className="text-3xl font-bold text-slate-800 mb-1">{metrics ? metrics.activeClients : '...'} <span className="text-sm font-normal text-slate-500">active</span></div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-6 border-t border-slate-100 pt-4">
             <div>
               <div className="text-xl font-bold text-slate-800">422</div>
               <div className="text-xs text-slate-500 uppercase tracking-wider">Performance</div>
             </div>
             <div>
               <div className="text-xl font-bold text-slate-800">5.7+</div>
               <div className="text-xs text-slate-500 uppercase tracking-wider">Portfolios Processed</div>
             </div>
             <div>
               <div className="text-xl font-bold text-slate-800">8.7K</div>
               <div className="text-xs text-slate-500 uppercase tracking-wider">Data Streams</div>
             </div>
          </div>
        </div>

        {/* System Integrations Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
           <div className="flex justify-between items-center mb-4">
             <h3 className="text-slate-800 font-bold text-lg">System Integrations</h3>
             <span className="text-xs text-slate-400 flex items-center"><Activity className="w-3 h-3 mr-1"/> Live</span>
           </div>
           
           <div className="space-y-4">
             {integrations.map((integration, idx) => (
                <div key={idx} className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
                   <div className="text-sm font-semibold text-slate-700">{integration.name}</div>
                   <div className={`text-xs font-medium px-2 py-1 rounded-md ${integration.status === 'Connected' ? 'bg-teal-50 text-teal-600' : 'bg-blue-50 text-blue-600'}`}>
                      {integration.status}
                   </div>
                </div>
             ))}
           </div>
        </div>

      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Performance Overview */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2">
           <div className="flex justify-between items-center mb-6">
             <h3 className="text-slate-800 font-bold text-lg">Performance Overview</h3>
             <select 
               value={timeframe}
               onChange={(e) => setTimeframe(e.target.value)}
               className="text-sm border-slate-200 rounded-md text-slate-600 bg-slate-50 px-3 py-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
             >
               <option value="6 Months">6 Months</option>
               <option value="1 Year">1 Year</option>
               <option value="YTD">YTD</option>
             </select>
           </div>
           <div className="h-64 w-full">
             <ResponsiveContainer width="100%" height="100%">
               <LineChart 
                 data={
                   timeframe === 'YTD' 
                     ? performanceData.slice(2) 
                     : timeframe === '1 Year' 
                     ? performanceData 
                     : performanceData // default 6 Months
                 } 
                 margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
               >
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                 <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} dy={10} />
                 <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} tickFormatter={(val) => `$${val/1000}M`} />
                 <Tooltip />
                 <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
               </LineChart>
             </ResponsiveContainer>
           </div>
        </div>

        {/* Asset Allocation */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
           <h3 className="text-slate-800 font-bold text-lg mb-6">Asset Allocation</h3>
           <div className="flex-1 flex flex-col justify-center items-center">
             <div className="h-48 w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie
                     data={allocationData}
                     cx="50%"
                     cy="50%"
                     innerRadius={60}
                     outerRadius={80}
                     paddingAngle={5}
                     dataKey="value"
                   >
                     {allocationData.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={entry.color} />
                     ))}
                   </Pie>
                   <Tooltip />
                 </PieChart>
               </ResponsiveContainer>
             </div>
             <div className="w-full mt-4 space-y-2">
               {allocationData.map(item => (
                 <div key={item.name} className="flex items-center justify-between text-sm">
                   <div className="flex items-center gap-2">
                     <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }}></div>
                     <span className="text-slate-600 font-medium">{item.name}</span>
                   </div>
                   <span className="font-semibold text-slate-800">{item.value}%</span>
                 </div>
               ))}
             </div>
           </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Top Performing Clients */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2">
           <div className="flex justify-between items-center mb-6">
             <h3 className="text-slate-800 font-bold text-lg">Top Performing Clients</h3>
             <button className="text-slate-400 hover:text-slate-600">•••</button>
           </div>
           <div className="overflow-x-auto">
             <table className="w-full text-left">
               <thead>
                 <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-100">
                   <th className="pb-3 font-semibold">Name</th>
                   <th className="pb-3 font-semibold">Value</th>
                   <th className="pb-3 font-semibold">YTD Return</th>
                   <th className="pb-3 font-semibold">Status</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {topClients.map(client => (
                    <tr 
                      key={client.client_id}
                      onClick={() => router.push(`/clients?id=${client.client_id}`)}
                      className="hover:bg-slate-50/60 transition-colors cursor-pointer group"
                    >
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                            {client.name.charAt(0)}
                          </div>
                          <span className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">{client.name}</span>
                        </div>
                      </td>
                      <td className="py-4 font-semibold text-slate-800">${(client.aum / 1000000).toFixed(2)}M</td>
                      <td className="py-4 font-semibold text-teal-500">{client.type}</td>
                      <td className="py-4">
                        <span className={`px-2 py-1 rounded-md text-xs font-semibold ${client.kyc_status === 'APPROVED' ? 'bg-teal-50 text-teal-600' : 'bg-amber-50 text-amber-600'}`}>
                          {client.kyc_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
             </table>
           </div>
        </div>

        {/* Market Trends */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
           <h3 className="text-slate-800 font-bold text-lg mb-6">Market Trends</h3>
           <table className="w-full text-left text-sm">
             <thead>
               <tr className="text-slate-500 border-b border-slate-100">
                 <th className="pb-2 font-medium">Tickers</th>
                 <th className="pb-2 font-medium text-right">Green</th>
                 <th className="pb-2 font-medium text-right">Red</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-50">
               {marketTrends?.top_movers?.map((trend: any) => (
                 <tr key={trend.symbol}>
                   <td className="py-3 font-semibold text-slate-800 flex items-center">
                     {trend.change.startsWith('+') ? <ArrowUpRight className="w-3 h-3 text-teal-500 mr-1"/> : <ArrowDownRight className="w-3 h-3 text-rose-500 mr-1"/>}
                     {trend.symbol}
                   </td>
                   <td className="py-3 text-right text-teal-500 font-medium">{trend.change.startsWith('+') ? trend.change : '-'}</td>
                   <td className="py-3 text-right text-rose-500 font-medium">{trend.change.startsWith('-') ? trend.change : '-'}</td>
                 </tr>
               ))}
             </tbody>
           </table>
        </div>

      </div>
    </div>
  );
}

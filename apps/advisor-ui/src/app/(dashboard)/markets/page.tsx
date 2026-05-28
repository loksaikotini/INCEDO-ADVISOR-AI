'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, ArrowUpRight, ArrowDownRight, Activity, Loader2, Info, Newspaper } from 'lucide-react';
import { apiClient } from '@/lib/api';

export default function MarketsPage() {
  const [trends, setTrends] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTrends() {
      try {
        const data = await apiClient.get<any>("/dashboard/market-trends");
        setTrends(data);
      } catch (err) {
        console.error("Failed to load market trends", err);
      } finally {
        setLoading(false);
      }
    }
    loadTrends();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500 mb-4" />
        <p className="text-slate-500 dark:text-slate-400 font-medium">Fetching live market data...</p>
      </div>
    );
  }

  if (!trends) {
    return <div className="p-8 text-rose-500 font-medium text-lg">Failed to load market data. Please ensure the backend is running.</div>;
  }

  // Construct market indices from the dynamic response
  const markets = [
    { index: 'S&P 500 (SPY)', change: trends.sp500, up: trends.sp500?.startsWith('+') },
    { index: 'NASDAQ (QQQ)', change: trends.nasdaq, up: trends.nasdaq?.startsWith('+') },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 dark:bg-slate-950 min-h-full transition-colors">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 text-slate-900 dark:text-slate-100">
            <TrendingUp className="w-8 h-8 text-blue-500" />
            Markets Overview
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm md:text-base">Real-time market indices, dynamic movers, and breaking news.</p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border shadow-sm ${trends.market_status === 'Bullish' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800'}`}>
          <Activity className="w-5 h-5" />
          <span className="text-base font-bold uppercase tracking-wider">{trends.market_status}</span>
        </div>
      </div>

      {/* Insight Alert */}
      {trends.insight && (
        <div className="bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 p-5 rounded-2xl flex gap-4 text-amber-800 dark:text-amber-400 shadow-sm">
          <Info className="w-6 h-6 shrink-0 mt-0.5 text-amber-600 dark:text-amber-500" />
          <p className="text-base font-medium leading-relaxed">{trends.insight}</p>
        </div>
      )}

      {/* Market Indices */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        {markets.map((market) => (
          <div key={market.index} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex justify-between items-center transition-all hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500">
            <div>
              <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{market.index}</div>
              <div className="text-3xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                Live Data Active
              </div>
            </div>
            <div className={`flex flex-col items-end gap-1 font-bold text-2xl px-4 py-2 rounded-xl ${market.up ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400'}`}>
              <div className="flex items-center gap-1">
                {market.up ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownRight className="w-6 h-6" />}
                {market.change}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Top Movers */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col h-[500px]">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
            <h2 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" />
              Dynamic Movers
            </h2>
          </div>
          <div className="overflow-y-auto flex-1 p-2">
            <table className="w-full text-left text-sm">
              <thead className="bg-transparent">
                <tr className="text-slate-400 dark:text-slate-500 uppercase tracking-wider text-xs">
                  <th className="px-4 py-3 font-semibold">Symbol</th>
                  <th className="px-4 py-3 font-semibold text-right">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {trends.top_movers?.map((mover: any) => {
                  const isUp = mover.change.startsWith('+');
                  return (
                    <tr key={mover.symbol} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-4">
                        <div className="font-bold text-slate-800 dark:text-slate-100 text-base">{mover.symbol}</div>
                        <div className="text-xs text-slate-400 mt-0.5">Equities</div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-bold text-sm ${isUp ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400'}`}>
                          {isUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                          {mover.change}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live News Feed */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col h-[500px]">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
            <h2 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Newspaper className="w-5 h-5 text-blue-500" />
              Live Market Feed
            </h2>
            <span className="text-xs font-semibold px-2.5 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 rounded-full animate-pulse">
              Live Updates
            </span>
          </div>
          <div className="overflow-y-auto flex-1 p-6 space-y-6">
            {trends.news && trends.news.length > 0 ? (
              trends.news.map((item: any, idx: number) => (
                <div key={idx} className="group pb-6 border-b border-slate-100 dark:border-slate-800/60 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">
                      {item.source}
                    </span>
                  </div>
                  <a href={item.url} target="_blank" rel="noreferrer" className="block text-lg font-bold text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mb-2 leading-tight">
                    {item.headline}
                  </a>
                  <p className="text-slate-600 dark:text-slate-400 text-sm line-clamp-2 leading-relaxed">
                    {item.summary}
                  </p>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <Newspaper className="w-12 h-12 mb-3 opacity-20" />
                <p>No recent news articles found.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Briefcase, 
  TrendingUp, 
  DollarSign, 
  PieChart,
  Loader2,
  FileText,
  X,
  Plus
} from "lucide-react";
import { apiClient } from "@/lib/api";

export default function PortfolioPage() {
  const [data, setData] = useState<any>(null);
  const [bookData, setBookData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Meeting Prep Modal State
  const [prepLoading, setPrepLoading] = useState(false);
  const [prepData, setPrepData] = useState<any>(null);
  const [prepModalOpen, setPrepModalOpen] = useState(false);

  // Add Client Modal State
  const [addClientModalOpen, setAddClientModalOpen] = useState(false);
  const [addClientLoading, setAddClientLoading] = useState(false);
  const [addClientError, setAddClientError] = useState("");
  const [newClient, setNewClient] = useState({
    name: "",
    email: "",
    segment: "HIGH_NET_WORTH",
    riskProfile: "MODERATE"
  });

  const fetchData = async () => {
    try {
      const [dashboard, book] = await Promise.all([
        apiClient.get<any>('/dashboard/metrics'),
        apiClient.get<any>('/portfolio/book')
      ]);
      setData(dashboard);
      setBookData(book);
    } catch (err) {
      console.error("Failed to load portfolio stats:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleMeetingPrep = async (clientId: string) => {
    setPrepLoading(true);
    setPrepModalOpen(true);
    try {
      const prep = await apiClient.get<any>(`/advisor/meeting-prep/${clientId}`);
      setPrepData(prep);
    } catch (err) {
      console.error("Failed to load meeting prep:", err);
      setPrepData({ error: "Failed to load meeting prep data." });
    } finally {
      setPrepLoading(false);
    }
  };

  const closePrepModal = () => {
    setPrepModalOpen(false);
    setPrepData(null);
  };

  const handleAddClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddClientLoading(true);
    setAddClientError("");
    try {
      await apiClient.post("/portfolio/client", newClient);
      setAddClientModalOpen(false);
      setNewClient({
        name: "",
        email: "",
        segment: "HIGH_NET_WORTH",
        riskProfile: "MODERATE"
      });
      // Refresh data
      await fetchData();
    } catch (err: any) {
      setAddClientError(err.message || "Failed to add client.");
    } finally {
      setAddClientLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!data || !bookData) {
    return <div className="p-8 text-rose-500">Failed to load portfolio data.</div>;
  }

  const stats = [
    { name: "Total AUM", value: `$${(data.totalAum / 1000000).toFixed(2)}M`, change: "+5.2%", trend: "up", icon: DollarSign },
    { name: "YTD Return", value: "12.4%", change: "+2.1%", trend: "up", icon: TrendingUp },
    { name: "Active Clients", value: data.activeClients.toString(), change: "+1", trend: "up", icon: Briefcase },
    { name: "Risk Score Avg", value: "Moderate", change: "Stable", trend: "neutral", icon: PieChart },
  ];

  return (
    <div className="flex-1 overflow-auto relative bg-slate-50 dark:bg-slate-950 p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Portfolio Overview
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">
          Manage and monitor your clients&apos; asset allocations and performance.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-between transition-all hover:shadow-md hover:border-blue-500/50">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {stat.name}
              </span>
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                <stat.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
                {stat.value}
              </span>
              <div className="flex items-center mt-2 space-x-2">
                {stat.trend === "up" ? (
                  <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                ) : stat.trend === "down" ? (
                  <ArrowDownRight className="h-4 w-4 text-rose-500" />
                ) : (
                  <div className="h-4 w-4" />
                )}
                <span className={`text-sm font-medium ${
                  stat.trend === "up" ? "text-emerald-600 dark:text-emerald-400" :
                  stat.trend === "down" ? "text-rose-600 dark:text-rose-400" :
                  "text-slate-500 dark:text-slate-400"
                }`}>
                  {stat.change}
                </span>
                <span className="text-sm text-slate-400">vs last month</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Client Book Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Client Book</h2>
          <button 
            onClick={() => setAddClientModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium text-sm shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Add Client</span>
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 dark:text-slate-400 uppercase">
              <tr>
                <th className="px-6 py-4 font-medium">Client Name</th>
                <th className="px-6 py-4 font-medium">Segment</th>
                <th className="px-6 py-4 font-medium">Risk Profile</th>
                <th className="px-6 py-4 font-medium">Total NAV</th>
                <th className="px-6 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {bookData.clients.map((client: any) => (
                <tr key={client.client_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">{client.name}</td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{client.segment.replace('_', ' ')}</td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{client.risk_profile}</td>
                  <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">${client.total_nav.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => handleMeetingPrep(client.client_id)}
                      className="flex items-center space-x-2 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-400 rounded-lg transition-colors font-medium text-xs"
                    >
                      <FileText className="h-4 w-4" />
                      <span>Meeting Prep</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Meeting Prep Modal */}
      {prepModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-500" />
                AI Meeting Prep
              </h2>
              <button onClick={closePrepModal} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {prepLoading ? (
                <div className="flex flex-col items-center justify-center h-48 space-y-4">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  <p className="text-slate-500 animate-pulse">AI is generating meeting insights...</p>
                </div>
              ) : prepData?.error ? (
                <div className="text-rose-500 p-4 bg-rose-50 rounded-lg">{prepData.error}</div>
              ) : prepData ? (
                <div className="space-y-6">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">{prepData.client_summary?.name}</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><span className="text-slate-500">Segment:</span> {prepData.client_summary?.segment.replace('_', ' ')}</div>
                      <div><span className="text-slate-500">Risk Profile:</span> {prepData.client_summary?.risk_profile}</div>
                      <div><span className="text-slate-500">Total NAV:</span> ${prepData.client_summary?.total_nav.toLocaleString()}</div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3 border-b border-slate-200 pb-2">Talking Points</h3>
                    <ul className="list-disc pl-5 space-y-2 text-slate-700 dark:text-slate-300 text-sm">
                      {prepData.talking_points?.map((point: string, i: number) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  </div>

                  {prepData.pending_recommendations?.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3 border-b border-slate-200 pb-2">Pending Recommendations</h3>
                      <div className="space-y-3">
                        {prepData.pending_recommendations.map((rec: any, i: number) => (
                          <div key={i} className="p-3 border border-blue-100 bg-blue-50 dark:border-blue-900/30 dark:bg-blue-900/10 rounded-lg text-sm">
                            <span className="font-semibold text-blue-700 dark:text-blue-400 block mb-1">{rec.title}</span>
                            <span className="text-slate-600 dark:text-slate-400">{rec.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {prepData.recent_transactions?.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3 border-b border-slate-200 pb-2">Recent Transactions</h3>
                      <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                        {prepData.recent_transactions.map((txn: any, i: number) => (
                          <div key={i} className="flex justify-between items-center py-1">
                            <span><span className={txn.type === 'BUY' ? 'text-emerald-500 font-semibold' : 'text-rose-500 font-semibold'}>{txn.type}</span> {txn.quantity} {txn.ticker}</span>
                            <span className="text-slate-500 text-xs">{new Date(txn.executed_at).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end">
              <button 
                onClick={closePrepModal}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Client Modal */}
      {addClientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-500" />
                Add New Client
              </h2>
              <button onClick={() => setAddClientModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            
            <form onSubmit={handleAddClientSubmit}>
              <div className="p-6 space-y-4">
                {addClientError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 dark:bg-rose-900/30 dark:border-rose-800 dark:text-rose-400 rounded-lg text-sm">
                    {addClientError}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newClient.name}
                    onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                    className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
                    placeholder="Jane Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
                    placeholder="jane@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Segment
                  </label>
                  <select
                    value={newClient.segment}
                    onChange={(e) => setNewClient({ ...newClient, segment: e.target.value })}
                    className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
                  >
                    <option value="MASS_AFFLUENT">Mass Affluent</option>
                    <option value="HIGH_NET_WORTH">High Net Worth</option>
                    <option value="ULTRA_HIGH_NET_WORTH">Ultra High Net Worth</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Risk Profile
                  </label>
                  <select
                    value={newClient.riskProfile}
                    onChange={(e) => setNewClient({ ...newClient, riskProfile: e.target.value })}
                    className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
                  >
                    <option value="CONSERVATIVE">Conservative</option>
                    <option value="MODERATE">Moderate</option>
                    <option value="AGGRESSIVE">Aggressive</option>
                  </select>
                </div>
              </div>
              
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setAddClientModalOpen(false)}
                  className="px-4 py-2 bg-transparent border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={addClientLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center"
                >
                  {addClientLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

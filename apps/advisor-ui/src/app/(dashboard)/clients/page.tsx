"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { 
  Users, 
  Search, 
  Plus, 
  Trash2, 
  X, 
  MoreHorizontal, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  RefreshCw, 
  TrendingUp, 
  DollarSign, 
  Wallet, 
  ShieldAlert, 
  UserPlus,
  Briefcase,
  PieChart as LucidePieChart,
  User,
  Mail,
  Calendar,
  Layers,
  Sparkles,
  ChevronRight,
  TrendingDown
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip as RechartsTooltip, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid 
} from "recharts";

// Beautiful Harmonious Color Palette
const COLORS = [
  "#3B82F6", // Blue (Equities)
  "#10B981", // Emerald (Fixed Income)
  "#F59E0B", // Amber (Cash)
  "#8B5CF6", // Purple (ETFs)
  "#EC4899", // Pink (Alternative)
  "#06B6D4"  // Cyan (Crypto/Other)
];

const SEGMENT_COLORS: Record<string, string> = {
  RETAIL: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700",
  HNW: "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300 border-amber-200 dark:border-amber-900/30",
  HIGH_NET_WORTH: "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300 border-amber-200 dark:border-amber-900/30",
  ULTRA_HIGH_NET_WORTH: "bg-violet-50 text-violet-800 dark:bg-violet-950/30 dark:text-violet-300 border-violet-200 dark:border-violet-900/30",
  ULTRA_HNW: "bg-violet-50 text-violet-800 dark:bg-violet-950/30 dark:text-violet-300 border-violet-200 dark:border-violet-900/30"
};

const RISK_COLORS: Record<string, string> = {
  CONSERVATIVE: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/30",
  MODERATE: "bg-blue-50 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300 border-blue-200 dark:border-blue-900/30",
  AGGRESSIVE: "bg-orange-50 text-orange-800 dark:bg-orange-950/30 dark:text-orange-300 border-orange-200 dark:border-orange-900/30",
  VERY_AGGRESSIVE: "bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300 border-rose-200 dark:border-rose-900/30"
};

const KYC_COLORS: Record<string, { bg: string, icon: any }> = {
  APPROVED: { bg: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", icon: CheckCircle2 },
  PENDING: { bg: "bg-amber-500/10 text-amber-500 border-amber-500/20", icon: Clock },
  REJECTED: { bg: "bg-rose-500/10 text-rose-500 border-rose-500/20", icon: AlertTriangle },
  EXPIRED: { bg: "bg-slate-500/10 text-slate-500 border-slate-500/20", icon: AlertTriangle }
};

export default function ClientsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-[80vh] w-full items-center justify-center bg-slate-50 dark:bg-slate-950">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    }>
      <ClientsPageContent />
    </Suspense>
  );
}

function ClientsPageContent() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [segmentFilter, setSegmentFilter] = useState("ALL");
  const [riskFilter, setRiskFilter] = useState("ALL");

  // Client Details (Drawer) State
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientDetails, setClientDetails] = useState<any>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"overview" | "allocation" | "activity" | "insights">("overview");

  // Add Client Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [newClient, setNewClient] = useState({
    name: "",
    email: "",
    risk_profile: "MODERATE",
    kyc_status: "APPROVED",
    segment: "HIGH_NET_WORTH",
    life_stage: "ACCUMULATION",
    behavioral_flags_str: "ESG_FOCUS, TECH_ENTHUSIAST",
    life_events_str: "UPCOMING_RETIREMENT"
  });

  // Delete Confirmation State
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Parse URL ID parameters
  const searchParams = useSearchParams();
  const clientIdParam = searchParams.get("id");

  // Fetch all book clients
  const fetchClients = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.get<any>("/portfolio/book");
      setClients(data.clients || []);
    } catch (err: any) {
      console.error("Failed to load clients roster:", err);
      setError(err.message || "Failed to load clients book data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (clientIdParam) {
      fetchClientDetails(clientIdParam);
    }
  }, [clientIdParam]);

  // Fetch detailed profile metrics for the Right Drawer
  const fetchClientDetails = async (clientId: string) => {
    try {
      setDrawerLoading(true);
      setDrawerOpen(true);
      setSelectedClientId(clientId);
      setDrawerTab("overview");
      const details = await apiClient.get<any>(`/advisor/clients/${clientId}`);
      setClientDetails(details);
    } catch (err: any) {
      console.error("Failed to fetch client profile:", err);
      setClientDetails({ error: err.message || "Failed to load complete profile data." });
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleAddClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAddLoading(true);
      setAddError(null);
      
      const payload = {
        name: newClient.name,
        email: newClient.email || null,
        risk_profile: newClient.risk_profile,
        kyc_status: newClient.kyc_status,
        segment: newClient.segment,
        life_stage: newClient.life_stage || null,
        behavioral_flags: newClient.behavioral_flags_str.split(",").map(s => s.trim()).filter(Boolean),
        life_events: newClient.life_events_str.split(",").map(s => s.trim()).filter(Boolean)
      };

      await apiClient.post("/advisor/clients", payload);
      setAddModalOpen(false);
      setNewClient({
        name: "",
        email: "",
        risk_profile: "MODERATE",
        kyc_status: "APPROVED",
        segment: "HIGH_NET_WORTH",
        life_stage: "ACCUMULATION",
        behavioral_flags_str: "ESG_FOCUS, TECH_ENTHUSIAST",
        life_events_str: "UPCOMING_RETIREMENT"
      });
      // Refresh roster
      await fetchClients();
    } catch (err: any) {
      setAddError(err.message || "Failed to add client to database.");
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    try {
      setDeleteLoading(true);
      await apiClient.delete(`/advisor/clients/${clientId}`);
      
      // If deleted client was open in the drawer, close it
      if (selectedClientId === clientId) {
        setDrawerOpen(false);
        setClientDetails(null);
      }
      
      setDeleteConfirmId(null);
      // Refresh roster
      await fetchClients();
    } catch (err: any) {
      alert(err.message || "Failed to delete client due to active restrictions.");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Filter Clients
  const filteredClients = clients.filter(c => {
    const matchesSearch = 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesSegment = 
      segmentFilter === "ALL" || 
      c.segment === segmentFilter || 
      (segmentFilter === "HNW" && (c.segment === "HNW" || c.segment === "HIGH_NET_WORTH")) ||
      (segmentFilter === "ULTRA_HNW" && (c.segment === "ULTRA_HNW" || c.segment === "ULTRA_HIGH_NET_WORTH"));

    const matchesRisk = 
      riskFilter === "ALL" || 
      c.risk_profile === riskFilter;

    return matchesSearch && matchesSegment && matchesRisk;
  });

  // Calculate Book level stats
  const totalBookAum = clients.reduce((acc, c) => acc + (c.total_nav || 0), 0);
  const activeClientsCount = clients.length;
  const pendingKycCount = clients.filter(c => c.kyc_status === "PENDING").length;
  const hnwCount = clients.filter(c => c.segment === "HNW" || c.segment === "HIGH_NET_WORTH" || c.segment === "ULTRA_HNW" || c.segment === "ULTRA_HIGH_NET_WORTH").length;

  // Process Drawer Assets for Recharts Pie/Donut Chart
  const getAssetAllocationData = () => {
    if (!clientDetails || !clientDetails.accounts) return [];
    
    const map: Record<string, number> = {};
    let totalValue = 0;
    
    clientDetails.accounts.forEach((acc: any) => {
      // Find latest snapshot
      if (acc.portfolio_snapshots && acc.portfolio_snapshots.length > 0) {
        const snap = acc.portfolio_snapshots[0];
        if (snap.holdings) {
          snap.holdings.forEach((h: any) => {
            const assetClass = h.asset_class || "Other";
            const mv = Number(h.market_value) || 0;
            map[assetClass] = (map[assetClass] || 0) + mv;
            totalValue += mv;
          });
        }
      }
    });

    if (totalValue === 0) return [];
    
    return Object.entries(map).map(([name, value], i) => ({
      name,
      value,
      percentage: ((value / totalValue) * 100).toFixed(1),
      color: COLORS[i % COLORS.length]
    }));
  };

  // Process Drawer Portfolio NAV History for Recharts Area Chart
  const getPortfolioNavHistory = () => {
    if (!clientDetails || !clientDetails.accounts) return [];
    
    const datesMap: Record<string, number> = {};
    
    clientDetails.accounts.forEach((acc: any) => {
      if (acc.portfolio_snapshots) {
        acc.portfolio_snapshots.forEach((snap: any) => {
          const date = new Date(snap.snapshot_ts);
          const key = date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
          datesMap[key] = (datesMap[key] || 0) + snap.nav;
        });
      }
    });

    return Object.entries(datesMap).map(([date, nav]) => ({
      date,
      NAV: nav
    })).reverse(); // chronological order
  };

  const assetAllocationData = getAssetAllocationData();
  const navHistoryData = getPortfolioNavHistory();

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-8 space-y-8 relative min-h-screen">
      {/* Background radial glow */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            Client Book
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm max-w-xl">
            Real-time book management, live behavioral profiling, interactive portfolio allocation analysis, and compliance audit tracking.
          </p>
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={fetchClients}
            className="flex items-center justify-center p-2.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl transition-all border border-slate-200 dark:border-slate-800 shadow-sm"
            title="Refresh clients data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-500" : ""}`} />
          </button>
          
          <button 
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg hover:shadow-blue-500/20 active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            Add Client
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { name: "Book Assets Under Management", value: `$${(totalBookAum / 1000000).toFixed(2)}M`, sub: `${hnwCount} HNWI / UHNWI`, icon: DollarSign, color: "text-blue-500 bg-blue-500/10" },
          { name: "Active Client Book", value: activeClientsCount.toString(), sub: "Managed Advisor Portfolio", icon: Users, color: "text-indigo-500 bg-indigo-500/10" },
          { name: "Average AUM per Roster", value: `$${activeClientsCount > 0 ? (totalBookAum / activeClientsCount / 1000).toFixed(0) : 0}K`, sub: "High average engagement", icon: Wallet, color: "text-emerald-500 bg-emerald-500/10" },
          { name: "Compliance KYC Pending", value: pendingKycCount.toString(), sub: pendingKycCount > 0 ? "Requires advisor outreach" : " Roster fully compliant", icon: ShieldAlert, color: pendingKycCount > 0 ? "text-amber-500 bg-amber-500/10" : "text-emerald-500 bg-emerald-500/10" }
        ].map((stat, i) => (
          <div key={i} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-slate-200/50 dark:border-slate-800/50 flex items-center gap-5 transition-all hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700">
            <div className={`p-3.5 rounded-xl ${stat.color}`}>
              <stat.icon className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{stat.name}</span>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stat.value}</h2>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{stat.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Roster & Search Filters */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200/50 dark:border-slate-800/50 overflow-hidden shadow-md">
        
        {/* Filter Toolbar */}
        <div className="p-5 border-b border-slate-200/50 dark:border-slate-800/50 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
          
          {/* Search */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input 
              type="text" 
              placeholder="Search by client name, email..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-slate-100 placeholder-slate-400 transition-all shadow-inner"
            />
          </div>

          {/* Filters dropdown */}
          <div className="flex flex-wrap w-full md:w-auto items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:inline">Segment</span>
              <select
                value={segmentFilter}
                onChange={(e) => setSegmentFilter(e.target.value)}
                className="px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
              >
                <option value="ALL">All Segments</option>
                <option value="RETAIL">Retail</option>
                <option value="HNW">High Net Worth</option>
                <option value="ULTRA_HNW">Ultra HNW</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:inline">Risk Profile</span>
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
              >
                <option value="ALL">All Risk Profiles</option>
                <option value="CONSERVATIVE">Conservative</option>
                <option value="MODERATE">Moderate</option>
                <option value="AGGRESSIVE">Aggressive</option>
                <option value="VERY_AGGRESSIVE">Very Aggressive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Clients Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-20 flex flex-col items-center justify-center space-y-4">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-slate-500 text-sm font-medium">Fetching dynamic client roster...</p>
            </div>
          ) : error ? (
            <div className="p-20 text-center space-y-3">
              <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Roster Error</h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto text-sm">{error}</p>
              <button 
                onClick={fetchClients}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="p-20 text-center space-y-4 bg-slate-50/30 dark:bg-transparent">
              <Users className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">No matching clients found</h3>
                <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto text-sm">
                  Try adjusting your search queries or resetting risk/segment dropdown filters.
                </p>
              </div>
              <button 
                onClick={() => { setSearchQuery(""); setSegmentFilter("ALL"); setRiskFilter("ALL"); }}
                className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-6 py-4 font-bold">Client Personal details</th>
                  <th className="px-6 py-4 font-bold">Segment</th>
                  <th className="px-6 py-4 font-bold">Risk profile</th>
                  <th className="px-6 py-4 font-bold">KYC status</th>
                  <th className="px-6 py-4 font-bold text-right">Roster AUM</th>
                  <th className="px-6 py-4 font-bold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/50 dark:divide-slate-800/50">
                {filteredClients.map((c) => {
                  const initial = c.name ? c.name.charAt(0) : "U";
                  return (
                    <tr 
                      key={c.client_id} 
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors group cursor-pointer"
                      onClick={() => fetchClientDetails(c.client_id)}
                    >
                      {/* Name & Email */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/20 dark:border-blue-400/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm shadow-inner group-hover:scale-105 transition-transform">
                            {initial}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-800 dark:text-slate-100 block text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {c.name}
                            </span>
                            <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 font-medium mt-0.5">
                              {c.email || "No email provided"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Segment */}
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg border ${SEGMENT_COLORS[c.segment] || "bg-slate-100 text-slate-800 border-slate-200"}`}>
                          {c.segment.replace(/_/g, " ")}
                        </span>
                      </td>

                      {/* Risk Profile */}
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg border ${RISK_COLORS[c.risk_profile] || "bg-slate-100 text-slate-800 border-slate-200"}`}>
                          {c.risk_profile.replace(/_/g, " ")}
                        </span>
                      </td>

                      {/* KYC Status */}
                      <td className="px-6 py-4">
                        {(() => {
                          const kyc = KYC_COLORS[c.kyc_status] || KYC_COLORS.PENDING;
                          const Icon = kyc.icon;
                          return (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border ${kyc.bg}`}>
                              <Icon className="w-3.5 h-3.5" />
                              {c.kyc_status}
                            </span>
                          );
                        })()}
                      </td>

                      {/* AUM */}
                      <td className="px-6 py-4 text-right">
                        <span className="text-slate-800 dark:text-slate-100 font-bold font-mono text-sm">
                          ${(c.total_nav || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => fetchClientDetails(c.client_id)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-bold text-xs rounded-lg transition-all"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Profile
                          </button>
                          
                          <button 
                            onClick={() => setDeleteConfirmId(c.client_id)}
                            className="p-1.5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400 rounded-lg transition-colors"
                            title="Delete Client"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Slide-over Right Drawer Container */}
      <div className={`fixed inset-0 z-40 transition-opacity duration-300 ${drawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
        {/* Drawer Backdrop Overlay */}
        <div 
          onClick={() => setDrawerOpen(false)}
          className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs transition-all" 
        />
        
        {/* Glassmorphic Sliding Drawer Panel */}
        <div className={`absolute top-0 right-0 h-full w-[44%] bg-slate-900/90 dark:bg-slate-950/95 backdrop-blur-xl border-l border-slate-800/80 shadow-2xl text-slate-100 z-50 flex flex-col transition-transform duration-300 ease-out transform ${drawerOpen ? "translate-x-0" : "translate-x-full"}`}>
          {drawerLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4">
              <RefreshCw className="w-10 h-10 animate-spin text-blue-500" />
              <p className="text-slate-400 text-sm font-medium animate-pulse">Loading secure client intelligence...</p>
            </div>
          ) : clientDetails?.error ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <AlertTriangle className="w-12 h-12 text-rose-500" />
              <h3 className="text-lg font-bold">Failed to load Client</h3>
              <p className="text-slate-400 text-sm">{clientDetails.error}</p>
              <button 
                onClick={() => fetchClientDetails(selectedClientId!)}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700"
              >
                Retry
              </button>
            </div>
          ) : clientDetails ? (
            <>
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-800/70 flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold tracking-tight text-white">{clientDetails.name}</h2>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border tracking-wide ${SEGMENT_COLORS[clientDetails.segment] || "bg-slate-800 text-slate-200"}`}>
                      {clientDetails.segment.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs flex items-center gap-1.5 font-medium">
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    {clientDetails.email || "No email address"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setDeleteConfirmId(clientDetails.client_id)}
                    className="p-2 hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
                    title="Delete Client Profile"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setDrawerOpen(false)}
                    className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Quick Summary Cards banner inside drawer */}
              <div className="px-6 py-4 bg-slate-900/40 border-b border-slate-800/50 grid grid-cols-3 gap-4">
                <div className="bg-slate-950/40 border border-slate-800/50 p-3 rounded-xl flex flex-col justify-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Portfolio AUM</span>
                  <span className="text-sm font-bold text-white font-mono mt-1">
                    ${(clientDetails.accounts?.reduce((sum: number, acc: any) => sum + (acc.portfolio_snapshots?.[0]?.nav || 0), 0) || 0).toLocaleString()}
                  </span>
                </div>
                <div className="bg-slate-950/40 border border-slate-800/50 p-3 rounded-xl flex flex-col justify-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Active Risk score</span>
                  <span className={`text-xs font-bold mt-1 inline-block text-left ${
                    clientDetails.risk_profile === 'AGGRESSIVE' || clientDetails.risk_profile === 'VERY_AGGRESSIVE' ? 'text-orange-400' : 'text-emerald-400'
                  }`}>
                    {clientDetails.risk_profile}
                  </span>
                </div>
                <div className="bg-slate-950/40 border border-slate-800/50 p-3 rounded-xl flex flex-col justify-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">KYC Compliance</span>
                  <span className={`text-xs font-bold mt-1 inline-flex items-center gap-1 ${
                    clientDetails.kyc_status === 'APPROVED' ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {clientDetails.kyc_status}
                  </span>
                </div>
              </div>

              {/* Navigation Tabs bar */}
              <div className="flex border-b border-slate-800/60 bg-slate-900/20 text-sm font-medium">
                {(["overview", "allocation", "activity", "insights"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setDrawerTab(tab)}
                    className={`flex-1 py-3 text-center border-b-2 transition-all capitalize font-semibold tracking-wide ${
                      drawerTab === tab 
                        ? "border-blue-500 text-blue-400 bg-blue-500/5" 
                        : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Content Panel Scrollable Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Tab 1: Overview */}
                {drawerTab === "overview" && (
                  <div className="space-y-6">
                    {/* General Profiling Details */}
                    <div className="bg-slate-950/40 border border-slate-800/50 rounded-2xl p-5 space-y-4">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-blue-400 border-b border-slate-800/80 pb-2">Client Demographics & Info</h3>
                      
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1">
                          <span className="text-slate-500 block">Unique Client ID</span>
                          <span className="font-semibold text-slate-300 block select-all font-mono">{clientDetails.client_id}</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-slate-500 block">Life Stage Profiling</span>
                          <span className="font-semibold text-slate-300 block capitalize">
                            {(clientDetails.life_stage || "ACCUMULATION").replace(/_/g, " ").toLowerCase()}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-slate-500 block">Joined Date</span>
                          <span className="font-semibold text-slate-300 block font-mono">
                            <Calendar className="w-3.5 h-3.5 inline mr-1 text-slate-500" />
                            {new Date(clientDetails.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-slate-500 block">Associated Accounts</span>
                          <span className="font-semibold text-slate-300 block">
                            <Layers className="w-3.5 h-3.5 inline mr-1 text-slate-500" />
                            {clientDetails.accounts?.length || 0} active accounts
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Behavioral Intelligence Section */}
                    <div className="bg-slate-950/40 border border-slate-800/50 rounded-2xl p-5 space-y-4">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400 border-b border-slate-800/80 pb-2 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                        AI Behavioral Intelligence
                      </h3>

                      {/* Behavioral Flags tags */}
                      <div className="space-y-2">
                        <span className="text-xs text-slate-500 block">Risk/Behavioral Drift Indicators:</span>
                        <div className="flex flex-wrap gap-2">
                          {clientDetails.behavioral_flags && clientDetails.behavioral_flags.length > 0 ? (
                            clientDetails.behavioral_flags.map((flag: string, i: number) => (
                              <span key={i} className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 capitalize tracking-wide">
                                {flag.replace(/_/g, " ").toLowerCase()}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400 italic">No behavioral anomalies flags active.</span>
                          )}
                        </div>
                      </div>

                      {/* Life Stage Events detected */}
                      <div className="space-y-2 mt-4">
                        <span className="text-xs text-slate-500 block">Detected Future Life Milestones:</span>
                        <div className="flex flex-wrap gap-2">
                          {clientDetails.life_events && clientDetails.life_events.length > 0 ? (
                            clientDetails.life_events.map((evt: string, i: number) => (
                              <span key={i} className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 capitalize tracking-wide">
                                {evt.replace(/_/g, " ").toLowerCase()}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400 italic">No upcoming life event risks.</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Financial profile json metadata */}
                    {clientDetails.profile && Object.keys(clientDetails.profile).length > 0 && (
                      <div className="bg-slate-950/40 border border-slate-800/50 rounded-2xl p-5 space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400 border-b border-slate-800/80 pb-2">KYC Financial Details</h3>
                        
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          {Object.entries(clientDetails.profile).map(([key, val]: [string, any]) => (
                            <div key={key} className="space-y-1">
                              <span className="text-slate-500 block capitalize">{key.replace(/_/g, " ")}</span>
                              <span className="font-semibold text-slate-300 block font-mono">
                                {typeof val === 'number' && key.includes('worth') ? `$${val.toLocaleString()}` : String(val)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: Asset Allocation */}
                {drawerTab === "allocation" && (
                  <div className="space-y-6">
                    {/* Allocation chart card */}
                    <div className="bg-slate-950/40 border border-slate-800/50 rounded-2xl p-5 flex flex-col items-center">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-blue-400 border-b border-slate-800/80 pb-2 w-full mb-4">Holdings Asset Class distribution</h3>
                      
                      {assetAllocationData.length > 0 ? (
                        <div className="w-full flex flex-col sm:flex-row items-center gap-6">
                          {/* Donut Chart */}
                          <div className="w-48 h-48">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={assetAllocationData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={55}
                                  outerRadius={75}
                                  paddingAngle={3}
                                  dataKey="value"
                                >
                                  {assetAllocationData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <RechartsTooltip 
                                  formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Value']}
                                  contentStyle={{ backgroundColor: '#1E293B', borderColor: '#475569', borderRadius: '8px', color: '#F8FAFC' }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          
                          {/* Legend list */}
                          <div className="flex-1 space-y-2.5 w-full text-xs">
                            {assetAllocationData.map((item, i) => (
                              <div key={i} className="flex justify-between items-center bg-slate-900/30 p-2 rounded-lg border border-slate-800/40">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                  <span className="font-semibold text-slate-300">{item.name}</span>
                                </div>
                                <span className="font-bold text-white font-mono">{item.percentage}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-10 space-y-2">
                          <LucidePieChart className="w-12 h-12 text-slate-700 mx-auto" />
                          <p className="text-slate-400 text-xs italic">No dynamic assets found in portfolio snapshot.</p>
                        </div>
                      )}
                    </div>

                    {/* Detailed holdings list grid */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Roster Holdings break down</h4>
                      
                      {clientDetails.accounts?.map((acc: any) => (
                        <div key={acc.account_id} className="space-y-2">
                          <div className="px-2 py-1 bg-slate-800/40 rounded border border-slate-800 text-[10px] font-bold text-blue-400 uppercase tracking-wide flex justify-between">
                            <span>Account: {acc.account_type} - {acc.custodian}</span>
                            <span>{acc.currency}</span>
                          </div>
                          
                          {acc.portfolio_snapshots?.[0]?.holdings && acc.portfolio_snapshots[0].holdings.length > 0 ? (
                            acc.portfolio_snapshots[0].holdings.map((h: any, j: number) => (
                              <div key={j} className="bg-slate-950/40 border border-slate-800/40 p-3 rounded-xl flex items-center justify-between text-xs transition-hover hover:border-slate-700">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-white font-mono">{h.ticker}</span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 capitalize">{h.asset_class}</span>
                                  </div>
                                  <span className="text-slate-500 block text-[10px] font-medium truncate max-w-[200px]">{h.name}</span>
                                </div>
                                <div className="text-right space-y-0.5 font-mono">
                                  <span className="font-bold text-slate-200 block">${(h.market_value || 0).toLocaleString()}</span>
                                  <span className="text-[10px] text-slate-500 block">{h.quantity} units @ ${h.current_price}</span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-slate-500 text-xs italic px-2">No individual positions registered.</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tab 3: Activity & Timeline */}
                {drawerTab === "activity" && (
                  <div className="space-y-6">
                    {/* Performance NAV Area Chart */}
                    <div className="bg-slate-950/40 border border-slate-800/50 rounded-2xl p-5">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400 border-b border-slate-800/80 pb-2 mb-4 w-full">Portfolio Valuation (NAV Timeline)</h3>
                      
                      {navHistoryData.length > 1 ? (
                        <div className="w-full h-44 text-[10px] text-slate-400 font-mono">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={navHistoryData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                              <defs>
                                <linearGradient id="colorNav" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.4}/>
                                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                              <XAxis dataKey="date" stroke="#475569" />
                              <YAxis stroke="#475569" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                              <RechartsTooltip 
                                formatter={(value) => [`$${Number(value).toLocaleString()}`, 'NAV']}
                                contentStyle={{ backgroundColor: '#1E293B', borderColor: '#475569', borderRadius: '8px', color: '#F8FAFC' }}
                              />
                              <Area type="monotone" dataKey="NAV" stroke="#8B5CF6" strokeWidth={2} fillOpacity={1} fill="url(#colorNav)" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="text-center py-6 text-slate-500 italic text-xs">
                          Insufficient historical snapshots to render valuation trend.
                        </div>
                      )}
                    </div>

                    {/* Historical Transactions List */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Roster Order & Transaction Audit</h4>
                      
                      {clientDetails.all_transactions && clientDetails.all_transactions.length > 0 ? (
                        <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                          {clientDetails.all_transactions.map((txn: any) => {
                            const isBuy = txn.type === "BUY" || txn.type === "Rebalance";
                            const totalAmount = txn.quantity * txn.price;
                            
                            return (
                              <div key={txn.txn_id} className="bg-slate-950/40 border border-slate-800/40 p-3.5 rounded-xl flex items-center justify-between transition-all hover:border-slate-800">
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-lg ${
                                    isBuy ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                                  }`}>
                                    {isBuy ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-white text-xs">{txn.instrument?.ticker || "UNKN"}</span>
                                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded capitalize ${
                                        isBuy ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                                      }`}>{txn.type}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                                      {new Date(txn.executed_at).toLocaleDateString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                  </div>
                                </div>
                                
                                <div className="text-right font-mono">
                                  <span className="text-xs font-bold text-slate-200 block">${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  <span className="text-[9px] text-slate-500 block">{txn.quantity} units @ ${txn.price}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-10 bg-slate-950/20 border border-slate-800/40 rounded-xl">
                          <p className="text-slate-500 text-xs italic">No transaction history detected for accounts.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tab 4: Insights & Rules */}
                {drawerTab === "insights" && (
                  <div className="space-y-6">
                    {/* AI Recommendations */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider px-1 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        Advisor Next Best Actions
                      </h4>

                      {clientDetails.ai_recommendations && clientDetails.ai_recommendations.length > 0 ? (
                        <div className="space-y-3">
                          {clientDetails.ai_recommendations.map((rec: any) => {
                            const rationale = rec.payload?.rationale || "Next best financial asset allocation drift outreach.";
                            return (
                              <div key={rec.rec_id} className="bg-slate-950/40 border border-slate-800/40 p-4 rounded-xl space-y-2.5 transition-all hover:border-slate-800">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">{rec.rec_type.replace(/_/g, " ")}</span>
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    {new Date(rec.created_at).toLocaleDateString()}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                                  {rationale}
                                </p>
                                <div className="flex justify-end gap-2 pt-1 border-t border-slate-900 mt-2">
                                  <button className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] rounded-lg transition-colors tracking-wide uppercase">
                                    Deploy Action
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-10 bg-slate-950/20 border border-slate-800/40 rounded-xl">
                          <p className="text-slate-500 text-xs italic">AI Engines report zero drifting warnings.</p>
                        </div>
                      )}
                    </div>

                    {/* Active Compliance Warnings / Alerts */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider px-1 flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Compliance Warnings & Alerts
                      </h4>

                      {clientDetails.alerts && clientDetails.alerts.length > 0 ? (
                        <div className="space-y-2.5">
                          {clientDetails.alerts.map((al: any) => (
                            <div key={al.alert_id} className={`p-4 rounded-xl border flex gap-3 text-xs ${
                              al.severity === "WARN" || al.severity === "BLOCK"
                                ? "bg-rose-500/10 border-rose-500/20 text-rose-300"
                                : "bg-blue-500/10 border-blue-500/20 text-blue-300"
                            }`}>
                              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                              <div className="space-y-1">
                                <span className="font-bold uppercase tracking-wider block text-[10px]">
                                  {al.alert_type} • {al.severity}
                                </span>
                                <p className="leading-relaxed font-medium text-slate-300">{al.message}</p>
                                <span className="block text-[9px] text-slate-500 font-mono pt-1">
                                  Logged: {new Date(al.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs flex gap-2 items-center font-medium">
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                          <span>Roster accounts conform fully with FINRA, Dodd-Frank, and Firm-level allocation rules.</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Drawer Footer controls */}
              <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 flex justify-between items-center">
                <button
                  onClick={() => setDeleteConfirmId(clientDetails.client_id)}
                  className="flex items-center gap-1.5 text-xs font-bold text-rose-500 hover:text-rose-400 transition-colors border border-rose-500/20 hover:border-rose-500/50 bg-rose-500/5 px-3 py-2 rounded-xl"
                >
                  <Trash2 className="w-4 h-4" />
                  Purge Client
                </button>
                
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold tracking-wide transition-colors"
                >
                  Close Profile
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Add Client Dialog Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col transition-all duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-850">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
                <UserPlus className="w-5 h-5 text-blue-500" />
                Add New Client
              </h2>
              <button 
                onClick={() => setAddModalOpen(false)} 
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <form onSubmit={handleAddClientSubmit}>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                {addError && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-medium">
                    {addError}
                  </div>
                )}
                
                {/* Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                    Client Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newClient.name}
                    onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                    className="block w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm placeholder-slate-400"
                    placeholder="Jane Doe"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    className="block w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm placeholder-slate-400"
                    placeholder="jane@example.com"
                  />
                </div>

                {/* Segment & Risk Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                      Roster Segment
                    </label>
                    <select
                      value={newClient.segment}
                      onChange={(e) => setNewClient({ ...newClient, segment: e.target.value })}
                      className="block w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm cursor-pointer"
                    >
                      <option value="RETAIL">Retail</option>
                      <option value="HIGH_NET_WORTH">High Net Worth</option>
                      <option value="ULTRA_HIGH_NET_WORTH">Ultra High Net Worth</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                      Risk Profile
                    </label>
                    <select
                      value={newClient.risk_profile}
                      onChange={(e) => setNewClient({ ...newClient, risk_profile: e.target.value })}
                      className="block w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm cursor-pointer"
                    >
                      <option value="CONSERVATIVE">Conservative</option>
                      <option value="MODERATE">Moderate</option>
                      <option value="AGGRESSIVE">Aggressive</option>
                      <option value="VERY_AGGRESSIVE">Very Aggressive</option>
                    </select>
                  </div>
                </div>

                {/* KYC & Life Stage Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                      KYC Status Check
                    </label>
                    <select
                      value={newClient.kyc_status}
                      onChange={(e) => setNewClient({ ...newClient, kyc_status: e.target.value })}
                      className="block w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm cursor-pointer"
                    >
                      <option value="APPROVED">Approved</option>
                      <option value="PENDING">Pending</option>
                      <option value="REJECTED">Rejected</option>
                      <option value="EXPIRED">Expired</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                      Life Stage Demographic
                    </label>
                    <select
                      value={newClient.life_stage}
                      onChange={(e) => setNewClient({ ...newClient, life_stage: e.target.value })}
                      className="block w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm cursor-pointer"
                    >
                      <option value="ACCUMULATION">Accumulation</option>
                      <option value="NEAR_RETIREMENT">Near Retirement</option>
                      <option value="RETIREMENT">Retirement</option>
                    </select>
                  </div>
                </div>

                {/* Behavioral Flags tags input */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                    Behavioral Flags (Comma Separated)
                  </label>
                  <input
                    type="text"
                    value={newClient.behavioral_flags_str}
                    onChange={(e) => setNewClient({ ...newClient, behavioral_flags_str: e.target.value })}
                    className="block w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm placeholder-slate-400"
                    placeholder="ESG_FOCUS, FEE_SENSITIVE, TECH_ENTHUSIAST"
                  />
                </div>

                {/* Life Events tags input */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                    Life Stage Events (Comma Separated)
                  </label>
                  <input
                    type="text"
                    value={newClient.life_events_str}
                    onChange={(e) => setNewClient({ ...newClient, life_events_str: e.target.value })}
                    className="block w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm placeholder-slate-400"
                    placeholder="UPCOMING_RETIREMENT, COLLEGE_FUNDING"
                  />
                </div>
              </div>
              
              {/* Footer */}
              <div className="p-4 border-t border-slate-100 dark:border-slate-850 bg-slate-50 dark:bg-slate-900/60 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-850 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={addLoading}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center shadow-lg shadow-blue-500/10 active:scale-95 disabled:opacity-50"
                >
                  {addLoading && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                  Save New Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Cascading Purge Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-900/30 shadow-2xl w-full max-w-md overflow-hidden flex flex-col p-6 space-y-6">
            <div className="flex gap-4">
              <div className="p-3 bg-rose-500/10 text-rose-500 rounded-xl h-fit">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div className="space-y-1 flex-1">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Permanent Roster Deletion</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed font-medium">
                  Warning! Deleting this client triggers an immediate cascade purge across the database. This action permanently deletes:
                </p>
                <ul className="list-disc pl-5 text-slate-500 dark:text-slate-400 text-[10px] space-y-1 font-semibold mt-2">
                  <li>Client Personal Details & KYC Profiles</li>
                  <li>All accounts and financial history</li>
                  <li>All historical transaction audits</li>
                  <li>All portfolio snapshot logs</li>
                  <li>AI Recommendations & compliance alert archives</li>
                </ul>
                <p className="text-rose-500 text-xs font-bold mt-3">This change is completely IRREVERSIBLE!</p>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                disabled={deleteLoading}
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-850 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={deleteLoading}
                onClick={() => handleDeleteClient(deleteConfirmId)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center disabled:opacity-50"
              >
                {deleteLoading && <RefreshCw className="h-4.5 w-4.5 mr-2 animate-spin" />}
                Purge All Records
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

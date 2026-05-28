"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  AlertTriangle, 
  TrendingDown, 
  TrendingUp,
  Users, 
  DollarSign, 
  Activity, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  ArrowUpRight, 
  ArrowDownRight, 
  ArrowRight, 
  MessageSquare, 
  Loader2, 
  Sparkles, 
  ShieldAlert,
  Inbox,
  BarChart3,
  Percent,
  Check,
  Trash2
} from "lucide-react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from "recharts";
import { apiClient } from "@/lib/api";

interface AlertItem {
  alert_id: string;
  category: "MARKET" | "CLIENT" | "COMPLIANCE" | "AUM";
  alert_type: string;
  severity: "BLOCK" | "WARN" | "INFO";
  message: string;
  client_name: string | null;
  client_id: string | null;
  created_at: string;
  is_read: boolean;
  metadata?: any;
}

interface AlertSummary {
  totalAlerts: number;
  criticalCount: number;
  volatilePortfolios: number;
  firmAumDrawdown: number;
}

interface AlertsResponse {
  summary: AlertSummary;
  alerts: AlertItem[];
  chart_data: any[];
}

export default function AlertsPage() {
  const router = useRouter();
  const [data, setData] = useState<AlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<string>("ALL");
  
  // Interactive UI state
  const [readAlerts, setReadAlerts] = useState<Set<string>>(new Set());
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  
  // Drift modal state
  const [selectedDrift, setSelectedDrift] = useState<AlertItem | null>(null);
  const [driftModalOpen, setDriftModalOpen] = useState(false);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<AlertsResponse>("/advisor/alerts");
      setData(res);
    } catch (err: any) {
      console.error("Failed to load alerts:", err);
      setError(err.message || "Failed to load alerts from backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[80vh] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          <p className="text-sm text-muted-foreground animate-pulse">Syncing dynamic risk engines...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-[80vh] w-full flex-col items-center justify-center p-6 text-center">
        <XCircle className="w-16 h-16 text-red-500 mb-4 animate-bounce" />
        <h2 className="text-xl font-bold text-foreground mb-2">Sync Connection Failure</h2>
        <p className="text-sm text-muted-foreground max-w-md mb-6">
          {error || "Could not retrieve real-time alerts. Ensure your backend copilot service is running."}
        </p>
        <button 
          onClick={fetchAlerts}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg hover:shadow-blue-500/25 transition-all"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const { summary, alerts, chart_data } = data;

  // Filter alerts by tab and remove dismissed ones
  const filteredAlerts = alerts
    .filter(a => !dismissedAlerts.has(a.alert_id))
    .filter(a => activeTab === "ALL" || a.category === activeTab);

  // Stats calculation considering local read/dismiss operations
  const unreadAlertsCount = alerts.filter(a => !readAlerts.has(a.alert_id) && !dismissedAlerts.has(a.alert_id)).length;
  const criticalCount = alerts.filter(a => a.severity === "BLOCK" && !dismissedAlerts.has(a.alert_id)).length;

  const handleMarkAsRead = (alertId: string) => {
    setReadAlerts(prev => {
      const next = new Set(prev);
      next.add(alertId);
      return next;
    });
  };

  const handleDismiss = (alertId: string) => {
    setDismissedAlerts(prev => {
      const next = new Set(prev);
      next.add(alertId);
      return next;
    });
  };

  const handleInitiateOutreach = (alert: AlertItem) => {
    let msg = "";
    if (alert.alert_type === "PORTFOLIO_DRIFT") {
      msg = `Draft a personalized quarterly rebalancing proposal email for client ${alert.client_name || 'Valued Client'} to fix their portfolio drift. Mention that we are dynamically re-allocating assets to align with their target profile.`;
    } else if (alert.alert_type === "CONCENTRATION_LIMIT_EXCEEDED") {
      msg = `Create a risk advisory memo for ${alert.client_name || 'our client'} warning them about single equity concentration risk. Provide recommendations to trim over-concentrated positions and diversify into diversified ETFs.`;
    } else if (alert.alert_type === "KYC_EXPIRATION_WARNING") {
      msg = `Write a polite onboarding compliance email outreach for ${alert.client_name || 'our client'} requesting that they log in to sign the updated digital KYC certification form.`;
    } else if (alert.alert_type === "FIRM_AUM_DOWNFALL") {
      msg = `Compile a macro sector update report that I can send to high net worth clients explaining the current market correction and outlining why our long-term structural allocation strategies remain highly resilient.`;
    } else {
      msg = `Help me prepare outreach speaking points for ${alert.client_name || 'my client'} regarding this alert: "${alert.message}"`;
    }

    const query = new URLSearchParams({
      message: msg,
      client_id: alert.client_id || ""
    });
    router.push(`/chat?${query.toString()}`);
  };

  const openDriftDetails = (alert: AlertItem) => {
    setSelectedDrift(alert);
    setDriftModalOpen(true);
  };

  const closeDriftModal = () => {
    setDriftModalOpen(false);
    setSelectedDrift(null);
  };

  // Helper for severity color badges
  const getSeverityBadge = (severity: "BLOCK" | "WARN" | "INFO") => {
    switch (severity) {
      case "BLOCK":
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/10 border border-red-500/30 text-red-400 glow-red">
            <ShieldAlert className="w-3 h-3" /> Critical Block
          </span>
        );
      case "WARN":
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 text-amber-400 glow-amber">
            <AlertTriangle className="w-3 h-3" /> Warning
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 border border-blue-500/30 text-blue-400 glow-blue">
            <Activity className="w-3 h-3" /> Information
          </span>
        );
    }
  };

  // Helper for category-specific icon
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "MARKET":
        return <TrendingDown className="w-4 h-4 text-purple-400 animate-pulse" />;
      case "CLIENT":
        return <Users className="w-4 h-4 text-emerald-400" />;
      case "AUM":
        return <DollarSign className="w-4 h-4 text-blue-400" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto animate-fade-in-up">
      
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground via-blue-200 to-teal-200 bg-clip-text text-transparent">
              Risk & Compliance Monitor
            </h1>
            <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
              <Sparkles className="w-3 h-3 animate-spin" /> Engine Connected
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time compliance analytics, portfolio drifts, concentration limits, and macroeconomic market risk signals.
          </p>
        </div>
        <button 
          onClick={fetchAlerts}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary/80 border border-border/80 text-foreground hover:bg-secondary transition-all text-xs font-medium self-start"
        >
          <Activity className="w-3.5 h-3.5" /> Re-Scan Systems
        </button>
      </div>

      {/* ── Dynamic Statistics Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Risk Index */}
        <div className="glass rounded-2xl p-5 border border-border/40 relative overflow-hidden group hover:border-blue-500/30 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Alert Risk Index</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Activity className="w-4 h-4 text-blue-400" />
            </div>
          </div>
          <div className="mt-4 flex items-end gap-3">
            <span className="text-3xl font-extrabold text-foreground tracking-tight">78<span className="text-sm font-medium text-muted-foreground">/100</span></span>
            <span className="text-xs text-red-400 font-medium pb-1.5 flex items-center gap-0.5">
              <ArrowUpRight className="w-3.5 h-3.5" /> +12% Elevated
            </span>
          </div>
          {/* Circular Progress Micro-chart */}
          <div className="mt-3.5 w-full bg-secondary/50 rounded-full h-1.5 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full w-[78%]" />
          </div>
        </div>

        {/* Clients At Risk */}
        <div className="glass rounded-2xl p-5 border border-border/40 relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Clients At Risk</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Users className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div className="mt-4 flex items-end gap-3">
            <span className="text-3xl font-extrabold text-foreground tracking-tight">{summary.volatilePortfolios}</span>
            <span className="text-xs text-emerald-400 font-medium pb-1.5 flex items-center gap-0.5">
              Active Portfolios
            </span>
          </div>
          <div className="mt-3.5 w-full bg-secondary/50 rounded-full h-1.5 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full w-[35%]" />
          </div>
        </div>

        {/* Firm AUM Drawdown */}
        <div className="glass rounded-2xl p-5 border border-border/40 relative overflow-hidden group hover:border-purple-500/30 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Firm AUM Drawdown</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-purple-400 animate-pulse" />
            </div>
          </div>
          <div className="mt-4 flex items-end gap-3">
            <span className="text-3xl font-extrabold text-red-400 tracking-tight">-{summary.firmAumDrawdown}%</span>
            <span className="text-xs text-red-400 font-medium pb-1.5 flex items-center gap-0.5">
              <ArrowDownRight className="w-3.5 h-3.5" /> Market Dip
            </span>
          </div>
          <div className="mt-3.5 w-full bg-secondary/50 rounded-full h-1.5 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full w-[54%]" />
          </div>
        </div>

        {/* Operational Alerts */}
        <div className="glass rounded-2xl p-5 border border-border/40 relative overflow-hidden group hover:border-amber-500/30 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Alerts</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <div className="mt-4 flex items-end gap-3">
            <span className="text-3xl font-extrabold text-foreground tracking-tight">{unreadAlertsCount}</span>
            <span className="text-xs text-red-400 font-semibold pb-1.5 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-ping inline-block" /> {criticalCount} Critical
            </span>
          </div>
          <div className="mt-3.5 w-full bg-secondary/50 rounded-full h-1.5 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 h-full rounded-full w-[65%]" />
          </div>
        </div>

      </div>

      {/* ── Section Grid: Feed on Left, Charts on Right ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Side: Category Filters & Alerts List */}
        <div className="xl:col-span-2 space-y-4">
          
          {/* Glassmorphic Tabs Filter Bar */}
          <div className="glass p-1.5 rounded-2xl border border-border/40 flex flex-wrap gap-1 items-center justify-between">
            <div className="flex flex-wrap gap-1">
              {[
                { id: "ALL", label: "All Alerts", icon: Inbox },
                { id: "COMPLIANCE", label: "Compliance Risks", icon: ShieldAlert },
                { id: "CLIENT", label: "Client Volatility", icon: Users },
                { id: "MARKET", label: "Market Drifts", icon: TrendingUp },
                { id: "AUM", label: "Firm Assets", icon: DollarSign }
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                      isActive 
                        ? "bg-blue-500/15 border border-blue-500/35 text-blue-300 glow-blue" 
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
            <div className="text-[10px] text-muted-foreground pr-3 font-semibold uppercase tracking-wider hidden sm:block">
              Showing {filteredAlerts.length} Signals
            </div>
          </div>

          {/* Alerts Feed */}
          <div className="space-y-3.5">
            {filteredAlerts.length === 0 ? (
              <div className="glass rounded-2xl p-12 text-center border border-border/30 flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/25 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-1">Clear Horizon</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Excellent! No active alerts matching this category. Everything is within standard risk thresholds.
                </p>
              </div>
            ) : (
              filteredAlerts.map(alert => {
                const isRead = readAlerts.has(alert.alert_id);
                return (
                  <div
                    key={alert.alert_id}
                    className={`glass rounded-2xl border transition-all duration-300 p-5 group flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden ${
                      isRead 
                        ? "opacity-60 border-border/20" 
                        : alert.severity === "BLOCK"
                        ? "border-red-500/30 hover:border-red-500/50 hover:bg-red-500/[0.02]"
                        : alert.severity === "WARN"
                        ? "border-amber-500/30 hover:border-amber-500/50 hover:bg-amber-500/[0.02]"
                        : "border-blue-500/20 hover:border-blue-500/40 hover:bg-blue-500/[0.02]"
                    }`}
                  >
                    {/* Glowing highlight strip */}
                    <div className={`absolute top-0 left-0 w-1 h-full ${
                      alert.severity === "BLOCK" 
                        ? "bg-red-500" 
                        : alert.severity === "WARN" 
                        ? "bg-amber-500" 
                        : "bg-blue-500"
                    }`} />

                    <div className="flex gap-4 items-start flex-1">
                      {/* Icon */}
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        alert.severity === "BLOCK"
                          ? "bg-red-500/10 border border-red-500/30"
                          : alert.severity === "WARN"
                          ? "bg-amber-500/10 border border-amber-500/30"
                          : "bg-blue-500/10 border border-blue-500/30"
                      }`}>
                        {getCategoryIcon(alert.category)}
                      </div>

                      {/* Content */}
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {getSeverityBadge(alert.severity)}
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {alert.alert_type}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-foreground leading-relaxed">
                          {alert.message}
                        </p>
                        
                        {/* Dynamic Client Indicator or Drift button */}
                        {alert.client_name && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Users className="w-3 h-3 text-muted-foreground" /> Client: 
                              <span className="font-semibold text-foreground/90">{alert.client_name}</span>
                            </span>
                            
                            {/* Drift triggers */}
                            {(alert.alert_type === "PORTFOLIO_DRIFT" || alert.alert_type === "CONCENTRATION_LIMIT_EXCEEDED") && (
                              <button 
                                onClick={() => openDriftDetails(alert)}
                                className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-0.5 border-b border-dashed border-blue-500/30 hover:border-blue-400 transition-all pb-0.5 cursor-pointer ml-1"
                              >
                                <BarChart3 className="w-3 h-3" /> View Allocation Drift
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Dynamic Action Buttons */}
                    <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
                      <button
                        onClick={() => handleInitiateOutreach(alert)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-blue-500/20 transition-all"
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> Outreach
                      </button>
                      
                      {!isRead && (
                        <button
                          onClick={() => handleMarkAsRead(alert.alert_id)}
                          title="Mark as Read"
                          className="w-8 h-8 rounded-xl border border-border/80 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleDismiss(alert.alert_id)}
                        title="Mute Alert"
                        className="w-8 h-8 rounded-xl border border-border/80 flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                  </div>
                );
              })
            )}
          </div>

        </div>

        {/* Right Side: Recharts Historical AUM Drawdown Chart */}
        <div className="space-y-6">
          
          {/* Historic AUM Drawdown Panel */}
          <div className="glass rounded-2xl p-5 border border-border/40 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-purple-400" /> AUM Drawdown Trend
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Historical weekly firm-wide aggregate client AUM assets.
              </p>
            </div>

            {/* Recharts Area Graph */}
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chart_data}
                  margin={{ top: 10, right: 5, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="aumGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(210 100% 56%)" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="hsl(210 100% 56%)" stopOpacity={0.01}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="week" 
                    tickLine={false} 
                    axisLine={false} 
                    dy={8}
                  />
                  <YAxis 
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    tickLine={false}
                    axisLine={false}
                    dx={-8}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="glass rounded-xl p-3 border border-border/80 shadow-lg text-xs space-y-1 font-sans">
                            <p className="font-bold text-foreground">{data.date}</p>
                            <p className="text-blue-400">AUM: <span className="font-semibold text-foreground">${parseFloat(data.aum).toLocaleString()}</span></p>
                            <p className="text-red-400">Drawdown: <span className="font-semibold">{data.drawdown}%</span></p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="aum"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#aumGlow)"
                    activeDot={{ r: 5, stroke: "#3b82f6", strokeWidth: 1 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Dynamic audit logs callout */}
            <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 flex gap-3">
              <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="text-[11px] font-bold text-purple-300">Intelligent Portfolio Rebalance</span>
                <p className="text-[10px] text-muted-foreground leading-normal">
                  Outreach messages triggered via Copilot will automatically analyze macro asset classes to draft safe portfolio drift adjustments.
                </p>
              </div>
            </div>

          </div>

          {/* Compliance Audit Guidelines */}
          <div className="glass rounded-2xl p-5 border border-border/40 space-y-3">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-widest">Compliance Audit Standards</h3>
            <div className="space-y-2.5">
              
              <div className="flex gap-2.5 items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
                <p className="text-[11px] text-muted-foreground leading-normal">
                  <span className="font-semibold text-foreground/90">Single Stock Cap</span>: Under FINRA limit guidelines, alert flags automatically trigger when a single equity allocation exceeds 20% of net asset value.
                </p>
              </div>

              <div className="flex gap-2.5 items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                <p className="text-[11px] text-muted-foreground leading-normal">
                  <span className="font-semibold text-foreground/90">Portfolio Drift Limit</span>: Dynamic warnings fire when accounts drift &gt;5% from core target allocations based on client profiles.
                </p>
              </div>

              <div className="flex gap-2.5 items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0 mt-1.5" />
                <p className="text-[11px] text-muted-foreground leading-normal">
                  <span className="font-semibold text-foreground/90">KYC Recertification</span>: Active KYC checks expire annually and automatically block critical brokerage transaction approvals if stale.
                </p>
              </div>

            </div>
          </div>

        </div>

      </div>

      {/* ── Allocation Drift Visualizer Modal ── */}
      {driftModalOpen && selectedDrift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          
          <div className="glass rounded-2xl w-full max-w-lg overflow-hidden border border-border/80 shadow-2xl relative animate-fade-in-up">
            {/* Header */}
            <div className="p-5 border-b border-border/40 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-foreground">Allocation Drift Analysis</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Auditing: {selectedDrift.client_name}
                </p>
              </div>
              <button 
                onClick={closeDriftModal}
                className="w-7 h-7 rounded-lg border border-border hover:bg-secondary/60 flex items-center justify-center transition-all text-muted-foreground hover:text-foreground"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 leading-normal">
                {selectedDrift.message}
              </div>

              {/* Dynamic visual asset drifts */}
              <div className="space-y-4">
                {selectedDrift.metadata?.drifts?.length > 0 ? (
                  selectedDrift.metadata.drifts.map((drift: any, idx: number) => {
                    const isPositive = parseFloat(drift.diff) > 0;
                    const diffColor = isPositive ? "text-red-400" : "text-amber-400";
                    const barColor = isPositive ? "bg-red-400" : "bg-amber-400";
                    const diffText = isPositive ? `+${drift.diff}%` : `${drift.diff}%`;

                    return (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-foreground">{drift.assetClass}</span>
                          <span className={diffColor}>Drift: {diffText}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 items-center">
                          <div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">Target ({drift.target}%)</div>
                            <div className="w-full bg-secondary/80 rounded-full h-2">
                              <div className="bg-blue-400 h-full rounded-full" style={{ width: `${Math.min(drift.target, 100)}%` }} />
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">Current ({drift.current}%)</div>
                            <div className="w-full bg-secondary/80 rounded-full h-2">
                              <div className={`${barColor} h-full rounded-full`} style={{ width: `${Math.min(drift.current, 100)}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    Detailed allocation breakdown not available for this alert.
                  </div>
                )}
              </div>

              {/* Warning box */}
              {selectedDrift.metadata?.rationale && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3 text-xs leading-normal">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-muted-foreground">
                    {selectedDrift.metadata.rationale}
                  </p>
                </div>
              )}

            </div>

            {/* Footer buttons */}
            <div className="p-5 border-t border-border/40 bg-secondary/35 flex justify-end gap-3">
              <button 
                onClick={closeDriftModal}
                className="px-4 py-2 border border-border rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground transition-all"
              >
                Close Audit
              </button>
              <button 
                onClick={() => {
                  closeDriftModal();
                  handleInitiateOutreach(selectedDrift);
                }}
                className="flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition-all"
              >
                <MessageSquare className="w-3.5 h-3.5" /> Launch AI Outreach <ArrowRight className="w-3 h-3" />
              </button>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}

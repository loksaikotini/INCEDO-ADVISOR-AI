"use client";

import React, { useEffect, useState } from "react";
import { 
  FileSpreadsheet, Loader2, Users, CreditCard, 
  AlertTriangle, FileText, CheckCircle2, XCircle, 
  ArrowRight, ShieldCheck, RefreshCw, Clock
} from "lucide-react";
import { apiClient } from "@/lib/api";

export default function OperationsPortal() {
  const [activeTab, setActiveTab] = useState<"onboarding" | "settlement" | "exceptions" | "documents">("onboarding");
  const [data, setData] = useState<any>({
    onboarding_clients: [],
    trade_settlements: [],
    workflow_exceptions: [],
    document_processing: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchOperationsData = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await apiClient.get<any>("/operations/dashboard");
      setData(response);
    } catch (err: any) {
      console.error("Failed to load operations dashboard:", err);
      setError(err.message || "Could not retrieve operational activities.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOperationsData();
  }, []);

  const handleApproveKyc = async (clientId: string) => {
    try {
      setActionLoading(`kyc-${clientId}`);
      await apiClient.post(`/operations/clients/${clientId}/kyc`, { status: "APPROVED" });
      // update state locally
      setData((prev: any) => ({
        ...prev,
        onboarding_clients: prev.onboarding_clients.map((c: any) => 
          c.client_id === clientId ? { ...c, kyc_status: "APPROVED" } : c
        )
      }));
    } catch (err: any) {
      console.error("KYC Approval failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSettleTrade = async (txnId: string) => {
    try {
      setActionLoading(`settle-${txnId}`);
      await apiClient.post(`/operations/transactions/${txnId}/settle`, {});
      // update state locally
      setData((prev: any) => ({
        ...prev,
        trade_settlements: prev.trade_settlements.map((t: any) => 
          t.txn_id === txnId ? { ...t, status: "SETTLED" } : t
        )
      }));
    } catch (err: any) {
      console.error("Trade settlement failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const getKycBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case "APPROVED":
        return "px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400";
      case "REJECTED":
        return "px-2 py-0.5 text-xs font-bold rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400";
      default:
        return "px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400";
    }
  };

  const getSettleBadge = (status: string) => {
    if (status.toUpperCase() === "SETTLED") {
      return "px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400";
    }
    return "px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 animate-pulse";
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
        <p className="mt-4 text-sm text-slate-400 font-medium">Loading Operations Control Center...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-slate-950 p-8 space-y-8 text-slate-100 min-h-screen">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Operations Control Center
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            Execute back-office business pipelines: KYC onboarding verification, trade settlements matching, exception clearance.
          </p>
        </div>
        <div>
          <button
            onClick={fetchOperationsData}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-all"
          >
            <RefreshCw className="w-4 h-4" /> Refresh Dashboard
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-900/30 border border-rose-800 text-rose-300 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Operations Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">KYC Onboarding</div>
          <div className="text-2xl font-bold mt-2 text-blue-400">
            {data.onboarding_clients?.filter((c: any) => c.kyc_status === "PENDING").length || 0} Pending
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Total client profiles: {data.onboarding_clients?.length || 0}</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Unsettled Trades</div>
          <div className="text-2xl font-bold mt-2 text-amber-400">
            {data.trade_settlements?.filter((t: any) => t.status !== "SETTLED").length || 0} Pending
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Total transactions indexed: {data.trade_settlements?.length || 0}</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Workflow Exceptions</div>
          <div className="text-2xl font-bold mt-2 text-rose-400">
            {data.workflow_exceptions?.length || 0} Blocks
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Operational constraints pending</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Documents Ingested</div>
          <div className="text-2xl font-bold mt-2 text-emerald-400">
            {data.document_processing?.length || 0} Total
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Contracts, notes, and records processed</div>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setActiveTab("onboarding")}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all ${
            activeTab === "onboarding" 
              ? "border-blue-500 text-blue-400 bg-blue-500/5" 
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          KYC & Onboarding Pipeline
        </button>
        <button
          onClick={() => setActiveTab("settlement")}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all ${
            activeTab === "settlement" 
              ? "border-blue-500 text-blue-400 bg-blue-500/5" 
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Trade Settlements Board
        </button>
        <button
          onClick={() => setActiveTab("exceptions")}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all ${
            activeTab === "exceptions" 
              ? "border-blue-500 text-blue-400 bg-blue-500/5" 
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Workflow Exceptions
        </button>
        <button
          onClick={() => setActiveTab("documents")}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all ${
            activeTab === "documents" 
              ? "border-blue-500 text-blue-400 bg-blue-500/5" 
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Document Repository
        </button>
      </div>

      {/* Tab Panels */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl">

        {/* TAB 1: KYC Onboarding */}
        {activeTab === "onboarding" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-blue-400" /> New Client KYC Verification
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-bold">
                    <th className="py-3 px-4">Client Detail</th>
                    <th className="py-3 px-4">Segment / Risk</th>
                    <th className="py-3 px-4">Advisor Assigned</th>
                    <th className="py-3 px-4">Ingestion Date</th>
                    <th className="py-3 px-4">KYC Clearance</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(!data.onboarding_clients || data.onboarding_clients.length === 0) ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500 italic">No client profiles currently tracked in operations.</td>
                    </tr>
                  ) : (
                    data.onboarding_clients.map((c: any) => (
                      <tr key={c.client_id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-3 px-4">
                          <div>
                            <div className="font-semibold text-slate-200">{c.name}</div>
                            <div className="text-[10px] text-slate-500">{c.email || "No email"}</div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-300">{c.segment.replace(/_/g, " ")}</div>
                          <div className="text-[10px] text-slate-500">{c.risk_profile} Risk</div>
                        </td>
                        <td className="py-3 px-4 text-slate-300 font-medium">{c.advisor_name}</td>
                        <td className="py-3 px-4 text-slate-400">{new Date(c.created_at).toLocaleDateString()}</td>
                        <td className="py-3 px-4">
                          <span className={getKycBadge(c.kyc_status)}>
                            {c.kyc_status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {c.kyc_status === "PENDING" && (
                            <button
                              disabled={actionLoading === `kyc-${c.client_id}`}
                              onClick={() => handleApproveKyc(c.client_id)}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold hover:shadow-lg hover:shadow-blue-500/10 transition-all disabled:opacity-50"
                            >
                              {actionLoading === `kyc-${c.client_id}` ? "Processing..." : "Approve KYC"}
                            </button>
                          )}
                          {c.kyc_status === "APPROVED" && (
                            <span className="text-emerald-400 font-semibold flex items-center justify-end gap-1">
                              <ShieldCheck className="w-4 h-4" /> Ready to Trade
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: Trade Settlements */}
        {activeTab === "settlement" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-4">
              <CreditCard className="w-5 h-5 text-amber-400" /> Transaction Settlement Ledger
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-bold">
                    <th className="py-3 px-4">Client Profile</th>
                    <th className="py-3 px-4">Account Type</th>
                    <th className="py-3 px-4">Trade Action</th>
                    <th className="py-3 px-4">Asset Value</th>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Settlement Status</th>
                    <th className="py-3 px-4 text-right">Settlement Clearing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(!data.trade_settlements || data.trade_settlements.length === 0) ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-500 italic">No trading settlements logged in the firm.</td>
                    </tr>
                  ) : (
                    data.trade_settlements.map((t: any) => (
                      <tr key={t.txn_id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-3 px-4 text-slate-200 font-semibold">{t.client_name}</td>
                        <td className="py-3 px-4 text-slate-400 font-semibold">{t.account_type}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.type === "BUY" ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border border-rose-500/20 text-rose-400"
                          }`}>
                            {t.type} {t.ticker}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-200">{t.quantity.toLocaleString()} Shares</div>
                          <div className="text-[10px] text-slate-500">at ${t.price.toFixed(2)}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-400">{new Date(t.executed_at).toLocaleString()}</td>
                        <td className="py-3 px-4">
                          <span className={getSettleBadge(t.status)}>
                            {t.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {t.status !== "SETTLED" ? (
                            <button
                              disabled={actionLoading === `settle-${t.txn_id}`}
                              onClick={() => handleSettleTrade(t.txn_id)}
                              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold transition-all disabled:opacity-50"
                            >
                              {actionLoading === `settle-${t.txn_id}` ? "Clearing..." : "Match & Settle"}
                            </button>
                          ) : (
                            <span className="text-emerald-400 font-semibold flex items-center justify-end gap-1">
                              <CheckCircle2 className="w-4 h-4" /> Settled
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: Workflow Exceptions */}
        {activeTab === "exceptions" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-rose-400" /> Operational Action Blocks
            </h2>

            <div className="space-y-3">
              {(!data.workflow_exceptions || data.workflow_exceptions.length === 0) ? (
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" /> No blocked workflow exceptions! All back-office operations cleared.
                </div>
              ) : (
                data.workflow_exceptions.map((ex: any) => (
                  <div key={ex.alert_id} className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex items-start gap-4 hover:border-slate-700 transition-colors">
                    <div className="p-2 bg-rose-500/10 rounded-lg shrink-0 text-rose-400 border border-rose-500/20">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start flex-wrap gap-2">
                        <span className="font-bold text-sm text-slate-200">{ex.client_name}</span>
                        <span className="text-slate-500 text-[10px] font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {new Date(ex.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono mt-1 uppercase text-slate-500">{ex.alert_type}</p>
                      <p className="text-sm mt-1.5 text-slate-300 font-semibold">{ex.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 4: Documents Repository */}
        {activeTab === "documents" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-emerald-400" /> Client Document & Agreements Index
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(!data.document_processing || data.document_processing.length === 0) ? (
                <p className="text-slate-500 text-sm italic py-4 col-span-2">No documents currently processed.</p>
              ) : (
                data.document_processing.map((d: any) => (
                  <div key={d.doc_id} className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center gap-4 hover:border-slate-700 transition-colors">
                    <div className="p-2 bg-slate-800 rounded-lg text-slate-400 border border-slate-700">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm text-slate-200 truncate">{d.title}</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Client: <strong className="text-slate-300">{d.client_name}</strong> &bull; Type: <strong className="text-slate-300">{d.doc_type}</strong>
                      </p>
                      <p className="text-[9px] text-slate-500 mt-1">Processed: {new Date(d.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <span className="px-2 py-0.5 text-[9px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full uppercase">
                        Processed
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import { 
  ShieldAlert, AlertTriangle, CheckCircle, FileText, 
  Info, Loader2, Plus, User, Clock, Eye, Send, 
  Shield, Check, Search, Calendar, Brain, ShieldCheck
} from "lucide-react";
import { apiClient } from "@/lib/api";

export default function CompliancePortal() {
  const [activeTab, setActiveTab] = useState<"violations" | "audit" | "recommendations" | "advisors" | "policies">("violations");
  const [data, setData] = useState<any>({
    audit_logs: [],
    ai_recommendations: [],
    advisor_activities: [],
    compliance_violations: [],
    policy_documents: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Policy framing form states
  const [policyTitle, setPolicyTitle] = useState("");
  const [policyContent, setPolicyContent] = useState("");
  const [framingLoading, setFramingLoading] = useState(false);
  const [policySuccess, setPolicySuccess] = useState("");
  const [policyModalOpen, setPolicyModalOpen] = useState(false);

  // Search filter state
  const [searchTerm, setSearchTerm] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await apiClient.get<any>("/compliance/portal");
      setData(response);
    } catch (err: any) {
      console.error("Failed to fetch compliance portal data:", err);
      setError(err.message || "Unable to retrieve compliance information.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFramePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policyTitle || !policyContent) return;

    try {
      setFramingLoading(true);
      setPolicySuccess("");
      await apiClient.post("/compliance/policy", {
        title: policyTitle,
        content: policyContent
      });
      setPolicySuccess("Policy framed successfully!");
      setPolicyTitle("");
      setPolicyContent("");
      // Refresh portal data to show new policy
      await fetchData();
      setTimeout(() => {
        setPolicySuccess("");
        setPolicyModalOpen(false);
      }, 2000);
    } catch (err: any) {
      console.error("Failed to create policy:", err);
    } finally {
      setFramingLoading(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity.toUpperCase()) {
      case "BLOCK":
        return "px-2 py-1 text-xs font-semibold rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400";
      case "WARN":
        return "px-2 py-1 text-xs font-semibold rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400";
      default:
        return "px-2 py-1 text-xs font-semibold rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400";
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
        <p className="mt-4 text-sm text-slate-400 font-medium">Loading Governance and Compliance Portal...</p>
      </div>
    );
  }

  // Filters search terms
  const filteredAudits = data.audit_logs?.filter((log: any) => 
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.actor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.entity_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-auto bg-slate-950 p-8 space-y-8 text-slate-100 min-h-screen">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Regulatory Oversight Center
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            Continuous compliance supervision, system-wide audit logging, and dynamic AI explainability validation.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setPolicyModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-lg shadow-blue-500/10 border border-blue-500/30"
          >
            <Plus className="w-4 h-4" /> Frame Policy Document
          </button>
          <button
            onClick={fetchData}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
          >
            Refresh Logs
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-900/30 border border-rose-800 text-rose-300 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Ratios Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Violations Checked</div>
          <div className="text-2xl font-bold mt-2 text-rose-400">
            {data.compliance_violations?.length || 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Real-time alerts requiring review</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">System Audits Logged</div>
          <div className="text-2xl font-bold mt-2 text-blue-400">
            {data.audit_logs?.length || 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Immutable ledger transactions</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">AI Recommendations</div>
          <div className="text-2xl font-bold mt-2 text-purple-400">
            {data.ai_recommendations?.length || 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">RAG models verified for compliance</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Framed Policies</div>
          <div className="text-2xl font-bold mt-2 text-emerald-400">
            {data.policy_documents?.length || 0} Active
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Incedo Advisor AI guardrails</div>
        </div>
      </div>

      {/* Tabs Layout Navigation */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => { setActiveTab("violations"); setSearchTerm(""); }}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all ${
            activeTab === "violations" 
              ? "border-blue-500 text-blue-400 bg-blue-500/5" 
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Violations & Alerts
        </button>
        <button
          onClick={() => { setActiveTab("audit"); setSearchTerm(""); }}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all ${
            activeTab === "audit" 
              ? "border-blue-500 text-blue-400 bg-blue-500/5" 
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Audit Trails (Append-Only)
        </button>
        <button
          onClick={() => { setActiveTab("recommendations"); setSearchTerm(""); }}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all ${
            activeTab === "recommendations" 
              ? "border-blue-500 text-blue-400 bg-blue-500/5" 
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          AI Explainability Audit
        </button>
        <button
          onClick={() => { setActiveTab("advisors"); setSearchTerm(""); }}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all ${
            activeTab === "advisors" 
              ? "border-blue-500 text-blue-400 bg-blue-500/5" 
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Advisor Activities
        </button>
        <button
          onClick={() => { setActiveTab("policies"); setSearchTerm(""); }}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all ${
            activeTab === "policies" 
              ? "border-blue-500 text-blue-400 bg-blue-500/5" 
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Framed Policies
        </button>
      </div>

      {/* Tab Panels */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl">
        
        {/* TAB 1: Violations & Alerts */}
        {activeTab === "violations" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500" /> Active System Violations
            </h2>
            <div className="space-y-3">
              {(!data.compliance_violations || data.compliance_violations.length === 0) ? (
                <p className="text-slate-500 text-sm italic py-4">No active compliance violations logged in this firm.</p>
              ) : (
                data.compliance_violations.map((v: any) => (
                  <div key={v.alert_id} className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl flex items-start gap-4 hover:border-slate-700 transition-colors">
                    <div className="p-2 bg-rose-500/10 rounded-lg shrink-0 border border-rose-500/20 text-rose-400">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-sm text-slate-200">{v.client_name}</span>
                        <div className="flex gap-2">
                          <span className={getSeverityBadge(v.severity)}>{v.severity}</span>
                          <span className="text-slate-500 font-mono text-[10px] flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {new Date(v.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm mt-1 text-slate-300 font-semibold">{v.alert_type.replace(/_/g, " ")}</p>
                      <p className="text-xs mt-1 text-slate-400">{v.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Audit Trails */}
        {activeTab === "audit" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" /> System Audit Ledger
              </h2>
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter audits..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-slate-900 border border-slate-800 focus:outline-none text-xs text-slate-100 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-bold">
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Entity Type</th>
                    <th className="py-3 px-4">Entity ID</th>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Audit Validation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(!filteredAudits || filteredAudits.length === 0) ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500 italic">No matching audit logs found.</td>
                    </tr>
                  ) : (
                    filteredAudits.map((log: any) => (
                      <tr key={log.log_id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-3 px-4">
                          <div>
                            <div className="font-semibold text-slate-200">{log.actor_name}</div>
                            <div className="text-[10px] text-slate-500">{log.actor_email}</div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 font-semibold font-mono text-[10px]">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-300 font-medium font-mono">{log.entity_type}</td>
                        <td className="py-3 px-4 text-slate-400 font-mono text-[10px]">{log.entity_id.slice(0, 8)}...</td>
                        <td className="py-3 px-4 text-slate-400">{new Date(log.ts).toLocaleString()}</td>
                        <td className="py-3 px-4">
                          <span className="flex items-center gap-1 text-emerald-400 font-semibold text-[10px]">
                            <Check className="w-3.5 h-3.5" /> Immutable
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: AI Explainability Audit */}
        {activeTab === "recommendations" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-400" /> LLM Next Best Action & SHAP Audits
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Below are RAG recommendations and their SHAP values. SHAP maps feature-importance values generated on client behavioral vectors.
            </p>

            <div className="space-y-6">
              {(!data.ai_recommendations || data.ai_recommendations.length === 0) ? (
                <p className="text-slate-500 text-sm italic py-4">No AI recommendation audits registered for this firm.</p>
              ) : (
                data.ai_recommendations.map((rec: any) => {
                  const shap = rec.shap_explanation || {};
                  return (
                    <div key={rec.rec_id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                        <div>
                          <span className="font-bold text-sm text-slate-200">{rec.payload?.title || rec.type}</span>
                          <span className="block text-[10px] text-slate-400 mt-1">
                            Client: <strong className="text-slate-300">{rec.client_name}</strong> &bull; Advisor: <strong className="text-slate-300">{rec.advisor_name}</strong>
                          </span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-[10px] font-semibold">
                          SHAP Logged
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-xs font-semibold text-slate-300">Generated Rationale</h4>
                          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                            {rec.payload?.description || "No description provided."}
                          </p>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-slate-300">Feature Importance Log (SHAP Analysis)</h4>
                          <div className="space-y-2 mt-2">
                            {Object.entries(shap).map(([key, val]: any) => (
                              <div key={key} className="space-y-1">
                                <div className="flex justify-between text-[10px]">
                                  <span className="text-slate-400 capitalize">{key.replace(/_/g, " ")}</span>
                                  <span className="text-purple-400 font-semibold">{Math.round(val * 100)}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
                                    style={{ width: `${val * 100}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 4: Advisor Activities */}
        {activeTab === "advisors" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <User className="w-5 h-5 text-emerald-400" /> Active Advisory Roster
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(!data.advisor_activities || data.advisor_activities.length === 0) ? (
                <p className="text-slate-500 text-sm italic py-4 col-span-2">No active advisors in this firm.</p>
              ) : (
                data.advisor_activities.map((adv: any) => (
                  <div key={adv.advisor_id} className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                      <User className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-sm text-slate-200">{adv.name}</div>
                      <div className="text-xs text-slate-400">{adv.email}</div>
                      <div className="flex gap-4 mt-2">
                        <span className="text-[10px] text-slate-500">
                          Clients: <strong className="text-slate-300">{adv.client_count}</strong>
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Recommendations: <strong className="text-slate-300">{adv.rec_count}</strong>
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 uppercase">
                        {adv.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 5: Policies */}
        {activeTab === "policies" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-400" /> Active Compliance Guidelines
            </h2>
            <div className="space-y-4">
              {(!data.policy_documents || data.policy_documents.length === 0) ? (
                <p className="text-slate-500 text-sm italic py-4">No active regulatory policies drafted. Click "Frame Policy" above to draft guidelines.</p>
              ) : (
                data.policy_documents.map((p: any) => (
                  <div key={p.doc_id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
                    <div className="flex justify-between items-start gap-4">
                      <h3 className="font-bold text-sm text-slate-200">{p.title}</h3>
                      <span className="text-[10px] font-mono text-slate-500">
                        {new Date(p.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <pre className="mt-3 text-xs text-slate-400 font-sans whitespace-pre-wrap leading-relaxed">
                      {p.content}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>

      {/* Frame Policy Modal */}
      {policyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col text-slate-100">
            <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/60">
              <h2 className="text-lg font-bold flex items-center gap-2 text-blue-400">
                <Shield className="h-5 w-5" />
                Frame Compliance Policy
              </h2>
              <button 
                onClick={() => setPolicyModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-semibold"
              >
                Close
              </button>
            </div>
            
            <form onSubmit={handleFramePolicy} className="p-6 space-y-4">
              {policySuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-semibold">
                  {policySuccess}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Policy Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SEC Rule 204-2 Books and Records Policy"
                  value={policyTitle}
                  onChange={(e) => setPolicyTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Policy Guidelines & Regulatory Frames
                </label>
                <textarea
                  required
                  rows={6}
                  placeholder="Write dynamic compliance guidelines to instruct AI models and advisors on client portfolio constraints..."
                  value={policyContent}
                  onChange={(e) => setPolicyContent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPolicyModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-transparent hover:bg-slate-800 border border-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={framingLoading}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                >
                  {framingLoading ? "Saving Guidelines..." : "Commit Guidelines"} <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import { 
  Lock, Loader2, Building, Users, Shield, 
  UserCheck, Plus, RefreshCw, Send, ShieldAlert,
  Search, Eye, ShieldCheck, HardHat, UserMinus
} from "lucide-react";
import { apiClient } from "@/lib/api";

export default function AdminPortal() {
  const [data, setData] = useState<any>({
    firms: [],
    users: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Register firm form state
  const [firmName, setFirmName] = useState("");
  const [regulatoryId, setRegulatoryId] = useState("");
  const [registering, setRegistering] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  // Search filter states
  const [firmSearch, setFirmSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await apiClient.get<any>("/admin/dashboard");
      setData(response);
    } catch (err: any) {
      console.error("Failed to load admin dashboard:", err);
      setError(err.message || "Failed to load admin systems.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleRegisterFirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firmName || !regulatoryId) return;

    try {
      setRegistering(true);
      setError("");
      setSuccessMsg("");
      await apiClient.post("/admin/firms", {
        name: firmName,
        regulatory_id: regulatoryId
      });
      setSuccessMsg("Firm registered successfully!");
      setFirmName("");
      setRegulatoryId("");
      // Refresh admin data
      await fetchAdminData();
      setTimeout(() => {
        setSuccessMsg("");
        setModalOpen(false);
      }, 2000);
    } catch (err: any) {
      console.error("Failed to register firm:", err);
      setError(err.message || "Unable to register firm.");
    } finally {
      setRegistering(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role.toUpperCase()) {
      case "ADMIN":
        return "px-2 py-0.5 text-[10px] font-bold rounded bg-rose-500/10 border border-rose-500/30 text-rose-400";
      case "COMPLIANCE":
        return "px-2 py-0.5 text-[10px] font-bold rounded bg-purple-500/10 border border-purple-500/30 text-purple-400";
      case "OPERATIONS":
        return "px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500/10 border border-amber-500/30 text-amber-400";
      default:
        return "px-2 py-0.5 text-[10px] font-bold rounded bg-blue-500/10 border border-blue-500/30 text-blue-400";
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
        <p className="mt-4 text-sm text-slate-400 font-medium">Loading Global Admin Console...</p>
      </div>
    );
  }

  // Filter lists
  const filteredFirms = data.firms?.filter((f: any) => 
    f.name.toLowerCase().includes(firmSearch.toLowerCase()) ||
    f.regulatory_id.toLowerCase().includes(firmSearch.toLowerCase())
  );

  const filteredUsers = data.users?.filter((u: any) => 
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.role.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.firm.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-auto bg-slate-950 p-8 space-y-8 text-slate-100 min-h-screen">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            System Administration Console
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            Enroll financial firms, inspect user rosters, review service tenants, and coordinate cross-organization configurations.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-all border border-blue-500/25 shadow-lg shadow-blue-500/10"
          >
            <Plus className="w-4 h-4" /> Enroll New Firm
          </button>
          <button
            onClick={fetchAdminData}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-all"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-900/30 border border-rose-800 text-rose-300 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Global Admin KPI Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Enrolled Tenant Firms</div>
          <div className="text-2xl font-bold mt-2 text-blue-400">
            {data.firms?.length || 0} Registered
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Multi-tenant isolated organizations</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Users Registered</div>
          <div className="text-2xl font-bold mt-2 text-purple-400">
            {data.users?.length || 0} Accounts
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Active platform profiles across all firms</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Access Controls Enforced</div>
          <div className="text-2xl font-bold mt-2 text-emerald-400">
            Role-Based (RBAC)
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Data isolation and tenant security verified</div>
        </div>
      </div>

      {/* Roster Layout sections */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Left 1/3: Firms roster */}
        <div className="xl:col-span-1 space-y-6">
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Building className="w-5 h-5 text-blue-400" /> Enrolled Firms
              </h2>
              <span className="text-xs text-slate-500">{filteredFirms?.length || 0} total</span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Filter firms..."
                value={firmSearch}
                onChange={(e) => setFirmSearch(e.target.value)}
                className="w-full pl-8 pr-4 py-1.5 rounded-lg bg-slate-950 border border-slate-850 focus:outline-none text-xs text-slate-100"
              />
            </div>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {(!filteredFirms || filteredFirms.length === 0) ? (
                <p className="text-slate-500 text-xs italic">No enrolled firms match filters.</p>
              ) : (
                filteredFirms.map((firm: any) => (
                  <div key={firm.firm_id} className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-slate-200">{firm.name}</h4>
                        <span className="text-[10px] text-slate-400 font-mono">Reg ID: {firm.regulatory_id}</span>
                      </div>
                      <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-blue-500/10 border border-blue-500/20 text-blue-400">
                        {firm.tier}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/60 text-center text-[10px] text-slate-400">
                      <div>
                        <div className="font-bold text-slate-200">{firm.advisors_count}</div>
                        <div>Advisors</div>
                      </div>
                      <div>
                        <div className="font-bold text-slate-200">{firm.compliance_count}</div>
                        <div>Compliance</div>
                      </div>
                      <div>
                        <div className="font-bold text-slate-200">{firm.ops_count}</div>
                        <div>Ops</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right 2/3: Global users roster */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" /> Global User Directory
              </h2>
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search user, email, role, or firm..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-8 pr-4 py-1.5 rounded-lg bg-slate-950 border border-slate-850 focus:outline-none text-xs text-slate-100"
                />
              </div>
            </div>

            <div className="overflow-x-auto max-h-[57vh] overflow-y-auto pr-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-bold">
                    <th className="py-3 px-4">User Details</th>
                    <th className="py-3 px-4">Enrolled Firm</th>
                    <th className="py-3 px-4">Workspace Role</th>
                    <th className="py-3 px-4">Enrollment Date</th>
                    <th className="py-3 px-4 text-right">System Access</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(!filteredUsers || filteredUsers.length === 0) ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500 italic">No users found in global directory.</td>
                    </tr>
                  ) : (
                    filteredUsers.map((u: any) => (
                      <tr key={u.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-3 px-4">
                          <div>
                            <div className="font-semibold text-slate-200">{u.name}</div>
                            <div className="text-[10px] text-slate-500">{u.email}</div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-300">{u.firm}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={getRoleColor(u.role)}>{u.role}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">{new Date(u.created_at).toLocaleDateString()}</td>
                        <td className="py-3 px-4 text-right">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-[9px]">
                            ACTIVE
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      {/* Enroll Firm Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col text-slate-100">
            <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/60">
              <h2 className="text-lg font-bold flex items-center gap-2 text-blue-400">
                <Building className="h-5 w-5" />
                Enroll New Financial Firm
              </h2>
              <button 
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-semibold"
              >
                Close
              </button>
            </div>
            
            <form onSubmit={handleRegisterFirm} className="p-6 space-y-4">
              {successMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-semibold">
                  {successMsg}
                </div>
              )}
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Firm Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Incedo Private Wealth"
                  value={firmName}
                  onChange={(e) => setFirmName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Firm Regulatory ID (FINRA/SEC)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SEC-CRD-12345"
                  value={regulatoryId}
                  onChange={(e) => setRegulatoryId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-transparent hover:bg-slate-800 border border-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registering}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                >
                  {registering ? "Enrolling Firm..." : "Enroll Firm"} <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

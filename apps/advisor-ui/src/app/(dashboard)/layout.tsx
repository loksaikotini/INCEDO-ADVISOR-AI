'use client';
// FILE: apps/advisor-ui/src/app/(dashboard)/layout.tsx
// Ref: Blueprint §3.1 — Web/Mobile Advisor Interface; Conversational UI

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import {
  MessageSquare, BarChart3, Shield, Lightbulb,
  LogOut, Bell, Settings, Brain, ChevronRight,
  User, Building2, LayoutDashboard, Users,
  TrendingUp, FileText, AlertTriangle, ShieldCheck,
  FileSpreadsheet, Lock
} from 'lucide-react';

const ROLE_NAV_ITEMS: Record<string, Array<{ href: string, icon: any, label: string, description: string }>> = {
  ADVISOR: [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', description: 'Overview' },
    { href: '/chat', icon: MessageSquare, label: 'AI Assistant', description: 'Copilot' },
    { href: '/clients', icon: Users, label: 'Clients', description: 'Client roster' },
    { href: '/portfolio', icon: BarChart3, label: 'Portfolio', description: 'Analytics' },
    { href: '/markets', icon: TrendingUp, label: 'Markets', description: 'Market data' },
    { href: '/recommendations', icon: Lightbulb, label: 'Recommendations', description: 'Next Best Actions' },
    { href: '/alerts', icon: AlertTriangle, label: 'Alerts', description: 'Risk & compliance' },
    { href: '/reports', icon: FileText, label: 'Reports', description: 'Generated documents' },
    { href: '/settings', icon: Settings, label: 'Settings', description: 'Preferences' }
  ],
  COMPLIANCE: [
    { href: '/compliance', icon: ShieldCheck, label: 'Compliance Portal', description: 'Regulatory oversight' },
    { href: '/recommendations', icon: Lightbulb, label: 'AI Recommendations', description: 'Explainability & SHAP' },
    { href: '/alerts', icon: AlertTriangle, label: 'Violations & Alerts', description: 'Risk surveillance' },
    { href: '/settings', icon: Settings, label: 'Settings', description: 'Preferences' }
  ],
  OPERATIONS: [
    { href: '/operations', icon: FileSpreadsheet, label: 'Operations Center', description: 'Business processes' },
    { href: '/clients', icon: Users, label: 'KYC & Accounts', description: 'Client profiles' },
    { href: '/portfolio', icon: BarChart3, label: 'Portfolio Analytics', description: 'AUM & Holdings' },
    { href: '/settings', icon: Settings, label: 'Settings', description: 'Preferences' }
  ],
  ADMIN: [
    { href: '/admin', icon: Lock, label: 'Admin Panel', description: 'System control center' },
    { href: '/settings', icon: Settings, label: 'Settings', description: 'Preferences' }
  ]
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, token, clearAuth } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function loadAlerts() {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3001'}/api/v1/advisor/alerts`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        setActiveAlerts(data.alerts?.filter((a: any) => !a.is_read).slice(0, 3) || []);
      } catch (err) {
        console.error("Failed to load header notifications:", err);
      }
    }
    if (mounted && token) loadAlerts();
  }, [mounted, token]);

  // Auth guard
  useEffect(() => {
    if (mounted && !token) router.push('/');
  }, [token, mounted, router]);

  if (!mounted || !token || !user) return null;

  const handleLogout = async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
    } finally {
      clearAuth();
      router.push('/');
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="w-64 flex-shrink-0 flex flex-col glass-strong border-r border-border">
        {/* Brand */}
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 dark:border-slate-800 flex items-center justify-center overflow-hidden p-1 shadow-sm shrink-0">
              <img src="/incedo_logo.jpg" alt="Incedo Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="text-sm font-bold text-foreground">Incedo Advisor AI</span>
              <span className="block text-[10px] text-blue-400 font-semibold tracking-wider uppercase">
                {user.role}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 py-2">
            Workspace
          </p>
          {(ROLE_NAV_ITEMS[user.role] || ROLE_NAV_ITEMS.ADVISOR).map(({ href, icon: Icon, label, description }) => {
            const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group ${
                  isActive
                    ? 'bg-blue-500/15 border border-blue-500/25 text-blue-300 glow-blue'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-400' : 'group-hover:text-foreground'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{label}</div>
                  <div className="text-[10px] text-muted-foreground/70 truncate">{description}</div>
                </div>
                {isActive && <ChevronRight className="w-3 h-3 text-blue-400 shrink-0" />}
              </Link>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="p-3 border-t border-border space-y-1">
          {/* Firm badge */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/40">
            <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground truncate">{user.firm_id ? user.firm_id.slice(0, 8) : 'Unknown'}…</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-lg">
            <div className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
              <User className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-foreground truncate">{user.name ?? user.id.slice(0, 12)}</div>
              <div className="text-[10px] text-muted-foreground truncate">{user.email ?? 'advisor'}</div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all text-xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>

      </aside>

      {/* ── Main Content ─────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Top bar */}
        <header className="h-14 flex items-center justify-between px-6 border-b border-border glass shrink-0">
          <div>
            <h1 className="text-sm font-semibold text-foreground">
              {(ROLE_NAV_ITEMS[user.role] || ROLE_NAV_ITEMS.ADVISOR).find((n) => pathname === n.href || (n.href !== '/dashboard' && pathname.startsWith(n.href)))?.label ?? 'Dashboard'}
            </h1>
            <p className="text-xs text-muted-foreground">
              {(ROLE_NAV_ITEMS[user.role] || ROLE_NAV_ITEMS.ADVISOR).find((n) => pathname === n.href || (n.href !== '/dashboard' && pathname.startsWith(n.href)))?.description ?? 'Overview'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Live indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-green-400 font-medium">Live</span>
            </div>
            <div className="relative">
              <button 
                onClick={() => setBellOpen(!bellOpen)} 
                className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all relative"
              >
                <Bell className="w-4 h-4" />
                {activeAlerts.length > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500 border border-slate-900 animate-pulse" />
                )}
              </button>
              
              {bellOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setBellOpen(false)} />
                  <div className="absolute right-0 mt-2 w-80 bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-4 z-50 text-slate-100 animate-fade-in-up">
                    <div className="flex justify-between items-center mb-3 border-b border-slate-800 pb-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Risk Alerts</span>
                      <Link href="/alerts" onClick={() => setBellOpen(false)} className="text-[10px] text-blue-400 hover:underline font-bold">
                        View All
                      </Link>
                    </div>
                    
                    {activeAlerts.length === 0 ? (
                      <div className="text-center py-6 text-slate-500 text-xs italic">
                        No pending risk alerts.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {activeAlerts.map((alert: any) => (
                          <div key={alert.alert_id} className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800/60 flex gap-2.5 items-start hover:bg-slate-800/80 transition-all text-left">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${
                              alert.severity === 'BLOCK' ? 'bg-red-400' : 'bg-amber-400'
                            }`} />
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-semibold text-slate-300 leading-normal line-clamp-2">
                                {alert.message}
                              </p>
                              <span className="text-[8px] text-slate-500 font-mono mt-1 block">
                                {alert.alert_type}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <Link href="/settings" className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all">
              <Settings className="w-4 h-4" />
            </Link>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

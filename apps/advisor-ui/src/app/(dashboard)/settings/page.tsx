import { Settings, Save, Shield, Bell, User } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="w-6 h-6 text-slate-500" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">Manage your account preferences and system configurations.</p>
      </div>

      <div className="space-y-6">
        {/* Profile Section */}
        <section className="glass rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-secondary/30 flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Profile</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Full Name</label>
                <input type="text" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" defaultValue="John Advisor" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Email Address</label>
                <input type="email" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" defaultValue="john@incedo-advisor.ai" />
              </div>
            </div>
          </div>
        </section>

        {/* Security Section */}
        <section className="glass rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-secondary/30 flex items-center gap-2">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Security</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-foreground">Two-Factor Authentication</h3>
                <p className="text-sm text-muted-foreground">Add an extra layer of security to your account.</p>
              </div>
              <button className="px-4 py-2 bg-secondary text-foreground rounded-lg text-sm font-medium border border-border">
                Enable 2FA
              </button>
            </div>
          </div>
        </section>

        {/* Notifications Section */}
        <section className="glass rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-secondary/30 flex items-center gap-2">
            <Bell className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Notifications</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <input type="checkbox" id="email-notif" className="w-4 h-4 rounded border-border" defaultChecked />
              <label htmlFor="email-notif" className="text-sm text-foreground">Email Notifications for Compliance Alerts</label>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="sms-notif" className="w-4 h-4 rounded border-border" />
              <label htmlFor="sms-notif" className="text-sm text-foreground">SMS Notifications for Urgent Messages</label>
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm">
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}


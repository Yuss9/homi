"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Download, Save, ShieldCheck } from "lucide-react";

export function PreferenceWorkspace() {
  const [preferences, setPreferences] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    void fetch("/api/preferences").then((response) => response.json()).then((payload) => setPreferences(payload.preferences ?? {}));
  }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/preferences", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        emailEnabled: form.get("emailEnabled") === "on",
        inAppEnabled: form.get("inAppEnabled") === "on",
        weeklySummaryEnabled: form.get("weeklySummaryEnabled") === "on",
        maintenanceReminderDays: Number(form.get("maintenanceReminderDays")),
        warrantyReminderDays: Number(form.get("warrantyReminderDays")),
        documentExpiryReminderDays: Number(form.get("documentExpiryReminderDays")),
        timezone: form.get("timezone"),
      }),
    });
    setMessage(response.ok ? "Preferences saved." : "Could not save preferences.");
  }
  if (!preferences) return <main id="main" className="app-main"><p>Loading preferences…</p></main>;
  return (
    <main id="main" className="app-main">
      <div className="dashboard-head"><div><small>Personal controls</small><h1>Settings</h1><p>Notifications, privacy, exports, timezone, and account security.</p></div></div>
      {message && <p className="form-success" role="status">{message}</p>}
      <div className="dash-grid" style={{ marginTop: 32 }}>
        <form className="dash-card auth-form" onSubmit={save}>
          <div className="dash-card-head"><h2>Reminder preferences</h2><Save size={17} /></div>
          <label className="check-row"><input name="emailEnabled" type="checkbox" defaultChecked={preferences.emailEnabled !== false} /> Email reminders</label>
          <label className="check-row"><input name="inAppEnabled" type="checkbox" defaultChecked={preferences.inAppEnabled !== false} /> In-app reminders</label>
          <label className="check-row"><input name="weeklySummaryEnabled" type="checkbox" defaultChecked={preferences.weeklySummaryEnabled !== false} /> Weekly summary</label>
          <div className="field"><label htmlFor="maintenance-days">Maintenance notice (days)</label><input id="maintenance-days" name="maintenanceReminderDays" type="number" min="0" max="90" defaultValue={String(preferences.maintenanceReminderDays ?? 7)} /></div>
          <div className="field"><label htmlFor="warranty-days">Warranty notice (days)</label><input id="warranty-days" name="warrantyReminderDays" type="number" min="0" max="365" defaultValue={String(preferences.warrantyReminderDays ?? 30)} /></div>
          <div className="field"><label htmlFor="document-days">Document notice (days)</label><input id="document-days" name="documentExpiryReminderDays" type="number" min="0" max="365" defaultValue={String(preferences.documentExpiryReminderDays ?? 30)} /></div>
          <div className="field"><label htmlFor="preference-timezone">Timezone</label><input id="preference-timezone" name="timezone" defaultValue={String(preferences.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone)} required /></div>
          <button className="button" type="submit"><Save size={16} />Save preferences</button>
        </form>
        <section className="dash-card"><div className="dash-card-head"><h2>Privacy & account</h2><ShieldCheck size={17} /></div><p className="muted-copy">Homi ships without advertising trackers or third-party analytics. Export your account data at any time.</p><a className="button button-secondary" href="/api/export/account"><Download size={16} />Export JSON</a><Link className="button button-secondary" href="/settings/security"><ShieldCheck size={16} />Security & sessions</Link></section>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState, type FormEvent } from "react";
import { KeyRound, LogOut, Monitor, RefreshCcw, ShieldCheck } from "lucide-react";
import { authClient } from "@/src/lib/auth-client";

type ActiveSession = {
  id: string;
  token: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt: Date | string;
  expiresAt: Date | string;
};

export function SecurityWorkspace() {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadSessions() {
    const result = await authClient.listSessions();
    setSessions((result.data ?? []) as ActiveSession[]);
  }
  useEffect(() => {
    void authClient.listSessions().then((result) => {
      setSessions((result.data ?? []) as ActiveSession[]);
    });
  }, []);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const result = await authClient.changePassword({
      currentPassword: String(form.get("currentPassword") ?? ""),
      newPassword: String(form.get("newPassword") ?? ""),
      revokeOtherSessions: true,
    });
    if (result.error) return setError("Could not change the password. Check the current password.");
    event.currentTarget.reset();
    setMessage("Password changed. Other sessions were revoked.");
    await loadSessions();
  }

  async function updateName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") ?? "").trim();
    const result = await authClient.updateUser({ name });
    setMessage(result.error ? "Could not update your name." : "Profile updated.");
  }

  async function revoke(token: string) {
    await authClient.revokeSession({ token });
    await loadSessions();
  }

  return (
    <main id="main" className="app-main">
      <div className="dashboard-head"><div><small>Account controls</small><h1>Security & sessions</h1><p>Keep your profile, password, and signed-in devices under your control.</p></div><button className="button button-secondary" onClick={() => void authClient.signOut({ fetchOptions: { onSuccess: () => window.location.assign("/") } })}><LogOut size={16} />Sign out</button></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      <div className="dash-grid" style={{ marginTop: 32 }}>
        <section className="dash-card">
          <div className="dash-card-head"><h2>Active sessions</h2><Monitor size={17} /></div>
          {sessions.map((session) => (
            <div className="dash-task" key={session.id}><span><Monitor size={16} /></span><div><strong>{session.userAgent?.slice(0, 70) || "Unknown device"}</strong><small>{session.ipAddress || "IP unavailable"} · expires {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(session.expiresAt))}</small></div><button className="icon-action" aria-label="Revoke session" onClick={() => void revoke(session.token)}><LogOut size={16} /></button></div>
          ))}
          <button className="button button-secondary" onClick={async () => { await authClient.revokeOtherSessions(); await loadSessions(); setMessage("Other sessions revoked."); }}><RefreshCcw size={16} />Revoke all other sessions</button>
        </section>
        <div>
          <form className="dash-card auth-form" onSubmit={updateName}>
            <div className="dash-card-head"><h2>Profile</h2><ShieldCheck size={17} /></div>
            <div className="field"><label htmlFor="security-name">Display name</label><input id="security-name" name="name" minLength={2} required /></div>
            <button className="button button-secondary" type="submit">Change name</button>
          </form>
          <form className="dash-card auth-form" style={{ marginTop: 16 }} onSubmit={changePassword}>
            <div className="dash-card-head"><h2>Change password</h2><KeyRound size={17} /></div>
            <div className="field"><label htmlFor="current-password">Current password</label><input id="current-password" name="currentPassword" type="password" autoComplete="current-password" required /></div>
            <div className="field"><label htmlFor="new-password">New password</label><input id="new-password" name="newPassword" type="password" autoComplete="new-password" minLength={10} maxLength={128} required /></div>
            <button className="button" type="submit"><KeyRound size={16} />Update password</button>
          </form>
        </div>
      </div>
    </main>
  );
}

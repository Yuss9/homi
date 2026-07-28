"use client";

import { useEffect, useState, type FormEvent } from "react";
import { MailPlus, Users } from "lucide-react";

type Home = { id: string; name: string };
type Member = { id: string; name: string; email: string; role: string; joinedAt: string };

export function MemberWorkspace() {
  const [homes, setHomes] = useState<Home[]>([]);
  const [homeId, setHomeId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    void fetch("/api/homes").then((response) => response.json()).then((payload) => {
      const next = payload.homes ?? [];
      setHomes(next);
      setHomeId(next[0]?.id ?? "");
    });
  }, []);
  useEffect(() => {
    if (!homeId) return;
    void fetch(`/api/members?homeId=${homeId}`).then((response) => response.json()).then((payload) => setMembers(payload.members ?? []));
  }, [homeId]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/invitations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ homeId, email: form.get("email"), role: form.get("role") }),
    });
    const payload = await response.json();
    if (!response.ok) return setError(payload.error?.message ?? "Could not send the invitation.");
    event.currentTarget.reset();
    setMessage("Secure invitation sent. It expires in seven days.");
  }

  return (
    <main id="main" className="app-main">
      <div className="dashboard-head">
        <div><small>Household access</small><h1>Household</h1><p>Share care of your home with clear, server-enforced permissions.</p></div>
        <select aria-label="Selected home" value={homeId} onChange={(event) => setHomeId(event.target.value)}>
          {homes.map((home) => <option key={home.id} value={home.id}>{home.name}</option>)}
        </select>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      <div className="dash-grid" style={{ marginTop: 32 }}>
        <section className="dash-card">
          <div className="dash-card-head"><h2>People with access</h2><Users size={17} /></div>
          {members.map((member) => (
            <div className="dash-task" key={member.id}><span>{member.name.slice(0, 1).toUpperCase()}</span><div><strong>{member.name}</strong><small>{member.email}</small></div><b>{member.role.toLowerCase()}</b></div>
          ))}
        </section>
        <form className="dash-card auth-form" onSubmit={invite}>
          <div className="dash-card-head"><h2>Invite someone</h2><MailPlus size={17} /></div>
          <div className="field"><label htmlFor="invite-email">Email address</label><input id="invite-email" name="email" type="email" required /></div>
          <div className="field"><label htmlFor="invite-role">Role</label><select id="invite-role" name="role"><option value="MEMBER">Member · contribute</option><option value="VIEWER">Viewer · read only</option><option value="ADMIN">Admin · manage</option></select></div>
          <button className="button" disabled={!homeId} type="submit"><MailPlus size={16} />Send invitation</button>
        </form>
      </div>
    </main>
  );
}

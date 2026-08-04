"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  Clipboard,
  KeyRound,
  Link2,
  LoaderCircle,
  Plug,
  RotateCw,
  Smartphone,
  Trash2,
  Webhook,
} from "lucide-react";
import { PwaInstallPrompt } from "@/src/components/pwa-install-prompt";

type Home = { id: string; name: string; role: string };
type ApiKey = {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  lastUsedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
};
type Hook = {
  id: string;
  name: string;
  url: string;
  events: string[];
  failureCount: number;
  lastSuccessAt?: string | null;
};
type Experience = {
  locale: "en" | "fr" | "de";
  dashboardWidgets: string[];
  mobileWidget: {
    kind: string;
    homeId?: string;
    quickAction?: string;
  };
};

const widgetLabels: Record<string, string> = {
  health: "Home Health",
  upcoming: "Upcoming maintenance",
  summary: "Household summary",
  repairs: "Open repairs",
  costs: "Costs this month",
};

const scopeLabels: Record<string, string> = {
  "home:read": "Read home summary",
  "maintenance:write": "Create and complete maintenance",
  "repairs:write": "Create repairs",
  "assets:read": "Read equipment",
  "calendar:read": "Read calendar",
  "widgets:read": "Read widget data",
  "webhooks:manage": "Manage webhooks",
};

export function ConnectedPlatformSettings() {
  const [homes, setHomes] = useState<Home[]>([]);
  const [homeId, setHomeId] = useState("");
  const [experience, setExperience] = useState<Experience | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [availableScopes, setAvailableScopes] = useState<string[]>([]);
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [availableEvents, setAvailableEvents] = useState<string[]>([]);
  const [calendarFeed, setCalendarFeed] = useState<{ id: string; tokenPrefix: string } | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<{ label: string; value: string } | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadKeys() {
    const payload = await fetch("/api/api-keys").then((response) => response.json());
    setApiKeys(payload.keys ?? []);
    setAvailableScopes(payload.availableScopes ?? []);
  }

  async function loadHomeIntegrations(selectedHomeId = homeId) {
    if (!selectedHomeId) return;
    const [hookPayload, feedPayload] = await Promise.all([
      fetch(`/api/webhooks?homeId=${selectedHomeId}`).then((response) => response.json()),
      fetch(`/api/calendar-feeds?homeId=${selectedHomeId}`).then((response) => response.json()),
    ]);
    setHooks(hookPayload.webhooks ?? []);
    setAvailableEvents(hookPayload.availableEvents ?? []);
    setCalendarFeed(feedPayload.feed ?? null);
  }

  useEffect(() => {
    void Promise.all([
      fetch("/api/homes").then((response) => response.json()),
      fetch("/api/preferences/experience").then((response) => response.json()),
      fetch("/api/api-keys").then((response) => response.json()),
    ]).then(([homePayload, experiencePayload, keyPayload]) => {
      const nextHomes = homePayload.homes ?? [];
      setHomes(nextHomes);
      setHomeId(nextHomes[0]?.id ?? "");
      setExperience(experiencePayload.preferences ?? null);
      setApiKeys(keyPayload.keys ?? []);
      setAvailableScopes(keyPayload.availableScopes ?? []);
    });
  }, []);

  useEffect(() => {
    if (!homeId) return;
    void Promise.all([
      fetch(`/api/webhooks?homeId=${homeId}`).then((response) => response.json()),
      fetch(`/api/calendar-feeds?homeId=${homeId}`).then((response) => response.json()),
    ]).then(([hookPayload, feedPayload]) => {
      setHooks(hookPayload.webhooks ?? []);
      setAvailableEvents(hookPayload.availableEvents ?? []);
      setCalendarFeed(feedPayload.feed ?? null);
    });
  }, [homeId]);

  async function saveExperience() {
    if (!experience) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/preferences/experience", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(experience),
    });
    const payload = await response.json();
    if (!response.ok) setError(payload.error?.message ?? "Could not save connected preferences.");
    else {
      setMessage("Mobile, language and dashboard preferences saved.");
      window.location.reload();
    }
    setBusy(false);
  }

  function moveWidget(index: number, direction: -1 | 1) {
    if (!experience) return;
    const target = index + direction;
    if (target < 0 || target >= experience.dashboardWidgets.length) return;
    const next = [...experience.dashboardWidgets];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setExperience({ ...experience, dashboardWidgets: next });
  }

  async function createKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const scopes = availableScopes.filter((scope) => form.get(scope) === "on");
    setBusy(true);
    const response = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        scopes,
        expiresInDays: form.get("expiresInDays") ? Number(form.get("expiresInDays")) : undefined,
      }),
    });
    const payload = await response.json();
    if (!response.ok) setError(payload.error?.message ?? "Could not create the API key.");
    else {
      setRevealedSecret({ label: "API key", value: payload.token });
      event.currentTarget.reset();
      await loadKeys();
    }
    setBusy(false);
  }

  async function createCalendarFeed() {
    if (!homeId) return;
    setBusy(true);
    const response = await fetch("/api/calendar-feeds", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ homeId }),
    });
    const payload = await response.json();
    if (!response.ok) setError(payload.error?.message ?? "Could not create the calendar feed.");
    else {
      setRevealedSecret({ label: "Private calendar URL", value: payload.url });
      await loadHomeIntegrations();
    }
    setBusy(false);
  }

  async function revokeCalendarFeed() {
    await fetch("/api/calendar-feeds", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ homeId }),
    });
    await loadHomeIntegrations();
  }

  async function createWebhook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const events = availableEvents.filter((name) => form.get(name) === "on");
    setBusy(true);
    const response = await fetch("/api/webhooks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ homeId, name: form.get("name"), url: form.get("url"), events }),
    });
    const payload = await response.json();
    if (!response.ok) setError(payload.error?.message ?? "Could not create the webhook.");
    else {
      setRevealedSecret({ label: "Webhook signing secret", value: payload.secret });
      event.currentTarget.reset();
      await loadHomeIntegrations();
    }
    setBusy(false);
  }

  if (!experience) return <section className="dash-card"><p>Loading connected settings…</p></section>;

  return (
    <>
      {revealedSecret && (
        <section className="secret-reveal" role="status">
          <div><strong>{revealedSecret.label}</strong><small>Copy this value now. Homi will not show it again.</small></div>
          <code>{revealedSecret.value}</code>
          <button className="button button-secondary" onClick={() => void navigator.clipboard.writeText(revealedSecret.value)}><Clipboard size={15} /> Copy</button>
          <button className="icon-action" aria-label="Hide secret" onClick={() => setRevealedSecret(null)}><Check size={16} /></button>
        </section>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}

      <section className="dash-card auth-form connected-settings-wide">
        <div className="dash-card-head"><h2>Install and mobile experience</h2><Smartphone size={18} /></div>
        <PwaInstallPrompt />
        <div className="field">
          <label htmlFor="connected-home">Connected home</label>
          <select id="connected-home" value={homeId} onChange={(event) => setHomeId(event.target.value)}>
            {homes.map((home) => <option value={home.id} key={home.id}>{home.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="experience-locale">Language</label>
          <select id="experience-locale" value={experience.locale} onChange={(event) => setExperience({ ...experience, locale: event.target.value as Experience["locale"] })}>
            <option value="en">English</option><option value="fr">Français</option><option value="de">Deutsch</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="mobile-widget-kind">Mobile home-screen widget</label>
          <select id="mobile-widget-kind" value={experience.mobileWidget.kind} onChange={(event) => setExperience({ ...experience, mobileWidget: { ...experience.mobileWidget, homeId, kind: event.target.value } })}>
            <option value="NEXT_MAINTENANCE">Next maintenance</option>
            <option value="HOME_HEALTH">Home Health</option>
            <option value="OPEN_REPAIRS">Open repairs</option>
            <option value="MONTHLY_COSTS">Costs this month</option>
            <option value="QUICK_ACTION">Quick action</option>
          </select>
        </div>
        {experience.mobileWidget.kind === "QUICK_ACTION" && (
          <div className="field"><label htmlFor="widget-action">Widget action</label><select id="widget-action" value={experience.mobileWidget.quickAction ?? "MAINTENANCE"} onChange={(event) => setExperience({ ...experience, mobileWidget: { ...experience.mobileWidget, homeId, quickAction: event.target.value } })}><option value="SCAN">Scan</option><option value="MAINTENANCE">Create maintenance</option><option value="REPAIR">Declare repair</option><option value="CALENDAR">Calendar</option></select></div>
        )}
        <div className="dashboard-widget-order">
          <strong>Dashboard widgets</strong>
          {experience.dashboardWidgets.map((widget, index) => (
            <div key={widget}><span>{index + 1}. {widgetLabels[widget] ?? widget}</span><button className="icon-action" type="button" disabled={index === 0} onClick={() => moveWidget(index, -1)}><ArrowUp size={15} /></button><button className="icon-action" type="button" disabled={index === experience.dashboardWidgets.length - 1} onClick={() => moveWidget(index, 1)}><ArrowDown size={15} /></button><button className="icon-action" type="button" aria-label={`Hide ${widget}`} onClick={() => setExperience({ ...experience, dashboardWidgets: experience.dashboardWidgets.filter((item) => item !== widget) })}><Trash2 size={15} /></button></div>
          ))}
          {Object.keys(widgetLabels).filter((widget) => !experience.dashboardWidgets.includes(widget)).map((widget) => <button className="button button-secondary button-small" type="button" key={widget} onClick={() => setExperience({ ...experience, dashboardWidgets: [...experience.dashboardWidgets, widget] })}>Add {widgetLabels[widget]}</button>)}
        </div>
        <button className="button" disabled={busy} onClick={() => void saveExperience()}>{busy ? <LoaderCircle className="button-spinner" size={16} /> : <Check size={16} />} Save connected experience</button>
      </section>

      <form className="dash-card auth-form" onSubmit={createKey}>
        <div className="dash-card-head"><h2>Personal API keys</h2><KeyRound size={18} /></div>
        <p className="muted-copy">Use scoped, revocable keys for Home Assistant, widgets and private automations.</p>
        <div className="field"><label htmlFor="api-key-name">Key name</label><input id="api-key-name" name="name" required placeholder="Home Assistant" /></div>
        <div className="scope-grid">{availableScopes.map((scope) => <label className="check-row" key={scope}><input type="checkbox" name={scope} defaultChecked={scope === "home:read" || scope === "assets:read" || scope === "widgets:read"} /> {scopeLabels[scope] ?? scope}</label>)}</div>
        <div className="field"><label htmlFor="api-expiry">Expires after days</label><input id="api-expiry" name="expiresInDays" type="number" min="1" max="3650" placeholder="No expiry" /></div>
        <button className="button" type="submit" disabled={busy}><KeyRound size={16} /> Create key</button>
        <div className="integration-list">{apiKeys.map((key) => <article key={key.id}><div><strong>{key.name}</strong><small>homi_api_{key.tokenPrefix}_… · {key.scopes.join(", ")}</small></div><button className="icon-action" type="button" aria-label={`Revoke ${key.name}`} onClick={async () => { await fetch(`/api/api-keys/${key.id}`, { method: "DELETE" }); await loadKeys(); }}><Trash2 size={15} /></button></article>)}</div>
      </form>

      <section className="dash-card auth-form">
        <div className="dash-card-head"><h2>Private calendar feed</h2><CalendarDays size={18} /></div>
        <p className="muted-copy">Subscribe from Apple Calendar, Google Calendar or Outlook. Rotate the private URL at any time.</p>
        <button className="button" type="button" onClick={() => void createCalendarFeed()}>{calendarFeed ? <RotateCw size={16} /> : <Link2 size={16} />}{calendarFeed ? "Rotate private URL" : "Create private URL"}</button>
        {calendarFeed && <button className="button button-secondary" type="button" onClick={() => void revokeCalendarFeed()}><Trash2 size={16} /> Revoke feed</button>}
      </section>

      <form className="dash-card auth-form connected-settings-wide" onSubmit={createWebhook}>
        <div className="dash-card-head"><h2>Signed webhooks</h2><Webhook size={18} /></div>
        <div className="field"><label htmlFor="webhook-name">Name</label><input id="webhook-name" name="name" required placeholder="Home automation" /></div>
        <div className="field"><label htmlFor="webhook-url">HTTPS endpoint</label><input id="webhook-url" name="url" type="url" required placeholder="https://example.com/homi/events" /></div>
        <div className="scope-grid">{availableEvents.map((event) => <label className="check-row" key={event}><input name={event} type="checkbox" defaultChecked /> {event}</label>)}</div>
        <button className="button" type="submit" disabled={busy}><Plug size={16} /> Create webhook</button>
        <div className="integration-list">{hooks.map((hook) => <article key={hook.id}><div><strong>{hook.name}</strong><small>{hook.url} · {hook.events.join(", ")}</small></div><button className="button button-secondary button-small" type="button" onClick={async () => { await fetch(`/api/webhooks/${hook.id}/test`, { method: "POST" }); setMessage("Webhook test queued."); }}>Test</button><button className="icon-action" type="button" aria-label={`Delete ${hook.name}`} onClick={async () => { await fetch(`/api/webhooks/${hook.id}`, { method: "DELETE" }); await loadHomeIntegrations(); }}><Trash2 size={15} /></button></article>)}</div>
      </form>
    </>
  );
}

"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Plus, Wrench } from "lucide-react";

type Home = { id: string; name: string };
type Asset = { id: string; name: string };
type Repair = { id: string; title: string; status: string; issueDate: string; provider?: string | null };

export function RepairWorkspace() {
  const [homes, setHomes] = useState<Home[]>([]);
  const [homeId, setHomeId] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    void fetch("/api/homes").then((response) => response.json()).then((payload) => {
      const next = payload.homes ?? [];
      setHomes(next);
      setHomeId(next[0]?.id ?? "");
    });
  }, []);
  async function load(selectedHomeId = homeId) {
    if (!selectedHomeId) return;
    const [assetResponse, repairResponse] = await Promise.all([
      fetch(`/api/assets?homeId=${selectedHomeId}`),
      fetch(`/api/repairs?homeId=${selectedHomeId}`),
    ]);
    setAssets((await assetResponse.json()).assets ?? []);
    setRepairs((await repairResponse.json()).repairs ?? []);
  }
  useEffect(() => {
    if (!homeId) return;
    void Promise.all([
      fetch(`/api/assets?homeId=${homeId}`).then((response) => response.json()),
      fetch(`/api/repairs?homeId=${homeId}`).then((response) => response.json()),
    ]).then(([assetPayload, repairPayload]) => {
      setAssets(assetPayload.assets ?? []);
      setRepairs(repairPayload.repairs ?? []);
    });
  }, [homeId]);
  async function addRepair(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/repairs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        homeId,
        assetId: form.get("assetId"),
        title: form.get("title"),
        issueDate: form.get("issueDate"),
        provider: form.get("provider") || undefined,
        status: "OPEN",
        warrantyClaim: form.get("warrantyClaim") === "on",
      }),
    });
    const payload = await response.json();
    if (!response.ok) return setError(payload.error?.message ?? "Could not log the repair.");
    event.currentTarget.reset();
    await load();
  }
  return (
    <main id="main" className="app-main">
      <div className="dashboard-head"><div><small>Repair history</small><h1>Repairs</h1><p>Issues, visits, providers, and warranty claims in one place.</p></div><select aria-label="Selected home" value={homeId} onChange={(event) => setHomeId(event.target.value)}>{homes.map((home) => <option key={home.id} value={home.id}>{home.name}</option>)}</select></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="dash-grid" style={{ marginTop: 32 }}>
        <section className="dash-card"><div className="dash-card-head"><h2>Repair log</h2><Wrench size={17} /></div>{repairs.map((repair) => <div className="dash-task" key={repair.id}><span><Wrench size={16} /></span><div><strong>{repair.title}</strong><small>{repair.provider || "No provider"} · {repair.issueDate}</small></div><b>{repair.status.toLowerCase()}</b></div>)}{!repairs.length && <p className="muted-copy">No repairs have been logged.</p>}</section>
        <form className="dash-card auth-form" onSubmit={addRepair}><div className="dash-card-head"><h2>Log a repair</h2><Plus size={17} /></div><div className="field"><label htmlFor="repair-asset">Asset</label><select id="repair-asset" name="assetId" required>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></div><div className="field"><label htmlFor="repair-title">Issue</label><input id="repair-title" name="title" required placeholder="Extractor fan is rattling" /></div><div className="field"><label htmlFor="repair-date">Issue date</label><input id="repair-date" name="issueDate" type="date" required /></div><div className="field"><label htmlFor="repair-provider">Provider</label><input id="repair-provider" name="provider" /></div><label className="check-row"><input type="checkbox" name="warrantyClaim" /> Warranty claim</label><button className="button" disabled={!assets.length} type="submit"><Plus size={16} />Log repair</button></form>
      </div>
    </main>
  );
}

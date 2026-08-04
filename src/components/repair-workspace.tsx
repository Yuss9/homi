"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Archive, Check, Pencil, Plus, Wrench, X } from "lucide-react";
import { ActionFeedback } from "@/src/components/action-feedback";

type Home = { id: string; name: string };
type Asset = { id: string; name: string };
type Repair = {
  id: string;
  assetId: string;
  title: string;
  description?: string | null;
  status: string;
  issueDate: string;
  repairDate?: string | null;
  provider?: string | null;
  cost?: string | null;
  currency?: string | null;
  warrantyClaim: boolean;
};

const optional = (form: FormData, name: string) => {
  const value = String(form.get(name) ?? "").trim();
  return value || null;
};

export function RepairWorkspace() {
  const [homes, setHomes] = useState<Home[]>([]);
  const [homeId, setHomeId] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [editingRepairId, setEditingRepairId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/homes")
      .then((response) => response.json())
      .then((payload) => {
        const next = payload.homes ?? [];
        setHomes(next);
        setHomeId(next[0]?.id ?? "");
      });
  }, []);

  async function load(selectedHomeId = homeId) {
    if (!selectedHomeId) {
      setAssets([]);
      setRepairs([]);
      return;
    }
    const [assetResponse, repairResponse] = await Promise.all([
      fetch(`/api/assets?homeId=${selectedHomeId}`),
      fetch(`/api/repairs?homeId=${selectedHomeId}`),
    ]);
    setAssets((await assetResponse.json()).assets ?? []);
    setRepairs((await repairResponse.json()).repairs ?? []);
  }

  useEffect(() => {
    setEditingRepairId("");
    void load(homeId);
  }, [homeId]);

  async function addRepair(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError("");
    const form = new FormData(formElement);
    const response = await fetch("/api/repairs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        homeId,
        assetId: form.get("assetId"),
        title: form.get("title"),
        description: optional(form, "description") ?? undefined,
        issueDate: form.get("issueDate"),
        repairDate: optional(form, "repairDate") ?? undefined,
        provider: optional(form, "provider") ?? undefined,
        cost: optional(form, "cost") ?? undefined,
        currency: optional(form, "currency") ?? "EUR",
        status: form.get("status"),
        warrantyClaim: form.get("warrantyClaim") === "on",
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message ?? "Could not log the repair.");
      return;
    }
    formElement.reset();
    setMessage("Repair added to the history.");
    await load();
  }

  async function saveRepair(
    event: FormEvent<HTMLFormElement>,
    repair: Repair,
  ) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/repairs/${repair.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        assetId: form.get("assetId"),
        title: form.get("title"),
        description: optional(form, "description"),
        issueDate: form.get("issueDate"),
        repairDate: optional(form, "repairDate"),
        provider: optional(form, "provider"),
        cost: optional(form, "cost"),
        currency: optional(form, "currency") ?? "EUR",
        status: form.get("status"),
        warrantyClaim: form.get("warrantyClaim") === "on",
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message ?? "Could not update the repair.");
      return;
    }
    setEditingRepairId("");
    setMessage("Repair updated.");
    await load();
  }

  async function archiveRepair(repair: Repair) {
    const response = await fetch(`/api/repairs/${repair.id}`, {
      method: "DELETE",
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message ?? "Could not archive the repair.");
      return;
    }
    setEditingRepairId("");
    setMessage(`${repair.title} was archived.`);
    await load();
  }

  return (
    <main id="main" className="app-main">
      <div className="dashboard-head">
        <div><small>Repair history</small><h1>Repairs</h1><p>Track the full issue, provider, cost, completion date, and warranty claim.</p></div>
        <select aria-label="Selected home" value={homeId} onChange={(event) => setHomeId(event.target.value)}>{homes.map((home) => <option key={home.id} value={home.id}>{home.name}</option>)}</select>
      </div>

      <ActionFeedback error={error} message={message} />

      <div className="dash-grid" style={{ marginTop: 32 }}>
        <section className="dash-card">
          <div className="dash-card-head"><h2>Repair log</h2><Wrench size={17} /></div>
          <div className="animated-list">
            {repairs.map((repair) =>
              editingRepairId === repair.id ? (
                <form className="auth-form compact-form" key={repair.id} onSubmit={(event) => void saveRepair(event, repair)}>
                  <div className="dash-card-head"><h2>Edit repair</h2><button className="icon-action" type="button" aria-label="Cancel repair editing" onClick={() => setEditingRepairId("")}><X size={16} /></button></div>
                  <RepairFields assets={assets} repair={repair} prefix={`edit-${repair.id}`} />
                  <div className="inline-actions"><button className="button button-small" type="submit"><Check size={15} />Save</button><button className="button button-secondary button-small" type="button" onClick={() => void archiveRepair(repair)}><Archive size={15} />Archive</button></div>
                </form>
              ) : (
                <div className="dash-task has-action" key={repair.id}>
                  <span><Wrench size={16} /></span>
                  <div>
                    <strong>{repair.title}</strong>
                    <small>{repair.provider || "No provider"} · {repair.issueDate}{repair.cost ? ` · ${repair.cost} ${repair.currency ?? "EUR"}` : ""}</small>
                    {repair.repairDate && <small>Repaired {repair.repairDate}</small>}
                  </div>
                  <b>{repair.status.toLowerCase().replaceAll("_", " ")}</b>
                  <button className="icon-action" type="button" aria-label={`Edit ${repair.title}`} onClick={() => setEditingRepairId(repair.id)}><Pencil size={16} /></button>
                </div>
              ),
            )}
          </div>
          {!repairs.length && <p className="muted-copy">No repairs have been logged.</p>}
        </section>

        <form className="dash-card auth-form" onSubmit={addRepair}>
          <div className="dash-card-head"><h2>Log a repair</h2><Plus size={17} /></div>
          <RepairFields assets={assets} prefix="new" />
          <button className="button" disabled={!assets.length} type="submit"><Plus size={16} />Log repair</button>
        </form>
      </div>
    </main>
  );
}

function RepairFields({
  assets,
  repair,
  prefix,
}: {
  assets: Asset[];
  repair?: Repair;
  prefix: string;
}) {
  return (
    <>
      <div className="field"><label htmlFor={`${prefix}-asset`}>Asset</label><select id={`${prefix}-asset`} name="assetId" required defaultValue={repair?.assetId}>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></div>
      <div className="field"><label htmlFor={`${prefix}-title`}>Issue</label><input id={`${prefix}-title`} name="title" required placeholder="Extractor fan is rattling" defaultValue={repair?.title} /></div>
      <div className="field"><label htmlFor={`${prefix}-description`}>Description</label><textarea id={`${prefix}-description`} name="description" defaultValue={repair?.description ?? ""} /></div>
      <div className="field"><label htmlFor={`${prefix}-issue-date`}>Issue date</label><input id={`${prefix}-issue-date`} name="issueDate" type="date" required defaultValue={repair?.issueDate} /></div>
      <div className="field"><label htmlFor={`${prefix}-repair-date`}>Repair date</label><input id={`${prefix}-repair-date`} name="repairDate" type="date" defaultValue={repair?.repairDate ?? ""} /></div>
      <div className="field"><label htmlFor={`${prefix}-provider`}>Provider</label><input id={`${prefix}-provider`} name="provider" defaultValue={repair?.provider ?? ""} /></div>
      <div className="field"><label htmlFor={`${prefix}-cost`}>Cost</label><input id={`${prefix}-cost`} name="cost" inputMode="decimal" placeholder="149.90" defaultValue={repair?.cost ?? ""} /></div>
      <div className="field"><label htmlFor={`${prefix}-currency`}>Currency</label><input id={`${prefix}-currency`} name="currency" maxLength={3} defaultValue={repair?.currency ?? "EUR"} /></div>
      <div className="field"><label htmlFor={`${prefix}-status`}>Status</label><select id={`${prefix}-status`} name="status" defaultValue={repair?.status ?? "OPEN"}><option value="OPEN">Open</option><option value="SCHEDULED">Scheduled</option><option value="IN_PROGRESS">In progress</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option></select></div>
      <label className="check-row"><input type="checkbox" name="warrantyClaim" defaultChecked={repair?.warrantyClaim} /> Warranty claim</label>
    </>
  );
}

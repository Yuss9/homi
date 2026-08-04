"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import {
  CheckCircle2,
  Coins,
  History,
  Pencil,
  Save,
  X,
} from "lucide-react";
import { ActionFeedback } from "@/src/components/action-feedback";

type Home = { id: string; name: string };
type RecordRow = {
  id: string;
  completedAt: string;
  notes: string | null;
  cost: string | null;
  currency: string | null;
  serviceProvider: string | null;
  taskTitle: string | null;
  assetName: string | null;
  completedByName: string;
};

export function MaintenanceHistoryWorkspace() {
  const [homes, setHomes] = useState<Home[]>([]);
  const [homeId, setHomeId] = useState("");
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/homes")
      .then((response) => response.json())
      .then((payload) => {
        const next = payload.homes ?? [];
        setHomes(next);
        setHomeId(next[0]?.id ?? "");
      });
  }, []);

  async function load(selectedHomeId: string) {
    const response = await fetch(
      `/api/maintenance-records?homeId=${selectedHomeId}`,
    );
    const payload = await response.json();
    setRecords(payload.records ?? []);
    setCanManage(Boolean(payload.canManage));
  }

  useEffect(() => {
    if (!homeId) return;
    void Promise.resolve().then(() => load(homeId));
  }, [homeId]);

  async function save(event: FormEvent<HTMLFormElement>, record: RecordRow) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/maintenance-records/${record.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        notes: form.get("notes") || null,
        serviceProvider: form.get("serviceProvider") || null,
        cost: form.get("cost") || null,
        currency: form.get("currency") || "EUR",
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message ?? "Could not update the service record.");
      return;
    }
    setEditingId("");
    setError("");
    setMessage("Maintenance cost and service details were updated.");
    await load(homeId);
  }

  return (
    <main id="main" className="app-main">
      <div className="dashboard-head">
        <div>
          <small>Permanent record</small>
          <h1>Maintenance history</h1>
          <p>
            Completed work, notes, providers, and costs for the selected home.
          </p>
        </div>
        <div className="inline-actions">
          <Link className="button button-secondary" href="/costs">
            <Coins size={16} />
            Cost insights
          </Link>
          <select
            aria-label="Selected home"
            value={homeId}
            onChange={(event) => {
              setHomeId(event.target.value);
              setEditingId("");
            }}
          >
            {homes.map((home) => (
              <option key={home.id} value={home.id}>
                {home.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ActionFeedback error={error} message={message} />

      <section className="dash-card resource-list-card">
        <div className="dash-card-head">
          <h2>Completed work</h2>
          <History size={17} />
        </div>
        {records.map((record) => {
          if (editingId === record.id) {
            return (
              <form
                className="auth-form compact-form maintenance-record-editor"
                key={record.id}
                onSubmit={(event) => void save(event, record)}
              >
                <div className="dash-card-head">
                  <div>
                    <small>{record.assetName ?? "Whole home"}</small>
                    <h2>{record.taskTitle || "Maintenance record"}</h2>
                  </div>
                  <button
                    className="icon-action"
                    type="button"
                    aria-label="Cancel maintenance record editing"
                    onClick={() => setEditingId("")}
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="field">
                  <label htmlFor={`record-notes-${record.id}`}>Notes</label>
                  <textarea
                    id={`record-notes-${record.id}`}
                    name="notes"
                    defaultValue={record.notes ?? ""}
                  />
                </div>
                <div className="form-grid-three">
                  <div className="field">
                    <label htmlFor={`record-provider-${record.id}`}>
                      Provider
                    </label>
                    <input
                      id={`record-provider-${record.id}`}
                      name="serviceProvider"
                      defaultValue={record.serviceProvider ?? ""}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`record-cost-${record.id}`}>Cost</label>
                    <input
                      id={`record-cost-${record.id}`}
                      name="cost"
                      inputMode="decimal"
                      pattern="\d{1,10}(\.\d{1,2})?"
                      defaultValue={record.cost ?? ""}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`record-currency-${record.id}`}>
                      Currency
                    </label>
                    <input
                      id={`record-currency-${record.id}`}
                      name="currency"
                      minLength={3}
                      maxLength={3}
                      defaultValue={record.currency ?? "EUR"}
                      required
                    />
                  </div>
                </div>
                <button className="button button-small" type="submit">
                  <Save size={15} />
                  Save service record
                </button>
              </form>
            );
          }
          return (
            <article className="dash-task has-action" key={record.id}>
              <span>
                <CheckCircle2 size={16} />
              </span>
              <div>
                <strong>{record.taskTitle || "Maintenance record"}</strong>
                <small>
                  {[
                    record.assetName,
                    record.notes || record.serviceProvider || "No notes added",
                    `by ${record.completedByName}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
              </div>
              <time>
                {new Intl.DateTimeFormat("en", {
                  dateStyle: "medium",
                }).format(new Date(record.completedAt))}
                {record.cost
                  ? ` · ${record.cost} ${record.currency ?? "EUR"}`
                  : ""}
              </time>
              {canManage && (
                <button
                  className="icon-action"
                  type="button"
                  aria-label={`Edit ${record.taskTitle ?? "maintenance record"}`}
                  onClick={() => setEditingId(record.id)}
                >
                  <Pencil size={15} />
                </button>
              )}
            </article>
          );
        })}
        {!records.length && (
          <p className="muted-copy">Completed maintenance will appear here.</p>
        )}
      </section>
    </main>
  );
}

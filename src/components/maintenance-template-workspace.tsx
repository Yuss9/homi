"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Archive,
  CalendarPlus,
  Check,
  Library,
  LoaderCircle,
  Plus,
  Search,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import { ActionFeedback } from "@/src/components/action-feedback";
import type { MaintenanceTemplateDefinition } from "@/src/features/maintenance/templates";

type Home = { id: string; name: string; role: string };
type Asset = { id: string; name: string };
type Member = { userId: string; name: string; role: string };
type Template = MaintenanceTemplateDefinition & {
  homeId?: string;
  createdBy?: string;
};

function dateInput(days = 7) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

const optionalNumber = (form: FormData, name: string) => {
  const value = String(form.get(name) ?? "").trim();
  return value ? Number(value) : null;
};

export function MaintenanceTemplateWorkspace() {
  const [homes, setHomes] = useState<Home[]>([]);
  const [homeId, setHomeId] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState<Template | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState("");

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
    if (!selectedHomeId) return;
    const [templateResponse, assetResponse, memberResponse] = await Promise.all([
      fetch(`/api/maintenance-templates?homeId=${selectedHomeId}`),
      fetch(`/api/assets?homeId=${selectedHomeId}`),
      fetch(`/api/members?homeId=${selectedHomeId}`),
    ]);
    const [templatePayload, assetPayload, memberPayload] = await Promise.all([
      templateResponse.json(),
      assetResponse.json(),
      memberResponse.json(),
    ]);
    setTemplates(templatePayload.templates ?? []);
    setAssets(assetPayload.assets ?? []);
    setMembers(memberPayload.members ?? []);
  }

  useEffect(() => {
    if (!homeId) return;
    void Promise.resolve().then(() => load(homeId));
  }, [homeId]);

  const categories = useMemo(
    () => ["All", ...new Set(templates.map((template) => template.category))],
    [templates],
  );
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return templates.filter(
      (template) =>
        (category === "All" || template.category === category) &&
        (!needle ||
          template.title.toLowerCase().includes(needle) ||
          template.description?.toLowerCase().includes(needle) ||
          template.category.toLowerCase().includes(needle)),
    );
  }, [category, query, templates]);
  const selectedHome = homes.find((home) => home.id === homeId);
  const canManage =
    selectedHome?.role === "OWNER" || selectedHome?.role === "ADMIN";

  async function createTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setProcessing("create");
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/maintenance-templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          homeId,
          title: form.get("title"),
          description: form.get("description") || null,
          category: form.get("category"),
          frequencyType: form.get("frequencyType"),
          frequencyInterval: Number(form.get("frequencyInterval")),
          priority: form.get("priority"),
          estimatedDurationMinutes: optionalNumber(
            form,
            "estimatedDurationMinutes",
          ),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Could not save the template.");
        return;
      }
      formElement.reset();
      setMessage(`${payload.template.title} was added to this home.`);
      await load(homeId);
    } finally {
      setProcessing("");
    }
  }

  async function applyTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    setProcessing(selected.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/maintenance-templates/${encodeURIComponent(selected.id)}/apply`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            homeId,
            assetId: form.get("assetId") || null,
            assignedTo: form.get("assignedTo") || null,
            nextDueAt: form.get("nextDueAt"),
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Could not schedule this template.");
        return;
      }
      setSelected(null);
      setMessage(`${payload.task.title} was added to the maintenance schedule.`);
    } finally {
      setProcessing("");
    }
  }

  async function archiveTemplate(template: Template) {
    if (!window.confirm(`Archive the template “${template.title}”?`)) return;
    setProcessing(template.id);
    const response = await fetch(`/api/maintenance-templates/${template.id}`, {
      method: "DELETE",
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message ?? "Could not archive the template.");
    } else {
      setMessage(`${template.title} was archived.`);
      await load(homeId);
    }
    setProcessing("");
  }

  return (
    <main id="main" className="app-main">
      <div className="dashboard-head">
        <div>
          <small>Reusable care plans</small>
          <h1>Maintenance library</h1>
          <p>
            Start from a trusted checklist or save the routines that make your
            own home easier to care for.
          </p>
        </div>
        <div className="inline-actions">
          <Link className="button button-secondary" href="/maintenance">
            <Wrench size={16} />
            Schedule
          </Link>
          <select
            aria-label="Selected home"
            value={homeId}
            onChange={(event) => {
              setHomeId(event.target.value);
              setSelected(null);
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

      <div className="library-toolbar">
        <label className="command-search">
          <Search size={17} />
          <input
            aria-label="Search maintenance templates"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search filters, safety, exterior…"
          />
        </label>
        <div className="filter-pills" aria-label="Template categories">
          {categories.map((item) => (
            <button
              className={category === item ? "active" : ""}
              key={item}
              type="button"
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <section className="template-grid" aria-label="Maintenance templates">
        {visible.map((template) => (
          <article className="template-card" key={template.id}>
            <div className="template-card-top">
              <span>
                {template.source === "SYSTEM" ? (
                  <Sparkles size={17} />
                ) : (
                  <Library size={17} />
                )}
              </span>
              <small>{template.category}</small>
              {template.source === "HOME" && canManage && (
                <button
                  className="icon-action"
                  type="button"
                  aria-label={`Archive ${template.title}`}
                  disabled={processing === template.id}
                  onClick={() => void archiveTemplate(template)}
                >
                  <Archive size={15} />
                </button>
              )}
            </div>
            <h2>{template.title}</h2>
            <p>{template.description}</p>
            <div className="template-meta">
              <span>
                Every {template.frequencyInterval}{" "}
                {template.frequencyType.toLowerCase()}
              </span>
              <span>{template.priority.toLowerCase()} priority</span>
              {template.estimatedDurationMinutes && (
                <span>{template.estimatedDurationMinutes} min</span>
              )}
            </div>
            {canManage && (
              <button
                className="button button-small"
                type="button"
                onClick={() => setSelected(template)}
              >
                <CalendarPlus size={15} />
                Use template
              </button>
            )}
          </article>
        ))}
      </section>

      {!visible.length && (
        <section className="dash-card empty-state">
          <Search size={22} />
          <h2>No matching routines</h2>
          <p>Try another category or a broader search.</p>
        </section>
      )}

      {canManage && (
        <form
          className="dash-card auth-form template-create-form"
          onSubmit={createTemplate}
        >
          <div className="dash-card-head">
            <div>
              <small>For {selectedHome?.name}</small>
              <h2>Create a household template</h2>
            </div>
            <Plus size={18} />
          </div>
          <div className="form-grid-two">
            <div className="field">
              <label htmlFor="template-title">Routine</label>
              <input id="template-title" name="title" required />
            </div>
            <div className="field">
              <label htmlFor="template-category">Category</label>
              <input
                id="template-category"
                name="category"
                placeholder="Garden"
                required
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="template-description">Instructions</label>
            <textarea id="template-description" name="description" rows={3} />
          </div>
          <div className="form-grid-four">
            <div className="field">
              <label htmlFor="template-frequency">Frequency</label>
              <select
                id="template-frequency"
                name="frequencyType"
                defaultValue="MONTHLY"
              >
                <option value="ONCE">One time</option>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
                <option value="CUSTOM">Days</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="template-interval">Every</label>
              <input
                id="template-interval"
                name="frequencyInterval"
                type="number"
                min="1"
                max="3650"
                defaultValue="1"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="template-priority">Priority</label>
              <select
                id="template-priority"
                name="priority"
                defaultValue="MEDIUM"
              >
                <option>LOW</option>
                <option>MEDIUM</option>
                <option>HIGH</option>
                <option>CRITICAL</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="template-duration">Minutes</label>
              <input
                id="template-duration"
                name="estimatedDurationMinutes"
                type="number"
                min="1"
                max="1440"
              />
            </div>
          </div>
          <button className="button" disabled={processing === "create"}>
            {processing === "create" ? (
              <LoaderCircle className="button-spinner" size={16} />
            ) : (
              <Plus size={16} />
            )}
            Save template
          </button>
        </form>
      )}

      {selected && (
        <div className="modal-backdrop" role="presentation">
          <form
            className="command-dialog schedule-template-dialog"
            onSubmit={applyTemplate}
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-template-title"
          >
            <div className="dash-card-head">
              <div>
                <small>{selected.category}</small>
                <h2 id="schedule-template-title">{selected.title}</h2>
              </div>
              <button
                className="icon-action"
                type="button"
                aria-label="Close template scheduler"
                onClick={() => setSelected(null)}
              >
                <X size={17} />
              </button>
            </div>
            <div className="field">
              <label htmlFor="template-asset">Asset</label>
              <select id="template-asset" name="assetId">
                <option value="">Whole home</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="template-assignee">Assigned to</label>
              <select id="template-assignee" name="assignedTo">
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name} · {member.role.toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="template-next-due">First due date</label>
              <input
                id="template-next-due"
                name="nextDueAt"
                type="date"
                defaultValue={dateInput()}
                required
              />
            </div>
            <button className="button" disabled={processing === selected.id}>
              {processing === selected.id ? (
                <LoaderCircle className="button-spinner" size={16} />
              ) : (
                <Check size={16} />
              )}
              Add to schedule
            </button>
          </form>
        </div>
      )}
    </main>
  );
}

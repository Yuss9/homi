"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Boxes,
  CalendarClock,
  Camera,
  ClipboardCheck,
  Coins,
  FileUp,
  Hammer,
  PackageCheck,
  Plus,
  Printer,
  RefreshCcw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { ActionFeedback } from "@/src/components/action-feedback";

type Home = { id: string; name: string };
type Asset = {
  id: string;
  name: string;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
};
type Room = { id: string; name: string };
type DocumentOption = { id: string; title: string; type: string };
type ChecklistItem = {
  id: string;
  title: string;
  required: boolean;
  completedAt?: string | null;
};
type Task = {
  id: string;
  title: string;
  nextDueAt: string;
  priority: string;
  checklist: ChecklistItem[];
  recurrenceRule?: Record<string, unknown> | null;
};
type Template = {
  id: string;
  title: string;
  checklist: ChecklistItem[];
  recurrenceRule?: Record<string, unknown> | null;
};
type MaintenanceRecord = {
  id: string;
  taskId?: string | null;
  completedAt: string;
  notes?: string | null;
};
type Repair = { id: string; title: string; status: string; assetId: string };
type Provider = {
  id: string;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  specialties: string[];
  notes?: string | null;
  rating?: number | null;
};
type Intervention = {
  id: string;
  providerId: string;
  occurredAt: string;
  notes?: string | null;
  cost?: string | null;
  currency: string;
  rating?: number | null;
};
type InventoryItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  reorderThreshold: number;
  location?: string | null;
  sku?: string | null;
};
type Replacement = {
  id: string;
  predecessorAssetId: string;
  successorAssetId: string;
  replacedAt: string;
  notes?: string | null;
};
type Budget = {
  id: string;
  year: number;
  currency: string;
  maintenanceBudget: string;
  repairBudget: string;
  replacementBudget: string;
  actualMaintenance: number;
  actualRepairs: number;
  forecastReplacement: number;
};
type Forecast = { year: number; amount: number };
type Renovation = {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  budget?: string | null;
  currency: string;
  targetEndDate?: string | null;
};
type RenovationTask = {
  id: string;
  projectId: string;
  title: string;
  dueDate?: string | null;
  completedAt?: string | null;
};
type RenovationQuote = {
  id: string;
  projectId: string;
  providerId?: string | null;
  description: string;
  amount: string;
  currency: string;
  status: string;
};
type InsuranceItem = {
  id: string;
  roomId?: string | null;
  assetId?: string | null;
  name: string;
  category: string;
  quantity: number;
  unitValue: string;
  currency: string;
  notes?: string | null;
};
type InsuranceTotal = { currency: string; total: number };
type ScheduleHistory = {
  id: string;
  taskId: string;
  action: string;
  previousDueAt: string;
  newDueAt: string;
  reason: string;
  createdAt: string;
};

type OperationsData = {
  tasks: Task[];
  templates: Template[];
  scheduleHistory: ScheduleHistory[];
  maintenanceRecords: MaintenanceRecord[];
  repairs: Repair[];
  providers: Provider[];
  providerInterventions: Intervention[];
  inventory: InventoryItem[];
  replacements: Replacement[];
  budgets: Budget[];
  replacementForecast: Forecast[];
  renovations: Renovation[];
  renovationTasks: RenovationTask[];
  renovationQuotes: RenovationQuote[];
  insuranceItems: InsuranceItem[];
  insuranceTotals: InsuranceTotal[];
  assets: Asset[];
  rooms: Room[];
  documents: DocumentOption[];
};

const emptyData: OperationsData = {
  tasks: [],
  templates: [],
  scheduleHistory: [],
  maintenanceRecords: [],
  repairs: [],
  providers: [],
  providerInterventions: [],
  inventory: [],
  replacements: [],
  budgets: [],
  replacementForecast: [],
  renovations: [],
  renovationTasks: [],
  renovationQuotes: [],
  insuranceItems: [],
  insuranceTotals: [],
  assets: [],
  rooms: [],
  documents: [],
};

const tabs = [
  ["maintenance", "Maintenance", ClipboardCheck],
  ["attachments", "Files", FileUp],
  ["providers", "Providers", Users],
  ["inventory", "Stock", Boxes],
  ["labels", "QR labels", Printer],
  ["planning", "Assets & budgets", Coins],
  ["renovations", "Renovations", Hammer],
  ["insurance", "Insurance", ShieldCheck],
] as const;

type Tab = (typeof tabs)[number][0];

function value(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

function optional(form: FormData, name: string) {
  return value(form, name) || null;
}

function numberValue(form: FormData, name: string) {
  return Number(value(form, name));
}

function Card({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="dash-card">
      <div className="dash-card-head">
        <h2>{title}</h2>
        {icon}
      </div>
      {children}
    </section>
  );
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function currency(value: number | string, code = "EUR") {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: code,
  }).format(Number(value));
}

export function OperationsWorkspace() {
  const [homes, setHomes] = useState<Home[]>([]);
  const [homeId, setHomeId] = useState("");
  const [data, setData] = useState<OperationsData>(emptyData);
  const [tab, setTab] = useState<Tab>("maintenance");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [labelDetails, setLabelDetails] = useState(true);

  useEffect(() => {
    let active = true;
    void fetch("/api/homes")
      .then((response) => response.json())
      .then((payload) => {
        if (!active) return;
        const next = (payload.homes ?? []) as Home[];
        setHomes(next);
        setHomeId(next[0]?.id ?? "");
      });
    return () => {
      active = false;
    };
  }, []);

  async function load(selectedHomeId = homeId) {
    if (!selectedHomeId) {
      setData(emptyData);
      return;
    }
    const response = await fetch(`/api/operations?homeId=${selectedHomeId}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message ?? "Could not load operations.");
    setData(payload as OperationsData);
  }

  useEffect(() => {
    if (!homeId) return;
    let active = true;
    void fetch(`/api/operations?homeId=${homeId}`)
      .then((response) => response.json())
      .then((payload) => {
        if (active) setData(payload as OperationsData);
      });
    return () => {
      active = false;
    };
  }, [homeId]);

  async function post(action: string, payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/operations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, homeId, ...payload }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Operation failed.");
      await load();
      setMessage("Changes saved.");
      return body as Record<string, unknown>;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operation failed.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  const assetName = useMemo(
    () => new Map(data.assets.map((asset) => [asset.id, asset.name])),
    [data.assets],
  );
  const providerName = useMemo(
    () => new Map(data.providers.map((provider) => [provider.id, provider.name])),
    [data.providers],
  );

  async function addChecklist(
    event: FormEvent<HTMLFormElement>,
    targetType: "TASK" | "TEMPLATE",
    targetId: string,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await post("checklist.add", {
      targetType,
      targetId,
      title: value(form, "title"),
      required: form.get("required") === "on",
    });
    if (result) event.currentTarget.reset();
  }

  async function changeSchedule(event: FormEvent<HTMLFormElement>, taskId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await post("schedule.change", {
      taskId,
      scheduleAction: value(form, "scheduleAction"),
      newDueAt: value(form, "newDueAt"),
      reason: value(form, "reason"),
    });
  }

  async function saveRecurrence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const weekdays = form
      .getAll("weekdays")
      .map((day) => Number(day))
      .filter(Number.isInteger);
    const months = value(form, "months")
      .split(",")
      .map((month) => Number(month.trim()))
      .filter((month) => Number.isInteger(month) && month >= 1 && month <= 12);
    await post("recurrence.upsert", {
      targetType: value(form, "targetType"),
      targetId: value(form, "targetId"),
      rule: {
        weekdays: weekdays.length ? weekdays : undefined,
        months: months.length ? months : undefined,
        dayOfMonth: value(form, "dayOfMonth")
          ? numberValue(form, "dayOfMonth")
          : undefined,
        season: value(form, "season") || undefined,
        startDate: value(form, "startDate") || undefined,
        endDate: value(form, "endDate") || undefined,
        custom: value(form, "intervalDays")
          ? { intervalDays: numberValue(form, "intervalDays") }
          : undefined,
      },
    });
  }

  async function uploadAttachment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    form.set("homeId", homeId);
    try {
      const response = await fetch("/api/operations/attachments", {
        method: "POST",
        body: form,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Upload failed.");
      event.currentTarget.reset();
      setMessage("The scanned file was attached and added to Documents.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  function toggleLabel(assetId: string) {
    setSelectedLabels((current) =>
      current.includes(assetId)
        ? current.filter((id) => id !== assetId)
        : [...current, assetId],
    );
  }

  return (
    <main id="main" className="app-main">
      <div className="dashboard-head">
        <div>
          <small>Household command center</small>
          <h1>Operations</h1>
          <p>
            Plan maintenance, manage trades and stock, prepare renovations, and
            keep an insurance-ready inventory.
          </p>
        </div>
        <select
          aria-label="Selected home"
          value={homeId}
          onChange={(event) => {
            setData(emptyData);
            setHomeId(event.target.value);
          }}
        >
          {homes.map((home) => (
            <option key={home.id} value={home.id}>
              {home.name}
            </option>
          ))}
        </select>
      </div>

      <ActionFeedback error={error} message={message} />

      <div
        className="inline-actions operations-tabs"
        role="tablist"
        aria-label="Operations sections"
        style={{ margin: "26px 0", flexWrap: "wrap" }}
      >
        {tabs.map(([key, label, Icon]) => (
          <button
            className={`button button-small ${
              tab === key ? "" : "button-secondary"
            }`}
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            type="button"
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {tab === "maintenance" && (
        <div className="dash-grid">
          <Card title="Task checklists" icon={<ClipboardCheck size={19} />}>
            <div className="animated-list">
              {data.tasks.map((task) => (
                <article className="operations-item" key={task.id}>
                  <div className="dash-card-head">
                    <div>
                      <strong>{task.title}</strong>
                      <small>
                        Due {formatDate(task.nextDueAt)} · {task.priority.toLowerCase()}
                      </small>
                    </div>
                    <span>
                      {task.checklist.filter((item) => item.completedAt).length}/
                      {task.checklist.length}
                    </span>
                  </div>
                  {task.checklist.map((item) => (
                    <label className="operations-check" key={item.id}>
                      <input
                        type="checkbox"
                        checked={Boolean(item.completedAt)}
                        disabled={busy}
                        onChange={(event) =>
                          void post("checklist.toggle", {
                            itemId: item.id,
                            completed: event.target.checked,
                          })
                        }
                      />
                      <span>{item.title}</span>
                      {item.required && <small>required</small>}
                      <button
                        className="icon-action"
                        aria-label={`Delete ${item.title}`}
                        type="button"
                        onClick={() =>
                          void post("checklist.delete", {
                            targetType: "TASK",
                            itemId: item.id,
                          })
                        }
                      >
                        ×
                      </button>
                    </label>
                  ))}
                  <form
                    className="inline-form"
                    onSubmit={(event) => void addChecklist(event, "TASK", task.id)}
                  >
                    <input name="title" placeholder="Add a sub-task" required />
                    <label>
                      <input name="required" type="checkbox" defaultChecked />
                      Required
                    </label>
                    <button className="button button-small" disabled={busy}>
                      <Plus size={14} /> Add
                    </button>
                  </form>
                  <form
                    className="auth-form compact-form schedule-form"
                    onSubmit={(event) => void changeSchedule(event, task.id)}
                  >
                    <div className="field">
                      <label htmlFor={`schedule-action-${task.id}`}>Action</label>
                      <select id={`schedule-action-${task.id}`} name="scheduleAction">
                        <option value="POSTPONE">Postpone</option>
                        <option value="SNOOZE">Snooze</option>
                        <option value="RESCHEDULE">Reschedule</option>
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor={`schedule-date-${task.id}`}>New due date</label>
                      <input
                        id={`schedule-date-${task.id}`}
                        name="newDueAt"
                        type="date"
                        min={new Date().toISOString().slice(0, 10)}
                        required
                      />
                    </div>
                    <div className="field field-wide">
                      <label htmlFor={`schedule-reason-${task.id}`}>Reason</label>
                      <input
                        id={`schedule-reason-${task.id}`}
                        name="reason"
                        minLength={3}
                        placeholder="Waiting for a replacement filter"
                        required
                      />
                    </div>
                    <button className="button button-small" disabled={busy}>
                      <CalendarClock size={14} /> Save
                    </button>
                  </form>
                </article>
              ))}
              {!data.tasks.length && (
                <p className="muted-copy">No active maintenance tasks.</p>
              )}
            </div>
          </Card>

          <Card title="Template checklists" icon={<PackageCheck size={19} />}>
            <div className="animated-list">
              {data.templates.map((template) => (
                <article className="operations-item" key={template.id}>
                  <strong>{template.title}</strong>
                  {template.checklist.map((item) => (
                    <div className="operations-check" key={item.id}>
                      <span>• {item.title}</span>
                      {item.required && <small>required</small>}
                      <button
                        className="icon-action"
                        type="button"
                        aria-label={`Delete ${item.title}`}
                        onClick={() =>
                          void post("checklist.delete", {
                            targetType: "TEMPLATE",
                            itemId: item.id,
                          })
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <form
                    className="inline-form"
                    onSubmit={(event) =>
                      void addChecklist(event, "TEMPLATE", template.id)
                    }
                  >
                    <input name="title" placeholder="Add a template step" required />
                    <label>
                      <input name="required" type="checkbox" defaultChecked />
                      Required
                    </label>
                    <button className="button button-small" disabled={busy}>
                      <Plus size={14} /> Add
                    </button>
                  </form>
                </article>
              ))}
              {!data.templates.length && (
                <p className="muted-copy">
                  Create a custom maintenance template first.
                </p>
              )}
            </div>
          </Card>

          <Card title="Advanced recurrence" icon={<RefreshCcw size={19} />}>
            <form className="auth-form" onSubmit={saveRecurrence}>
              <div className="field">
                <label htmlFor="recurrence-target-type">Apply to</label>
                <select id="recurrence-target-type" name="targetType">
                  <option value="TASK">Maintenance task</option>
                  <option value="TEMPLATE">Template</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="recurrence-target">Task or template</label>
                <select id="recurrence-target" name="targetId" required>
                  <optgroup label="Tasks">
                    {data.tasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.title}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Templates">
                    {data.templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.title}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <fieldset className="field">
                <legend>Fixed weekdays</legend>
                <div className="weekday-grid">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (day, index) => (
                      <label key={day}>
                        <input name="weekdays" type="checkbox" value={index} />
                        {day}
                      </label>
                    ),
                  )}
                </div>
              </fieldset>
              <div className="field">
                <label htmlFor="recurrence-months">Months</label>
                <input
                  id="recurrence-months"
                  name="months"
                  placeholder="1, 4, 10"
                />
              </div>
              <div className="field">
                <label htmlFor="recurrence-day">Day of month</label>
                <input id="recurrence-day" name="dayOfMonth" type="number" min="1" max="31" />
              </div>
              <div className="field">
                <label htmlFor="recurrence-season">Season</label>
                <select id="recurrence-season" name="season">
                  <option value="">Any season</option>
                  <option value="SPRING">Spring</option>
                  <option value="SUMMER">Summer</option>
                  <option value="AUTUMN">Autumn</option>
                  <option value="WINTER">Winter</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="recurrence-start">Start</label>
                <input id="recurrence-start" name="startDate" type="date" />
              </div>
              <div className="field">
                <label htmlFor="recurrence-end">End</label>
                <input id="recurrence-end" name="endDate" type="date" />
              </div>
              <div className="field">
                <label htmlFor="recurrence-days">Custom interval in days</label>
                <input id="recurrence-days" name="intervalDays" type="number" min="1" max="3650" />
              </div>
              <button className="button" disabled={busy}>
                Save recurrence rule
              </button>
            </form>
          </Card>

          <Card title="Schedule history" icon={<CalendarClock size={19} />}>
            <div className="animated-list">
              {data.scheduleHistory.map((event) => (
                <div className="dash-task" key={event.id}>
                  <span>
                    <CalendarClock size={16} />
                  </span>
                  <div>
                    <strong>
                      {data.tasks.find((task) => task.id === event.taskId)?.title ??
                        "Archived task"}
                    </strong>
                    <small>
                      {event.action.toLowerCase()} · {event.reason}
                    </small>
                  </div>
                  <time>{formatDate(event.newDueAt)}</time>
                </div>
              ))}
              {!data.scheduleHistory.length && (
                <p className="muted-copy">No schedule changes recorded yet.</p>
              )}
            </div>
          </Card>
        </div>
      )}

      {tab === "attachments" && (
        <div className="dash-grid">
          <Card title="Attach a scanned file" icon={<FileUp size={19} />}>
            <form className="auth-form" onSubmit={uploadAttachment}>
              <div className="field">
                <label htmlFor="attachment-target-type">Attach to</label>
                <select id="attachment-target-type" name="targetType">
                  <option value="MAINTENANCE_RECORD">Completed maintenance</option>
                  <option value="REPAIR">Repair</option>
                  <option value="RENOVATION">Renovation project</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="attachment-target">Record, repair, or project</label>
                <select id="attachment-target" name="targetId" required>
                  <optgroup label="Completed maintenance">
                    {data.maintenanceRecords.map((record) => (
                      <option key={record.id} value={record.id}>
                        {data.tasks.find((task) => task.id === record.taskId)?.title ??
                          "Maintenance"}{" "}
                        · {formatDate(record.completedAt)}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Repairs">
                    {data.repairs.map((repair) => (
                      <option key={repair.id} value={repair.id}>
                        {repair.title}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Renovations">
                    {data.renovations.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div className="field">
                <label htmlFor="attachment-type">Document type</label>
                <select id="attachment-type" name="type">
                  <option value="PHOTO">Photo</option>
                  <option value="INVOICE">Invoice</option>
                  <option value="WARRANTY">Warranty</option>
                  <option value="CERTIFICATE">Certificate</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="MANUAL">Manual</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="attachment-title">Title</label>
                <input id="attachment-title" name="title" required />
              </div>
              <div className="field">
                <label htmlFor="attachment-description">Description</label>
                <textarea id="attachment-description" name="description" />
              </div>
              <div className="field">
                <label htmlFor="attachment-date">Document date</label>
                <input id="attachment-date" name="documentDate" type="date" />
              </div>
              <div className="field">
                <label htmlFor="attachment-file">Photo or document</label>
                <input
                  id="attachment-file"
                  name="file"
                  type="file"
                  accept="image/*,.pdf,.txt,.csv"
                  capture="environment"
                  required
                />
              </div>
              <button className="button" disabled={busy}>
                <Camera size={16} /> Scan and attach
              </button>
            </form>
          </Card>
          <Card title="Document library" icon={<FileUp size={19} />}>
            <p className="muted-copy">
              Every attachment is scanned by ClamAV and remains available in the
              private Documents library.
            </p>
            <div className="animated-list">
              {data.documents.slice(0, 20).map((document) => (
                <div className="dash-task" key={document.id}>
                  <span>
                    <FileUp size={15} />
                  </span>
                  <div>
                    <strong>{document.title}</strong>
                    <small>{document.type.toLowerCase()}</small>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === "providers" && (
        <div className="dash-grid">
          <Card title="Add a service provider" icon={<Users size={19} />}>
            <form
              className="auth-form"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void post("provider.create", {
                  name: value(form, "name"),
                  company: optional(form, "company"),
                  email: optional(form, "email"),
                  phone: optional(form, "phone"),
                  website: optional(form, "website"),
                  specialties: value(form, "specialties")
                    .split(",")
                    .map((entry) => entry.trim())
                    .filter(Boolean),
                  rating: value(form, "rating") ? numberValue(form, "rating") : null,
                  notes: optional(form, "notes"),
                }).then((result) => result && event.currentTarget.reset());
              }}
            >
              <div className="field"><label htmlFor="provider-name">Name</label><input id="provider-name" name="name" required /></div>
              <div className="field"><label htmlFor="provider-company">Company</label><input id="provider-company" name="company" /></div>
              <div className="field"><label htmlFor="provider-email">Email</label><input id="provider-email" name="email" type="email" /></div>
              <div className="field"><label htmlFor="provider-phone">Phone</label><input id="provider-phone" name="phone" /></div>
              <div className="field"><label htmlFor="provider-website">Website</label><input id="provider-website" name="website" type="url" /></div>
              <div className="field"><label htmlFor="provider-specialties">Specialties</label><input id="provider-specialties" name="specialties" placeholder="Heating, plumbing" /></div>
              <div className="field"><label htmlFor="provider-rating">Rating</label><input id="provider-rating" name="rating" type="number" min="1" max="5" /></div>
              <div className="field"><label htmlFor="provider-notes">Notes</label><textarea id="provider-notes" name="notes" /></div>
              <button className="button" disabled={busy}><Plus size={15} /> Add provider</button>
            </form>
          </Card>
          <Card title="Provider directory" icon={<Users size={19} />}>
            <div className="animated-list">
              {data.providers.map((provider) => (
                <article className="operations-item" key={provider.id}>
                  <strong>{provider.name}</strong>
                  <small>{provider.company || provider.specialties.join(" · ") || "General service"}</small>
                  <p>{[provider.email, provider.phone, provider.website].filter(Boolean).join(" · ")}</p>
                  {provider.notes && <p>{provider.notes}</p>}
                  <div className="operations-history">
                    {data.providerInterventions
                      .filter((intervention) => intervention.providerId === provider.id)
                      .slice(0, 5)
                      .map((intervention) => (
                        <small key={intervention.id}>
                          {formatDate(intervention.occurredAt)} · {intervention.notes || "Intervention"}
                          {intervention.cost
                            ? ` · ${currency(intervention.cost, intervention.currency)}`
                            : ""}
                        </small>
                      ))}
                  </div>
                </article>
              ))}
            </div>
          </Card>
          <Card title="Record an intervention" icon={<ClipboardCheck size={19} />}>
            <form
              className="auth-form"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void post("provider.intervention", {
                  providerId: value(form, "providerId"),
                  maintenanceRecordId: optional(form, "maintenanceRecordId"),
                  repairId: optional(form, "repairId"),
                  renovationProjectId: optional(form, "renovationProjectId"),
                  occurredAt: value(form, "occurredAt"),
                  notes: optional(form, "notes"),
                  rating: value(form, "rating") ? numberValue(form, "rating") : null,
                  cost: optional(form, "cost"),
                  currency: value(form, "currency") || "EUR",
                }).then((result) => result && event.currentTarget.reset());
              }}
            >
              <div className="field"><label htmlFor="intervention-provider">Provider</label><select id="intervention-provider" name="providerId" required>{data.providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></div>
              <div className="field"><label htmlFor="intervention-maintenance">Maintenance</label><select id="intervention-maintenance" name="maintenanceRecordId"><option value="">None</option>{data.maintenanceRecords.map((record) => <option key={record.id} value={record.id}>{formatDate(record.completedAt)}</option>)}</select></div>
              <div className="field"><label htmlFor="intervention-repair">Repair</label><select id="intervention-repair" name="repairId"><option value="">None</option>{data.repairs.map((repair) => <option key={repair.id} value={repair.id}>{repair.title}</option>)}</select></div>
              <div className="field"><label htmlFor="intervention-project">Renovation</label><select id="intervention-project" name="renovationProjectId"><option value="">None</option>{data.renovations.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div>
              <div className="field"><label htmlFor="intervention-date">Date</label><input id="intervention-date" name="occurredAt" type="date" required /></div>
              <div className="field"><label htmlFor="intervention-cost">Cost</label><input id="intervention-cost" name="cost" inputMode="decimal" /></div>
              <div className="field"><label htmlFor="intervention-currency">Currency</label><input id="intervention-currency" name="currency" defaultValue="EUR" maxLength={3} /></div>
              <div className="field"><label htmlFor="intervention-rating">Rating</label><input id="intervention-rating" name="rating" type="number" min="1" max="5" /></div>
              <div className="field"><label htmlFor="intervention-notes">Notes</label><textarea id="intervention-notes" name="notes" /></div>
              <button className="button" disabled={busy}>Save intervention</button>
            </form>
          </Card>
        </div>
      )}

      {tab === "inventory" && (
        <div className="dash-grid">
          <Card title="Add a consumable or spare part" icon={<Boxes size={19} />}>
            <form
              className="auth-form"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void post("inventory.create", {
                  assetId: optional(form, "assetId"),
                  name: value(form, "name"),
                  sku: optional(form, "sku"),
                  quantity: numberValue(form, "quantity"),
                  unit: value(form, "unit") || "piece",
                  reorderThreshold: numberValue(form, "reorderThreshold"),
                  location: optional(form, "location"),
                  unitCost: optional(form, "unitCost"),
                  currency: value(form, "currency") || "EUR",
                }).then((result) => result && event.currentTarget.reset());
              }}
            >
              <div className="field"><label htmlFor="stock-name">Item</label><input id="stock-name" name="name" required /></div>
              <div className="field"><label htmlFor="stock-asset">Related asset</label><select id="stock-asset" name="assetId"><option value="">Whole home</option>{data.assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></div>
              <div className="field"><label htmlFor="stock-sku">Reference / SKU</label><input id="stock-sku" name="sku" /></div>
              <div className="field"><label htmlFor="stock-quantity">Quantity</label><input id="stock-quantity" name="quantity" type="number" min="0" defaultValue="1" required /></div>
              <div className="field"><label htmlFor="stock-unit">Unit</label><input id="stock-unit" name="unit" defaultValue="piece" required /></div>
              <div className="field"><label htmlFor="stock-threshold">Reorder threshold</label><input id="stock-threshold" name="reorderThreshold" type="number" min="0" defaultValue="1" required /></div>
              <div className="field"><label htmlFor="stock-location">Storage location</label><input id="stock-location" name="location" /></div>
              <div className="field"><label htmlFor="stock-cost">Unit cost</label><input id="stock-cost" name="unitCost" inputMode="decimal" /></div>
              <div className="field"><label htmlFor="stock-currency">Currency</label><input id="stock-currency" name="currency" defaultValue="EUR" maxLength={3} /></div>
              <button className="button" disabled={busy}><Plus size={15} /> Add stock item</button>
            </form>
          </Card>
          <Card title="Current stock" icon={<Boxes size={19} />}>
            <div className="animated-list">
              {data.inventory.map((item) => {
                const low = item.quantity <= item.reorderThreshold;
                return (
                  <article className={`operations-item ${low ? "is-low" : ""}`} key={item.id}>
                    <div className="dash-card-head">
                      <div><strong>{item.name}</strong><small>{item.sku || item.location || "Household stock"}</small></div>
                      <b>{item.quantity} {item.unit}</b>
                    </div>
                    {low && <p className="form-error">Reorder recommended at {item.reorderThreshold} {item.unit}.</p>}
                    <form
                      className="inline-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const form = new FormData(event.currentTarget);
                        void post("inventory.adjust", {
                          itemId: item.id,
                          delta: numberValue(form, "delta"),
                          reason: value(form, "reason"),
                        }).then((result) => result && event.currentTarget.reset());
                      }}
                    >
                      <input name="delta" type="number" placeholder="+2 or -1" required />
                      <input name="reason" placeholder="Used for boiler service" required />
                      <button className="button button-small" disabled={busy}>Adjust</button>
                    </form>
                  </article>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {tab === "labels" && (
        <div className="label-workspace">
          <Card title="Build a QR label sheet" icon={<Printer size={19} />}>
            <div className="inline-actions">
              <button className="button button-small" type="button" onClick={() => setSelectedLabels(data.assets.map((asset) => asset.id))}>Select all</button>
              <button className="button button-secondary button-small" type="button" onClick={() => setSelectedLabels([])}>Clear</button>
              <label><input type="checkbox" checked={labelDetails} onChange={(event) => setLabelDetails(event.target.checked)} /> Show model and serial</label>
              <button className="button button-small" type="button" disabled={!selectedLabels.length} onClick={() => window.print()}><Printer size={15} /> Print {selectedLabels.length} labels</button>
            </div>
            <div className="asset-picker">
              {data.assets.map((asset) => (
                <label key={asset.id}>
                  <input type="checkbox" checked={selectedLabels.includes(asset.id)} onChange={() => toggleLabel(asset.id)} />
                  {asset.name}
                </label>
              ))}
            </div>
          </Card>
          <section className="qr-label-sheet" aria-label="Printable QR labels">
            {data.assets
              .filter((asset) => selectedLabels.includes(asset.id))
              .map((asset) => (
                <article className="qr-label" key={asset.id}>
                  {/* SVG is generated locally by Homi and the private route keeps auth checks. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/assets/${asset.id}/qr`} alt={`QR code for ${asset.name}`} />
                  <div>
                    <strong>{asset.name}</strong>
                    {labelDetails && (
                      <small>
                        {[asset.brand, asset.model, asset.serialNumber]
                          .filter(Boolean)
                          .join(" · ") || "Homi equipment"}
                      </small>
                    )}
                  </div>
                </article>
              ))}
          </section>
        </div>
      )}

      {tab === "planning" && (
        <div className="dash-grid">
          <Card title="Link an asset replacement" icon={<RefreshCcw size={19} />}>
            <form
              className="auth-form"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void post("replacement.link", {
                  predecessorAssetId: value(form, "predecessorAssetId"),
                  successorAssetId: value(form, "successorAssetId"),
                  replacedAt: value(form, "replacedAt"),
                  notes: optional(form, "notes"),
                }).then((result) => result && event.currentTarget.reset());
              }}
            >
              <div className="field"><label htmlFor="replacement-old">Replaced asset</label><select id="replacement-old" name="predecessorAssetId" required>{data.assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></div>
              <div className="field"><label htmlFor="replacement-new">Successor</label><select id="replacement-new" name="successorAssetId" required>{data.assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></div>
              <div className="field"><label htmlFor="replacement-date">Replacement date</label><input id="replacement-date" name="replacedAt" type="date" required /></div>
              <div className="field"><label htmlFor="replacement-notes">Notes</label><textarea id="replacement-notes" name="notes" /></div>
              <button className="button" disabled={busy}>Link replacement</button>
            </form>
            <div className="animated-list">
              {data.replacements.map((replacement) => (
                <div className="dash-task" key={replacement.id}>
                  <span><RefreshCcw size={15} /></span>
                  <div><strong>{assetName.get(replacement.predecessorAssetId)} → {assetName.get(replacement.successorAssetId)}</strong><small>{replacement.notes || "Replacement history preserved"}</small></div>
                  <time>{formatDate(replacement.replacedAt)}</time>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Annual budgets" icon={<Coins size={19} />}>
            <form
              className="auth-form compact-form"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void post("budget.upsert", {
                  year: numberValue(form, "year"),
                  currency: value(form, "currency") || "EUR",
                  maintenanceBudget: value(form, "maintenanceBudget"),
                  repairBudget: value(form, "repairBudget"),
                  replacementBudget: value(form, "replacementBudget"),
                });
              }}
            >
              <div className="field"><label htmlFor="budget-year">Year</label><input id="budget-year" name="year" type="number" min="2000" max="2200" defaultValue={new Date().getFullYear()} required /></div>
              <div className="field"><label htmlFor="budget-maintenance">Maintenance</label><input id="budget-maintenance" name="maintenanceBudget" defaultValue="0" required /></div>
              <div className="field"><label htmlFor="budget-repair">Repairs</label><input id="budget-repair" name="repairBudget" defaultValue="0" required /></div>
              <div className="field"><label htmlFor="budget-replacement">Replacements</label><input id="budget-replacement" name="replacementBudget" defaultValue="0" required /></div>
              <div className="field"><label htmlFor="budget-currency">Currency</label><input id="budget-currency" name="currency" defaultValue="EUR" maxLength={3} /></div>
              <button className="button button-small" disabled={busy}>Save budget</button>
            </form>
            <div className="budget-table">
              {data.budgets.map((budget) => (
                <article className="operations-item" key={budget.id}>
                  <h3>{budget.year}</h3>
                  <p>Maintenance: {currency(budget.actualMaintenance, budget.currency)} / {currency(budget.maintenanceBudget, budget.currency)}</p>
                  <p>Repairs: {currency(budget.actualRepairs, budget.currency)} / {currency(budget.repairBudget, budget.currency)}</p>
                  <p>Replacement forecast: {currency(budget.forecastReplacement, budget.currency)} / {currency(budget.replacementBudget, budget.currency)}</p>
                </article>
              ))}
            </div>
          </Card>
          <Card title="Replacement forecast" icon={<CalendarClock size={19} />}>
            <div className="animated-list">
              {data.replacementForecast.map((forecast) => (
                <div className="dash-task" key={forecast.year}>
                  <span><Coins size={15} /></span>
                  <div><strong>{forecast.year}</strong><small>Based on installation date, expected lifetime, and purchase value.</small></div>
                  <b>{currency(forecast.amount)}</b>
                </div>
              ))}
              {!data.replacementForecast.length && <p className="muted-copy">Add expected lifetimes and purchase values to assets to generate forecasts.</p>}
            </div>
          </Card>
        </div>
      )}

      {tab === "renovations" && (
        <div className="dash-grid">
          <Card title="Create a renovation project" icon={<Hammer size={19} />}>
            <form
              className="auth-form"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void post("renovation.create", {
                  name: value(form, "name"),
                  description: optional(form, "description"),
                  status: value(form, "status"),
                  startDate: optional(form, "startDate"),
                  targetEndDate: optional(form, "targetEndDate"),
                  budget: optional(form, "budget"),
                  currency: value(form, "currency") || "EUR",
                }).then((result) => result && event.currentTarget.reset());
              }}
            >
              <div className="field"><label htmlFor="project-name">Project</label><input id="project-name" name="name" required /></div>
              <div className="field"><label htmlFor="project-status">Status</label><select id="project-status" name="status"><option value="PLANNING">Planning</option><option value="QUOTING">Quoting</option><option value="IN_PROGRESS">In progress</option><option value="PAUSED">Paused</option><option value="COMPLETED">Completed</option></select></div>
              <div className="field"><label htmlFor="project-start">Start</label><input id="project-start" name="startDate" type="date" /></div>
              <div className="field"><label htmlFor="project-end">Target end</label><input id="project-end" name="targetEndDate" type="date" /></div>
              <div className="field"><label htmlFor="project-budget">Budget</label><input id="project-budget" name="budget" inputMode="decimal" /></div>
              <div className="field"><label htmlFor="project-currency">Currency</label><input id="project-currency" name="currency" defaultValue="EUR" maxLength={3} /></div>
              <div className="field"><label htmlFor="project-description">Description</label><textarea id="project-description" name="description" /></div>
              <button className="button" disabled={busy}><Plus size={15} /> Create project</button>
            </form>
          </Card>
          {data.renovations.map((project) => (
            <Card key={project.id} title={project.name} icon={<Hammer size={19} />}>
              <p>{project.description || "No description."}</p>
              <p><strong>{project.status.toLowerCase().replaceAll("_", " ")}</strong>{project.budget ? ` · ${currency(project.budget, project.currency)}` : ""}{project.targetEndDate ? ` · target ${formatDate(project.targetEndDate)}` : ""}</p>
              <div className="animated-list">
                {data.renovationTasks.filter((task) => task.projectId === project.id).map((task) => (
                  <label className="operations-check" key={task.id}>
                    <input type="checkbox" checked={Boolean(task.completedAt)} onChange={(event) => void post("renovation.task.toggle", { taskId: task.id, completed: event.target.checked })} />
                    <span>{task.title}</span>
                    {task.dueDate && <small>{formatDate(task.dueDate)}</small>}
                  </label>
                ))}
              </div>
              <form
                className="inline-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void post("renovation.task", { projectId: project.id, title: value(form, "title"), dueDate: optional(form, "dueDate"), assignedTo: null }).then((result) => result && event.currentTarget.reset());
                }}
              >
                <input name="title" placeholder="Add project task" required />
                <input name="dueDate" type="date" />
                <button className="button button-small" disabled={busy}>Add task</button>
              </form>
              <div className="quote-list">
                {data.renovationQuotes.filter((quote) => quote.projectId === project.id).map((quote) => (
                  <small key={quote.id}>{quote.description} · {providerName.get(quote.providerId ?? "") || "No provider"} · {currency(quote.amount, quote.currency)} · {quote.status.toLowerCase()}</small>
                ))}
              </div>
              <form
                className="auth-form compact-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void post("renovation.quote", {
                    projectId: project.id,
                    providerId: optional(form, "providerId"),
                    description: value(form, "description"),
                    amount: value(form, "amount"),
                    currency: value(form, "currency") || "EUR",
                    status: value(form, "status"),
                    documentId: optional(form, "documentId"),
                  }).then((result) => result && event.currentTarget.reset());
                }}
              >
                <div className="field"><label>Quote</label><input name="description" required /></div>
                <div className="field"><label>Provider</label><select name="providerId"><option value="">None</option>{data.providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></div>
                <div className="field"><label>Amount</label><input name="amount" required /></div>
                <div className="field"><label>Currency</label><input name="currency" defaultValue="EUR" maxLength={3} /></div>
                <div className="field"><label>Status</label><select name="status"><option value="RECEIVED">Received</option><option value="SHORTLISTED">Shortlisted</option><option value="ACCEPTED">Accepted</option><option value="REJECTED">Rejected</option></select></div>
                <div className="field"><label>Quote document</label><select name="documentId"><option value="">None</option>{data.documents.map((document) => <option key={document.id} value={document.id}>{document.title}</option>)}</select></div>
                <button className="button button-small" disabled={busy}>Add quote</button>
              </form>
            </Card>
          ))}
        </div>
      )}

      {tab === "insurance" && (
        <div className="dash-grid">
          <Card title="Add an insured item" icon={<ShieldCheck size={19} />}>
            <form
              className="auth-form"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void post("insurance.create", {
                  roomId: optional(form, "roomId"),
                  assetId: optional(form, "assetId"),
                  documentId: optional(form, "documentId"),
                  name: value(form, "name"),
                  category: value(form, "category"),
                  quantity: numberValue(form, "quantity"),
                  unitValue: value(form, "unitValue"),
                  currency: value(form, "currency") || "EUR",
                  purchaseDate: optional(form, "purchaseDate"),
                  notes: optional(form, "notes"),
                }).then((result) => result && event.currentTarget.reset());
              }}
            >
              <div className="field"><label htmlFor="insurance-name">Item</label><input id="insurance-name" name="name" required /></div>
              <div className="field"><label htmlFor="insurance-category">Category</label><input id="insurance-category" name="category" placeholder="Electronics" required /></div>
              <div className="field"><label htmlFor="insurance-room">Room</label><select id="insurance-room" name="roomId"><option value="">Whole home</option>{data.rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></div>
              <div className="field"><label htmlFor="insurance-asset">Asset</label><select id="insurance-asset" name="assetId"><option value="">No linked asset</option>{data.assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></div>
              <div className="field"><label htmlFor="insurance-document">Proof of purchase</label><select id="insurance-document" name="documentId"><option value="">No document</option>{data.documents.map((document) => <option key={document.id} value={document.id}>{document.title}</option>)}</select></div>
              <div className="field"><label htmlFor="insurance-quantity">Quantity</label><input id="insurance-quantity" name="quantity" type="number" min="1" defaultValue="1" required /></div>
              <div className="field"><label htmlFor="insurance-value">Unit value</label><input id="insurance-value" name="unitValue" inputMode="decimal" required /></div>
              <div className="field"><label htmlFor="insurance-currency">Currency</label><input id="insurance-currency" name="currency" defaultValue="EUR" maxLength={3} /></div>
              <div className="field"><label htmlFor="insurance-date">Purchase date</label><input id="insurance-date" name="purchaseDate" type="date" /></div>
              <div className="field"><label htmlFor="insurance-notes">Notes</label><textarea id="insurance-notes" name="notes" /></div>
              <button className="button" disabled={busy}><Plus size={15} /> Add to inventory</button>
            </form>
          </Card>
          <Card title="Insurance inventory" icon={<ShieldCheck size={19} />}>
            <div className="inline-actions">
              <a className="button button-small" href={`/api/operations/insurance/pdf?homeId=${homeId}`}><Printer size={15} /> Export full PDF</a>
              {data.rooms.map((room) => (
                <a className="button button-secondary button-small" href={`/api/operations/insurance/pdf?homeId=${homeId}&roomId=${room.id}`} key={room.id}>PDF · {room.name}</a>
              ))}
            </div>
            <div className="insurance-totals">
              {data.insuranceTotals.map((total) => <strong key={total.currency}>{currency(total.total, total.currency)}</strong>)}
            </div>
            <div className="animated-list">
              {data.insuranceItems.map((item) => (
                <article className="operations-item" key={item.id}>
                  <div className="dash-card-head">
                    <div><strong>{item.name}</strong><small>{item.category} · {item.quantity} item(s)</small></div>
                    <b>{currency(Number(item.unitValue) * item.quantity, item.currency)}</b>
                  </div>
                  <p>{item.roomId ? data.rooms.find((room) => room.id === item.roomId)?.name : "Whole home"}{item.assetId ? ` · ${assetName.get(item.assetId)}` : ""}</p>
                  {item.notes && <p>{item.notes}</p>}
                  <button className="button button-secondary button-small" type="button" onClick={() => void post("insurance.delete", { itemId: item.id })}>Remove</button>
                </article>
              ))}
            </div>
          </Card>
        </div>
      )}

      <style>{`
        .operations-item { padding: 16px; border: 1px solid var(--line); border-radius: 18px; display: grid; gap: 10px; }
        .operations-item.is-low { border-color: rgba(211, 116, 52, .5); }
        .operations-item small, .operations-history small, .quote-list small { display: block; color: var(--muted); }
        .operations-check { display: grid; grid-template-columns: auto 1fr auto auto; gap: 10px; align-items: center; min-height: 36px; }
        .operations-check input { width: 17px; height: 17px; }
        .operations-check small { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
        .inline-form { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
        .inline-form > input, .inline-form > select { flex: 1 1 160px; }
        .schedule-form { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 8px; }
        .field-wide { grid-column: 1 / -1; }
        .weekday-grid { display: flex; gap: 8px; flex-wrap: wrap; }
        .weekday-grid label, .asset-picker label { display: flex; gap: 6px; align-items: center; }
        .asset-picker { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-top: 22px; }
        .qr-label-sheet { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 20px; }
        .qr-label { min-height: 120px; border: 1px dashed var(--line); border-radius: 14px; padding: 12px; display: flex; gap: 12px; align-items: center; break-inside: avoid; background: white; color: #111; }
        .qr-label img { width: 92px; height: 92px; }
        .qr-label small { display: block; margin-top: 6px; color: #555; }
        .budget-table, .insurance-totals, .operations-history, .quote-list { display: grid; gap: 10px; margin-top: 16px; }
        .insurance-totals { grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }
        @media (max-width: 900px) { .qr-label-sheet { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 620px) { .qr-label-sheet { grid-template-columns: 1fr; } .schedule-form { grid-template-columns: 1fr; } }
        @media print {
          body * { visibility: hidden !important; }
          .qr-label-sheet, .qr-label-sheet * { visibility: visible !important; }
          .qr-label-sheet { position: absolute; inset: 0; margin: 0; padding: 10mm; display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
          .qr-label { border: 1px solid #bbb; border-radius: 0; min-height: 32mm; }
        }
      `}</style>
    </main>
  );
}

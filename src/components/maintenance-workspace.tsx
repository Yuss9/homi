"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Archive,
  CalendarCheck,
  Check,
  Clock3,
  LoaderCircle,
  Pencil,
  Plus,
  Wrench,
  X,
} from "lucide-react";
import { ActionFeedback } from "@/src/components/action-feedback";
import { isDue } from "@/src/features/maintenance/recurrence";

type Home = { id: string; name: string };
type Asset = { id: string; name: string };
type Task = {
  id: string;
  assetId?: string | null;
  title: string;
  description?: string | null;
  priority: string;
  frequencyType: string;
  frequencyInterval: number;
  nextDueAt: string;
  estimatedDurationMinutes?: number | null;
};

const sortTasks = (tasks: Task[]) =>
  [...tasks].sort(
    (first, second) =>
      new Date(first.nextDueAt).getTime() -
      new Date(second.nextDueAt).getTime(),
  );

const optional = (form: FormData, name: string) => {
  const value = String(form.get(name) ?? "").trim();
  return value || null;
};

export function MaintenanceWorkspace() {
  const [homes, setHomes] = useState<Home[]>([]);
  const [homeId, setHomeId] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [editingTaskId, setEditingTaskId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [newTaskId, setNewTaskId] = useState("");
  const [completingId, setCompletingId] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    void fetch("/api/homes")
      .then((response) => response.json())
      .then((payload) => {
        const next = payload.homes ?? [];
        setHomes(next);
        setHomeId(next[0]?.id ?? "");
      });
  }, []);

  async function loadTasks(selectedHomeId = homeId) {
    if (!selectedHomeId) {
      setTasks([]);
      return;
    }
    const response = await fetch(`/api/tasks?homeId=${selectedHomeId}`);
    const payload = await response.json();
    setTasks(payload.tasks ?? []);
  }

  useEffect(() => {
    if (!homeId) return;
    setEditingTaskId("");
    void Promise.all([
      fetch(`/api/tasks?homeId=${homeId}`).then((response) => response.json()),
      fetch(`/api/assets?homeId=${homeId}`).then((response) => response.json()),
    ]).then(([taskPayload, assetPayload]) => {
      setTasks(taskPayload.tasks ?? []);
      setAssets(assetPayload.assets ?? []);
    });
  }, [homeId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      const form = new FormData(formElement);
      const duration = optional(form, "estimatedDurationMinutes");
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          homeId,
          assetId: optional(form, "assetId"),
          title: form.get("title"),
          description: optional(form, "description") ?? undefined,
          frequencyType: form.get("frequencyType"),
          frequencyInterval: Number(form.get("frequencyInterval")),
          nextDueAt: form.get("nextDueAt"),
          priority: form.get("priority"),
          estimatedDurationMinutes: duration ? Number(duration) : undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Could not create the task.");
        return;
      }
      formElement.reset();
      setTasks((current) => sortTasks([...current, payload.task]));
      setNewTaskId(payload.task.id);
      setMessage(`${payload.task.title} was added to your schedule.`);
    } finally {
      setSubmitting(false);
    }
  }

  async function saveTask(event: FormEvent<HTMLFormElement>, task: Task) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const duration = optional(form, "estimatedDurationMinutes");
    const response = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        assetId: optional(form, "assetId"),
        title: form.get("title"),
        description: optional(form, "description"),
        frequencyType: form.get("frequencyType"),
        frequencyInterval: Number(form.get("frequencyInterval")),
        nextDueAt: form.get("nextDueAt"),
        priority: form.get("priority"),
        estimatedDurationMinutes: duration ? Number(duration) : null,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message ?? "Could not update the task.");
      return;
    }
    setEditingTaskId("");
    setMessage("Maintenance task updated.");
    await loadTasks();
  }

  async function archiveTask(task: Task) {
    const response = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message ?? "Could not archive the task.");
      return;
    }
    setEditingTaskId("");
    setMessage(`${task.title} was archived.`);
    await loadTasks();
  }

  async function complete(task: Task) {
    setError("");
    setMessage("");
    setCompletingId(task.id);
    const response = await fetch(`/api/tasks/${task.id}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        completedAt: new Date(),
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setCompletingId("");
      setError(payload.error?.message ?? "Could not complete the task.");
      return;
    }
    setMessage(
      payload.nextDueAt
        ? `Completed. Next due ${new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(payload.nextDueAt))}.`
        : `${task.title} is complete.`,
    );
    await new Promise((resolve) => setTimeout(resolve, 650));
    await loadTasks();
    setCompletingId("");
  }

  return (
    <main id="main" className="app-main">
      <div className="dashboard-head">
        <div><small>Care schedule</small><h1>Maintenance</h1><p>Create, update, complete, and archive recurring home care.</p></div>
        <select aria-label="Selected home" value={homeId} onChange={(event) => setHomeId(event.target.value)}>{homes.map((home) => <option key={home.id} value={home.id}>{home.name}</option>)}</select>
      </div>

      <ActionFeedback error={error} message={message} />

      <div className="dash-grid" style={{ marginTop: 32 }}>
        <section className="dash-card">
          <div className="dash-card-head"><h2>Scheduled</h2><CalendarCheck size={19} /></div>
          <div className="animated-list">
            {tasks.map((task) => {
              if (editingTaskId === task.id) {
                return (
                  <form className="auth-form compact-form" key={task.id} onSubmit={(event) => void saveTask(event, task)}>
                    <div className="dash-card-head"><h2>Edit task</h2><button className="icon-action" type="button" aria-label="Cancel task editing" onClick={() => setEditingTaskId("")}><X size={16} /></button></div>
                    <div className="field"><label htmlFor={`task-title-${task.id}`}>Task</label><input id={`task-title-${task.id}`} name="title" defaultValue={task.title} required /></div>
                    <div className="field"><label htmlFor={`task-asset-${task.id}`}>Asset</label><select id={`task-asset-${task.id}`} name="assetId" defaultValue={task.assetId ?? ""}><option value="">Whole home</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></div>
                    <div className="field"><label htmlFor={`task-description-${task.id}`}>Description</label><textarea id={`task-description-${task.id}`} name="description" defaultValue={task.description ?? ""} /></div>
                    <div className="field"><label htmlFor={`task-due-${task.id}`}>Next due</label><input id={`task-due-${task.id}`} name="nextDueAt" type="date" defaultValue={task.nextDueAt.slice(0, 10)} required /></div>
                    <div className="field"><label htmlFor={`task-frequency-${task.id}`}>Frequency</label><select id={`task-frequency-${task.id}`} name="frequencyType" defaultValue={task.frequencyType}><option value="ONCE">One time</option><option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option><option value="YEARLY">Yearly</option><option value="CUSTOM">Custom</option></select></div>
                    <div className="field"><label htmlFor={`task-interval-${task.id}`}>Every</label><input id={`task-interval-${task.id}`} name="frequencyInterval" type="number" min="1" max="3650" defaultValue={task.frequencyInterval} required /></div>
                    <div className="field"><label htmlFor={`task-priority-${task.id}`}>Priority</label><select id={`task-priority-${task.id}`} name="priority" defaultValue={task.priority}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></div>
                    <div className="field"><label htmlFor={`task-duration-${task.id}`}>Estimated minutes</label><input id={`task-duration-${task.id}`} name="estimatedDurationMinutes" type="number" min="1" max="1440" defaultValue={task.estimatedDurationMinutes ?? ""} /></div>
                    <div className="inline-actions"><button className="button button-small" type="submit"><Check size={15} />Save</button><button className="button button-secondary button-small" type="button" onClick={() => void archiveTask(task)}><Archive size={15} />Archive</button></div>
                  </form>
                );
              }

              const completing = completingId === task.id;
              const taskDue = isDue(new Date(task.nextDueAt), new Date(now));
              const dueLabel = new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(task.nextDueAt));
              return (
                <div className={`dash-task has-action ${newTaskId === task.id ? "is-new" : ""} ${completing ? "is-completing" : ""}`} key={task.id}>
                  <span>{completing ? <Check size={17} /> : <Wrench size={17} />}</span>
                  <div><strong>{task.title}</strong><small>{task.frequencyType.toLowerCase()} · {task.priority.toLowerCase()}{task.estimatedDurationMinutes ? ` · ${task.estimatedDurationMinutes} min` : ""}</small></div>
                  <time>{new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(task.nextDueAt))}</time>
                  <button className="icon-action" type="button" aria-label={`Edit ${task.title}`} onClick={() => setEditingTaskId(task.id)}><Pencil size={16} /></button>
                  {taskDue ? <button className={`icon-action ${completing ? "is-processing" : ""}`} aria-label={`Complete ${task.title}`} disabled={Boolean(completingId)} onClick={() => void complete(task)}><Check size={17} /></button> : <div className="task-not-due" title={`Available on ${dueLabel}`} aria-label={`Cannot complete before ${dueLabel}`}><Clock3 size={15} /><span>Not due</span></div>}
                </div>
              );
            })}
          </div>
          {!tasks.length && <p className="muted-copy">Your maintenance schedule is clear.</p>}
        </section>

        <form className={`dash-card auth-form ${submitting ? "is-submitting" : ""}`} onSubmit={addTask}>
          <div className="dash-card-head"><h2>Create a task</h2><Plus size={19} /></div>
          <div className="field"><label htmlFor="task-title">Task</label><input id="task-title" name="title" required disabled={!homeId || submitting} placeholder="Clean dishwasher filter" /></div>
          <div className="field"><label htmlFor="task-asset">Asset</label><select id="task-asset" name="assetId" disabled={submitting}><option value="">Whole home</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></div>
          <div className="field"><label htmlFor="task-description">Description</label><textarea id="task-description" name="description" disabled={submitting} /></div>
          <div className="field"><label htmlFor="task-due">First due date</label><input id="task-due" name="nextDueAt" type="date" required disabled={submitting} /></div>
          <div className="field"><label htmlFor="task-frequency">Frequency</label><select id="task-frequency" name="frequencyType" disabled={submitting}><option value="ONCE">One time</option><option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option><option value="YEARLY">Yearly</option><option value="CUSTOM">Custom</option></select></div>
          <div className="field"><label htmlFor="task-interval">Every</label><input id="task-interval" name="frequencyInterval" type="number" min="1" max="3650" defaultValue="1" required disabled={submitting} /></div>
          <div className="field"><label htmlFor="task-priority">Priority</label><select id="task-priority" name="priority" defaultValue="MEDIUM" disabled={submitting}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></div>
          <div className="field"><label htmlFor="task-duration">Estimated minutes</label><input id="task-duration" name="estimatedDurationMinutes" type="number" min="1" max="1440" disabled={submitting} /></div>
          <button className="button" disabled={!homeId || submitting} type="submit">{submitting ? <LoaderCircle className="button-spinner" size={17} /> : <Plus size={17} />}{submitting ? "Scheduling…" : "Schedule task"}</button>
        </form>
      </div>
    </main>
  );
}

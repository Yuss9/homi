"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  CalendarCheck,
  Check,
  Clock3,
  LoaderCircle,
  Plus,
  Wrench,
} from "lucide-react";
import { ActionFeedback } from "@/src/components/action-feedback";
import { isDue } from "@/src/features/maintenance/recurrence";

type Home = { id: string; name: string };
type Task = {
  id: string;
  title: string;
  priority: string;
  frequencyType: string;
  nextDueAt: string;
};

const sortTasks = (tasks: Task[]) =>
  [...tasks].sort(
    (first, second) =>
      new Date(first.nextDueAt).getTime() -
      new Date(second.nextDueAt).getTime(),
  );

export function MaintenanceWorkspace() {
  const [homes, setHomes] = useState<Home[]>([]);
  const [homeId, setHomeId] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
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
    if (!selectedHomeId) return setTasks([]);
    const response = await fetch(`/api/tasks?homeId=${selectedHomeId}`);
    const payload = await response.json();
    setTasks(payload.tasks ?? []);
  }

  useEffect(() => {
    if (!homeId) return;
    void fetch(`/api/tasks?homeId=${homeId}`)
      .then((response) => response.json())
      .then((payload) => setTasks(payload.tasks ?? []));
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
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          homeId,
          title: form.get("title"),
          frequencyType: form.get("frequencyType"),
          frequencyInterval: Number(form.get("frequencyInterval")),
          nextDueAt: form.get("nextDueAt"),
          priority: form.get("priority"),
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
        ? `Completed. Next due ${new Intl.DateTimeFormat("en", {
            dateStyle: "medium",
          }).format(new Date(payload.nextDueAt))}.`
        : `${task.title} is complete.`,
    );

    await new Promise((resolve) => setTimeout(resolve, 650));
    await loadTasks();
    setCompletingId("");
  }

  return (
    <main id="main" className="app-main">
      <div className="dashboard-head">
        <div>
          <small>Care schedule</small>
          <h1>Maintenance</h1>
          <p>One calm view of what is due and what comes next.</p>
        </div>
        <select
          aria-label="Selected home"
          value={homeId}
          onChange={(event) => setHomeId(event.target.value)}
        >
          {homes.map((home) => (
            <option key={home.id} value={home.id}>
              {home.name}
            </option>
          ))}
        </select>
      </div>

      <ActionFeedback error={error} message={message} />

      <div className="dash-grid" style={{ marginTop: 32 }}>
        <section className="dash-card">
          <div className="dash-card-head">
            <h2>Scheduled</h2>
            <CalendarCheck size={19} />
          </div>
          <div className="animated-list">
            {tasks.map((task) => {
              const completing = completingId === task.id;
              const taskDue = isDue(new Date(task.nextDueAt), new Date(now));
              const dueLabel = new Intl.DateTimeFormat("en", {
                dateStyle: "medium",
              }).format(new Date(task.nextDueAt));
              return (
                <div
                  className={`dash-task has-action ${
                    newTaskId === task.id ? "is-new" : ""
                  } ${completing ? "is-completing" : ""}`}
                  key={task.id}
                >
                  <span>
                    {completing ? <Check size={17} /> : <Wrench size={17} />}
                  </span>
                  <div>
                    <strong>{task.title}</strong>
                    <small>
                      {task.frequencyType.toLowerCase()} ·{" "}
                      {task.priority.toLowerCase()}
                    </small>
                  </div>
                  <time>
                    {new Intl.DateTimeFormat("en", {
                      month: "short",
                      day: "numeric",
                    }).format(new Date(task.nextDueAt))}
                  </time>
                  {taskDue ? (
                    <button
                      className={`icon-action ${
                        completing ? "is-processing" : ""
                      }`}
                      aria-label={`Complete ${task.title}`}
                      disabled={Boolean(completingId)}
                      onClick={() => void complete(task)}
                    >
                      <Check size={17} />
                    </button>
                  ) : (
                    <div
                      className="task-not-due"
                      title={`Available on ${dueLabel}`}
                      aria-label={`Cannot complete before ${dueLabel}`}
                    >
                      <Clock3 size={15} />
                      <span>Not due</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {!tasks.length && (
            <p className="muted-copy">Your maintenance schedule is clear.</p>
          )}
        </section>

        <form
          className={`dash-card auth-form ${submitting ? "is-submitting" : ""}`}
          onSubmit={addTask}
        >
          <div className="dash-card-head">
            <h2>Create a task</h2>
            <Plus size={19} />
          </div>
          <div className="field">
            <label htmlFor="task-title">Task</label>
            <input
              id="task-title"
              name="title"
              required
              disabled={!homeId || submitting}
              placeholder="Clean dishwasher filter"
            />
          </div>
          <div className="field">
            <label htmlFor="task-due">First due date</label>
            <input
              id="task-due"
              name="nextDueAt"
              type="date"
              required
              disabled={submitting}
            />
          </div>
          <div className="field">
            <label htmlFor="task-frequency">Frequency</label>
            <select
              id="task-frequency"
              name="frequencyType"
              disabled={submitting}
            >
              <option value="ONCE">One time</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
              <option value="YEARLY">Yearly</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="task-interval">Every</label>
            <input
              id="task-interval"
              name="frequencyInterval"
              type="number"
              min="1"
              max="3650"
              defaultValue="1"
              required
              disabled={submitting}
            />
          </div>
          <div className="field">
            <label htmlFor="task-priority">Priority</label>
            <select
              id="task-priority"
              name="priority"
              defaultValue="MEDIUM"
              disabled={submitting}
            >
              <option>LOW</option>
              <option>MEDIUM</option>
              <option>HIGH</option>
              <option>CRITICAL</option>
            </select>
          </div>
          <button
            className="button"
            disabled={!homeId || submitting}
            type="submit"
          >
            {submitting ? (
              <LoaderCircle className="button-spinner" size={17} />
            ) : (
              <Plus size={17} />
            )}
            {submitting ? "Scheduling…" : "Schedule task"}
          </button>
        </form>
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Bell,
  Check,
  Clock3,
  ExternalLink,
  Search,
  Trash2,
  Undo2,
} from "lucide-react";

type Notice = {
  id: string;
  type: string;
  title: string;
  message: string;
  actionUrl?: string | null;
  readAt?: string | null;
  snoozedUntil?: string | null;
  isSnoozed?: boolean;
  createdAt: string;
};

const states = ["ACTIVE", "UNREAD", "READ", "SNOOZED", "ALL"] as const;

export function NotificationWorkspace() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [state, setState] = useState<(typeof states)[number]>("ACTIVE");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ state });
    if (query.trim()) params.set("q", query.trim());
    if (type) params.set("type", type);
    const response = await fetch(`/api/notifications?${params}`);
    const payload = await response.json();
    setNotices(payload.notifications ?? []);
    setTypes(payload.types ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timer);
  }, [query, type, state]);

  async function mutate(payload: Record<string, unknown>) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    await load();
  }

  function snoozeTomorrow(notificationId: string) {
    const until = new Date();
    until.setDate(until.getDate() + 1);
    until.setHours(8, 0, 0, 0);
    return mutate({ action: "SNOOZE", notificationId, until });
  }

  return (
    <main id="main" className="app-main">
      <div className="dashboard-head">
        <div>
          <small>Attention, without noise</small>
          <h1>Notifications</h1>
          <p>Open the related record, filter updates, or snooze them until tomorrow.</p>
        </div>
        <button
          className="button"
          onClick={() => void mutate({ action: "READ_ALL" })}
        >
          <Check size={16} />
          Mark all as read
        </button>
      </div>

      <section className="dash-card notification-controls">
        <label className="search-field">
          <Search size={17} />
          <span className="sr-only">Search notifications</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search notifications"
          />
        </label>
        <select
          aria-label="Notification type"
          value={type}
          onChange={(event) => setType(event.target.value)}
        >
          <option value="">All types</option>
          {types.map((item) => (
            <option value={item} key={item}>
              {item.replaceAll("_", " ").toLowerCase()}
            </option>
          ))}
        </select>
        <div className="filter-pills" aria-label="Notification state">
          {states.map((item) => (
            <button
              className={state === item ? "active" : ""}
              type="button"
              key={item}
              onClick={() => setState(item)}
            >
              {item.toLowerCase()}
            </button>
          ))}
        </div>
      </section>

      <section className="dash-card resource-list-card">
        {notices.map((notice) => (
          <article
            className={`dash-task ${notice.readAt ? "is-read" : ""} ${
              notice.isSnoozed ? "is-snoozed" : ""
            }`}
            key={notice.id}
          >
            <span>
              <Bell size={16} />
            </span>
            <div>
              {notice.actionUrl ? (
                <Link className="notification-link" href={notice.actionUrl}>
                  <strong>{notice.title}</strong>
                  <ExternalLink size={14} />
                </Link>
              ) : (
                <strong>{notice.title}</strong>
              )}
              <small>{notice.message}</small>
              {notice.snoozedUntil && notice.isSnoozed && (
                <small>
                  Snoozed until{" "}
                  {new Intl.DateTimeFormat(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(notice.snoozedUntil))}
                </small>
              )}
            </div>
            <time>
              {new Intl.DateTimeFormat(undefined, {
                dateStyle: "medium",
              }).format(new Date(notice.createdAt))}
            </time>
            {!notice.readAt && !notice.isSnoozed && (
              <button
                className="icon-action"
                aria-label={`Mark ${notice.title} as read`}
                onClick={() =>
                  void mutate({ action: "READ", notificationId: notice.id })
                }
              >
                <Check size={16} />
              </button>
            )}
            {notice.isSnoozed ? (
              <button
                className="icon-action"
                aria-label={`Unsnooze ${notice.title}`}
                onClick={() =>
                  void mutate({ action: "UNSNOOZE", notificationId: notice.id })
                }
              >
                <Undo2 size={16} />
              </button>
            ) : (
              <button
                className="icon-action"
                aria-label={`Snooze ${notice.title} until tomorrow`}
                onClick={() => void snoozeTomorrow(notice.id)}
              >
                <Clock3 size={16} />
              </button>
            )}
            <button
              className="icon-action"
              aria-label={`Dismiss ${notice.title}`}
              onClick={() =>
                void mutate({ action: "DISMISS", notificationId: notice.id })
              }
            >
              <Trash2 size={16} />
            </button>
          </article>
        ))}
        {!loading && !notices.length && (
          <div className="empty-state">
            <div>
              <span>
                <Bell size={24} />
              </span>
              <h2>You’re all caught up</h2>
              <p>No notifications match the current filters.</p>
            </div>
          </div>
        )}
        {loading && <p className="muted-copy">Loading notifications…</p>}
      </section>
    </main>
  );
}

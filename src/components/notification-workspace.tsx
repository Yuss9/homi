"use client";

import { useEffect, useState } from "react";
import { Bell, Check, Trash2 } from "lucide-react";

type Notice = {
  id: string;
  title: string;
  message: string;
  actionUrl?: string | null;
  readAt?: string | null;
  createdAt: string;
};

export function NotificationWorkspace() {
  const [notices, setNotices] = useState<Notice[]>([]);
  async function load() {
    const response = await fetch("/api/notifications");
    const payload = await response.json();
    setNotices(payload.notifications ?? []);
  }
  useEffect(() => {
    void fetch("/api/notifications")
      .then((response) => response.json())
      .then((payload) => setNotices(payload.notifications ?? []));
  }, []);

  async function mutate(action: "READ" | "DISMISS" | "READ_ALL", notificationId?: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, notificationId }),
    });
    await load();
  }

  return (
    <main id="main" className="app-main">
      <div className="dashboard-head">
        <div><small>Attention, without noise</small><h1>Notifications</h1><p>Maintenance, warranty, invitation, and repair updates.</p></div>
        <button className="button" onClick={() => void mutate("READ_ALL")}><Check size={16} />Mark all as read</button>
      </div>
      <section className="dash-card resource-list-card">
        {notices.map((notice) => (
          <article className={`dash-task ${notice.readAt ? "is-read" : ""}`} key={notice.id}>
            <span><Bell size={16} /></span>
            <div><strong>{notice.title}</strong><small>{notice.message}</small></div>
            <time>{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(notice.createdAt))}</time>
            {!notice.readAt && <button className="icon-action" aria-label={`Mark ${notice.title} as read`} onClick={() => void mutate("READ", notice.id)}><Check size={16} /></button>}
            <button className="icon-action" aria-label={`Dismiss ${notice.title}`} onClick={() => void mutate("DISMISS", notice.id)}><Trash2 size={16} /></button>
          </article>
        ))}
        {!notices.length && <div className="empty-state"><div><span><Bell size={24} /></span><h2>You’re all caught up</h2><p>New home updates will appear here.</p></div></div>}
      </section>
    </main>
  );
}

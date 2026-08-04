"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileClock,
  RotateCcw,
  ShieldAlert,
  Wrench,
} from "lucide-react";

type Home = { id: string; name: string };
type CalendarEvent = {
  id: string;
  type:
    | "MAINTENANCE"
    | "COMPLETED"
    | "REPAIR"
    | "REPAIR_DATE"
    | "WARRANTY"
    | "DOCUMENT";
  title: string;
  date: string;
  detail: string;
  href: string;
};

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function startOfCalendar(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const weekday = (first.getDay() + 6) % 7;
  first.setDate(first.getDate() - weekday);
  return first;
}

function dateKey(date: Date | string) {
  if (typeof date === "string") return date.slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthRange(month: Date) {
  const start = startOfCalendar(month);
  const end = new Date(start);
  end.setDate(end.getDate() + 42);
  return { start, end };
}

function eventIcon(type: CalendarEvent["type"]) {
  switch (type) {
    case "COMPLETED":
      return CheckCircle2;
    case "REPAIR":
    case "REPAIR_DATE":
      return Wrench;
    case "WARRANTY":
      return ShieldAlert;
    case "DOCUMENT":
      return FileClock;
    default:
      return RotateCcw;
  }
}

export function CalendarWorkspace() {
  const [homes, setHomes] = useState<Home[]>([]);
  const [homeId, setHomeId] = useState("");
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetch("/api/homes")
      .then((response) => response.json())
      .then((payload) => {
        const next = payload.homes ?? [];
        setHomes(next);
        setHomeId(next[0]?.id ?? "");
      });
  }, []);

  useEffect(() => {
    if (!homeId) return;
    const { start, end } = monthRange(month);
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      void fetch(
        `/api/calendar?homeId=${homeId}&start=${start.toISOString()}&end=${end.toISOString()}`,
        { signal: controller.signal },
      )
        .then((response) => response.json())
        .then((payload) => setEvents(payload.events ?? []))
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setEvents([]);
        })
        .finally(() => setLoading(false));
    }, 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [homeId, month]);

  const days = useMemo(() => {
    const start = startOfCalendar(month);
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [month]);
  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = dateKey(event.date);
      map.set(key, [...(map.get(key) ?? []), event]);
    }
    return map;
  }, [events]);
  const selectedEvents = byDate.get(selectedDate) ?? [];
  const today = dateKey(new Date());

  function moveMonth(offset: number) {
    setMonth((current) =>
      new Date(current.getFullYear(), current.getMonth() + offset, 1),
    );
  }

  function goToday() {
    const now = new Date();
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(dateKey(now));
  }

  return (
    <main id="main" className="app-main">
      <div className="dashboard-head">
        <div>
          <small>Everything with a date</small>
          <h1>Calendar</h1>
          <p>
            Maintenance, completed work, repairs, warranties, and document
            expirations in one household timeline.
          </p>
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

      <div className="calendar-shell">
        <section className="calendar-card">
          <div className="calendar-toolbar">
            <div>
              <small>{events.length} events in view</small>
              <h2>
                {new Intl.DateTimeFormat("en", {
                  month: "long",
                  year: "numeric",
                }).format(month)}
              </h2>
            </div>
            <div className="inline-actions">
              <button
                className="button button-secondary button-small"
                type="button"
                onClick={goToday}
              >
                Today
              </button>
              <button
                className="icon-action"
                type="button"
                aria-label="Previous month"
                onClick={() => moveMonth(-1)}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                className="icon-action"
                type="button"
                aria-label="Next month"
                onClick={() => moveMonth(1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="calendar-weekdays" aria-hidden="true">
            {weekDays.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div
            className={`calendar-grid ${loading ? "is-loading" : ""}`}
            aria-label="Household calendar"
          >
            {days.map((day) => {
              const key = dateKey(day);
              const dayEvents = byDate.get(key) ?? [];
              const outside = day.getMonth() !== month.getMonth();
              return (
                <button
                  className={`calendar-day ${outside ? "outside" : ""} ${
                    key === today ? "today" : ""
                  } ${key === selectedDate ? "selected" : ""}`}
                  key={key}
                  type="button"
                  onClick={() => setSelectedDate(key)}
                  aria-label={`${new Intl.DateTimeFormat("en", {
                    dateStyle: "full",
                  }).format(day)}, ${dayEvents.length} events`}
                >
                  <span>{day.getDate()}</span>
                  <div className="calendar-day-events">
                    {dayEvents.slice(0, 3).map((event) => (
                      <i data-event={event.type.toLowerCase()} key={event.id}>
                        {event.title}
                      </i>
                    ))}
                    {dayEvents.length > 3 && (
                      <small>+{dayEvents.length - 3} more</small>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="calendar-agenda dash-card">
          <div className="dash-card-head">
            <div>
              <small>Selected day</small>
              <h2>
                {new Intl.DateTimeFormat("en", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                }).format(new Date(`${selectedDate}T12:00:00`))}
              </h2>
            </div>
            <CalendarDays size={18} />
          </div>
          <div className="animated-list">
            {selectedEvents.map((event) => {
              const Icon = eventIcon(event.type);
              return (
                <Link className="agenda-event" href={event.href} key={event.id}>
                  <span data-event={event.type.toLowerCase()}>
                    <Icon size={16} />
                  </span>
                  <div>
                    <strong>{event.title}</strong>
                    <small>{event.detail}</small>
                  </div>
                </Link>
              );
            })}
          </div>
          {!selectedEvents.length && (
            <div className="empty-state compact">
              <CalendarDays size={21} />
              <p>Nothing planned for this day.</p>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

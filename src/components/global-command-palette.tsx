"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Coins,
  FileText,
  Home,
  Library,
  LoaderCircle,
  Package,
  Search,
  Users,
  Wrench,
  X,
} from "lucide-react";

type Result = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  href: string;
};

const quickLinks = [
  { title: "Calendar", subtitle: "See every dated household event", href: "/calendar", icon: CalendarDays },
  { title: "Maintenance library", subtitle: "Use a reusable care routine", href: "/maintenance/templates", icon: Library },
  { title: "Cost insights", subtitle: "Review maintenance and repair spend", href: "/costs", icon: Coins },
  { title: "Household", subtitle: "Manage people and invitations", href: "/members", icon: Users },
];

function resultIcon(type: string) {
  if (type === "Asset") return Package;
  if (type === "Maintenance" || type === "Template") return Wrench;
  if (type === "Repair") return Wrench;
  if (type === "Document") return FileText;
  if (type === "Household") return Users;
  return Home;
}

export function GlobalCommandPalette({ selectedHomeId }: { selectedHomeId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    const needle = query.trim();
    if (!open || needle.length < 2 || !selectedHomeId) {
      const timer = window.setTimeout(() => {
        setResults([]);
        setLoading(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      void fetch(
        `/api/search?homeId=${selectedHomeId}&q=${encodeURIComponent(needle)}`,
        { signal: controller.signal },
      )
        .then((response) => response.json())
        .then((payload) => {
          setResults(payload.results ?? []);
          setActiveIndex(0);
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setResults([]);
        })
        .finally(() => setLoading(false));
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, query, selectedHomeId]);

  function close() {
    setOpen(false);
    setQuery("");
    setResults([]);
    setActiveIndex(0);
  }

  function navigate(href: string) {
    close();
    router.push(href);
  }

  const displayed = query.trim().length >= 2 ? results : quickLinks;

  return (
    <>
      <button
        className="global-search-trigger"
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search Homi"
      >
        <Search size={16} />
        <span>Search</span>
        <kbd>⌘ K</kbd>
      </button>
      {open && (
        <div
          className="modal-backdrop command-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div
            className="command-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Search Homi"
          >
            <div className="command-input-row">
              {loading ? (
                <LoaderCircle className="button-spinner" size={19} />
              ) : (
                <Search size={19} />
              )}
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setActiveIndex((current) =>
                      Math.min(current + 1, Math.max(displayed.length - 1, 0)),
                    );
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setActiveIndex((current) => Math.max(current - 1, 0));
                  }
                  if (event.key === "Enter" && displayed[activeIndex]) {
                    event.preventDefault();
                    navigate(displayed[activeIndex]!.href);
                  }
                }}
                aria-label="Search homes, assets, tasks and documents"
                placeholder="Search your home…"
              />
              <button
                className="icon-action"
                type="button"
                aria-label="Close search"
                onClick={close}
              >
                <X size={17} />
              </button>
            </div>
            <div className="command-results" role="listbox">
              {query.trim().length < 2 && (
                <small className="command-section-label">Quick actions</small>
              )}
              {displayed.map((item, index) => {
                const Icon = "type" in item ? resultIcon(item.type) : item.icon;
                return (
                  <button
                    className={index === activeIndex ? "active" : ""}
                    key={"id" in item ? item.id : item.href}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => navigate(item.href)}
                  >
                    <span>
                      <Icon size={17} />
                    </span>
                    <div>
                      <strong>{item.title}</strong>
                      <small>{item.subtitle}</small>
                    </div>
                    {"type" in item && <b>{item.type}</b>}
                  </button>
                );
              })}
              {query.trim().length >= 2 && !loading && !results.length && (
                <div className="empty-state compact">
                  <Search size={21} />
                  <p>No matching household records.</p>
                </div>
              )}
            </div>
            <footer className="command-footer">
              <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
              <span><kbd>↵</kbd> Open</span>
              <span><kbd>esc</kbd> Close</span>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}

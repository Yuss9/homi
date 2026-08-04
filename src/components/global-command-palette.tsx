"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  CalendarDays,
  Camera,
  Coins,
  FileText,
  Home,
  Library,
  LoaderCircle,
  Package,
  Plus,
  Search,
  Trash2,
  Users,
  Wrench,
  X,
} from "lucide-react";

type Result = {
  id: string;
  type: string;
  status: string;
  title: string;
  subtitle: string;
  href: string;
};

type QuickLink = {
  title: string;
  subtitle: string;
  href: string;
  icon: typeof Home;
};

type SavedSearch = {
  id: string;
  name: string;
  query: string;
  filters: { types?: string[]; statuses?: string[] };
};

type Facet = { value: string; count: number };

const quickLinks: QuickLink[] = [
  {
    title: "Scan equipment",
    subtitle: "Find or pair an asset with the camera",
    href: "/scan",
    icon: Camera,
  },
  {
    title: "Create maintenance",
    subtitle: "Schedule a new household task",
    href: "/maintenance?new=1",
    icon: Plus,
  },
  {
    title: "Declare a repair",
    subtitle: "Record a new issue",
    href: "/repairs?new=1",
    icon: Wrench,
  },
  {
    title: "Calendar",
    subtitle: "See every dated household event",
    href: "/calendar",
    icon: CalendarDays,
  },
  {
    title: "Maintenance library",
    subtitle: "Use a reusable care routine",
    href: "/maintenance/templates",
    icon: Library,
  },
  {
    title: "Cost insights",
    subtitle: "Review maintenance and repair spend",
    href: "/costs",
    icon: Coins,
  },
  {
    title: "Household",
    subtitle: "Manage people and invitations",
    href: "/members",
    icon: Users,
  },
];

function resultIcon(type: string) {
  if (type === "Asset") return Package;
  if (type === "Maintenance" || type === "Template") return Wrench;
  if (type === "Repair") return Wrench;
  if (type === "Document") return FileText;
  if (type === "Household") return Users;
  return Home;
}

function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

async function fetchSavedSearches(homeId: string) {
  const response = await fetch(`/api/saved-searches?homeId=${homeId}`);
  const payload = await response.json();
  return (payload.searches ?? []) as SavedSearch[];
}

export function GlobalCommandPalette({ selectedHomeId }: { selectedHomeId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [facets, setFacets] = useState<{ types: Facet[]; statuses: Facet[] }>({
    types: [],
    statuses: [],
  });
  const [saved, setSaved] = useState<SavedSearch[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
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
    if (!open || !selectedHomeId) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      void fetchSavedSearches(selectedHomeId).then((items) => {
        if (!cancelled) setSaved(items);
      });
    }, 20);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, selectedHomeId]);

  useEffect(() => {
    const needle = query.trim();
    if (!open || needle.length < 2 || !selectedHomeId) {
      const timer = window.setTimeout(() => {
        setResults([]);
        setFacets({ types: [], statuses: [] });
        setLoading(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ homeId: selectedHomeId, q: needle });
      if (selectedTypes.length) params.set("types", selectedTypes.join(","));
      if (selectedStatuses.length)
        params.set("statuses", selectedStatuses.join(","));
      void fetch(`/api/search?${params}`, { signal: controller.signal })
        .then((response) => response.json())
        .then((payload) => {
          setResults(payload.results ?? []);
          setFacets(payload.facets ?? { types: [], statuses: [] });
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
  }, [open, query, selectedHomeId, selectedTypes, selectedStatuses]);

  function close() {
    setOpen(false);
    setQuery("");
    setResults([]);
    setSelectedTypes([]);
    setSelectedStatuses([]);
    setActiveIndex(0);
  }

  function navigate(href: string) {
    close();
    router.push(href);
  }

  async function refreshSaved() {
    if (!selectedHomeId) return;
    setSaved(await fetchSavedSearches(selectedHomeId));
  }

  async function saveCurrentSearch() {
    const name = window.prompt("Name this saved search");
    if (!name?.trim() || query.trim().length < 2) return;
    await fetch("/api/saved-searches", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        homeId: selectedHomeId,
        name,
        query,
        filters: { types: selectedTypes, statuses: selectedStatuses },
      }),
    });
    await refreshSaved();
  }

  async function removeSaved(searchId: string) {
    await fetch(`/api/saved-searches/${searchId}`, { method: "DELETE" });
    await refreshSaved();
  }

  function applySaved(search: SavedSearch) {
    setQuery(search.query);
    setSelectedTypes(search.filters.types ?? []);
    setSelectedStatuses(search.filters.statuses ?? []);
  }

  const displayed: Array<Result | QuickLink> =
    query.trim().length >= 2 ? results : quickLinks;

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
            className="command-dialog command-dialog-advanced"
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
                placeholder="Search names, serials, barcodes and OCR text…"
              />
              {query.trim().length >= 2 && (
                <button
                  className="icon-action"
                  type="button"
                  aria-label="Save this search"
                  onClick={() => void saveCurrentSearch()}
                >
                  <Bookmark size={17} />
                </button>
              )}
              <button
                className="icon-action"
                type="button"
                aria-label="Close search"
                onClick={close}
              >
                <X size={17} />
              </button>
            </div>

            {saved.length > 0 && (
              <div className="saved-search-row">
                <small>Saved</small>
                {saved.map((search) => (
                  <span key={search.id}>
                    <button type="button" onClick={() => applySaved(search)}>
                      <Bookmark size={13} />
                      {search.name}
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${search.name}`}
                      onClick={() => void removeSaved(search.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {query.trim().length >= 2 &&
              (facets.types.length > 0 || facets.statuses.length > 0) && (
                <div className="command-filters">
                  {facets.types.length > 0 && (
                    <div>
                      <small>Type</small>
                      {facets.types.map((facet) => (
                        <button
                          className={
                            selectedTypes.includes(facet.value) ? "active" : ""
                          }
                          type="button"
                          key={facet.value}
                          onClick={() =>
                            setSelectedTypes((current) =>
                              toggleValue(current, facet.value),
                            )
                          }
                        >
                          {facet.value} <b>{facet.count}</b>
                        </button>
                      ))}
                    </div>
                  )}
                  {facets.statuses.length > 0 && (
                    <div>
                      <small>Status</small>
                      {facets.statuses.slice(0, 8).map((facet) => (
                        <button
                          className={
                            selectedStatuses.includes(facet.value) ? "active" : ""
                          }
                          type="button"
                          key={facet.value}
                          onClick={() =>
                            setSelectedStatuses((current) =>
                              toggleValue(current, facet.value),
                            )
                          }
                        >
                          {facet.value.replaceAll("_", " ").toLowerCase()} {facet.count}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

            <div className="command-results" role="listbox">
              {query.trim().length < 2 && (
                <small className="command-section-label">Quick actions</small>
              )}
              {displayed.map((item, index) => {
                const isResult = "type" in item;
                const Icon = isResult ? resultIcon(item.type) : item.icon;
                return (
                  <button
                    className={index === activeIndex ? "active" : ""}
                    key={isResult ? item.id : item.href}
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
                    {isResult && (
                      <b>
                        {item.type} · {item.status.replaceAll("_", " ").toLowerCase()}
                      </b>
                    )}
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
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd> Navigate
              </span>
              <span>
                <kbd>↵</kbd> Open
              </span>
              <span>
                <kbd>esc</kbd> Close
              </span>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}

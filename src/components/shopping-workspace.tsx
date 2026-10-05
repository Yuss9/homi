"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Check,
  Pencil,
  Plus,
  ShoppingBasket,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { ActionFeedback } from "@/src/components/action-feedback";

type Item = { id: string; name: string; quantity: string; checked: boolean };
type List = { id: string; name: string; items: Item[] };
type Home = { id: string; name: string };

async function api(path: string, method = "GET", body?: unknown) {
  const response = await fetch(path, {
    method,
    cache: "no-store",
    ...(body
      ? {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const payload = await response.json();
  if (!response.ok)
    throw new Error(payload.error?.message ?? "Could not save your changes.");
  return payload;
}

export function ShoppingWorkspace() {
  const [homes, setHomes] = useState<Home[]>([]);
  const [homeId, setHomeId] = useState("");
  const [lists, setLists] = useState<List[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [canEdit, setCanEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState("");
  const [renaming, setRenaming] = useState(false);
  const currentHome = useRef(homeId);
  useEffect(() => {
    currentHome.current = homeId;
  }, [homeId]);
  const requestVersion = useRef(0);
  const mutating = useRef(false);
  const selected = lists.find((list) => list.id === selectedId) ?? lists[0];

  const refresh = useCallback(async () => {
    if (!homeId) return;
    const version = ++requestVersion.current;
    const payload = await api(`/api/shopping-lists?homeId=${homeId}`);
    if (currentHome.current !== homeId || version !== requestVersion.current)
      return;
    setLists(payload.lists);
    setCanEdit(payload.canEdit);
    setLoading(false);
  }, [homeId]);

  useEffect(() => {
    let active = true;
    void api("/api/homes")
      .then((payload) => {
        if (!active) return;
        setHomes(payload.homes);
        setHomeId(payload.selectedHomeId ?? payload.homes[0]?.id ?? "");
        setSelectedId(
          new URLSearchParams(window.location.search).get("list") ?? "",
        );
        if (!payload.homes.length) setLoading(false);
      })
      .catch((cause: Error) => {
        if (active) {
          setError(cause.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!homeId) return;
    const sync = () => {
      if (document.visibilityState === "visible" && !mutating.current)
        void refresh().catch((cause: Error) => {
          setError(cause.message);
          setLoading(false);
        });
    };
    sync();
    const timer = window.setInterval(sync, 5000);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [homeId, refresh]);

  async function mutate(
    path: string,
    method: string,
    body?: unknown,
    after?: () => void,
  ) {
    if (mutating.current) return false;
    mutating.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    requestVersion.current++;
    try {
      await api(path, method, body);
      after?.();
      await refresh();
      setMessage("Shopping list updated.");
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not update shopping list.",
      );
      return false;
    } finally {
      mutating.current = false;
      setBusy(false);
    }
  }

  function addList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    void mutate(
      "/api/shopping-lists",
      "POST",
      { homeId, name: new FormData(form).get("name") },
      () => form.reset(),
    );
  }

  function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    void mutate(
      `/api/shopping-lists/${selected.id}/items`,
      "POST",
      { name: values.get("name"), quantity: values.get("quantity") },
      () => form.reset(),
    );
  }

  const completed = selected?.items.filter((item) => item.checked).length ?? 0;
  const total = selected?.items.length ?? 0;
  return (
    <main id="main" className="app-main shopping-workspace">
      <div className="dashboard-head" data-reveal>
        <div>
          <small>Household essentials</small>
          <h1>Shopping lists</h1>
          <p>One shared list, wherever the household shops.</p>
        </div>
        <select
          aria-label="Selected home"
          value={homeId}
          disabled={busy || !homes.length}
          onChange={(event) => {
            setLists([]);
            setSelectedId("");
            setCanEdit(false);
            setLoading(true);
            setEditingId("");
            setRenaming(false);
            setError("");
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
      <div className="shopping-layout">
        <section className="dash-card">
          <div className="dash-card-head">
            <h2>Your lists</h2>
            <ShoppingBasket size={18} />
          </div>
          <p className="muted-copy">
            <Users size={14} /> Shared privately with this home’s members.
            Updates sync every few seconds.
          </p>
          <div className="shopping-list-tabs" aria-label="Shopping lists">
            {lists.map((list) => (
              <button
                type="button"
                className={`shopping-list-tab ${list.id === selected?.id ? "active" : ""}`}
                aria-pressed={list.id === selected?.id}
                key={list.id}
                onClick={() => {
                  setSelectedId(list.id);
                  setEditingId("");
                  setRenaming(false);
                }}
              >
                <span>{list.name}</span>
                <small>
                  {list.items.filter((item) => !item.checked).length} left
                </small>
              </button>
            ))}
          </div>
          {canEdit && (
            <form className="auth-form compact-form" onSubmit={addList}>
              <div className="field">
                <label htmlFor="shopping-list-name">New list</label>
                <input
                  id="shopping-list-name"
                  name="name"
                  placeholder="Weekly groceries"
                  required
                  maxLength={120}
                  disabled={busy}
                />
              </div>
              <button
                className="button button-small"
                disabled={busy}
                type="submit"
              >
                <Plus size={16} />
                Create list
              </button>
            </form>
          )}
        </section>
        <section
          className="dash-card shopping-items-card"
          aria-busy={loading || busy}
        >
          {loading ? (
            <p role="status">Loading your lists…</p>
          ) : selected ? (
            <>
              <div className="dash-card-head">
                <h2>{selected.name}</h2>
                {canEdit && (
                  <div className="inline-actions">
                    <button
                      className="icon-action"
                      type="button"
                      aria-label="Rename list"
                      disabled={busy}
                      onClick={() => setRenaming(!renaming)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="icon-action"
                      type="button"
                      aria-label="Delete list"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete “${selected.name}” and its items?`,
                          )
                        )
                          void mutate(
                            `/api/shopping-lists/${selected.id}`,
                            "DELETE",
                          );
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
              {renaming && (
                <form
                  className="auth-form compact-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void mutate(
                      `/api/shopping-lists/${selected.id}`,
                      "PATCH",
                      { name: new FormData(event.currentTarget).get("name") },
                      () => setRenaming(false),
                    );
                  }}
                >
                  <div className="field">
                    <label htmlFor="rename-shopping-list">List name</label>
                    <input
                      id="rename-shopping-list"
                      name="name"
                      defaultValue={selected.name}
                      required
                      maxLength={120}
                    />
                  </div>
                  <button className="button button-small" disabled={busy}>
                    Save name
                  </button>
                </form>
              )}
              <div className="shopping-progress">
                <span>
                  {completed} of {total} picked up
                </span>
                <progress
                  value={completed}
                  max={total || 1}
                  aria-label="Shopping progress"
                />
              </div>
              {canEdit && (
                <form className="shopping-add-form" onSubmit={addItem}>
                  <div className="field">
                    <label htmlFor="shopping-item-name">Item</label>
                    <input
                      id="shopping-item-name"
                      name="name"
                      required
                      maxLength={160}
                      placeholder="What do you need?"
                      disabled={busy}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="shopping-item-quantity">Quantity</label>
                    <input
                      id="shopping-item-quantity"
                      name="quantity"
                      maxLength={60}
                      placeholder="2 / 500 g"
                      disabled={busy}
                    />
                  </div>
                  <button
                    className="button"
                    disabled={busy}
                    type="submit"
                    aria-label="Add item"
                  >
                    <Plus size={18} />
                  </button>
                </form>
              )}
              <div className="shopping-items">
                {[...selected.items]
                  .sort((a, b) => Number(a.checked) - Number(b.checked))
                  .map((item) =>
                    editingId === item.id ? (
                      <form
                        key={item.id}
                        className="shopping-edit-form auth-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const values = new FormData(event.currentTarget);
                          void mutate(
                            `/api/shopping-lists/${selected.id}/items/${item.id}`,
                            "PATCH",
                            {
                              name: values.get("name"),
                              quantity: values.get("quantity"),
                            },
                            () => setEditingId(""),
                          );
                        }}
                      >
                        <div className="field">
                          <label htmlFor={`name-${item.id}`}>Item name</label>
                          <input
                            id={`name-${item.id}`}
                            name="name"
                            defaultValue={item.name}
                            required
                            maxLength={160}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`quantity-${item.id}`}>
                            Quantity
                          </label>
                          <input
                            id={`quantity-${item.id}`}
                            name="quantity"
                            defaultValue={item.quantity}
                            maxLength={60}
                          />
                        </div>
                        <div className="inline-actions">
                          <button
                            className="button button-small"
                            disabled={busy}
                          >
                            <Check size={16} />
                            Save
                          </button>
                          <button
                            className="icon-action"
                            type="button"
                            aria-label="Cancel edit"
                            onClick={() => setEditingId("")}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div
                        className={`shopping-item ${item.checked ? "is-checked" : ""}`}
                        key={item.id}
                      >
                        <label className="shopping-item-check">
                          <input
                            type="checkbox"
                            checked={item.checked}
                            disabled={!canEdit || busy}
                            onChange={(event) => {
                              const checked = event.target.checked;
                              const listId = selected.id;
                              setLists((current) =>
                                current.map((list) =>
                                  list.id === listId
                                    ? {
                                        ...list,
                                        items: list.items.map((entry) =>
                                          entry.id === item.id
                                            ? { ...entry, checked }
                                            : entry,
                                        ),
                                      }
                                    : list,
                                ),
                              );
                              void mutate(
                                `/api/shopping-lists/${listId}/items/${item.id}`,
                                "PATCH",
                                { checked },
                              ).then((saved) => {
                                if (!saved)
                                  setLists((current) =>
                                    current.map((list) =>
                                      list.id === listId
                                        ? {
                                            ...list,
                                            items: list.items.map((entry) =>
                                              entry.id === item.id
                                                ? {
                                                    ...entry,
                                                    checked: item.checked,
                                                  }
                                                : entry,
                                            ),
                                          }
                                        : list,
                                    ),
                                  );
                              });
                            }}
                          />
                          <span>
                            <strong>{item.name}</strong>
                            {item.quantity && <small>{item.quantity}</small>}
                          </span>
                        </label>
                        {canEdit && (
                          <div className="inline-actions">
                            <button
                              className="icon-action"
                              type="button"
                              aria-label={`Edit ${item.name}`}
                              disabled={busy}
                              onClick={() => setEditingId(item.id)}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              className="icon-action"
                              type="button"
                              aria-label={`Remove ${item.name}`}
                              disabled={busy}
                              onClick={() =>
                                void mutate(
                                  `/api/shopping-lists/${selected.id}/items/${item.id}`,
                                  "DELETE",
                                )
                              }
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}
                      </div>
                    ),
                  )}
              </div>
              {!total && (
                <div className="shopping-empty">
                  <ShoppingBasket size={32} />
                  <h3>A fresh start</h3>
                  <p>Add the essentials and let everyone help with the shop.</p>
                </div>
              )}
              {completed > 0 && canEdit && (
                <button
                  className="button button-secondary button-small"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm("Remove all picked-up items?"))
                      void mutate(
                        `/api/shopping-lists/${selected.id}/items`,
                        "DELETE",
                      );
                  }}
                >
                  <Check size={16} />
                  Clear picked-up items
                </button>
              )}
              {!canEdit && (
                <p className="muted-copy">
                  You have read-only access to this home.
                </p>
              )}
            </>
          ) : (
            <div className="shopping-empty">
              <ShoppingBasket size={36} />
              <h2>
                {homeId ? "Your next shop starts here" : "Add a home first"}
              </h2>
              <p>
                {homeId
                  ? "Create a list for groceries, DIY supplies, or anything your home needs."
                  : "Set up a home to share shopping lists with your household."}
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

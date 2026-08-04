"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Archive, Check, House, Pencil, Plus, X } from "lucide-react";
import { ActionFeedback } from "@/src/components/action-feedback";

type Home = {
  id: string;
  name: string;
  type: string;
  addressLine?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
  constructionYear?: number | null;
  timezone: string;
  role: string;
};
type Room = {
  id: string;
  name: string;
  floor?: string | null;
  icon?: string | null;
};

const optional = (value: FormDataEntryValue | null) => {
  const text = String(value ?? "").trim();
  return text || null;
};

export function HomeWorkspace() {
  const [homes, setHomes] = useState<Home[]>([]);
  const [homeId, setHomeId] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [editingHomeId, setEditingHomeId] = useState("");
  const [editingRoomId, setEditingRoomId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedHome = homes.find((home) => home.id === homeId);
  const canManageHome =
    selectedHome?.role === "OWNER" || selectedHome?.role === "ADMIN";
  const canArchiveHome = selectedHome?.role === "OWNER";

  async function loadHomes(preferredId?: string) {
    const response = await fetch("/api/homes");
    const payload = (await response.json()) as { homes?: Home[] };
    const next = payload.homes ?? [];
    setHomes(next);
    setHomeId((current) => {
      const candidate = preferredId ?? current;
      return next.some((home) => home.id === candidate)
        ? candidate
        : next[0]?.id ?? "";
    });
  }

  async function loadRooms(selectedHomeId: string) {
    if (!selectedHomeId) {
      setRooms([]);
      return;
    }
    const response = await fetch(`/api/rooms?homeId=${selectedHomeId}`);
    const payload = (await response.json()) as { rooms?: Room[] };
    setRooms(payload.rooms ?? []);
  }

  useEffect(() => {
    void loadHomes();
  }, []);

  useEffect(() => {
    void loadRooms(homeId);
    setEditingRoomId("");
  }, [homeId]);

  async function addHome(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError("");
    const form = new FormData(formElement);
    const constructionYear = String(form.get("constructionYear") ?? "");
    const response = await fetch("/api/homes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        type: form.get("type"),
        addressLine: optional(form.get("addressLine")) ?? undefined,
        city: optional(form.get("city")) ?? undefined,
        postalCode: optional(form.get("postalCode")) ?? undefined,
        country: optional(form.get("country")) ?? undefined,
        constructionYear: constructionYear ? Number(constructionYear) : undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message ?? "Could not add the home.");
      return;
    }
    formElement.reset();
    setMessage("Home added to your journal.");
    await loadHomes(payload.home.id);
  }

  async function saveHome(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedHome) return;
    setError("");
    const form = new FormData(event.currentTarget);
    const year = String(form.get("constructionYear") ?? "");
    const response = await fetch(`/api/homes/${selectedHome.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        type: form.get("type"),
        addressLine: optional(form.get("addressLine")),
        city: optional(form.get("city")),
        postalCode: optional(form.get("postalCode")),
        country: optional(form.get("country")),
        constructionYear: year ? Number(year) : null,
        timezone:
          optional(form.get("timezone")) ??
          Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message ?? "Could not update the home.");
      return;
    }
    setEditingHomeId("");
    setMessage("Home details updated.");
    await loadHomes(selectedHome.id);
  }

  async function archiveHome() {
    if (!selectedHome) return;
    setError("");
    const response = await fetch(`/api/homes/${selectedHome.id}`, {
      method: "DELETE",
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message ?? "Could not archive the home.");
      return;
    }
    setEditingHomeId("");
    setMessage(`${selectedHome.name} was archived.`);
    await loadHomes();
  }

  async function addRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError("");
    const form = new FormData(formElement);
    const response = await fetch("/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        homeId,
        name: form.get("name"),
        floor: optional(form.get("floor")) ?? undefined,
        icon: optional(form.get("icon")) ?? "Room",
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message ?? "Could not add the room.");
      return;
    }
    formElement.reset();
    setMessage("Room added.");
    await loadRooms(homeId);
  }

  async function saveRoom(event: FormEvent<HTMLFormElement>, roomId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/rooms/${roomId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        floor: optional(form.get("floor")),
        icon: optional(form.get("icon")),
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message ?? "Could not update the room.");
      return;
    }
    setEditingRoomId("");
    setMessage("Room updated.");
    await loadRooms(homeId);
  }

  async function archiveRoom(room: Room) {
    const response = await fetch(`/api/rooms/${room.id}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message ?? "Could not archive the room.");
      return;
    }
    setMessage(`${room.name} was archived.`);
    await loadRooms(homeId);
  }

  return (
    <main id="main" className="app-main">
      <div className="dashboard-head">
        <div>
          <small>Your home journal</small>
          <h1>Homes & rooms</h1>
          <p>Create, edit, and safely archive every place and room you manage.</p>
        </div>
      </div>

      <ActionFeedback error={error} message={message} />

      <div className="dash-grid" style={{ marginTop: 32 }}>
        <section className="dash-card">
          <div className="dash-card-head">
            <h2>Your homes</h2>
            <House size={17} />
          </div>
          <div className="animated-list">
            {homes.map((home) => (
              <div className="dash-task has-action" key={home.id}>
                <span><House size={16} /></span>
                <button
                  className="resource-button"
                  type="button"
                  onClick={() => setHomeId(home.id)}
                >
                  <strong>{home.name}</strong>
                  <small>
                    {home.city || home.type} · {home.role.toLowerCase()}
                  </small>
                </button>
                {home.id === homeId && <b>Selected</b>}
              </div>
            ))}
          </div>

          {selectedHome && canManageHome && (
            editingHomeId === selectedHome.id ? (
              <form className="auth-form compact-form" onSubmit={saveHome}>
                <div className="dash-card-head">
                  <h2>Edit home</h2>
                  <button
                    className="icon-action"
                    type="button"
                    aria-label="Cancel home editing"
                    onClick={() => setEditingHomeId("")}
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="field"><label htmlFor="edit-home-name">Name</label><input id="edit-home-name" name="name" defaultValue={selectedHome.name} required /></div>
                <div className="field"><label htmlFor="edit-home-type">Type</label><select id="edit-home-type" name="type" defaultValue={selectedHome.type}><option value="HOUSE">House</option><option value="APARTMENT">Apartment</option><option value="OTHER">Other</option></select></div>
                <div className="field"><label htmlFor="edit-home-address">Address</label><input id="edit-home-address" name="addressLine" defaultValue={selectedHome.addressLine ?? ""} /></div>
                <div className="field"><label htmlFor="edit-home-city">City</label><input id="edit-home-city" name="city" defaultValue={selectedHome.city ?? ""} /></div>
                <div className="field"><label htmlFor="edit-home-postal">Postal code</label><input id="edit-home-postal" name="postalCode" defaultValue={selectedHome.postalCode ?? ""} /></div>
                <div className="field"><label htmlFor="edit-home-country">Country</label><input id="edit-home-country" name="country" defaultValue={selectedHome.country ?? ""} /></div>
                <div className="field"><label htmlFor="edit-home-year">Construction year</label><input id="edit-home-year" name="constructionYear" type="number" min="1200" max={new Date().getFullYear() + 2} defaultValue={selectedHome.constructionYear ?? ""} /></div>
                <div className="field"><label htmlFor="edit-home-timezone">Timezone</label><input id="edit-home-timezone" name="timezone" defaultValue={selectedHome.timezone} /></div>
                <div className="inline-actions">
                  <button className="button button-small" type="submit"><Check size={15} />Save home</button>
                  {canArchiveHome && <button className="button button-secondary button-small" type="button" onClick={() => void archiveHome()}><Archive size={15} />Archive home</button>}
                </div>
              </form>
            ) : (
              <button className="button button-secondary button-small" type="button" onClick={() => setEditingHomeId(selectedHome.id)}><Pencil size={15} />Edit selected home</button>
            )
          )}

          <form className="auth-form compact-form" onSubmit={addHome}>
            <div className="dash-card-head"><h2>Add a home</h2><Plus size={17} /></div>
            <div className="field"><label htmlFor="home-name">Home name</label><input id="home-name" name="name" required placeholder="Lake House" /></div>
            <div className="field"><label htmlFor="home-type">Type</label><select id="home-type" name="type"><option value="HOUSE">House</option><option value="APARTMENT">Apartment</option><option value="OTHER">Other</option></select></div>
            <div className="field"><label htmlFor="home-address">Address</label><input id="home-address" name="addressLine" /></div>
            <div className="field"><label htmlFor="home-city">City</label><input id="home-city" name="city" /></div>
            <div className="field"><label htmlFor="home-postal">Postal code</label><input id="home-postal" name="postalCode" /></div>
            <div className="field"><label htmlFor="home-country">Country</label><input id="home-country" name="country" /></div>
            <div className="field"><label htmlFor="home-year">Construction year</label><input id="home-year" name="constructionYear" type="number" min="1200" max={new Date().getFullYear() + 2} /></div>
            <button className="button button-small" type="submit"><Plus size={15} />Add home</button>
          </form>
        </section>

        <section className="dash-card">
          <div className="dash-card-head"><h2>Rooms</h2><span>{rooms.length}</span></div>
          <div className="animated-list">
            {rooms.map((room) =>
              editingRoomId === room.id ? (
                <form className="auth-form compact-form" key={room.id} onSubmit={(event) => void saveRoom(event, room.id)}>
                  <div className="field"><label htmlFor={`room-name-${room.id}`}>Room name</label><input id={`room-name-${room.id}`} name="name" defaultValue={room.name} required /></div>
                  <div className="field"><label htmlFor={`room-floor-${room.id}`}>Floor</label><input id={`room-floor-${room.id}`} name="floor" defaultValue={room.floor ?? ""} /></div>
                  <div className="field"><label htmlFor={`room-icon-${room.id}`}>Icon label</label><input id={`room-icon-${room.id}`} name="icon" defaultValue={room.icon ?? "Room"} /></div>
                  <div className="inline-actions"><button className="button button-small" type="submit"><Check size={15} />Save</button><button className="button button-secondary button-small" type="button" onClick={() => setEditingRoomId("")}><X size={15} />Cancel</button></div>
                </form>
              ) : (
                <div className="dash-task has-action" key={room.id}>
                  <span><House size={16} /></span>
                  <div><strong>{room.name}</strong><small>{room.floor || "No floor set"}</small></div>
                  {canManageHome && <div className="inline-actions"><button className="icon-action" type="button" aria-label={`Edit ${room.name}`} onClick={() => setEditingRoomId(room.id)}><Pencil size={15} /></button><button className="icon-action" type="button" aria-label={`Archive ${room.name}`} onClick={() => void archiveRoom(room)}><Archive size={15} /></button></div>}
                </div>
              ),
            )}
          </div>
          {!rooms.length && <p className="muted-copy">Choose a home, then add its first room.</p>}
          {canManageHome && (
            <form className="auth-form compact-form" onSubmit={addRoom}>
              <div className="field"><label htmlFor="room-name">Room name</label><input id="room-name" name="name" required disabled={!homeId} placeholder="Kitchen" /></div>
              <div className="field"><label htmlFor="room-floor">Floor</label><input id="room-floor" name="floor" disabled={!homeId} placeholder="Ground floor" /></div>
              <div className="field"><label htmlFor="room-icon">Icon label</label><input id="room-icon" name="icon" disabled={!homeId} placeholder="Kitchen" /></div>
              <button className="button button-small" disabled={!homeId} type="submit"><Plus size={15} />Add room</button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

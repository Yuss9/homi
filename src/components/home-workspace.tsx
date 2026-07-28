"use client";

import { useEffect, useState, type FormEvent } from "react";
import { House, Plus } from "lucide-react";

type Home = { id: string; name: string; type: string; city?: string | null; role: string };
type Room = { id: string; name: string; floor?: string | null };

export function HomeWorkspace() {
  const [homes, setHomes] = useState<Home[]>([]);
  const [homeId, setHomeId] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadHomes() {
    const response = await fetch("/api/homes");
    const payload = (await response.json()) as { homes?: Home[] };
    const next = payload.homes ?? [];
    setHomes(next);
    setHomeId((current) => current || next[0]?.id || "");
  }

  async function loadRooms(selectedHomeId: string) {
    if (!selectedHomeId) return setRooms([]);
    const response = await fetch(`/api/rooms?homeId=${selectedHomeId}`);
    const payload = (await response.json()) as { rooms?: Room[] };
    setRooms(payload.rooms ?? []);
  }

  useEffect(() => {
    void fetch("/api/homes").then((response) => response.json()).then((payload) => {
      const next = payload.homes ?? [];
      setHomes(next);
      setHomeId((current) => current || next[0]?.id || "");
    });
  }, []);
  useEffect(() => {
    if (!homeId) return;
    void fetch(`/api/rooms?homeId=${homeId}`)
      .then((response) => response.json())
      .then((payload) => setRooms(payload.rooms ?? []));
  }, [homeId]);

  async function addHome(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const constructionYear = String(form.get("constructionYear") ?? "");
    const response = await fetch("/api/homes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        type: form.get("type"),
        city: form.get("city") || undefined,
        constructionYear: constructionYear ? Number(constructionYear) : undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });
    const payload = await response.json();
    if (!response.ok) return setError(payload.error?.message ?? "Could not add the home.");
    event.currentTarget.reset();
    setMessage("Home added to your journal.");
    await loadHomes();
    setHomeId(payload.home.id);
  }

  async function addRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        homeId,
        name: form.get("name"),
        floor: form.get("floor") || undefined,
        icon: "Room",
      }),
    });
    const payload = await response.json();
    if (!response.ok) return setError(payload.error?.message ?? "Could not add the room.");
    event.currentTarget.reset();
    setMessage("Room added.");
    await loadRooms(homeId);
  }

  return (
    <main id="main" className="app-main">
      <div className="dashboard-head">
        <div>
          <small>Your home journal</small>
          <h1>Homes & rooms</h1>
          <p>Create separate, private journals for each place you care for.</p>
        </div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      <div className="dash-grid" style={{ marginTop: 32 }}>
        <section className="dash-card">
          <div className="dash-card-head"><h2>Your homes</h2><House size={17} /></div>
          {homes.map((home) => (
            <button className="dash-task resource-button" key={home.id} onClick={() => setHomeId(home.id)}>
              <span><House size={16} /></span>
              <div><strong>{home.name}</strong><small>{home.city || home.type} · {home.role.toLowerCase()}</small></div>
              {home.id === homeId && <b>Selected</b>}
            </button>
          ))}
          <form className="auth-form compact-form" onSubmit={addHome}>
            <div className="field"><label htmlFor="home-name">Home name</label><input id="home-name" name="name" required placeholder="Lake House" /></div>
            <div className="field"><label htmlFor="home-type">Type</label><select id="home-type" name="type"><option value="HOUSE">House</option><option value="APARTMENT">Apartment</option><option value="OTHER">Other</option></select></div>
            <div className="field"><label htmlFor="home-city">City</label><input id="home-city" name="city" /></div>
            <div className="field"><label htmlFor="home-year">Construction year</label><input id="home-year" name="constructionYear" inputMode="numeric" /></div>
            <button className="button button-small" type="submit"><Plus size={15} />Add home</button>
          </form>
        </section>
        <section className="dash-card">
          <div className="dash-card-head"><h2>Rooms</h2><span>{rooms.length}</span></div>
          {rooms.length ? rooms.map((room) => (
            <div className="dash-task" key={room.id}><span><House size={16} /></span><div><strong>{room.name}</strong><small>{room.floor || "No floor set"}</small></div></div>
          )) : <p className="muted-copy">Choose a home, then add its first room.</p>}
          <form className="auth-form compact-form" onSubmit={addRoom}>
            <div className="field"><label htmlFor="room-name">Room name</label><input id="room-name" name="name" required disabled={!homeId} placeholder="Kitchen" /></div>
            <div className="field"><label htmlFor="room-floor">Floor</label><input id="room-floor" name="floor" disabled={!homeId} placeholder="Ground floor" /></div>
            <button className="button button-small" disabled={!homeId} type="submit"><Plus size={15} />Add room</button>
          </form>
        </section>
      </div>
    </main>
  );
}

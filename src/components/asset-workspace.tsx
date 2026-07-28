"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircle, Package, Plus, Search } from "lucide-react";
import { ActionFeedback } from "@/src/components/action-feedback";

type Home = { id: string; name: string };
type Asset = {
  id: string;
  name: string;
  category: string;
  brand?: string | null;
  model?: string | null;
  status: string;
  warrantyEndDate?: string | null;
};

export function AssetWorkspace() {
  const [homes, setHomes] = useState<Home[]>([]);
  const [homeId, setHomeId] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [newAssetId, setNewAssetId] = useState("");

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
    const timer = setTimeout(() => {
      void fetch(`/api/assets?homeId=${homeId}&q=${encodeURIComponent(query)}`)
        .then((response) => response.json())
        .then((payload) => setAssets(payload.assets ?? []));
    }, 150);
    return () => clearTimeout(timer);
  }, [homeId, query]);

  async function addAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      const form = new FormData(formElement);
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          homeId,
          name: form.get("name"),
          category: form.get("category"),
          brand: form.get("brand") || undefined,
          model: form.get("model") || undefined,
          serialNumber: form.get("serialNumber") || undefined,
          warrantyEndDate: form.get("warrantyEndDate") || undefined,
          status: "ACTIVE",
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Could not add the asset.");
        return;
      }

      formElement.reset();
      setNewAssetId(payload.asset.id);
      setAssets((current) =>
        [...current, payload.asset].sort((first, second) =>
          first.name.localeCompare(second.name),
        ),
      );
      setMessage(`${payload.asset.name} was added to your home inventory.`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main id="main" className="app-main">
      <div className="dashboard-head">
        <div>
          <small>Inventory</small>
          <h1>Assets</h1>
          <p>Appliances, systems, furniture, and the details worth keeping.</p>
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
            <h2>Home inventory</h2>
            <span>{assets.length}</span>
          </div>
          <label className="search-field">
            <Search size={17} />
            <span className="sr-only">Search assets</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name"
            />
          </label>
          <div className="animated-list">
            {assets.map((asset) => (
              <Link
                className={`dash-task ${
                  newAssetId === asset.id ? "is-new" : ""
                }`}
                href={`/assets/${asset.id}`}
                key={asset.id}
              >
                <span>
                  <Package size={17} />
                </span>
                <div>
                  <strong>{asset.name}</strong>
                  <small>
                    {[asset.brand, asset.model, asset.category]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </div>
                <b>{asset.status.replaceAll("_", " ").toLowerCase()}</b>
              </Link>
            ))}
          </div>
          {!assets.length && (
            <p className="muted-copy">No matching assets yet.</p>
          )}
        </section>

        <form
          className={`dash-card auth-form ${submitting ? "is-submitting" : ""}`}
          onSubmit={addAsset}
        >
          <div className="dash-card-head">
            <h2>Add an asset</h2>
            <Plus size={19} />
          </div>
          <div className="field">
            <label htmlFor="asset-name">Name</label>
            <input
              id="asset-name"
              name="name"
              required
              disabled={!homeId || submitting}
              placeholder="Dishwasher"
            />
          </div>
          <div className="field">
            <label htmlFor="asset-category">Category</label>
            <select id="asset-category" name="category" disabled={submitting}>
              <option>Kitchen appliance</option>
              <option>Heating</option>
              <option>Plumbing</option>
              <option>Electrical</option>
              <option>Security</option>
              <option>Smart home</option>
              <option>Furniture</option>
              <option>Exterior</option>
              <option>Other</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="asset-brand">Brand</label>
            <input id="asset-brand" name="brand" disabled={submitting} />
          </div>
          <div className="field">
            <label htmlFor="asset-model">Model</label>
            <input id="asset-model" name="model" disabled={submitting} />
          </div>
          <div className="field">
            <label htmlFor="asset-serial">Serial number</label>
            <input
              id="asset-serial"
              name="serialNumber"
              disabled={submitting}
            />
          </div>
          <div className="field">
            <label htmlFor="asset-warranty">Warranty ends</label>
            <input
              id="asset-warranty"
              name="warrantyEndDate"
              type="date"
              disabled={submitting}
            />
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
            {submitting ? "Adding equipment…" : "Add asset"}
          </button>
        </form>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Archive, Check, Pencil } from "lucide-react";
import { ActionFeedback } from "@/src/components/action-feedback";

type Room = { id: string; name: string };
type Asset = {
  id: string;
  homeId: string;
  roomId?: string | null;
  name: string;
  category: string;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  description?: string | null;
  purchaseDate?: string | null;
  purchasePrice?: string | null;
  currency?: string | null;
  retailer?: string | null;
  installationDate?: string | null;
  warrantyStartDate?: string | null;
  warrantyEndDate?: string | null;
  expectedLifetimeYears?: number | null;
  status: string;
};

const optional = (form: FormData, name: string) => {
  const value = String(form.get(name) ?? "").trim();
  return value || null;
};

export function AssetEditor({ asset }: { asset: Asset }) {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch(`/api/rooms?homeId=${asset.homeId}`)
      .then((response) => response.json())
      .then((payload) => setRooms(payload.rooms ?? []));
  }, [asset.homeId]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const lifetime = optional(form, "expectedLifetimeYears");
    const response = await fetch(`/api/assets/${asset.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        roomId: optional(form, "roomId"),
        name: form.get("name"),
        category: form.get("category"),
        brand: optional(form, "brand"),
        model: optional(form, "model"),
        serialNumber: optional(form, "serialNumber"),
        description: optional(form, "description"),
        purchaseDate: optional(form, "purchaseDate"),
        purchasePrice: optional(form, "purchasePrice"),
        currency: optional(form, "currency") ?? "EUR",
        retailer: optional(form, "retailer"),
        installationDate: optional(form, "installationDate"),
        warrantyStartDate: optional(form, "warrantyStartDate"),
        warrantyEndDate: optional(form, "warrantyEndDate"),
        expectedLifetimeYears: lifetime ? Number(lifetime) : null,
        status: form.get("status"),
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message ?? "Could not update the asset.");
      return;
    }
    setEditing(false);
    setMessage("Asset details updated.");
    router.refresh();
  }

  async function archive() {
    setError("");
    const response = await fetch(`/api/assets/${asset.id}`, {
      method: "DELETE",
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message ?? "Could not archive the asset.");
      return;
    }
    router.push("/assets");
    router.refresh();
  }

  return (
    <section className="dash-card">
      <div className="dash-card-head">
        <h2>Manage asset</h2>
        <Pencil size={17} />
      </div>
      <ActionFeedback error={error} message={message} />
      {!editing ? (
        <div className="inline-actions">
          <button className="button button-small" type="button" onClick={() => setEditing(true)}><Pencil size={15} />Edit asset</button>
          <button className="button button-secondary button-small" type="button" onClick={() => void archive()}><Archive size={15} />Archive asset</button>
        </div>
      ) : (
        <form className="auth-form compact-form" onSubmit={save}>
          <div className="field"><label htmlFor="edit-asset-name">Name</label><input id="edit-asset-name" name="name" defaultValue={asset.name} required /></div>
          <div className="field"><label htmlFor="edit-asset-room">Room</label><select id="edit-asset-room" name="roomId" defaultValue={asset.roomId ?? ""}><option value="">No room</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></div>
          <div className="field"><label htmlFor="edit-asset-category">Category</label><input id="edit-asset-category" name="category" defaultValue={asset.category} required /></div>
          <div className="field"><label htmlFor="edit-asset-brand">Brand</label><input id="edit-asset-brand" name="brand" defaultValue={asset.brand ?? ""} /></div>
          <div className="field"><label htmlFor="edit-asset-model">Model</label><input id="edit-asset-model" name="model" defaultValue={asset.model ?? ""} /></div>
          <div className="field"><label htmlFor="edit-asset-serial">Serial number</label><input id="edit-asset-serial" name="serialNumber" defaultValue={asset.serialNumber ?? ""} /></div>
          <div className="field"><label htmlFor="edit-asset-description">Description</label><textarea id="edit-asset-description" name="description" defaultValue={asset.description ?? ""} /></div>
          <div className="field"><label htmlFor="edit-asset-purchase-date">Purchase date</label><input id="edit-asset-purchase-date" name="purchaseDate" type="date" defaultValue={asset.purchaseDate ?? ""} /></div>
          <div className="field"><label htmlFor="edit-asset-price">Purchase price</label><input id="edit-asset-price" name="purchasePrice" inputMode="decimal" defaultValue={asset.purchasePrice ?? ""} /></div>
          <div className="field"><label htmlFor="edit-asset-currency">Currency</label><input id="edit-asset-currency" name="currency" maxLength={3} defaultValue={asset.currency ?? "EUR"} /></div>
          <div className="field"><label htmlFor="edit-asset-retailer">Retailer</label><input id="edit-asset-retailer" name="retailer" defaultValue={asset.retailer ?? ""} /></div>
          <div className="field"><label htmlFor="edit-asset-installation">Installation date</label><input id="edit-asset-installation" name="installationDate" type="date" defaultValue={asset.installationDate ?? ""} /></div>
          <div className="field"><label htmlFor="edit-asset-warranty-start">Warranty starts</label><input id="edit-asset-warranty-start" name="warrantyStartDate" type="date" defaultValue={asset.warrantyStartDate ?? ""} /></div>
          <div className="field"><label htmlFor="edit-asset-warranty-end">Warranty ends</label><input id="edit-asset-warranty-end" name="warrantyEndDate" type="date" defaultValue={asset.warrantyEndDate ?? ""} /></div>
          <div className="field"><label htmlFor="edit-asset-lifetime">Expected lifetime in years</label><input id="edit-asset-lifetime" name="expectedLifetimeYears" type="number" min="1" max="200" defaultValue={asset.expectedLifetimeYears ?? ""} /></div>
          <div className="field"><label htmlFor="edit-asset-status">Status</label><select id="edit-asset-status" name="status" defaultValue={asset.status}><option value="ACTIVE">Active</option><option value="NEEDS_ATTENTION">Needs attention</option><option value="UNDER_REPAIR">Under repair</option><option value="REPLACED">Replaced</option></select></div>
          <div className="inline-actions"><button className="button button-small" type="submit"><Check size={15} />Save changes</button><button className="button button-secondary button-small" type="button" onClick={() => setEditing(false)}>Cancel</button></div>
        </form>
      )}
    </section>
  );
}

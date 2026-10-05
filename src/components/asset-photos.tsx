"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Camera, LoaderCircle } from "lucide-react";
import { ActionFeedback } from "@/src/components/action-feedback";

type Photo = { id: string; title: string; fileId: string };
export function AssetPhotos({
  homeId,
  assetId,
  photos,
  canEdit,
}: {
  homeId: string;
  assetId: string;
  photos: Photo[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    form.set("homeId", homeId);
    form.set("assetId", assetId);
    form.set("type", "PHOTO");
    form.set("title", file.name);
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/uploads", {
        method: "POST",
        body: form,
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(
          payload.error?.message ?? "Could not upload the photo.",
        );
      formElement.reset();
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not upload the photo.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="dash-card" data-reveal>
      <div className="dash-card-head">
        <h2>Equipment photos</h2>
        <Camera size={18} />
      </div>
      <p className="muted-copy">
        Private photos, available only to your household.
      </p>
      <ActionFeedback error={error} message="" />
      <div className="asset-photo-grid">
        {photos.map((photo) => (
          <a
            key={photo.id}
            href={`/api/files/${photo.fileId}?preview=1`}
            target="_blank"
            rel="noreferrer"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/files/${photo.fileId}?preview=1`}
              alt={photo.title}
              loading="lazy"
            />
          </a>
        ))}
      </div>
      {!photos.length && (
        <p className="muted-copy">
          Add a photo of the appliance or its serial label.
        </p>
      )}
      {canEdit && (
        <form className="auth-form compact-form" onSubmit={upload}>
          <div className="field">
            <label htmlFor="asset-photo">Add a photo</label>
            <input
              id="asset-photo"
              name="file"
              type="file"
              accept="image/*"
              required
              disabled={busy}
            />
          </div>
          <button className="button button-small" disabled={busy} type="submit">
            {busy ? (
              <LoaderCircle size={16} className="button-spinner" />
            ) : (
              <Camera size={16} />
            )}
            {busy ? "Uploading…" : "Upload photo"}
          </button>
        </form>
      )}
    </section>
  );
}

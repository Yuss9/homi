"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Camera, LoaderCircle, Save, Trash2 } from "lucide-react";
import { ActionFeedback } from "@/src/components/action-feedback";
import { UserAvatar } from "@/src/components/user-avatar";

type Profile = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
};

export function ProfileSettings() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/profile")
      .then(async (response) => ({ response, payload: await response.json() }))
      .then(({ response, payload }) => {
        if (!response.ok) {
          setError(payload.error?.message ?? "Could not load your profile.");
          return;
        }
        setProfile(payload.profile);
      });
  }, []);

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSavingName(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: form.get("name") }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Could not update your nickname.");
        return;
      }
      setProfile(payload.profile);
      setMessage("Your nickname was updated.");
      router.refresh();
    } finally {
      setSavingName(false);
    }
  }

  async function uploadAvatar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) return;
    setSavingAvatar(true);
    setError("");
    setMessage("");
    try {
      const form = new FormData();
      form.set("file", selectedFile);
      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        body: form,
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Could not update your photo.");
        return;
      }
      setProfile((current) =>
        current ? { ...current, avatarUrl: payload.avatarUrl } : current,
      );
      setSelectedFile(null);
      setMessage("Your profile photo was updated.");
      router.refresh();
    } finally {
      setSavingAvatar(false);
    }
  }

  async function removeAvatar() {
    setSavingAvatar(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/profile/avatar", { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Could not remove your photo.");
        return;
      }
      setProfile((current) =>
        current ? { ...current, avatarUrl: payload.avatarUrl } : current,
      );
      setSelectedFile(null);
      setMessage("Your custom profile photo was removed.");
      router.refresh();
    } finally {
      setSavingAvatar(false);
    }
  }

  if (!profile)
    return (
      <section className="dash-card">
        <p className="muted-copy">Loading your profile…</p>
        <ActionFeedback error={error} message={message} />
      </section>
    );

  return (
    <>
      <form className="dash-card auth-form" onSubmit={saveName}>
        <div className="dash-card-head">
          <h2>Public household profile</h2>
          <Save size={17} />
        </div>
        <ActionFeedback error={error} message={message} />
        <div className="profile-card-head">
          <UserAvatar
            name={profile.name}
            avatarUrl={profile.avatarUrl}
            large
          />
          <div>
            <strong>{profile.name}</strong>
            <p>{profile.email}</p>
          </div>
        </div>
        <div className="field">
          <label htmlFor="profile-name">Nickname</label>
          <input
            id="profile-name"
            name="name"
            defaultValue={profile.name}
            minLength={2}
            maxLength={80}
            required
            disabled={savingName}
          />
          <small className="field-hint">
            This is the name other household members will see.
          </small>
        </div>
        <button className="button" type="submit" disabled={savingName}>
          {savingName ? (
            <LoaderCircle className="button-spinner" size={16} />
          ) : (
            <Save size={16} />
          )}
          {savingName ? "Saving…" : "Save nickname"}
        </button>
      </form>

      <form className="dash-card auth-form" onSubmit={uploadAvatar}>
        <div className="dash-card-head">
          <h2>Profile photo</h2>
          <Camera size={17} />
        </div>
        <p className="muted-copy">
          Stored privately and visible only to people who share a home with you.
        </p>
        <div className="field">
          <label className="upload-dropzone" htmlFor="profile-avatar">
            <Camera size={22} />
            <span>
              <strong>
                {selectedFile?.name ?? "Choose a profile photo"}
              </strong>
              <small>PNG, JPEG, WebP, GIF, or AVIF · maximum 5 MB</small>
            </span>
            <b>{selectedFile ? "Change" : "Browse"}</b>
          </label>
          <input
            className="avatar-file-input"
            id="profile-avatar"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
            disabled={savingAvatar}
            onChange={(event) =>
              setSelectedFile(event.target.files?.[0] ?? null)
            }
          />
        </div>
        <div className="avatar-actions">
          <button
            className="button"
            type="submit"
            disabled={!selectedFile || savingAvatar}
          >
            {savingAvatar ? (
              <LoaderCircle className="button-spinner" size={16} />
            ) : (
              <Camera size={16} />
            )}
            {savingAvatar ? "Uploading…" : "Update photo"}
          </button>
          {profile.avatarUrl && (
            <button
              className="button button-secondary"
              type="button"
              disabled={savingAvatar}
              onClick={() => void removeAvatar()}
            >
              <Trash2 size={16} />
              Remove custom photo
            </button>
          )}
        </div>
      </form>
    </>
  );
}

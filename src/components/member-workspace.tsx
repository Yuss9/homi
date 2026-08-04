"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Copy,
  Crown,
  Info,
  LoaderCircle,
  MailPlus,
  RefreshCcw,
  ShieldCheck,
  UserMinus,
  X,
} from "lucide-react";
import { ActionFeedback } from "@/src/components/action-feedback";
import { UserAvatar } from "@/src/components/user-avatar";

type HomeRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
type Home = { id: string; name: string; role: HomeRole };
type Member = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: HomeRole;
  joinedAt: string;
  avatarUrl?: string | null;
};
type Invitation = {
  id: string;
  email: string;
  role: Exclude<HomeRole, "OWNER">;
  expiresAt: string;
  createdAt: string;
};

function parseEmails(value: FormDataEntryValue | null) {
  return [
    ...new Set(
      String(value ?? "")
        .split(/[\s,;]+/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

export function MemberWorkspace() {
  const [homes, setHomes] = useState<Home[]>([]);
  const [homeId, setHomeId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteLinks, setInviteLinks] = useState<Record<string, string>>({});
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentRole, setCurrentRole] = useState<HomeRole>("VIEWER");
  const [submitting, setSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedHome = homes.find((home) => home.id === homeId);
  const canManage = currentRole === "OWNER" || currentRole === "ADMIN";

  useEffect(() => {
    void fetch("/api/homes")
      .then((response) => response.json())
      .then((payload) => {
        const next = payload.homes ?? [];
        setHomes(next);
        setHomeId(next[0]?.id ?? "");
      });
  }, []);

  const loadHousehold = useCallback(
    async (selectedHomeId: string) => {
      if (!selectedHomeId) return;
      const home = homes.find((entry) => entry.id === selectedHomeId);
      const manager = home?.role === "OWNER" || home?.role === "ADMIN";
      const [memberResponse, invitationResponse] = await Promise.all([
        fetch(`/api/members?homeId=${selectedHomeId}`),
        manager
          ? fetch(`/api/invitations?homeId=${selectedHomeId}`)
          : Promise.resolve(null),
      ]);
      const memberPayload = await memberResponse.json();
      if (!memberResponse.ok) {
        setError(memberPayload.error?.message ?? "Could not load the household.");
        return;
      }
      setMembers(memberPayload.members ?? []);
      setCurrentUserId(memberPayload.currentUserId ?? "");
      setCurrentRole(memberPayload.currentRole ?? home?.role ?? "VIEWER");
      if (invitationResponse) {
        const invitationPayload = await invitationResponse.json();
        setInvitations(
          invitationResponse.ok ? invitationPayload.invitations ?? [] : [],
        );
      } else {
        setInvitations([]);
      }
    },
    [homes],
  );

  useEffect(() => {
    if (!homeId) return;
    const timer = window.setTimeout(() => void loadHousehold(homeId), 0);
    return () => window.clearTimeout(timer);
  }, [homeId, loadHousehold]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const emails = parseEmails(form.get("emails"));
    if (!emails.length) {
      setError("Add at least one email address.");
      return;
    }
    if (emails.length > 20) {
      setError("You can invite up to 20 people at a time.");
      return;
    }
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          homeId,
          emails,
          role: form.get("role"),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Could not send the invitations.");
        return;
      }
      const sent = payload.invitations?.length ?? 0;
      const skipped = payload.skipped?.length ?? 0;
      const failed = payload.failed?.length ?? 0;
      formElement.reset();
      setMessage(
        `${sent} invitation${sent === 1 ? "" : "s"} sent.${skipped ? ` ${skipped} already had access.` : ""}${failed ? ` ${failed} could not be delivered.` : ""}`,
      );
      await loadHousehold(homeId);
    } finally {
      setSubmitting(false);
    }
  }

  async function changeRole(member: Member, role: string) {
    setProcessingId(member.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/members/${member.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Could not update the member role.");
        return;
      }
      setMessage(`${member.name}'s role was updated.`);
      await loadHousehold(homeId);
    } finally {
      setProcessingId("");
    }
  }

  async function removeMember(member: Member) {
    if (!window.confirm(`Remove ${member.name} from ${selectedHome?.name}?`))
      return;
    setProcessingId(member.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/members/${member.id}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Could not remove the member.");
        return;
      }
      setMessage(`${member.name} no longer has access to this home.`);
      await loadHousehold(homeId);
    } finally {
      setProcessingId("");
    }
  }

  async function transferOwnership(member: Member) {
    if (
      !window.confirm(
        `Transfer ownership of ${selectedHome?.name} to ${member.name}? You will remain an administrator.`,
      )
    )
      return;
    setProcessingId(member.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/homes/${homeId}/owner`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId: member.id }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Could not transfer ownership.");
        return;
      }
      setMessage(`${member.name} is now the owner. You remain an administrator.`);
      await loadHousehold(homeId);
    } finally {
      setProcessingId("");
    }
  }

  async function resendInvitation(invitation: Invitation) {
    setProcessingId(invitation.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/invitations/${invitation.id}/resend`,
        { method: "POST" },
      );
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Could not resend the invitation.");
        return;
      }
      setInviteLinks((current) => ({
        ...current,
        [invitation.id]: payload.inviteUrl,
      }));
      setMessage(`A fresh invitation was sent to ${invitation.email}.`);
      await loadHousehold(homeId);
    } finally {
      setProcessingId("");
    }
  }

  async function copyInvitation(invitation: Invitation) {
    const inviteUrl = inviteLinks[invitation.id];
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setMessage(`The fresh invitation link for ${invitation.email} was copied.`);
  }

  async function revokeInvitation(invitation: Invitation) {
    setProcessingId(invitation.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/invitations/${invitation.id}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Could not revoke the invitation.");
        return;
      }
      setMessage(`Invitation for ${invitation.email} was revoked.`);
      setInviteLinks((current) => {
        const next = { ...current };
        delete next[invitation.id];
        return next;
      });
      await loadHousehold(homeId);
    } finally {
      setProcessingId("");
    }
  }

  function canManageMember(member: Member) {
    if (!canManage || member.role === "OWNER") return false;
    if (member.userId === currentUserId) return false;
    return currentRole === "OWNER" || member.role !== "ADMIN";
  }

  return (
    <main id="main" className="app-main">
      <div className="dashboard-head">
        <div>
          <small>Household access</small>
          <h1>Household</h1>
          <p>
            Invite several people, recover pending access, assign clear roles,
            and transfer ownership safely.
          </p>
        </div>
        <select
          aria-label="Selected home"
          value={homeId}
          onChange={(event) => {
            setHomeId(event.target.value);
            setMessage("");
            setError("");
            setInviteLinks({});
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

      <div className="dash-grid" style={{ marginTop: 32 }}>
        <section className="dash-card">
          <div className="dash-card-head">
            <h2>People with access</h2>
            <span>{members.length}</span>
          </div>
          <div className="animated-list">
            {members.map((member) => {
              const editable = canManageMember(member);
              const processing = processingId === member.id;
              return (
                <div className="dash-task member-row" key={member.id}>
                  <UserAvatar name={member.name} avatarUrl={member.avatarUrl} />
                  <div>
                    <strong>
                      {member.name}
                      {member.userId === currentUserId ? " · You" : ""}
                    </strong>
                    <small>
                      {member.email} · joined {new Intl.DateTimeFormat("en", {
                        dateStyle: "medium",
                      }).format(new Date(member.joinedAt))}
                    </small>
                  </div>
                  {editable ? (
                    <div className="member-actions">
                      <select
                        aria-label={`Role for ${member.name}`}
                        value={member.role}
                        disabled={processing}
                        onChange={(event) =>
                          void changeRole(member, event.target.value)
                        }
                      >
                        <option value="VIEWER">Viewer</option>
                        <option value="MEMBER">Member</option>
                        {currentRole === "OWNER" && (
                          <option value="ADMIN">Admin</option>
                        )}
                      </select>
                      {currentRole === "OWNER" && (
                        <button
                          className="icon-action"
                          type="button"
                          aria-label={`Transfer ownership to ${member.name}`}
                          title="Transfer ownership"
                          disabled={processing}
                          onClick={() => void transferOwnership(member)}
                        >
                          <Crown size={16} />
                        </button>
                      )}
                      <button
                        className="icon-action"
                        type="button"
                        aria-label={`Remove ${member.name}`}
                        disabled={processing}
                        onClick={() => void removeMember(member)}
                      >
                        {processing ? (
                          <LoaderCircle className="button-spinner" size={16} />
                        ) : (
                          <UserMinus size={16} />
                        )}
                      </button>
                    </div>
                  ) : (
                    <b>{member.role.toLowerCase()}</b>
                  )}
                </div>
              );
            })}
          </div>
          {!members.length && (
            <p className="muted-copy">No household members found.</p>
          )}
        </section>

        {canManage && (
          <form
            className={`dash-card auth-form ${submitting ? "is-submitting" : ""}`}
            onSubmit={invite}
          >
            <div className="dash-card-head">
              <h2>Invite people</h2>
              <MailPlus size={17} />
            </div>
            <div className="field">
              <label htmlFor="invite-emails">Email addresses</label>
              <textarea
                id="invite-emails"
                name="emails"
                required
                rows={5}
                disabled={submitting}
                placeholder={"sarah@example.com\nalex@example.com"}
              />
              <small className="field-hint">
                Add up to 20 addresses, separated by spaces, commas, or new
                lines.
              </small>
            </div>
            <div className="field">
              <label htmlFor="invite-role">Role for this group</label>
              <select id="invite-role" name="role" disabled={submitting}>
                <option value="MEMBER">Member · contribute</option>
                <option value="VIEWER">Viewer · read only</option>
                {currentRole === "OWNER" && (
                  <option value="ADMIN">Admin · manage</option>
                )}
              </select>
            </div>
            <button
              className="button"
              disabled={!homeId || submitting}
              type="submit"
            >
              {submitting ? (
                <LoaderCircle className="button-spinner" size={16} />
              ) : (
                <MailPlus size={16} />
              )}
              {submitting ? "Sending invitations…" : "Send invitations"}
            </button>
          </form>
        )}

        {canManage && (
          <section className="dash-card">
            <div className="dash-card-head">
              <h2>Pending invitations</h2>
              <ShieldCheck size={17} />
            </div>
            {invitations.map((invitation) => (
              <div className="pending-invitation" key={invitation.id}>
                <div>
                  <strong>{invitation.email}</strong>
                  <small>
                    {invitation.role.toLowerCase()} · expires{" "}
                    {new Intl.DateTimeFormat("en", {
                      dateStyle: "medium",
                    }).format(new Date(invitation.expiresAt))}
                  </small>
                </div>
                <div className="inline-actions">
                  <button
                    className="button button-secondary button-small"
                    type="button"
                    disabled={processingId === invitation.id}
                    onClick={() => void resendInvitation(invitation)}
                  >
                    {processingId === invitation.id ? (
                      <LoaderCircle className="button-spinner" size={15} />
                    ) : (
                      <RefreshCcw size={15} />
                    )}
                    Resend
                  </button>
                  {inviteLinks[invitation.id] && (
                    <button
                      className="button button-secondary button-small"
                      type="button"
                      onClick={() => void copyInvitation(invitation)}
                    >
                      <Copy size={15} />
                      Copy link
                    </button>
                  )}
                  <button
                    className="button button-secondary button-small"
                    type="button"
                    disabled={processingId === invitation.id}
                    onClick={() => void revokeInvitation(invitation)}
                  >
                    <X size={15} />
                    Revoke
                  </button>
                </div>
              </div>
            ))}
            {!invitations.length && (
              <p className="muted-copy">No invitations are waiting.</p>
            )}
          </section>
        )}

        <section className="dash-card role-guide-card">
          <div className="dash-card-head">
            <h2>Role guide</h2>
            <Info size={17} />
          </div>
          <dl className="detail-list">
            <div>
              <dt>Owner</dt>
              <dd>Full control, including ownership transfer and admins.</dd>
            </div>
            <div>
              <dt>Admin</dt>
              <dd>Manages the home, resources, members, and regular invites.</dd>
            </div>
            <div>
              <dt>Member</dt>
              <dd>Views the home and completes assigned maintenance.</dd>
            </div>
            <div>
              <dt>Viewer</dt>
              <dd>Read-only household access.</dd>
            </div>
          </dl>
        </section>
      </div>
    </main>
  );
}

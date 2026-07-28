const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]!);

export type EmailTemplate = { subject: string; text: string; html: string };

function layout(eyebrow: string, title: string, body: string, action?: { label: string; url: string }) {
  const safeUrl = action ? escapeHtml(action.url) : "";
  return `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width"></head>
  <body style="margin:0;background:#f5f6f2;color:#16221c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="display:none;max-height:0;overflow:hidden">${escapeHtml(title)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:32px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:auto;background:#fff;border:1px solid #e4e8e2;border-radius:20px">
  <tr><td style="padding:36px"><div style="font-size:21px;font-weight:700;letter-spacing:-.5px">⌂ Homi</div>
  <p style="margin:32px 0 8px;color:#617068;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">${escapeHtml(eyebrow)}</p>
  <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;letter-spacing:-.7px">${escapeHtml(title)}</h1>
  <div style="font-size:16px;line-height:1.65;color:#4b5b52">${body}</div>
  ${action ? `<p style="margin:28px 0 4px"><a href="${safeUrl}" style="display:inline-block;background:#1e6b4f;color:#fff;padding:13px 19px;border-radius:11px;text-decoration:none;font-weight:650">${escapeHtml(action.label)}</a></p>` : ""}
  <p style="margin:32px 0 0;padding-top:22px;border-top:1px solid #e8ebe7;color:#7a867f;font-size:13px;line-height:1.5">Homi keeps your home records private and under your control.</p>
  </td></tr></table></td></tr></table></body></html>`;
}

export function verificationEmail(name: string, url: string): EmailTemplate {
  return {
    subject: "Verify your Homi email",
    text: `Hi ${name}, verify your email to finish setting up Homi: ${url}`,
    html: layout("One last step", "Verify your email", `<p>Hi ${escapeHtml(name)}, confirm this email address to keep your home journal secure.</p>`, { label: "Verify email", url }),
  };
}

export function passwordResetEmail(name: string, url: string): EmailTemplate {
  return {
    subject: "Reset your Homi password",
    text: `Hi ${name}, reset your Homi password: ${url}\nThis link expires soon. Ignore this message if you did not request it.`,
    html: layout("Account security", "Reset your password", `<p>Hi ${escapeHtml(name)}, use the secure link below to choose a new password. If you did not request this, no action is needed.</p>`, { label: "Reset password", url }),
  };
}

export function invitationEmail(inviter: string, home: string, url: string): EmailTemplate {
  return {
    subject: `${inviter} invited you to ${home} on Homi`,
    text: `${inviter} invited you to help look after ${home}. Accept: ${url}`,
    html: layout("Household invitation", `Join ${home}`, `<p>${escapeHtml(inviter)} invited you to share maintenance, documents, and home records.</p>`, { label: "Accept invitation", url }),
  };
}

export function reminderEmail(title: string, detail: string, url: string): EmailTemplate {
  return {
    subject: title,
    text: `${title}\n${detail}\n${url}`,
    html: layout("A gentle reminder", title, `<p>${escapeHtml(detail)}</p>`, { label: "Open Homi", url }),
  };
}


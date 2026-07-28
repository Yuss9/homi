export type Preference = {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  maintenanceReminderDays: number;
  warrantyReminderDays: number;
  documentExpiryReminderDays: number;
};

export type ReminderKind = "MAINTENANCE" | "WARRANTY" | "DOCUMENT_EXPIRY";

export function reminderWindowDays(preference: Preference, kind: ReminderKind) {
  if (kind === "MAINTENANCE") return preference.maintenanceReminderDays;
  if (kind === "WARRANTY") return preference.warrantyReminderDays;
  return preference.documentExpiryReminderDays;
}

export function enabledChannels(preference: Preference) {
  return [
    ...(preference.inAppEnabled ? (["IN_APP"] as const) : []),
    ...(preference.emailEnabled ? (["EMAIL"] as const) : []),
  ];
}

export function shouldSendReminder(
  preference: Preference,
  kind: ReminderKind,
  dueAt: Date,
  now: Date,
) {
  const days = reminderWindowDays(preference, kind);
  const delta = dueAt.getTime() - now.getTime();
  return delta <= days * 86_400_000 && delta >= -86_400_000;
}


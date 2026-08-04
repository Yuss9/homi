import "server-only";

import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { assets, documents, homes, maintenanceTasks, repairRecords } from "@/db/schema";
import { AppError } from "@/src/server/errors";

function escapeIcs(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function utcStamp(value: Date) {
  return value
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(/\.\d{3}Z$/u, "Z");
}

function dateStamp(value: string) {
  return value.replaceAll("-", "");
}

type IcsEvent = {
  uid: string;
  summary: string;
  description?: string;
  url: string;
  date?: string;
  dateTime?: Date;
};

function eventLines(event: IcsEvent, now: Date) {
  const start = event.date
    ? `DTSTART;VALUE=DATE:${dateStamp(event.date)}`
    : `DTSTART:${utcStamp(event.dateTime ?? now)}`;
  return [
    "BEGIN:VEVENT",
    `UID:${escapeIcs(event.uid)}`,
    `DTSTAMP:${utcStamp(now)}`,
    start,
    `SUMMARY:${escapeIcs(event.summary)}`,
    event.description ? `DESCRIPTION:${escapeIcs(event.description)}` : null,
    `URL:${escapeIcs(event.url)}`,
    "END:VEVENT",
  ].filter((line): line is string => Boolean(line));
}

export async function buildHomeCalendar(homeId: string, appUrl: string) {
  const [home] = await db
    .select({ id: homes.id, name: homes.name })
    .from(homes)
    .where(and(eq(homes.id, homeId), isNull(homes.archivedAt)))
    .limit(1);
  if (!home) throw new AppError("NOT_FOUND", "Home not found.", 404);

  const [tasks, warranties, documentExpiries, repairs] = await Promise.all([
    db
      .select({
        id: maintenanceTasks.id,
        title: maintenanceTasks.title,
        description: maintenanceTasks.description,
        nextDueAt: maintenanceTasks.nextDueAt,
      })
      .from(maintenanceTasks)
      .where(
        and(
          eq(maintenanceTasks.homeId, homeId),
          isNull(maintenanceTasks.archivedAt),
        ),
      )
      .orderBy(asc(maintenanceTasks.nextDueAt)),
    db
      .select({
        id: assets.id,
        name: assets.name,
        warrantyEndDate: assets.warrantyEndDate,
      })
      .from(assets)
      .where(
        and(
          eq(assets.homeId, homeId),
          isNull(assets.archivedAt),
          sql`${assets.warrantyEndDate} is not null`,
        ),
      ),
    db
      .select({
        id: documents.id,
        title: documents.title,
        expiryDate: documents.expiryDate,
      })
      .from(documents)
      .where(
        and(
          eq(documents.homeId, homeId),
          sql`"documents"."archived_at" is null`,
          sql`${documents.expiryDate} is not null`,
        ),
      ),
    db
      .select({
        id: repairRecords.id,
        title: repairRecords.title,
        description: repairRecords.description,
        issueDate: repairRecords.issueDate,
        repairDate: repairRecords.repairDate,
      })
      .from(repairRecords)
      .where(
        and(
          eq(repairRecords.homeId, homeId),
          sql`"repair_records"."archived_at" is null`,
        ),
      ),
  ]);

  const events: IcsEvent[] = [
    ...tasks.map((task) => ({
      uid: `maintenance-${task.id}@homi`,
      summary: `Maintenance: ${task.title}`,
      description: task.description ?? undefined,
      dateTime: task.nextDueAt,
      url: new URL(`/maintenance?task=${task.id}`, appUrl).toString(),
    })),
    ...warranties.flatMap((asset) =>
      asset.warrantyEndDate
        ? [
            {
              uid: `warranty-${asset.id}@homi`,
              summary: `Warranty ends: ${asset.name}`,
              date: asset.warrantyEndDate,
              url: new URL(`/assets/${asset.id}`, appUrl).toString(),
            },
          ]
        : [],
    ),
    ...documentExpiries.flatMap((document) =>
      document.expiryDate
        ? [
            {
              uid: `document-${document.id}@homi`,
              summary: `Document expires: ${document.title}`,
              date: document.expiryDate,
              url: new URL("/documents", appUrl).toString(),
            },
          ]
        : [],
    ),
    ...repairs.map((repair) => ({
      uid: `repair-${repair.id}@homi`,
      summary: `Repair: ${repair.title}`,
      description: repair.description ?? undefined,
      date: repair.repairDate ?? repair.issueDate,
      url: new URL(`/repairs?repair=${repair.id}`, appUrl).toString(),
    })),
  ];

  const now = new Date();
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Homi//Private Home Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(`${home.name} · Homi`)}`,
    "X-WR-TIMEZONE:UTC",
    ...events.flatMap((event) => eventLines(event, now)),
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

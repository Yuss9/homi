import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { documentTagAssignments, documentTags } from "@/db/schema";
import { parseTags } from "@/src/features/documents/tags";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function replaceDocumentTags(
  tx: Transaction,
  documentId: string,
  homeId: string,
  input: unknown,
) {
  const tags = parseTags(input);

  await tx
    .delete(documentTagAssignments)
    .where(eq(documentTagAssignments.documentId, documentId));

  if (!tags.length) return [];

  await tx
    .insert(documentTags)
    .values(tags.map((tag) => ({ ...tag, homeId })))
    .onConflictDoNothing();

  const storedTags = await tx
    .select({ id: documentTags.id, name: documentTags.name })
    .from(documentTags)
    .where(
      and(
        eq(documentTags.homeId, homeId),
        inArray(
          documentTags.normalizedName,
          tags.map((tag) => tag.normalizedName),
        ),
      ),
    );

  if (storedTags.length) {
    await tx
      .insert(documentTagAssignments)
      .values(storedTags.map((tag) => ({ documentId, tagId: tag.id })))
      .onConflictDoNothing();
  }

  return storedTags.sort((a, b) => a.name.localeCompare(b.name));
}

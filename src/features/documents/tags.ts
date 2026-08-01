import { z } from "zod";

const tagSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .transform((value) => value.replace(/\s+/g, " "));

export function normalizeTagName(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("en-US");
}

export function parseTags(input: unknown) {
  const values = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(",")
      : [];

  const unique = new Map<string, string>();
  for (const value of values) {
    const parsed = tagSchema.safeParse(value);
    if (!parsed.success) continue;
    const normalized = normalizeTagName(parsed.data);
    if (!unique.has(normalized)) unique.set(normalized, parsed.data);
  }

  return [...unique.entries()]
    .slice(0, 10)
    .map(([normalizedName, name]) => ({ name, normalizedName }));
}

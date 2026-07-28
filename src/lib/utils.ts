import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function safeReturnTo(value: string | null | undefined, fallback = "/dashboard") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}

export function sanitizeFilename(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f"\\/:*?<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180) || "download";
}


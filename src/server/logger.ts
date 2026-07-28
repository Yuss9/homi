import { getEnv } from "./env";

type Context = Record<string, unknown>;
const sensitive = /password|token|secret|authorization|cookie|address/i;

function clean(value: unknown): unknown {
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        sensitive.test(key) ? "[REDACTED]" : clean(item),
      ]),
    );
  }
  return value;
}

function write(level: "debug" | "info" | "warn" | "error", context: Context, message: string) {
  const entry = { level, time: new Date().toISOString(), service: "homi", message, ...clean(context) as Context };
  if (getEnv().NODE_ENV === "production") {
    const line = JSON.stringify(entry);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  } else {
    const method = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    method.call(console, `[homi:${level}] ${message}`, clean(context));
  }
}

function normalize(first: Context | string, second?: string): [Context, string] {
  return typeof first === "string" ? [{}, first] : [first, second ?? "event"];
}

export const logger = {
  debug(first: Context | string, second?: string) {
    const [context, message] = normalize(first, second); write("debug", context, message);
  },
  info(first: Context | string, second?: string) {
    const [context, message] = normalize(first, second); write("info", context, message);
  },
  warn(first: Context | string, second?: string) {
    const [context, message] = normalize(first, second); write("warn", context, message);
  },
  error(first: Context | string, second?: string) {
    const [context, message] = normalize(first, second); write("error", context, message);
  },
};

// Structured JSON logger with redaction. Never log secrets, tokens, passwords,
// or document contents.

type Level = "debug" | "info" | "warn" | "error";

const REDACTED_KEYS = /pass(word)?|secret|token|cookie|authorization|api[-_]?key|hash/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[truncated]";
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value && typeof value === "object") {
    if (value instanceof Error) return { name: value.name, message: value.message };
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) =>
        REDACTED_KEYS.test(key) ? [key, "[redacted]"] : [key, redact(inner, depth + 1)],
      ),
    );
  }
  return value;
}

function write(level: Level, message: string, fields: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV === "test" && level !== "error") return;
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    message,
    ...(redact(fields) as Record<string, unknown>),
  });
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, fields?: Record<string, unknown>) => write("debug", message, fields),
  info: (message: string, fields?: Record<string, unknown>) => write("info", message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => write("warn", message, fields),
  error: (message: string, fields?: Record<string, unknown>) => write("error", message, fields),
};

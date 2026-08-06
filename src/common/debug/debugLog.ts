export type DebugLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type DebugLogEntry = {
  id: string;
  timestamp: string;
  level: DebugLogLevel;
  category: string;
  message: string;
  data?: unknown;
};

const STORAGE_KEY = 'firmshake.debugLogs';
const LEGACY_CLEARED_FLAG_KEY = 'firmshake.debugLogs.cleared';
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_STORAGE_BYTES = 10 * 1024 * 1024;

type DebugLogListener = (entries: DebugLogEntry[]) => void;

let memoryCache: DebugLogEntry[] | null = null;
const listeners = new Set<DebugLogListener>();

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function removeLegacyClearedFlags(): void {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(LEGACY_CLEARED_FLAG_KEY);
  }

  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(LEGACY_CLEARED_FLAG_KEY);
  }
}

/** Parse `YYYY-MM-DD HH:mm:ss GMT` timestamps written by {@link formatLogTimestamp}. */
function parseLogTimestamp(timestamp: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) GMT$/.exec(timestamp);
  if (!match) {
    return null;
  }

  const [, yyyy, mm, dd, hh, mi, ss] = match;
  return new Date(Date.UTC(
    Number(yyyy),
    Number(mm) - 1,
    Number(dd),
    Number(hh),
    Number(mi),
    Number(ss),
  ));
}

function getEntryTime(entry: DebugLogEntry): number | null {
  const parsed = parseLogTimestamp(entry.timestamp);
  if (parsed) {
    return parsed.getTime();
  }

  const idPrefix = Number(entry.id.split('-')[0]);
  return Number.isFinite(idPrefix) ? idPrefix : null;
}

function cleanupEntries(entries: DebugLogEntry[]): DebugLogEntry[] {
  const cutoff = Date.now() - MAX_AGE_MS;

  let cleaned = entries.filter((entry) => {
    const time = getEntryTime(entry);
    return time === null || time >= cutoff;
  });

  while (cleaned.length > 0 && JSON.stringify(cleaned).length > MAX_STORAGE_BYTES) {
    cleaned = cleaned.slice(1);
  }

  return cleaned;
}

function readRawStorage(): DebugLogEntry[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as DebugLogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readStorage(): DebugLogEntry[] {
  return cleanupEntries(readRawStorage());
}

function writeStorage(entries: DebugLogEntry[]): boolean {
  if (typeof localStorage === 'undefined') {
    return false;
  }

  try {
    removeLegacyClearedFlags();

    if (entries.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
      return localStorage.getItem(STORAGE_KEY) === null;
    }

    const json = JSON.stringify(entries);
    localStorage.setItem(STORAGE_KEY, json);
    return localStorage.getItem(STORAGE_KEY) === json;
  } catch {
    return false;
  }
}

function notifyListeners(entries: DebugLogEntry[]): void {
  const snapshot = [...entries];
  listeners.forEach((listener) => listener(snapshot));
}

function syncFromStorageEvent(): void {
  const stored = readStorage();
  if (stored.length >= (memoryCache?.length ?? 0)) {
    memoryCache = stored;
  }
  notifyListeners(memoryCache ?? []);
}

if (typeof window !== 'undefined') {
  initializeDebugLogStorage();

  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) {
      syncFromStorageEvent();
    }
  });
}

/** UTC/GMT timestamp with seconds, e.g. `2025-06-17 14:32:05 GMT`. */
export function formatLogTimestamp(date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mi = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss} GMT`;
}

export function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const record: Record<string, unknown> = {
      name: error.name,
      message: error.message,
    };

    if ('code' in error && typeof (error as { code: unknown }).code === 'string') {
      record.code = (error as { code: string }).code;
    }

    if (error.stack) {
      record.stack = error.stack;
    }

    return record;
  }

  return { value: String(error) };
}

function loadEntries(): DebugLogEntry[] {
  if (memoryCache === null) {
    memoryCache = readStorage();
  }

  return memoryCache;
}

function persist(entries: DebugLogEntry[]): void {
  memoryCache = cleanupEntries(entries);
  writeStorage(memoryCache);
  notifyListeners(memoryCache);
}

function initializeDebugLogStorage(): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  const raw = readRawStorage();
  if (raw.length === 0) {
    return;
  }

  const cleaned = cleanupEntries(raw);
  if (cleaned.length !== raw.length || JSON.stringify(cleaned) !== JSON.stringify(raw)) {
    writeStorage(cleaned);
  }

  memoryCache = cleaned;
}

function append(level: DebugLogLevel, category: string, message: string, data?: unknown): void {
  const entry: DebugLogEntry = {
    id: createId(),
    timestamp: formatLogTimestamp(),
    level,
    category,
    message,
    data: data === undefined ? undefined : sanitizeLogData(data),
  };

  const entries = [...loadEntries(), entry];
  persist(entries);
}

function sanitizeLogData(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (depth > 4) {
    return '[max depth]';
  }

  if (value instanceof Error) {
    return serializeError(value);
  }

  if (value instanceof File) {
    return { fileName: value.name, size: value.size, type: value.type };
  }

  if (value instanceof Blob) {
    return { blob: true, size: value.size, type: value.type };
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeLogData(item, depth + 1));
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};

    for (const [key, nested] of Object.entries(record)) {
      if (/^(password|token|secret|authorization)$/i.test(key)) {
        sanitized[key] = '[redacted]';
        continue;
      }

      sanitized[key] = sanitizeLogData(nested, depth + 1);
    }

    return sanitized;
  }

  if (typeof value === 'string' && value.length > 4000) {
    return `${value.slice(0, 4000)}…[truncated]`;
  }

  return value;
}

export const debugLog = {
  debug(category: string, message: string, data?: unknown): void {
    append('debug', category, message, data);
  },

  info(category: string, message: string, data?: unknown): void {
    append('info', category, message, data);
  },

  warn(category: string, message: string, data?: unknown): void {
    append('warn', category, message, data);
  },

  error(category: string, message: string, data?: unknown): void {
    append('error', category, message, data);
  },
};

export function getDebugLogs(): DebugLogEntry[] {
  return [...loadEntries()];
}

/** Re-read logs from localStorage without discarding newer in-memory entries. */
export function reloadDebugLogsFromStorage(): DebugLogEntry[] {
  const stored = readStorage();
  const inMemory = memoryCache ?? [];

  memoryCache = stored.length >= inMemory.length ? stored : inMemory;
  notifyListeners(memoryCache);
  return [...memoryCache];
}

export function clearDebugLogs(): void {
  memoryCache = [];
  writeStorage([]);
  removeLegacyClearedFlags();
  notifyListeners([]);
}

export function subscribeDebugLogs(listener: DebugLogListener): () => void {
  listeners.add(listener);
  listener(getDebugLogs());
  return () => listeners.delete(listener);
}

export function exportDebugLogsJson(): string {
  const payload = {
    exportedAt: formatLogTimestamp(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    entries: getDebugLogs(),
    entryCount: getDebugLogs().length,
    storageEntryCount: readStorage().length,
    memoryEntryCount: memoryCache?.length ?? 0,
  };

  return JSON.stringify(payload, null, 2);
}

export const DEBUG_LOG_SHARE_RECIPIENT = 'lucasmun09@gmail.com';

export function getDebugLogExportFilename(date = new Date()): string {
  const stamp = date.toISOString().replace(/[:.]/g, '-');
  return `firmshake-logs-${stamp}.json`;
}

export function getDebugLogShareEmailSubject(date = new Date()): string {
  return `Firm-Shake log file - ${formatLogTimestamp(date)}`;
}

export function getDebugLogShareEmailBody(filename: string): string {
  return [
    'Hi,',
    '',
    'Please attach the log file that was just downloaded to this email:',
    '',
    `  ${filename}`,
    '',
    'If you do not see the file, tap "Download logs" on the Debug logs page and attach it manually.',
    '',
    'Thank you!',
  ].join('\n');
}

export function buildDebugLogShareMailtoUrl(date = new Date()): string {
  const subject = getDebugLogShareEmailSubject(date);
  const body = getDebugLogShareEmailBody(getDebugLogExportFilename(date));

  // Use encodeURIComponent (%20) — not URLSearchParams (+), which mail clients leave literal.
  return `mailto:${DEBUG_LOG_SHARE_RECIPIENT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Triggers a browser download of the current debug logs. Returns the filename used. */
export function downloadDebugLogs(date = new Date()): string {
  const filename = getDebugLogExportFilename(date);
  const blob = new Blob([exportDebugLogsJson()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);

  return filename;
}

/** Router / bootstrap noise — collapsed by default on the /logs page. */
export function isMetaLogEntry(entry: DebugLogEntry): boolean {
  const { message } = entry;

  return (
    message === 'FirmShake starting'
    || message === 'LogsPage opened'
    || message === 'Router guard: waiting for authReady'
    || message === 'Router guard: evaluating'
    || message === 'Router guard: allowing navigation'
    || message.startsWith('Router navigation settled')
    || message === 'LoginPage: redirect recovery watch fired'
    || message === 'waitForAuthUser: immediate session user'
  );
}

export function maskPhoneNumber(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  if (digits.length <= 4) {
    return '****';
  }

  return `***${digits.slice(-4)}`;
}

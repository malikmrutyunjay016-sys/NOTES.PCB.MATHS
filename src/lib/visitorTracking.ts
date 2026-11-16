const VISITOR_ID_KEY = 'notes_portal_visitor_id';
const DWELL_KEY_PREFIX = 'notes_portal_course_dwell_v1_';
const QUALIFIED_KEY_PREFIX = 'notes_portal_course_qualified_v1_';

// Count unique visit after spending 30 seconds in the course
export const MIN_QUALIFIED_DWELL_SECONDS = 30;

const memoryDwell = new Map<string, { seconds: number; lastTickMs: number }>();
const memoryQualified = new Set<string>();
let memoryVisitorId: string | null = null;

function generateVisitorId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `v-${crypto.randomUUID()}`;
  }
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `v-${ts}-${rand}`;
}

export function getOrCreateVisitorId(): string {
  if (memoryVisitorId) return memoryVisitorId;

  try {
    const existing = window.localStorage.getItem(VISITOR_ID_KEY);
    if (existing && /^[a-zA-Z0-9_\-]{6,128}$/.test(existing)) {
      memoryVisitorId = existing;
      return existing;
    }
    const created = generateVisitorId();
    window.localStorage.setItem(VISITOR_ID_KEY, created);
    memoryVisitorId = created;
    return created;
  } catch {
    const created = generateVisitorId();
    memoryVisitorId = created;
    return created;
  }
}

export function hasCourseVisitorQualified(visitorId: string, courseId: string): boolean {
  const key = `${QUALIFIED_KEY_PREFIX}${visitorId}_${courseId}`;
  if (memoryQualified.has(key)) return true;
  try {
    const stored = window.localStorage.getItem(key) === '1';
    if (stored) memoryQualified.add(key);
    return stored;
  } catch {
    return false;
  }
}

export function markCourseVisitorQualifiedLocally(visitorId: string, courseId: string): void {
  const key = `${QUALIFIED_KEY_PREFIX}${visitorId}_${courseId}`;
  memoryQualified.add(key);
  try {
    window.localStorage.setItem(key, '1');
  } catch {
    // Fallback to in-memory set if localStorage is restricted
  }
}

export function getCourseDwellSeconds(visitorId: string, courseId: string): number {
  const key = `${DWELL_KEY_PREFIX}${visitorId}_${courseId}`;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as { seconds?: number; lastTickMs?: number };
      const secs = typeof parsed.seconds === 'number' && parsed.seconds >= 0 ? parsed.seconds : 0;
      const mem = memoryDwell.get(key)?.seconds ?? 0;
      return Math.max(secs, mem);
    }
  } catch {
    // Ignore storage read errors
  }
  return memoryDwell.get(key)?.seconds ?? 0;
}

export function incrementCourseDwellSecond(visitorId: string, courseId: string): number {
  const key = `${DWELL_KEY_PREFIX}${visitorId}_${courseId}`;
  const now = Date.now();
  let current = memoryDwell.get(key) || { seconds: 0, lastTickMs: 0 };

  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as { seconds?: number; lastTickMs?: number };
      const storedSeconds =
        typeof parsed.seconds === 'number' && parsed.seconds >= 0 ? parsed.seconds : 0;
      const storedLastTick =
        typeof parsed.lastTickMs === 'number' && parsed.lastTickMs >= 0 ? parsed.lastTickMs : 0;
      if (storedSeconds > current.seconds) {
        current = { seconds: storedSeconds, lastTickMs: storedLastTick };
      } else if (storedLastTick > current.lastTickMs) {
        current.lastTickMs = storedLastTick;
      }
    }
  } catch {
    // Ignore storage read errors
  }

  // Prevent double-ticking if two tabs of the same browser are visible simultaneously
  if (now - current.lastTickMs < 900) {
    memoryDwell.set(key, current);
    return current.seconds;
  }

  const next = {
    seconds: current.seconds + 1,
    lastTickMs: now,
  };
  memoryDwell.set(key, next);

  try {
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Ignore storage write errors
  }

  return next.seconds;
}

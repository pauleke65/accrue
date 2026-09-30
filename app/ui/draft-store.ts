/**
 * Keeps a half-written job form in this browser tab, so a session that
 * times out (signing sessions last 15 minutes) or an accidental reload does
 * not throw the work away. Tab-scoped and best effort: storage can be
 * unavailable, and then the form simply starts empty as before.
 */

const key = (name: string) => `accrue.draft.${name}`;

export function loadDraft<T>(name: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(key(name));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveDraft(name: string, value: unknown): void {
  try {
    window.sessionStorage.setItem(key(name), JSON.stringify(value));
  } catch {
    /* Storage full or blocked: the form still works, it just won't survive a reload. */
  }
}

export function clearDraft(name: string): void {
  try {
    window.sessionStorage.removeItem(key(name));
  } catch {
    /* Nothing to clear. */
  }
}

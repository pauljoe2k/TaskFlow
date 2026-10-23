import { openDB, type IDBPDatabase } from "idb";
import type { StoreApi } from "zustand";
import { appStateSchema, type PersistedAppState } from "@/types/schema";

/**
 * IndexedDB persistence via `idb`.
 *
 * - Writes are debounced so a burst of drags/edits produces one write.
 * - Everything is validated with Zod on load; corrupt payloads are backed up
 *   under a separate key and the app falls back to seed data instead of
 *   crashing on a blank screen.
 * - Persistence is best-effort: if IndexedDB is unavailable (private mode,
 *   storage blocked) the in-memory store keeps working.
 */

const DB_NAME = "taskflow";
const DB_VERSION = 1;
const STORE_NAME = "app-state";
const STATE_KEY = "current";
const CORRUPT_BACKUP_KEY = "corrupt-backup";

export const SAVE_DEBOUNCE_MS = 400;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available in this environment"));
  }
  dbPromise ??= openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    },
  });
  return dbPromise;
}

export type LoadResult =
  | { status: "empty" }
  | { status: "valid"; state: PersistedAppState }
  | { status: "corrupt"; raw: unknown };

export async function loadState(): Promise<LoadResult> {
  let raw: unknown;
  try {
    const db = await getDb();
    raw = await db.get(STORE_NAME, STATE_KEY);
  } catch {
    return { status: "empty" };
  }
  if (raw === undefined || raw === null) return { status: "empty" };
  const parsed = appStateSchema.safeParse(raw);
  if (parsed.success) return { status: "valid", state: parsed.data };
  return { status: "corrupt", raw };
}

export async function saveState(state: PersistedAppState): Promise<void> {
  try {
    const db = await getDb();
    await db.put(STORE_NAME, state, STATE_KEY);
  } catch {
    // Best-effort: in-memory state stays authoritative.
  }
}

export async function backupCorruptState(raw: unknown): Promise<void> {
  try {
    const db = await getDb();
    await db.put(STORE_NAME, { raw, backedUpAt: Date.now() }, CORRUPT_BACKUP_KEY);
    await db.delete(STORE_NAME, STATE_KEY);
  } catch {
    // Best-effort backup.
  }
}

type PersistableSlice = {
  boards: PersistedAppState["boards"];
  boardOrder: PersistedAppState["boardOrder"];
  activeBoardId: PersistedAppState["activeBoardId"];
};

/**
 * Subscribe to store changes and persist the durable slice with a debounce.
 * Returns a teardown function. The undo history is intentionally not
 * persisted: it holds pre-change references and would bloat the database.
 */
export function createPersistenceSubscription<T extends PersistableSlice>(
  store: Pick<StoreApi<T>, "subscribe">,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const unsubscribe = store.subscribe((state, previous) => {
    if (stopped) return;
    if (
      state.boards === previous.boards &&
      state.boardOrder === previous.boardOrder &&
      state.activeBoardId === previous.activeBoardId
    ) {
      return;
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void saveState({
        boards: state.boards,
        boardOrder: state.boardOrder,
        activeBoardId: state.activeBoardId,
      });
    }, SAVE_DEBOUNCE_MS);
  });

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    unsubscribe();
  };
}

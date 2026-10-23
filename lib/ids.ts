let counter = 0;

/**
 * Collision-resistant id generator that works in browsers, Node and jsdom
 * without pulling in a dependency. `crypto.randomUUID` is used when present.
 */
export function createId(prefix: string): string {
  const unique =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${(counter++).toString(36)}`;
  return `${prefix}_${unique}`;
}

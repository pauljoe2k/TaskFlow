/**
 * Pure list helpers. Drag-and-drop correctness lives here so it can be
 * unit-tested without rendering anything.
 */

/**
 * Move an item from index `from` to index `to` (both in the same array).
 * `to` is the post-removal insertion index, matching dnd-kit's `arrayMove`
 * semantics. Out-of-range indices return the list unchanged.
 */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to) return [...list];
  if (from < 0 || from >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item === undefined) return [...list];
  const clamped = Math.max(0, Math.min(to, next.length));
  next.splice(clamped, 0, item);
  return next;
}

/**
 * Given the card the user is dropping *onto*, return the insertion slot in
 * the destination list's current (pre-move) coordinates:
 * - `insertAfter: false` -> directly before the over card
 * - `insertAfter: true`  -> directly after the over card
 * - `overId: null`       -> end of the list (empty column / column background)
 */
export function computeTargetIndex(
  fullIds: readonly string[],
  overId: string | null,
  insertAfter: boolean,
): number {
  if (overId === null) return fullIds.length;
  const overIdx = fullIds.indexOf(overId);
  if (overIdx === -1) return fullIds.length;
  return insertAfter ? overIdx + 1 : overIdx;
}

/**
 * Convert a pre-move insertion slot into the final-index contract used by
 * `moveCard`: when the dragged card currently sits in the same list *before*
 * the slot, removing it shifts the slot one position left.
 */
export function toFinalIndex(preIndex: number, fromIndex: number): number {
  return fromIndex !== -1 && fromIndex < preIndex ? preIndex - 1 : preIndex;
}

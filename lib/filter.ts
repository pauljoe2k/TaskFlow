import type { Board, Card, Column } from "@/types/schema";

/**
 * Pure search + label filtering. Filtering must never mutate board state, so
 * every function here takes data in and returns data out.
 */

export interface FilterCriteria {
  query: string;
  labelIds: string[];
}

export const NO_FILTER: FilterCriteria = { query: "", labelIds: [] };

/** A card is visible when its text matches AND it carries any selected label. */
export function matchesFilter(card: Card, criteria: FilterCriteria): boolean {
  const query = criteria.query.trim().toLowerCase();
  const textMatches =
    query.length === 0 ||
    card.title.toLowerCase().includes(query) ||
    card.description.toLowerCase().includes(query);
  const labelMatches =
    criteria.labelIds.length === 0 ||
    criteria.labelIds.some((labelId) => card.labelIds.includes(labelId));
  return textMatches && labelMatches;
}

/** The subset of a column's cards that should currently be rendered. */
export function visibleCardIds(
  board: Board,
  column: Column,
  criteria: FilterCriteria,
): string[] {
  return column.cardIds.filter((id) => {
    const card = board.cards[id];
    return card !== undefined && matchesFilter(card, criteria);
  });
}

export function isFiltering(criteria: FilterCriteria): boolean {
  return criteria.query.trim().length > 0 || criteria.labelIds.length > 0;
}

export function countVisibleCards(board: Board, criteria: FilterCriteria): number {
  return board.columns.reduce(
    (total, column) => total + visibleCardIds(board, column, criteria).length,
    0,
  );
}

import { moveItem } from "@/lib/reorder";
import type { Board, Card, Column, Place } from "@/types/schema";

/**
 * Command-history pattern for undo/redo.
 *
 * Every mutation is expressed as a serializable Command describing *what
 * happened*. `applyCommand` moves state forward, `revertCommand` walks it
 * back. Both are pure functions over the boards map, which makes undo/redo
 * trivially testable and keeps history logic out of the React tree.
 *
 * Index semantics for `card.move`:
 * - `from.index`  index of the card in the source column before the move
 * - `to.index`    *final* index the card should occupy in the destination
 *                 column after the move (post-removal for same-column moves,
 *                 matching `moveItem`/dnd-kit `arrayMove`).
 */

export type Boards = Record<string, Board>;

export type Command =
  | { type: "column.add"; boardId: string; column: Column; index: number }
  | {
      type: "column.rename";
      boardId: string;
      columnId: string;
      before: string;
      after: string;
    }
  | {
      type: "column.delete";
      boardId: string;
      column: Column;
      index: number;
      cards: Record<string, Card>;
    }
  | { type: "card.add"; boardId: string; columnId: string; card: Card; index: number }
  | {
      type: "card.update";
      boardId: string;
      cardId: string;
      before: Partial<Pick<Card, "title" | "description" | "labelIds">>;
      after: Partial<Pick<Card, "title" | "description" | "labelIds">>;
    }
  | { type: "card.delete"; boardId: string; card: Card; columnId: string; index: number }
  | { type: "card.move"; boardId: string; cardId: string; from: Place; to: Place };

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function insertAt(list: readonly string[], index: number, id: string): string[] {
  const next = [...list];
  next.splice(clamp(index, 0, next.length), 0, id);
  return next;
}

function mapBoard(boards: Boards, boardId: string, update: (board: Board) => Board): Boards {
  const board = boards[boardId];
  if (!board) return boards;
  return { ...boards, [boardId]: update(board) };
}

function mapColumns(board: Board, update: (column: Column) => Column): Column[] {
  return board.columns.map(update);
}

/** Move a card out of a column, tolerating index drift by falling back to a lookup. */
function removeCard(column: Column, cardId: string, index: number): string[] {
  const cardIds = [...column.cardIds];
  if (cardIds[index] === cardId) {
    cardIds.splice(index, 1);
  } else {
    const found = cardIds.indexOf(cardId);
    if (found !== -1) cardIds.splice(found, 1);
  }
  return cardIds;
}

export function applyCommand(boards: Boards, command: Command): Boards {
  switch (command.type) {
    case "column.add":
      return mapBoard(boards, command.boardId, (board) => {
        const columns = [...board.columns];
        columns.splice(clamp(command.index, 0, columns.length), 0, command.column);
        return { ...board, columns, updatedAt: Date.now() };
      });

    case "column.rename":
      return mapBoard(boards, command.boardId, (board) => ({
        ...board,
        columns: mapColumns(board, (column) =>
          column.id === command.columnId ? { ...column, title: command.after } : column,
        ),
        updatedAt: Date.now(),
      }));

    case "column.delete":
      return mapBoard(boards, command.boardId, (board) => {
        const cards = { ...board.cards };
        for (const id of Object.keys(command.cards)) delete cards[id];
        return {
          ...board,
          columns: board.columns.filter((column) => column.id !== command.column.id),
          cards,
          updatedAt: Date.now(),
        };
      });

    case "card.add":
      return mapBoard(boards, command.boardId, (board) => ({
        ...board,
        cards: { ...board.cards, [command.card.id]: command.card },
        columns: mapColumns(board, (column) =>
          column.id === command.columnId
            ? { ...column, cardIds: insertAt(column.cardIds, command.index, command.card.id) }
            : column,
        ),
        updatedAt: Date.now(),
      }));

    case "card.update":
      return mapBoard(boards, command.boardId, (board) => {
        const existing = board.cards[command.cardId];
        if (!existing) return board;
        return {
          ...board,
          cards: {
            ...board.cards,
            [command.cardId]: { ...existing, ...command.after, updatedAt: Date.now() },
          },
          updatedAt: Date.now(),
        };
      });

    case "card.delete":
      return mapBoard(boards, command.boardId, (board) => {
        const cards = { ...board.cards };
        delete cards[command.card.id];
        return {
          ...board,
          cards,
          columns: mapColumns(board, (column) =>
            column.id === command.columnId
              ? { ...column, cardIds: column.cardIds.filter((id) => id !== command.card.id) }
              : column,
          ),
          updatedAt: Date.now(),
        };
      });

    case "card.move":
      return mapBoard(boards, command.boardId, (board) => {
        const { from, to, cardId } = command;
        if (from.columnId === to.columnId) {
          return {
            ...board,
            columns: mapColumns(board, (column) =>
              column.id === from.columnId
                ? { ...column, cardIds: moveItem(column.cardIds, from.index, to.index) }
                : column,
            ),
            updatedAt: Date.now(),
          };
        }
        return {
          ...board,
          columns: mapColumns(board, (column) => {
            if (column.id === from.columnId) {
              return { ...column, cardIds: removeCard(column, cardId, from.index) };
            }
            if (column.id === to.columnId) {
              return { ...column, cardIds: insertAt(column.cardIds, to.index, cardId) };
            }
            return column;
          }),
          updatedAt: Date.now(),
        };
      });
  }
}

/** Exact inverse of `applyCommand`. */
export function revertCommand(boards: Boards, command: Command): Boards {
  switch (command.type) {
    case "column.add":
      return mapBoard(boards, command.boardId, (board) => ({
        ...board,
        columns: board.columns.filter((column) => column.id !== command.column.id),
        updatedAt: Date.now(),
      }));

    case "column.rename":
      return applyCommand(boards, {
        ...command,
        type: "column.rename",
        before: command.after,
        after: command.before,
      });

    case "column.delete":
      return mapBoard(boards, command.boardId, (board) => {
        const columns = [...board.columns];
        columns.splice(clamp(command.index, 0, columns.length), 0, command.column);
        return { ...board, columns, cards: { ...board.cards, ...command.cards }, updatedAt: Date.now() };
      });

    case "card.add":
      return mapBoard(boards, command.boardId, (board) => {
        const cards = { ...board.cards };
        delete cards[command.card.id];
        return {
          ...board,
          cards,
          columns: mapColumns(board, (column) =>
            column.id === command.columnId
              ? { ...column, cardIds: column.cardIds.filter((id) => id !== command.card.id) }
              : column,
          ),
          updatedAt: Date.now(),
        };
      });

    case "card.update":
      return applyCommand(boards, {
        ...command,
        type: "card.update",
        before: command.after,
        after: command.before,
      });

    case "card.delete":
      return mapBoard(boards, command.boardId, (board) => ({
        ...board,
        cards: { ...board.cards, [command.card.id]: command.card },
        columns: mapColumns(board, (column) =>
          column.id === command.columnId
            ? { ...column, cardIds: insertAt(column.cardIds, command.index, command.card.id) }
            : column,
        ),
        updatedAt: Date.now(),
      }));

    case "card.move":
      return applyCommand(boards, {
        ...command,
        type: "card.move",
        from: command.to,
        to: command.from,
      });
  }
}

function quote(value: string | undefined, fallback: string): string {
  return `“${value?.trim() || fallback}”`;
}

/** Human-readable label used for screen-reader announcements and history. */
export function describeCommand(boards: Boards, command: Command): string {
  const board = boards[command.boardId];
  switch (command.type) {
    case "column.add":
      return `Added column ${quote(command.column.title, "Untitled")}`;
    case "column.rename":
      return `Renamed column ${quote(command.before, "Untitled")} to ${quote(command.after, "Untitled")}`;
    case "column.delete":
      return `Deleted column ${quote(command.column.title, "Untitled")}`;
    case "card.add":
      return `Added card ${quote(command.card.title, "Untitled")} to ${quote(
        board?.columns.find((c) => c.id === command.columnId)?.title,
        "column",
      )}`;
    case "card.update":
      return `Edited card ${quote(board?.cards[command.cardId]?.title, "Untitled")}`;
    case "card.delete":
      return `Deleted card ${quote(command.card.title, "Untitled")}`;
    case "card.move":
      return `Moved ${quote(board?.cards[command.cardId]?.title, "card")} to ${quote(
        board?.columns.find((c) => c.id === command.to.columnId)?.title,
        "column",
      )}`;
  }
}

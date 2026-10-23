import { create } from "zustand";
import {
  applyCommand,
  describeCommand,
  revertCommand,
  type Command,
} from "@/lib/commands";
import { createId } from "@/lib/ids";
import { backupCorruptState, loadState } from "@/lib/persistence";
import { createSeedState } from "@/lib/seed";
import type { Board, Card, CardDraft, Place, PersistedAppState } from "@/types/schema";

/**
 * The single source of truth for board data.
 *
 * State flow: components call actions -> actions build Commands -> Commands
 * are applied through the pure command engine -> new immutable state ->
 * selectors re-render only the components that read the changed slices.
 */

export const MAX_HISTORY = 50;

export type StateReader = () => Promise<
  { status: "empty" } | { status: "valid"; state: PersistedAppState } | { status: "corrupt"; raw: unknown }
>;

export interface TaskFlowStore extends PersistedAppState {
  past: Command[];
  future: Command[];
  hydrated: boolean;
  storageRecovered: boolean;
  liveMessage: string;

  hydrate: (reader?: StateReader) => Promise<void>;
  addColumn: (title: string) => void;
  renameColumn: (columnId: string, title: string) => void;
  deleteColumn: (columnId: string) => void;
  addCard: (columnId: string, draft: CardDraft) => void;
  updateCard: (cardId: string, patch: Partial<CardDraft>) => void;
  deleteCard: (cardId: string) => void;
  moveCard: (cardId: string, to: Place) => void;
  undo: () => void;
  redo: () => void;
  setActiveBoard: (boardId: string) => void;
  announce: (message: string) => void;
  dismissStorageNotice: () => void;
}

function pushPast(past: Command[], command: Command): Command[] {
  const next = [...past, command];
  return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
}

function findPlace(board: Board, cardId: string): Place | null {
  for (const column of board.columns) {
    const index = column.cardIds.indexOf(cardId);
    if (index !== -1) return { columnId: column.id, index };
  }
  return null;
}

const seed = createSeedState();

export const useTaskFlowStore = create<TaskFlowStore>((set, get) => {
  const commit = (command: Command) => {
    const state = get();
    const boards = applyCommand(state.boards, command);
    set({
      boards,
      past: pushPast(state.past, command),
      future: [],
      liveMessage: describeCommand(state.boards, command),
    });
  };

  return {
    ...seed,
    past: [],
    future: [],
    hydrated: false,
    storageRecovered: false,
    liveMessage: "",

    hydrate: async (reader: StateReader = loadState) => {
      if (get().hydrated) return;
      const result = await reader();
      if (result.status === "valid") {
        set({
          boards: result.state.boards,
          boardOrder: result.state.boardOrder,
          activeBoardId: result.state.activeBoardId,
          hydrated: true,
          liveMessage: "Board data loaded",
        });
        return;
      }
      if (result.status === "corrupt") {
        await backupCorruptState(result.raw);
        set({
          ...seed,
          hydrated: true,
          storageRecovered: true,
          liveMessage: "Saved data was corrupted, restored sample boards",
        });
        return;
      }
      set({ ...seed, hydrated: true, liveMessage: "Loaded sample boards" });
    },

    addColumn: (title) => {
      const state = get();
      const boardId = state.activeBoardId;
      const board = state.boards[boardId];
      const trimmed = title.trim();
      if (!board || !trimmed) return;
      commit({
        type: "column.add",
        boardId,
        column: { id: createId("col"), title: trimmed.slice(0, 60), cardIds: [] },
        index: board.columns.length,
      });
    },

    renameColumn: (columnId, title) => {
      const state = get();
      const board = state.boards[state.activeBoardId];
      const column = board?.columns.find((c) => c.id === columnId);
      const trimmed = title.trim();
      if (!board || !column || !trimmed || trimmed === column.title) return;
      commit({
        type: "column.rename",
        boardId: board.id,
        columnId,
        before: column.title,
        after: trimmed.slice(0, 60),
      });
    },

    deleteColumn: (columnId) => {
      const state = get();
      const board = state.boards[state.activeBoardId];
      const index = board?.columns.findIndex((c) => c.id === columnId) ?? -1;
      if (!board || index === -1) return;
      const column = board.columns[index];
      if (!column) return;
      const cards: Record<string, Card> = {};
      for (const id of column.cardIds) {
        const card = board.cards[id];
        if (card) cards[id] = card;
      }
      commit({ type: "column.delete", boardId: board.id, column, index, cards });
    },

    addCard: (columnId, draft) => {
      const state = get();
      const board = state.boards[state.activeBoardId];
      const column = board?.columns.find((c) => c.id === columnId);
      const title = draft.title.trim();
      if (!board || !column || !title) return;
      const now = Date.now();
      const card: Card = {
        id: createId("card"),
        title: title.slice(0, 120),
        description: draft.description.slice(0, 4000),
        labelIds: [...draft.labelIds],
        createdAt: now,
        updatedAt: now,
      };
      commit({ type: "card.add", boardId: board.id, columnId, card, index: column.cardIds.length });
    },

    updateCard: (cardId, patch) => {
      const state = get();
      const board = state.boards[state.activeBoardId];
      const card = board?.cards[cardId];
      if (!board || !card) return;
      const before: Partial<Card> = {};
      const after: Partial<Card> = {};
      if (patch.title !== undefined && patch.title.trim() && patch.title !== card.title) {
        before.title = card.title;
        after.title = patch.title.trim().slice(0, 120);
      }
      if (patch.description !== undefined && patch.description !== card.description) {
        before.description = card.description;
        after.description = patch.description.slice(0, 4000);
      }
      if (
        patch.labelIds !== undefined &&
        patch.labelIds.join("\u0000") !== card.labelIds.join("\u0000")
      ) {
        before.labelIds = [...card.labelIds];
        after.labelIds = [...patch.labelIds];
      }
      if (Object.keys(after).length === 0) return;
      commit({ type: "card.update", boardId: board.id, cardId, before, after });
    },

    deleteCard: (cardId) => {
      const state = get();
      const board = state.boards[state.activeBoardId];
      const place = board ? findPlace(board, cardId) : null;
      const card = board?.cards[cardId];
      if (!board || !place || !card) return;
      commit({ type: "card.delete", boardId: board.id, card, columnId: place.columnId, index: place.index });
    },

    moveCard: (cardId, to) => {
      const state = get();
      const board = state.boards[state.activeBoardId];
      const from = board ? findPlace(board, cardId) : null;
      if (!board || !from) return;
      const destination = board.columns.find((c) => c.id === to.columnId);
      if (!destination) return;
      const clamped: Place = {
        columnId: to.columnId,
        index: Math.max(0, Math.min(to.index, destination.cardIds.length)),
      };
      if (from.columnId === clamped.columnId && from.index === clamped.index) return;
      commit({ type: "card.move", boardId: board.id, cardId, from, to: clamped });
    },

    undo: () => {
      const state = get();
      const command = state.past[state.past.length - 1];
      if (!command) return;
      set({
        boards: revertCommand(state.boards, command),
        past: state.past.slice(0, -1),
        future: [command, ...state.future].slice(0, MAX_HISTORY),
        liveMessage: `Undid: ${describeCommand(state.boards, command)}`,
      });
    },

    redo: () => {
      const state = get();
      const command = state.future[0];
      if (!command) return;
      set({
        boards: applyCommand(state.boards, command),
        past: pushPast(state.past, command),
        future: state.future.slice(1),
        liveMessage: `Redid: ${describeCommand(applyCommand(state.boards, command), command)}`,
      });
    },

    setActiveBoard: (boardId) => {
      const state = get();
      if (!state.boards[boardId] || state.activeBoardId === boardId) return;
      set({ activeBoardId: boardId, liveMessage: `Switched to ${state.boards[boardId]?.name}` });
    },

    announce: (message) => set({ liveMessage: message }),

    dismissStorageNotice: () => set({ storageRecovered: false }),
  };
});

/** Convenience selectors keep component subscriptions narrow. */
export const selectActiveBoard = (state: TaskFlowStore): Board | undefined =>
  state.boards[state.activeBoardId];

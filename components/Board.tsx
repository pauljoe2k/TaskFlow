"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useState } from "react";
import { BoardColumn } from "@/components/Column";
import { CardFace } from "@/components/CardItem";
import { IconPlus } from "@/components/icons";
import { type FilterCriteria, computeNothing } from "@/lib/filter";
import { computeTargetIndex, toFinalIndex } from "@/lib/reorder";
import { selectActiveBoard, useTaskFlowStore } from "@/store/taskflow-store";
import type { Place } from "@/types/schema";

/** Droppable id prefix for the body of a column (empty-area drops). */
export const COLUMN_DROP_PREFIX = "column-drop:";

interface BoardProps {
  criteria: FilterCriteria;
  onEditCard: (cardId: string) => void;
  onCreateCard: (columnId: string) => void;
}

function findPlaceOfCard(
  board: NonNullable<ReturnType<typeof selectActiveBoard>>,
  cardId: string,
): Place | null {
  for (const column of board.columns) {
    const index = column.cardIds.indexOf(cardId);
    if (index !== -1) return { columnId: column.id, index };
  }
  return null;
}

export function Board({ criteria, onEditCard, onCreateCard }: BoardProps) {
  const board = useTaskFlowStore(selectActiveBoard);
  const moveCard = useTaskFlowStore((state) => state.moveCard);
  const addColumn = useTaskFlowStore((state) => state.addColumn);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!board) return null;

  const activeCard = activeCardId ? board.cards[activeCardId] : undefined;

  const cardTitle = (id: string): string => board.cards[id]?.title ?? "card";

  const destinationLabel = (overId: string): string => {
    if (overId.startsWith(COLUMN_DROP_PREFIX)) {
      const columnId = overId.slice(COLUMN_DROP_PREFIX.length);
      return `${board.columns.find((c) => c.id === columnId)?.title ?? "a column"} column`;
    }
    const place = findPlaceOfCard(board, overId);
    const columnTitle = place
      ? board.columns.find((c) => c.id === place.columnId)?.title
      : undefined;
    return `card ${cardTitle(overId)} in ${columnTitle ?? "a column"}`;
  };

  const announcements = {
    onDragStart: ({ active }: DragStartEvent) =>
      `Picked up card ${cardTitle(String(active.id))}.`,
    onDragOver: ({ active, over }: DragEndEvent) =>
      over
        ? `Card ${cardTitle(String(active.id))} is over ${destinationLabel(String(over.id))}.`
        : `Card ${cardTitle(String(active.id))} is not over a droppable area.`,
    onDragEnd: ({ active, over }: DragEndEvent) =>
      over
        ? `Card ${cardTitle(String(active.id))} was dropped on ${destinationLabel(String(over.id))}.`
        : `Card ${cardTitle(String(active.id))} was dropped.`,
    onDragCancel: () => "Dragging cancelled.",
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(String(event.active.id));
  };

  const handleDragCancel = () => setActiveCardId(null);

  /**
   * A single, authoritative move at drop time. Computing the final index from
   * the *over card's identity* (not its visible position) keeps drops correct
   * while search/label filters are active.
   */
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveCardId(null);
    if (!over) return;
    const cardId = String(active.id);
    const overId = String(over.id);

    const source = findPlaceOfCard(board, cardId);
    if (!source || !board.cards[cardId]) return;

    let toColumnId: string;
    let overCardId: string | null = null;
    if (overId.startsWith(COLUMN_DROP_PREFIX)) {
      toColumnId = overId.slice(COLUMN_DROP_PREFIX.length);
    } else {
      const overPlace = findPlaceOfCard(board, overId);
      if (!overPlace) return;
      toColumnId = overPlace.columnId;
      overCardId = overId;
    }

    const destination = board.columns.find((column) => column.id === toColumnId);
    if (!destination) return;

    let insertAfter = false;
    if (overCardId) {
      const activeRect = active.rect.current.translated ?? active.rect.current.initial;
      if (activeRect && over.rect.height > 0) {
        const activeCenter = activeRect.top + activeRect.height / 2;
        const overCenter = over.rect.top + over.rect.height / 2;
        insertAfter = activeCenter > overCenter;
      }
    }

    const preIndex = computeTargetIndex(destination.cardIds, overCardId, insertAfter);
    const fromIndex = source.columnId === toColumnId ? source.index : -1;
    moveCard(cardId, { columnId: toColumnId, index: toFinalIndex(preIndex, fromIndex) });
  };

  const submitNewColumn = (event: React.FormEvent) => {
    event.preventDefault();
    const title = newColumnTitle.trim();
    if (!title) {
      setAddingColumn(false);
      return;
    }
    addColumn(title);
    setNewColumnTitle("");
  };

  return (
    <DndContext
      sensors={sensors}
      accessibility={{ announcements }}
      onDragStart={handleDragStart}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
    >
      <section
        aria-label={`Board: ${board.name}`}
        className="flex flex-1 flex-col overflow-x-auto p-4"
      >
        <div className="flex min-h-full items-start gap-4 pb-2">
          {board.columns.map((column) => (
            <BoardColumn
              key={column.id}
              board={board}
              column={column}
              criteria={criteria}
              onEditCard={onEditCard}
              onCreateCard={onCreateCard}
            />
          ))}

          <div className="w-72 shrink-0">
            {addingColumn ? (
              <form
                onSubmit={submitNewColumn}
                className="rounded-xl border border-dashed border-slate-300 bg-white/70 p-3 dark:border-slate-700 dark:bg-slate-900/70"
              >
                <label className="sr-only" htmlFor="new-column-title">
                  New column title
                </label>
                <input
                  id="new-column-title"
                  autoFocus
                  value={newColumnTitle}
                  onChange={(event) => setNewColumnTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setAddingColumn(false);
                      setNewColumnTitle("");
                    }
                  }}
                  placeholder="Column title"
                  maxLength={60}
                  className="mb-2 w-full rounded-md border border-slate-300 bg-transparent px-2 py-1.5 text-sm dark:border-slate-700"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded-md bg-indigo-600 px-2.5 py-1 text-sm font-medium text-white hover:bg-indigo-500"
                  >
                    Add column
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingColumn(false);
                      setNewColumnTitle("");
                    }}
                    className="rounded-md px-2.5 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setAddingColumn(true)}
                className="flex w-full items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
              >
                <IconPlus />
                Add column
              </button>
            )}
          </div>
        </div>
      </section>

      <DragOverlay dropAnimation={{ duration: 160, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
        {activeCard ? (
          <div className="rotate-2 cursor-grabbing opacity-95 shadow-2xl">
            <CardFace card={activeCard} labels={board.labels} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

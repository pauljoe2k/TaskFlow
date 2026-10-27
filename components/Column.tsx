"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useRef, useState } from "react";
import { COLUMN_DROP_PREFIX } from "@/components/Board";
import { CardItem } from "@/components/CardItem";
import { IconPencil, IconPlus, IconTrash } from "@/components/icons";
import { isFiltering, visibleCardIds, type FilterCriteria } from "@/lib/filter";
import { useTaskFlowStore } from "@/store/taskflow-store";
import type { Board, Column } from "@/types/schema";

interface BoardColumnProps {
  board: Board;
  column: Column;
  criteria: FilterCriteria;
  onEditCard: (cardId: string) => void;
  onCreateCard: (columnId: string) => void;
}

export function BoardColumn({ board, column, criteria, onEditCard }: BoardColumnProps) {
  const { setNodeRef } = useDroppable({ id: `${COLUMN_DROP_PREFIX}${column.id}` });
  const renameColumn = useTaskFlowStore((state) => state.renameColumn);
  const deleteColumn = useTaskFlowStore((state) => state.deleteColumn);
  const announce = useTaskFlowStore((state) => state.announce);

  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState(column.title);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const visibleIds = visibleCardIds(board, column, criteria);
  const filtered = isFiltering(criteria);
  const hiddenCount = column.cardIds.length - visibleIds.length;

  const commitRename = () => {
    const title = titleDraft.trim();
    if (title && title !== column.title) renameColumn(column.id, title);
    setTitleDraft(title || column.title);
    setRenaming(false);
  };

  const requestDelete = () => {
    if (column.cardIds.length > 0 && !confirmingDelete) {
      setConfirmingDelete(true);
      announce(`Confirm deleting column ${column.title} and its ${column.cardIds.length} cards`);
      return;
    }
    deleteColumn(column.id);
  };

  return (
    <section
      id={`column-${column.id}`}
      tabIndex={-1}
      aria-label={`${column.title} column`}
      className="flex max-h-full w-72 shrink-0 flex-col rounded-xl border border-slate-200 bg-white/80 shadow-sm dark:border-slate-800 dark:bg-slate-900/80"
    >
      <header className="flex items-center gap-2 px-3 py-2.5">
        {renaming ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitRename();
              } else if (event.key === "Escape") {
                setTitleDraft(column.title);
                setRenaming(false);
              }
            }}
            maxLength={60}
            aria-label="Column title"
            className="w-full rounded-md border border-indigo-400 bg-transparent px-1.5 py-0.5 text-sm font-semibold"
          />
        ) : (
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            {column.title}
          </h2>
        )}

        <span
          className="rounded-full bg-slate-100 px-2 py-0.5 text-xs tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          aria-label={
            filtered
              ? `${visibleIds.length} of ${column.cardIds.length} cards shown`
              : `${column.cardIds.length} cards`
          }
        >
          {filtered ? `${visibleIds.length}/${column.cardIds.length}` : column.cardIds.length}
        </span>

        <button
          type="button"
          onClick={() => {
            setTitleDraft(column.title);
            setRenaming(true);
          }}
          aria-label={`Rename column ${column.title}`}
          className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <IconPencil />
        </button>
        <button
          type="button"
          onClick={requestDelete}
          onBlur={() => setConfirmingDelete(false)}
          aria-label={
            confirmingDelete
              ? `Confirm delete column ${column.title}`
              : `Delete column ${column.title}`
          }
          className={`rounded-md p-1 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950 ${
            confirmingDelete ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" : "text-slate-400"
          }`}
        >
          <IconTrash />
        </button>
      </header>

      {confirmingDelete && (
        <p role="alert" className="px-3 pb-1 text-xs text-rose-600 dark:text-rose-400">
          Press delete again to remove this column{column.cardIds.length > 0 ? " and its cards" : ""}.
        </p>
      )}

      <ul
        ref={setNodeRef}
        aria-label={`${column.title} cards`}
        className="lane-scrollbar flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-2"
      >
        <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
          {visibleIds.map((cardId) => {
            const card = board.cards[cardId];
            if (!card) return null;
            return <CardItem key={cardId} card={card} labels={board.labels} onEdit={onEditCard} />;
          })}
        </SortableContext>
        {visibleIds.length === 0 && (
          <li
            aria-hidden="true"
            className="grid min-h-16 place-items-center rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400"
          >
            {filtered ? "No matching cards" : "Drop cards here"}
          </li>
        )}
      </ul>

      {hiddenCount > 0 && (
        <p className="px-3 pb-1 text-xs text-slate-500 dark:text-slate-400">
          {hiddenCount} hidden by filters
        </p>
      )}

      <QuickAddCard columnId={column.id} />
    </section>
  );
}

function QuickAddCard({ columnId }: { columnId: string }) {
  const addCard = useTaskFlowStore((state) => state.addCard);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="m-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
      >
        <IconPlus />
        Add card
      </button>
    );
  }

  const submit = () => {
    const trimmed = title.trim();
    if (trimmed) addCard(columnId, { title: trimmed, description: "", labelIds: [] });
    setTitle("");
    inputRef.current?.focus();
  };

  return (
    <form
      className="m-2 rounded-lg border border-indigo-300 bg-white p-2 dark:border-indigo-700 dark:bg-slate-900"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label className="sr-only" htmlFor={`quick-add-${columnId}`}>
        New card title
      </label>
      <textarea
        id={`quick-add-${columnId}`}
        ref={inputRef}
        autoFocus
        rows={2}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            setTitle("");
          } else if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        placeholder="Card title, then Enter"
        className="w-full resize-none bg-transparent text-sm outline-none"
      />
      <div className="mt-1 flex items-center gap-2">
        <button
          type="submit"
          className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-500"
        >
          Add card
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setTitle("");
          }}
          className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          Close
        </button>
      </div>
    </form>
  );
}

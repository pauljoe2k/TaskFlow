"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, useReducedMotion } from "framer-motion";
import { IconPencil } from "@/components/icons";
import type { Card, Label } from "@/types/schema";

interface CardFaceProps {
  card: Card;
  labels: Label[];
  onEdit?: (cardId: string) => void;
}

const createdFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

/** Presentational card face, shared by the sortable card and the drag overlay. */
export function CardFace({ card, labels, onEdit }: CardFaceProps) {
  const cardLabels = labels.filter((label) => card.labelIds.includes(label.id));
  const created = new Date(card.createdAt);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      {cardLabels.length > 0 && (
        <ul aria-label="Labels" className="mb-1.5 flex flex-wrap gap-1">
          {cardLabels.map((label) => (
            <li
              key={label.id}
              className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300"
              style={{ borderColor: label.color }}
            >
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: label.color }} />
              {label.name}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => onEdit?.(card.id)}
        className="w-full text-left focus-visible:rounded-md"
        aria-label={`Edit card ${card.title}`}
      >
        <span className="block text-sm font-medium leading-snug text-slate-800 dark:text-slate-100">
          {card.title}
        </span>
      </button>

      {card.description && (
        <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{card.description}</p>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <time
          dateTime={created.toISOString().slice(0, 10)}
          className="text-[11px] text-slate-500 dark:text-slate-400"
        >
          {createdFormatter.format(created)}
        </time>
        {onEdit && (
          <button
            type="button"
            onClick={() => onEdit(card.id)}
            aria-label={`Open editor for card ${card.title}`}
            className="rounded-md p-1 text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-indigo-600 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:bg-slate-700 dark:hover:text-indigo-300"
          >
            <IconPencil />
          </button>
        )}
      </div>
    </div>
  );
}

interface CardItemProps {
  card: Card;
  labels: Label[];
  onEdit: (cardId: string) => void;
}

/**
 * Sortable wrapper around CardFace.
 *
 * Dragging happens from the grip handle: it carries dnd-kit's listeners and
 * keyboard sensor, so Tab reaches the handle, Space lifts the card, arrows
 * move it and Space drops it — while the title stays a normal button that
 * opens the editor. No competing keyboard handlers.
 */
export function CardItem({ card, labels, onEdit }: CardItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });
  const reduceMotion = useReducedMotion();

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <motion.li
      ref={setNodeRef}
      style={style}
      layout={reduceMotion ? false : !isDragging}
      className={`group relative ${isDragging ? "opacity-30" : ""}`}
    >
      <CardFace card={card} labels={labels} onEdit={onEdit} />
      <button
        type="button"
        aria-label={`Drag card ${card.title}`}
        className="absolute right-1.5 top-1.5 cursor-grab touch-none rounded-md p-1 text-slate-300 opacity-0 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:opacity-100 group-hover:opacity-100 dark:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
        {...listeners}
        {...attributes}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
          <circle cx="9" cy="5" r="1.6" />
          <circle cx="15" cy="5" r="1.6" />
          <circle cx="9" cy="12" r="1.6" />
          <circle cx="15" cy="12" r="1.6" />
          <circle cx="9" cy="19" r="1.6" />
          <circle cx="15" cy="19" r="1.6" />
        </svg>
      </button>
    </motion.li>
  );
}

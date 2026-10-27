"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconClose, IconTrash } from "@/components/icons";
import { getFocusable, trapTabKey } from "@/lib/focus-trap";
import { selectActiveBoard, useTaskFlowStore } from "@/store/taskflow-store";

export type ModalState =
  | { mode: "create"; columnId: string }
  | { mode: "edit"; cardId: string };

interface CardModalProps {
  state: ModalState;
  onClose: () => void;
}

/**
 * Modal dialog for creating and editing cards.
 *
 * Accessibility contract: role=dialog + aria-modal, focus moves into the
 * dialog on open, Tab is trapped, Escape closes, and focus returns to the
 * element that opened it.
 */
export function CardModal({ state, onClose }: CardModalProps) {
  const board = useTaskFlowStore(selectActiveBoard);
  const addCard = useTaskFlowStore((store) => store.addCard);
  const updateCard = useTaskFlowStore((store) => store.updateCard);
  const deleteCard = useTaskFlowStore((store) => store.deleteCard);

  const card = state.mode === "edit" ? board?.cards[state.cardId] : undefined;
  const column =
    state.mode === "create"
      ? board?.columns.find((candidate) => candidate.id === state.columnId)
      : board?.columns.find((candidate) =>
          card ? candidate.cardIds.includes(card.id) : false,
        );

  const [title, setTitle] = useState(card?.title ?? "");
  const [description, setDescription] = useState(card?.description ?? "");
  const [labelIds, setLabelIds] = useState<string[]>(card ? [...card.labelIds] : []);
  const [touched, setTouched] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const closedRef = useRef(false);
  const reduceMotion = useReducedMotion();

  /** Idempotent close: several paths (button, Escape, backdrop, missing card)
   *  may race to close the dialog, but onClose fires exactly once. */
  const close = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    onClose();
  }, [onClose]);

  // Editing a card that no longer exists (deleted elsewhere): close.
  useEffect(() => {
    if (state.mode === "edit" && !card) close();
  }, [state, card, close]);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const focusable = dialogRef.current ? getFocusable(dialogRef.current) : [];
    // Prefer the primary field; fall back to the first focusable element.
    const initial =
      dialogRef.current?.querySelector<HTMLElement>("#card-title") ??
      focusable[0] ??
      dialogRef.current;
    initial?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus();
    };
  }, []);

  const valid = title.trim().length > 0;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!valid) return;      if (state.mode === "create") {
        addCard(state.columnId, { title, description, labelIds });
      } else {
        updateCard(state.cardId, { title, description, labelIds });
      }
      close();
    };

  const toggleLabel = (labelId: string) => {
    setLabelIds((current) =>
      current.includes(labelId)
        ? current.filter((id) => id !== labelId)
        : [...current, labelId],
    );
  };

  const motionProps = reduceMotion
    ? { initial: false as const }
    : {
        initial: { opacity: 0, scale: 0.96, y: 10 },
        animate: { opacity: 1, scale: 1, y: 0 },
        transition: { duration: 0.15 },
      };

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-modal-title"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            close();
            return;
          }
          trapTabKey(event.nativeEvent, event.currentTarget);
        }}
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        {...motionProps}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="card-modal-title" className="text-base font-semibold text-slate-900 dark:text-slate-50">
              {state.mode === "create" ? "New card" : "Edit card"}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {state.mode === "create"
                ? `Adding to ${column?.title ?? "column"}`
                : `In ${column?.title ?? "a column"}`}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close dialog"
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <IconClose />
          </button>
        </div>

        <form onSubmit={submit} noValidate>
          <div className="mb-4">
            <label htmlFor="card-title" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Title
            </label>
            <input
              id="card-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => setTouched(true)}
              maxLength={120}
              aria-invalid={touched && !valid}
              aria-describedby={touched && !valid ? "card-title-error" : undefined}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              placeholder="What needs doing?"
            />
            {touched && !valid && (
              <p id="card-title-error" role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                A title is required.
              </p>
            )}
          </div>

          <div className="mb-4">
            <label
              htmlFor="card-description"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Description{" "}
              <span className="font-normal text-slate-500 dark:text-slate-400">(optional)</span>
            </label>
            <textarea
              id="card-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              maxLength={4000}
              className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              placeholder="Add more detail…"
            />
          </div>

          <fieldset className="mb-5">
            <legend className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">Labels</legend>
            <div className="flex flex-wrap gap-1.5">
              {board?.labels.map((label) => {
                const checked = labelIds.includes(label.id);
                return (
                  <label
                    key={label.id}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                      checked
                        ? "border-transparent bg-indigo-600 text-white"
                        : "border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={checked}
                      onChange={() => toggleLabel(label.id)}
                    />
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-indigo-500"
                    >
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: checked ? "#ffffff" : label.color }}
                      />
                      {label.name}
                    </span>
                  </label>
                );
              })}
              {board && board.labels.length === 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">No labels on this board yet.</p>
              )}
            </div>
          </fieldset>

          <div className="flex items-center justify-between gap-2">
            <div>
              {state.mode === "edit" && (
              <button
                type="button"
                onClick={() => {
                  deleteCard(state.cardId);
                  close();
                }}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950"
                >
                  <IconTrash />
                  Delete card
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={close}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {state.mode === "create" ? "Add card" : "Save changes"}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>,
    document.body,
  );
}

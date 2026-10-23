"use client";

import { useCallback, useEffect, useState } from "react";
import { Board } from "@/components/Board";
import { CardModal, type ModalState } from "@/components/CardModal";
import { CommandPalette } from "@/components/CommandPalette";
import { Toolbar } from "@/components/Toolbar";
import { IconClose } from "@/components/icons";
import { NO_FILTER, type FilterCriteria } from "@/lib/filter";
import { isEditableTarget } from "@/lib/focus-trap";
import { useTaskFlowStore } from "@/store/taskflow-store";

export function AppShell() {
  const [criteria, setCriteria] = useState<FilterCriteria>(NO_FILTER);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const liveMessage = useTaskFlowStore((state) => state.liveMessage);
  const storageRecovered = useTaskFlowStore((state) => state.storageRecovered);
  const dismissStorageNotice = useTaskFlowStore((state) => state.dismissStorageNotice);
  const undo = useTaskFlowStore((state) => state.undo);
  const redo = useTaskFlowStore((state) => state.redo);

  const openCreateCard = useCallback((columnId: string) => setModal({ mode: "create", columnId }), []);
  const openEditCard = useCallback((cardId: string) => setModal({ mode: "edit", cardId }), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod || event.altKey) return;
      const key = event.key.toLowerCase();

      // Cmd/Ctrl+K toggles the palette from anywhere, including inside inputs.
      if (key === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }

      // While typing, leave native text-field undo alone.
      if (isEditableTarget(event.target)) return;

      if (key === "z" && event.shiftKey) {
        event.preventDefault();
        redo();
      } else if (key === "z") {
        event.preventDefault();
        undo();
      } else if (key === "y") {
        event.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#board-main" className="skip-link">
        Skip to board
      </a>

      <Toolbar criteria={criteria} onCriteriaChange={setCriteria} onOpenPalette={() => setPaletteOpen(true)} />

      {storageRecovered && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 border-b border-amber-300 bg-amber-100 px-4 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
        >
          <p>
            Saved data couldn’t be read, so TaskFlow restored the sample boards. Your previous data was
            backed up locally.
          </p>
          <button
            type="button"
            onClick={dismissStorageNotice}
            className="rounded-md p-1 hover:bg-amber-200 dark:hover:bg-amber-900"
            aria-label="Dismiss notice"
          >
            <IconClose />
          </button>
        </div>
      )}

      <main id="board-main" className="flex flex-1 flex-col overflow-hidden">
        <Board criteria={criteria} onEditCard={openEditCard} onCreateCard={openCreateCard} />
      </main>

      {/* Polite announcements for creates, edits, deletes and undos. */}
      <div role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </div>

      {modal && <CardModal state={modal} onClose={() => setModal(null)} />}

      {paletteOpen && (
        <CommandPalette
          criteria={criteria}
          onClose={() => setPaletteOpen(false)}
          onCreateCard={openCreateCard}
          onClearFilters={() => setCriteria(NO_FILTER)}
        />
      )}
    </div>
  );
}

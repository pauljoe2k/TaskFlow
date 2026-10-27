"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "@/components/theme/ThemeProvider";
import { IconCommand } from "@/components/icons";
import { isFiltering, type FilterCriteria } from "@/lib/filter";
import { trapTabKey } from "@/lib/focus-trap";
import { selectActiveBoard, useTaskFlowStore } from "@/store/taskflow-store";

interface PaletteCommand {
  id: string;
  section: string;
  label: string;
  hint?: string;
  run: () => void;
}

interface CommandPaletteProps {
  criteria: FilterCriteria;
  onClose: () => void;
  onCreateCard: (columnId: string) => void;
  onClearFilters: () => void;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

/**
 * Ctrl/Cmd+K command palette.
 *
 * Implements the ARIA combobox-with-listbox pattern: the input owns
 * aria-activedescendant, options are real listbox options, and every action
 * is reachable with the keyboard alone.
 */
export function CommandPalette({
  criteria,
  onClose,
  onCreateCard,
  onClearFilters,
}: CommandPaletteProps) {
  const board = useTaskFlowStore(selectActiveBoard);
  const boards = useTaskFlowStore((state) => state.boards);
  const boardOrder = useTaskFlowStore((state) => state.boardOrder);
  const activeBoardId = useTaskFlowStore((state) => state.activeBoardId);
  const setActiveBoard = useTaskFlowStore((state) => state.setActiveBoard);
  const canUndo = useTaskFlowStore((state) => state.past.length > 0);
  const canRedo = useTaskFlowStore((state) => state.future.length > 0);
  const undo = useTaskFlowStore((state) => state.undo);
  const redo = useTaskFlowStore((state) => state.redo);
  const addColumn = useTaskFlowStore((state) => state.addColumn);
  const { theme, toggleTheme } = useTheme();

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();
  const listboxId = useId();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const commands = useMemo<PaletteCommand[]>(() => {
    const list: PaletteCommand[] = [];
    const firstColumn = board?.columns[0];

    list.push({
      id: "new-card",
      section: "Create",
      label: "New card",
      hint: firstColumn ? `in ${firstColumn.title}` : undefined,
      run: () => {
        if (firstColumn) onCreateCard(firstColumn.id);
      },
    });
    list.push({
      id: "new-column",
      section: "Create",
      label: "New column",
      hint: board?.name,
      run: () => addColumn("New column"),
    });
    list.push({
      id: "toggle-theme",
      section: "View",
      label: theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
      run: toggleTheme,
    });
    if (isFiltering(criteria)) {
      list.push({
        id: "clear-filters",
        section: "View",
        label: "Clear search and filters",
        run: onClearFilters,
      });
    }
    if (canUndo) {
      list.push({ id: "undo", section: "History", label: "Undo last change", hint: "Ctrl+Z", run: undo });
    }
    if (canRedo) {
      list.push({
        id: "redo",
        section: "History",
        label: "Redo change",
        hint: "Ctrl+Shift+Z",
        run: redo,
      });
    }
    for (const column of board?.columns ?? []) {
      list.push({
        id: `go-column-${column.id}`,
        section: "Navigate",
        label: `Go to ${column.title}`,
        run: () => {
          const element = document.getElementById(`column-${column.id}`);
          if (!element) return;
          element.scrollIntoView({
            behavior: prefersReducedMotion() ? "auto" : "smooth",
            block: "nearest",
            inline: "center",
          });
          element.focus({ preventScroll: true });
        },
      });
    }
    for (const id of boardOrder) {
      if (id === activeBoardId) continue;
      const target = boards[id];
      if (!target) continue;
      list.push({
        id: `go-board-${id}`,
        section: "Navigate",
        label: `Switch to ${target.name}`,
        run: () => setActiveBoard(id),
      });
    }
    return list;
  }, [
    board,
    boards,
    boardOrder,
    activeBoardId,
    setActiveBoard,
    canUndo,
    canRedo,
    undo,
    redo,
    addColumn,
    theme,
    toggleTheme,
    criteria,
    onCreateCard,
    onClearFilters,
  ]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter((command) =>
      `${command.section} ${command.label} ${command.hint ?? ""}`.toLowerCase().includes(needle),
    );
  }, [commands, query]);

  useEffect(() => {
    const active = filtered[activeIndex];
    if (!active) return;
    document.getElementById(`${listboxId}-${active.id}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, filtered, listboxId]);

  const runCommand = (command: PaletteCommand | undefined) => {
    if (!command) return;
    command.run();
    onClose();
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index) => (filtered.length === 0 ? 0 : (index + 1) % filtered.length));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((index) =>
          filtered.length === 0 ? 0 : (index - 1 + filtered.length) % filtered.length,
        );
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(Math.max(0, filtered.length - 1));
        break;
      case "Enter":
        event.preventDefault();
        runCommand(filtered[activeIndex]);
        break;
      case "Escape":
        event.preventDefault();
        event.stopPropagation(); // the dialog's own handler must not double-fire
        onClose();
        break;
      default:
        break;
    }
  };

  const activeCommand = filtered[activeIndex];
  const motionProps = reduceMotion
    ? { initial: false as const }
    : {
        initial: { opacity: 0, scale: 0.97, y: 8 },
        animate: { opacity: 1, scale: 1, y: 0 },
        transition: { duration: 0.12 },
      };

  let lastSection: string | null = null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-center bg-slate-950/50 p-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
            return;
          }
          trapTabKey(event.nativeEvent, event.currentTarget);
        }}
        className="h-fit w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        {...motionProps}
      >
        <div className="flex items-center gap-2 border-b border-slate-200 px-3 dark:border-slate-700">
          <span className="text-slate-500 dark:text-slate-400">
            <IconCommand />
          </span>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listboxId}
            aria-activedescendant={
              activeCommand ? `${listboxId}-${activeCommand.id}` : undefined
            }
            aria-autocomplete="list"
            aria-label="Type a command"
            placeholder="Type a command or search…"
            value={query}
            onChange={(event) => {
              // Reset the highlight in the same event that changes the query,
              // so no effect is needed to keep the index in range.
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onInputKeyDown}
            className="h-12 w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
          />
          <kbd className="hidden rounded border border-slate-300 px-1.5 py-0.5 text-[11px] text-slate-500 dark:border-slate-600 dark:text-slate-400 sm:block">
            Esc
          </kbd>
        </div>

        <ul
          id={listboxId}
          role="listbox"
          aria-label="Commands"
          className="lane-scrollbar max-h-80 overflow-y-auto py-1.5"
        >
          {filtered.length === 0 && (
            <li role="presentation" className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              No matching commands
            </li>
          )}
          {filtered.map((command, index) => {
            const showHeader = command.section !== lastSection;
            lastSection = command.section;
            const isActive = index === activeIndex;
            return [
              showHeader ? (
                <li
                  key={`${command.section}-header`}
                  role="presentation"
                  className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                >
                  {command.section}
                </li>
              ) : null,
              <li
                key={command.id}
                id={`${listboxId}-${command.id}`}
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  runCommand(command);
                }}
                className={`mx-1.5 flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm ${
                  isActive
                    ? "bg-indigo-600 text-white"
                    : "text-slate-700 dark:text-slate-200"
                }`}
              >
                <span className="truncate">{command.label}</span>
                {command.hint && (
                  <span
                    className={`shrink-0 text-xs ${isActive ? "text-indigo-100" : "text-slate-500 dark:text-slate-400"}`}
                  >
                    {command.hint}
                  </span>
                )}
              </li>,
            ];
          })}
        </ul>
      </motion.div>
    </div>,
    document.body,
  );
}

"use client";

import { NO_FILTER, isFiltering, type FilterCriteria } from "@/lib/filter";
import { useTheme } from "@/components/theme/ThemeProvider";
import {
  IconCommand,
  IconMoon,
  IconRedo,
  IconSearch,
  IconSun,
  IconUndo,
} from "@/components/icons";
import { selectActiveBoard, useTaskFlowStore } from "@/store/taskflow-store";

interface ToolbarProps {
  criteria: FilterCriteria;
  onCriteriaChange: (criteria: FilterCriteria) => void;
  onOpenPalette: () => void;
}

const toolButtonClass =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";

export function Toolbar({ criteria, onCriteriaChange, onOpenPalette }: ToolbarProps) {
  const board = useTaskFlowStore(selectActiveBoard);
  const boards = useTaskFlowStore((state) => state.boards);
  const boardOrder = useTaskFlowStore((state) => state.boardOrder);
  const activeBoardId = useTaskFlowStore((state) => state.activeBoardId);
  const setActiveBoard = useTaskFlowStore((state) => state.setActiveBoard);
  const canUndo = useTaskFlowStore((state) => state.past.length > 0);
  const canRedo = useTaskFlowStore((state) => state.future.length > 0);
  const undo = useTaskFlowStore((state) => state.undo);
  const redo = useTaskFlowStore((state) => state.redo);
  const { theme, toggleTheme } = useTheme();

  const toggleLabel = (labelId: string) => {
    const selected = criteria.labelIds.includes(labelId);
    onCriteriaChange({
      ...criteria,
      labelIds: selected
        ? criteria.labelIds.filter((id) => id !== labelId)
        : [...criteria.labelIds, labelId],
    });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-sm font-bold text-white"
          >
            T
          </span>
          <h1 className="text-lg font-semibold tracking-tight">TaskFlow</h1>
        </div>

        <label className="sr-only" htmlFor="board-switcher">
          Active board
        </label>
        <select
          id="board-switcher"
          value={activeBoardId}
          onChange={(event) => setActiveBoard(event.target.value)}
          className="h-9 max-w-48 rounded-lg border border-slate-300 bg-white px-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          {boardOrder.map((id) => (
            <option key={id} value={id}>
              {boards[id]?.name ?? "Untitled board"}
            </option>
          ))}
        </select>

        <div className="relative min-w-40 flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-slate-400">
            <IconSearch />
          </span>
          <label className="sr-only" htmlFor="board-search">
            Search cards
          </label>
          <input
            id="board-search"
            type="search"
            value={criteria.query}
            onChange={(event) => onCriteriaChange({ ...criteria, query: event.target.value })}
            placeholder="Search cards…"
            className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        <div role="group" aria-label="Filter by label" className="flex flex-wrap items-center gap-1.5">
          {board?.labels.map((label) => {
            const pressed = criteria.labelIds.includes(label.id);
            return (
              <button
                key={label.id}
                type="button"
                aria-pressed={pressed}
                onClick={() => toggleLabel(label.id)}
                className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition ${
                  pressed
                    ? "border-transparent bg-indigo-600 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: pressed ? "#ffffff" : label.color }}
                />
                {label.name}
              </button>
            );
          })}
          {isFiltering(criteria) && (
            <button
              type="button"
              onClick={() => onCriteriaChange(NO_FILTER)}
              className="inline-flex h-7 items-center rounded-full px-2 text-xs font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            aria-label="Undo last change"
            aria-keyshortcuts="Control+Z Meta+Z"
            className={toolButtonClass}
            title="Undo (Ctrl/Cmd+Z)"
          >
            <IconUndo />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            aria-label="Redo change"
            aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z"
            className={toolButtonClass}
            title="Redo (Ctrl/Cmd+Shift+Z)"
          >
            <IconRedo />
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            className={toolButtonClass}
          >
            {theme === "dark" ? <IconSun /> : <IconMoon />}
          </button>
          <button
            type="button"
            onClick={onOpenPalette}
            aria-label="Open command palette"
            aria-keyshortcuts="Control+K Meta+K"
            className={toolButtonClass}
            title="Command palette (Ctrl/Cmd+K)"
          >
            <IconCommand />
            <span className="hidden text-xs text-slate-500 dark:text-slate-400 sm:inline">⌘K</span>
          </button>
        </div>
      </div>
    </header>
  );
}

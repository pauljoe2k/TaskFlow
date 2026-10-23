import type { Board, Card, Column, Label, PersistedAppState } from "@/types/schema";

/**
 * Deterministic seed data: three boards with realistic content.
 * Timestamps are fixed offsets from a fixed epoch so the app is reproducible
 * and tests can assert against stable values.
 */

const EPOCH = Date.UTC(2025, 0, 1);
const at = (days: number, hours = 0) => EPOCH + days * 86_400_000 + hours * 3_600_000;

const LAUNCH_LABELS: Label[] = [
  { id: "lbl_feature", name: "Feature", color: "#6366f1" },
  { id: "lbl_bug", name: "Bug", color: "#f43f5e" },
  { id: "lbl_design", name: "Design", color: "#f59e0b" },
  { id: "lbl_docs", name: "Docs", color: "#10b981" },
];

const PERSONAL_LABELS: Label[] = [
  { id: "lbl_home", name: "Home", color: "#0ea5e9" },
  { id: "lbl_health", name: "Health", color: "#8b5cf6" },
  { id: "lbl_learning", name: "Learning", color: "#14b8a6" },
];

const RESEARCH_LABELS: Label[] = [
  { id: "lbl_paper", name: "Paper", color: "#84cc16" },
  { id: "lbl_tool", name: "Tool", color: "#f97316" },
  { id: "lbl_article", name: "Article", color: "#06b6d4" },
];

function card(
  id: string,
  title: string,
  description: string,
  labelIds: string[],
  day: number,
): Card {
  return { id, title, description, labelIds, createdAt: at(day), updatedAt: at(day) };
}

function column(id: string, title: string, cardIds: string[]): Column {
  return { id, title, cardIds };
}

export function createSeedState(): PersistedAppState {
  const launchCards: Card[] = [
    card("c_l1", "Landing page hero copy", "Rewrite the hero headline and subhead to lead with offline-first.", ["lbl_docs"], 0),
    card("c_l2", "Onboarding checklist", "Five-step checklist for first-run experience.", ["lbl_design"], 1),
    card("c_l3", "Drag ghost styling", "Match the drag overlay to the card dimensions exactly.", ["lbl_design"], 2),
    card("c_l4", "Offline queue flush", "Flush queued writes when the tab comes back online.", ["lbl_feature"], 3),
    card("c_l5", "Command palette search", "Fuzzy matching over command titles and column names.", ["lbl_feature"], 4),
    card("c_l6", "Contrast audit", "Verify all text pairs meet WCAG AA in both themes.", ["lbl_design", "lbl_docs"], 5),
    card("c_l7", "Card truncation bug", "Long titles overflow the card in Safari.", ["lbl_bug"], 6),
    card("c_l8", "Install prompt timing", "Defer beforeinstallprompt until the user scrolls twice.", ["lbl_feature"], 7),
    card("c_l9", "Write PWA docs", "Document the service worker strategy and cache invalidation.", ["lbl_docs"], 8),
    card("c_l10", "Undo history cap", "Confirm the 50-entry cap behaves under rapid drags.", ["lbl_bug", "lbl_feature"], 9),
  ];

  const personalCards: Card[] = [
    card("c_p1", "Renew gym membership", "", ["lbl_health"], 0),
    card("c_p2", "Meal prep for the week", "Sunday, two lunches per day.", ["lbl_health"], 1),
    card("c_p3", "Fix the leaking kitchen tap", "Washer probably needs replacing.", ["lbl_home"], 2),
    card("c_p4", "Read 'Understanding ES modules'", "Chapter 4 by Thursday.", ["lbl_learning"], 3),
    card("c_p5", "Book dentist appointment", "", ["lbl_home"], 4),
    card("c_p6", "Morning swim routine", "Three times a week before work.", ["lbl_health"], 5),
    card("c_p7", "Finish TypeScript course", "Section 7 of 12.", ["lbl_learning"], 6),
  ];

  const researchCards: Card[] = [
    card("c_r1", "CRDTs for offline-first apps", "Paper by Shapiro et al. Focus on conflict resolution.", ["lbl_paper"], 0),
    card("c_r2", "idb: Promise-based IndexedDB", "Evaluate against raw IndexedDB for the persistence layer.", ["lbl_tool"], 1),
    card("c_r3", "Service worker caching strategies", "Article comparing cache-first and network-first for SPAs.", ["lbl_article"], 2),
    card("c_r4", "dnd-kit accessibility", "Keyboard sensor and screen-reader announcement docs.", ["lbl_tool", "lbl_article"], 3),
    card("c_r5", "Zustand temporal middleware", "Study the command-history pattern before implementing undo.", ["lbl_paper"], 4),
    card("c_r6", "Lighthouse scoring model", "How TBT and CLS weight the performance score.", ["lbl_article"], 5),
  ];

  const boards: Record<string, Board> = {
    board_launch: {
      id: "board_launch",
      name: "Product Launch",
      labels: LAUNCH_LABELS,
      columns: [
        column("col_backlog", "Backlog", ["c_l1", "c_l2", "c_l3"]),
        column("col_progress", "In Progress", ["c_l4", "c_l5"]),
        column("col_review", "Review", ["c_l6", "c_l7"]),
        column("col_done", "Done", ["c_l8", "c_l9", "c_l10"]),
      ],
      cards: Object.fromEntries(launchCards.map((c) => [c.id, c])),
      createdAt: at(0),
      updatedAt: at(9),
    },
    board_personal: {
      id: "board_personal",
      name: "Personal Sprint",
      labels: PERSONAL_LABELS,
      columns: [
        column("col_todo", "To Do", ["c_p1", "c_p2", "c_p3"]),
        column("col_doing", "Doing", ["c_p4", "c_p5"]),
        column("col_finished", "Done", ["c_p6", "c_p7"]),
      ],
      cards: Object.fromEntries(personalCards.map((c) => [c.id, c])),
      createdAt: at(1),
      updatedAt: at(6),
    },
    board_research: {
      id: "board_research",
      name: "Research Queue",
      labels: RESEARCH_LABELS,
      columns: [
        column("col_reading", "Reading", ["c_r1", "c_r2"]),
        column("col_notes", "Notes", ["c_r3", "c_r4"]),
        column("col_synthesized", "Synthesized", ["c_r5", "c_r6"]),
      ],
      cards: Object.fromEntries(researchCards.map((c) => [c.id, c])),
      createdAt: at(2),
      updatedAt: at(5),
    },
  };

  return {
    boards,
    boardOrder: ["board_launch", "board_personal", "board_research"],
    activeBoardId: "board_launch",
  };
}

"use client";

import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { createPersistenceSubscription } from "@/lib/persistence";
import { useTaskFlowStore } from "@/store/taskflow-store";

/**
 * The store is seeded with deterministic sample data at creation time, so
 * the server render, the first client render and the actual first paint all
 * show the same real board — no hydration mismatch and no skeleton stage
 * (content paints with the HTML, which is what makes LCP and Speed Index
 * healthy).
 *
 * After mount, IndexedDB is read once: valid data replaces the seed in a
 * single commit, empty storage keeps the seed (a fresh visitor already sees
 * it), and corrupt storage backs up, reseeds and surfaces a notice. Any
 * edit made inside that sub-100 ms window is deliberately sacrificed — the
 * read starts before the user can perceive the page.
 */
export default function Home() {
  useEffect(() => {
    const stop = createPersistenceSubscription(useTaskFlowStore);
    void useTaskFlowStore.getState().hydrate();
    return stop;
  }, []);

  return <AppShell />;
}

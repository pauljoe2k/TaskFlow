"use client";

import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { createPersistenceSubscription } from "@/lib/persistence";
import { useTaskFlowStore } from "@/store/taskflow-store";

/**
 * Renders a static skeleton until IndexedDB has been read and validated.
 * The server render and the first client render both show this skeleton, so
 * there is no hydration mismatch and no flash of an empty board.
 */
function BootScreen() {
  return (
    <div className="flex min-h-screen flex-col" role="status" aria-label="Loading board">
      <span className="sr-only">Loading board…</span>
      <header className="h-16 border-b border-slate-200 bg-white/70 dark:border-slate-800 dark:bg-slate-900/70" />
      <main className="flex flex-1 gap-4 overflow-hidden p-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-40 w-72 shrink-0 animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800/60"
          />
        ))}
      </main>
    </div>
  );
}

export default function Home() {
  const hydrated = useTaskFlowStore((state) => state.hydrated);

  useEffect(() => {
    const stop = createPersistenceSubscription(useTaskFlowStore);
    void useTaskFlowStore.getState().hydrate();
    return stop;
  }, []);

  if (!hydrated) return <BootScreen />;
  return <AppShell />;
}

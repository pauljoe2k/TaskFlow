import { z } from "zod";

/**
 * Zod schemas define the shape of every entity we persist.
 * TypeScript types are inferred from the schemas so there is exactly one
 * source of truth: change the schema and the compiler points at every
 * place that needs updating.
 */

export const labelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(24),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const cardSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(120),
  description: z.string().max(4000).default(""),
  labelIds: z.array(z.string().min(1)).default([]),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

export const columnSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(60),
  cardIds: z.array(z.string().min(1)),
});

export const boardSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  labels: z.array(labelSchema),
  columns: z.array(columnSchema),
  cards: z.record(z.string(), cardSchema),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

/** The exact slice of state we write to IndexedDB (undo history excluded). */
export const appStateSchema = z.object({
  boards: z.record(z.string(), boardSchema),
  boardOrder: z.array(z.string().min(1)).min(1),
  activeBoardId: z.string().min(1),
});

export type Label = z.infer<typeof labelSchema>;
export type Card = z.infer<typeof cardSchema>;
export type Column = z.infer<typeof columnSchema>;
export type Board = z.infer<typeof boardSchema>;
export type PersistedAppState = z.infer<typeof appStateSchema>;

/** The editable subset of a card, used by the editor modal and update patches. */
export type CardDraft = Pick<Card, "title" | "description" | "labelIds">;

/** A position inside a column's cardIds array. */
export interface Place {
  columnId: string;
  index: number;
}

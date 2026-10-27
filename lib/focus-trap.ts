const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => isVisible(element),
  );
}

function isVisible(element: HTMLElement): boolean {
  if (element.hasAttribute("disabled")) return false;
  if (element.closest("[hidden]") !== null) return false;
  const window = element.ownerDocument.defaultView;
  const style = window ? window.getComputedStyle(element) : null;
  if (style && (style.display === "none" || style.visibility === "hidden")) return false;
  // `offsetParent` is null for display:none elements in real browsers, but
  // jsdom has no layout at all — only trust it once the document has real
  // layout boxes (body has client rects).
  const hasLayout = (element.ownerDocument.body?.getClientRects().length ?? 0) > 0;
  if (hasLayout && element.offsetParent === null && style?.position !== "fixed") return false;
  return true;
}

/**
 * Keep Tab / Shift+Tab cycling inside `container` while a dialog is open.
 * Call from the dialog's keydown handler.
 */
export function trapTabKey(event: KeyboardEvent, container: HTMLElement): void {
  if (event.key !== "Tab") return;
  const focusable = getFocusable(container);
  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!first || !last) return;
  const active = document.activeElement;
  if (event.shiftKey) {
    if (active === first || !container.contains(active)) {
      event.preventDefault();
      last.focus();
    }
  } else if (active === last || !container.contains(active)) {
    event.preventDefault();
    first.focus();
  }
}

/** True when the event target is a text-entry element (for global hotkeys). */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable
  );
}

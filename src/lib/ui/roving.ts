// Roving focus: one tab stop for a group, arrow keys move inside it.
// Used by Toolbar (horizontal), Menu and the note tree (vertical).

export type Orientation = "horizontal" | "vertical";

/**
 * The index focus moves to for a key, or null when the key is not ours.
 * Moving wraps at both ends. Home and End jump to the ends.
 */
export function nextRovingIndex(
  key: string,
  current: number,
  count: number,
  orientation: Orientation,
): number | null {
  if (count <= 0) return null;
  const forward = orientation === "horizontal" ? "ArrowRight" : "ArrowDown";
  const back = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
  switch (key) {
    case forward:
      return current < 0 ? 0 : (current + 1) % count;
    case back:
      return current < 0 ? count - 1 : (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/**
 * Svelte action: arrow keys move focus between the enabled items that
 * match `selector`. Items keep tabindex -1 except the current one.
 */
export function roving(
  node: HTMLElement,
  options: { selector: string; orientation: Orientation },
) {
  let { selector, orientation } = options;

  const items = () =>
    Array.from(node.querySelectorAll<HTMLElement>(selector)).filter(
      (item) => !item.hasAttribute("disabled") && item.ariaDisabled !== "true",
    );

  function sync(active?: HTMLElement) {
    const list = items();
    const current = active && list.includes(active) ? active : list[0];
    for (const item of list) item.tabIndex = item === current ? 0 : -1;
  }

  function onKeydown(event: KeyboardEvent) {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;
    const next = nextRovingIndex(event.key, index, list.length, orientation);
    if (next === null) return;
    event.preventDefault();
    sync(list[next]);
    list[next].focus();
  }

  function onFocusin(event: FocusEvent) {
    sync(event.target as HTMLElement);
  }

  node.addEventListener("keydown", onKeydown);
  node.addEventListener("focusin", onFocusin);
  sync();
  const observer = new MutationObserver(() =>
    sync(document.activeElement as HTMLElement),
  );
  observer.observe(node, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["disabled", "aria-disabled"],
  });

  return {
    update(next: { selector: string; orientation: Orientation }) {
      ({ selector, orientation } = next);
      sync(document.activeElement as HTMLElement);
    },
    destroy() {
      observer.disconnect();
      node.removeEventListener("keydown", onKeydown);
      node.removeEventListener("focusin", onFocusin);
    },
  };
}

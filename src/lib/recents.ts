/** How many recent notes the welcome page shows. */
export const WELCOME_RECENT_LIMIT = 5;

export function recentFileName(path: string): string {
  const cut = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return cut === -1 ? path : path.slice(cut + 1);
}

export function welcomeRecents<T>(
  items: readonly T[],
  limit = WELCOME_RECENT_LIMIT,
): T[] {
  return items.slice(0, Math.max(0, limit));
}

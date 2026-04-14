import type { Position } from "./api";

const KEY = "b1nary:optimistic-positions";

export function saveOptimistic(pos: Position): void {
  const all = getAllOptimistic();
  all.push(pos);
  sessionStorage.setItem(KEY, JSON.stringify(all));
}

export function getAllOptimistic(): Position[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Position[];
  } catch {
    return [];
  }
}

export function removeOptimistic(id: string): void {
  const all = getAllOptimistic().filter((p) => p.id !== id);
  sessionStorage.setItem(KEY, JSON.stringify(all));
}

export function removeMatchingOptimistic(realPositions: Position[]): void {
  const all = getAllOptimistic().filter((opt) => {
    return !realPositions.some(
      (real) =>
        real.otoken_address.toLowerCase() === opt.otoken_address.toLowerCase() &&
        real.user_address.toLowerCase() === opt.user_address.toLowerCase() &&
        Math.abs(real.amount - opt.amount) / Math.max(opt.amount, 1) < 0.01,
    );
  });
  sessionStorage.setItem(KEY, JSON.stringify(all));
}

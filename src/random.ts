/**
 * All randomness for the project funnels through here so it's easy to audit
 * and (in tests) swap out — nothing here is cryptographic, it's purely for
 * making activity look organic rather than clockwork.
 */

export function pick<T>(items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error("pick() called on empty array");
  }
  return items[Math.floor(Math.random() * items.length)]!;
}

export function chance(probability: number): boolean {
  return Math.random() < probability;
}

export function pickWeighted<T extends string>(weights: Record<T, number>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  if (total <= 0) {
    throw new Error("pickWeighted() requires at least one positive weight");
  }
  let roll = Math.random() * total;
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return key;
  }
  return entries[entries.length - 1]![0];
}

export function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function pickSubset<T>(items: readonly T[], max: number): T[] {
  return shuffle(items).slice(0, Math.max(0, Math.min(max, items.length)));
}

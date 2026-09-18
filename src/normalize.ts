export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function softmax(logits: number[], temperature = 0.7): number[] {
  const t = Math.max(0.05, temperature);
  const max = Math.max(...logits);
  const exps = logits.map((v) => Math.exp((v - max) / t));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((v) => v / sum);
}

export function normalizeMap(input: Record<string, number>): Record<string, number> {
  const keys = Object.keys(input);
  if (keys.length === 0) return {};
  const clipped = Object.fromEntries(
    keys.map((k) => [k, Math.max(0, Number.isFinite(input[k]) ? input[k]! : 0)]),
  );
  const sum = Object.values(clipped).reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    const even = 1 / keys.length;
    return Object.fromEntries(keys.map((k) => [k, even]));
  }
  return Object.fromEntries(keys.map((k) => [k, clipped[k]! / sum]));
}

export function peakedness(probs: number[]): number {
  const n = probs.length;
  if (n <= 1) return 1;
  const h = -probs.reduce((s, p) => s + (p > 0 ? p * Math.log2(p) : 0), 0);
  const hMax = Math.log2(n);
  return clamp01(1 - h / hMax);
}

export function argmax(map: Record<string, number>): string {
  let bestKey = Object.keys(map)[0] ?? "";
  let best = -Infinity;
  for (const [k, v] of Object.entries(map)) {
    if (v > best) {
      best = v;
      bestKey = k;
    }
  }
  return bestKey;
}

export function expectedScore(probabilities: Record<string, number>): number {
  return Object.entries(probabilities).reduce((sum, [k, p]) => {
    const i = Number(k);
    return sum + (Number.isFinite(i) ? i * p : 0);
  }, 0);
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t.length > 1);
}

export function overlap(a: string[], b: Set<string>): number {
  if (a.length === 0) return 0;
  let hits = 0;
  for (const t of a) if (b.has(t)) hits += 1;
  return hits / Math.sqrt(a.length);
}

export function flattenState(state: unknown): string {
  if (typeof state === "string") return state;
  try {
    return JSON.stringify(state, null, 2);
  } catch {
    return String(state);
  }
}

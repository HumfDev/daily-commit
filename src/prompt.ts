import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export async function ask(question: string, defaultValue?: string): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    const suffix = defaultValue !== undefined ? ` [${defaultValue}]` : "";
    const answer = (await rl.question(`${question}${suffix}: `)).trim();
    return answer.length > 0 ? answer : (defaultValue ?? "");
  } finally {
    rl.close();
  }
}

export async function confirm(question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? "Y/n" : "y/N";
  const answer = (await ask(`${question} (${hint})`)).toLowerCase();
  if (!answer) return defaultYes;
  return answer === "y" || answer === "yes";
}

/** Prompt for a secret; characters are masked with `*` in a TTY. */
export async function askSecret(question: string): Promise<string> {
  if (!input.isTTY || !output.isTTY) {
    return ask(question);
  }

  return new Promise((resolve, reject) => {
    output.write(`${question}: `);
    const wasRaw = input.isRaw;
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");
    let value = "";

    const cleanup = () => {
      input.setRawMode(wasRaw ?? false);
      input.pause();
      input.removeListener("data", onData);
    };

    const onData = (char: string) => {
      if (char === "\n" || char === "\r" || char === "\u0004") {
        cleanup();
        output.write("\n");
        resolve(value.trim());
        return;
      }
      if (char === "\u0003") {
        cleanup();
        output.write("\n");
        reject(new Error("cancelled"));
        return;
      }
      if (char === "\u007f" || char === "\b") {
        if (value.length > 0) {
          value = value.slice(0, -1);
          output.write("\b \b");
        }
        return;
      }
      if (char < " ") return;
      value += char;
      output.write("*");
    };

    input.on("data", onData);
  });
}

/**
 * Parses a selection string like "1,3,5-7,all" into 0-based indices.
 * Returns null if the input is invalid.
 */
export function parseSelection(inputText: string, count: number): number[] | null {
  const trimmed = inputText.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed === "all" || trimmed === "*") {
    return Array.from({ length: count }, (_, i) => i);
  }

  const indices = new Set<number>();
  for (const part of trimmed.split(/[,\s]+/).filter(Boolean)) {
    const range = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < 1 ||
        end > count ||
        start > end
      ) {
        return null;
      }
      for (let i = start; i <= end; i++) indices.add(i - 1);
      continue;
    }
    const n = Number(part);
    if (!Number.isInteger(n) || n < 1 || n > count) return null;
    indices.add(n - 1);
  }
  return [...indices].sort((a, b) => a - b);
}

export async function selectIndices(title: string, labels: string[]): Promise<number[]> {
  if (labels.length === 0) return [];

  console.log(`\n${title}`);
  labels.forEach((label, i) => {
    console.log(`  ${String(i + 1).padStart(3)}. ${label}`);
  });
  console.log(`\nEnter numbers (e.g. 1,3,5-8), or "all".`);

  for (;;) {
    const raw = await ask("Selection");
    const parsed = parseSelection(raw, labels.length);
    if (parsed && parsed.length > 0) return parsed;
    console.log("Invalid selection — try again.");
  }
}

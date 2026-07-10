import { run } from "../exec.js";

export interface TodoHit {
  file: string;
  line: number;
  text: string;
}

export interface TodoSweepResult {
  count: number;
  sample: TodoHit[];
}

const MAX_SAMPLE = 8;

/**
 * `git grep` only searches tracked files and respects .gitignore, so this
 * never touches vendored/ignored content. Exit code 1 means "no matches"
 * (not an error) per git's own convention.
 */
export async function runTodoSweep(repoDir: string): Promise<TodoSweepResult> {
  const result = await run(
    "git",
    ["grep", "-n", "-I", "-E", "TODO|FIXME"],
    { cwd: repoDir },
  );

  if (result.code !== 0 || result.stdout.trim().length === 0) {
    return { count: 0, sample: [] };
  }

  const lines = result.stdout.trim().split("\n");
  const hits: TodoHit[] = lines.map((line) => {
    const [file, lineNo, ...rest] = line.split(":");
    return {
      file: file ?? "unknown",
      line: Number(lineNo) || 0,
      text: rest.join(":").trim().slice(0, 160),
    };
  });

  return { count: hits.length, sample: hits.slice(0, MAX_SAMPLE) };
}

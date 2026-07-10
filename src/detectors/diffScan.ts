export interface DiffFinding {
  check: string;
  file: string;
  snippet: string;
}

interface DiffLine {
  file: string;
  text: string;
}

/** Extracts only added lines (unified diff `+` lines) with their source file. */
function addedLines(diff: string): DiffLine[] {
  const lines = diff.split("\n");
  let currentFile = "unknown";
  const added: DiffLine[] = [];

  for (const line of lines) {
    if (line.startsWith("+++ ")) {
      currentFile = line.slice(4).replace(/^b\//, "");
      continue;
    }
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    if (line.startsWith("+")) {
      added.push({ file: currentFile, text: line.slice(1) });
    }
  }
  return added;
}

const CONFLICT_MARKER_RE = /^(<{7}|={7}|>{7})(\s|$)/;

const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "AWS Access Key ID", re: /AKIA[0-9A-Z]{16}/ },
  { name: "Private key block", re: /-----BEGIN (RSA|EC|OPENSSH|PGP|DSA) PRIVATE KEY-----/ },
  { name: "Slack token", re: /xox[baprs]-[0-9A-Za-z-]{10,}/ },
  { name: "Google API key", re: /AIza[0-9A-Za-z\-_]{35}/ },
];

const MAX_FINDINGS = 10;

export function scanDiff(diff: string): DiffFinding[] {
  const findings: DiffFinding[] = [];
  for (const { file, text } of addedLines(diff)) {
    if (CONFLICT_MARKER_RE.test(text)) {
      findings.push({ check: "merge-conflict-marker", file, snippet: text.slice(0, 120) });
    }
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.re.test(text)) {
        findings.push({ check: `possible-secret (${pattern.name})`, file, snippet: "[redacted]" });
      }
    }
    if (findings.length >= MAX_FINDINGS) break;
  }
  return findings.slice(0, MAX_FINDINGS);
}

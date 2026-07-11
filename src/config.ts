import { readFileSync } from "node:fs";
import { load as parseYaml } from "js-yaml";
import { z } from "zod";

const ActionFlagsSchema = z.object({
  commit: z.boolean().default(true),
  pull_request: z.boolean().default(true),
  review: z.boolean().default(true),
  issue: z.boolean().default(true),
});

const RepoEntrySchema = z.object({
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, "must be 'owner/name'"),
  actions: ActionFlagsSchema.default({}),
  safePaths: z.array(z.string()).optional(),
  verifyCommand: z.string().optional(),
});

const ReposFileSchema = z.object({
  repos: z.array(RepoEntrySchema).min(1),
});

const ActionWeightsSchema = z.object({
  commit: z.number().min(0).default(3),
  pull_request: z.number().min(0).default(2),
  review: z.number().min(0).default(2),
  issue: z.number().min(0).default(1),
  noop: z.number().min(0).default(4),
});

const ConfigFileSchema = z.object({
  runProbability: z.number().min(0).max(1).default(0.35),
  quietHours: z.array(z.number().int().min(0).max(23)).default([]),
  maxActionsPerDay: z.number().int().min(0).default(2),
  actionWeights: ActionWeightsSchema.default({}),
  safePaths: z.array(z.string()).min(1),
  cooldownHours: z.number().min(0).default(20),
  // Git commit author — use your GitHub name + noreply email so commits
  // attribute to your account (avatar + username) instead of a bot identity.
  // Find the email under GitHub → Settings → Emails (Keep my email private).
  // Prefer `dc onboard` to set these.
  gitAuthor: z.string().min(1),
  gitEmail: z.string().email(),
});

export type RepoEntry = z.infer<typeof RepoEntrySchema>;
export type GlobalConfig = z.infer<typeof ConfigFileSchema>;
export type ActionType = "commit" | "pull_request" | "review" | "issue" | "noop";

export interface ResolvedConfig {
  global: GlobalConfig;
  repos: RepoEntry[];
}

function readYamlFile(path: string): unknown {
  const raw = readFileSync(path, "utf8");
  return parseYaml(raw);
}

export function loadConfig(
  configPath = "config.yml",
  reposPath = "repos.yml",
): ResolvedConfig {
  const global = ConfigFileSchema.parse(readYamlFile(configPath));
  const { repos } = ReposFileSchema.parse(readYamlFile(reposPath));
  return { global, repos };
}

export function safePathsFor(repo: RepoEntry, global: GlobalConfig): string[] {
  return repo.safePaths && repo.safePaths.length > 0 ? repo.safePaths : global.safePaths;
}

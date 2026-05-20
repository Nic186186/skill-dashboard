import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export type SkillSource = "Claude" | "Codex" | "Plugin" | "Project";

export type SkillRecord = {
  id: string;
  name: string;
  description: string;
  source: SkillSource;
  sources: SkillSource[];
  path: string;
  paths: string[];
  directory: string;
  version?: string;
  allowedTools?: string;
  userInvocable: boolean;
  usageCount: number;
  lastMentionedAt?: string;
  triggers: string[];
};

export type SkillSummary = {
  total: number;
  installations: number;
  userInvocable: number;
  used: number;
  sourceCounts: Record<SkillSource, number>;
  topSkills: SkillRecord[];
};

type SkillRoot = {
  directory: string;
  source: SkillSource;
  maxDepth: number;
};

const home = process.env.HOME ?? "/Users/Zhuanz1";

const skillRoots: SkillRoot[] = [
  { directory: path.join(home, ".claude", "skills"), source: "Claude", maxDepth: 7 },
  { directory: path.join(home, ".codex", "skills"), source: "Codex", maxDepth: 7 },
  { directory: path.join(home, ".codex", "plugins", "cache", "openai-bundled"), source: "Plugin", maxDepth: 9 },
  { directory: path.join(home, ".codex", "plugins", "cache", "openai-curated"), source: "Plugin", maxDepth: 9 },
  { directory: path.join(home, ".codex", "plugins", "cache", "openai-primary-runtime"), source: "Plugin", maxDepth: 9 },
  { directory: path.join(home, "ljg-skills", "skills"), source: "Project", maxDepth: 7 },
  { directory: path.join(home, ".openclaw", "workspace", "skills"), source: "Project", maxDepth: 5 },
  { directory: path.join(home, ".agents", "skills"), source: "Project", maxDepth: 7 },
];

function findSkillFiles(root: SkillRoot, current = root.directory, depth = 0): string[] {
  if (!existsSync(current) || depth > root.maxDepth) {
    return [];
  }

  let entries: string[];
  try {
    entries = readdirSync(current);
  } catch {
    return [];
  }

  const matches: string[] = [];
  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".git") {
      continue;
    }

    const fullPath = path.join(current, entry);
    let stats;
    try {
      stats = statSync(fullPath);
    } catch {
      continue;
    }

    if (stats.isFile() && entry === "SKILL.md") {
      matches.push(fullPath);
      continue;
    }

    if (stats.isDirectory()) {
      matches.push(...findSkillFiles(root, fullPath, depth + 1));
    }
  }

  return matches;
}

function extractFrontmatter(markdown: string) {
  if (!markdown.startsWith("---")) {
    return {};
  }

  const end = markdown.indexOf("\n---", 3);
  if (end === -1) {
    return {};
  }

  const raw = markdown.slice(3, end).split("\n");
  const values: Record<string, string> = {};
  let currentKey = "";

  for (const line of raw) {
    const keyMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (keyMatch) {
      currentKey = keyMatch[1];
      const value = keyMatch[2].trim();
      values[currentKey] = value === "|" || value === ">" ? "" : stripQuotes(value);
      continue;
    }

    if (currentKey && /^\s+/.test(line)) {
      values[currentKey] = `${values[currentKey]} ${line.trim()}`.trim();
    }
  }

  return values;
}

function stripQuotes(value: string) {
  return value.replace(/^['"]|['"]$/g, "");
}

function firstHeading(markdown: string) {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
}

function fallbackDescription(markdown: string) {
  const body = markdown.replace(/^---[\s\S]*?\n---/, "").split("\n");
  const paragraph = body.find((line) => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith("#") && !trimmed.startsWith(">") && !trimmed.startsWith("```");
  });
  return paragraph?.replace(/\*\*/g, "").slice(0, 180) ?? "这个 skill 没有写明描述，需要打开 SKILL.md 查看具体规则。";
}

function normalizeName(value: string) {
  return value
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, "-");
}

function getUsageCorpus() {
  const dbPath = path.join(home, ".claude-mem", "claude-mem.db");
  if (!existsSync(dbPath)) {
    return { text: "", datedRows: [] as Array<{ text: string; createdAt: string }> };
  }

    const query = `
    select text, createdAt from (
      select prompt_text as text, created_at as createdAt, created_at_epoch as createdEpoch from user_prompts
      union all
      select coalesce(title,'') || ' ' || coalesce(subtitle,'') || ' ' || coalesce(text,'') || ' ' || coalesce(narrative,'') as text, created_at as createdAt, created_at_epoch as createdEpoch from observations
    )
    order by createdEpoch asc
  `;

  try {
    const output = execFileSync("sqlite3", ["-json", dbPath, query], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    const rows = JSON.parse(output || "[]") as Array<{ text?: string; createdAt?: string }>;
    const datedRows = rows
      .filter((row) => row.text)
      .map((row) => ({ text: row.text ?? "", createdAt: row.createdAt ?? "" }));
    return {
      text: datedRows.map((row) => row.text).join("\n").toLowerCase(),
      datedRows,
    };
  } catch {
    return { text: "", datedRows: [] as Array<{ text: string; createdAt: string }> };
  }
}

function countMentions(corpus: string, terms: string[]) {
  let total = 0;
  for (const term of terms) {
    const normalized = term.toLowerCase().trim();
    if (normalized.length < 3) {
      continue;
    }
    total += corpus.split(normalized).length - 1;
  }
  return total;
}

function lastMentioned(rows: Array<{ text: string; createdAt: string }>, terms: string[]) {
  const normalizedTerms = terms.map((term) => term.toLowerCase()).filter((term) => term.length >= 3);
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const text = rows[index].text.toLowerCase();
    if (normalizedTerms.some((term) => text.includes(term))) {
      return rows[index].createdAt;
    }
  }
  return undefined;
}

function skillTerms(name: string, skillPath: string) {
  const directoryName = path.basename(path.dirname(skillPath));
  return Array.from(new Set([name, directoryName, `$${name}`, `/${name}`]));
}

function parseTriggers(description: string, markdown: string, name: string) {
  const triggerLines = markdown
    .split("\n")
    .filter((line) => /trigger|触发|use when|使用|调用/i.test(line))
    .slice(0, 4)
    .map((line) => line.replace(/^[-*>#\s]+/, "").trim())
    .filter(Boolean);

  if (triggerLines.length > 0) {
    return triggerLines;
  }

  if (description) {
    return [description];
  }

  return [`输入 $${name} 或直接说明你要使用这个 skill。`];
}

export function getSkills() {
  const corpus = getUsageCorpus();
  const seen = new Set<string>();
  const rawSkills: SkillRecord[] = [];

  for (const root of skillRoots) {
    for (const skillPath of findSkillFiles(root)) {
      const realPath = path.resolve(skillPath);
      if (seen.has(realPath)) {
        continue;
      }
      seen.add(realPath);

      let markdown = "";
      try {
        markdown = readFileSync(realPath, "utf8");
      } catch {
        continue;
      }

      const frontmatter = extractFrontmatter(markdown);
      const name = normalizeName(frontmatter.name || firstHeading(markdown) || path.basename(path.dirname(realPath)));
      const terms = skillTerms(name, realPath);
      const usageCount = countMentions(corpus.text, terms);

      rawSkills.push({
        id: realPath,
        name,
        description: frontmatter.description || fallbackDescription(markdown),
        source: root.source,
        sources: [root.source],
        path: realPath,
        paths: [realPath],
        directory: path.dirname(realPath),
        version: frontmatter.version,
        allowedTools: frontmatter["allowed-tools"],
        userInvocable: frontmatter["user-invocable"] !== "false",
        usageCount,
        lastMentionedAt: lastMentioned(corpus.datedRows, terms),
        triggers: parseTriggers(frontmatter.description || "", markdown, name),
      });
    }
  }

  const grouped = new Map<string, SkillRecord>();
  for (const skill of rawSkills) {
    const key = `${skill.name.toLowerCase()}::${skill.description.toLowerCase().slice(0, 220)}`;
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, skill);
      continue;
    }

    current.sources = Array.from(new Set([...current.sources, ...skill.sources]));
    current.paths = Array.from(new Set([...current.paths, ...skill.paths]));
    current.usageCount = Math.max(current.usageCount, skill.usageCount);
    current.userInvocable = current.userInvocable || skill.userInvocable;
    current.allowedTools = current.allowedTools ?? skill.allowedTools;
    current.version = current.version ?? skill.version;
    current.triggers = Array.from(new Set([...current.triggers, ...skill.triggers])).slice(0, 4);

    if (!current.lastMentionedAt || (skill.lastMentionedAt && skill.lastMentionedAt > current.lastMentionedAt)) {
      current.lastMentionedAt = skill.lastMentionedAt;
    }

    if (skill.path.length < current.path.length) {
      current.id = skill.id;
      current.source = skill.source;
      current.path = skill.path;
      current.directory = skill.directory;
    }
  }

  return Array.from(grouped.values()).sort((a, b) => b.usageCount - a.usageCount || a.name.localeCompare(b.name));
}

export function getSkillSummary(skills: SkillRecord[]): SkillSummary {
  const sourceCounts: Record<SkillSource, number> = {
    Claude: 0,
    Codex: 0,
    Plugin: 0,
    Project: 0,
  };

  for (const skill of skills) {
    for (const source of skill.sources) {
      sourceCounts[source] += 1;
    }
  }

  return {
    total: skills.length,
    installations: skills.reduce((count, skill) => count + skill.paths.length, 0),
    userInvocable: skills.filter((skill) => skill.userInvocable).length,
    used: skills.filter((skill) => skill.usageCount > 0).length,
    sourceCounts,
    topSkills: skills.filter((skill) => skill.usageCount > 0).slice(0, 6),
  };
}

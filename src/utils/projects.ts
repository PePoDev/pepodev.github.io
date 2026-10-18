import type { Project } from "../types/data";

// GitHub linguist colors for the languages projects.json uses.
const LANGUAGE_COLORS: Record<string, string> = {
  "C#": "#178600",
  Go: "#00add8",
  HCL: "#844fba",
  HTML: "#e34c26",
  Rust: "#b7410e",
  TypeScript: "#3178c6",
};

// Tags that describe the repository rather than the project.
const NOISE_TAGS = new Set(["hacktoberfest", "csharp", "golang"]);

/** The first tag is the project's primary language. */
export function getProjectLanguage(project: Project): string | undefined {
  return project.tags[0];
}

export function getLanguageColor(language: string | undefined): string {
  return (language && LANGUAGE_COLORS[language]) || "currentColor";
}

/** Topic tags after the language, without repo noise or near-duplicates. */
export function getProjectTopics(project: Project, limit = 2): string[] {
  const topics: string[] = [];
  for (const tag of project.tags.slice(1)) {
    if (NOISE_TAGS.has(tag) || tag.startsWith("global-game-jam")) continue;
    if (topics.some((topic) => tag.includes(topic))) continue;
    topics.push(tag);
  }
  return topics.slice(0, limit);
}

/** The Global Game Jam year, from a tag, the jam site URL, or a "-ggj-21" name. */
export function getGameJamYear(project: Project): number | undefined {
  for (const tag of project.tags) {
    const match = tag.match(/^global-game-jam-(\d{4})$/);
    if (match) return Number(match[1]);
  }
  const fromLink = project.link.match(/globalgamejam\.org\/(\d{4})\//);
  if (fromLink) return Number(fromLink[1]);
  const fromName = project.name.match(/-ggj-(\d{2})$/i);
  if (fromName) return 2000 + Number(fromName[1]);
  return undefined;
}

export function isGameJamProject(project: Project): boolean {
  return (
    getGameJamYear(project) !== undefined ||
    project.tags.some((tag) => tag.startsWith("global-game-jam"))
  );
}

/** A short label for `link` when it is not the repository itself. */
export function getProjectLinkLabel(project: Project): string | undefined {
  if (project.link === project.github) return undefined;
  const host = new URL(project.link).hostname;
  if (host.startsWith("registry.")) return "Registry";
  if (project.tags.includes("game") || /itch\.io|globalgamejam/.test(host)) {
    return "Play";
  }
  return "Site";
}

/**
 * The edited `summary`, or else the description without its decorative
 * emoji pair ("🐳🐳"), for text-only lists.
 */
export function getProjectSummary(project: Project): string {
  if (project.summary) return project.summary;
  return project.description
    .replace(/\s*\((?:[\p{Extended_Pictographic}\u200d\ufe0f]+)\)\s*$/u, "")
    .replace(/[\s\p{Extended_Pictographic}\u200d\ufe0f]+$/u, "")
    .trim();
}

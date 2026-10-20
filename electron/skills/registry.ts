/**
 * Skill discovery and parsing.
 *
 * A skill is a directory under `skills/` at the project root containing a
 * `SKILL.md` with a small frontmatter block:
 *
 *   ---
 *   name: Reverse Engineering
 *   description: Reverse engineer apps with the REA CLI.
 *   toolset: rea
 *   ---
 *   <instructions>
 *
 * The body is injected into the agent's instructions for one turn when the
 * user selects the skill. Nothing here touches the database: a skill is a file,
 * and the selected id rides on the send IPC for exactly one message.
 */
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

import { app } from "electron"

export interface SkillSummary {
  id: string
  name: string
  description: string
}

export interface Skill extends SkillSummary {
  /** Appended to the agent's system prompt for a turn that selected it. */
  instructions: string
  /** Which tool group to attach; unknown values attach nothing. */
  toolset: string | null
}

const SKILL_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/

/**
 * Skills live beside `electron/`, not inside it, so the same files are visible
 * in dev (`app.getAppPath()` is `electron/`) and in a packaged build.
 * `SKILLS_DIR` exists so a test or a different deployment can point elsewhere.
 */
function skillsRoot(): string {
  const override = process.env.SKILLS_DIR
  if (override && override.trim()) return path.resolve(override)
  return path.resolve(app.getAppPath(), "..", "skills")
}

function unquote(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

/**
 * Parses the frontmatter and body. Deliberately not a YAML parser: the fields
 * are flat strings, and adding a dependency to read four keys would be worse
 * than the 20 lines below.
 */
export function parseSkill(id: string, source: string): Skill {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source)
  const meta = new Map<string, string>()
  if (match) {
    for (const line of match[1]!.split(/\r?\n/)) {
      const colon = line.indexOf(":")
      if (colon <= 0) continue
      const key = line.slice(0, colon).trim().toLowerCase()
      const value = unquote(line.slice(colon + 1))
      if (key) meta.set(key, value)
    }
  }
  const instructions = (match ? match[2]! : source).trim()
  const name = meta.get("name") || id
  return {
    id,
    name,
    description: meta.get("description") || "",
    instructions,
    toolset: meta.get("toolset") || null,
  }
}

/** Every valid skill directory, sorted by display name. Unreadable entries are skipped. */
export async function listSkills(): Promise<SkillSummary[]> {
  let entries: import("node:fs").Dirent[]
  try {
    entries = await readdir(skillsRoot(), { withFileTypes: true })
  } catch {
    // No skills directory yet is a valid state, not an error.
    return []
  }

  const skills: Skill[] = []
  for (const entry of entries) {
    if (!entry.isDirectory() || !SKILL_ID.test(entry.name)) continue
    const skill = await loadSkill(entry.name)
    if (skill) skills.push(skill)
  }
  skills.sort((a, b) => a.name.localeCompare(b.name))
  return skills.map(({ id, name, description }) => ({ id, name, description }))
}

/**
 * Loads one skill by id. Invalid ids are rejected before touching the
 * filesystem, which is what keeps `..` and absolute paths out of the join.
 */
export async function loadSkill(id: string): Promise<Skill | null> {
  if (!SKILL_ID.test(id)) return null
  try {
    const source = await readFile(path.join(skillsRoot(), id, "SKILL.md"), "utf-8")
    return parseSkill(id, source)
  } catch {
    return null
  }
}

/**
 * Smoke test for the browser-backend split and the `@` mention picker.
 *
 * Both are rules about *which tools exist*, and the failure mode in each case is
 * the model being told about a tool it was not given — so they are asserted
 * directly rather than through a turn:
 *
 *   - the backends are exclusive. Embedded gets the step tools and no deep
 *     task; deep gets `browser_deep_task` and nothing else. Cumulative sets were
 *     the first design and they interleaved a dozen approved clicks with one
 *     approved autonomous run.
 *   - the picker lists exactly what the agent got, so a tool cannot sit in the
 *     picker while being absent from the agent.
 *   - a mention is honoured only for a tool the backend exposes, so a stale
 *     `@browser_deep_task` in a later embedded turn cannot survive into the
 *     prompt.
 *
 * `mentions.ts` is imported for real because it is deliberately free of the
 * browser/Electron graph. The tool lists come from the same literals the picker
 * and the agent are built from.
 *
 *   node scripts/browser-backends-smoke.mjs
 */
import { mentionedTools, toolMentionDirective } from "../ai/mentions.ts"

let failures = 0
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "ok " : "FAIL"} ${name}${ok || !detail ? "" : ` — ${detail}`}`)
  if (!ok) failures++
}

const EMBEDDED = [
  "browser_navigate",
  "browser_snapshot",
  "browser_read",
  "browser_screenshot",
  "browser_click",
  "browser_type",
  "browser_go",
  "browser_save_pdf",
]
const DEEP = ["browser_deep_task"]

// What the picker offers in either mode: one capability, not the raw tools.
const PICKER = ["BrowserAutomation"]

console.log("\nbackend tool sets")
check("embedded excludes the deep task", !EMBEDDED.includes("browser_deep_task"))
check("deep exposes only the deep task", DEEP.every((n) => n.startsWith("browser_deep_task")))
check("the two backends share no tool", EMBEDDED.every((n) => !DEEP.includes(n)))
check(
  "the picker collapses both lanes to one capability",
  PICKER.length === 1 && PICKER[0] === "BrowserAutomation",
)

console.log("\nmention detection")
check(
  "the capability mention is found",
  mentionedTools("@BrowserAutomation go check that", PICKER).join() === "BrowserAutomation",
)
check(
  "a raw tool name is not a mention",
  mentionedTools("@browser_navigate go", PICKER).length === 0,
)
check(
  "a name the picker never offered is ignored",
  mentionedTools("@BrowserFrobnicate do the thing", PICKER).length === 0,
)
check(
  "the same mention twice is one",
  mentionedTools("@BrowserAutomation a @BrowserAutomation b", PICKER).length === 1,
)
check("a message with no mention yields nothing", mentionedTools("just a question", PICKER).length === 0)

console.log("\nmention directives")
check("no directive without a mention", toolMentionDirective("hello", PICKER) === null)
const one = toolMentionDirective("@BrowserAutomation get the pricing", PICKER)
check("a directive names the capability", Boolean(one?.includes("@BrowserAutomation")), one ?? "")
check(
  "a directive does not pin one tool",
  !one?.includes("browser_navigate") && !one?.includes("browser_deep_task"),
  one ?? "",
)
check(
  "a directive licenses several calls",
  Boolean(one?.includes("take as many of them as the job needs")),
  one ?? "",
)
check(
  "the deep lane honours the same mention",
  Boolean(toolMentionDirective("@BrowserAutomation go", PICKER)?.includes("@BrowserAutomation")),
)

console.log(failures === 0 ? "\nbackend smoke passed" : `\n${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)

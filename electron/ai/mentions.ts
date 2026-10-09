/**
 * Turns `@`-mentioned tool names in a user's message into a directive for the
 * model.
 *
 * Kept free of the browser, database and Electron imports so the one rule that
 * matters — only tools the current backend actually exposes are honoured — can
 * be tested on its own. A stale `@browser_deep_task` left in the text of a
 * later embedded turn must not survive into the prompt: it names a tool that is
 * not in the tool set, and a model told to use it either apologises for a call
 * it cannot make or invents one.
 */

/** A `@name` in message text, when `name` is one the backend exposes. */
export function mentionedTools(text: string, available: Iterable<string>): string[] {
  const allowed = new Set(available)
  return [
    ...new Set(
      [...text.matchAll(/@([a-zA-Z0-9_]+)/g)]
        .map((match) => match[1] ?? "")
        .filter((name) => allowed.has(name)),
    ),
  ]
}

/**
 * The directive to append to one turn, or null when the message mentions none.
 *
 * The mention itself stays in the text the user sees and in the transcript they
 * can read back; this is added on the way to the model only.
 *
 * Phrased as a capability rather than a call, because that is what the user
 * named: they picked "go and use the browser", not "call browser_snapshot".
 * Naming the individual tool the mention stands for would re-impose the choice
 * the picker exists to hide, and would go stale the moment the backend changes.
 */
export function toolMentionDirective(
  text: string,
  available: Iterable<string>,
): string | null {
  const named = mentionedTools(text, available)
  if (named.length === 0) return null
  const list = named.map((name) => `@${name}`).join(", ")
  return (
    `The user picked ${list} by name from the tool picker for this message, which is an ` +
    `explicit instruction to use the browser tools available to you to handle it — take as ` +
    `many of them as the job needs, in whatever order the work requires. Do not answer from ` +
    `memory, and do not stop at the first page if the request needs more than one.`
  )
}

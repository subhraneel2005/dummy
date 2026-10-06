/**
 * Decides which accessibility-tree nodes are worth showing the model.
 *
 * Ported from `browser-use`'s `ClickableElementDetector` (Apache-2.0), which is
 * the part of that project genuinely worth reusing. It exists because the
 * accessibility tree on its own is not a reliable list of things a person can
 * click: it omits clickable `<div>`s, framework widgets, and anything whose
 * only signal is a JS event listener.
 *
 * The ordering below is deliberate and inherited — cheap unambiguous signals
 * first, ambiguous heuristics last, and `disabled`/`hidden` checked early
 * because a node that is either is never actionable regardless of its tag.
 */

/** Native controls that are always actionable. */
const INTERACTIVE_TAGS = new Set([
  "button",
  "input",
  "select",
  "textarea",
  "a",
  "details",
  "summary",
  "option",
  "optgroup",
])

/**
 * AX properties whose mere presence means "this is an interactive widget".
 * `checked`/`expanded`/`pressed`/`selected` exist only on controls, so their
 * presence is the signal — the value is irrelevant.
 */
const INTERACTIVE_PROPS = new Set([
  "focusable",
  "editable",
  "settable",
  "checked",
  "expanded",
  "pressed",
  "selected",
  "required",
  "autocomplete",
  "keyshortcuts",
])

/** Values of `role` that mean actionable, for nodes not covered by tag or property. */
const INTERACTIVE_ROLES = new Set([
  "button",
  "link",
  "checkbox",
  "radio",
  "textbox",
  "searchbox",
  "combobox",
  "listbox",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "switch",
  "slider",
  "spinbutton",
  "tab",
  "treeitem",
])

/**
 * Class/id fragments that mark a clickable icon. Icons are frequently a `<span>`
 * or `<svg>` with no role at all, and without this a search button is simply
 * invisible to the model.
 */
const CLICKABLE_NAME_HINTS = [
  "button",
  "btn",
  "submit",
  "close",
  "delete",
  "remove",
  "edit",
  "next",
  "prev",
  "previous",
  "menu",
  "nav",
  "link",
  "toggle",
  "checkbox",
  "search",
  "magnify",
  "glass",
  "lookup",
  "find",
  "query",
  "searchbox",
]

export interface InteractivityInput {
  role: string
  name: string
  properties: Record<string, unknown>
  /** True when CDP found a click/mouse listener on this element. */
  hasJsClickListener: boolean
}

export interface InteractivityVerdict {
  interactive: boolean
  /** Short provenance string, surfaced in the snapshot so odd entries can be explained. */
  via: string
}

const MISS: InteractivityVerdict = { interactive: false, via: "" }

/**
 * Classifies one node. Kept pure and synchronous so it is trivially testable
 * without a browser — the heuristic is where the bugs live, not the CDP plumbing.
 */
export function findInteractiveNodes(input: InteractivityInput): InteractivityVerdict {
  const { role, properties, hasJsClickListener } = input

  // A node that is disabled or hidden is never actionable, whatever its tag.
  if (isTruthy(properties.disabled)) return MISS
  if (isTruthy(properties.hidden)) return MISS

  if (hasJsClickListener) return { interactive: true, via: "js-listener" }

  if (INTERACTIVE_ROLES.has(role)) return { interactive: true, via: "role" }

  for (const key of INTERACTIVE_PROPS) {
    if (isTruthy(properties[key])) return { interactive: true, via: `property:${key}` }
  }

  // `name` on a textbox/button is its accessible label, so a name hint here is
  // a real signal rather than a guess about iconography.
  const name = input.name.toLowerCase()
  if (INTERACTIVE_TAGS.has(role)) return { interactive: true, via: "tag" }

  const hint = CLICKABLE_NAME_HINTS.find((candidate) => name.includes(candidate))
  if (hint && (role === "generic" || role === "image" || role === "")) {
    return { interactive: true, via: "name-hint" }
  }

  return MISS
}

function isTruthy(value: unknown): boolean {
  return value === true || value === "" || (value !== undefined && value !== null && value !== false)
}
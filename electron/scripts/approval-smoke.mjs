/**
 * Headless smoke for the Feature 5 approval loop (Phase F).
 *
 * The loop in `ai/chat.ts` is thin but it rests on an SDK contract that has
 * never been exercised: park on `tool-approval-request`, take
 * `responseMessages`, append a `tool-approval-response` tool message, and
 * re-stream. If that shape were wrong the app would hang on the first Approve —
 * with no test, and only after a real key and a real page were involved.
 *
 * The provider transport is mocked at `fetch`, exactly as
 * `scripts/provider-compat.mjs` does, so this runs offline. The approval policy
 * is client-side, so the mock only has to return a tool call first and a final
 * answer second; whether the tool actually ran is observable from `execute`.
 *
 *   node scripts/approval-smoke.mjs
 */
import { randomBytes } from "node:crypto"
import { ToolLoopAgent, stepCountIs, tool } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { z } from "zod"

let failures = 0
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "ok " : "FAIL"} ${name}${ok || !detail ? "" : ` — ${detail}`}`)
  if (!ok) failures++
}

const FIRST_TEXT = "typed hello"

/**
 * The scripted responses, as chat-completions SSE.
 *
 * The adapter is asked for `.chat(...)` deliberately: `gpt-4o-mini` routes to
 * the Responses API otherwise, whose event vocabulary is a dozen named frames
 * with lifecycle bookkeeping. Chat completions streaming is the same three
 * frames a provider actually emits, so the mock stays a script rather than a
 * reimplementation of OpenAI's wire format.
 */
const sse = (payload) => `data: ${JSON.stringify(payload)}\n\n`
const chunk = (delta, finish = null) => ({
  id: "chatcmpl_1",
  object: "chat.completion.chunk",
  created: 0,
  model: "m",
  choices: [{ index: 0, delta, finish_reason: finish }],
})

const streamFor = (step) => {
  if (step > 0) {
    return [sse(chunk({ role: "assistant", content: FIRST_TEXT })), sse(chunk({}, "stop")), "data: [DONE]\n\n"]
  }
  return [
    sse(
      chunk({
        role: "assistant",
        content: null,
        tool_calls: [
          { index: 0, id: "call_1", type: "function", function: { name: "browser_type", arguments: "" } },
        ],
      }),
    ),
    sse(
      chunk({
        tool_calls: [{ index: 0, function: { arguments: '{"ref":1,"text":"hello"}' } }],
      }),
    ),
    sse(chunk({}, "tool_calls")),
    "data: [DONE]\n\n",
  ].join("")
}

/**
 * Mirrors `browser/tools.ts`'s mutating tool — the kind that prompts — and
 * records every request so the assertions can see how many steps happened.
 */
function makeTool(run) {
  return tool({
    description: "Type text into the focused field",
    inputSchema: z.object({ ref: z.number(), text: z.string() }),
    execute: async () => {
      run.executed++
      return { ok: true }
    },
  })
}

function makeAgent(run, approval) {
  const fetch = async (_url, init) => {
    const body = JSON.parse(init.body)
    run.requests.push(body)
    return new Response(streamFor(run.requests.length - 1), {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    })
  }
  return new ToolLoopAgent({
    model: createOpenAI({ apiKey: "test", fetch }).chat("gpt-4o-mini"),
    tools: { browser_type: makeTool(run) },
    stopWhen: stepCountIs(6),
    toolApproval: approval,
    experimental_toolApprovalSecret: randomBytes(32),
  })
}

/** The exact resume shape `ai/chat.ts` builds after the user decides. */
async function resume(result, approvalId, approved) {
  return [
    ...(await result.responseMessages),
    {
      role: "tool",
      content: [{ type: "tool-approval-response", approvalId, approved }],
    },
  ]
}

/** Drives one turn: stream, collect approvals, decide, stream again. */
async function runTurn(approved) {
  const run = { executed: 0, requests: [] }
  const agent = makeAgent(run, () => "user-approval")

  const first = await agent.stream({ messages: [{ role: "user", content: "type hello" }] })
  const approvals = []
  let text = ""
  for await (const part of first.stream) {
    if (part.type === "tool-approval-request") approvals.push(part)
    if (part.type === "text-delta") text += part.text
  }

  if (approvals.length === 0) return { run, approvals, text, resumedText: "", executedWhileParked: run.executed }

  // Sampled here, not after the resume: the point is that nothing ran *between*
  // the request arriving and the decision being made.
  const executedWhileParked = run.executed

  const second = await agent.stream({
    messages: await resume(first, approvals[0].approvalId, approved),
  })
  let resumedText = ""
  for await (const part of second.stream) {
    if (part.type === "text-delta") resumedText += part.text
  }
  return { run, approvals, text, resumedText, executedWhileParked }
}

console.log("\napproval loop")

{
  const { run, approvals, resumedText, executedWhileParked } = await runTurn(true)
  check("the tool call parks for approval instead of running", approvals.length === 1, `${approvals.length} requests`)
  check(
    "an approval id is minted for the card",
    typeof approvals[0]?.approvalId === "string" && approvals[0].approvalId.length > 0,
  )
  check("nothing executed while parked", executedWhileParked === 0, `ran ${executedWhileParked} times`)
  check("approving resumes the loop and runs the tool", run.executed === 1, `ran ${run.executed} times`)
  check("the model sees the result and answers", resumedText === FIRST_TEXT, `got "${resumedText}"`)
  check("one provider round trip per step", run.requests.length === 2, `${run.requests.length} requests`)
}

{
  const { run, approvals, resumedText } = await runTurn(false)
  check("denial resumes rather than hanging", approvals.length === 1 && run.requests.length === 2, `${run.requests.length} requests`)
  check("a denied tool never executes", run.executed === 0, `ran ${run.executed} times`)
  check("the model is told and still answers", resumedText === FIRST_TEXT, `got "${resumedText}"`)
}

{
  // Read-only tools must not park at all — prompting on a read is what makes
  // the assistant unusable, so this guards the policy, not just the SDK.
  const run = { executed: 0, requests: [] }
  const agent = makeAgent(run, () => "approved")
  // The SDK *does* emit a request for an automatic approval — flagged
  // `isAutomatic` and answered within the same step. What must not happen is a
  // request the user could be asked to decide, which is exactly what `ai/chat.ts`
  // now skips past; parking on an automatic one would hang the turn.
  const partTypes = []
  const result = await agent.stream({ messages: [{ role: "user", content: "type hello" }] })
  for await (const part of result.stream) partTypes.push(part)
  const waiting = partTypes.filter(
    (part) => part.type === "tool-approval-request" && part.isAutomatic !== true,
  )
  const results = partTypes.filter((part) => part.type === "tool-result")
  check(
    "an approved tool never leaves the user a decision",
    waiting.length === 0 && run.executed === 1 && results.length === 1,
    `${waiting.length} waiting, ran ${run.executed}, ${results.length} results`,
  )
}

console.log(failures === 0 ? "\napproval smoke passed" : `\nFAILED (${failures})`)
process.exit(failures === 0 ? 0 : 1)

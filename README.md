<div align="center">

<div style="display:inline-flex; align-items:center;">

<img src="renderer/public/bloub-nuage-excite-bleu-anime.svg" width="70" height="70" alt="dummy logo" />

# dummy

</div>

A local-first AI assistant for macOS, Linux & Windows — push-to-talk dictation, circle-capture screenshots, and a tool-using chat that drives a real browser (step-by-step, or a fully autonomous agent in its own window), all running on your own machine with your own API keys.

</div>

<div align="center">

![macOS](https://img.shields.io/badge/macOS-000000?logo=apple&logoColor=white)
![Linux](https://img.shields.io/badge/Linux-FCC624?logo=linux&logoColor=black)
![Windows](https://img.shields.io/badge/Windows-0078D6?logo=windows&logoColor=white)
![Electron 44](https://img.shields.io/badge/Electron-44.3.0-47848F?logo=electron&logoColor=white)
![AI SDK 7](https://img.shields.io/badge/AI%20SDK-7.0.114-000000?logo=vercel&logoColor=white)
![Next.js 16](https://img.shields.io/badge/Next.js-16.3.5-000000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-libsql%20%2B%20Drizzle-003B57?logo=sqlite&logoColor=white)
![Tests](https://img.shields.io/badge/tests-passing-2EA043)
![License](https://img.shields.io/badge/license-ISC-2EA043)

</div>

---

## What this is

**dummy** is a local desktop AI companion for macOS, Linux & Windows. Hit **Alt+D**, hold the key, and speak — the audio is transcribed **locally** with whisper.cpp, cleaned up by your chosen model, and copied to your clipboard. Drag a rectangle over anything on screen to attach it as an image. Drop the transcript into a persistent chat that can also **drive a real browser for you** — either step-by-step against a page docked in the chat window, or as a fully autonomous agent in its own Chrome window — with an approve/deny prompt only for actions that leave the page behind.

Everything is local-first: your API keys are encrypted with the **OS keychain** (`safeStorage` — Keychain on macOS, DPAPI on Windows, libsecret on Linux), and your chat history, attachments, and settings live in a local SQLite database. No cloud account, no telemetry, no child servers.

## Key features

| # | Feature | What it does |
|---|---|---|
| 1 | **Push-to-talk dictation** | Hold Alt+D → speak → local whisper.cpp (`base.en`) transcribes → text lands on your clipboard. Runs entirely offline. |
| 2 | **BYOK AI providers** | Bring your own key for **OpenAI, Anthropic, Google, or xAI**. Keys are encrypted at rest; the model catalog is fetched **live** from each provider, not hardcoded. |
| 2.5 | **Jargon polish** | Transcribed text is passed through your selected model to fix mangled technical terms (library names, flags, commands) before it is copied. Degrades gracefully to the raw transcript. |
| 3 | **Persistent chat** | Streams live replies over IPC; history survives restarts in SQLite. Reset, rename, and multiple sessions supported. |
| 4 | **Circle-capture screenshots** | While holding Alt+D, drag a rectangle around anything on screen → it is attached to the chat as an image (up to 5 per hold). One-shot context: sent once, never silently re-sent. |
| 4.5 | **PDF / Markdown / text / CSV attachments** | Attach files to any message. Provider-aware encoding: images & PDFs travel as file parts, text is inlined; Word files are refused with an actionable message; per-category byte caps and content sniffing. |
| 5 | **Embedded browser automation** | The assistant drives a real Chromium page docked inside the chat window via raw CDP — no Playwright, no remote-debugging port. 8 tools, read/click auto-approve, `type` and `save-pdf` require your approval. |
| 6 | **Deep-task lane** | An autonomous agent ([`@browser_use/pi`](https://www.npmjs.com/package/@browser_use/pi)) that opens **its own Chrome window** for long unattended work — research across sites, sign in, submit forms, download files. One approval covers the entire run; you watch it live and can pause, resume, or stop it at any point. |
| 7 | **Switchable browser backend** | Settings → **Browser automation** picks the lane: *Embedded tools* (step-by-step, in-app page) or *Deep task agent* (one autonomous run, separate window). Staged selection with a **Save** button and a confirmation toast — the choice changes which tools the whole chat has, so it is never changed by accident. |
| 8 | **`@` tool picker** | Type `@` in the composer for one entry — **`@BrowserAutomation`** — and the model is told to use the browser for that message. You name the *capability*, never the internal steps; the mention resolves to whichever tools the active backend has. |
| 9 | **Human-in-the-loop CAPTCHA handoff** | When a site hits a "verify you are human" wall, the agent **pauses and hands it to you** instead of fighting it. No automated bypass — resolve it, press Resume, and the run picks up where it stopped. |
| 10 | **Rate-limit resilience** | Transient `429`s from free-tier providers are retried with backoff instead of killing the run, and a tool failure is never dressed up as an answer: the model retries transient errors, states what it could not do, and finishes the rest of the task. |

### Browser automation, two lanes

Both lanes run on the same `ToolLoopAgent` as normal chat, so the assistant interleaves answering and web actions in a single turn. They are **exclusive, not cumulative** — you pick the lane you want rather than giving the model a menu of overlapping tools:

| | Embedded tools | Deep task agent |
|---|---|---|
| **Where it runs** | A `WebContentsView` docked in the chat window | Its own Chrome window |
| **Shape** | Step-by-step: `browser_navigate`, `browser_snapshot`, `browser_read`, `browser_click`, `browser_type`, `browser_save_pdf`, … | One `browser_deep_task` call for a whole goal |
| **Approvals** | Read-only tools auto-approve; `browser_type` / `browser_save_pdf` prompt | **One** approval covers the entire run |
| **Watching it** | The panel updates live in the chat | Live cell-by-cell feed in the activity panel; pause / resume / stop |
| **Good for** | "What's on this page?", quick lookups | "Research these ten companies and verify each site" |
| **Blocked walls** | n/a | Pauses for you at a CAPTCHA or human-verification wall |

## How it works

```
┌────────────────────────────── renderer (Next.js, sandboxed) ───────────────────────────────┐
│  Dynamic island · capture overlay · chat panel · settings · browser activity feed            │
└───────────────────────────────────────┬──────────────────────────────────────────────────────┘
                                        │  IPC (invoke / events) — no renderer knows Node
┌───────────────────────────────────────▼──────────────────────────────────────────────────────┐
│                        electron/main (Node 24 · ESM · AI SDK 7)                              │
│                                                                                              │
│  ai/          provider config & resolution · polish · chat loop (ToolLoopAgent) · mentions     │
│  browser/     embedded Chromium via webContents.debugger — CDP, tools, approval loop          │
│               deep-task.ts — @browser_use/pi agent in its own Chrome window                  │
│  capture.ts   circle-capture service (desktopCapturer → PNG, 1568px downscale)               │
│  transcribe.ts whisper.cpp → text · ai/attachments.ts file storage + sniffing                │
│  db/          SQLite (libsql + Drizzle) — settings, encrypted keys, chat, tools, attachments │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **The AI SDK lives only in the Electron main process** — the sandboxed renderer can't load native modules, so all model calls, tool execution, and database access happen in main and stream progress over IPC.
- **whisper.cpp** runs as a local subprocess; the model (`base.en`, ~142 MB) is downloaded by a setup script — no network needed at dictation time.
- **The browser tools** run on the same `ToolLoopAgent` as normal chat, so the assistant can interleave answering and web actions in one turn. The accessibility tree is the model's primary sensory input; screenshots are for *you*.
- **The embedded page is a singleton behind a mutex.** Two chat sessions racing on one page would invalidate each other's element refs — a click computed against a stale box lands on whatever moved into that space. Every page operation goes through it, including navigation: without that, parallel `browser_navigate` calls abort each other and Chromium reports it as `ERR_ABORTED (-3)`, which reads as the site refusing you. (Real bug, real fix, pinned by a regression test that fails without the mutex.)
- **The resume after an approval is load-bearing** — the SDK's `responseMessages` only ever contains what a call produced, so the loop must append to the running message list or the input (and the user turn) is dropped. (This exact bug produced a hard Gemini 400 and is pinned by a smoke-test regression.)
- **A `@` mention is a capability, not a call.** `@BrowserAutomation` resolves to whichever tools the active backend has, and the directive explicitly licenses taking *as many as the job needs* — so one mention can drive a navigate → read → click → type sequence instead of pinning a single step.

## Repository layout

```
├── electron/                 # Electron main process (ESM, TypeScript)
│   ├── ai/                   # providers, catalog, chat loop, polish, mentions, attachments
│   ├── browser/              # embedded CDP browser: window, cdp, tools, refs,
│   │                         #   plus deep-task.ts — the @browser_use/pi lane
│   ├── db/                   # libsql + Drizzle schema, keys (safeStorage), migrations
│   ├── scripts/              # dev, whisper setup, offline test suites
│   ├── drizzle/              # committed SQL migrations
│   └── models/ vendor/       # whisper model + whisper.cpp (generated, gitignored)
├── renderer/                 # Next.js (sandboxed) UI — island, chat, capture, settings
├── docs/feat_plans_todos.md  # the design + status ledger for every feature
└── README.md
```

## Getting started

### Prerequisites

- **macOS**, **Linux**, or **Windows** (macOS and Linux are the actively developed targets; Windows builds whisper.cpp from source)
- Node.js 24+ (Electron 44 bundles Node 24.20)
- `cmake` + `git`
- A C++ toolchain for the whisper.cpp build — macOS: Xcode Command Line Tools; Linux: `build-essential` (GCC/clang); Windows: Visual Studio C++ Build Tools or WSL
- **Google Chrome**, only if you intend to use the deep-task lane — it drives a real Chrome window. The embedded lane needs nothing extra.

### Install & run

```bash
# 1. Dependencies
(cd electron  && npm install)
(cd renderer  && npm install)

# 2. Local whisper (one-time; builds whisper.cpp + downloads base.en)
#    Windows: run the same command from Git Bash, or build whisper-cli yourself
(cd electron && npm run setup:whisper)

# 3. Run — builds main + preload, launches Electron with the renderer
(cd electron && npm run dev)
```

Open the app, press **Alt+D** to dictate, add an API key under **AI Settings** in the sidebar, and start a chat.

The deep-task lane reuses the key you already configured for chat. If you want a different model for it (a vision-capable one is required — it reads pages visually), set `DUMMY_DEEP_MODEL` in `electron/.env`:

```bash
# a bare id for your active provider…
DUMMY_DEEP_MODEL=gemini-2.5-flash
# …or an explicit provider/model pair (ignored if the provider doesn't match)
DUMMY_DEEP_MODEL=anthropic/claude-sonnet-4-6
```

It falls back to a vision-capable default per provider if the value isn't in the catalog.

### Test

All suites are **offline** (model transport mocked) and chained by one command:

```bash
(cd electron && npm test)
```

This runs: provider compatibility matrix (incl. tool-calling and PDF file-part capability per provider) → approval-loop smoke (park/approve/deny + resume-shape regression) → browser-backend smoke (lane exclusivity + `@` mention scoping) → main + preload typecheck/build → embedded-browser CDP smoke (navigation, refs, inputs, screenshot, PDF, panel rectangle/collapse, concurrent-navigation race).

## Configuration

Providers are configured in-app under **AI Settings** (sidebar):

| Provider | Live catalog | Inline PDF support |
|---|---|---|
| OpenAI | ✅ | ✅ |
| Anthropic | ✅ | ✅ |
| Google | ✅ | ✅ |
| xAI | ✅ | ❌ (refused with guidance) |

Keys never leave the main process: `safeStorage`-encrypted in SQLite, decrypted only at call time, never over IPC.

The browser backend is set in the same panel under **Browser automation**. It is staged rather than written on click — pick a lane, press **Save**, get a confirmation — because the choice changes which tools the entire chat has.

## Security posture

- **Renderer is sandboxed** — no Node, no `contextIsolation` compromise; IPC surface is an explicit allowlist.
- **Embedded browser page is hostile-by-default** — own partition (`persist:dummy-browser`), no preload, hard-deny `file:`/`javascript:`/`data:` schemes, camera/mic/geolocation denied, popups folded into the same view.
- **No remote debugging port** — CDP runs in-process over `webContents.debugger`, so nothing is exposed on the network.
- **Writes require approval** — `browser_type` and `browser_save_pdf` prompt; reads and clicks run visibly in the panel. A deep task is **one** approval for the whole run, and the card says exactly that grant before you accept it.
- **No automated CAPTCHA bypass** — a human-verification wall is handed to you. The run pauses, you solve it, you press Resume. Stealth fingerprints and solver services are anti-bot circumvention and are deliberately absent.
- **Attachment safety** — per-category byte caps, content sniffing (real images, `%PDF-` magic, no binary-in-text), main derives all on-disk paths; the renderer can never inject a filesystem path.
- **Local data wipe** — Settings → Data & privacy deletes rows *and* files (including staging/orphans) in one transaction, so a reset frees real bytes, not just database rows.

## Feature status

| | |
|---|---|
| ✅ Shipped | Push-to-talk dictation · provider config · jargon polish · persistent chat · circle-capture · document/text attachments · embedded browser automation · **deep-task agent (`@browser_use/pi`)** · **switchable browser backend** · **`@` tool picker** · **CAPTCHA handoff** · **rate-limit resilience** · local data wipe & image deletion |
| 📋 Backlog | Streaming/VAD dictation · local command execution · chat-scoped dictation · compact tool-trace summaries in chat · headless deep runs |

The **ledger** for every feature — decisions, provider quirks, hard constraints, and traps found — lives in [`docs/feat_plans_todos.md`](docs/feat_plans_todos.md). It is written as the work happens, not after.

## Tech stack

| Layer | Choice |
|---|---|
| Shell | Electron 44.3.0 (Node 24.20 embedded, ESM, plain `tsc`) |
| UI | Next.js 16 · React 19 · shadcn/ui · react-markdown |
| AI | Vercel AI SDK 7 (`ToolLoopAgent`, `streamText`) + `@ai-sdk/{openai,anthropic,google,xai}` |
| Deep-task agent | `@browser_use/pi` 0.1.0 (`@earendil-works/pi-ai` provider layer) |
| Storage | SQLite via `@libsql/client` + Drizzle ORM (committed migrations) |
| Transcription | whisper.cpp (`base.en`) as a local subprocess |
| Browser automation | raw CDP over `webContents.debugger` for the embedded lane — zero new runtime deps |

## Contributing

PRs welcome. The feature plan and todo ledger in [`docs/feat_plans_todos.md`](docs/feat_plans_todos.md) is the source of truth — if you change behavior, record the trap or decision there in the same style (verified against installed source, not memory).

## License

ISC — see [`electron/package.json`](electron/package.json) (a standalone `LICENSE` file is upcoming).

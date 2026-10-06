<div align="center">

# dummy

A local-first AI assistant for macOS — push-to-talk dictation, circle-capture screenshots, and a tool-using chat with an embedded browser, all running on your own machine with your own API keys.

</div>

<div align="center">

![macOS](https://img.shields.io/badge/platform-macOS-333333?logo=apple&logoColor=white)
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

**dummy** is a local desktop AI companion for macOS. Hit **Alt+D**, hold the key, and speak — the audio is transcribed **locally** with whisper.cpp, cleaned up by your chosen model, and copied to your clipboard. Drag a rectangle over anything on screen to attach it as an image. Drop the transcript into a persistent chat that can also **open an embedded browser and act on websites for you** — reading, clicking, typing, and saving PDFs, with an approve/deny prompt only for actions that leave the page behind.

Everything is local-first: your API keys are encrypted with the macOS keychain (`safeStorage`), and your chat history, attachments, and settings live in a local SQLite database. No cloud account, no telemetry, no child servers.

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
| 6 | **Deep-task lane** *(planned)* | An optional autonomous agent lane (`browser-use-pi`) that opens its own Chrome window for long unattended tasks. Design locked; not yet built. |

## How it works

```
┌────────────────────────────── renderer (Next.js, sandboxed) ───────────────────────────────┐
│  Dynamic island · capture overlay · chat panel · settings · embedded browser activity UI    │
└───────────────────────────────────────┬──────────────────────────────────────────────────────┘
                                        │  IPC (invoke / events) — no renderer knows Node
┌───────────────────────────────────────▼──────────────────────────────────────────────────────┐
│                        electron/main (Node 24 · ESM · AI SDK 7)                              │
│                                                                                              │
│  ai/          provider config & resolution · polish · chat loop (ToolLoopAgent)              │
│  browser/     embedded Chromium via webContents.debugger — CDP, tools, approval loop         │
│  capture.ts   circle-capture service (desktopCapturer → PNG, 1568px downscale)               │
│  transcribe.ts whisper.cpp → text · ai/attachments.ts file storage + sniffing                │
│  db/          SQLite (libsql + Drizzle) — settings, encrypted keys, chat, tools, attachments │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **The AI SDK lives only in the Electron main process** — the sandboxed renderer can't load native modules, so all model calls, tool execution, and database access happen in main and stream progress over IPC.
- **whisper.cpp** runs as a local subprocess; the model (`base.en`, ~142 MB) is downloaded by a setup script — no network needed at dictation time.
- **The browser tools** run on the same `ToolLoopAgent` as normal chat, so the assistant can interleave answering and web actions in one turn. The accessibility tree is the model's primary sensory input; screenshots are for *you*.
- **The resume after an approval is load-bearing** — the SDK's `responseMessages` only ever contains what a call produced, so the loop must append to the running message list or the input (and the user turn) is dropped. (This exact bug produced a hard Gemini 400 and is pinned by a smoke-test regression.)

## Repository layout

```
├── electron/                 # Electron main process (ESM, TypeScript)
│   ├── ai/                   # providers, catalog, chat loop, polish, attachments
│   ├── browser/              # embedded CDP browser: window, tools, refs, cdp
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

- macOS (Apple Silicon recommended — dev target)
- Node.js 24+ (Electron 44 bundles Node 24.20)
- Xcode Command Line Tools, `cmake`, `git` (for the whisper.cpp build)
- Google Chrome installed only if you intend to use the planned deep-task lane

### Install & run

```bash
# 1. Dependencies
(cd electron  && npm install)
(cd renderer  && npm install)

# 2. Local whisper (one-time; builds whisper.cpp + downloads base.en)
(cd electron && npm run setup:whisper)

# 3. Run — builds main + preload, launches Electron with the renderer
(cd electron && npm run dev)
```

Open the app, press **Alt+D** to dictate, add an API key under **AI Settings** in the sidebar, and start a chat.

### Test

All suites are **offline** (model transport mocked) and chained by one command:

```bash
(cd electron && npm test)
```

This runs: provider compatibility matrix (incl. tool-calling and PDF file-part capability per provider) → approval-loop smoke (park/approve/deny + resume-shape regression) → main + preload typecheck/build → embedded-browser CDP smoke (navigation, refs, inputs, screenshot, PDF, panel rectangle/collapse).

## Configuration

Providers are configured in-app under **AI Settings** (sidebar):

| Provider | Live catalog | Inline PDF support |
|---|---|---|
| OpenAI | ✅ | ✅ |
| Anthropic | ✅ | ✅ |
| Google | ✅ | ✅ |
| xAI | ✅ | ❌ (refused with guidance) |

Keys never leave the main process: `safeStorage`-encrypted in SQLite, decrypted only at call time, never over IPC.

## Security posture

- **Renderer is sandboxed** — no Node, no `contextIsolation` compromise; IPC surface is an explicit allowlist.
- **Embedded browser page is hostile-by-default** — own partition (`persist:dummy-browser`), no preload, hard-deny `file:`/`javascript:`/`data:` schemes, camera/mic/geolocation denied, popups folded into the same view.
- **No remote debugging port** — CDP runs in-process over `webContents.debugger`, so nothing is exposed on the network.
- **Writes require approval** — `browser_type` and `browser_save_pdf` prompt; reads and clicks run visibly in the panel.
- **Attachment safety** — per-category byte caps, content sniffing (real images, `%PDF-` magic, no binary-in-text), main derives all on-disk paths; the renderer can never inject a filesystem path.

## Feature status

| | |
|---|---|
| ✅ Shipped | Push-to-talk dictation · provider config · jargon polish · persistent chat · circle-capture · document/text attachments · embedded browser automation |
| 🔜 Planned | Deep-task lane (`browser-use-pi`) — design locked, see `docs/feat_plans_todos.md` → Feature 6 |
| 📋 Backlog | Streaming/VAD dictation · local command execution · chat-scoped dictation · compact tool-trace summaries in chat |

The **ledger** for every feature — decisions, provider quirks, hard constraints, and traps found — lives in [`docs/feat_plans_todos.md`](docs/feat_plans_todos.md). It is written as the work happens, not after.

## Tech stack

| Layer | Choice |
|---|---|
| Shell | Electron 44.3.0 (Node 24.20 embedded, ESM, plain `tsc`) |
| UI | Next.js 16 · React 19 · shadcn/ui · react-markdown |
| AI | Vercel AI SDK 7 (`ToolLoopAgent`, `streamText`) + `@ai-sdk/{openai,anthropic,google,xai}` |
| Storage | SQLite via `@libsql/client` + Drizzle ORM (committed migrations) |
| Transcription | whisper.cpp (`base.en`) as a local subprocess |
| Browser automation | raw CDP over `webContents.debugger` — zero new runtime deps |

## Contributing

PRs welcome. The feature plan and todo ledger in [`docs/feat_plans_todos.md`](docs/feat_plans_todos.md) is the source of truth — if you change behavior, record the trap or decision there in the same style (verified against installed source, not memory).

## License

ISC — see [`electron/package.json`](electron/package.json) (a standalone `LICENSE` file is upcoming).
# Feature Plans & Todos

---

## Feature 1 — Push-to-Talk Dictation (whisper.cpp → Clipboard)

### Goal
While the widget is open (Alt+D), the user holds the keys, speaks into the mic, and on release the audio is transcribed locally with **whisper.cpp (base.en model)** and the text is copied to the OS clipboard so they can paste it anywhere.

### Non-goals (v1)
- No auto-pasting into specific apps (clipboard only).
- No live streaming transcript (transcribe the captured clip, not continuous VAD).
- No settings UI, no model switcher.
- No push-to-chat / conversation integration yet.

### Hardware context
- MacBook Air M1, **8 GB RAM / 256 GB SSD**.
- `base.en` model = ~142 MiB disk, ~388 MB RAM — comfortable fit.
- whisper.cpp on Apple Silicon builds with NEON + Metal (GPU) offload by default → near/over real-time for short clips.

### Architecture Overview

```
Renderer (Next.js)                      Electron Main (TS, ESM)
─────────────────────                   ─────────────────────────
getUserMedia()                          globalShortcut("Alt+D")
MediaRecorder (webm/opus)               before-input-event (keyUp) → "up"
decodeAudioData → 16 kHz mono PCM       spawn whisper-cli -m ggml-base.en.bin
→ encode WAV                              → read .txt transcript
  │                                          │
  └── IPC: dictation:audio (WAV buffer) ─────┘
                                            clipboard.writeText(text)
                                            IPC: dictation:transcript (text)
```

### User Flow / State Machine
1. **Idle** — window hidden (existing behavior).
2. User presses **Alt+D (down)** → `global-shortcut:down` → window opens, panel enters **listening** state, `getUserMedia` starts, audio bars show real mic input.
3. User releases **Alt+D (up)** → `global-shortcut:up` → stop recording, stop mic stream.
4. **Transcribing** state — panel shows thinking/processing indicator.
5. Renderer converts clip → 16 kHz mono WAV → sends to main.
6. Main spawns `whisper-cli` → reads transcript → trims → `clipboard.writeText()`.
7. **Done** — panel shows the transcript + "copied" hint for a few seconds, then auto-hides (window back to `empty`).
8. **Errors** — mic permission denied, whisper binary/model missing, empty audio → show message in panel, hide after delay.

### Shortcut & Key-Release Detection (needs work — current gap)
- Today main only ever sends `global-shortcut:down`; `globalShortcut` has **no keyup**, and preload already listens for an `"up"` phase that main never sends.
- **Plan:** capture key release in main via `mainWindow.webContents.on("before-input-event")` when the window is focused (it is focused right after `show()/focus()` on `down`). On `keyUp` of `Alt`/`d` → send `global-shortcut:up`.
- **Fallbacks:**
  - Renderer `keyup` listener (window is key while open).
  - Hard cap on recording length (e.g. 60 s) so a stuck key can't record forever.
  - Re-press Alt+D while listening = cancel + restart.

### Audio Capture & Conversion (renderer)
- `navigator.mediaDevices.getUserMedia({ audio: true })` — already supported in the sandboxed renderer.
- Record with `MediaRecorder` (`audio/webm;codecs=opus`).
- On stop: `AudioContext.decodeAudioData` → offline `AudioContext` resample to **16 kHz, mono, f32** → write as **PCM S16LE WAV** (whisper-cli requires 16-bit WAV; avoids dependency on ffmpeg).
- **Implemented:** `MediaRecorder` (`audio/webm;codecs=opus`) → `AudioContext.decodeAudioData` → offline resample to **16 kHz mono f32** → PCM S16LE WAV (no ffmpeg dependency). AudioWorklet raw-path considered but dropped (webm→decode is one short function and works cross-platform).
- Feed the live `MediaStream` into the existing `useMultibandVolume`/`BarVisualizer` so AudioBars animate from **real** audio during listening (AudioBars currently only uses `demo` mode; accept a `mediaStream` prop and keep demo when no stream).

### whisper.cpp Integration (main)
- Place whisper.cpp under `electron/vendor/whisper.cpp` (git clone, pinned tag).
- **Setup script** `electron/scripts/setup-whisper.sh`:
  1. `git clone https://github.com/ggml-org/whisper.cpp.git` (if missing).
  2. `cmake -B build && cmake --build build -j --config Release` (Metal/NEON enabled by default on arm64).
  3. `sh ./models/download-ggml-model.sh base.en` → put `ggml-base.en.bin` in `electron/models/`.
- Transcription (`transcribe.ts` service):
  - Write WAV to a temp dir, spawn `vendor/whisper.cpp/build/bin/whisper-cli -m models/ggml-base.en.bin -f <wav> -nt -otxt` (timestamp-free, txt output next to input), read the `.txt`, delete temp files.
  - Kill process on timeout (e.g. 30 s), report error otherwise.
  - Model choice: **`base.en`** (confirmed — English-only, faster).

### Clipboard & UX
- `clipboard.writeText(transcript)` in main (no permissions needed).
- Panel states map to existing island/Bars states:
  - listening → `listening` (bars show live audio)
  - transcribing → `thinking` (pulse animation; existing Bar support)
  - done → static text preview (transcript) + copied check
  - error → short error line, then hide.

### IPC Surface (additions)
- main → renderer: `dictation:status` (`"listening" | "transcribing" | "done" | "error"`), `dictation:transcript` (`{ text, copied }`).
- renderer → main: `dictation:audio` (WAV ArrayBuffer), `dictation:cancel`.
- Reuse existing `renderer:ready` handshake; keep `window:set-island-size` so the window shrinks/grows with panel states.

### Permissions / Platform Notes
- **macOS mic:** `getUserMedia` needs `NSMicrophoneUsageDescription` in `Info.plist`.
  - Dev: `electron .` uses Electron.app's plist — may require a custom plist / `NSMicrophoneUsageDescription`.
  - Packaged: set via electron-builder `extendInfo`.
- **Windows:** works with same code path (whisper-cli needs a Windows build; document but don't block).

### Prerequisites
- Xcode CLT (`xcode-select --install`), `cmake`, `git`.
- Run `setup-whisper.sh` once; note model download location + disk cost (~600 MB total with build).

---

## Todos — Feature 1

### Phase A — whisper.cpp setup (Electron)
- [x] Add `electron/scripts/setup-whisper.sh` (clone pinned whisper.cpp, cmake build, download `ggml-base.en.bin`)
- [x] Add `electron/vendor/` + `electron/models/` to `.gitignore`
- [x] Verify `whisper-cli` runs on M1 with a sample WAV (non-blocking, Metal-coded)
- [x] Add npm script `setup:whisper` to `electron/package.json`

### Phase B — Audio capture (renderer)
- [x] `useDictation` hook: `getUserMedia`, `MediaRecorder`, stop → WAV (16 kHz mono S16LE)
- [x] Choose + implement capture path (MediaRecorder + decodeAudioData — no ffmpeg dependency)
- [x] Wire live mic stream into AudioBars (`mediaStream` prop, demo fallback)
- [x] Handle mic permission denied (error state "Microphone access denied")

### Phase C — Transcription service (main)
- [x] `transcribe.ts`: temp WAV → `whisper-cli` spawn → read `.txt` → cleanup + timeout
- [x] `dictation` IPC handlers + state machine (idle/listen/transcribe/done/error)
- [x] `clipboard.writeText` on success; "Nothing heard" error on empty transcript
- [x] `before-input-event` keyup → `global-shortcut:up` (+ renderer keyup fallback, 60 s cap, re-press-to-finish)

### Phase D — UI states (renderer)
- [x] Panel states: listening / transcribing / done / error
- [x] Transcript preview + "copied" indicator, auto-hide after a few seconds
- [x] Auto-hide window after done/error (reset island to `empty`)
- [ ] **Manual test:** hold Alt+D → speak → release → paste (real mic, human-held key)

### Phase E — Polish / hardening
- [x] macOS dev `Info.plist` mic usage description (verified present in Electron.app; builder `extendInfo` N/A — no packaging config yet)
- [x] Error surfaced in panel when model/binary missing (`whisperReady` check)
- [x] Recording length cap + cancel-on-re-press + quick-tap abort (keyUp during `getUserMedia` in flight)
- [x] `tsc` green in `electron/` and `renderer/`; eslint green on all feature files (pre-existing errors remain in untouched files: `layout.tsx`, `bar-visualizer.tsx`, `carousel.tsx`, `use-mobile.ts`)

---

## Open Questions
1. **Resolved:** `base.en` chosen; after copy, show text briefly then auto-hide.
2. Key-release reliability if the renderer loses focus mid-hold — is the 60 s cap + re-press cancel acceptable for v1?
3. Should transcribing ever apply `$1`/command shortcuts (e.g. paste-directly)? (Not in v1.)

---

## Feature 2 — AI Provider Configuration (AI SDK + local SQLite)

> **Supersedes** the previous "OpenCode Model Access" design. OpenCode's free tier could only be used from *inside* the OpenCode CLI — a spawned `opencode serve` child carried no session identity, and it leaked sessions into the user's real CLI. Replaced with a direct **Vercel AI SDK** integration: the user brings their own provider API key, everything is stored encrypted on their machine, and no child process is spawned.

### Goal
The user configures which AI provider + model the app talks to. The provider key is encrypted at rest with the OS keychain (`safeStorage`), the selection and chat history live in a local SQLite DB via Drizzle ORM, and main exposes a resolved model instance to the polish (F2.5) and chat (F3) features. **No prompts or streaming in this feature** — it's config + persistence only.

### Installed dependencies (verified in `electron/node_modules`)
| Package | Version | Role |
|---|---|---|
| `ai` | 7.0.114 | `generateText` / `streamText` / `ToolLoopAgent` |
| `@ai-sdk/openai` | 4.0.75 | OpenAI provider |
| `@ai-sdk/anthropic` | 4.0.63 | Anthropic provider |
| `@ai-sdk/google` | 4.0.80 | Google provider |
| `@ai-sdk/xai` | 5.0.8 | xAI provider |
| `drizzle-orm` | 1.0.0-rc.4 | ORM |
| `drizzle-kit` | 1.0.0-rc.4 | Migration generation (dev) |
| `@libsql/client` | 0.18.0 | SQLite driver |

### Where the AI SDK lives: **Electron main, not the renderer**
The renderer is `sandbox: true` + `contextIsolation: true` with no nodeIntegration (`electron/main.ts`), so it cannot load native modules (`@libsql/client`) or run `streamText` / `ToolLoopAgent` — those require Node. Hosting it in the Next.js dev server on :3000 would put API keys in the web tier and require shipping a Next server inside the packaged app. Main already owns the dictation pipeline and the `chat:event` IPC forwarder, so the swap is surgical.

**The renderer gets zero AI dependencies.** `renderer/hooks/use-chat.ts` already speaks the `delta`/`done`/`error` protocol and just gets repointed at new IPC channels. We deliberately skip `@ai-sdk/react` — its `useChat` requires either an HTTP transport or an in-process agent transport, neither of which fits Electron IPC without hand-writing a custom transport for a hook we already have.

### Architecture Overview

```
renderer (Next.js, sandboxed)              electron/main (Node, ESM)
----------------------------              -------------------------
app/settings/page.tsx (sidebar route)      ai/provider.ts -> resolveModel()
  | ai:get-config      (invoke) --------->   settings table (provider, model)
  | ai:set-provider    (invoke) --------->   provider_keys table
  | ai:set-model       (invoke) --------->     + safeStorage.decryptString()
  | ai:set-key         (invoke) --------->   createOpenAI/Anthropic/Google/Xai({apiKey})
  + ai:clear-key       (invoke) --------->   -> provider(modelId)  [LanguageModel]
                                              |
                                            db/ (libsql + drizzle)  <- local .db file
```

### Platform API names (verified against bundled `ai@7` docs/source — NOT from memory)
AI SDK 7 renamed several things from older versions. These are the **current** names; the old ones still work as deprecated fallbacks:
- `instructions` — **not** `system`.
- `onEnd` / `onStepEnd` — **not** `onFinish` / `onStepFinish`.
- `maxOutputTokens` — **not** `maxTokens`.
- `result.stream` — `fullStream` is a deprecated alias. `textStream` emits bare strings but **silently drops error parts**, so never use it for anything that must surface failures.
- `ToolLoopAgent.stream()` returns a `Promise<StreamTextResult>` and **must be awaited** (the bundled doc examples omit the `await`; the source is authoritative).
- Tool schemas use `inputSchema`, not `parameters`.

### Database layer (`electron/db/`)
- **Driver:** `@libsql/client` with a `file:` URL -> `app.getPath("userData")/app.db`. Chosen over `better-sqlite3` because it ships prebuilt NAPI binaries and needs no `@electron/rebuild` step on every Electron upgrade (the same class of recurring build-break risk as the whisper binary). **Verified working under Electron 44** with a real spike: create table -> insert -> select -> reconnect -> data persisted.
- `drizzle-orm@1.0.0-rc.4` API notes (rc differs from 0.x, verify before writing queries):
  - `drizzle({ client })` — the config **omits `schema` entirely**; passing it is a type error. Table types come from the query builder, not from a schema generic.
  - The libsql driver is **async-only** (`SQLiteAsyncDatabase`). Every `.get()` / `.all()` / `.run()` returns a `Promise` and must be awaited. Consequently `resolveModel()` and all config/key helpers are async.
  - `db.get(sql)` / `db.all(sql)` take **no bind parameters** — use the query builder (`db.select().from(t).where(eq(...))`) when you need them.
  - `migrate()` lives at `drizzle-orm/libsql/migrator`.
- **Fallback:** `node:sqlite` + Drizzle's `sqlite-proxy` driver (verified `node:sqlite` works in Electron 44 / Node 24.20). Only if the libsql spike ever fails.
- **Schema:**
  - `settings` — key/value: `selected_provider`, `selected_model`.
  - `provider_keys` — `provider` (PK), `encrypted_key` (safeStorage ciphertext, base64), `updated_at`. One key per provider so switching back and forth doesn't re-entry.
  - `chat_messages` — `id`, `session_id`, `role`, `content`, `created_at` (F3 persistence, indexed by `session_id`).
- **Migrations:** `drizzle-kit generate` into the committed `drizzle/` folder (config at `electron/drizzle.config.ts`, excluded from `tsc`), applied by `migrate()` on `app.whenReady()`. Never runtime-push. `npm run db:generate` regenerates.

### Key security
- `safeStorage.encryptString(key)` -> ciphertext -> SQLite. `safeStorage.isEncryptionAvailable()` guards; if unavailable, refuse to persist and show an error rather than writing plaintext.
- Decrypted only in main, at call time, passed straight to the provider factory. **Never** crosses IPC, **never** enters the renderer, **never** logged.
- All user data (keys, settings, chat history) stays in the local `app.db` file.

### Model catalog — live from the provider API, not hardcoded
The picker calls each provider's real **list models** endpoint with the user's stored key, so ids are never guessed. Implemented in `electron/ai/catalog.ts` (`listProviderModels`), exposed as the `ai:list-models` IPC channel, and refreshed whenever the provider or key changes.

| Provider | Endpoint | Response shape |
|---|---|---|
| OpenAI | `GET https://api.openai.com/v1/models` (`Authorization: Bearer`) | `{ data: [{ id }] }` |
| xAI | `GET https://api.x.ai/v1/models` (`Authorization: Bearer`) | `{ data: [{ id }] }` |
| Anthropic | `GET https://api.anthropic.com/v1/models?limit=100` (`x-api-key` + `anthropic-version: 2023-06-01`) | `{ data: [{ id, display_name }] }` |
| Google | `GET https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=…` | `{ models: [{ name: "models/…", displayName, supportedGenerationMethods }] }` |

All four verified reachable (auth-gated 401/400, **not** 404) as of 2026-09-25.

- **Filtering:** these endpoints also return embeddings, image, audio, TTS, realtime, and Gemma models, which would fail from `generateText`/`ToolLoopAgent`. They are filtered out; for Google the `supportedGenerationMethods` array is used when present (must include `generateContent`). Google's `models/` prefix is stripped, since the SDKs expect the bare id.
- **Fast/small grouping:** the picker splits results into a **Fast & small** group and an **All models** group. Matching families: `mini`, `nano`, `lite`, `haiku`, `-fast`, `turbo`. Dictation polish wants low latency, so the cheap tier is surfaced first.
- **Fallback:** `MODEL_CATALOG` in `electron/ai/models.ts` is now only an **offline seed**, used when the live request fails (offline, bad key, endpoint change). It must never be treated as the source of truth, and `setModel()` deliberately does **not** validate against it — doing so would reject valid live ids.
- **Known id inconsistency (real, not a typo):** OpenAI uses **dotted** versions (`gpt-5.6-luna`) while Anthropic uses **hyphenated** (`claude-sonnet-4-5`). Earlier drafts of this doc claimed the opposite; that was wrong. Verify against live docs before editing the seed.

`resolveModel()` reads `selected_provider` + `selected_model` from settings, decrypts the key, and returns a live model instance. Throws a typed `NoProviderConfigured` / `MissingApiKeyError` when unset — callers (F2.5, F3) degrade gracefully.

> **IPC return-shape trap (caused a real crash).** The setters in `ai/config.ts` return `Promise<void>`. Writing `setModel(m).then((config) => ({ ok: true, config }))` ships `{ ok: true, config: undefined }` to the renderer, and the preload's *cast* hides it from the type checker. Every mutating handler must go through the `mutateConfig()` helper in `main.ts`, which awaits the mutation and then re-reads `getConfig()`.

### IPC Surface (replaces all `opencode:*`)
- renderer -> main (invoke): `ai:get-config`, `ai:set-provider`, `ai:set-model`, `ai:set-key`, `ai:clear-key`.
- **Removed:** the `ai:open-settings` event and its `Alt+M` shortcut — settings is a route (`/settings`) inside the chat window, opened from the sidebar.
- **Removed:** `opencode:status`, `opencode:models`, `opencode:get-model`, `opencode:set-model`, `onOpenCodeStatus`, `stopOpenCode`.
- `chat:*` channels keep their existing shapes so `use-chat.ts` / `chat-panel.tsx` barely change.

### User Flow (v1)
1. **AI Settings** in the chat sidebar opens the `/settings` page (same window).
2. Provider row (OpenAI / Anthropic / Google / xAI) -> API key field (masked, write-only, shows "saved" state not the value) -> model row.
3. Selection persisted to SQLite; key encrypted via safeStorage.
4. Error states: no provider selected, no key set, encryption unavailable, invalid key.

### Platforms
- macOS dev (current target). Provider calls are plain HTTPS from main; no child process, no port, no server lifecycle.

---

## Todos — Feature 2

### Phase 0 — Spike (blocks everything)
- [x] Verified `@libsql/client` opens a `file:` DB **inside Electron** (script run under `./node_modules/.bin/electron`): create table -> insert -> read back -> data still present after reconnect
- [x] Not needed — the `node:sqlite` + `drizzle-orm/sqlite-proxy` fallback was not required
- [ ] Packaging: ship the `drizzle/` migrations folder via `extraResources` and resolve `MIGRATIONS_FOLDER` from `process.resourcesPath` when packaged (dev currently resolves it to `electron/drizzle`)

### Phase A — Dependencies
- [x] `ai`, `@ai-sdk/{openai,anthropic,google,xai}`, `drizzle-orm@rc`, `drizzle-kit@rc`, `@libsql/client` installed in `electron/`

### Phase B — DB layer (`electron/db/`)
- [x] `schema.ts` — `settings`, `provider_keys`, `chat_messages` (+ `session_id` index)
- [x] `index.ts` — libsql `file:` client + `drizzle({ client })` + `migrate()` on `app.whenReady()` + `closeDb()` on `will-quit`
- [x] `keys.ts` — `safeStorage` encrypt/decrypt helpers + `isEncryptionAvailable()` guard (typed `EncryptionUnavailableError`)
- [x] `drizzle.config.ts` + `drizzle-kit generate` -> committed migrations (`electron/drizzle/`)
- [x] Add `db:generate` npm script

### Phase C — Provider service (`electron/ai/`)
- [x] `models.ts` — provider-aware seed catalog (fallback only; live ids come from each provider's list endpoint)
- [x] `catalog.ts` — `listProviderModels()` hits the real OpenAI / Anthropic / Google / xAI list endpoints with the stored key; filters non-chat models, strips Google's `models/` prefix, sorts the fast/small tier first, falls back to the seed on failure
- [x] `provider.ts` — async `resolveModel()` -> live model instance; typed `NoProviderConfiguredError` / `MissingApiKeyError`
- [x] Provider factory map using `createOpenAI` / `createAnthropic` / `createGoogle` / `createXai`

### Phase D — IPC + preload
- [x] `ai:get-config` / `ai:catalog` / `ai:list-models` / `ai:set-provider` / `ai:set-model` / `ai:set-key` / `ai:clear-key` handlers
- [x] All mutating handlers go through `mutateConfig()`, which re-reads `getConfig()` after the write (the setters return `void`, so resolving their value directly shipped `config: undefined` to the renderer)
- [x] `ai:open-settings` event wired to Alt+M — later removed in favour of the `/settings` route
- [x] Updated `electron/preload.ts` + `renderer/electron.d.ts`; all `opencode:*` types deleted
- [x] `will-quit` closes the DB; `stopOpenCode()` dropped

### Phase E — Renderer
- [x] Deleted `electron/opencode.ts`, `renderer/hooks/use-opencode.ts`, `renderer/components/model-picker.tsx`
- [x] Dropped `@opencode-ai/sdk` from `electron/package.json`
- [x] `settings-panel.tsx` + `use-ai-settings.ts` — provider select -> masked key input (+ Save/Clear) -> model select; model list is fetched live per provider and split into **Fast & small** / **All models** groups; `settings` island preset (360×330)
- [x] `page.tsx` — picker state swapped for settings state (three-way render: settings / chat / island)

### Phase F — Validation
- [x] `tsc -b` green in both packages; `next build` + electron build green (pre-existing unrelated errors in `bar-visualizer.tsx`, `carousel.tsx`, `use-mobile.ts`, `layout.tsx` remain)
- [x] Headless smoke: migration applied from the committed folder, settings persisted, safeStorage ciphertext on disk round-tripped, chat row persisted and cleared
- [x] Headless smoke on the config path: `set-provider` / `set-model` return a defined config with a boolean `hasKey`; a live id outside the seed catalog is accepted; a missing key returns a clean error; a bad key falls back to the seed catalog
- [x] All four list-models endpoints confirmed reachable (401/400 auth-gated, not 404)
- [ ] Manual: sidebar -> AI Settings -> set provider -> enter key -> pick model -> persists across restart (needs a real provider key)
- [ ] Manual: confirm the key is ciphertext on disk and never appears in renderer memory/DevTools

---

## Open Questions
- Should the settings panel expose a "test key" button that fires a 1-token request to validate before saving?
- Per-provider keys (current) vs a single active key? Per-provider wins if the user juggles two.

---

## Feature 2.5 — Technical-Jargon Post-Processing (LLM pass over transcribed text)

### Goal
`base.en`-class whisper transcribes everyday English well but mangles technical jargon (library/package names, identifiers, flags, version strings, commands like `pnpm dlx`, APIs like `getUserMedia`, terms like "idempotent"). **We will NOT scale whisper up to `small`/`medium`** (already decided). Instead, once Feature 2's provider config exists, we post-process the raw transcript through the **user's selected model** via the AI SDK, and copy the corrected text to the clipboard.

### Why not another whisper model
- `base.en` → `small.en` costs ~4x RAM (+~300 MB on an 8 GB M1) and only marginally helps domain terms it was never trained to spell.
- Technical accuracy needs a model that knows **the user's own stack + technical vocab**, not a generic English model. LLM pass fixes the specific failure mode (spelling/munging of jargon) without the RAM/disk cost.

### User Flow (v1)
1. User holds Alt+D, speaks (existing F1 flow).
2. Release → whisper `base.en` transcribes (existing F1) → **raw transcript**.
3. Island switches to a **"Polishing…"** state (between transcribing and done).
4. Main sends raw text to the selected model with a strict "fix jargon, don't rephrase" prompt via `generateText` (resolves the model from F2 config).
5. Corrected text → `clipboard.writeText()` → island "Copied to clipboard" state (same auto-hide as F1).
6. **Fallbacks (never worse than today):** no provider configured / invalid key / model error / timeout → copy the raw whisper transcript and skip step 3–4 (or show a brief "polish skipped" hint).

### Architecture Overview
```
renderer                               electron/main
--------                               ------------
whisper transcribes (unchanged F1)     transcribeWav() -> raw text
   |                                        |
   |  dictation:status "polishing"          |  polishTranscript(rawText)
   |<-------------------------------------- |  resolveModel()  [F2 config]
   |                                        |  generateText({
   |                                        |    model, instructions: fix-jargon prompt,
   |                                        |    prompt: raw })
   |                                        |  -> result.text
   |  clipboard.writeText(corrected) <------|
   |  "done" + auto-hide                    |
```
- **Stateless** — no session, no server, no child process. Just `generateText` from the AI SDK against the resolved model (F2). The model/key come from local SQLite config; the API key never leaves main.
- **Prompt model** = the persisted F2 selection. (Users may want a fast/cheap model for this; selection is theirs.)
- **No tool-disabling hack needed** — the old OpenCode implementation had to disable every tool because OpenCode's agent prompt overrode the system prompt. `generateText` is a plain completion, so an `instructions` string just works.

### The fix-jargon prompt (main-process constant, `instructions` + single user turn)
- Instruction (`instructions`): "You fix transcription errors in technical/developer speech. Output ONLY the corrected transcript. Do not add commentary, paraphrases, quotes, markdown, or reword phrasing. Preserve sentence structure, punctuation, capitalization, and line breaks exactly. Correct: library/package/tool names, identifiers, flags, commands, version numbers, URLs, APIs, file paths, and technical terms. If raw terms look like deliberate speech (e.g. intentional names), keep them."
- `generateText({ model, instructions: <above>, prompt: <raw transcript> })`; take `result.text`.
- Reuse the existing `POLISH_SYSTEM_PROMPT` / `POLISH_USER_PROMPT` constants verbatim from the old `opencode.ts` — they were already tuned and validated.

### Latency & budget
- Adds one network LLM call per clip (1–3 s typical for a fast model). Acceptable for push-to-talk; island shows "Polishing…".
- Hard timeout in main (e.g. 30 s) → fall back to raw text.
- Skip preprocessing entirely when raw transcript is empty/whitespace (raw copy/no-op, as F1).

### IPC Surface (additions)
- main → renderer: `dictation:status` states extended: reuse `transcribing`, add `polishing`.
- No new renderer→main channels: flow stays inside the existing `dictation:audio` handler (transcribe → polish → clipboard → status).
- `polishTranscript(raw)` moves out of `opencode.ts` into `electron/ai/polish.ts`.

### Renderer / island (additions)
- New `DictationStatus.state = "polishing"` + island hint ("Polishing technical terms…"): map to an added state in `useDictation`; reuse the existing spinner/thinking bars; keep auto-hide timing for `done`/`error` unchanged.

### Platforms / errors
- macOS dev (target). All failure paths degrade to **raw transcript** (never block dictation on the LLM).
- Error paths handled: no provider configured, missing/invalid key, `resolveModel()` throws, `generateText` throws, empty model reply, timeout.

---

## Todos — Feature 2.5

### Phase A — Service: `polishTranscript(raw)` in `electron/ai/polish.ts` (ported from `opencode.ts`)
- [x] `polishTranscript(raw: string): Promise<string>` — **ported** to `generateText` (was: OpenCode SDK ephemeral session + first text part)
- [x] Fix-jargon instruction constant + hard timeout (e.g. 30 s) + empty-reply guard
- [x] Behavior when no model selected / server unavailable → return raw text unchanged
- [x] **Ported:** `generateText({ model: await resolveModel(), instructions: POLISH_SYSTEM_PROMPT, prompt: raw })` -> `result.text`; timeout + fallback-to-raw kept verbatim
- [x] **Dropped** the tool-disabling workaround and the duplicated instruction (no longer needed with a plain completion)

### Phase B — Main: wire into `dictation:audio` handler
- [x] After `transcribeWav()` → call `polishTranscript()` → write corrected text; on success send `done`, mark it polished
- [x] On any polish failure → fall back to raw transcript copy (same `done` path)
- [x] Send `dictation:status { state: "polishing" }` between transcribe and done
- [x] Update `DictationStatus` type in `preload.ts` + `electron.d.ts` with `polishing`

### Phase C — Renderer UI
- [x] `useDictation` + island: `polishing` state → "Polishing technical terms…" hint (spinner/thinking bars, existing patterns)
- [x] Auto-hide timing unchanged; transcribe→polish→done sequence renders cleanly

### Phase D — Validation
- [x] `tsc` + lint green (`electron/` + `renderer/` feature files)
- [x] `polishTranscript` ported to `generateText`; `tsc -b` green in both packages, `next build` + electron build green
- [ ] **Re-smoke-test** against a real provider key — the F2.5 tuning above was validated through OpenCode, a different endpoint, so it must be re-validated and not assumed
- [ ] Manual test: hold Alt+D, speak a jargon-heavy phrase, verify corrected clipboard text + fallback when no model selected

---

## Open Questions
- F2.5: should "polish skipped" (fallback) be silent or briefly indicated in the island? (leaning: silent, since dictation still works)

---

---

## Feature 3 — Chat Panel (transcript → local chat)

### Goal
After dictation, the user can push the transcript into a **local chat panel** that talks to the **selected model** (F2), or just open the panel to continue a conversation. Two buttons in the dictation `done` state: **Send to chat** and **Open chat**.

> **Status:** the full chat flow is already built and working against OpenCode (`chat-panel.tsx`, `use-chat.ts`, `chat:*` IPC, `done`-island actions). The renderer is provider-agnostic and needs **no changes** — only the main-process service is ported from the OpenCode SDK to the AI SDK.

### Non-goals (v1)
- No auto-paste into specific apps (clipboard-only flow stays untouched).
- No agent file-tool execution inside chat — read-only Q&A (tools off, see note below).
- No chat-specific mic/dictation — follow-ups are typed for v1.

### User Flow (v1)
1. Dictate (Alt+D) → transcript + optional F2.5 polish → `done` state shows footer **[Send to chat] [Open chat] [×]**.
2. **Send to chat** → the transcript becomes the first user message in a persistent chat session → island grows to `chat` (560×720) → model reply **streams in live over IPC**.
3. **Open chat** → opens the panel showing existing history (or empty state) without injecting the current transcript.
4. In-panel `Textarea` + send button for typed follow-ups; history accumulates in one persistent session.
5. Reset control clears the session (delete + null).
6. **Falls backs (never block dictation):** no provider configured / invalid key / stream error → `chat:error` inside the panel; dictation → clipboard path unchanged.

### Decisions (confirmed)
- **Streaming via `ToolLoopAgent.stream()`** — consumes `result.stream` in main, forwards `text-delta` over IPC as `chat:delta`; stream end → `chat:done`; `error` part → `chat:error`. **The renderer sees the same event protocol it sees today**, so `useChat`/`ChatPanel` are untouched.
  - **Do not use `result.textStream`**: it emits bare strings and *silently drops error parts*, which turns a failed request into a bogus `chat:done`. Iterate `result.stream` and switch on `part.type` (`text-delta` / `error` / `abort`). This was caught in the end-to-end smoke test — a deliberately invalid key produced `done` instead of `error`.
- **`ToolLoopAgent` over raw `streamText`** — `ToolLoopAgent` is exported by `ai@7` and gives a proper multi-step loop for free. v1 registers **zero tools**, so the loop is a no-op today but the upgrade path is already in place. Note: the AI SDK 7 tool schema key is **`inputSchema`**, not `parameters`.
- **History in SQLite, not in memory** — the old implementation kept one long-lived in-memory OpenCode session; now `chat_messages` rows (`session_id`, `role`, `content`, `created_at`) are the source of truth and are re-hydrated into the model prompt on every send. Survives restarts, which the in-memory version did not.
- **`react-markdown`** already added for assistant replies (code blocks/headers/lists); user text stays plain; no other new deps.
- **No auto-hide in `done` when action buttons are shown** — manual `×` close only (so buttons are reliably clickable).
- **Explicitly skipping `@ai-sdk/react`** — its `useChat` needs an HTTP or in-process-agent transport; neither fits Electron IPC without a hand-written transport for a hook we already have and that already works.

### Architecture Overview
```
renderer (ChatPanel)                    electron/main (ai/chat.ts)
--------------------                    -------------------------
useChat hook                            db/ (SQLite chat_messages)
  | chat:send (invoke) --------------->   insert user row
  | chat:history (invoke) <-----------   select rows for session
  | chat:reset (invoke) --------------->   delete rows
  | chat:delta / chat:done / --------->   load history + new user msg
    chat:error (events)  <-----------   new ToolLoopAgent({ model,
                                          instructions, messages })
                                          .stream() -> result.stream
                                          text-delta -> chat:delta
                                          stream end  -> chat:done
                                          error part  -> chat:error
```
- **No child process, no server, no SSE subscription** — the OpenCode service's `global.event()` SSE forwarder is replaced by consuming the AI SDK's stream in-process. Much less machinery: no session IDs, no `session.idle` event to reconcile, no orphaned server.
- **Model** = resolved from F2 config (`resolveModel()`). History comes from SQLite, re-hydrated each send.
- **Tools** = none registered for v1, keeping the panel a read-only Q&A surface; `ToolLoopAgent` means a future tool toggle is a config change, not a rewrite. When tools land, the schema key is `inputSchema`.
- Streams are tracked per-`sessionId` so a reset mid-stream aborts cleanly (the in-memory session made this implicit; SQLite makes it explicit).

### IPC Surface (UNCHANGED — renderer needs no port)
- renderer → main (invoke): `chat:send` `{ text }`, `chat:history`, `chat:reset`.
- main → renderer (events): `chat:delta` `{ text }`, `chat:done` `{ text }`, `chat:error` `{ message }`.

### Renderer / island (additions)
- `ChatPanel` component: existing `Conversation` / `ConversationContent` / `Message` / `Bubble` / `MessageScroller` / `Textarea` / `Spinner` / `Button` primitives; assistant text via `react-markdown`, user text plain.
- `useChat` hook: history on open, streaming accumulator (deltas → current assistant bubble), send, reset, `isStreaming`, error.
- `page.tsx`: `chatOpen` state → `setSize("chat")` (560×720 preset); native window resize already handled by ResizeObserver on `#audio-bars-island` + main clamp.
- `doneActions` island preset (~340×110) for transcript preview + **[Send to chat] [Open chat] [×]**.

### Platforms / errors
- macOS dev (target). Chat is async and never blocks the dictation/clipboard flow.
- Errors surfaced: no provider configured, missing key, `resolveModel()` throws, stream failures, empty reply → `chat:error` in panel.

---

## Todos — Feature 3

### Phase A — Service (`electron/ai/chat.ts`; replaces the deleted `electron/opencode.ts`)
- [x] **Ported:** `chat_messages` SQLite table (`session_id`, `role`, `content`, `created_at`) replaces the session handle
- [x] **Ported:** `sendChatMessage` → `new ToolLoopAgent({ model: await resolveModel(), instructions, messages })` + `await .stream()`; consume `result.stream` for `text-delta` → `chat:delta`, stream end → `chat:done`, `error` part → `chat:error`
- [x] **Ported:** deleted the SSE forwarder entirely (no equivalent needed); no OpenCode `session.*` calls remain
- [x] **Ported:** `getChatHistory()` → `select * from chat_messages where session_id = ? order by created_at`
- [x] **Ported:** `resetChat()` → delete rows; abort any in-flight stream
- [x] Chat `instructions` prompt kept; `chat-panel.tsx` protocol untouched

### Phase B — IPC + preload + types
- [x] `chat:send` / `chat:history` / `chat:reset` handlers (invoke)
- [x] `chat:delta` / `chat:done` / `chat:error` events (main → renderer)
- [x] Extend `electron/preload.ts` + `renderer/electron.d.ts`
- [x] Re-pointed handlers to `ai/chat.ts`; the channel names and payload shapes did not change

### Phase C — Renderer
- [x] Add `react-markdown` to `renderer/package.json`
- [x] `useChat` hook (streaming accumulator, send, reset, isStreaming, error)
- [x] `ChatPanel` component using existing Conversation/Message/Bubble/MessageScroller/Textarea/Button/Spinner (markdown render for assistant)
- [x] `page.tsx` wiring: `chatOpen` → `setSize("chat")`, render `ChatPanel`
- [x] No protocol changes needed for the AI SDK port (only a close button, an on-mount history load, and copy fixes)

### Phase D — Dictation integration
- [x] `doneActions` island preset (~340×110) + **[Send to chat] [Open chat] [×]** in `done` footer
- [x] `done` with actions → no auto-hide (manual close); dictation without chat still uses existing auto-hide flow
- [x] **Send to chat** → inject transcript as first user message → open panel → stream reply
- [x] **Open chat** → open panel with existing history (or empty state)

### Phase E — Validation
- [x] `tsc -b` green in both packages; `next build` + electron build green
- [x] Headless Electron smoke against the built `dist/`: `migrate()` created all tables from the committed `drizzle/` folder; settings persisted; `safeStorage` ciphertext on disk round-tripped to the original key; user message persisted to `chat_messages`; `resetChat()` cleared it; `getChatHistory()` returned the stored row
- [x] Real provider request reached OpenAI's Responses API with the selected model and hydrated history (only the intentionally fake key failed) — this surfaced the `textStream`-swallows-errors bug above, now fixed and re-verified to emit `chat:error`
- [ ] Manual: Alt+D → Send to chat → streaming reply → follow-up → reset (needs a real provider key)
- [ ] Verify history survives an app restart (new SQLite behavior the in-memory version could not do)

---

## Backlog (future features)
- Streaming/live transcription with VAD (whisper-command style).
- Local command execution ("draft a reply").
- Chat panel: enable agent tools via `ToolLoopAgent` (schema key `inputSchema`), chat-scoped dictation (mic for follow-ups).
- Multiple chat sessions in the UI (the `chat_messages.session_id` column is already there).
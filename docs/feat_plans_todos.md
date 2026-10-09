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

## Feature 4 — Circle-Capture Screenshots (Alt+D drag-select → multimodal chat)

### Goal
While holding **Alt+D**, the user drags the mouse to circle any region of the screen; on release that region is screenshotted. Multiple captures per hold are allowed. On release of Alt+D the polished transcript (F1 + F2.5) **and** all captures are staged into the chat composer (F3) for review, then sent as one multimodal message.

### Non-goals (v1)
- No capture outside an Alt+D hold — no standalone screenshot key.
- No OCR / text extraction; the model reads the pixels.
- No annotation tools (arrow, blur, redact) beyond optionally echoing the drawn ellipse.
- **No re-sending past screenshots to the model** (strictly one message only — see below).
- No dragging the selection onto a second display mid-hold.

### Locked decisions (confirmed with user)
1. **Delivery** — stage in the composer, review, then send. Nothing is sent blind.
2. **Shape** — **plain rectangle** of the circled region. The ellipse is a *selection gesture*, not the output shape (vision models handle rectangles best; no transparent corners to confuse them).
3. **History** — **strictly one message only**. Captures from an earlier hold are never attached to a later message and never re-sent.
4. **Resolution** — long edge capped at **1568px** before send.
5. **Limit** — **5 captures per hold**; the 6th drag shows a brief "limit reached" notice and does not capture.
6. **Scope** — Alt+D flow only. Drag-and-drop / paste of picked image files starts working for free (side effect of fixing the send path).
7. **Feedback** — a **mild live highlight** while circling, so the gesture is visually understandable.
8. **Scoping** — **one shared multimodal path**, which also fixes the currently-discarded file-picker attachments.

### The "strictly one message only" decision collapses the history design
If a capture is used in model context **exactly once**, `loadHistory` never needs to re-hydrate images. That deletes the single most expensive part of the design:

| | Naive design | Chosen (one-shot) |
|---|---|---|
| `loadHistory` | join `chat_attachments`, read PNGs off disk, emit `FilePart[]` for every historical image | **plain text for all history**; images only on the in-flight message |
| Cost per turn | grows with session length (needs a cap policy) | bounded: ≤5 images × 1568px, once |
| Latency | re-reads all images every turn | none after send |
| "How many images in history" question | had to be answered | **moot — deleted** |

Attachments still persist to disk + a table, but only so thumbnails render in the UI history. The AI-context path becomes trivial. The accepted cost: a follow-up like *"and how do I fix that?"* no longer sees the screenshot it referred to.

### Platform API names (verified against bundled `ai@7` source and `electron.d.ts` — NOT from memory)
- **`ImagePart` is DEPRECATED in `ai@7.0.114`.** The bundled `@ai-sdk/provider-utils` marks it `@deprecated Use FilePart with mediaType: 'image' instead`. The current shape is:
  ```ts
  { type: "file", mediaType: "image/png", filename: "capture-1.png",
    data: { type: "data", data: <Uint8Array | ArrayBuffer | Buffer | base64 string> } }
  ```
  Planning this from memory with `ImagePart` would have shipped a deprecated API. Same class of trap as `instructions`/`inputSchema` in F2.
- `FilePart` **is** re-exported from `ai` (re-exported from `@ai-sdk/provider-utils`), so no extra import path is needed.
- `mediaType` accepts a full IANA type (`image/png`) or just the top-level segment (`image`); providers normalise `image/*` → `image`.
- `DataContent = string | Uint8Array | ArrayBuffer | Buffer`.
- Electron `DesktopSource.display_id` (`electron.d.ts:7701`) — *"A unique identifier that will correspond to the `id` of the matching Display returned by the Screen API… It will be an **empty string if not available**."* → **a fallback source-match strategy is mandatory**, not optional.
- Electron `focusable?: boolean` (`electron.d.ts:3887`), `showInactive()`, `NativeImage.crop()`, `toPNG()` — all confirmed present.

### Hardware context
- MacBook Air M1, built-in **2560×1600 Retina, scale factor 2** (verified via `system_profiler SPDisplaysDataType`).
- Consequence: a full-screen crop is a **2560×1600 px** image (~2–6 MB PNG) and a half-screen region is still ~1800×900. This is exactly why the 1568px cap (decision 4) matters — it cuts both upload time and vision tokens, at the cost of softening small UI text.
- 8 GB RAM constraint from F1 still applies, though image work is transient and bounded at 5 captures.

### The gap being closed: chat is text-only end to end
Every one of these layers independently drops an attachment. Phase C must fix **all** of them:
1. `renderer/app/chat/page.tsx` — `submit({ text, files })` receives `files` and **throws them away**.
2. `renderer/components/ai-elements/prompt-input.tsx` — `handleSubmit` base64-encodes blob URLs to data URLs (this part already works).
3. `renderer/hooks/use-chat.ts` — `send(text, sessionId)`, two string params only.
4. `dispatch` in the chat page — text only.
5. preload bridge — `chat.send(text, sessionId)`.
6. `main.ts` `chat:send` handler — `(text, sessionId)`.
7. `electron/ai/chat.ts` `insertMessage` — `content: row.text`.
8. `ChatMessage` type — `{ role, text }` only.
9. `chat_messages.content` — plain `TEXT` column, no attachment table.
10. `normalizeMessages` — would **silently drop** any non-`{role, text}` entry rather than render it.

### Capture lifecycle (one-shot)
```
Alt+D down ──► dictationHoldId created; capture overlay shown (focusable:false)
   │
   ├─ drag #1..5 ─► hide overlay → getSources → match display_id
   │                → thumbnail.crop(rect scaled by getSize()/bounds) → toPNG()
   │                → downscale long edge to 1568px
   │                → write staging/<holdId>/<n>.png
   │                → showInactive() → add File to composer, tagged with holdId
   │                → 250ms accent flash + numbered badge; island counter ticks 1..5
   │
Alt+D up ──► whisper ──► polish ──► dictation:status done { text }
            └─► chat:initial-text { text, holdId } ──► seed draft, focus input
Enter / send ──► chat:send(text, sessionId, attachments)
                 ├─► main moves PNGs out of staging, inserts chat_attachments rows
                 └─► ToolLoopAgent messages: [ { type:"text", text },
                                               { type:"file", mediaType:"image/png",
                                                 data:{ type:"data", data: bytes } }, … ]
                 └─► next turn's history = TEXT ONLY (decision 3)
```

### Highlight behavior (decision 7)
- **While dragging** — a soft `rgba(0,0,0,0.18)` scrim over everything *outside* the ellipse, ellipse interior left at full brightness, 2px accent stroke, crosshair cursor. Reads clearly without feeling like a heavy spotlight.
- **On release** — 250ms accent-tinted fade over just the captured rect, confirming the shot landed even if the user wasn't looking at that part of the screen.
- **Already captured** — small numbered badges linger ~2s at each ellipse's centre, cross-checkable against the island's counter.
- **At the limit** — brief "limit reached (5)" toast near the cursor; no capture, overlay stays up.

### Architecture Overview
```
renderer (Next.js, sandboxed)              electron/main (Node, ESM)
----------------------------              -------------------------
island  (Alt+D down/up, holds focus)
  | dictation:audio  ──────────────────►   whisper → polish → text
  |                                            |
  | capture overlay (/capture, focusable:false) |
  |   mousedown/move/up → screenX/screenY      |
  |   capture:select { rect, displayId } ──────┤
  |                                            ├─ overlay.hide()   ← don't photograph ourselves
  |                                            ├─ desktopCapturer.getSources(types:["screen"])
  |                                            ├─ crop → toPNG → downscale 1568px
  |                                            ├─ overlay.showInactive()
  |  capture:staged { id, mediaType,           │
  |      name, dataBase64, w, h } ◄────────────┤  (writes staging/<holdId>/<n>.png)
  |                                            │
  |  File -> usePromptInputAttachments().add()  │
  |  (existing preview/remove UI, reused as-is)│
  |                                            │
  | chat:send(text, sessionId, attachments) ───►  move out of staging
  |                                            │  insert chat_attachments rows
  |  chat:delta / chat:done ◄─────────────────┤  ToolLoopAgent + FilePart
  |                                            │  next history = text only
```

### Capture overlay window (new, in `main.ts`)
- Full `display.bounds`, `frame:false`, `transparent:true`, `hasShadow:false`, `resizable:false`, `movable:false`, `minimizable:false`, `maximizable:false`, `fullscreenable:false`, `skipTaskbar:true`, `show:false`, **`focusable:false`**, `alwaysOnTop:true`, `enableLargerThanScreen:true`.
- **`focusable:false` is load-bearing.** Alt+D key-up is read from `mainWindow.webContents` `before-input-event` (F1). If the overlay ever takes focus, release detection dies and recording runs to the 60s cap. Needs a fallback key-up source on the capture window itself if this doesn't hold on some macOS/Electron combo.
- Shown with `showInactive()` on PTT-down (capped to the display under the cursor at that moment); hidden on PTT-up, cancel, and blur.
- New `/capture` route driven by `event.screenX/screenY` for absolute coords (no window-offset math). Esc cancels; click-without-drag or rect < ~8px = cancel.

### Capture service (`electron/capture.ts`)
`captureRegion(displayId, rect): Promise<Buffer /* PNG */>`
1. `desktopCapturer.getSources({ types: ["screen"], thumbnailSize: bounds × scaleFactor })` — request full pixel size for Retina fidelity.
2. Pick source by `source.display_id === String(display.id)`, **with fallback** (by name/index) because `display_id` may be `""`.
3. `source.thumbnail.isEmpty()` ⇒ Screen Recording permission denied → throw a typed, actionable error.
4. Crop scale `sx = thumbnail.getSize().width / bounds.width` (guards Electron's aspect-preserving thumbnail resize); crop rect = `round(rect × s)`, clamped to image bounds.
5. `thumbnail.crop(...).toPNG()` → downscale long edge to 1568px.
6. Hide-overlay-before-capture and show-after must be **awaited in that order**.

### Permissions / Platform notes
- **macOS Screen Recording** — new TCC permission, separate from the existing mic grant.
- **TCC attributes the grant to the "responsible process", not to `Electron.app`.** This cost hours of debugging and is the single most important note in this section. An Electron app started via `npm run dev` is a *child of the terminal*, so macOS walks the process tree and blames the terminal. Granting Screen Recording to "Electron" does **nothing** — the row TCC reads is the terminal's (`Ghostty.app` here). Confirmed by the official `desktopCapturer` docs ("macOS attributes that permission to the responsible process, so when running unpackaged from a terminal or IDE it is the terminal or IDE that must be granted access") and by the VS Code maintainer in electron#20242 ("the electron process was hiding in my permissions list as my terminal application… only after resetting all of my camera permissions via `tccutil reset ScreenCapture` did I realize this"). `responsibleProcess()` in `electron/capture.ts` walks the same ancestry and is logged on every check.
- **Secondary trap: all Electron dev builds share `CFBundleIdentifier = com.github.Electron`.** TCC keys the grant on that bundle id, so there is no per-path grant — one row governs every Electron build on the machine. Granting "the correct binary path" is not a thing that exists.
- **`getMediaAccessStatus("screen")` alone is not trustworthy** — it reads per-process cached TCC state and does not reflect a grant toggled while the app is running. `refreshScreenCapturePermission()` therefore prefers a live `desktopCapturer.getSources` probe, which reflects what the OS will actually allow. The probe uses `thumbnailSize: { width: 0, height: 0 }` per the docs — a non-zero thumbnail still makes Chromium pull screen pixels, i.e. it measures the very thing it is testing.
- **If not granted, dictation proceeds completely untouched** — a missing capture permission must never block the mic. The overlay still opens and states the reason rather than failing silently, because the original silent-skip produced the worst symptom of all: no overlay, no captures, no explanation.
- No packaging config exists yet, so dev grants permissions to the *launching terminal* (same class of problem as `NSMicrophoneUsageDescription` in F1). A packaged build will need `NSScreenCaptureUsageDescription` via `extendInfo`; cannot be done yet.
- **The overlay swallows all mouse clicks while Alt+D is held** — by design, the user is dictating, not clicking.

### IPC Surface
| Direction | Channel | Payload |
|---|---|---|
| main → renderer | `capture:staged` | `{ id, mediaType, name, dataBase64, width, height }` |
| main → renderer | `capture:state` | `{ active: boolean, count: number }` |
| main → renderer | `capture:show` | `{ holdId, displayId, bounds, count, max, granted, permissionMessage }` |
| main → renderer | `capture:error` | `{ message }` |
| invoke | `capture:permission` | → `{ granted, status, responsible, message }` |
| invoke | `capture:open-settings` | deep-links to the Screen Recording pane |
| invoke | `capture:consume` | `(holdId)` → staged captures, then deletes the staging dir |
| invoke | `capture:begin` / `capture:cancel` | — |
| send | `capture:select` | `{ rect, displayId }` |
| **changed** | `chat:send` | `(text, sessionId, attachments)` |
| **changed** | `chat:initial-text` | `{ text, holdId }` (was a bare string) |
| **changed** | `ChatMessage` | `+ attachments: ChatAttachment[]` |

### Security note
- `chat:send` validates attachment count, a `mediaType` allowlist, and a per-file byte cap. (Originally `image/png` + `image/jpeg` — **superseded by Feature 4.5**, which adds PDF, Markdown, plain text, and CSV with per-category caps, content sniffing, and Word refusal.)
- **Main derives the on-disk path itself from the attachment id** — the renderer never supplies a filesystem path ⇒ no path-traversal surface.
- Captured screenshots can contain anything on screen (passwords, tokens, private messages). They are stored unencrypted in `userData`, same class of trust as the unencrypted `chat_messages` body. Stated explicitly so it is a conscious choice, not an oversight.

### Risks
1. **Screen Recording TCC is a hard blocker** if denied — mitigated by an actionable error, by naming the responsible process, and by never blocking dictation.
2. **History image bloat** — resolved by decision 3 (one-shot); cost is bounded by construction.
3. **`focusable:false` is load-bearing** — if it fails to hold, Alt+D release detection breaks. The fallback key-up source on the capture window is still unimplemented; today release detection only reads `mainWindow`.
4. **Non-vision model ids would 400** on image parts — surface the provider error clearly instead of failing silently.
5. **Retina crop math must be verified empirically**, not assumed from the source code.
6. **`display_id` may be empty** — a broken source match yields a wrong-display or empty capture. Needs a real multi-display test.

### Two judgment calls (flagged, pending veto)
1. **Superseding an unsent hold.** If the user dictates + circles, then starts a *second* Alt+D hold before sending, the composer **accumulates** (text appends; captures from both holds queue; per-hold cap still 5) rather than silently discarding dictated text. A confirm dialog would interrupt push-to-talk; silent deletion would lose speech.
2. **Screenshots stay visible but context-free.** Images render in history as thumbnails forever, yet are never re-sent (decision 3). This leaves room for a later explicit "attach this again" affordance **without re-architecting**.

---

## Todos — Feature 4

> **Status: shipped.** Phases A–E are implemented, and the core manual path (Alt+D → circle → composer → send) plus the denied-permission path are verified working. Three items remain genuinely open and are deliberately left unchecked rather than ticked on faith: the capture-window key-up fallback, the headless `FilePart` smoke test (the Electron harness cannot be run headlessly in this environment), and the two multi-display / Retina manual checks.

### Phase A — Capture overlay window
- [x] `captureWindow` in `electron/main.ts` — full `display.bounds`, transparent, frameless, `focusable:false`, `skipTaskbar`, `alwaysOnTop`, `enableLargerThanScreen`; shown via `showInactive()` on PTT-down, hidden on PTT-up / cancel / blur
- [x] Cap the overlay to the display under the cursor at PTT-down (multi-display)
- [x] New `/capture` route — drag-to-ellipse via `screenX/screenY`, no window-offset math; Esc cancels; click-without-drag or rect <8px = cancel
- [x] Highlight behavior: `rgba(0,0,0,0.18)` outside-scrim, 2px accent stroke, crosshair cursor while dragging
- [x] 250ms accent flash on the captured rect + numbered badge lingering ~2s per capture
- [x] Island capture counter badge (1..5) so the user can track captures while looking at the screen
- [x] Per-hold 5-capture cap; 6th drag shows a "limit reached" toast and does not capture
- [ ] Fallback key-up source on the capture window in case `focusable:false` ever fails to hold — **not implemented**; `focusable:false` has held so far, so the risk has never actually fired

### Phase B — Capture service (`electron/capture.ts`)
- [x] `captureRegion(displayId, rect)` using `desktopCapturer.getSources({ types: ["screen"], thumbnailSize: bounds × scaleFactor })`
- [x] Source match by `display_id` **plus a fallback** (name/index) — `display_id` may be `""`
- [x] `thumbnail.isEmpty()` → typed "grant Screen Recording" error
- [x] Retina-correct crop scale `thumbnail.getSize() / display.bounds`, clamped rect
- [x] `thumbnail.crop(...).toPNG()` → downscale long edge to 1568px
- [x] Overlay hide → capture → show ordering, awaited
- [x] Permission pre-check via `getMediaAccessStatus("screen")` **plus** a live `desktopCapturer.getSources` probe. When not granted the overlay still opens and **explains why**, and selection is refused — dictation is never blocked. (Changed from the original "skip capture silently", which caused the reported bug: no overlay, no captures, no explanation.)
- [x] Write PNGs to `userData/screenshots/staging/<holdId>/<n>.png`

### Phase C — Multimodal chat pipeline (also fixes the discarded file-picker attachments)
- [x] New `ChatAttachment` type; `ChatMessage` gains `attachments: ChatAttachment[]`
- [x] `chat:send` signature → `(text, sessionId, attachments)`; validate count / `mediaType` allowlist / per-file byte cap; **main derives disk paths from the attachment id**
- [x] `insertMessage(..., attachments?)` → message row + one `chat_attachments` row each
- [x] Send path builds **`FilePart`** content — `{ type:"file", mediaType, filename, data:{ type:"data", data } }`. **Do NOT use `ImagePart`** (deprecated in `ai@7`)
- [x] `loadHistory` stays **text-only by design** (decision 3) — no attachment join, no image re-hydration
- [x] `renderer/app/chat/page.tsx` — `submit({ text, files })` stops discarding `files`
- [x] `use-chat.ts` — `send(text, sessionId, attachments)`; `normalizeMessages` carries attachments instead of dropping them
- [x] `preload.ts` + `renderer/electron.d.ts` — thread the new type through both
- [x] Captures reach the composer as ordinary `File` objects via `attachments.add([file])`, reusing the existing preview/remove UI — **no new components**
- [x] Allow send with attachments and empty text (`PromptInputSubmit` is currently `disabled={!draft.trim() || sending}`)

### Phase D — Dictation → composer staging
- [x] Per-hold `dictationHoldId` in main (created on PTT-down, cleared on send / cancel / next PTT-down) so an abandoned hold can't leak images into the next message
- [x] Widen `chat:initial-text` from `string` → `{ text, holdId }` (covers both the cold-open `pendingChatText` path and the already-open `webContents.send` path)
- [x] Chat window on receipt: seed draft + `File`s, then focus the input (works because of the F3 Enter/focus fix)
- [x] `capture:state` wired to the island counter badge

### Phase E — Persistence
- [x] `chat_attachments` table — `id` PK, `message_id`, `session_id`, `media_type`, `file_name`, `path`, `width`, `height`, `byte_size`, `created_at`, index on `message_id`
- [x] `db/schema.ts` → `npm run db:generate` → commit migration under `electron/drizzle/`
- [x] On send, move PNGs out of `staging/` into `userData/screenshots/`
- [x] `sessions.ts` session-delete must remove attachment **rows and files**
- [x] Prune stale `staging/` directories on app start
- [x] Thumbnails render in chat history (persisted, but never re-sent to the model)

### Phase F — Validation
- [x] `tsc -b` + lint + build green in both packages (34-problem pre-existing lint baseline expected in untouched files)
- [ ] Headless smoke: seeded attachment → assert the in-flight message emits a `FilePart[]` content array and that `loadHistory` returns **text only** — **not run**; the staging smoke harness was killed (`SIGTERM`) under the headless shell, so the `FilePart[]` shape is verified by types only
- [x] Manual: Alt+D → circle ×2 → release → both staged in composer → remove one → Enter → reply references the images
- [x] Manual: Screen Recording denied → dictation still works, actionable error shown, no capture attempted
- [ ] Manual: secondary display — capture on the non-primary screen
- [ ] Manual: Retina crop accuracy — verify the captured rect aligns with the drawn ellipse on the 2560×1600 display

---

## Open Questions — Feature 4
- Can the two judgment calls above stand, or should each Alt+D hold reset the composer to a fresh slate?
- Should a "limit reached" toast be silent (just ignore the drag) instead? Currently it is visible — a silent no-op is confusing mid-dictation.
- Should the capture overlay dim the underlying app more strongly (e.g. `0.35`) for maximum contrast, or is `0.18` the right "mild" level?
- Packaging: add `NSScreenCaptureUsageDescription` via builder `extendInfo` once a packaging config exists (blocked on the same gap as F2 Phase 0).
- Future: an explicit "attach this previous screenshot again" affordance, enabled by decision 3 leaving the files on disk.

---

## Feature 4.5 — Document & Text Attachments (PDF, Markdown, plain text, CSV)

> **Status: shipped** (commit `654cc9c`). Extends the F4 multimodal send path from images-only to the full category set. Not planned in the original F4 doc — F4 shipped with a `mediaType` allowlist of `image/png` + `image/jpeg`; this feature widened it and documents the resulting provider matrix.

### Goal
Attach **PDF, Markdown, plain text, or CSV** to any chat message alongside images. Attachments are split into three categories, each with its own byte cap and its own path to the model.

### Categories (`electron/ai/attachments.ts`)
- **`image`** (`image/png`, `image/jpeg`) → `FilePart` with the raw bytes (F4 path). Cap **8 MB**.
- **`pdf`** (`application/pdf`) → `FilePart` with the raw bytes. Cap **20 MB**.
- **`textual`** (`text/markdown`, `text/plain`, `text/csv`) → **`TextPart`, never a `FilePart`** — decoded to UTF-8 and inlined as `--- file ---\n<body>\n--- end of file ---` at `buildUserContent` (`chat.ts:569`). Cap **1 MB**.

### Why text is inlined instead of sent as a file part (verified against the installed adapters — NOT from memory)
The providers disagree sharply about inline non-image file parts:
| Provider | Inline file parts |
|---|---|
| OpenAI | `application/pdf` only |
| Anthropic | `application/pdf` and `text/plain` only |
| Google | passes the media type through |
| xAI | refuses any inline non-image file |

Therefore:
- **Text is always a `TextPart`** — the only encoding every provider accepts, so `.md` attaches on any provider.
- **Word/OpenDocument are refused by name** (`application/msword`, `docx`, `odt`, …) with an actionable error ("Export the document to PDF, or paste the text into the message"). Sending the bytes anyway would surface the provider's own `UnsupportedFunctionalityError` verbatim; Anthropic only reaches Word through its Files API, which the AI SDK's prompt conversion does not use — so the list cannot just be widened.
- **PDF is refused pre-flight for xAI** — `supportsInlineDocuments(provider)` in `ai/provider.ts:48` gates `sendChatMessage` before the transaction writes anything, so the user gets `"xAI cannot read PDF attachments. Paste the text, or attach an image of the page."` instead of a mid-stream provider error.
- **`scripts/provider-compat.mjs` asserts this matrix** against the installed adapters (`pdf file part: { openai: true, anthropic: true, google: true, xai: false }`), so a provider upgrade that changes its file-part support fails the test suite before it breaks the app.

### Hardening (the file never reaches the model until it has been checked)
- **Content sniffing** at `decodeAttachment` (`attachments.ts:355`): claims must be *readable*, not just claimed — images must decode (`nativeImage`), PDFs must start with the `%PDF-` magic, and text must have no NUL in the first 2 KiB (a binary masquerading as `.txt` would otherwise put mojibake in the prompt).
- **Byte caps are per category** and enforced twice — on the base64 length *before* decoding (base64 expands 4/3, so an oversized payload is rejected without being decoded into memory first) and on the decoded bytes after.
- **Extension fallback** for empty `File.type` (`EXTENSION_MEDIA_TYPES`, `attachments.ts:75`) — picking a `.md`/`.csv` off disk yields `File.type === ""` in Chromium, so the extension decides. `resolveMediaType` remains the single place a type is decided, so a file cannot be accepted under one type and stored under another.
- **`MAX_ATTACHMENTS_PER_MESSAGE = 10`** (was 5 in the F4 plan; raised with the widened category set) and the same id-validation / main-derived-path rules as F4 — the renderer never supplies a filesystem path.

### History note
Inlining has a pay-off beyond portability: history is stored as plain text, so a document read this way **stays in the model's context on later turns** — a re-sent `FilePart` would have to be re-fetched every time. This is the mirror of F4 decision 3, and here it works *with* the history design instead of against it.

### Reused, not rewritten
- `storeAttachment` / `deleteAttachmentFiles` / `getAttachmentData` (thumbnail path) — unchanged, generalize across categories; non-image rows store `width/height = 0x0` (nothing reads them for layout), avoiding a nullable-column migration.
- F4's `FilePart` construction, `chat_attachments` table, and the `AttachmentsProvider` UI — unchanged.

### Validation
- Committed with: per-category caps + sniffing covered by the `provider-compat.mjs` matrix run (`npm run test:providers`) and by the send-path refusal tests; `tsc -b` + preload + renderer typecheck green.
- [ ] Manual: attach a PDF + let the model read a markdown file + confirm Word is refused with the friendly message (needs a real provider key)

---

## Feature 5 — Browser Automation (embedded Chromium + `ToolLoopAgent` tools)

### Goal
The user can ask the assistant to visit a website and act on it. A real Chromium page opens **inside the chat window as a collapsible panel**; the assistant drives it through raw CDP (accessibility tree for structure, real mouse/keyboard input for actions). Reading and clicking happen as you watch; the two actions that change something outside the panel pause for an explicit approve/deny.

> **Status: implemented, headless-validated, not yet manually exercised.** The panel, tools, approval loop and persisted tool history are built, typechecked, and covered by two offline smokes; what remains is the manual end-to-end pass with a real key. Realization of the backlog item "enable agent tools via `ToolLoopAgent`".

### Non-goals (v1)
- No Playwright / Puppeteer / downloaded browser, and no remote-debugging port.
- No multi-tab, no downloads, no file upload, no recorded/replayed scripts.
- No vision — see the hard constraint below.
- No domain allowlist; no per-site trust store.

### Locked decisions (confirmed with user)
1. **Delivery** — an embedded page managed by main, not a real Chrome attach or a headless fetch. Originally scoped as its own `BrowserWindow`; implemented as a `WebContentsView` hosted in the chat window so it lives **inside** the layout, collapsible, without a second OS window.
2. **Mechanism** — raw CDP via `webContents.debugger`. Zero new runtime dependencies.
3. **Where tools live** — registered on the **existing** `ToolLoopAgent` in `ai/chat.ts`, not a second agent or a rewrite of the chat service.
4. **Approval** — **reads and clicks auto-approve; writes require the user.** The user initially chose "confirm everything", then downgraded to read-only because a 6-step task under strict mode means 6 interruptions; a later pass added `browser_click` and `browser_go` to the auto set (watching the panel makes them self-evident) and left `browser_type` and `browser_save_pdf` gated, because those are the two that leave the page behind.
5. **Network scope** — **open internet**, no allowlist. The UI always shows the current URL so navigation is never invisible.
6. **Perception** — the accessibility tree is the primary sense. A screenshot is a *user-facing artifact*, not something the model sees.

### Why embedded costs almost nothing here
Electron already bundles Chromium, and `webContents.debugger` exposes **raw CDP**. The entire vocabulary the `browser-use` skill depends on — `Accessibility.getFullAXTree`, `DOM.getBoxModel`, `Input.dispatchMouseEvent`, `Input.insertText`, `Page.captureScreenshot`, `Page.printToPDF` — is already available. No browser binary to download, no `--remote-debugging-port` to expose (which would be an unauthenticated hole), no extra process to supervise.

**`browser-use` is NOT a dependency of this feature.** The load-bearing fact is that `webContents.debugger` is not a wrapper around a CDP library — it *is* a CDP client, built into Electron — so `sendCommand("Accessibility.getFullAXTree")` needs no npm package, no WebSocket client, and no `chrome-remote-interface`. CDP is a wire format, and `browser-use` is one *alternative* implementation of a browser controller (Python + Playwright + **its own AI agent loop**) rather than a component we would assemble. Adopting it would mean replacing the F3 `ToolLoopAgent`, the user's provider/model selection, chat history, and the approval loop — it would become the chat, not extend it. Zero-install is a consequence of the design, not an oversight.

Separately, the `~/.agents/skills/browser-use` skill is **agent tooling for development**, letting the coding agent drive a browser while testing this feature. It is never shipped in the app and never runs when dummy runs.

### The hard constraint that shapes the whole design
Verified in the installed `@ai-sdk/provider-utils`: **`ToolResultOutput` is `{type:'text'} | {type:'json'}` only.** A tool result **cannot carry an image**, and `PrepareStepResult` exposes **no `messages` hook**. So the assistant cannot look at a screenshot mid-loop.

Consequences, both accepted:
- `browser_snapshot` (AX tree) is the primary perception tool. It is also more token-efficient and more reliable than vision for UI structure.
- `browser_screenshot` persists the PNG through the **existing** `storeAttachment` / `downscale` plumbing, so the *user* sees it in the chat timeline and it becomes model-visible on the **next turn** via the F4 `FilePart` path.

This is not a workaround to revisit later — it is the reason the tool list is shaped the way it is.

### Platform API names (verified against the installed `ai@7.0.114` source — NOT from memory)
| Fact | Detail |
|---|---|
| `toolApproval` | Agent-level. Either a **generic function** or a per-tool map. Replaces the deprecated `needsApproval`. |
| Generic function signature | `({ toolCall, tools, toolsContext, runtimeContext, messages }) => MaybePromiseLike<ToolApprovalStatus>` |
| `ToolApprovalStatus` | `undefined \| 'not-applicable' \| 'approved' \| 'denied' \| 'user-approval' \| { type: 'approved', ... }` |
| `tool-approval-request` stream part | `{ approvalId, toolCall, reason?, isAutomatic?, signature? }` — carries the **full parsed `toolCall`**, so the approval card can render name + input with no extra schema lookup |
| `tool-approval-response` | `{ approvalId, toolCall, approved, reason? }` |
| Resume after approval | `StreamTextResult` **does** expose `readonly responseMessages: PromiseLike<Array<ResponseMessage>>`, so the loop is viable while streaming |
| `stopWhen` export name | `stepCountIs` (`isStepCount as stepCountIs`) — set explicitly, never rely on the default |
| `experimental_toolApprovalSecret` | Optional HMAC binding of an approval request to its tool call |
| Tool schema key | `inputSchema` (never `parameters`) |

### The trap: we do not use `@ai-sdk/react`'s `useChat`
Per the F3 decision, `use-chat.ts` is a **hand-rolled IPC protocol**. That means `addToolApprovalResponse` / `addToolOutput` **do not exist for us**, and the usual one-liner resume is unavailable. Main must drive the approval loop itself.

```
renderer                                electron/main (ai/chat.ts)
--------                                ---------------------------
use-chat.ts (hand-rolled)               const result = await agent.stream({ messages })
  | chat:send ───────────────────────►   for await (const part of result.stream)
  |                                        case 'tool-approval-request':
  |                                          park { messages, await result.responseMessages }
  |                                          forward to renderer, AWAIT user decision
  | chat:approval-response ─────────────►   messages.push(...await result.responseMessages)
  |                                        messages.push({ role:'tool', content:[
  |                                          { type:'tool-approval-response', approvalId, approved } ]})
  |                                        → re-call agent.stream({ messages })   ← must be a LOOP
  | chat:delta / chat:done / tool-* ◄────
```

Three consequences that are easy to get wrong:
1. **It must be a loop**, not a one-shot. One user turn can request several approvals sequentially.
2. **Stop/abort must auto-deny** a parked approval. `activeStream` (`ai/chat.ts:75`) is a single module-global that currently only covers streaming; it must extend to the parked state, or `chat:stop` leaves the turn hung forever.
3. **Add the SDK's own advice to `CHAT_INSTRUCTIONS`** (`ai/chat.ts:66`): *"If an action is denied, do not retry it."* Otherwise the model re-requests the same denied call in a loop.

### Architecture Overview
```
renderer (Next.js, sandboxed)         electron/main (Node, ESM)
----------------------------         -------------------------
chat page                              ai/chat.ts
  | approval card ── invoke ──────────►   ToolLoopAgent({ model, instructions,
  | tool timeline <── chat:event ──────     tools: browserTools, toolApproval })
  | status pill   <── browser:status      │
  │                                      ▼
  │                                 browser/
  │                                   window.ts  BrowserWindow + partition + policy
  │                                   cdp.ts     webContents.debugger wrapper
  │                                   refs.ts    ref -> backendNodeId, cleared per nav
  │                                   tools.ts   the 8 tool definitions
  │                                   approvals.ts  pending-approval registry
  ▼
BrowserWindow (own partition, no preload, sandbox:true)
```

### Tool catalogue
`READ_ONLY` auto-approves; the two that change something prompt.

| Tool | Input | Returns | Approval |
|---|---|---|---|
| `browser_navigate` | `{ url }` | final URL, title | auto |
| `browser_snapshot` | — | numbered interactive elements + `ref`s | auto |
| `browser_read` | — | visible text, length-capped | auto |
| `browser_screenshot` | — | attachment id, URL, title | auto |
| `browser_click` | `{ ref }` | resulting URL/title | auto |
| `browser_go` | `{ direction: 'back'\|'forward'\|'reload' }` | URL | auto |
| `browser_type` | `{ ref, text, submit? }` | confirmation | **prompt** — it can submit a form |
| `browser_save_pdf` | — | saved path | **prompt** — it writes a file |

The split is *writes*, not *side effects*. Reading and clicking are things the user watches happen in the panel in real time, and prompting for each one would make the assistant unusable; typing text into a field and writing a file are the two that leave the panel behind.

Because navigation auto-approves, **the status line is load-bearing, not cosmetic** — it is the only continuous signal of where the agent has gone.

### Security model
The embedded page is treated as hostile-by-default:
- **No preload**, `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- Own partition `persist:dummy-browser` (survives restarts, never touches `defaultSession`).
- Hard-deny non-`http(s)` schemes in `will-navigate` (`file:`, `javascript:`, `data:`) — an open-URL tool plus `file:` is arbitrary local file read.
- `setWindowOpenHandler` folds popups into the same view instead of spawning uncontrolled ones.
- `setPermissionRequestHandler` denies camera / mic / geolocation / notifications.
- The panel rectangle can only be moved by the window that hosts the page, so no other renderer can park it over the transcript.

### Reused, not rewritten
- `ai/attachments.ts:317` `storeAttachment` + `capture.ts:227` `downscale` (1568px long edge) — the screenshot path.
- `renderer/components/ai-elements/tool.tsx` was **not** used: the timeline needed statuses the component does not model (`denied`, `stopped`, running-with-approval), so `browser-activity.tsx` was written for it.
- F4's `FilePart` send path — how a screenshot becomes model-visible next turn.

### Known gaps in the current chat service (must be fixed, not worked around)
- `ai/chat.ts:314` constructs the agent with **no `tools` and no `stopWhen`**. The default step limit is easy to burn without noticing on a click→wait→observe loop.
- `ai/chat.ts:409` persists **only** assistant text, and `loadHistory` (`ai/chat.ts:190`) replays text only. Without a durable record, a later turn has **zero memory the browser was ever used** — so Phase D exists.
- `normalizeMessages` (`renderer/hooks/use-chat.ts:65`) strips anything non-`{role,text}`; tool events need an explicit branch or they vanish in the UI.
- The sidebar entry already exists, disabled, at `renderer/components/app-sidebar.tsx:141-143`.

### Risks
1. **Tool-calling support varies by provider/model** — *resolved by Phase 0*: all four providers complete a tool-call round trip.
2. **One global browser session** means two chat sessions racing would invalidate each other's element `ref`s — *resolved*: a single `Mutex` wraps every page operation.
3. **Canvas-heavy sites** (Gmail, Figma, most SPAs with virtualized DOM) expose a poor AX tree. Worth setting expectations before the user tries it there.
4. **`zod` was only installed as a transitive peer of `ai`** — *resolved*: declared directly in `electron/package.json`.

### Memory budget — the shell is cheap, the *page* is not
The panel itself is a `WebContentsView` inside the chat window, so there is no second OS window to pay for — no extra `BrowserWindow` shell, no extra frame. The genuine marginal cost is still **one renderer process plus whatever page it loads**:

| | Marginal cost |
|---|---|
| Empty second window | ~40–80 MB |
| Light page (docs, blog, HN) | ~30–60 MB more |
| Gmail / Google Docs | ~150–300 MB |
| Figma / YouTube / Notion | ~400 MB – 1 GB |

The 8 GB budget already carries macOS, whisper `base.en` (~388 MB when active), the Next dev server, and Electron (~150–250 MB baseline). A heavy web page inside dummy can cost **more than the `small.en` model that F1 deliberately rejected**, so this is a real constraint, not a theoretical one. Mitigations, all load-bearing and now implemented:
- **Lazy creation** — no page until the first browser tool call.
- **Idle release** — after a run, navigate to `about:blank` so page memory is reclaimed while the partition and its cookies survive.
- **Exactly one page, ever** — reused across turns, never one per session.
- **Collapse instead of close** — collapsing the panel keeps the page alive (hiding it and zeroing its bounds) so the user can go back to chat; only `browser:close` blanks it.

Realistically: usable, but expect macOS to swap during heavy pages. Do not let the agent leave a Figma tab open unattended.

---

## Todos — Feature 5

> **Status: implemented; validation incomplete.** Phases 0–E are built and typecheck. What is still open is Phase F, the two persistence items that were never started, and the decisions recorded below.

### Phase 0 — De-risk provider tool-calling (do this first)
- [x] Extended `electron/scripts/provider-compat.mjs` (`npm run test:providers`) with a **tool-call round trip** per provider — asserts three legs independently: the tool definition was serialized into the request, the parsed tool call actually executed, and the tool result went back on a follow-up request
- [x] Verified the guard is not vacuous: flipping an expectation fails loudly with exit code 1, and removing the execute hook makes all four report `ToolNotExecuted`
- [x] Recorded the verdict: **all four providers (OpenAI, Anthropic, Google, xAI) complete the round trip.** No provider blocks Feature 5, so no provider needs blocking, warning, or special-casing in settings
- [x] Used the SDK's bundled `jsonSchema` in the guard deliberately — it probes *provider capability*, which is independent of schema syntax; the browser tools themselves use zod

### Phase A — Page + CDP core
- [x] `browser/window.ts` — **one `WebContentsView`, reused**, never one per session. Not a `BrowserWindow`: the page is hosted in the chat window's `contentView` and positioned by `setBounds()`, so it lives inside the chat layout as a collapsible panel (see Open Questions)
- [x] `session.fromPartition('persist:dummy-browser')` — isolated from `defaultSession`
- [x] Security policy: no preload, `contextIsolation`, `sandbox`, `http:`/`https:` plus exactly `about:blank`, permission handlers returning a flat no
- [x] `browser/cdp.ts` — attach/detach `webContents.debugger`; wrappers for `Accessibility`, `DOM.getBoxModel`, `Input.*`, `printToPDF`, `Runtime.evaluate`; **`Page.setWebLifecycleState` + focus emulation** so the embedded page is not frozen while the panel is collapsed
- [x] `browser/refs.ts` — `ref → backendNodeId` map, cleared on every navigation
- [x] `browser:status` event (URL + title) on every navigation, plus `browser:show` / `browser:hide` / `browser:set-bounds` / `browser:close`
- [x] **Idle release** — `scheduleIdleRelease()` navigates to `about:blank` after a run, cancelled whenever the user opens the panel
- [x] **Lazy creation** — no page exists until the first tool call
- [x] Handle: no page yet, debugger already attached, CDP command failure — surfaced as `BrowserNotReadyError` ("The browser page is not open yet")
- [x] `dropDeadView()` — a view whose contents Electron already tore down is dropped and rebuilt instead of throwing a bare `TypeError`

### Phase B — Tools + registry
- [x] `browser/tools.ts` — all 8 tools with `inputSchema`, zod
- [x] Registered on the agent with `stopWhen: stepCountIs(BROWSER_STEP_LIMIT)` set explicitly
- [x] Single `Mutex` around every page operation (navigate/click/type/screenshot/PDF)
- [x] Browser guidance in `CHAT_INSTRUCTIONS`: snapshot-before-act, refs die on navigation, prefer `browser_read`, "if the user denies an action, do not retry it"
- [x] `browser_save_pdf` writes a timestamped file and returns the path — **lands in `app.getPath("downloads")`, not `userData`** as originally planned
- [x] Typed "no page" / "navigation failed" errors rather than silent empty results

### Phase C — Approval loop
- [x] `ChatStreamEvent` extended with `tool-approval-request`, `tool-approval-response`, `tool-call`, `tool-result`
- [x] `READ_ONLY` set → auto-approved; everything else → user approval, through `isReadOnlyTool()` feeding `toolApproval`
- [x] Main-side resume loop: park `messages`, await `result.responseMessages`, append the `tool-approval-response` tool message, re-stream
- [x] Pending registry — **inlined in `ai/chat.ts`** rather than a separate `browser/approvals.ts`; keyed by `approvalId`, scoped by turn token, rejects unknown/expired ids
- [x] `chat:approval-response` IPC + preload + `electron.d.ts`
- [x] Stop/abort auto-denies every parked approval for that turn (`denyApprovalsFor(token)`)
- [x] All parked promises are registered **before** the first one is awaited, so a card is answerable the instant it appears even when a batch of approvals arrives together
- [x] `experimental_toolApprovalSecret` HMAC verification
- [x] **Auto-approval is skipped, not parked.** The SDK emits a `tool-approval-request` for *every* tool in the policy, including ones it approved itself (`isAutomatic`), and answers them within the same step. Parking on one would wait for a decision nobody is ever asked to make — the turn would hang on the first auto-approved read, with a phantom "Waiting for you" card on screen. Caught by `approval-smoke.mjs`, not by reading the docs.
- [x] Denial path: a denied tool never runs, and the model receives the denial and still answers (verified headless)

### Phase D — Persistence
- [x] `chat_tool_calls` table with migration under `electron/drizzle/`
- [x] Every call is logged, including auto-approved reads (buffered per turn, then written with the assistant message)
- [x] Failure to write still leaves the timeline honest: approval denials mark `denied`, result-less calls are closed as `stopped`
- [x] Session delete removes tool rows (`clearSessionMessages`)
- [ ] Feed a browser-usage summary into the *model's* `loadHistory` — persisted rows reach the renderer for rehydration, but turn 2 still cannot see that a browser was used
- [ ] `browser_enabled` settings key

### Phase E — UI
- [x] Approval card — tool name, parsed input, reason, Approve / Deny, denial surfaced as a row
- [x] Live tool timeline (`browser-activity.tsx`), rehydrated from `chat_tool_calls` on load
- [x] Status line — URL + title in the panel header, which doubles as the pill the plan called for
- [x] Sidebar browser item toggles the panel instead of opening a separate window
- [x] `normalizeMessages` branch for tool events, with a `toolActivityRef` mirror so nested `setState` is avoided
- [x] Stop-while-pending: `settleUnfinishedTools()` closes running rows as `stopped` on `stopped`

### Phase F — Validation
- [x] `tsc -b` + `tsc -p tsconfig.preload.json` green in `electron`; `tsc --noEmit` green in `renderer`
- [x] `npm run test:browser` (`electron/scripts/browser-smoke.mjs`) green — covers CDP attach, snapshot, refs, navigation, inputs, screenshot, PDF, **and the panel rectangle / collapse / resize contract**; run repeatedly to catch the frame-timing flake it originally had
- [x] `npm run test:providers` green
- [x] Headless smoke (`npm run test:approvals`, `electron/scripts/approval-smoke.mjs`): approval parks with nothing executed → approve → tool executes → model answers; deny → tool never runs → model is told and still answers; automatic approval leaves the user no decision. Offline, mocked at `fetch` like `provider-compat.mjs`.
- [x] **Resume-shape regression assertions** in `approval-smoke.mjs`: the resumed request must still open with the original user turn, and a `tool-approval-response` must never reach the provider. Proven non-vacuous — reverting the resume to the old replace-shape fails both assertions with `first message role is assistant`.
- [ ] Headless smoke: abort while parked → no hang, no orphaned approval — needs `ai/chat.ts` to be importable outside Electron, which it is not yet
- [x] `npm test` chains all three suites (providers, approvals, browser panel)
- [ ] Manual: "open example.com and tell me the heading" — end to end with a real key
- [ ] Manual: a click task — confirm the prompt appears, the action happens only after approval, and the status line tracks the URL
- [ ] Manual: verify the page cannot reach `file://` even when the model asks
- [ ] Manual: collapse the panel mid-run, switch to chat, expand again — the page must still be there and responsive

### Decisions worth keeping
- **The page is not its own window.** `WebContentsView` is parented into the chat window's `contentView`; the renderer reports the panel rectangle and main parks the view in it. Collapsing sends `null` bounds and hides the view while the page stays loaded, so the model keeps working while the user is back in chat.
- **`backgroundThrottling: false`** on the view is load-bearing — an occluded page stops producing frames, and a click then stalls waiting for one.
- **Scrolling is done in JS, not `DOM.scrollIntoViewIfNeeded`.** The CDP call blocks on a compositor frame; in a collapsed panel there may never be one, which turned every click into a five-second stall before it was dispatched at stale coordinates.
- **An auto-approved tool still emits an approval request.** It carries `isAutomatic` and is answered by the SDK before the stream moves on. The loop must skip those, because parking on one waits forever for a decision no card will ever ask for.
- **Reads and clicks are auto-approved; only writes are gated.** `browser_navigate`, `browser_snapshot`, `browser_read`, `browser_screenshot`, `browser_click` and `browser_go` never prompt. `browser_type` (it can submit a form) and `browser_save_pdf` (it writes a file) do.
- **The approval resume must EXTEND the running message list, never replace it.** `StreamTextResult.responseMessages` contains only what the call *produced* (its steps plus tool messages derived from approvals in its input) — the input messages are not part of it. The original resume did `[...await result.responseMessages, approvalMsg]`, which dropped the user turn and history; the next request then opened with an assistant function call and **Gemini 400'd** ("Please ensure that function call turn comes immediately after a user turn or after a function response turn"). OpenAI tolerates an assistant-first prompt, so the bug was invisible until a provider that validates turn order was used and invisible to the then-current smoke test, which had replicated the same shape. Fixed by appending: `[...workingMessages, ...(await result.responseMessages), approvalMsg]`, and pinned by the resume-shape assertions above.

---

## Open Questions — Feature 5
- Where does the browser window live — a separate OS window, or docked into the chat layout? **Resolved — docked.** It is a `WebContentsView` inside the chat window, reported by the renderer as a rectangle and parked there by main. Collapsing keeps the page alive with zero bounds; "embedded" (vs driving a real Chrome) was a separate axis and stays rejected.
- Should the auto-approved set extend to `browser_save_pdf`? **Resolved — no.** It writes a file outside the app, so it prompts, same as `browser_type`.
- Should a completed run be replayable — i.e. re-run the same task with a different approval answer, from the tool timeline?
- Multi-window/`defaultSession` cookie sharing: **resolved — deliberately isolated.** `persist:dummy-browser` starts empty, so the accepted cost is one login per site. In exchange, a mis-click by the model cannot touch the user's real signed-in Gmail/GitHub, and `sandbox: true` + no-preload stays enforceable. This is the core reason we rejected driving the real Chrome via `browser-use` (which would also have cost an extra Chrome process, a Python daemon, macOS Accessibility TCC, and Chrome's per-attach remote-debugging consent — all while *raising* memory on an 8 GB machine). If login friction becomes the actual complaint, the fix is a sign-in affordance or cookie import — not swapping the tool layer to a Python child process.
- Should the `stepCountIs(n)` limit be a per-tool budget (e.g. max 20 clicks per turn) rather than a flat step cap?

---

## Feature 6 — Deep-Task Lane (`@browser_use/pi` autonomous agent)

### Goal
For long autonomous web tasks ("find the top 5 X and save a list to a file"), add an **optional second lane**: a one-shot `browser_deep_task` tool that hands the task to **browser-use-pi** (Browser Use's pure-TypeScript Pi agent, `@browser_use/pi`), which runs its **own** agent loop in a forked worker and drives **its own external Chrome window**. The embedded F5 panel, its 8 tools, and the `ToolLoopAgent` approval loop stay exactly as they are — this extends chat, it does not replace it.

> **Status: Phase 0 + G1–G3 done, G4 automated pieces done — keyed manual QA is yours to run, nothing is committed.** The Phase 0 spike (`electron/scripts/pi-spike.mjs`) runs green under Electron; `browser_deep_task` is live end to end (service → tool → approval → cells → row). The keyed section of the spike and the manual checklist below are what the user has volunteered to test by hand.

### Non-goals (v1)
- Not replacing or wrapping the F5 embedded tools — the deep lane is a *separate* tool on the same `ToolLoopAgent`.
- **No CDP bridge** to the embedded `WebContentsView` (rejected — see constraint below).
- No shell / `researchTools`, no per-cell approvals, no headless + screenshot mode (deferred; all listed as open questions).
- No settings UI (model is derived from the chat provider), no DB migration, no `bu-pi-server`, no their session/history UI.
- Not reusing their session persistence — result comes back as one tool output.

### Locked decisions (confirmed with user)
1. **Approvals — upfront only + live feed.** The existing `toolApproval` expression already gates every non-read tool, so `browser_deep_task` gets one approval card before anything starts (it can browse, run JS, and save files — the card is the capability grant). While running, every JS cell streams live into the activity timeline; the existing stop button cancels. `researchTools` (shell) stays **off**. Per-cell gating was rejected: their primitive is an opaque REPL cell (arbitrary JS with fs + network), `beforeToolCall` can only block *whole cells*, and read-vs-write cannot be classified inside arbitrary code — so per-cell means "ask about everything" or a fragile LLM classifier.
2. **Headed external Chrome.** `Browser.chromium({ headless: false, profileDir })` spawns the installed Chrome with an isolated persistent profile (`userData/deep-chrome`), so logins survive and the user can watch/take over. It cannot be embedded in the panel (constraint below). Headless-with-screenshots is deferred.
3. **Reuse existing provider keys.** Read the chat's provider key from `db/keys.ts` (`safeStorage`), set the matching env var (their transports read `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / …), and pick a vision-capable entry from `builtinModels()` for that provider. No OpenRouter account, no second key to enter, no `streamFn` bridge. A settings override can come later if the auto-pick is ever wrong.

### The hard constraint: the embedded view can never be their target
Their client connects to a **browser-level CDP WebSocket**: `Target.*` with flatten sessions (`sessionId` routing), tab create/close, plus `Fetch` interception installed by their policy layer. Electron gives us only `webContents.debugger` — page-level, no WS endpoint, no Target domain, no sessions. The four options, evaluated:

| Option | Verdict |
|---|---|
| CDP WS bridge emulating Target/flatten over `webContents.debugger` | **Rejected** — large fragile protocol emulation (new tabs = new `WebContentsView`s, faked sessionIds, Fetch policy passthrough), breaks on upstream changes, and revives the F5 no-remote-debugging stance |
| `--remote-debugging-port` on our own app | **Rejected in F5** — unauthenticated hole that would expose our chat renderers |
| Attach to the user's real Chrome (`Browser.chrome()`) | **Rejected** — needs `chrome://inspect` consent or macOS Accessibility automation of Chrome's dialog; also touches the user's signed-in session |
| Let it spawn its own Chrome (`Browser.chromium()`) | **Chosen** (decision 2) |

Consequence: the deep lane's page lives in a **separate OS window**; the panel remains the F5 interactive surface. That is the whole trade.

### Why this works inside our Electron app (verified, not assumed)
- `electron/` is `"type": "module"`, tsconfig `module: nodenext`, plain `tsc` build (no bundler) → an ESM-only dep loads directly; dynamic `import()` keeps it off the startup path. `skipLibCheck` is already on.
- Their worker is `fork(process.execPath, …, { env: {} })`. Electron's patched Node **auto-sets `ELECTRON_RUN_AS_NODE=1`** on fork, so the child is plain Node, not a second GUI app — and `env: {}` therefore carries only that flag (no PATH/HOME in the child; harmless, it gets workspace + CDP endpoint over IPC).
- Verified locally: **Electron 44.3.0 bundles Node 24.20.0** ≥ their `engines.node >=22.19`.
- Caveat for packaging: the `runAsNode` fuse must stay default-on, or their `fork` breaks (Electron documents this exact coupling).

### Evaluation facts (read from source/docs, 2026-10 — do not re-research from memory)
| Fact | Detail |
|---|---|
| Package | `@browser_use/pi` v0.1.0, MIT, pure TS; deps `@earendil-works/{pi-agent-core,pi-ai,pi-coding-agent}`, `devtools-protocol`, `typebox` — **no Python, no Playwright** |
| Their loop | Own agent loop (not `ai@7`): one `javascript` tool = persistent Node REPL + raw CDP (`cellTimeoutMs` 30s), `finish`/`finish_from_js` with TypeBox schema validation, optional `researchTools` shell |
| Browser options | `Browser.cloud` (paid), `Browser.chromium({profileDir, headless})` → spawns installed Chrome with `--remote-debugging-port=0` + temp/persistent profile (headless **by default**), `Browser.chrome()` attach, `{cdpUrl}` / `pending()` + `connectBrowser()` |
| Hooks | async `beforeToolCall`/`afterToolCall` → `{ block, reason, terminate? }`, wrapped in `bounded(..., hookTimeoutMs)` (default 30s) — blocking is possible but cell-granular |
| Worker | forked child: `node:inspector` + `node:vm`, `chdir(workspace)`, grants `process`/`Buffer`/`fetch`/`require` → **full fs + network, unsandboxed by design** (README: "use an isolated machine for untrusted tasks") |
| Budgets | `maxSteps` 40, `timeoutMs` 300s default, `maxCostUsd` checked between turns (can overshoot by one response), `operationTimeoutMs` 15s |
| Telemetry | **on by default** → must pass `telemetry: false` (or `DO_NOT_TRACK=1`) |
| Concurrency | profile lock `.bu-pi.lock` (wx) — one run per profile, hard error on second |
| Events | `onEvent` subscription over their agent events → basis of the live cell feed; `formatEvent` exported |
| API | `BrowserUse.create(opts)` → `run(task, { schema })` / `followUp` / `close()`; `builtinModels()` exported; `result.status: 'completed' \| 'partial' \| …` |
| Model plumbing | `model: 'provider/id'` from their catalog; transports read provider env vars; custom `models` catalog / `streamFn` exist but are **not needed** under decision 3 |

### Architecture Overview
```
renderer (chat window)                 electron/main (Node, ESM)
----------------------                 -------------------------
approval card ── invoke ──────────────►  toolApproval: isReadOnlyTool() is false
   ▲                                      → user-approval card (existing machinery)
   │                                      approve → deep-task.ts
timeline cells ◄─ browser:deep ────────     resolve provider → getProviderKey()
   │                                        → set env var → builtinModels() pick
stop button ── chat:stop ─────────────►     dynamic import("@browser_use/pi")
                  stopActiveStream()        BrowserUse.create({
                  → abortDeepTask()           model, telemetry: false,
   ▲                                          browser: Browser.chromium({
   │                                            headless: false,
   │                                            profileDir: userData/deep-chrome }),
   │                                          workspace: userData/deep-tasks/<id>,
   │                                          researchTools: false,
   │                                          timeoutMs: 600_000, maxCostUsd: 1 })
   │                                        onEvent ──► browser:deep ──────────┘
   │                                        run(task, schema) → {summary, files[]}
   ▼
external Chrome (their process: installed Chrome, own profile, visible window)
+ their worker (our Electron binary running as Node 24 via ELECTRON_RUN_AS_NODE)
```

### UX contract
- Model asks → `browser_deep_task { task }` → approval card with capability-grant wording ("opens an external Chrome window; runs code and saves files until you stop it").
- Running: one `chat_tool_calls` row (running) + live cells nested under it (code line, status, duration); the turn occupies chat until done or stopped.
- Result: TypeBox schema `{ summary, files[], workspace }` → tool output → model weaves it into the reply; files live in the per-run workspace under `userData/deep-tasks/`.
- One deep task at a time (their profile lock makes concurrent runs impossible anyway).
- **Human-verification wall (G5):** when a cell's result matches a CAPTCHA/anti-bot phrase (`recaptcha`, `hcaptcha`, `turnstile`, `cf-challenge`, `not a robot`, `verify you are human`, `unusual traffic`, `checking your browser`, `just a moment`, …), the run is **paused** and its row shows an amber "prove you're human" card with a quoted snippet. The user solves it in the visible Chrome window and presses **Resume** (`browser:deep-resume`) — no automated bypass; the agent never attempts the challenge. A **Pause** control on a running deep row does the same on demand. Pause is cooperative (pi acknowledges at the next tool boundary); `resumeDeepTask` re-arms detection so a second wall later in the same task is reported too.

### Risks
1. **Chrome must be installed** (`/Applications/Google Chrome.app` on macOS) — surface their "Chrome not found" error verbatim instead of a generic failure.
2. **Upfront-only is a capability grant** — cells read/write (workspace) and hit the network with no further prompts. Deliberate (decision 1); shell-off narrows it. Escape hatch if it ever feels wrong: `beforeToolCall` gating, at the cost of noisy cards.
3. **Two loops, two meters** — their steps/cost run against the same user key as chat. `maxCostUsd` cap (plan $1) + `timeoutMs` 600s are the guards.
4. **Memory** — another Chromium on the 8 GB machine (~100–300 MB + page). Don't habitually run a heavy F5 page and a deep task at once.
5. **Fuse/packaging** — `ELECTRON_RUN_AS_NODE` must stay enabled when a packaged build ever exists.
6. **v0.1.0 upstream** — pin the version; upgrades must re-verify fork behavior, catalog ids, and hook semantics.
7. **Catalog model ≠ chat model** — auto-pick is per provider; screenshot interpretation needs a vision-capable entry, so the pick must be validated per provider against real `builtinModels()` output (Phase 0), not guessed.

---

## Todos — Feature 6

> **Status: G1–G8 built, manual QA pending — do not re-research from memory.** Phase 0 is a spike and must run first; everything after it assumes Phase 0's findings. G5 adds the human-in-the-loop handoff for CAPTCHA/"verify you are human" walls; G6 adds provider rate-limit retries + honest error surfacing; G7 adds the browser-backend setting and the `@` tool picker; G8 fixes concurrent-navigation aborts (`ERR_ABORTED`) that made parallel browser lookups fail.

### Phase 0 — Spike (blocks everything)
- [x] `npm i @browser_use/pi` in `electron/` (pin exact version); `tsc -b` accepts its types — pinned `0.1.0`; `npm run build` is green
- [x] Dump `builtinModels()` at runtime: entries + env-var names + vision flags for openai/anthropic/google/xai — **all 78 entries across the four providers are vision-capable** (`input` includes `"image"`); record the chosen default per provider **here**, not from memory:
  - openai → `gpt-5.4` · anthropic → `claude-sonnet-4-6` · google → `gemini-2.5-flash` · xai → `grok-4.3`
  - env vars pi-ai reads: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, **`GEMINI_API_KEY`** (NOT `GOOGLE_API_KEY`), `XAI_API_KEY`; model id form `provider/modelId`
- [x] One trivial real-key `BrowserUse.run()` under Electron — proves the worker fork, `ELECTRON_RUN_AS_NODE` path, telemetry off, Chrome launch (headed). The spike now loads `electron/.env` and picks the provider from whichever key is present (Anthropic, else Google), bridging a Google key stored as `GOOGLE_GEMINI_API_KEY` to the `GEMINI_API_KEY` pi-ai reads:
  ```
  ANTHROPIC_API_KEY=... electron scripts/pi-spike.mjs --keyed
  GOOGLE_GEMINI_API_KEY=... electron scripts/pi-spike.mjs --keyed   # or in electron/.env
  ```
  (create-only mode needs no key and runs green; run with no key resolves to `{ status: "error", error }` with an auth-flavoured message — fails cleanly, no hang, no throw. Verified keyed green on `google/gemini-2.5-flash`, 2026-10.)
- [x] Confirm `.bu-pi.lock` behavior (second run rejected cleanly) — locked: a second `BrowserUse.create` on the same profile throws the verbatim lock error; `close()` removes the lock so a later run can reuse the profile

#### Phase 0 findings (spike + source, 2026-10)
- `create()` ≠ `run()`: the browser launch, `--remote-debugging-port=0` discovery, profile dir creation (0o700) and `.bu-pi.lock` (`wx`, 0o600) all happen **in `create()`, before `run()`**. So the single-flight guard must gate `create()`, and chrome-missing/lock errors surface at create time.
- Chrome is spawned headed when `headless: false` is passed (no `--headless=new` flag); the devtools endpoint is read from `<profile>/DevToolsActivePort` (`<port>\n/devtools/browser/<uuid>`), which is also how the spike verifies the launch.
- macOS Chrome path is `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`; when absent pi throws `Chrome not found. Install Chrome or set browser.executablePath / browser.cdpUrl.` — surface verbatim with our own "install Chrome" hint added.
- Worker: `fork(process.execPath, …)`, `execArgv: ['--max-old-space-size=256']`, `env: {}` (only `ELECTRON_RUN_AS_NODE=1` survives), `stdio ignore+ipc`, `serialization: 'json'`. Provider keys stay in the agent process; env vars must be set where `BrowserUse` lives, just-in-time.
- `run(task, options)` at runtime accepts `options.schema` (TypeBox) even though the shipped `RunOptions` type omits it → we skip pi's schema and build `{ summary, files, workspace }` from the string output + `result.workspace` + a workspace `readdir`, avoiding an unchecked cast.
- Events: `AgentEvent.tool_execution_{start,update,end}` (toolCallId, toolName, args, partialResult / result, isError). `javascript` args are `{ code }`; `finish`/`finish_from_js` are the delivery cells. `onEvent` (per-run) is the mapping source for the cell feed.
- `BrowserUseOptions` are per-instance; `close()` is idempotent (kills Chrome, closes+removes the lock, keeps the persistent profile).

### Phase G1 — Deep-task service (`electron/browser/deep-task.ts`)
- [x] `resolveDeepModel()`: provider from the chat config → `getProviderKey()` → set matching env var just-in-time → vision-capable `builtinModels()` pick; typed error when no key / no catalog entry — defaults `openai/gpt-5.4 · anthropic/claude-sonnet-4-6 · google/gemini-2.5-flash · xai/grok-4.3`, fallback to first image-capable entry, `DUMMY_DEEP_MODEL` (global) or the per-provider env var overrides
- [x] `runDeepTask({ task, toolCallId, signal })` — dynamic import off startup path, `BrowserUse.create({ telemetry:false, researchTools:false, headless:false, profileDir, workspace, timeoutMs: 600_000, maxCostUsd: 1 })`, `run()`, `close()` in `finally`
- [x] `abortDeepTask()` export + module-level single-flight guard; key env var restored/removed in `finally`; `DeepEvent` on `onDeepTaskEvent()` for the cell feed; `registerDeepSessionProvider` (injected by chat.ts)
- [x] Per-run workspace `userData/deep-tasks/<sessionId>-<ts>/` + persistent Chrome profile `userData/deep-chrome`
- [x] Chrome-missing / lock-held / no-key errors surfaced as plain actionable tool-error text (with install/quit guidance)

### Phase G2 — Tool + wiring
- [x] `browser_deep_task { task }` (task ≤ 4000 chars) in `browser/tools.ts`, **not** in `READ_ONLY` → `toolApproval` returns `{ type: "user-approval", reason: DEEP_TASK_APPROVAL_REASON }`, surfaced on the card via `part.reason`
- [x] `abort()` also calls `abortDeepTask()` so any stop mid-run cancels the child + Chrome (belt alongside the SDK abortSignal riding into `runDeepTask`)
- [x] `chat_tool_calls` row: input = task, output = summary + files + workspace path (row writing was already generic)
- [x] Approval-card copy: capability-grant wording (`DEEP_TASK_APPROVAL_REASON`), renders in the existing card
- [x] CHAT_INSTRUCTIONS note: deep task for whole-jobs, embedded tools for quick lookups; `ToolLoopAgent` `timeout` lifted to 600 s (600 s tool / 620 s deep-call) because the SDK default step timeout would kill a >5 min run

### Phase G3 — Live feed UI
- [x] main forwards `onDeepTaskEvent` → `browser:deep` IPC; preload + `renderer/electron.d.ts` types (mirror the `chat:event` pattern, `DeepEvent` exported from preload)
- [x] `use-chat.ts` subscribes, patches `ToolActivity.cells` by pi cell id (`deep-cell-start/delta/end`); `toStoredToolCall` drops `cells` (live-only v1); `browser-activity.tsx` renders nested cells (code line + latest output, height-capped) and a deep row label/summary
- [x] Stop path verified by construction: `abort()` → `abortDeepTask()` → `run()` aborts → `finally` closes Chrome → tool-result (or stopped row) settles the row

### Phase G4 — Validation + docs
- [x] `approval-smoke.mjs` extended: `browser_deep_task` parks → approves → executes (mocked) → denies → never runs, reason propagates, `isAutomatic` shows it is NOT read-only — green
- [x] Full gate green: `npm test` (providers + approvals + build + CDP smoke), electron `tsc -b` + preload, renderer `tsc --noEmit`, eslint on touched files
- [ ] Manual (yours, needs a real key): sample task → external Chrome window moves, cells stream live, stop cancels, result lands in chat, workspace files exist
- [ ] Manual (yours): no-Chrome / no-key paths show the actionable errors
- [x] Update this section with outcomes and traps found — see below

### Outcomes + traps found (2026-10)
- **The SDK only parks tools it recognises.** The first deep-tool smoke failed because the mock streamed `browser_type` to a toolset that only had `browser_deep_task` — zero parks, no execute. The scripted stream took a tool name + args, and everything green. Trap shaped like a mock, not the app.
- **The approval `reason` round-trips.** `toolApproval` returning `{ type: "user-approval", reason }` lands on the `tool-approval-request` part's `reason` field (asserted in the smoke), so chat.ts's existing `part.reason` plumbing needs no change.
- **`exactOptionalPropertyTypes: true`** in electron: passing `signal: undefined` from the SDK's `ToolExecutionOptions` requires `signal?: AbortSignal | undefined` on `runDeepTask`'s options.
- **`BrowserUse` has a private constructor** — type the instance via `Awaited<ReturnType<typeof BrowserUse.create>>`, not `InstanceType<typeof BrowserUse>`.
- **The devtools probe reads `<profile>/DevToolsActivePort`** which is `<port>\n/devtools/browser/<uuid>` (never an IP) — the first spike check looked for `127.0.0.1` and was the only non-pi false fail.
- **App quitting mid-task** orphans Chrome behind `userData/deep-chrome/.bu-pi.lock`; the lock error text tells the user exactly how to recover, and `will-quit` best-effort aborts the run.

### Phase G5 — Human-in-the-loop challenge handoff (2026-10)
- [x] `deep-task.ts`: `deep-challenge { reason, snippet }` + `deep-control { paused }` event/payload variants; `CHALLENGE_PATTERN` + `challengeSnippet()` (windowed quote around the match); detection runs once per run on each `tool_execution_end` result (`challengeSignalled` flag, re-armed on resume)
- [x] `pauseDeepTask()` / `resumeDeepTask()` exports + module-level `activeBrowser` / `activeToolCallId` (set after `create()`, cleared in `finally`); pause emitted optimistically, then `browser.pause()` called **without await** (it only resolves at the next tool boundary — awaiting from the event handler would deadlock the run)
- [x] `main.ts`: `browser:deep-pause` / `browser:deep-resume` handlers, restricted to the chat window (`windowFor(event) === chatWindow`)
- [x] `preload.ts` + `renderer/electron.d.ts`: `deep.pause()` / `deep.resume()` + the two event variants mirrored
- [x] `use-chat.ts`: `DeepEvent` union renamed/extended; `ToolActivity.deepPaused` / `deepChallenge` (live-only, dropped by `toStoredToolCall`); handler patches the row from `deep-challenge`/`deep-control`; `setDeepPaused(paused)` returned by the hook
- [x] `browser-activity.tsx`: amber challenge banner (reason + snippet + Resume), plain "Paused + Resume" when paused without a challenge, and a "Pause" affordance on a running `browser_deep_task` row; status text reads "Needs you"/"Paused"
- [x] Gate green: electron `npm run build`, renderer `tsc --noEmit`, eslint on touched files, `test:providers`, `test:approvals`

#### G5 decisions + traps
- **No automated bypass.** Stealth fingerprints / solver services are anti-bot circumvention; the app hands the wall to the human instead. The regex is intentionally broad — a false positive costs one click on Resume, a miss costs the agent a loop against a wall it cannot pass.
- **Pause resolves at the next tool boundary**, so `pause()` must never be awaited from inside `onEvent`; the row reflects the request immediately and pi's next state is "no tool taken".
- **Two events, two jobs:** `deep-challenge` carries the reason/snippet for the card; `deep-control` is the authoritative paused bit (set for a detection pause, cleared for a resume). Resume clears `deepChallenge` so a stale banner cannot linger over a moving run.
- **Live-only.** Like `cells`, both fields are dropped by `toStoredToolCall`: history keeps the final output, not the moment the wall appeared.

### Phase G6 — Provider rate-limit resilience (2026-10)
- [x] **Root cause:** pi-ai retries 408/409/429/5xx with backoff, but only when the caller passes `maxRetries` (`retryProviderRequest` defaults it to `0`). `BrowserUseOptions` never sets it, so a single transient `429` from Google ended the run — common on free-tier RPM/TPM with the deep agent's image-heavy burst. The outer chat model then paraphrased the failed tool result into a fabricated answer.
- [x] `deep-task.ts`: wrap pi's transport (`models.streamSimple`) in a `streamFn` that forwards `maxRetries: 2` + `maxRetryDelayMs: 60_000`; pass the same `models` collection into `BrowserUse.create` so identity is preserved. Aborts during backoff still fire (pi-ai's sleep is abortable).
- [x] `deep-task.ts`: `rateLimitHint()` turns a rate-limit/quota stop into plain actionable text ("wait a minute or switch provider/model in Settings") before the tool returns `{ error }`.
- [x] `deep-task.ts`: `DUMMY_DEEP_MODEL` override — a bare model id for the active provider, or `provider/modelId` (ignored if the provider differs); validated against the catalog and falls back to the vision default.
- [x] `ai/chat.ts`: `CHAT_INSTRUCTIONS` now tells the model to report tool errors plainly and never invent the results a failed tool should have produced.
- [x] Gate green: electron `npm run build`, renderer `tsc --noEmit`, `test:providers`, `test:approvals`

### Phase G7 — Browser backend setting + `@` tool picker (2026-10)
- [x] **`browser_backend` setting** (`embedded` | `deep`, default `embedded`) in the `settings` table, read/written through `getBrowserBackend`/`setBrowserBackend` in `ai/config.ts` and surfaced on `AiConfig`. IPC `ai:set-browser-backend` reuses the existing `mutateConfig` helper so the renderer gets the re-read config back.
- [x] **Backends are exclusive, not cumulative.** `toolsForBackend()` in `browser/tools.ts` hands the agent the step tools with no deep task, or `browser_deep_task` alone. Cumulative sets were the first design and they let the model interleave a dozen approved clicks with one approved autonomous run — neither auditable nor cheap.
- [x] **Backend-aware prompt.** `CHAT_INSTRUCTIONS` became `chatInstructions(backend)`: each lane gets the paragraph describing *its* tools and not the other's. Telling a model a tool exists when it is not in the tool set produces a turn that apologises for a call it cannot make.
- [x] **Settings UI (staged + saved):** a "Browser automation" `RadioGroup` in `renderer/app/settings/page.tsx`. The choice is **staged, not written on click** — swapping the backend changes which tools the whole chat has, and an instant write with no acknowledgement reads as a setting that never saved. `pendingBackend` holds a value only while it differs from the saved one, so the radio is always driven by the saved config, a successful write needs no reset, and a failed one stays pending and retryable. **Save** is disabled unless dirty; `apply()` now resolves `Promise<boolean>` so the page can confirm rather than assume. Success raises a `Toaster` toast (mounted once in `app/layout.tsx`).
- [x] **`@` picker in the composer:** typing `@` opens a panel above the textarea. It lists **one capability, `BrowserAutomation`, in both modes** — not the raw tools. A picker listing `browser_navigate`/`browser_snapshot`/`browser_read`/… asks the user to know which internal step they want before the assistant has looked at anything, and it changes shape whenever a tool is renamed; naming the *capability* is what a person means by "go and check that page". `mentionCatalog(backend)` returns the single entry with a backend-specific description; the agent still receives the real tools from `toolsForBackend`. Arrow/Enter/Tab/Escape are handled on the textarea (it keeps focus; the panel is a visual echo of the selection), and `onMouseDown` is prevented so the caret survives the click. The `@` must start the message or follow whitespace, which keeps an email address from opening the picker.
- [x] **`ai/mentions.ts`:** the directive builder, deliberately free of the browser/DB/Electron graph so it can be tested alone. Only names the picker actually offered are honoured, so a hand-typed `@browser_navigate` is not a mention. The directive is phrased as a capability — *"use the browser tools available to you … take as many of them as the job needs"* — rather than pinning one call, which is what lets one mention drive a multi-step run. Appended to the model turn only, after `insertMessage` has stored what the user typed — the transcript stays exactly what was written.
- [x] `scripts/browser-backends-smoke.mjs` (`npm run test:backends`, wired into `npm test`): 16 checks over backend exclusivity, picker collapse, mention detection and directive scoping.
- [x] Gate green: electron `npm run build`, renderer `tsc --noEmit` + eslint on touched files, `test:providers`, `test:approvals`, `test:backends`
- [ ] Manual: Settings → pick a backend → Save → toast + "Unsaved change" clears, value survives a restart; `@BrowserAutomation` in the composer → arrows + Enter inserts and the model drives a multi-step run rather than one pinned call.

### Phase G8 — Concurrent-navigation aborts (2026-10)
- [x] **Root cause:** `open()` (`browser_navigate`) was the only page operation **not** run under `browser/window.ts`'s `Mutex`, so two `loadURL` calls raced: the second aborted the first, and Chromium reports that as `ERR_ABORTED (-3) loading '<url>'`. The model reads that as the site refusing it. The module's own header comment already claimed *"Every operation therefore runs through a mutex"* — the invariant was documented but not held. `open()` is now `mutex.run(async () => …)`; no nested `mutex.run` exists on its call path, so there is no deadlock.
- [x] `close()` had the same defect — it navigates to `about:blank` and clears refs outside the mutex, so evicting the page mid-`browser_navigate` aborted the load the same way. Now under the mutex, still fire-and-forget because `will-quit` calls it.
- [x] **Regression test** (`scripts/browser-smoke.mjs`): fires three `open()` calls concurrently and asserts none reject. Verified it reproduces `ERR_ABORTED (-3)` with the fix reverted, so it fails on the bug rather than merely passing on the current code.
- [x] `ai/chat.ts`: `TOOL_ERROR_INSTRUCTIONS` split **transient** from **permanent** failures. It previously said "report it plainly and stop", which is what made one aborted navigation collapse into "I'm sorry, but I can't reliably complete this". It now asks for a retry on aborts/timeouts/stale refs and for finishing the rest of the task on a refusal — while keeping the G6 rule that a failure is never dressed up as an answer.
- [x] Gate green: `npm run build`, browser-smoke (incl. the new race checks), `test:providers`, `test:approvals`, `test:backends`, renderer `tsc --noEmit`

---

## Open Questions — Feature 6
- Model override in settings if the auto-pick picks wrong (or user wants a cheaper/deeper model than chat)? — interim: `DUMMY_DEEP_MODEL` env / per-provider env var override
- ~~Persist the cell transcript into `chat_tool_calls.output` (JSON) so the timeline survives reload, or live-only v1?~~ — **decided: live-only v1** (Row keeps final output; cells are dropped in `toStoredToolCall`)
- Headless mode + screenshots into the panel as a toggle, for watching without a second window?
- Block deep tasks while a heavy F5 page is open (memory), or leave it to the user?
- Should the deep lane ever be allowed to target the *embedded* panel (i.e. revisit the CDP bridge), or is the external window permanent?

---

## Feature 7 — Delete My Data (Settings)

> **Status: shipped** (uncommitted). Adds two destructive actions to the AI Settings page: **Delete uploaded images** and **Delete all my data** (a full factory reset of the on-device store plus the bytes behind it).

### Why the wipe is two halves that move together
- A wipe must free the **rows** *and* the **files**. Deleting `chat_attachments` rows without the files leaks a screenshot per message forever (nothing else ever walks the screenshots directory); deleting files without the rows leaves ghost rows whose thumbnail reads 404.
- **Delete all data** (`electron/ai/data.ts` → `deleteAllData`) runs all six tables (`chat_tool_calls`, `chat_attachments`, `chat_messages`, `chat_sessions`, `provider_keys`, `settings`) in **one transaction** so a mid-wipe failure cannot leave history without its keys or a key without a provider. Files are removed only after the commit.
- The **screenshots directory is removed wholesale** (`fs.rm(…, { recursive, force })`) rather than walking the rows, because it also holds `staging/` leftovers and orphaned bytes no row points at — "free the space" frees all of it. `/deep-tasks` (Feature 6 workspace root) is removed the same way; it doesn't exist yet, `force: true` keeps it free.

### Teardown + hygiene
- Both IPC handlers (`ai:delete-all-data`, `ai:delete-all-attachments` in `main.ts`) call `stopActiveStream()` first (and `closeBrowser()` for the full wipe) so an in-flight stream or an embedded page can't write back rows/files mid-delete.
- The renderer **reloads the window ~1.2 s after a successful wipe** (`use-ai-settings.ts`): the transcript, sessions list, staged captures and preview blobs all live in memory, so they're stale the moment the wipe commits. `message` carries failures to the page's error banner; `dataNote` carries the success summary (item counts + bytes freed) while the reload timer runs.
- Confirmation is a **shadcn `AlertDialog` modal** (the same controlled `open`/`onOpenChange` pattern the sidebar's "Delete this chat?" uses): the destructive button opens a dialog that states exactly what gets removed, **Cancel** closes it untouched, and the confirm action runs the wipe. No armed-button foot-guns, and one dialog serves both actions with per-action copy.

### Result shapes (preload → renderer)
- `wipeAllData` → `{ ok; counts: { messages, sessions, attachments, attachmentsBytes, toolCalls, savedKeys }; freedBytes }`.
- `deleteAllImages` → `{ ok; deleted; freedBytes }`.
- `freedBytes` is summed from `chat_attachments.byteSize` (staging/orphan files are removed but not byte-metered).

### Validation
- ✅ `npm run test:providers`, `npm run test:approvals`, `npm run test:browser`, `tsc -b` + preload typecheck green; renderer `tsc --noEmit` and eslint on touched files green.
- [ ] Manual: seed a chat with images → Settings → Delete uploaded images → Cancel keeps everything, confirm removes the files + chat reloads clean; repeat → Delete all my data → confirm → keys/settings/history all absent, empty app state after reload.

---

## Backlog (future features)
- Streaming/live transcription with VAD (whisper-command style).
- Local command execution ("draft a reply").
- Chat-scoped dictation (mic for follow-ups).
- Multiple chat sessions in the UI (the `chat_messages.session_id` column is already there).
- **Compact tool-trace summary with the final reply.** Today the live tool timeline for the F5 browser (and any future tool) clears when the final response arrives; keep the traces but collapse them into a one-line-per-tool strip beside the final LLM answer so "what the assistant did" survives the turn without filling the thread.

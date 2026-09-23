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

## Feature 2 — OpenCode Model Access (auth + discovery + selection ONLY)

### Goal
The app talks to a local OpenCode server that inherits the user's existing OpenCode installation/auth (`~/.local/share/opencode/auth.json` + `opencode.json`), lists the **active** models that account can access, lets the user pick one, and persists the choice. **No AI features** — no prompts, no streaming, no clipboard AI output, no "ask" flow.

### User Flow (v1)
1. **Alt+M** global shortcut opens the island in model-picker mode.
2. Island shows a compact, scrollable list of active models (name + provider; vision-capable flag shown as metadata, ready for F3).
3. User picks one → selection persisted → island briefly confirms ("Model set: <name>") → auto-hide.
4. Error states: opencode binary missing, not logged in, server failed to start — message in island.

### Architecture Overview
```
Electron main (spawns managed child)          SDK
────────────────────────────────              ─────────────
opencode serve --port <free>                   @opencode-ai/sdk
  child of app, killed on quit                 createOpencodeClient({baseUrl})
  reads existing auth.json/config ──► lists user's available models
```
- Binary resolution: `OPENCODE_BIN` env → `which opencode` (= `/opt/homebrew/bin/opencode` v1.18.31). Spawn child directly for control; connect via SDK client. Server binds a **free port** each launch; readiness via polling `GET /global/health`.
- Auth inherited automatically from existing OpenCode install — no keys stored in the app.
- Model list: `config.providers()` → `{ providers, default }`; each provider's `models` keyed by id. Filter `status: "active"` (skip deprecated/experimental). Include `providerID`, `id`, `name`, `capabilities.input.image` flag.
- Selected model persisted in a small JSON under `app.getPath("userData")` (no new deps).

### IPC Surface (additions)
- main → renderer: `opencode:status` (events: `connecting` / `ready` / `error` with message).
- renderer → main: `opencode:models` (invoke → flat list), `opencode:get-model` (invoke), `opencode:set-model` (invoke, persists).

### Platforms
- macOS dev (current target). Server child lifecycle: spawn on first use, keep alive, respawn once on crash, kill on quit (`will-quit`).

---

## Todos — Feature 2

### Phase A — OpenCode service (`electron/opencode.ts`)
- [x] Resolve binary (`OPENCODE_BIN` env → `which opencode`)
- [x] Spawn managed `opencode serve` child on a free port; health-poll `GET /global/health`
- [x] `listModels()` — active models flat list w/ provider + vision flag
- [x] `getSelectedModel()` / `setSelectedModel()` — persisted JSON in `userData`
- [x] Lifecycle: spawn on first use, respawn once on crash, `stop()` on quit
- [x] `@opencode-ai/sdk` dependency added

### Phase B — IPC + preload
- [x] `opencode:status` event (`connecting`/`ready`/`error`)
- [x] `opencode:models`, `opencode:get-model`, `opencode:set-model` handlers
- [x] Extend `electron.d.ts` + preload bridge

### Phase C — Renderer UI
- [x] `useOpencode` hook (status, models, get/set selected)
- [x] Alt+M opens island in model-picker state
- [x] Island states: connecting / models / error (+ loading)
- [x] Model list rendering: shadcn `Command` palette (search, keyboard nav, scroll) with provider groups, vision badge, selected check
- [x] Selection → confirm message → auto-hide (mirror existing island sizing/auto-hide)

### Phase D — Polish / hardening
- [x] Errors surfaced for missing binary / no auth / server start failure
- [ ] Port-in-use retry; server-crash respawn (respawn-once implemented)
- [x] Island grows top-anchored + clamped to work area (no cut-off when picker opens)
- [x] `tsc` + lint green in `electron/` and `renderer/` (feature files; pre-existing errors remain in untouched files)
- [ ] Manual test: Alt+M → list → select → confirm → persists across restart

---

## Open Questions
- F2: default selection = user's configured default provider/model from OpenCode config? (currently just persisted selection)

---

## Feature 2.5 — Technical-Jargon Post-Processing (LLM pass over transcribed text)

### Goal
`base.en`-class whisper transcribes everyday English well but mangles technical jargon (library/package names, identifiers, flags, version strings, commands like `pnpm dlx`, APIs like `getUserMedia`, terms like "idempotent"). **We will NOT scale whisper up to `small`/`medium`** (already decided). Instead, once Feature 2's model selection exists, we post-process the raw transcript through the **user's selected OpenCode model** via the already-running local OpenCode server, and copy the corrected text to the clipboard.

### Why not another whisper model
- `base.en` → `small.en` costs ~4x RAM (+~300 MB on an 8 GB M1) and only marginally helps domain terms it was never trained to spell.
- Technical accuracy needs a model that knows **the user's own stack + OpenCode's vocab**, not a generic English model. LLM pass fixes the specific failure mode (spelling/munging of jargon) without the RAM/disk cost.

### User Flow (v1)
1. User holds Alt+D, speaks (existing F1 flow).
2. Release → whisper `base.en` transcribes (existing F1) → **raw transcript**.
3. Island switches to a **"Polishing…"** state (between transcribing and done).
4. Main sends raw text to the selected OpenCode model with a strict "fix jargon, don't rephrase" prompt (via F2's already-spawned `opencode serve` + SDK).
5. Corrected text → `clipboard.writeText()` → island "Copied to clipboard" state (same auto-hide as F1).
6. **Fallbacks (never worse than today):** no model selected / server down / model error / timeout → copy the raw whisper transcript and skip step 3–4 (or show a brief "polish skipped" hint).

### Architecture Overview
```
renderer                               electron/main
─────────                              ─────────────
whisper transcribes (unchanged F1)     transcribeWav() → raw text
   │                                        │
   │  dictation:status "polishing"          │  polishTranscript(rawText)
   │◄───────────────────────────────────────┤  (reuses F2 client/server)
   │                                        │  session.create()
   │                                        │  session.prompt({
   │                                        │    model: selected F2 model,
   │                                        │    system: fix-jargon prompt,
   │                                        │    parts: [text(raw)] })
   │                                        │  → extract first text part
   │                                        │
   │  clipboard.writeText(corrected) ◄──────┤
   │  "done" + auto-hide                    │
```
- **No second server** — reuse the F2 managed `opencode serve` child + `@opencode-ai/sdk` client (`start()` spins it up lazily if the picker was never opened).
- **Prompt model** = the persisted F2 selection. (Note: users may want a fast/cheap model for this; selection is theirs.)
- Ephemeral session per clip (`session.create` → push one message → `session.delete`); no conversation state.

### The fix-jargon prompt (main-process constant, single-turn, `system` + one `text` part)
- Instruction (`system`): "You fix transcription errors in technical/developer speech. Output ONLY the corrected transcript. Do not add commentary, paraphrases, quotes, markdown, or reword phrasing. Preserve sentence structure, punctuation, capitalization, and line breaks exactly. Correct: library/package/tool names, identifiers, flags, commands, version numbers, URLs, APIs, file paths, and technical terms. If raw terms look like deliberate speech (e.g. intentional names), keep them."
- Single `text` part = raw transcript. Never chat/multi-turn.
- Verify against the SDK response shape: `SessionPromptResponses["200"] = { info: AssistantMessage, parts: Array<Part> }`; take the first `Part` with `type === "text"`.

### Latency & budget
- Adds one network LLM call per clip (1–3 s typical for a fast model). Acceptable for push-to-talk; island shows "Polishing…".
- Hard timeout in main (e.g. 30 s) → fall back to raw text.
- Skip preprocessing entirely when raw transcript is empty/whitespace (raw copy/no-op, as F1).

### IPC Surface (additions)
- main → renderer: `dictation:status` states extended: reuse `transcribing`, add `polishing`.
- No new renderer→main channels: flow stays inside the existing `dictation:audio` handler (transcribe → polish → clipboard → status).
- `polishTranscript(raw)` lives in the F2 `opencode.ts` service (already has client + storage).

### Renderer / island (additions)
- New `DictationStatus.state = "polishing"` + island hint ("Polishing technical terms…"): map to an added state in `useDictation`; reuse the existing spinner/thinking bars; keep auto-hide timing for `done`/`error` unchanged.

### Platforms / errors
- macOS dev (target). All failure paths degrade to **raw transcript** (never block dictation on the LLM).
- Error paths handled: F2 server not started / start fails, no selected model, session.prompt throws, empty model reply, timeout.

---

## Todos — Feature 2.5

### Phase A — Service: `polishTranscript(raw)` in `electron/opencode.ts`
- [x] `polishTranscript(raw: string): Promise<string>` — reuse F2 `start()` client; create ephemeral session, send prompt w/ selected model, extract first `text` part, delete session
- [x] Fix-jargon system prompt constant + hard timeout (e.g. 30 s) + empty-reply guard
- [x] Behavior when no model selected / server unavailable → return raw text unchanged
- [x] Tools disabled explicitly (OpenCode's agent prompt overrides `system` otherwise); instruction inlined in the user text part (reliable); backticks rejected in output

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
- [x] Smoke-tested `polishTranscript` against real `opencode serve`: jargon corrected (`p n m dlx` → `pnpm dlx`, `get user media` → `getUserMedia`, `use autos effects hook` → `useAutoEffect hook`), no backticks/markdown; warm-call ~6.3 s (within 30 s timeout); no-model/empty/timeout/error all fall back to raw; no lingering processes on stop
- [ ] Manual test: hold Alt+D, speak a jargon-heavy phrase, verify corrected clipboard text + fallback when no model selected

---

## Open Questions
- F2.5: should "polish skipped" (fallback) be silent or briefly indicated in the island? (leaning: silent, since dictation still works)

---

## Backlog (future features)
- Streaming/live transcription with VAD (whisper-command style).
- LLM agent hookup: transcript → local chat panel (`Send to chat` / `Open chat` buttons).
- Local command execution ("draft a reply") — Planafter Feature 1 ships.
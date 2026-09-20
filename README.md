# LingoLearn Lens — Instant Bangla Meanings & Pronunciation

A browser extension by **[ANSNEW TECH.](https://inside.ansnew.com/)** — a Firefox add-on and a Chrome extension with identical features and UI.

Select any text on any web page and LingoLearn Lens instantly shows its **meaning** in a small popup next to the selection **and starts reading it aloud** — automatically, with no extra clicks. Both behaviors are on by default. The target language defaults to Bangla and can be switched to 100+ languages; the pronunciation voice can be left on automatic or pinned to any system voice.

| | |
| --- | --- |
| **Product** | LingoLearn Lens (Firefox WebExtension + Chrome extension) |
| **Version** | 1.0.2 (both) |
| **Vendor** | ANSNEW TECH. — https://inside.ansnew.com/ |
| **License** | MIT |
| **Packages** | `firefox_plugin/lingolearn-lens-1.0.2.zip` (AMO) · `chrome_plugin/lingolearn-lens-1.0.2.zip` (Chrome Web Store) |

---

## 1. What it does

When the user selects text on any page:

1. **Instant detection** — selection changes are captured (debounced ~120 ms) and validated (non-empty, contains letters, within the length limit).
2. **Instant meaning popup** — a lightweight popup appears anchored below the selection (above it when space runs out), showing the translation, optional dictionary suggestions with parts of speech, and romanization when available.
3. **Automatic pronunciation** — the selected text starts being spoken immediately via text-to-speech. A speaker button in the popup replays/stops it; `Esc` or clicking away dismisses everything.

Additional behavior:

- **Voice master switch** — the "Automatic speech" setting silences all pronunciation in one click; the speaker button hides and translation keeps working.
- Works on **single words and full paragraphs** (long selections are trimmed to a configurable limit).
- **Automatic language detection** for the source — any Google Translate–supported language is translated to the configured target (Bangla by default).
- Selecting text that is **already in the target language** is detected and noted instead of "translated".
- **30-entry translation cache** makes re-selecting recent text instantaneous.
- Popup follows scroll/resize, respects light/dark/system themes, and is fully isolated from page CSS via a **closed Shadow DOM**.

## 2. Key features

- Zero-interaction translation + pronunciation on text selection (both on by default).
- 100+ target languages with native-script names in the picker (Bangla leads the list).
- Voice picker fed by the OS speech voices, with "Automatic (match language)" as default.
- Pronounce the **original text** or the **translated meaning** — user's choice.
- Adjustable speech rate (0.5×–2×) with a live **Test** button.
- Dictionary suggestions (parts of speech + alternative meanings) for single words.
- Toolbar popup with three quick toggles — translation, pronunciation, and a master voice switch that silences all speech.
- Full options page with auto-save (no save button needed).
- Site exclusion list (subdomains included) for pages where the popup should stay off.
- Professional, non-intrusive UI: shadow-DOM isolated, `prefers-reduced-motion` aware, keyboard accessible.

## 3. Tech stack

| Layer | Technology |
| --- | --- |
| Platform | Firefox: WebExtension **Manifest V2** (`strict_min_version` 109) · Chrome: **Manifest V3** service worker (`minimum_chrome_version` 99) |
| Language | Vanilla **JavaScript** (ES2020+ — modules, async/await, optional chaining, Unicode property escapes). **No build step, no bundler, no runtime dependencies** |
| UI | Hand-written **HTML + CSS** (system font stack incl. Noto Sans Bengali), **Shadow DOM** with **constructable stylesheets** and a `<style>` fallback for older engines |
| Text-to-speech | **Web Speech API** (`speechSynthesis`, `SpeechSynthesisUtterance`) — voices provided by the operating system |
| Translation | Google Translate public `translate_a/single` endpoint (no API key) via the background script, with a fallback host and 8 s timeout |
| Messaging | `runtime.sendMessage` / `onMessage` (content → background translation proxy) |
| Settings | `browser.storage.sync` with automatic `storage.local` fallback, shared facade (`LLSettings`) across all contexts |
| Icons | Generated PNGs — `tools/make-icons.mjs` (dependency-free SDF renderer with zlib PNG encoding) and `tools/square-icon.ps1` (GDI+ canvas normalizer) |
| Validation | Mozilla **addons-linter** (0 errors / 0 notices at submission state), `node --check` on every JS file |

### Why these choices

- **No frameworks**: content scripts must stay tiny and fast; the whole runtime footprint is ~30 KB of JS.
- **MV2 over MV3**: Firefox continues to fully support MV2; it also allows non-persistent event pages and simpler host-permission semantics for this use case.
- **Background translation proxy**: content scripts inherit page CORS rules, so network calls happen in the background script where the `translate.googleapis.com` / `clients5.google.com` host permissions apply.
- **Closed shadow root**: host pages cannot read, restyle, or break the popup; page CSP cannot block constructable stylesheets.

## 4. Project structure

```
firefox/                          ← repository root (this README)
├── README.md                    ← you are here — full project documentation
├── firefox_plugin/              ← everything Firefox-related
│   ├── lingolearn-lens/             ← THE ADD-ON (this is what you load/ship)
│   │   ├── manifest.json        ← MV2 manifest: permissions, scripts, icons
│   │   ├── icons/               ← ANSNEW TECH. logo — icon-48/96/128.png
│   │   ├── common/
│   │   │   └── settings.js      ← defaults, normalization, LLSettings facade (all contexts)
│   │   ├── background/
│   │   │   └── background.js    ← translation service: fetch, parse, fallback, timeout
│   │   ├── content/
│   │   │   ├── content.js       ← selection watcher, state machine, TTS coordination
│   │   │   ├── popup-ui.js      ← LingoLearnPopup view class (closed shadow root)
│   │   │   └── styles.js        ← popup CSS as a JS string (CSP-proof injection)
│   │   ├── options/
│   │   │   ├── options.html/css ← full settings page
│   │   │   └── options.js       ← language/voice pickers, auto-save, reset, test speech
│   │   ├── action/
│   │   │   ├── popup.html/css   ← toolbar quick-toggle popup
│   │   │   └── popup.js         ← two switches + status + link to options
│   │   ├── README.md            ← add-on specific readme (shipped in the zip)
│   │   └── LICENSE              ← MIT (ANSNEW TECH.)
│   ├── lingolearn-lens-1.0.2.zip    ← ready-to-upload AMO package
│   ├── preview/
│   │   └── popup-preview.html   ← dev page: render popup states w/o loading the add-on
│   ├── test-page.html           ← sample content (words/sentences/multi-language)
│   └── tools/
│       ├── make-icons.mjs       ← programmatic icon generator (Node, no deps)
│       └── square-icon.ps1      ← pads a logo onto a square canvas (GDI+)
└── chrome_plugin/               ← the Chrome port (Manifest V3)
    ├── lingolearn-lens/             ← THE EXTENSION (load unpacked / ship to CWS)
    │   ├── manifest.json        ← MV3 manifest: service worker, action, host_permissions
    │   ├── background/background.js ← same translation service; importScripts + sendResponse
    │   └── common|content|options|action|icons ← byte-identical to the Firefox build
    ├── lingolearn-lens-1.0.2.zip    ← ready-to-upload Chrome Web Store package
    ├── preview/popup-preview.html
    └── test-page.html
```

## 5. Architecture & data flow

```
┌──────────────────────────── page (per tab, all frames) ────────────────────────────┐
│  content.js (controller)                                                           │
│   selectionchange / mouseup / touchend  →  debounced runCheck()                    │
│   ├─ filters: enabled? excluded site? non-collapsed? has letters? length cap      │
│   ├─ popup-ui.js : showLoading(rect)          (LingoLearnPopup, closed shadow root)   │
│   ├─ tts.speak(text)  ← starts IMMEDIATELY on selection (auto pronunciation)      │
│   └─ runtime.sendMessage {type:"ll:translate", text, target} ──┐  (cache hit skips)│
└─────────────────────────────────────────────────────────────────│──────────────────┘
                                                                  ▼
┌──────────────────────── background (event page, non-persistent) ───────────────────┐
│  background.js: LL_translate(text, target)                                         │
│   GET translate_a/single?client=gtx&sl=auto&tl=<target>&dt=t&dt=bd&dt=rm&dj=1     │
│   ├─ primary: translate.googleapis.com   fallback: clients5.google.com            │
│   ├─ AbortController timeout 8 s; credentials omitted; no-store                   │
│   └─ parses dj=1 object form AND legacy array form                                 │
│       → { translation, romanization, dictionary[], detectedLanguage }              │
└────────────────────────────────────────────│───────────────────────────────────────┘
                                             ▼ back to content.js
   renderResult(): popup shows meaning + dictionary + notes
   tts.revoice(detected) upgrades to a language-matched voice if one exists
```

**State handling**: every dismissal/selection bumps a token; stale async replies are dropped, so fast re-selection can never render into the wrong popup. Settings changes propagate live through `storage.onChanged`.

### Voice resolution order (`tts.resolveVoice`)

1. Voice explicitly chosen in settings (`voiceURI`) — always wins if installed.
2. Auto-match: exact BCP-47 prefix match on detected/target language, then 2-letter fallback.
3. BCP-47 hint map for codes without a direct voice (`bn→bn-IN`, `zh→zh-CN`, …).
4. Browser default voice.

## 6. Settings reference

All settings live in `storage.sync` (local fallback) under the key `settings`, are normalized on read/write, and save automatically from the options page (300 ms debounce, toast confirmation).

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `autoTranslate` | bool | `true` | Master switch — show popup on selection |
| `targetLanguage` | code | `"bn"` | Meaning language (107 options, validated against the whitelist) |
| `autoSpeak` | bool | `true` | Start pronunciation immediately on selection |
| `speechEnabled` | bool | `true` | Master switch for all voice output — off = fully silent (speaker button hidden) |
| `speakTarget` | enum | `"source"` | `"source"` = read selection, `"translation"` = read the meaning |
| `voiceURI` | string | `""` | Pinned speech voice; empty = automatic language matching |
| `speechRate` | number | `1` | 0.5–2, clamped |
| `showDictionary` | bool | `true` | Parts of speech + alternative meanings for words |
| `popupTheme` | enum | `"auto"` | `auto` / `light` / `dark` |
| `maxSelectionLength` | int | `600` | 50–1500 chars; longer selections trimmed with a note |
| `excludedSites` | string[] | `[]` | Domains where the popup stays off (subdomains included) |

## 7. Install & run

### Firefox (temporary install)

1. Open `about:debugging#/runtime/this-firefox`
2. **Load Temporary Add-on…** → pick `firefox_plugin/lingolearn-lens/manifest.json`
3. Select text on any website. (Temporary installs last until Firefox restarts.)

### Chrome (unpacked)

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top-right toggle)
3. **Load unpacked** → pick the `chrome_plugin/lingolearn-lens` folder

### Development with auto-reload

```bash
npx web-ext run --source-dir firefox_plugin/lingolearn-lens
```

(In Chrome, edit files and click the reload ↻ icon on the extension card in `chrome://extensions`.)

### Test content

- `firefox_plugin/test-page.html` and `chrome_plugin/test-page.html` — words, sentences, paragraphs, French/Spanish/Arabic/Hindi/Japanese samples. Content scripts don't run on `file://` pages, so serve the folder over HTTP (`npx http-server firefox_plugin`) or test on a real site.
- `preview/popup-preview.html` in either plugin folder — renders every popup state (loading / word / sentence / already-target / error / dark) without loading the add-on.

## 8. Build & package

The shipped packages are `firefox_plugin/lingolearn-lens-1.0.2.zip` and `chrome_plugin/lingolearn-lens-1.0.2.zip`. To rebuild after changes (Windows bsdtar keeps forward-slash entry names, which AMO and the Chrome Web Store prefer):

```bash
cd firefox_plugin
tar -a -c -f lingolearn-lens-1.0.2.zip -C lingolearn-lens manifest.json icons common content background options action LICENSE README.md

cd ../chrome_plugin
tar -a -c -f lingolearn-lens-1.0.2.zip -C lingolearn-lens manifest.json icons common content background options action LICENSE README.md
```

Validate before shipping — the bar is 0 errors:

```bash
npx addons-linter firefox_plugin/lingolearn-lens
```

Bump `version` in both `manifest.json` files for every store submission.

## 9. Privacy

Only the text a user explicitly selects is sent to Google Translate's public endpoint to produce the meaning — nothing else leaves the browser. No analytics, no tracking, no accounts. All settings are stored locally in the browser (`storage.sync`). Branding links to https://inside.ansnew.com/ open only when clicked.

## 10. Troubleshooting

| Symptom | Fix |
| --- | --- |
| No sound | Firefox uses OS voices. Install voices under *Windows Settings → Time & language → Speech*. For "pronounce the translated meaning" in a non-Latin language, install a voice for it or pin one in **Voice**. |
| Voice list empty / new voice missing | Voices are read when the options page opens; reopen it (or restart Firefox) after installing voices. |
| Popup never appears | Check the toolbar toggles and the excluded-sites list; verify `about:debugging` still shows the add-on loaded. |
| "Pronunciation is not available in this browser" | Web Speech API unavailable in that frame — translation popup still works. |
| Translation errors on select | Usually network/rate limiting; the popup shows the exact error and retries on the next selection. |

## 11. Roadmap ideas

- Offline dictionary mode for common words.
- Right-click context-menu translate as a secondary trigger.
- Per-site target language overrides.

## 12. Credits & license

Built by **ANSNEW TECH.** — https://inside.ansnew.com/

MIT License — see `firefox_plugin/lingolearn-lens/LICENSE`. Translation by Google Translate's public endpoint; pronunciation by the operating system's speech voices via the Web Speech API.

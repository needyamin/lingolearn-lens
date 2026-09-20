# LingoLearn Lens — Instant Bangla Meanings (Chrome extension)

Select any text on any web page: LingoLearn Lens instantly shows the **Bangla meaning** in a small popup near the selection **and starts reading the text aloud** — no extra clicks. Both automatic behaviors are on by default.

This is the Chrome port of the Firefox add-on (`firefox_plugin/lingolearn-lens`) — same features, UI, settings and behavior, packaged as a **Manifest V3** extension.

**A product of [ANSNEW TECH.](https://inside.ansnew.com/)**

## Features

- **Instant popup** — appears right next to the selection (shadow DOM, isolated styles, z-index capped, never affected by page CSS).
- **Any language → Bangla** — source language is auto-detected; supports single words and full sentences/paragraphs (long selections are trimmed to a configurable limit).
- **Dictionary view** — for single words, parts of speech with alternative Bangla meanings.
- **Automatic pronunciation** — the selected text is spoken as soon as you select it (via the Web Speech API; no button click needed). The popup speaker button replays it, and clicking it while speaking stops playback.
- **Fast & lightweight** — debounced selection checks, a 30-entry translation cache for instant re-shows, and a closed shadow root so pages can't interfere.
- **Light / dark / system theme**, **excluded sites**, configurable speech rate and voice target.
- **Options page** (`chrome://extensions → LingoLearn Lens → Details → Extension options`) for full settings, plus a **toolbar popup** with three quick toggles (translation, pronunciation, voice).

## Install (unpacked, works in any Chrome/Edge/Brave)

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top-right toggle)
3. Click **Load unpacked** and choose the `lingolearn-lens` folder

The unpacked install persists across browser restarts; settings persist too.

## Development

- `../test-page.html` — sample page with words, sentences and several languages. Content scripts don't run on `file://` pages, so serve the folder over HTTP (e.g. `npx http-server`) or test on any real website.
- `../preview/popup-preview.html` — renders the popup states (loading / result / error / dark) without loading the extension; open it directly in a browser.
- After editing files, click the **reload** ↻ icon on the LingoLearn Lens card in `chrome://extensions`.

## Build for the Chrome Web Store

`chrome_plugin/lingolearn-lens-1.0.2.zip` is ready to upload. To rebuild after changes (run from the `chrome_plugin` directory):

```bash
cd chrome_plugin
tar -a -c -f lingolearn-lens-1.0.2.zip -C lingolearn-lens manifest.json icons common content background options action LICENSE README.md
```

The extension uses **Manifest V3** with a background service worker — the format the Chrome Web Store requires.

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| Automatic Bangla translation | **On** | Master switch for the popup on text selection |
| Translate to | Bangla | Language the meaning is shown in — any Google Translate–supported language |
| Automatic pronunciation | **On** | Starts reading the text as soon as it is selected |
| Automatic speech | **On** | Master voice switch — turn off to silence all pronunciation; the popup still translates |
| Pronounce | Selected text | Read the original selection, or the translated meaning instead |
| Voice | Automatic | Pronunciation voice from your operating system; “Automatic” matches the detected language |
| Speech rate | 1.00× | Playback speed (0.5×–2×) |
| Dictionary suggestions | On | Alternative meanings for single words |
| Popup theme | Match system | Light / dark / follow Chrome |
| Longest selection to translate | 600 chars | Longer selections are trimmed |
| Excluded sites | empty | Domains where the popup stays off (subdomains included) |

## How it works

- `content/content.js` — selection watcher (`selectionchange` + `mouseup`, debounced ~120 ms), state machine for the popup, TTS coordination.
- `content/popup-ui.js` + `content/styles.js` — the popup view, rendered in a closed shadow root with constructable stylesheets (page CSP-proof).
- `background/background.js` — translation via Google Translate's public `translate_a/single` endpoint (no API key, auto language detection), primary host + fallback host, 8 s timeout. Runs as an MV3 **service worker**; it loads `common/settings.js` via `importScripts` and answers messages through `sendResponse`.
- `common/settings.js` — defaults, normalization, and `storage.sync` (with local fallback) shared by every context.

### Differences from the Firefox build

Only what Chrome's Manifest V3 requires — everything else is byte-identical:

- `manifest.json`: MV3 (`background.service_worker` instead of background scripts, `action` instead of `browser_action`, host permissions under `host_permissions`, no Gecko-specific keys, `minimum_chrome_version: 99` for promise-based messaging).
- `background/background.js`: loads the settings layer with `importScripts`, and replies to messages via `sendResponse` + `return true` (Chrome ignores promises returned from `onMessage` listeners, unlike Firefox).

## Privacy

Only the text you select is sent to Google Translate to produce the Bangla meaning. Nothing else is collected or stored; settings live in Chrome's own `storage.sync`.

## Troubleshooting

- **No sound** — Chrome uses your operating system's voices. Check *Windows Settings → Time & language → Speech → Manage voices* and install a voice for the language you select. When “Pronounce: translated meaning” is used with a non-Latin target language, install a voice for that language too, or pick one explicitly in the **Voice** setting.
- **Voice list is empty or missing a newly installed voice** — voices are read from the OS when the settings page opens; reopen the settings page (or restart Chrome) after installing new voices.
- **Popup never appears** — check the toolbar toggles (all switches) and the excluded-sites list in the options page. Also make sure the site isn't restricted under `chrome://extensions → LingoLearn Lens → Details → Site access`.
- **"Could not reach the translation service"** — the background service worker needs network access to `translate.googleapis.com` (corporate proxies/VPN filters can block it).
- **"Pronunciation is not available in this browser"** — the Web Speech API is unavailable in that frame; the translation popup still works.

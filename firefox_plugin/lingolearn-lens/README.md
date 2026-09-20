# LingoLearn Lens — Instant Bangla Meanings (Firefox add-on)

Select any text on any web page: LingoLearn Lens instantly shows the **Bangla meaning** in a small popup near the selection **and starts reading the text aloud** — no extra clicks. Both automatic behaviors are on by default.

**A product of [ANSNEW TECH.](https://inside.ansnew.com/)**

## Features

- **Instant popup** — appears right next to the selection (shadow DOM, isolated styles, z-index capped, never affected by page CSS).
- **Any language → Bangla** — source language is auto-detected; supports single words and full sentences/paragraphs (long selections are trimmed to a configurable limit).
- **Dictionary view** — for single words, parts of speech with alternative Bangla meanings.
- **Automatic pronunciation** — the selected text is spoken as soon as you select it (via the Web Speech API; no button click needed). The popup speaker button replays it, and clicking it while speaking stops playback.
- **Fast & lightweight** — debounced selection checks, a 30-entry translation cache for instant re-shows, and a closed shadow root so pages can't interfere.
- **Light / dark / system theme**, **excluded sites**, configurable speech rate and voice target.
- **Options page** (`about:addons → LingoLearn Lens → Options`) for full settings, plus a **toolbar popup** with three quick toggles (translation, pronunciation, voice).

## Install (temporary, works in any Firefox)

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Choose `lingolearn-lens/manifest.json`

The temporary install lasts until Firefox restarts; settings persist.

## Development

```bash
# run with auto-reload (requires a Firefox install)
npx web-ext run --source-dir lingolearn-lens

# lint against AMO rules
npx addons-linter lingolearn-lens
```

- `test-page.html` — sample page with words, sentences and several languages. Content scripts don't run on `file://` pages by default, so serve the folder over HTTP (e.g. `npx http-server`) or test on any real website.
- `preview/popup-preview.html` — renders the popup states (loading / result / error / dark) without loading the extension; open it directly in a browser.

## Build for AMO

`firefox_plugin/lingolearn-lens-1.0.2.zip` is ready to upload. To rebuild after changes (run from the repository root):

```bash
cd firefox_plugin
tar -a -c -f lingolearn-lens-1.0.2.zip -C lingolearn-lens manifest.json icons common content background options action LICENSE README.md
```

The add-on uses Manifest V2 — still fully supported by Firefox and accepted on addons.mozilla.org.

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
| Popup theme | Match system | Light / dark / follow Firefox |
| Longest selection to translate | 600 chars | Longer selections are trimmed |
| Excluded sites | empty | Domains where the popup stays off (subdomains included) |

## How it works

- `content/content.js` — selection watcher (`selectionchange` + `mouseup`, debounced ~120 ms), state machine for the popup, TTS coordination.
- `content/popup-ui.js` + `content/styles.js` — the popup view, rendered in a closed shadow root with constructable stylesheets (page CSP-proof).
- `background/background.js` — translation via Google Translate's public `translate_a/single` endpoint (no API key, auto language detection), primary host + fallback host, 8 s timeout.
- `common/settings.js` — defaults, normalization, and `storage.sync` (with local fallback) shared by every context.

## Privacy

Only the text you select is sent to Google Translate to produce the Bangla meaning. Nothing else is collected or stored; settings live in Firefox's own `storage.sync`.

## Troubleshooting

- **No sound** — Firefox uses your operating system's voices. Check *Windows Settings → Time & language → Speech → Manage voices* and install a voice for the language you select. When “Pronounce: translated meaning” is used with a non-Latin target language, install a voice for that language too, or pick one explicitly in the **Voice** setting.
- **Voice list is empty or missing a newly installed voice** — voices are read from the OS when the settings page opens; reopen the settings page (or restart Firefox) after installing new voices.
- **Popup never appears** — check the toolbar toggles (all switches) and the excluded-sites list in the options page.
- **"Pronunciation is not available in this browser"** — the Web Speech API is unavailable in that frame; the translation popup still works.

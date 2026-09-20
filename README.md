# LingoLearn Lens — Instant Meanings & Pronunciation

A browser extension by [ANSNEW TECH.](https://inside.ansnew.com/). Firefox add-on and Chrome extension with identical features and UI.

Select any text on a page: LingoLearn Lens shows its translation in a popup next to the selection and reads it aloud automatically. The source language is auto-detected; the target defaults to Bangla and can be switched to any of 100+ languages in settings.

## Features

- Instant translation popup next to the selection (isolated from page CSS via shadow DOM)
- Automatic pronunciation via the Web Speech API, with a master voice switch
- Dictionary suggestions and romanization for single words
- Toolbar popup with three quick toggles: translation, pronunciation, voice
- Options page: target language, voice, speech rate, theme, excluded sites, selection length limit
- Light / dark / system theme; translation cache for instant re-shows

## Project structure

```
firefox_plugin/lingolearn-lens/    Firefox add-on (Manifest V2)
chrome_plugin/lingolearn-lens/     Chrome extension (Manifest V3)
firefox_plugin/lingolearn-lens-1.0.3.zip   ready-to-upload AMO package
chrome_plugin/lingolearn-lens-1.0.3.zip    ready-to-upload Chrome Web Store package
*/preview/popup-preview.html       popup states without loading the extension
*/test-page.html                   sample content for testing
```

Shared code (content scripts, popup UI, options, settings) is identical in both builds. Only the manifest and background script differ, as required by Chrome's Manifest V3.

## Install

- **Firefox**: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `firefox_plugin/lingolearn-lens/manifest.json`
- **Chrome**: `chrome://extensions` → Developer mode → Load unpacked → `chrome_plugin/lingolearn-lens`

## Build

```bash
cd firefox_plugin   # or chrome_plugin
tar -a -c -f lingolearn-lens-1.0.3.zip -C lingolearn-lens manifest.json icons common content background options action LICENSE README.md
```

Bump `version` in both manifests for every store submission.

## Privacy

Only the text you select is sent to Google Translate's public endpoint. No analytics, no tracking; settings stay in the browser's own storage.

## License

MIT — see `firefox_plugin/lingolearn-lens/LICENSE`.

# LingoLearn Lens (Chrome extension)

Select any text on a page: LingoLearn Lens shows its translation in a popup next to the selection and reads it aloud automatically. Source language is auto-detected; the target defaults to Bangla and can be switched to any of 100+ languages in settings.

Chrome port of the Firefox add-on — same features, UI, and settings, packaged as Manifest V3 (background service worker; translation hosts under `host_permissions`).

By [ANSNEW TECH.](https://inside.ansnew.com/)

## Features

- Instant translation popup (dictionary suggestions and romanization for single words)
- Automatic pronunciation; toolbar popup with three toggles: translation, pronunciation, voice
- Options page: target language, voice, speech rate, theme, excluded sites, selection limit
- Light / dark / system theme

## Install

1. Open `chrome://extensions`
2. Enable Developer mode → Load unpacked → this folder

## Build

Run from the `chrome_plugin` folder:

```bash
tar -a -c -f lingolearn-lens-1.0.3.zip -C lingolearn-lens manifest.json icons common content background options action LICENSE README.md
```

## Privacy

Only the text you select is sent to Google Translate. No analytics, no tracking.

## License

MIT — see `LICENSE`.

# LingoLearn Lens (Firefox add-on)

Select any text on a page: LingoLearn Lens shows its translation in a popup next to the selection and reads it aloud automatically. Source language is auto-detected; the target defaults to Bangla and can be switched to any of 100+ languages in settings.

By [ANSNEW TECH.](https://inside.ansnew.com/)

## Features

- Instant translation popup (dictionary suggestions and romanization for single words)
- Automatic pronunciation; toolbar popup with three toggles: translation, pronunciation, voice
- Options page: target language, voice, speech rate, theme, excluded sites, selection limit
- Light / dark / system theme

## Install

1. Open `about:debugging#/runtime/this-firefox`
2. Load Temporary Add-on → `manifest.json`

Temporary installs last until Firefox restarts; settings persist.

## Build

Run from the `firefox_plugin` folder:

```bash
tar -a -c -f lingolearn-lens-1.0.2.zip -C lingolearn-lens manifest.json icons common content background options action LICENSE README.md
```

## Privacy

Only the text you select is sent to Google Translate. No analytics, no tracking.

## License

MIT — see `LICENSE`.

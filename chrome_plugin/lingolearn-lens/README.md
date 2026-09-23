# LingoLearn BN (Chrome extension)

Select any text on a page: LingoLearn BN shows its Bangla meaning in a popup next to the selection and reads it aloud automatically. Source language is auto-detected; meanings are looked up fully offline in dictionaries bundled with the extension, and single Bangla words get English glosses.

Chrome port of the Firefox add-on — same features, UI, and settings, packaged as Manifest V3 (background service worker; fully offline, no host permissions).

By [ANSNEW TECH.](https://inside.ansnew.com/)

## Features

- Instant meaning popup (dictionary suggestions and IPA pronunciation for single words)
- Fully offline: English→Bangla meanings from bundled dictionaries, English pronunciation from cmudict - no network access
- Automatic pronunciation; toolbar popup with three toggles: translation, pronunciation, voice
- Footer "Google Translate" button: opens the selected text on translate.google.com in a new tab (online, and only when you click it)
- Options page: target language, voice, speech rate, theme, excluded sites, selection limit
- Light / dark / system theme

## Install

1. Open `chrome://extensions`
2. Enable Developer mode → Load unpacked → this folder

## Build

Run from the `chrome_plugin` folder:

```bash
python - <<'PY'  # (excludes tools/)
import os, zipfile
with zipfile.ZipFile("lingolearn-lens-1.1.4.zip", "w", zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk("lingolearn-lens"):
        dirs[:] = [d for d in dirs if d != "tools"]
        for name in sorted(files):
            p = os.path.join(root, name)
            z.write(p, os.path.relpath(p, "lingolearn-lens"))
PY
```

## Privacy

All meaning lookups are local: they come from dictionaries bundled with the extension, and the extension makes no network requests of its own. The only outbound action is the optional "Google Translate" footer button, which opens the selected text on translate.google.com in a new tab only when you click it - your browser performs that navigation, so the extension sends nothing automatically. No analytics, no tracking.

## License

MIT — see `LICENSE`.

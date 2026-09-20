"use strict";

/*
 * LingoLearn Lens — shared settings layer.
 *
 * Loaded in every extension context (content scripts, background event page,
 * options page, toolbar popup). Defines the defaults, a normalizer that keeps
 * stored values sane, and the LLSettings facade over browser.storage with a
 * sync -> local fallback.
 */

const LL_DEFAULT_SETTINGS = Object.freeze({
  autoTranslate: true,      // master switch: popup on text selection
  speechEnabled: true,      // master switch for ALL voice output; off = fully silent
  autoSpeak: true,          // start pronunciation as soon as text is selected (needs speechEnabled)
  speakTarget: "source",    // "source" = read the selected text, "translation" = read the translated meaning
  speechRate: 1,            // 0.5 – 2
  showDictionary: true,     // alternative meanings for single words
  popupTheme: "auto",       // "auto" | "light" | "dark"
  excludedSites: [],        // ["example.com", "*.wikipedia.org"]
  maxSelectionLength: 600,  // characters sent for translation
  targetLanguage: "bn",     // code from LL_TARGET_LANGUAGES
  voiceURI: "",             // speechSynthesis voiceURI; "" = auto-match the detected language
});

/**
 * Languages the meaning can be shown in (Google Translate codes -> English
 * names). Also used by the background script to validate requests.
 */
const LL_TARGET_LANGUAGES = {
  af: "Afrikaans", sq: "Albanian", am: "Amharic", ar: "Arabic", hy: "Armenian",
  az: "Azerbaijani", eu: "Basque", be: "Belarusian", bn: "Bangla", bs: "Bosnian",
  bg: "Bulgarian", ca: "Catalan", ceb: "Cebuano", zh: "Chinese (Simplified)",
  "zh-TW": "Chinese (Traditional)", co: "Corsican", hr: "Croatian", cs: "Czech",
  da: "Danish", nl: "Dutch", en: "English", eo: "Esperanto", et: "Estonian",
  tl: "Filipino", fi: "Finnish", fr: "French", fy: "Frisian", gl: "Galician",
  ka: "Georgian", de: "German", el: "Greek", gu: "Gujarati", ht: "Haitian Creole",
  ha: "Hausa", haw: "Hawaiian", he: "Hebrew", hi: "Hindi", hmn: "Hmong",
  hu: "Hungarian", is: "Icelandic", id: "Indonesian", ga: "Irish", it: "Italian",
  ja: "Japanese", jv: "Javanese", kn: "Kannada", kk: "Kazakh", km: "Khmer",
  rw: "Kinyarwanda", ko: "Korean", ku: "Kurdish", ky: "Kyrgyz", lo: "Lao",
  la: "Latin", lv: "Latvian", lt: "Lithuanian", lb: "Luxembourgish",
  mk: "Macedonian", mg: "Malagasy", ms: "Malay", ml: "Malayalam", mt: "Maltese",
  mi: "Maori", mr: "Marathi", mn: "Mongolian", my: "Myanmar (Burmese)",
  ne: "Nepali", no: "Norwegian", or: "Odia (Oriya)", ps: "Pashto", fa: "Persian",
  pl: "Polish", pt: "Portuguese", pa: "Punjabi", ro: "Romanian", ru: "Russian",
  sm: "Samoan", gd: "Scots Gaelic", sr: "Serbian", st: "Sesotho", sn: "Shona",
  sd: "Sindhi", si: "Sinhala", sk: "Slovak", sl: "Slovenian", so: "Somali",
  es: "Spanish", su: "Sundanese", sw: "Swahili", sv: "Swedish", tg: "Tajik",
  ta: "Tamil", tt: "Tatar", te: "Telugu", th: "Thai", tr: "Turkish",
  tk: "Turkmen", uk: "Ukrainian", ur: "Urdu", ug: "Uyghur", uz: "Uzbek",
  vi: "Vietnamese", cy: "Welsh", xh: "Xhosa", yi: "Yiddish", yo: "Yoruba",
  zu: "Zulu",
};

/** Native-script names for common targets; falls back to the English name. */
const LL_TARGET_NATIVE_NAMES = {
  bn: "বাংলা", hi: "हिन्दी", ar: "العربية", ur: "اردو", fa: "فارسی",
  he: "עברית", el: "Ελληνικά", ru: "Русский", uk: "Українська", sr: "Српски",
  mk: "Македонски", be: "Беларуская", bg: "Български", ka: "ქართული",
  hy: "Հայերեն", zh: "中文", "zh-TW": "中文（繁體）", ja: "日本語", ko: "한국어",
  th: "ไทย", km: "ខ្មែរ", lo: "ລາວ", my: "မြန်မာ", si: "සිංහල", ne: "नेपाली",
  ta: "தமிழ்", te: "తెలుగు", kn: "ಕನ್ನಡ", ml: "മലയാളം", mr: "मराठी",
  gu: "ગુજરાતી", pa: "ਪੰਜਾਬੀ", es: "Español", fr: "Français", de: "Deutsch",
  it: "Italiano", pt: "Português", nl: "Nederlands", sv: "Svenska",
  tr: "Türkçe", vi: "Tiếng Việt", id: "Bahasa Indonesia", ms: "Bahasa Melayu",
  en: "English",
};

const LL_STORAGE_KEY = "settings";

const llApi =
  typeof globalThis.browser !== "undefined" ? globalThis.browser :
  typeof globalThis.chrome !== "undefined" ? globalThis.chrome :
  null;

function LL_normalizeSettings(raw) {
  const out = { ...LL_DEFAULT_SETTINGS };
  if (!raw || typeof raw !== "object") return out;

  for (const key of ["autoTranslate", "speechEnabled", "autoSpeak", "showDictionary"]) {
    if (typeof raw[key] === "boolean") out[key] = raw[key];
  }
  if (raw.speakTarget === "translation" || raw.speakTarget === "source") {
    out.speakTarget = raw.speakTarget;
  }
  if (typeof raw.speechRate === "number" && Number.isFinite(raw.speechRate)) {
    out.speechRate = Math.min(2, Math.max(0.5, raw.speechRate));
  }
  if (["auto", "light", "dark"].includes(raw.popupTheme)) {
    out.popupTheme = raw.popupTheme;
  }
  if (Array.isArray(raw.excludedSites)) {
    out.excludedSites = raw.excludedSites
      .map((site) => String(site).trim().toLowerCase().replace(/^\*\./, ""))
      .filter(Boolean)
      .slice(0, 100);
  }
  if (Number.isInteger(raw.maxSelectionLength)) {
    out.maxSelectionLength = Math.min(1500, Math.max(50, raw.maxSelectionLength));
  }
  if (typeof raw.targetLanguage === "string" && LL_TARGET_LANGUAGES[raw.targetLanguage]) {
    out.targetLanguage = raw.targetLanguage;
  }
  if (typeof raw.voiceURI === "string") {
    out.voiceURI = raw.voiceURI.slice(0, 300);
  }
  return out;
}

async function LL_readStoredSettings() {
  if (!llApi || !llApi.storage) return {};
  try {
    const stored = await llApi.storage.sync.get({ [LL_STORAGE_KEY]: {} });
    return stored[LL_STORAGE_KEY] || {};
  } catch (syncFailed) {
    try {
      const stored = await llApi.storage.local.get({ [LL_STORAGE_KEY]: {} });
      return stored[LL_STORAGE_KEY] || {};
    } catch (localFailed) {
      return {};
    }
  }
}

const LLSettings = {
  async load() {
    return LL_normalizeSettings(await LL_readStoredSettings());
  },

  /** Merges a partial update on top of the stored settings and persists it. */
  async save(partial) {
    const merged = { ...(await LL_readStoredSettings()), ...(partial || {}) };
    const clean = LL_normalizeSettings(merged);
    if (llApi && llApi.storage) {
      try {
        await llApi.storage.sync.set({ [LL_STORAGE_KEY]: clean });
      } catch (syncFailed) {
        try {
          await llApi.storage.local.set({ [LL_STORAGE_KEY]: clean });
        } catch (localFailed) {
          /* nothing else we can do; keep in-memory value */
        }
      }
    }
    return clean;
  },

  /** Registers a listener for settings changes; returns an unsubscribe fn. */
  onChange(callback) {
    if (!llApi || !llApi.storage || !llApi.storage.onChanged) return () => {};
    const listener = (changes, area) => {
      if (changes[LL_STORAGE_KEY] && changes[LL_STORAGE_KEY].newValue) {
        callback(LL_normalizeSettings(changes[LL_STORAGE_KEY].newValue));
      }
    };
    llApi.storage.onChanged.addListener(listener);
    return () => llApi.storage.onChanged.removeListener(listener);
  },
};

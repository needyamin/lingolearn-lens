"use strict";

/*
 * LingoLearn Lens — background translation service (Chrome MV3 service worker).
 *
 * The content script cannot fetch cross-origin reliably (it inherits the
 * page's CORS rules), so translation requests are proxied through here where
 * the host permissions apply. Uses Google Translate's public
 * translate_a/single endpoint (no API key), with a fallback host, and parses
 * both the modern (dj=1) and legacy response shapes.
 *
 * Chrome differences from the Firefox build:
 *  - a service worker loads a single script, so the shared settings layer is
 *    pulled in here with importScripts (Firefox lists it in the manifest);
 *  - chrome.runtime.onMessage ignores returned Promises — async replies must
 *    go through sendResponse with `return true` to keep the channel open.
 */

importScripts("../common/settings.js");

const LL_TRANSLATE_ENDPOINTS = [
  "https://translate.googleapis.com/translate_a/single",
  "https://clients5.google.com/translate_a/single",
];

const LL_REQUEST_TIMEOUT_MS = 8000;

llApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "ll:translate" && typeof message.text === "string") {
    const target = LL_TARGET_LANGUAGES[message.target] ? message.target : "bn";
    LL_translate(message.text, target)
      .then(sendResponse)
      .catch((err) => {
        sendResponse({ ok: false, error: String((err && err.message) || err) });
      });
    return true; // keep the message channel open for the async reply
  }
  return undefined;
});

async function LL_translate(text, target) {
  const query = String(text).slice(0, 1500);
  let lastError = "Translation failed.";

  for (const endpoint of LL_TRANSLATE_ENDPOINTS) {
    try {
      const data = await LL_fetchJSON(endpoint, query, target);
      const parsed = LL_parseResult(data);
      if (parsed.translation) return { ok: true, ...parsed };
      lastError = "The translation service returned an empty result.";
    } catch (err) {
      lastError = err && err.message ? err.message : String(err);
    }
  }
  return { ok: false, error: lastError };
}

async function LL_fetchJSON(endpoint, text, target) {
  const url =
    endpoint +
    "?client=gtx&sl=auto" +
    "&tl=" +
    encodeURIComponent(target) +
    "&dt=t&dt=bd&dt=rm&dj=1" +
    "&q=" +
    encodeURIComponent(text);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LL_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      credentials: "omit",
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Translation service error (HTTP ${response.status}).`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function LL_parseResult(data) {
  // dj=1 object form: { sentences: [{trans, orig, src_translit?}], dict: [...], src }
  if (data && !Array.isArray(data)) {
    const sentences = Array.isArray(data.sentences) ? data.sentences : [];
    const translation = sentences.map((s) => s.trans || "").join("").trim();
    const romanization = sentences.map((s) => s.src_translit || s.translit || "").find(Boolean) || "";
    const dictionary = Array.isArray(data.dict)
      ? data.dict.map((d) => ({ pos: d.pos || "", terms: (d.terms || []).slice(0, 4) }))
      : [];
    return { translation, romanization, dictionary, detectedLanguage: data.src || "" };
  }

  // Legacy array form: [ [[trans, orig], ...], dict|true, src, ... ]
  if (Array.isArray(data)) {
    const segments = Array.isArray(data[0]) ? data[0] : [];
    const translation = segments.map((seg) => (Array.isArray(seg) ? seg[0] || "" : "")).join("").trim();
    const dictBlock = Array.isArray(data[1]) ? data[1] : [];
    const dictionary = dictBlock.map((d) => ({
      pos: (d && d[0]) || "",
      terms: ((d && d[1]) || []).slice(0, 4),
    }));
    return {
      translation,
      romanization: "",
      dictionary,
      detectedLanguage: typeof data[2] === "string" ? data[2] : "",
    };
  }

  return { translation: "", romanization: "", dictionary: [], detectedLanguage: "" };
}

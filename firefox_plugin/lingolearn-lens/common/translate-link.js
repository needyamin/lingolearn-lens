"use strict";

/*
 * LingoLearn BN - Google Translate deep link builder.
 *
 * Turns a piece of text plus a target language code into a ready-to-open
 * translate.google.com URL. Pure string logic (the URL API only): no DOM, no
 * fetch, no extension APIs, so it can be loaded standalone - Firefox lists it
 * in background.scripts, Chrome pulls it in with importScripts.
 *
 * The extension itself never opens this link on its own; it is only built when
 * the user clicks the footer button in the popup.
 */

const LL_TRANSLATE_LINK_BASE = "https://translate.google.com/";

/** Google Translate rejects very long query strings; keep well under that. */
const LL_TRANSLATE_TEXT_MAX = 1500;

/** "bn", "pt-BR", "zh-Hant" ... anything else falls back to the target default. */
const LL_TRANSLATE_TARGET_PATTERN = /^[a-z]{2}(-[A-Za-z]{2,4})?$/i;

const LL_TRANSLATE_TARGET_FALLBACK = "bn";

/**
 * Builds an https://translate.google.com/ deep link for the given text.
 * @param {unknown} text - text to translate (truncated to 1500 characters)
 * @param {unknown} target - target language code, e.g. "bn"
 * @returns {string} absolute URL with sl/tl/text/op query parameters
 */
function LL_buildTranslateLink(text, target) {
  const code =
    typeof target === "string" && LL_TRANSLATE_TARGET_PATTERN.test(target)
      ? target
      : LL_TRANSLATE_TARGET_FALLBACK;

  // URLSearchParams.set does the percent-encoding, so &, =, # and spaces in
  // the selected text cannot break out of the query string.
  const url = new URL(LL_TRANSLATE_LINK_BASE);
  url.searchParams.set("sl", "auto");
  url.searchParams.set("tl", code);
  url.searchParams.set("text", String(text).slice(0, LL_TRANSLATE_TEXT_MAX));
  url.searchParams.set("op", "translate");
  return url.toString();
}

globalThis.LLTranslateLink = Object.freeze({ build: LL_buildTranslateLink });

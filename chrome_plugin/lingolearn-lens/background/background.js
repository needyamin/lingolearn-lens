"use strict";

/*
 * LingoLearn BN - background meaning service (Chrome MV3 service worker).
 *
 * Every lookup is answered from the dictionaries bundled with the extension:
 * the chunked E2B store in asset/e2b/ (english -> bangla),
 * bangla_dictionary.txt (extra meanings) and cmudict-0.7b-ipa.txt (IPA
 * pronunciation), parsed by the LLOfflineEngine. The engine is initialized
 * lazily on the first request and no network requests are made.
 *
 * The one online action is user-initiated: "ll:openGoogleTranslate" builds a
 * translate.google.com deep link (common/translate-link.js) and opens it in a
 * new tab when the user clicks the popup's footer button.
 *
 * Chrome differences from the Firefox build:
 *  - a service worker loads a single script, so the shared settings layer,
 *    the offline engine and the deep-link builder are pulled in here with
 *    importScripts (Firefox lists them in the manifest);
 *  - chrome.runtime.onMessage ignores returned Promises - async replies must
 *    go through sendResponse with `return true` to keep the channel open.
 */

importScripts("../common/settings.js");
importScripts("../common/offline-engine.js");
importScripts("../common/translate-link.js");

let llEnginePromise = null;

/** Lazily initialized LLOfflineEngine singleton. */
function getEngine() {
  if (!llEnginePromise) {
    llEnginePromise = LLOfflineEngine.init({
      getAssetURL: (name) => llApi.runtime.getURL("asset/" + name),
    });
  }
  return llEnginePromise;
}

/** Opens the selected text on translate.google.com in a new foreground tab. */
function openGoogleTranslate(message, sendResponse) {
  try {
    const url = LLTranslateLink.build(message.text, message.target);
    llApi.tabs
      .create({ url, active: true })
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        sendResponse({ ok: false, error: String((err && err.message) || err) });
      });
  } catch (err) {
    sendResponse({ ok: false, error: String((err && err.message) || err) });
  }
}

llApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "ll:translate" && typeof message.text === "string") {
    const target = LL_OFFLINE_TARGETS[message.target] ? message.target : "bn";
    getEngine()
      .then((engine) => engine.translate(message.text, target))
      .then(sendResponse)
      .catch((err) => {
        sendResponse({ ok: false, error: String((err && err.message) || err) });
      });
    return true; // keep the message channel open for the async reply
  }
  if (message && message.type === "ll:openGoogleTranslate") {
    openGoogleTranslate(message, sendResponse);
    return true; // the reply arrives after tabs.create() resolves
  }
  return undefined;
});

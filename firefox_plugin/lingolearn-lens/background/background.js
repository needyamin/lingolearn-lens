"use strict";

/*
 * LingoLearn BN - background meaning service (offline).
 *
 * Every lookup is answered from the dictionaries bundled with the extension:
 * the chunked E2B store in asset/e2b/ (english -> bangla),
 * bangla_dictionary.txt (extra meanings) and cmudict-0.7b-ipa.txt (IPA
 * pronunciation), parsed by the LLOfflineEngine in common/offline-engine.js.
 * The engine is initialized lazily on the first request and no network
 * requests are made.
 *
 * The one online action is user-initiated: "ll:openGoogleTranslate" builds a
 * translate.google.com deep link (common/translate-link.js) and opens it in a
 * new tab when the user clicks the popup's footer button.
 */

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
function openGoogleTranslate(message) {
  try {
    const url = LLTranslateLink.build(message.text, message.target);
    return llApi.tabs
      .create({ url, active: true })
      .then(() => ({ ok: true }))
      .catch((err) => ({ ok: false, error: String((err && err.message) || err) }));
  } catch (err) {
    return Promise.resolve({ ok: false, error: String((err && err.message) || err) });
  }
}

llApi.runtime.onMessage.addListener((message) => {
  if (message && message.type === "ll:translate" && typeof message.text === "string") {
    const target = LL_OFFLINE_TARGETS[message.target] ? message.target : "bn";
    return getEngine()
      .then((engine) => engine.translate(message.text, target))
      .catch((err) => ({ ok: false, error: String((err && err.message) || err) }));
  }
  if (message && message.type === "ll:openGoogleTranslate") {
    // Firefox resolves a returned Promise as the reply to sendMessage().
    return openGoogleTranslate(message);
  }
  return undefined;
});

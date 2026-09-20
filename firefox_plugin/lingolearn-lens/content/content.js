"use strict";

/*
 * LingoLearn Lens — selection controller.
 *
 * Watches text selection on the page (selectionchange + mouseup, debounced),
 * shows the LingoLearnPopup anchored to the selection, starts pronunciation via
 * the Web Speech API, and fetches translations through the background script
 * (which owns the network permissions). All state lives in this closure; the
 * host page gets only a single closed shadow root.
 */

(() => {
  if (typeof LingoLearnPopup !== "function" || typeof LLSettings !== "object") return;

  let settings = null;
  let ui = null;
  let currentText = "";
  let lastResult = null;
  let pendingNote = "";
  let token = 0;            // bumps on every dismiss/new selection; stale async work is dropped
  let dismissedText = "";   // last user-dismissed selection; blocks resurrection until a new press
  let debounceTimer = 0;
  let repositionRaf = 0;
  const listeners = [];
  const translationCache = new Map();

  /* ------------------------------------------------------------ TTS ---- */

  const tts = (() => {
    const supported =
      typeof window.speechSynthesis !== "undefined" &&
      typeof window.SpeechSynthesisUtterance !== "undefined";
    let utterance = null;     // utterance currently handed to the engine
    let active = false;       // onstart fired — audio should be audible
    let requested = false;    // speak() called; onstart not confirmed yet
    let requestedAt = 0;
    let startedAt = 0;
    let gen = 0;              // bumps on cancel(); invalidates deferred starts
    let stopTimer = 0;

    // Best BCP-47 tag guesses for two-letter codes without a voice match.
    const LL_BCP47_HINTS = {
      bn: "bn-IN", hi: "hi-IN", ta: "ta-IN", te: "te-IN", ml: "ml-IN",
      mr: "mr-IN", gu: "gu-IN", pa: "pa-IN", kn: "kn-IN", ur: "ur-PK",
      zh: "zh-CN", ko: "ko-KR", ja: "ja-JP", vi: "vi-VN", th: "th-TH",
    };

    function voiceList() {
      try {
        return window.speechSynthesis.getVoices() || [];
      } catch (err) {
        return [];
      }
    }

    function pickVoice(lang) {
      if (!lang) return null;
      const list = voiceList();
      if (!list.length) return null;
      const wanted = String(lang).toLowerCase().replace("_", "-");
      return (
        list.find((v) => v.lang && v.lang.toLowerCase().replace("_", "-").startsWith(wanted)) ||
        list.find((v) => v.lang && v.lang.toLowerCase().replace("_", "-").slice(0, 2) === wanted.slice(0, 2)) ||
        null
      );
    }

    function resolveVoice(lang) {
      // An explicitly chosen voice (settings) wins over language matching.
      const forcedURI = settings && settings.voiceURI;
      if (forcedURI) {
        const forced = voiceList().find((v) => v.voiceURI === forcedURI);
        if (forced) return forced;
      }
      return pickVoice(lang);
    }

    function speak(text, lang) {
      if (!supported || !text) return false;
      cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = Math.min(2, Math.max(0.5, settings ? settings.speechRate : 1));
      u.pitch = 1;
      const voice = resolveVoice(lang);
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
      } else if (lang) {
        u.lang = LL_BCP47_HINTS[lang] || lang;
      }
      u.onstart = () => {
        active = true;
        requested = false;
        if (ui) ui.setSpeaking(true);
      };
      const done = () => {
        requested = false;
        if (u === utterance) {
          active = false;
          if (ui) ui.setSpeaking(false);
        }
      };
      u.onend = done;
      u.onerror = done;

      const myGen = gen;
      requested = true;
      requestedAt = Date.now();
      const start = () => {
        if (myGen !== gen) return; // canceled while waiting to start
        utterance = u;
        startedAt = Date.now();
        try {
          window.speechSynthesis.speak(u);
        } catch (err) {
          requested = false;
        }
      };
      // Engines can drop an utterance requested in the same tick as a
      // cancel(); defer briefly when the engine still reports work in flight.
      let busy = false;
      try {
        busy = window.speechSynthesis.speaking || window.speechSynthesis.pending;
      } catch (err) { /* ignore */ }
      if (busy) setTimeout(start, 60);
      else start();
      return true;
    }

    function cancel() {
      if (!supported) return;
      gen++;
      active = false;
      requested = false;
      utterance = null;
      if (ui) ui.setSpeaking(false);
      // cancel() issued while an utterance is still booting is occasionally
      // ignored by the engine; re-issue it until the engine reports idle.
      clearTimeout(stopTimer);
      const retry = (delay, left) => {
        stopTimer = setTimeout(() => {
          if (utterance !== null) return; // a newer speak() took over
          let busy = false;
          try {
            busy = window.speechSynthesis.speaking || window.speechSynthesis.pending;
          } catch (err) { /* ignore */ }
          if (!busy) return;
          try {
            window.speechSynthesis.cancel();
          } catch (err) { /* ignore */ }
          if (left > 0) retry(350, left - 1);
        }, delay);
      };
      try {
        window.speechSynthesis.cancel();
      } catch (err) { /* ignore */ }
      retry(120, 2);
    }

    function revoice(lang) {
      // Auto-pronunciation starts with the default voice for immediacy; if
      // the detected language has a better-matched voice, restart once.
      if (!supported || !lang || !active || !utterance) return;
      if (utterance.voice || Date.now() - startedAt > 1200) return;
      if (!pickVoice(lang)) return;
      const text = utterance.text;
      speak(text, lang);
    }

    function speaking() {
      if (!supported) return false;
      if (active) return true;
      // An utterance was requested but onstart has not confirmed it yet;
      // count it as speaking so a stop-click cancels instead of queueing a
      // duplicate start. The engine's own state is deliberately ignored here:
      // Firefox can report a stale `speaking` after cancel, which would make
      // the speaker button refuse to start again.
      if (requested && Date.now() - requestedAt < 1500) return true;
      return false;
    }

    if (supported) {
      try {
        window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = () => {}; // warm up the voice list
      } catch (err) {
        /* ignore */
      }
    }

    return { speak, cancel, revoice, speaking, supported };
  })();

  /* ------------------------------------------------------------ boot ---- */

  boot();

  async function boot() {
    settings = await LLSettings.load();
    applyTheme();
    ui = new LingoLearnPopup({
      onSpeak: handleSpeakButton,
      onClose: () => dismiss(true),
    });
    attachListeners();
    ui.setSpeechEnabled(settings.speechEnabled);
    LLSettings.onChange((next) => {
      settings = next;
      applyTheme();
      if (ui) ui.setSpeechEnabled(next.speechEnabled);
      if (!next.speechEnabled) tts.cancel();
      if (!settings.autoTranslate && ui && ui.visible) dismiss();
    });
  }

  function on(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  }

  function attachListeners() {
    on(document, "selectionchange", () => scheduleCheck(120), true);
    // Events from inside the popup are retargeted to the shadow host; never
    // treat them as selection activity, or clicking a popup button would
    // queue a re-check that re-opens the popup right after a dismiss.
    const fromPopup = (event) => Boolean(ui) && event.target === ui.host;
    on(window, "mouseup", (event) => {
      if (!fromPopup(event)) scheduleCheck(0);
    }, true);
    on(window, "touchend", (event) => {
      if (!fromPopup(event)) scheduleCheck(80);
    }, true);
    on(window, "keydown", (event) => {
      if (event.key === "Escape" && ui && ui.visible) dismiss(true);
    }, true);
    // A fresh pointer press means a new selection gesture is starting, so a
    // text suppressed after a manual close may be selected again.
    const forgetDismissal = (event) => {
      if (!fromPopup(event)) dismissedText = "";
    };
    on(window, "mousedown", forgetDismissal, true);
    on(window, "touchstart", forgetDismissal, true);
    on(window, "scroll", onViewportMove, { capture: true, passive: true });
    on(window, "resize", onViewportMove);

    const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const themeHandler = () => {
      if (settings && settings.popupTheme === "auto") applyTheme();
    };
    try {
      darkQuery.addEventListener("change", themeHandler);
      listeners.push(() => darkQuery.removeEventListener("change", themeHandler));
    } catch (err) {
      darkQuery.addListener(themeHandler);
      listeners.push(() => darkQuery.removeListener(themeHandler));
    }
  }

  function applyTheme() {
    if (!ui || !settings) return;
    const dark =
      settings.popupTheme === "dark" ||
      (settings.popupTheme === "auto" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    ui.setTheme(dark ? "dark" : "light");
  }

  /* ------------------------------------------------ selection handling ---- */

  function scheduleCheck(delay) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runCheck, delay);
  }

  function runCheck() {
    if (!settings || !ui) return;
    if (isSiteExcluded()) {
      dismiss();
      return;
    }
    if (!settings.autoTranslate) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      dismiss();
      return;
    }

    let text = sel.toString().replace(/\s+/g, " ").trim();
    if (!text || !/\p{L}/u.test(text)) {
      dismiss();
      return;
    }

    pendingNote = "";
    if (text.length > settings.maxSelectionLength) {
      text = text.slice(0, settings.maxSelectionLength).trim();
      pendingNote = `Only the first ${settings.maxSelectionLength} characters were translated.`;
    }

    const rect = selectionRect(sel);
    if (text === currentText && ui.visible) {
      ui.positionTo(rect);
      return;
    }
    // Just closed by the user (X / Esc): the selection may still be alive and
    // a queued check may fire right after the dismiss. Do not resurrect the
    // same text; a new pointer press clears the suppression.
    if (!ui.visible && text === dismissedText) return;

    currentText = text;
    lastResult = null;
    const myToken = ++token;

    ui.showLoading(rect);
    if (settings.speechEnabled && settings.autoSpeak && settings.speakTarget === "source") {
      tts.speak(text, null);
    }
    void requestTranslation(text, myToken);
  }

  async function requestTranslation(text, myToken) {
    let result = translationCache.get(text);
    if (!result) {
      try {
        result = await llApi.runtime.sendMessage({
          type: "ll:translate",
          text,
          target: settings.targetLanguage,
        });
      } catch (err) {
        if (String((err && err.message) || err).includes("context invalidated")) {
          teardown();
          return;
        }
        result = { ok: false, error: "Could not reach the translation service." };
      }
    }
    if (myToken !== token || !ui) return; // superseded by a newer selection

    if (!result || !result.ok) {
      ui.showError((result && result.error) || "Could not translate the selected text.");
      return;
    }
    translationCache.set(text, result);
    if (translationCache.size > 30) {
      translationCache.delete(translationCache.keys().next().value);
    }
    renderResult(result);
  }

  function renderResult(result) {
    lastResult = result;
    const target = settings.targetLanguage;
    const targetName = LL_TARGET_NATIVE_NAMES[target] || LL_TARGET_LANGUAGES[target] || target;
    const alreadyTarget = result.detectedLanguage === target;

    const notes = [];
    if (pendingNote) notes.push(pendingNote);
    if (alreadyTarget) {
      notes.push(`Selected text is already in ${LL_TARGET_LANGUAGES[target] || target}.`);
    }
    if (settings.autoSpeak && !tts.supported) {
      notes.push("Pronunciation is not available in this browser.");
    }

    ui.showResult(result, {
      showDictionary: settings.showDictionary,
      alreadyTarget,
      targetName,
      note: notes.join(" "),
    });
    repositionSoon();

    if (!settings.speechEnabled || !settings.autoSpeak) return;
    if (settings.speakTarget === "translation") {
      if (!alreadyTarget && result.translation) tts.speak(result.translation, target);
    } else {
      tts.revoice(result.detectedLanguage);
    }
  }

  function handleSpeakButton() {
    if (!settings || !settings.speechEnabled) return;
    if (tts.speaking()) {
      tts.cancel();
      return;
    }
    const target = settings.targetLanguage;
    if (
      settings.speakTarget === "translation" &&
      lastResult && lastResult.translation && lastResult.detectedLanguage !== target
    ) {
      tts.speak(lastResult.translation, target);
    } else if (currentText) {
      tts.speak(currentText, lastResult ? lastResult.detectedLanguage : null);
    }
  }

  /**
   * dismiss(true) is a user-initiated close (X / Esc): also drop the page
   * selection so stale selectionchange / mouseup events cannot re-open the
   * popup, and suppress re-checks of that exact text until the next press.
   */
  function dismiss(clearSelection = false) {
    token++;
    if (clearSelection && currentText) dismissedText = currentText;
    currentText = "";
    lastResult = null;
    pendingNote = "";
    if (ui) ui.hide();
    tts.cancel();
    if (clearSelection) clearDocumentSelection();
  }

  function clearDocumentSelection() {
    try {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) sel.removeAllRanges();
    } catch (err) {
      /* ignore */
    }
  }

  /* --------------------------------------------------------- helpers ---- */

  function isSiteExcluded() {
    const host = location.hostname.toLowerCase();
    if (!host) return false;
    return settings.excludedSites.some((pattern) => {
      const base = pattern.toLowerCase().replace(/^\*\./, "").replace(/^www\./, "");
      return host === base || host.endsWith("." + base);
    });
  }

  /** Bounding box of the last line of the selection (where reading ends). */
  function selectionRect(sel) {
    try {
      const range = sel.getRangeAt(0);
      const rects = range.getClientRects();
      if (rects.length > 0) return rects[rects.length - 1];
      const rect = range.getBoundingClientRect();
      if (rect && (rect.width || rect.height)) return rect;
    } catch (err) {
      /* detached range */
    }
    return { left: 24, right: 224, top: 24, bottom: 54, width: 200, height: 30 };
  }

  function repositionSoon() {
    cancelAnimationFrame(repositionRaf);
    repositionRaf = requestAnimationFrame(() => {
      const sel = window.getSelection();
      if (ui && sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        ui.positionTo(selectionRect(sel));
      }
    });
  }

  function onViewportMove() {
    if (!ui || !ui.visible) return;
    cancelAnimationFrame(repositionRaf);
    repositionRaf = requestAnimationFrame(() => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        ui.positionTo(selectionRect(sel));
      } else {
        dismiss();
      }
    });
  }

  function teardown() {
    while (listeners.length) {
      try {
        listeners.pop()();
      } catch (err) {
        /* ignore */
      }
    }
    try {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    } catch (err) {
      /* ignore */
    }
    if (ui) {
      ui.destroy();
      ui = null;
    }
    settings = null;
  }
})();

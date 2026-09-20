"use strict";

/*
 * LingoLearn Lens — popup UI component.
 *
 * A self-contained view rendered inside a closed shadow root, so host pages
 * cannot read or restyle it. Knows nothing about translation or settings:
 * the controller calls showLoading / showResult / showError and reacts to
 * the onSpeak / onClose callbacks. Also usable from the dev preview page.
 */

const LL_LANG_NAMES = {
  en: "English", bn: "Bangla", hi: "Hindi", ar: "Arabic", fr: "French",
  de: "German", es: "Spanish", it: "Italian", pt: "Portuguese", ru: "Russian",
  ur: "Urdu", fa: "Persian", tr: "Turkish", zh: "Chinese", ja: "Japanese",
  ko: "Korean", id: "Indonesian", ms: "Malay", th: "Thai", vi: "Vietnamese",
  nl: "Dutch", pl: "Polish", sv: "Swedish", he: "Hebrew", el: "Greek",
  uk: "Ukrainian", ro: "Romanian", hu: "Hungarian", cs: "Czech", da: "Danish",
  fi: "Finnish", no: "Norwegian", ta: "Tamil", te: "Telugu", mr: "Marathi",
  gu: "Gujarati", pa: "Punjabi", kn: "Kannada", ml: "Malayalam", si: "Sinhala",
  ne: "Nepali", my: "Burmese", km: "Khmer", lo: "Lao", ka: "Georgian",
  hy: "Armenian", az: "Azerbaijani", kk: "Kazakh", uz: "Uzbek", af: "Afrikaans",
  sw: "Swahili", fil: "Filipino", ca: "Catalan", hr: "Croatian", sr: "Serbian",
  sk: "Slovak", sl: "Slovenian", bg: "Bulgarian", lt: "Lithuanian",
  lv: "Latvian", et: "Estonian", is: "Icelandic", ga: "Irish", cy: "Welsh",
  eu: "Basque", gl: "Galician", be: "Belarusian", mk: "Macedonian",
  sq: "Albanian",
};

const LL_ICONS = {
  speaker:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10v4h4l5 4V6L7 10H3z"/><path d="M16.5 12c0-1.8-1-3.4-2.5-4.1v8.2c1.5-.7 2.5-2.3 2.5-4.1z"/><path d="M14 3.1v2.1c3 .9 5.2 3.6 5.2 6.8s-2.2 5.9-5.2 6.8v2.1c4.1-1 7.2-4.6 7.2-8.9S18.1 4.1 14 3.1z"/></svg>',
  close:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6z"/></svg>',
  warning:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>',
};

const LL_COMPANY = { name: "ANSNEW TECH.", url: "https://inside.ansnew.com/" };

const LL_POPUP_MARKUP = `
  <div class="ll-card" aria-label="Translation">
    <header class="ll-head">
      <span class="ll-lang">Translating…</span>
      <span class="ll-tools">
        <button class="ll-btn ll-speak" type="button" title="Pronounce">${LL_ICONS.speaker}</button>
        <button class="ll-btn ll-close" type="button" title="Close (Esc)">${LL_ICONS.close}</button>
      </span>
    </header>
    <div class="ll-body">
      <div class="ll-view ll-view-loading">
        <span class="ll-spinner"></span><span>Translating…</span>
      </div>
      <div class="ll-view ll-view-result" hidden>
        <div class="ll-meaning" dir="auto" aria-live="polite"></div>
        <div class="ll-note" hidden></div>
        <div class="ll-roman" hidden></div>
        <div class="ll-dict" hidden></div>
      </div>
      <div class="ll-view ll-view-error" hidden>
        <span class="ll-error-icon">${LL_ICONS.warning}</span>
        <span class="ll-error-text"></span>
      </div>
    </div>
    <footer class="ll-foot">
      <a href="${LL_COMPANY.url}" target="_blank" rel="noopener noreferrer">by ${LL_COMPANY.name}</a>
    </footer>
  </div>
`;

class LingoLearnPopup {
  constructor({ onSpeak, onClose } = {}) {
    this.onSpeak = onSpeak || (() => {});
    this.onClose = onClose || (() => {});
    this.visible = false;

    this.host = document.createElement("div");
    this.host.style.cssText =
      "position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;";

    const root = this.host.attachShadow({ mode: "closed" });
    root.innerHTML = LL_POPUP_MARKUP;
    this._applyStyles(root);

    this.card = root.querySelector(".ll-card");
    this.langEl = root.querySelector(".ll-lang");
    this.speakBtn = root.querySelector(".ll-speak");
    this.closeBtn = root.querySelector(".ll-close");
    this.views = {
      loading: root.querySelector(".ll-view-loading"),
      result: root.querySelector(".ll-view-result"),
      error: root.querySelector(".ll-view-error"),
    };
    this.meaningEl = root.querySelector(".ll-meaning");
    this.noteEl = root.querySelector(".ll-note");
    this.romanEl = root.querySelector(".ll-roman");
    this.dictEl = root.querySelector(".ll-dict");
    this.errorTextEl = root.querySelector(".ll-error-text");

    // Clicking anywhere on the card must not collapse the page selection
    // that the popup belongs to.
    this.card.addEventListener("mousedown", (event) => event.preventDefault());
    this.closeBtn.addEventListener("click", () => {
      this.hide();
      this.onClose();
    });
    this.speakBtn.addEventListener("click", () => this.onSpeak());

    document.documentElement.appendChild(this.host);
  }

  _applyStyles(root) {
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(LL_POPUP_STYLES);
      root.adoptedStyleSheets = [sheet];
    } catch (err) {
      const style = document.createElement("style");
      style.textContent = LL_POPUP_STYLES;
      root.appendChild(style);
    }
  }

  setTheme(theme) {
    if (theme === "dark") this.host.setAttribute("data-ll-theme", "dark");
    else this.host.removeAttribute("data-ll-theme");
  }

  /** Master voice switch: hides the speaker button entirely when off. */
  setSpeechEnabled(enabled) {
    this.speakBtn.hidden = !enabled;
  }

  showLoading(rect) {
    this.langEl.textContent = "Translating…";
    this._setView("loading");
    this._show(rect);
  }

  showResult(data, { showDictionary = true, alreadyTarget = false, targetName = "Bangla", note = "" } = {}) {
    const srcRaw = String(data.detectedLanguage || "");
    const sourceName = alreadyTarget
      ? targetName
      : LL_LANG_NAMES[srcRaw] || LL_LANG_NAMES[srcRaw.split("-")[0]] || srcRaw || "Text";
    this.langEl.textContent = `${sourceName} → ${targetName}`;

    this.meaningEl.textContent = data.translation || "";

    this.noteEl.hidden = !note;
    this.noteEl.textContent = note;

    const roman = (data.romanization || "").trim();
    this.romanEl.hidden = !roman;
    if (roman) this.romanEl.textContent = roman;

    const dict =
      showDictionary && Array.isArray(data.dictionary)
        ? data.dictionary.filter((entry) => entry.terms && entry.terms.length)
        : [];
    this.dictEl.hidden = dict.length === 0;
    this.dictEl.textContent = "";
    for (const entry of dict) {
      const item = document.createElement("div");
      item.className = "ll-dict-item";

      const pos = document.createElement("span");
      pos.className = "ll-pos";
      pos.textContent = entry.pos || "";

      const terms = document.createElement("span");
      terms.className = "ll-terms";
      for (const term of entry.terms.slice(0, 4)) {
        const chip = document.createElement("span");
        chip.className = "ll-term";
        chip.textContent = term;
        terms.appendChild(chip);
      }

      item.append(pos, terms);
      this.dictEl.appendChild(item);
    }

    this._setView("result");
  }

  showError(message) {
    this.langEl.textContent = "LingoLearn Lens";
    this.errorTextEl.textContent = message || "Something went wrong.";
    this._setView("error");
  }

  setSpeaking(active) {
    this.speakBtn.classList.toggle("ll-active", Boolean(active));
    this.speakBtn.title = active ? "Speaking — click to stop" : "Pronounce";
  }

  /** Places the card anchored below (or above) the selection rect. */
  positionTo(rect) {
    const margin = 8;
    const gap = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = this.card.offsetWidth;
    const height = this.card.offsetHeight;

    let left = rect.left;
    let top = rect.bottom + gap;
    if (left + width > vw - margin) left = vw - margin - width;
    if (left < margin) left = margin;
    if (top + height > vh - margin) top = rect.top - height - gap;
    if (top < margin) top = margin;

    this.card.style.left = `${Math.round(left)}px`;
    this.card.style.top = `${Math.round(top)}px`;
  }

  hide() {
    this.visible = false;
    this.card.classList.remove("ll-visible");
    this.setSpeaking(false);
  }

  destroy() {
    this.host.remove();
  }

  _setView(name) {
    for (const [key, element] of Object.entries(this.views)) {
      element.hidden = key !== name;
    }
  }

  _show(rect) {
    this.positionTo(rect);
    this.visible = true;
    this.card.classList.add("ll-visible");
  }
}

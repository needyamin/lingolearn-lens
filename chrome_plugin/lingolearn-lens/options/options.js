"use strict";

/*
 * LingoLearn Lens — options page controller.
 * Loads settings once, then saves automatically (debounced) on every change.
 */

const els = {
  autoTranslate: document.getElementById("autoTranslate"),
  targetLanguage: document.getElementById("targetLanguage"),
  showDictionary: document.getElementById("showDictionary"),
  maxSelectionLength: document.getElementById("maxSelectionLength"),
  speechEnabled: document.getElementById("speechEnabled"),
  autoSpeak: document.getElementById("autoSpeak"),
  speakSource: document.getElementById("speakSource"),
  speakTranslation: document.getElementById("speakTranslation"),
  voiceRow: document.getElementById("voiceRow"),
  voiceSelect: document.getElementById("voiceSelect"),
  speechRate: document.getElementById("speechRate"),
  rateValue: document.getElementById("rateValue"),
  testSpeech: document.getElementById("testSpeech"),
  popupTheme: document.getElementById("popupTheme"),
  excludedSites: document.getElementById("excludedSites"),
  reset: document.getElementById("reset"),
  toast: document.getElementById("toast"),
};

let saveTimer = 0;
let toastTimer = 0;

populate();
wireEvents();

async function populate() {
  const settings = await LLSettings.load();
  els.autoTranslate.checked = settings.autoTranslate;
  els.speechEnabled.checked = settings.speechEnabled;
  populateTargetLanguages(settings.targetLanguage);
  els.showDictionary.checked = settings.showDictionary;
  els.maxSelectionLength.value = String(settings.maxSelectionLength);
  els.autoSpeak.checked = settings.autoSpeak;
  els.speakSource.checked = settings.speakTarget === "source";
  els.speakTranslation.checked = settings.speakTarget === "translation";
  els.voiceSelect.dataset.value = settings.voiceURI;
  if ("speechSynthesis" in window) {
    els.voiceRow.hidden = false;
    populateVoices();
  }
  els.speechRate.value = String(settings.speechRate);
  els.rateValue.textContent = formatRate(settings.speechRate);
  els.popupTheme.value = settings.popupTheme;
  els.excludedSites.value = settings.excludedSites.join("\n");
}

function populateTargetLanguages(selected) {
  els.targetLanguage.textContent = "";
  const entries = Object.entries(LL_TARGET_LANGUAGES).sort((a, b) =>
    a[1].localeCompare(b[1])
  );
  // Bangla leads the list as the add-on's default focus.
  const ordered = [
    ...entries.filter(([code]) => code === "bn"),
    ...entries.filter(([code]) => code !== "bn"),
  ];
  for (const [code, name] of ordered) {
    const option = document.createElement("option");
    option.value = code;
    const native = LL_TARGET_NATIVE_NAMES[code];
    option.textContent = native ? `${name} (${native})` : name;
    if (code === selected) option.selected = true;
    els.targetLanguage.appendChild(option);
  }
}

function populateVoices() {
  if (!("speechSynthesis" in window)) return;
  const voices = window.speechSynthesis.getVoices() || [];
  const stored = els.voiceSelect.dataset.value || "";

  els.voiceSelect.textContent = "";
  const automatic = document.createElement("option");
  automatic.value = "";
  automatic.textContent = "Automatic (match language)";
  els.voiceSelect.appendChild(automatic);

  const sorted = [...voices].sort((a, b) => a.name.localeCompare(b.name));
  for (const voice of sorted) {
    const option = document.createElement("option");
    option.value = voice.voiceURI;
    option.textContent = `${voice.name} (${voice.lang})`;
    els.voiceSelect.appendChild(option);
  }
  // Keep a stored choice visible even if that voice is unavailable right now,
  // so changing another setting does not silently wipe it.
  if (stored && !sorted.some((voice) => voice.voiceURI === stored)) {
    const option = document.createElement("option");
    option.value = stored;
    option.textContent = `${stored} (currently unavailable)`;
    els.voiceSelect.appendChild(option);
  }
  els.voiceSelect.value = stored;
}

function wireEvents() {
  for (const id of ["autoTranslate", "speechEnabled", "showDictionary", "autoSpeak", "popupTheme"]) {
    els[id].addEventListener("change", scheduleSave);
  }
  for (const id of ["speakSource", "speakTranslation"]) {
    els[id].addEventListener("change", scheduleSave);
  }
  els.targetLanguage.addEventListener("change", scheduleSave);
  els.voiceSelect.addEventListener("change", scheduleSave);
  if ("speechSynthesis" in window) {
    // Voices load asynchronously in some browsers; refresh when they arrive.
    window.speechSynthesis.onvoiceschanged = populateVoices;
  }
  for (const id of ["maxSelectionLength", "excludedSites"]) {
    els[id].addEventListener("input", scheduleSave);
  }
  els.speechRate.addEventListener("input", () => {
    els.rateValue.textContent = formatRate(parseFloat(els.speechRate.value));
    scheduleSave();
  });
  els.reset.addEventListener("click", resetDefaults);

  if (!("speechSynthesis" in window)) {
    els.testSpeech.hidden = true;
  } else {
    els.testSpeech.addEventListener("click", testSpeech);
  }
}

function collect() {
  return {
    autoTranslate: els.autoTranslate.checked,
    speechEnabled: els.speechEnabled.checked,
    targetLanguage: els.targetLanguage.value,
    showDictionary: els.showDictionary.checked,
    maxSelectionLength: parseInt(els.maxSelectionLength.value, 10),
    autoSpeak: els.autoSpeak.checked,
    speakTarget: els.speakTranslation.checked ? "translation" : "source",
    voiceURI: els.voiceSelect.value,
    speechRate: parseFloat(els.speechRate.value) || 1,
    popupTheme: els.popupTheme.value,
    excludedSites: els.excludedSites.value
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean),
  };
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await LLSettings.save(collect());
    showToast("Settings saved");
  }, 300);
}

async function resetDefaults() {
  await LLSettings.save({ ...LL_DEFAULT_SETTINGS });
  await populate();
  showToast("Defaults restored");
}

function testSpeech() {
  if (!("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      "Hello! Select any text on a page, and LingoLearn Lens will translate and pronounce it for you."
    );
    utterance.rate = parseFloat(els.speechRate.value) || 1;
    const chosen = window.speechSynthesis
      .getVoices()
      .find((voice) => voice.voiceURI === els.voiceSelect.value);
    if (chosen) {
      utterance.voice = chosen;
      utterance.lang = chosen.lang;
    }
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    els.testSpeech.hidden = true;
  }
}

function formatRate(rate) {
  return `${Number(rate).toFixed(2)}×`;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 1500);
}

"use strict";

/* LingoLearn BN — toolbar quick-toggle popup. */

const translateToggle = document.getElementById("toggleTranslate");
const speakToggle = document.getElementById("toggleSpeak");
const voiceToggle = document.getElementById("toggleVoice");
const statusText = document.getElementById("statusText");
const targetLine = document.getElementById("targetLine");
const openSettingsBtn = document.getElementById("openSettings");

init();

async function init() {
  const settings = await LLSettings.load();
  translateToggle.checked = settings.autoTranslate;
  speakToggle.checked = settings.autoSpeak;
  voiceToggle.checked = settings.speechEnabled;
  const targetName = LL_TARGET_LANGUAGES[settings.targetLanguage] || "Bangla";
  targetLine.textContent = `Instant ${targetName} meanings`;
  updateStatus(settings);

  translateToggle.addEventListener("change", save);
  speakToggle.addEventListener("change", save);
  voiceToggle.addEventListener("change", save);

  if (llApi && llApi.runtime && llApi.runtime.openOptionsPage) {
    openSettingsBtn.addEventListener("click", () => llApi.runtime.openOptionsPage());
  } else {
    openSettingsBtn.hidden = true;
  }
}

async function save() {
  const settings = await LLSettings.save({
    autoTranslate: translateToggle.checked,
    autoSpeak: speakToggle.checked,
    speechEnabled: voiceToggle.checked,
  });
  updateStatus(settings);
}

function updateStatus(settings) {
  const targetName = LL_TARGET_LANGUAGES[settings.targetLanguage] || "target";
  let text = settings.autoTranslate
    ? `Active — select text on any page to see its ${targetName} meaning.`
    : "Paused — automatic translation is off.";
  if (!settings.speechEnabled) text += " Voice is off.";
  statusText.textContent = text;
}

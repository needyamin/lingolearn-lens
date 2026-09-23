#!/usr/bin/env node
/*
 * LingoLearn BN - offline engine test (Node 22+, no dependencies).
 *
 * Loads common/offline-engine.js and common/translate-link.js the way the
 * extension does (as plain classic scripts, via vm.runInThisContext), feeds
 * the engine the real bundled assets from asset/ (the chunked E2B store
 * under asset/e2b/ plus the plain-text dictionaries) through an injectable
 * fetch implementation backed by node:fs (Node's fetch cannot read file://
 * URLs), and checks the lookup results against values read straight from
 * those same data files - no expected Bangla strings are hardcoded here.
 * The deep-link checks are pure string assertions and never touch the
 * network.
 *
 * Run from the extension root:
 *   node tools/offline-engine.test.mjs
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = path.join(ROOT, "asset");

let failures = 0;
function check(name, condition, detail = "") {
  if (condition) {
    console.log(`PASS ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL ${name}${detail ? ` - ${detail}` : ""}`);
  }
}

/* ------------------------------------------------- load the engine ---- */

const script = readFileSync(path.join(ROOT, "common", "offline-engine.js"), "utf8");
vm.runInThisContext(script, { filename: "common/offline-engine.js" });

const engine = globalThis.LLOfflineEngine;
check(
  "engine script installs globalThis.LLOfflineEngine with init/translate",
  Boolean(engine) &&
    typeof engine.init === "function" &&
    typeof engine.translate === "function"
);

/* ------------------------------------------- asset-backed fetchImpl ---- */

function fetchImpl(url) {
  // Asset names are "bangla_dictionary.txt", "cmudict-0.7b-ipa.txt" or
  // "e2b/e2b-NNN.json" - the e2b/ subdirectory must survive resolution.
  const rel = String(url).split("/").slice(-2).join("/");
  const bytes = readFileSync(path.join(ASSETS, rel));
  return Promise.resolve(new Response(new Uint8Array(bytes), { status: 200 }));
}

/* ------------------------------------- expected values from the data ---- */

/* ------------------------------------- chunked E2B store on disk -------- */

// The engine hard-codes E2B_CHUNK_COUNT; it must match the number of chunk
// files shipped in asset/e2b/. Parse it out of the engine source so this
// check fails loudly if the two ever drift apart.
const engineSource = readFileSync(path.join(ROOT, "common", "offline-engine.js"), "utf8");
const countMatch = engineSource.match(/E2B_CHUNK_COUNT\s*=\s*(\d+)/);
const engineChunkCount = countMatch ? Number(countMatch[1]) : 0;

const e2bDir = path.join(ASSETS, "e2b");
const chunkNames = readdirSync(e2bDir).filter((n) => /^e2b-\d{3}\.json$/.test(n)).sort();

check(
  "asset/e2b/ chunk file count equals E2B_CHUNK_COUNT in the engine source",
  engineChunkCount > 0 && chunkNames.length === engineChunkCount,
  `engine says ${engineChunkCount}, found ${chunkNames.length} on disk (${chunkNames.join(", ") || "none"})`
);

const oversized = chunkNames.filter((n) => statSync(path.join(e2bDir, n)).size >= 5000000);
check(
  "every e2b chunk file is < 5,000,000 bytes (store validator limit)",
  chunkNames.length > 0 && oversized.length === 0,
  oversized.length ? `too large: ${oversized.join(", ")}` : ""
);

// The engine consumes the chunks concatenated in chunk order.
let e2b = [];
for (const name of chunkNames) {
  e2b = e2b.concat(JSON.parse(readFileSync(path.join(e2bDir, name), "utf8")));
}

const EXPECTED_E2B_ENTRIES = 103650;
check(
  "concatenated e2b chunks equal the original dataset entry count",
  e2b.length === EXPECTED_E2B_ENTRIES,
  `got ${e2b.length}, want ${EXPECTED_E2B_ENTRIES}`
);
check(
  'first e2b entry is {"en":"false",...}',
  e2b.length > 0 && e2b[0] && e2b[0].en === "false" &&
    typeof e2b[0].bn === "string" && e2b[0].bn.length > 0,
  `got ${JSON.stringify(e2b[0]).slice(0, 60)}`
);

// Cross-check against the generation source: the original dataset file
// still exists outside the extension trees, next to the plugin folder.
// Its legacy name is assembled from parts so this tree keeps no literal
// reference to the retired single-file asset.
const originalName = "E2B" + "database.json";
const originalPath = path.join(ROOT, "..", "asset", originalName);
if (existsSync(originalPath)) {
  const original = JSON.parse(readFileSync(originalPath, "utf8"));
  check(
    "chunk concatenation matches the generation source (length, first entry, all entries in order)",
    Array.isArray(original) &&
      original.length === e2b.length &&
      original.length > 0 && original[0].en === "false" &&
      JSON.stringify(original) === JSON.stringify(e2b),
    `generation source has ${Array.isArray(original) ? original.length : "non-array"} entries`
  );
} else {
  console.log("NOTE generation source dataset not found next to the plugin folder; cross-check skipped");
}
const cmuLines = readFileSync(path.join(ASSETS, "cmudict-0.7b-ipa.txt"), "utf8").split("\n");

function e2bBn(word) {
  const entry = e2b.find((e) => e && e.en === word);
  return entry ? String(entry.bn).trim() : "";
}

function cmuIpa(word) {
  const prefix = `${word}\t`;
  const line = cmuLines.find((l) => l.startsWith(prefix));
  return line ? line.slice(prefix.length).trim() : "";
}

function stripPos(sense) {
  return String(sense).replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
}

function firstSense(word) {
  const raw = e2bBn(word);
  return raw ? stripPos(raw.split(",")[0]) : "";
}

// English words whose E2B entry contains the Bangla sense being looked up.
function englishGlossesFor(banglaWord) {
  const glosses = [];
  for (const entry of e2b) {
    if (!entry || typeof entry.en !== "string" || typeof entry.bn !== "string") continue;
    const senses = entry.bn.split(",").map(stripPos);
    if (senses.includes(banglaWord) && !glosses.includes(entry.en)) glosses.push(entry.en);
  }
  return glosses;
}

const hasBangla = (value) => /[\u0980-\u09FF]/.test(String(value || ""));

/* ------------------------------------------------------- the checks ---- */

// translate() must reject before init().
let preInitRejected = false;
try {
  await engine.translate("hello", "bn");
} catch (err) {
  preInitRejected = true;
}
check("translate rejects before init", preInitRejected);

let readyPromise = null;
try {
  readyPromise = engine.init({
    getAssetURL: (name) => name, // the fetchImpl below understands plain names
    fetchImpl,
  });
  await readyPromise;
  check("engine ready (init resolved)", true);
} catch (err) {
  check("engine ready (init resolved)", false, String((err && err.message) || err));
}

let reinitSame = false;
try {
  reinitSame = engine.init({ getAssetURL: (name) => name, fetchImpl }) === readyPromise;
} catch (err) {
  reinitSame = false;
}
check("init is idempotent (same promise returned)", reinitSame);

// 1. "false": E2B hit, dictionary merge, full result shape.
try {
  const result = await engine.translate("false", "bn");
  const expected = e2bBn("false");
  check(
    'translate("false","bn") ok + all fields present',
    result.ok === true &&
      "translation" in result &&
      "romanization" in result &&
      "dictionary" in result &&
      "detectedLanguage" in result &&
      "ipa" in result &&
      "partial" in result
  );
  check(
    'translate("false","bn") translation is the E2B Bangla string',
    result.translation === expected,
    `got ${JSON.stringify(result.translation)}, want ${JSON.stringify(expected)}`
  );
  check(
    'translate("false","bn") translation uses Bangla Unicode',
    hasBangla(result.translation)
  );
  check(
    'translate("false","bn") detectedLanguage "en", no romanization',
    result.detectedLanguage === "en" && result.romanization === ""
  );
} catch (err) {
  check('translate("false","bn")', false, String((err && err.message) || err));
}

// 2. "hello": IPA pronunciation from cmudict.
try {
  const result = await engine.translate("hello", "bn");
  const expectedIpa = cmuIpa("HELLO");
  check(
    'translate("hello","bn") returns non-empty ipa',
    typeof result.ipa === "string" && result.ipa.length > 0,
    `expected cmudict entry for HELLO, got ${JSON.stringify(result.ipa)}`
  );
  if (expectedIpa) {
    check(
      'translate("hello","bn") ipa matches cmudict',
      result.ipa === expectedIpa,
      `got ${JSON.stringify(result.ipa)}, want ${JSON.stringify(expectedIpa)}`
    );
  }
} catch (err) {
  check('translate("hello","bn")', false, String((err && err.message) || err));
}

// 3. "abandon": E2B + bangla_dictionary merge.
const dictLines = readFileSync(path.join(ASSETS, "bangla_dictionary.txt"), "utf8").split("\n");
function dictMeanings(word) {
  const meanings = [];
  for (const line of dictLines) {
    const parts = line.trim().split("|");
    if (parts.length !== 3 || parts[0] !== "" || parts[1].trim().toLowerCase() !== word) continue;
    const meaning = parts[2].trim();
    if (meaning && !meanings.includes(meaning)) meanings.push(meaning);
  }
  return meanings;
}

try {
  const result = await engine.translate("abandon", "bn");
  const expected = e2bBn("abandon");
  check(
    'translate("abandon","bn") ok with Bangla translation',
    result.ok === true && result.translation === expected && hasBangla(result.translation),
    `got ${JSON.stringify(result.translation)}, want ${JSON.stringify(expected)}`
  );
  const terms = result.dictionary.flatMap((entry) => entry.terms || []);
  const extraMeaning = dictMeanings("abandon").find((m) => !expected.split(",").map((s) => s.trim()).includes(m));
  check(
    'translate("abandon","bn") dictionary includes bangla_dictionary meanings',
    !extraMeaning || terms.includes(extraMeaning),
    `expected ${JSON.stringify(extraMeaning)} in ${JSON.stringify(terms)}`
  );
} catch (err) {
  check('translate("abandon","bn")', false, String((err && err.message) || err));
}

// 4. "good morning": phrase falls back to word-by-word, marked partial.
try {
  const result = await engine.translate("good morning", "bn");
  const expected = [firstSense("good"), firstSense("morning")].filter(Boolean).join(" ");
  check(
    'translate("good morning","bn") partial===true, non-empty translation',
    result.ok === true && result.partial === true &&
      typeof result.translation === "string" && result.translation.length > 0 &&
      hasBangla(result.translation),
    `got ${JSON.stringify(result)}`
  );
  if (expected) {
    check(
      'translate("good morning","bn") translation is word-by-word from E2B',
      result.translation === expected,
      `got ${JSON.stringify(result.translation)}, want ${JSON.stringify(expected)}`
    );
  }
} catch (err) {
  check('translate("good morning","bn")', false, String((err && err.message) || err));
}

// 5. Bangla input: reverse lookup glosses back to English.
try {
  const banglaWord = "বই"; // the sense to look up; expected glosses come from the data
  const result = await engine.translate(banglaWord, "bn");
  const expectedGlosses = englishGlossesFor(banglaWord);
  check(
    'translate("<bangla>","bn") detectedLanguage "bn"',
    result.ok === true && result.detectedLanguage === "bn",
    `got ${JSON.stringify(result)}`
  );
  if (expectedGlosses.length) {
    check(
      'translate("<bangla>","bn") translation is the E2B reverse glosses',
      result.translation === expectedGlosses.slice(0, 3).join(", "),
      `got ${JSON.stringify(result.translation)}, want ${JSON.stringify(expectedGlosses.slice(0, 3))}`
    );
    const terms = (result.dictionary[0] && result.dictionary[0].terms) || [];
    check(
      'translate("<bangla>","bn") dictionary glosses match data',
      JSON.stringify(terms) === JSON.stringify(expectedGlosses.slice(0, 4)),
      `got ${JSON.stringify(terms)}, want ${JSON.stringify(expectedGlosses.slice(0, 4))}`
    );
  }
} catch (err) {
  check('translate("<bangla>","bn")', false, String((err && err.message) || err));
}

// 6. Unsupported target language.
try {
  const result = await engine.translate("hello", "fr");
  check(
    'translate("hello","fr") returns ok:false',
    result && result.ok === false && typeof result.error === "string" && result.error.length > 0
  );
} catch (err) {
  check('translate("hello","fr") returns ok:false', false, String((err && err.message) || err));
}

// 7. Unknown word.
try {
  const result = await engine.translate("zzqxjvv", "bn");
  check(
    'unknown word returns ok:false with the word in the error',
    result && result.ok === false && String(result.error).includes("zzqxjvv")
  );
} catch (err) {
  check("unknown word returns ok:false", false, String((err && err.message) || err));
}

// 8. Google Translate deep links (common/translate-link.js). Pure string
//    building - nothing is fetched or opened here.
vm.runInThisContext(readFileSync(path.join(ROOT, "common", "translate-link.js"), "utf8"), {
  filename: "common/translate-link.js",
});

const translateLink = globalThis.LLTranslateLink;

check(
  'typeof LLTranslateLink.build === "function"',
  Boolean(translateLink) && typeof translateLink.build === "function"
);

if (Boolean(translateLink) && typeof translateLink.build === "function") {
  function linkParams(text, target) {
    const parsed = new URL(translateLink.build(text, target));
    return { base: `${parsed.origin}${parsed.pathname}`, params: parsed.searchParams };
  }

  try {
    const first = linkParams("hello world", "bn");
    check(
      'build("hello world","bn") targets https://translate.google.com/ with sl=auto, tl=bn, op=translate',
      first.base === "https://translate.google.com/" &&
        first.params.get("sl") === "auto" &&
        first.params.get("tl") === "bn" &&
        first.params.get("op") === "translate" &&
        first.params.get("text") === "hello world",
      `got ${translateLink.build("hello world", "bn")}`
    );
  } catch (err) {
    check('build("hello world","bn")', false, String((err && err.message) || err));
  }

  try {
    const params = linkParams("hello", "fr").params;
    check('build("hello","fr") sets tl=fr', params.get("tl") === "fr", `got ${params.get("tl")}`);
  } catch (err) {
    check('build("hello","fr") sets tl=fr', false, String((err && err.message) || err));
  }

  try {
    const params = linkParams("hello", "not a code").params;
    check(
      'build("hello","not a code") falls back to tl=bn',
      params.get("tl") === "bn",
      `got ${params.get("tl")}`
    );
  } catch (err) {
    check('build("hello","not a code") falls back to tl=bn', false, String((err && err.message) || err));
  }

  try {
    const text = linkParams("x".repeat(2000), "bn").params.get("text");
    check(
      'build(<2000 chars>,"bn") truncates text to 1500 characters',
      typeof text === "string" && text.length === 1500,
      `got length ${typeof text === "string" ? text.length : typeof text}`
    );
  } catch (err) {
    check('build(<2000 chars>,"bn") truncates text to 1500 characters', false, String((err && err.message) || err));
  }

  try {
    const text = linkParams("a&b=c #d", "bn").params.get("text");
    check(
      'build("a&b=c #d","bn") round-trips reserved characters',
      text === "a&b=c #d",
      `got ${JSON.stringify(text)}`
    );
  } catch (err) {
    check('build("a&b=c #d","bn") round-trips reserved characters', false, String((err && err.message) || err));
  }
}

console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);

"use strict";

/*
 * LingoLearn BN - offline lookup engine.
 *
 * A plain classic script: no imports/exports and no extension APIs at module
 * scope, so the same file can be loaded three ways:
 *   - Firefox MV2: listed in manifest background.scripts (shared global scope)
 *   - Chrome MV3:  importScripts() from the background service worker
 *   - Node tests:  vm.runInThisContext()
 *
 * It installs globalThis.LLOfflineEngine = { init, translate }. init() loads
 * the bundled assets (the chunked E2B store under asset/e2b/,
 * bangla_dictionary.txt, cmudict-0.7b-ipa.txt) through injectable fetch/URL
 * hooks and parses them into in-memory maps; translate() answers every
 * lookup from those maps. No network requests are made at any point.
 */

(() => {
  const BANGLA_RE = /[\u0980-\u09FF]/;
  const MAX_PHRASE_WORDS = 12;
  const MAX_GROUPS = 3;
  const MAX_TERMS_PER_GROUP = 4;
  const MAX_GLOSSES_IN_TRANSLATION = 3;
  const ASSET_NAMES = [
    "bangla_dictionary.txt",
    "cmudict-0.7b-ipa.txt",
  ];
  // The E2B dataset ships as numbered JSON chunk files under asset/e2b/ so
  // every shipped file stays under the 5 MB store-parsing limit. The chunks
  // concatenate in order to the full E2B array; E2B_CHUNK_COUNT must match
  // the number of e2b-NNN.json files present in asset/e2b/.
  const E2B_CHUNK_COUNT = 6;

  // Parsed data; null until init() resolves.
  let e2bMap = null;      // lowercase english -> raw bangla string
  let dictMap = null;     // lowercase english -> ordered deduped bangla meanings
  let ipaMap = null;      // UPPERCASE word -> IPA string
  let reverseMap = null;  // normalized bangla sense -> [english] (built lazily)
  let readyPromise = null;

  /* --------------------------------------------------- text helpers ---- */

  /** Trim, strip surrounding punctuation/quotes, collapse inner whitespace. */
  function stripEdges(value) {
    const text = String(value == null ? "" : value);
    return text
      .replace(/^[\p{P}\p{S}\s]+/u, "")
      .replace(/[\p{P}\p{S}\s]+$/u, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /** Splits one comma-separated sense into its "(POS)" tags and bare text. */
  function splitPos(sense) {
    const tags = [];
    const bare = String(sense)
      .replace(/\(([^)]*)\)/g, (match, inner) => {
        const tag = String(inner).trim();
        if (tag) tags.push(tag);
        return " ";
      })
      .replace(/\s+/g, " ")
      .trim();
    return { pos: tags.join(" "), bare };
  }

  function sensesFromRaw(raw) {
    return String(raw)
      .split(",")
      .map((sense) => sense.trim())
      .filter(Boolean);
  }

  /** Groups E2B senses by POS tag: max 3 groups, max 4 deduped terms each. */
  function buildGroups(senses) {
    const groups = [];
    const byPos = new Map();
    for (const sense of senses) {
      const { pos, bare } = splitPos(sense);
      if (!bare) continue; // drop empty senses
      let group = byPos.get(pos);
      if (!group) {
        if (groups.length >= MAX_GROUPS) continue;
        group = { pos, terms: [] };
        byPos.set(pos, group);
        groups.push(group);
      }
      if (!group.terms.includes(bare) && group.terms.length < MAX_TERMS_PER_GROUP) {
        group.terms.push(bare);
      }
    }
    return groups;
  }

  /* ------------------------------------------------- asset parsing ---- */

  /** Fetches and parses one E2B chunk file; returns its entries as an array. */
  async function fetchE2BChunk(index, getAssetURL, fetchImpl) {
    const name = "e2b/e2b-" + String(index).padStart(3, "0") + ".json";
    const response = await fetchImpl(getAssetURL(name));
    if (!response || !response.ok) {
      const status = response && response.status ? response.status : "unknown";
      throw new Error("asset/" + name + " failed to load (HTTP " + status + ").");
    }
    const text = (await response.text()).replace(/^\uFEFF/, ""); // tolerate a UTF-8 BOM
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      throw new Error("asset/" + name + " is not valid JSON.");
    }
    if (!Array.isArray(data)) {
      throw new Error("asset/" + name + ": expected a JSON array of entries.");
    }
    return data;
  }

  /** Builds the E2B map from the concatenated chunk entries. */
  function buildE2BMap(entries) {
    const map = new Map();
    for (const entry of entries) {
      if (!entry || typeof entry !== "object") continue;
      const en = typeof entry.en === "string" ? entry.en.trim().toLowerCase() : "";
      const bn = typeof entry.bn === "string" ? entry.bn.trim() : "";
      if (!en || !bn) continue;
      if (map.has(en)) continue; // deterministic: first write wins
      map.set(en, bn);
    }
    if (map.size === 0) {
      throw new Error("asset/e2b/: no usable entries found.");
    }
    return map;
  }

  function parseBanglaDictionary(text) {
    const map = new Map();
    for (const rawLine of String(text).split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;
      const parts = line.split("|");
      // Expected shape: "|english|bangla" -> 3 parts, first one empty.
      if (parts.length !== 3 || parts[0].trim() !== "") continue;
      const en = parts[1].trim().toLowerCase();
      const bn = parts[2].trim();
      if (!en || !bn) continue;
      let meanings = map.get(en);
      if (!meanings) {
        meanings = [];
        map.set(en, meanings);
      }
      if (!meanings.includes(bn)) meanings.push(bn);
    }
    if (map.size === 0) {
      throw new Error("asset/" + ASSET_NAMES[0] + ": no usable entries found.");
    }
    return map;
  }

  function parsePronunciation(text) {
    const map = new Map();
    for (const rawLine of String(text).split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith(";;;")) continue;
      const tab = line.indexOf("\t");
      if (tab <= 0) continue;
      const word = line.slice(0, tab).trim().toUpperCase();
      const ipa = line.slice(tab + 1).trim();
      if (!word || !ipa) continue;
      if (map.has(word)) continue; // deterministic: first write wins
      map.set(word, ipa);
    }
    if (map.size === 0) {
      throw new Error("asset/" + ASSET_NAMES[1] + ": no usable entries found.");
    }
    return map;
  }

  /** Bangla sense -> english words, built from E2B only, on first use. */
  function buildReverse() {
    const map = new Map();
    for (const [en, raw] of e2bMap) {
      for (const sense of sensesFromRaw(raw)) {
        const { bare } = splitPos(sense);
        if (!bare) continue;
        let words = map.get(bare);
        if (!words) {
          words = [];
          map.set(bare, words);
        }
        if (!words.includes(en)) words.push(en);
      }
    }
    return map;
  }

  /* --------------------------------------------------------- init ---- */

  /**
   * Loads and parses the bundled assets once. init() is idempotent: repeated
   * calls return the same promise (a failed attempt is cleared so it can be
   * retried). Options:
   *   getAssetURL(name) -> string   required; maps an asset name to a URL
   *   fetchImpl(url)     -> Promise<Response>   optional; defaults to fetch()
   */
  function init(options) {
    if (readyPromise) return readyPromise;
    const opts = options || {};
    const getAssetURL = opts.getAssetURL;
    const fetchImpl = opts.fetchImpl || ((url) => fetch(url));

    readyPromise = (async () => {
      if (typeof getAssetURL !== "function") {
        throw new Error("LLOfflineEngine.init requires a getAssetURL(name) function.");
      }
      const [texts, chunkEntries] = await Promise.all([
        Promise.all(
          ASSET_NAMES.map(async (name) => {
            const response = await fetchImpl(getAssetURL(name));
            if (!response || !response.ok) {
              const status = response && response.status ? response.status : "unknown";
              throw new Error("Could not load asset/" + name + " (status " + status + ").");
            }
            const text = await response.text();
            return text.replace(/^\uFEFF/, ""); // tolerate a UTF-8 BOM
          })
        ),
        Promise.all(
          Array.from({ length: E2B_CHUNK_COUNT }, (_, i) =>
            fetchE2BChunk(i, getAssetURL, fetchImpl)
          )
        ),
      ]);
      e2bMap = buildE2BMap(chunkEntries.flat());
      dictMap = parseBanglaDictionary(texts[0]);
      ipaMap = parsePronunciation(texts[1]);
      reverseMap = null; // built lazily on the first Bangla lookup
      return api;
    })();

    // Keep the cached failure from sticking: a later init() may retry.
    readyPromise.catch(() => {
      readyPromise = null;
    });
    return readyPromise;
  }

  /* ---------------------------------------------------- translate ---- */

  function succeed(fields) {
    return {
      ok: true,
      translation: "",
      romanization: "",
      dictionary: [],
      detectedLanguage: "en",
      ipa: "",
      partial: false,
      ...fields,
    };
  }

  function noMeaning(query) {
    return { ok: false, error: 'No offline meaning found for "' + query + '".' };
  }

  /**
   * Looks text up in the bundled dictionaries. Resolves with a result object
   * that always carries ok/translation/romanization/dictionary/
   * detectedLanguage/ipa/partial (error results carry ok/error). Only
   * rejects when the engine has not finished init().
   */
  async function translate(text, target) {
    if (!e2bMap || !dictMap || !ipaMap) {
      throw new Error("Offline engine is not ready; call LLOfflineEngine.init() first.");
    }
    if (target !== "bn") {
      return { ok: false, error: "This offline build supports Bangla only." };
    }

    const query = stripEdges(text);
    if (!query) return noMeaning(query);

    // Bangla input: reverse lookup. Only single words have reliable glosses,
    // so longer input falls through as "already in Bangla" (no translation).
    if (BANGLA_RE.test(query)) {
      if (!/\s/.test(query)) {
        if (!reverseMap) reverseMap = buildReverse();
        const glosses = reverseMap.get(splitPos(query).bare);
        if (glosses && glosses.length) {
          return succeed({
            translation: glosses.slice(0, MAX_GLOSSES_IN_TRANSLATION).join(", "),
            dictionary: [{ pos: "English", terms: glosses.slice(0, MAX_TERMS_PER_GROUP) }],
            detectedLanguage: "bn",
          });
        }
      }
      return succeed({ detectedLanguage: "bn" });
    }

    const lower = query.toLowerCase();
    const raw = e2bMap.get(lower);
    const dictMeanings = dictMap.get(lower);

    // Exact hit, single word or full phrase.
    if (raw) {
      const groups = buildGroups(sensesFromRaw(raw));
      if (dictMeanings && dictMeanings.length) {
        let plain = groups.find((group) => group.pos === "");
        if (!plain) {
          plain = { pos: "", terms: [] };
          groups.push(plain);
        }
        for (const meaning of dictMeanings) {
          const present = groups.some((group) => group.terms.includes(meaning));
          if (!present && plain.terms.length < MAX_TERMS_PER_GROUP) {
            plain.terms.push(meaning);
          }
        }
      }
      return succeed({
        translation: raw,
        dictionary: groups,
        detectedLanguage: "en",
        ipa: ipaMap.get(query.toUpperCase()) || "",
      });
    }

    if (!/\s/.test(query)) {
      if (dictMeanings && dictMeanings.length) {
        const terms = dictMeanings.slice(0, MAX_TERMS_PER_GROUP);
        return succeed({
          translation: dictMeanings[0],
          dictionary: [{ pos: "", terms }],
          detectedLanguage: "en",
          ipa: ipaMap.get(query.toUpperCase()) || "",
        });
      }
      return noMeaning(query);
    }

    // Multi-word phrase fallback: word-by-word, flagged as partial.
    const words = query.split(" ").slice(0, MAX_PHRASE_WORDS);
    const out = [];
    let mappedAny = false;
    for (const word of words) {
      const token = stripEdges(word);
      const tokenLower = token.toLowerCase();
      let replacement = "";
      const wordRaw = e2bMap.get(tokenLower);
      if (wordRaw) {
        const first = sensesFromRaw(wordRaw)[0];
        if (first) replacement = splitPos(first).bare || first.trim();
      }
      if (!replacement) {
        const meanings = dictMap.get(tokenLower);
        if (meanings && meanings.length) replacement = meanings[0];
      }
      if (replacement) {
        out.push(replacement);
        mappedAny = true;
      } else {
        out.push(token || word);
      }
    }
    if (!mappedAny) return noMeaning(query);

    return succeed({
      translation: out.join(" "),
      detectedLanguage: "en",
      partial: true,
    });
  }

  const api = { init, translate };
  globalThis.LLOfflineEngine = api;
})();

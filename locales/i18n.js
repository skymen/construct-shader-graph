import translationsCsv from "./translations.csv?raw";

const STORAGE_KEY = "csg-language";
const DEFAULT_LANGUAGE = { code: "en-US", label: "English (US)" };

// Parse the CSV and expose the runtime structures used by the UI helper.
const {
  fallbackLanguage: FALLBACK_LANG,
  supportedLanguages: SUPPORTED_LANGUAGES,
  dictionaries: DICTIONARIES,
} = buildDictionaries(translationsCsv);

const SUPPORTED_CODES = SUPPORTED_LANGUAGES.map(({ code }) => code);

// Map original strings to their hashed keys so we never compute twice.
const stringToKey = new Map();
const fallbackDict = DICTIONARIES[FALLBACK_LANG] || {};
Object.entries(fallbackDict).forEach(([key, value]) => {
  if (value) {
    stringToKey.set(value, key);
  }
});

// Cache t() results since the same string is often requested repeatedly.
const translationCache = new Map();
let currentLanguage = resolveInitialLanguage();

function buildDictionaries(csvText) {
  const cleaned = (csvText || "").replace(/^\uFEFF/, "");
  const rows = parseCSV(cleaned);
  if (!rows.length) {
    return {
      fallbackLanguage: DEFAULT_LANGUAGE.code,
      supportedLanguages: [DEFAULT_LANGUAGE],
      dictionaries: { [DEFAULT_LANGUAGE.code]: {} },
    };
  }

  const header = rows[0];
  const languages = extractLanguageMeta(header.slice(1));
  const dictionaries = Object.fromEntries(
    languages.map(({ code }) => [code, {}])
  );
  const fallbackLanguage = languages[0].code;
  const columnCount = header.length;
  const seenKeys = new Set();

  rows.slice(1).forEach((row) => {
    if (!row.length) return;
    const normalized = normalizeRow(row, columnCount);
    const key = normalized[0];
    if (!key) return;

    if (seenKeys.has(key)) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn(`[i18n] Duplicate translation key "${key}" ignored.`);
      }
      return;
    }
    seenKeys.add(key);

    languages.forEach(({ code }, idx) => {
      const value = normalized[idx + 1];
      if (value) {
        dictionaries[code][key] = value;
      }
    });
  });

  return { fallbackLanguage, supportedLanguages: languages, dictionaries };
}

function extractLanguageMeta(cells) {
  const parsed = cells
    .map((cell) => cell?.trim())
    .filter(Boolean)
    .map((cell) => {
      const [codePart, labelPart] = cell.split("|").map((part) => part.trim());
      const code = codePart || DEFAULT_LANGUAGE.code;
      return {
        code,
        label: labelPart || code,
      };
    });

  if (parsed.length > 0) {
    return parsed;
  }

  return [DEFAULT_LANGUAGE];
}

function normalizeRow(row, targetLength) {
  const normalized = [...row];
  while (normalized.length < targetLength) {
    normalized.push("");
  }
  return normalized;
}

function parseCSV(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(current);
      current = "";
      continue;
    }

    if (char === "\r" || char === "\n") {
      if (char === "\r" && text[i + 1] === "\n") {
        i++;
      }
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows
    .map((cells) => cells.map((cell) => cell ?? ""))
    .filter((cells) => cells.some((cell) => cell.trim().length > 0));
}

function resolveInitialLanguage() {
  if (typeof window === "undefined") {
    return FALLBACK_LANG;
  }
  const stored = window.localStorage?.getItem(STORAGE_KEY);
  if (stored && stored in DICTIONARIES) {
    return stored;
  }
  const navigatorLang =
    window.navigator?.language || window.navigator?.languages?.[0];
  if (navigatorLang) {
    const normalized = normalizeLanguage(navigatorLang);
    if (normalized in DICTIONARIES) {
      return normalized;
    }
  }
  return FALLBACK_LANG;
}

function normalizeLanguage(lang) {
  if (!lang) return FALLBACK_LANG;
  const lower = lang.toLowerCase();

  const exact = SUPPORTED_CODES.find(
    (code) => code.toLowerCase() === lower
  );
  if (exact) return exact;

  const primary = lower.split("-")[0];
  const partial = SUPPORTED_CODES.find(
    (code) =>
      code.toLowerCase().startsWith(`${primary}-`) ||
      code.toLowerCase() === primary
  );
  if (partial) return partial;

  return FALLBACK_LANG;
}

function hashString(str) {
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (
    (h2 >>> 0).toString(16).padStart(8, "0") +
    (h1 >>> 0).toString(16).padStart(8, "0")
  ).toLowerCase();
}

function getStringKey(defaultText) {
  if (stringToKey.has(defaultText)) {
    return stringToKey.get(defaultText);
  }
  const key = hashString(defaultText);
  stringToKey.set(defaultText, key);
  if (!(key in DICTIONARIES[FALLBACK_LANG])) {
    DICTIONARIES[FALLBACK_LANG][key] = defaultText;
  }
  return key;
}

function format(template, args) {
  if (!args.length) return template;
  return template.replace(/\{(\d+)\}/g, (match, index) => {
    const value = args[Number(index)];
    return value === undefined ? match : value;
  });
}

export function getSupportedLanguages() {
  return SUPPORTED_LANGUAGES.map(({ code, label }) => ({ code, label }));
}

export function getLanguage() {
  return currentLanguage;
}

export function getFallbackLanguage() {
  return FALLBACK_LANG;
}

export function setLanguage(lang) {
  if (!(lang in DICTIONARIES)) {
    lang = FALLBACK_LANG;
  }
  if (lang === currentLanguage) return;
  currentLanguage = lang;
  translationCache.clear();
  if (typeof window !== "undefined") {
    try {
      window.localStorage?.setItem(STORAGE_KEY, lang);
    } catch (err) {
      console.warn("Unable to persist language preference", err);
    }
    window.dispatchEvent(
      new CustomEvent("csg-language-change", { detail: { lang } })
    );
  }
}

export function t(defaultText, ...args) {
  if (!defaultText) return "";
  const lang = currentLanguage;
  const cacheKey = `${lang}:${defaultText}:${args.join("|")}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }
  const key = getStringKey(defaultText);
  const langDict = DICTIONARIES[lang] || {};
  const fallbackDict = DICTIONARIES[FALLBACK_LANG] || {};
  const template = langDict[key] ?? fallbackDict[key] ?? defaultText;
  const result = format(template, args);
  translationCache.set(cacheKey, result);
  return result;
}

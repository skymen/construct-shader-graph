import languages, {
  supportedLanguages,
  defaultLanguage,
  languageNames,
} from "./lang/index.js";

/**
 * Language Manager
 * Handles internationalization for the shader graph editor
 */
export class LanguageManager {
  constructor() {
    // Try to load saved language preference from localStorage
    const savedLang = localStorage.getItem("shader-graph-language");
    this.currentLanguage =
      savedLang && supportedLanguages.includes(savedLang)
        ? savedLang
        : defaultLanguage;

    // Get language data
    this.data = languages[this.currentLanguage];

    // Event listeners for language change
    this.listeners = [];
  }

  /**
   * Get the current language code
   */
  getCurrentLanguage() {
    return this.currentLanguage;
  }

  /**
   * Set the current language
   */
  setLanguage(languageCode) {
    if (!supportedLanguages.includes(languageCode)) {
      console.warn(
        `Language ${languageCode} is not supported. Using ${defaultLanguage}.`
      );
      languageCode = defaultLanguage;
    }

    this.currentLanguage = languageCode;
    this.data = languages[languageCode];

    // Save preference
    localStorage.setItem("shader-graph-language", languageCode);

    // Notify listeners
    this.listeners.forEach((callback) => callback(languageCode));
  }

  /**
   * Register a callback for language changes
   */
  onLanguageChange(callback) {
    this.listeners.push(callback);
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages() {
    return supportedLanguages.map((code) => ({
      code,
      name: languageNames[code] || code,
    }));
  }

  /**
   * Get translated node name
   */
  getNodeName(nodeKey) {
    return this.data.nodes[nodeKey] || nodeKey;
  }

  /**
   * Get translated category name
   */
  getCategoryName(categoryKey) {
    return this.data.categories[categoryKey] || categoryKey;
  }

  /**
   * Get translated input/output name
   */
  getInputOutputName(ioKey) {
    return this.data.inputOutputs[ioKey] || ioKey;
  }

  /**
   * Get translated UI text
   */
  getUIText(uiKey) {
    return this.data.ui[uiKey] || uiKey;
  }

  /**
   * Get translated tag name
   */
  getTagName(tagKey) {
    return this.data.tags[tagKey] || tagKey;
  }

  /**
   * Translate a node type object for display
   * This creates a display version without modifying the original
   */
  translateNodeType(nodeType) {
    return {
      ...nodeType,
      displayName: this.getNodeName(nodeType.name),
      displayCategory: this.getCategoryName(nodeType.category || "Misc"),
    };
  }

  /**
   * Get translated port name for display
   */
  getPortDisplayName(portName) {
    // Try to get translation from inputOutputs
    const translated = this.getInputOutputName(portName);
    // If no translation found, return the original name
    return translated === portName ? portName : translated;
  }
}

// Create singleton instance
export const languageManager = new LanguageManager();

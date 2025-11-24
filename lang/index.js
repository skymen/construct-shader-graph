import categories from "./categories.json";
import inputOutputs from "./inputOutpus.json";
import nodes from "./nodes.json";
import tags from "./tags.json";
import ui from "./ui.json";
import operations from "./operations.json";

import categories_fr_FR from "./categories.fr-FR.json";
import inputOutputs_fr_FR from "./inputOutpus.fr-FR.json";
import nodes_fr_FR from "./nodes.fr-FR.json";
import tags_fr_FR from "./tags.fr-FR.json";
import ui_fr_FR from "./ui.fr-FR.json";
import operations_fr_FR from "./operations.fr-FR.json";

import categories_zh_CN from "./categories.zh-CN.json";
import inputOutputs_zh_CN from "./inputOutpus.zh-CN.json";
import nodes_zh_CN from "./nodes.zh-CN.json";
import tags_zh_CN from "./tags.zh-CN.json";
import ui_zh_CN from "./ui.zh-CN.json";
import operations_zh_CN from "./operations.zh-CN.json";

const languages = {
  "en-US": {
    categories,
    inputOutputs,
    nodes,
    tags,
    ui,
    operations,
  },
  "fr-FR": {
    categories: categories_fr_FR,
    inputOutputs: inputOutputs_fr_FR,
    nodes: nodes_fr_FR,
    tags: tags_fr_FR,
    ui: ui_fr_FR,
    operations: operations_fr_FR,
  },
  "zh-CN": {
    categories: categories_zh_CN,
    inputOutputs: inputOutputs_zh_CN,
    nodes: nodes_zh_CN,
    tags: tags_zh_CN,
    ui: ui_zh_CN,
    operations: operations_zh_CN,
  },
};

export default languages;
export const supportedLanguages = Object.keys(languages);
export const defaultLanguage = "en-US";
export const languageNames = {
  "en-US": "English",
  "fr-FR": "Français",
  "zh-CN": "简体中文",
};

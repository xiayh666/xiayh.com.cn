import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

const catppuccinLatteHighlight = HighlightStyle.define([
  { tag: tags.comment, color: "#7c7f93", fontStyle: "italic" },
  { tag: [tags.string, tags.special(tags.string)], color: "#40a02b" },
  { tag: [tags.number, tags.bool, tags.null], color: "#fe640b" },
  { tag: [tags.keyword, tags.controlKeyword, tags.operatorKeyword], color: "#8839ef", fontStyle: "italic", fontWeight: "700" },
  { tag: [tags.operator, tags.punctuation, tags.bracket], color: "#179299" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: "#1e66f5", fontWeight: "700", textDecoration: "underline" },
  { tag: [tags.className, tags.typeName, tags.namespace], color: "#df8e1d", fontStyle: "italic" },
  { tag: [tags.propertyName, tags.attributeName], color: "#179299" },
  { tag: [tags.variableName, tags.definition(tags.variableName)], color: "#4c4f69", fontStyle: "italic", fontWeight: "700" },
  { tag: tags.definition(tags.propertyName), color: "#1e66f5" },
  { tag: [tags.labelName, tags.annotation], color: "#fe640b" },
  { tag: [tags.regexp, tags.escape], color: "#ea76cb" },
  { tag: [tags.invalid, tags.deleted], color: "#d20f39" },
  { tag: tags.inserted, color: "#40a02b" },
  { tag: [tags.heading, tags.strong], color: "#d20f39", fontWeight: "700" },
  { tag: tags.emphasis, color: "#d20f39", fontStyle: "italic" },
  { tag: tags.link, color: "#1e66f5", textDecoration: "underline" },
]);

export const vscodeCodeTheme = [
  EditorView.theme({
    "&": {
      color: "#4c4f69",
      backgroundColor: "#eff1f5",
      fontSize: "20px",
    },
    ".cm-content": {
      fontFamily: '"AudioLinkConsole", "AudioLink Mono", "Courier New", monospace',
      lineHeight: "1.5",
      caretColor: "#dc8a78",
    },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#dc8a78" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
      backgroundColor: "#7c7f934d",
    },
    ".cm-activeLine": { backgroundColor: "#4c4f6912" },
    ".cm-gutters": {
      color: "#8c8fa1",
      backgroundColor: "#eff1f5",
      border: "none",
    },
    ".cm-activeLineGutter": { color: "#8839ef", backgroundColor: "#4c4f6912" },
  }),
  syntaxHighlighting(catppuccinLatteHighlight),
];

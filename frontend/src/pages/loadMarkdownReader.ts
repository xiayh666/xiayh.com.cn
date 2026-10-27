export const loadMarkdownReader = () => import("./MarkdownReader").then((module) => ({ default: module.MarkdownReader }));

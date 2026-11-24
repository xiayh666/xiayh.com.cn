/** Keep a lone dollar typed as prose readable in Markdown without altering code or math. */
export function unescapeLoneProseDollars(markdown: string): string {
  let fence: string | undefined;
  return markdown.split("\n").map((line) => {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = undefined;
      return line;
    }
    if (fence || /^(?: {4}|\t)/.test(line)) return line;
    const parts = line.split(/(`+[^`]*`+)/g);
    const prose = parts.filter((_, index) => index % 2 === 0).join("");
    // Multiple dollars can form math on the next parse; preserve their escaping.
    if ((prose.match(/\$/g) ?? []).length !== 1) return line;
    return parts.map((part, index) => index % 2 === 0 ? part.replace(/(^|[^\\])\\\$/g, "$1$") : part).join("");
  }).join("\n");
}

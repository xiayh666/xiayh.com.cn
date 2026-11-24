import { describe, expect, it } from "vitest";
import { unescapeLoneProseDollars } from "./markdownDollar";

describe("visual editor dollar serialization", () => {
  // A single typed dollar remains literal Markdown, while syntax with meaning is preserved.
  it("unescapes isolated prose dollars without changing math or code", () => {
    const input = "Price \\$\n\n$x + 1$\n\n`\\$`\n\n```text\n\\$\n```\n\n\\$a and \\$b";
    expect(unescapeLoneProseDollars(input)).toBe("Price $\n\n$x + 1$\n\n`\\$`\n\n```text\n\\$\n```\n\n\\$a and \\$b");
  });
});

import { describe, expect, it } from "vitest";

import { recentFileName, welcomeRecents } from "./recents";

describe("recents", () => {
  it("shows the last five notes and keeps the newest first", () => {
    const paths = ["a", "b", "c", "d", "e", "f"];
    expect(welcomeRecents(paths)).toEqual(["a", "b", "c", "d", "e"]);
    expect(welcomeRecents(paths, 2)).toEqual(["a", "b"]);
    expect(welcomeRecents(["only"])).toEqual(["only"]);
  });

  it("uses the file name and keeps a loose path whole for the dim line", () => {
    expect(recentFileName("C:/Notes/lecture.typ")).toBe("lecture.typ");
    expect(recentFileName("week/lecture.typ")).toBe("lecture.typ");
    expect(recentFileName("lecture.typ")).toBe("lecture.typ");
  });
});

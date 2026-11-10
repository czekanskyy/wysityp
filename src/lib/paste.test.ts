import { describe, expect, it } from "vitest";
import {
  imageFileName,
  imageInsertion,
  imageMarkup,
  noteRelativeImagePath,
} from "./paste";

describe("image paste", () => {
  it("names a clipboard picture and keeps a real file name", () => {
    expect(imageFileName("image/png", "")).toBe("image.png");
    expect(imageFileName("", "shot.JPEG")).toBe("shot.JPEG");
    expect(imageFileName("image/gif", "noext")).toBe("image.gif");
  });

  it("counts the path from the note, not the folder", () => {
    expect(
      noteRelativeImagePath(
        "week/lecture.typ",
        "week/lecture.assets/slide.png",
      ),
    ).toBe("lecture.assets/slide.png");
    expect(
      noteRelativeImagePath("lecture.typ", "lecture.assets/slide.png"),
    ).toBe("lecture.assets/slide.png");
  });

  it("inserts an image call and not a figure", () => {
    expect(imageMarkup('lecture.assets/a"b.png')).toBe(
      '#image("lecture.assets/ab.png")',
    );
    expect(imageMarkup("a.png")).not.toContain("#figure");
    const mid = imageInsertion("Hello", 5, 5, '#image("a.png")');
    expect(mid.text).toBe('\n#image("a.png")');
    expect(mid.cursor).toBe(5 + mid.text.length);
    const own = imageInsertion("", 0, 0, '#image("a.png")');
    expect(own.text).toBe('#image("a.png")');
  });
});

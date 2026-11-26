import { describe, expect, test } from "vitest";

import { cloudinarySrcSet, cloudinaryWidth } from "./cloudinary";

const original = "https://res.cloudinary.com/demo/image/upload/v1791291242/ums/branding/background/hero.webp";

describe("cloudinary helpers", () => {
  test("adds a resize + auto-format transformation after /upload/", () => {
    expect(cloudinaryWidth(original, 640)).toBe("https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_640/v1791291242/ums/branding/background/hero.webp");
  });

  test("leaves URLs that already have a transformation alone", () => {
    const transformed = "https://res.cloudinary.com/demo/image/upload/w_300/v1/x.webp";
    expect(cloudinaryWidth(transformed, 640)).toBe(transformed);
  });

  test("leaves non-Cloudinary URLs alone and gives them no srcset", () => {
    expect(cloudinaryWidth("https://example.com/a.jpg", 640)).toBe("https://example.com/a.jpg");
    expect(cloudinarySrcSet("https://example.com/a.jpg")).toBeUndefined();
  });

  test("builds a width-descriptor srcset", () => {
    expect(cloudinarySrcSet(original, [640, 1280])).toBe(`${cloudinaryWidth(original, 640)} 640w, ${cloudinaryWidth(original, 1280)} 1280w`);
  });
});

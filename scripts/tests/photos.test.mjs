import { test } from "node:test";
import assert from "node:assert/strict";
import { slugStem } from "../compress-photos.mjs";

test("slugStem lowercases and hyphenates", () => {
  assert.equal(slugStem("PHOTO-ONE.jpg"), "photo-one");
  assert.equal(slugStem("Jane Doe (2).JPG"), "jane-doe-2");
  assert.equal(slugStem("Another.jpeg"), "another");
  assert.equal(slugStem("  --  .png"), "photo");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { slugStem } from "../compress-photos.mjs";

test("slugStem lowercases and hyphenates", () => {
  assert.equal(slugStem("ABHIRAM.jpg"), "abhiram");
  assert.equal(slugStem("Jane Doe (2).JPG"), "jane-doe-2");
  assert.equal(slugStem("Ashfaque.jpeg"), "ashfaque");
  assert.equal(slugStem("  --  .png"), "photo");
});

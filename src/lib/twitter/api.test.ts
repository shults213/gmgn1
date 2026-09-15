import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { normalizeTwitterUsername } from "./api.ts";

describe("normalizeTwitterUsername", () => {
  it("accepts a bare handle", () => {
    assert.equal(normalizeTwitterUsername("elonmusk"), "elonmusk");
  });

  it("accepts an @handle", () => {
    assert.equal(normalizeTwitterUsername("@elonmusk"), "elonmusk");
  });

  it("accepts an x.com URL", () => {
    assert.equal(normalizeTwitterUsername("https://x.com/elonmusk"), "elonmusk");
  });

  it("rejects invalid values", () => {
    assert.equal(normalizeTwitterUsername("https://x.com/elonmusk/with/path"), "elonmusk");
    assert.equal(normalizeTwitterUsername("very-long-handle-that-exceeds-15"), null);
    assert.equal(normalizeTwitterUsername(""), null);
  });
});

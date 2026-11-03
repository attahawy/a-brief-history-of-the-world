import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { load } from "cheerio";
import { storageNamespace } from "../src/lib/site.js";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const document = load(html);
const bootstrap = document("head script:not([src])").text();

for (const [name, stored, expected] of [
  ["saved night", '"night"', "night"],
  ["saved paper", '"paper"', "paper"],
  ["first visit", null, "paper"],
  ["invalid preference", "broken JSON", "paper"],
  ["blocked storage", new Error("Storage blocked"), "paper"],
]) {
  test(`sets the initial page theme before the app loads: ${name}`, () => {
    const root = { dataset: {} };
    const meta = {};
    runInNewContext(bootstrap, {
      localStorage: { getItem(key) {
        assert.equal(key, `${storageNamespace}:theme`);
        if (stored instanceof Error) throw stored;
        return stored;
      } },
      document: { documentElement: root, querySelector: () => meta },
    });
    assert.equal(root.dataset.theme, expected);
    assert.equal(meta.content, expected === "night" ? "#1c2522" : "#f9f7f2");
    assert.ok(html.indexOf(bootstrap) < html.indexOf('<body>'));
  });
}

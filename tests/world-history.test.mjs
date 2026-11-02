import assert from "node:assert/strict";
import test from "node:test";
import { load } from "cheerio";
import { convertWorldHistory, sourceUrl } from "../scripts/import-world-history.mjs";
import { prepareBook } from "../src/lib/book.js";
import { renderMarkdown } from "../src/lib/markdown.js";

const article = (count = 31) => `<div id="content"><h1>مختصر تاريخ العالم من القرآن العظيم والحديث الشريف</h1>${Array.from({ length: count }, (_, i) => `<p>النَّصُّ ${i + 1}<br>تفصيل <strong>محفوظ</strong>${i === 1 ? ' <a href="https://www.dorar.net/hadith/sharh/17531">مرجع الحديث</a>' : ""}</p>`).join("")}<hr><div><a href="/samy/home"></a></div></div>`;

test("history import preserves every original paragraph, order, diacritic and reference while excluding site navigation", () => {
  const html = article();
  const source = load(html);
  const book = convertWorldHistory(html, "2026-11-02T00:00:00Z");
  assert.equal(book.pages.length, 13);
  assert.ok(book.pages.every((page) => page.pageid > 638));
  const rendered = load(book.pages.map((page) => renderMarkdown(page.markdown)).join(""));
  rendered("h1").remove();
  const compact = (text) => text.replace(/\s+/g, "");
  assert.equal(compact(rendered("body").text()), compact(source("#content > p").text()));
  assert.equal(rendered("strong").length, 31);
  assert.deepEqual(rendered("a[href]").map((_, n) => rendered(n).attr("href")).get(), ["https://www.dorar.net/hadith/sharh/17531"]);
  assert.ok(prepareBook(book).pages.every((page) => page.sourceUrl === new URL(sourceUrl).href));
});

test("changed source boundaries are rejected rather than silently omitting or misplacing text", () => {
  assert.throws(() => convertWorldHistory(article(32)), /Source structure changed/);
  assert.throws(() => convertWorldHistory(article().replace('<hr>', '<aside>نص إضافي</aside>')), /Unexpected article content/);
});

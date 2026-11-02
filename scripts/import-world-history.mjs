import assert from "node:assert/strict";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { load } from "cheerio";
import TurndownService from "turndown";
import { renderMarkdown } from "../src/lib/markdown.js";
import { validateBook } from "../src/lib/book.js";

export const sourceUrl = "https://attahawy.com/samy/مختصر-تاريخ-العالم";
const sections = [
  ["بدء الخلق وكتابة المقادير", 1, 2, ["بدء الخلق", "القدر"]],
  ["خلق السماوات والأرض", 3, 7, ["بدء الخلق", "السماوات والأرض"]],
  ["الملأ الأعلى والعرش", 8, 10, ["السماوات والأرض", "الملائكة"]],
  ["خلق آدم وتعليمه", 11, 15, ["آدم", "بدء الخلق"]],
  ["سجود الملائكة وإباء إبليس", 16, 17, ["آدم", "إبليس"]],
  ["آدم وزوجه والخروج من الجنة", 18, 19, ["آدم", "الجنة"]],
  ["ابنا آدم", 20, 20, ["آدم", "قصص القرآن"]],
  ["دعوة نوح إلى قومه", 21, 21, ["نوح", "دعوة الرسل"]],
  ["محاجة آدم وموسى", 22, 22, ["آدم", "موسى", "القدر"]],
  ["نوح أول الرسل ومدة دعوته", 23, 24, ["نوح", "دعوة الرسل"]],
  ["نوح والفلك والطوفان", 25, 26, ["نوح", "الطوفان"]],
  ["الأمم من بعد نوح", 27, 29, ["الأمم السابقة", "قصص القرآن"]],
  ["هود وقوم عاد", 30, 31, ["هود", "عاد", "دعوة الرسل"]],
];
const compact = (text) => text.replace(/\s+/gu, "");

export function convertWorldHistory(html, fetchedAt = new Date().toISOString()) {
  const $ = load(html);
  const content = $("#content");
  assert.equal(content.length, 1, "Expected one article content container");
  assert.equal(content.children("h1").text().trim(), "مختصر تاريخ العالم من القرآن العظيم والحديث الشريف");
  const paragraphs = content.children("p").toArray();
  assert.equal(paragraphs.length, 31, "Source structure changed; review the section boundaries before importing");
  assert.equal(content.children().filter((_, node) => !["h1", "p", "hr"].includes(node.tagName) && $(node).text().trim()).length, 0, "Unexpected article content");
  const converter = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" });
  content.find("a[href]").each((_, node) => {
    $(node).attr("href", new URL($(node).attr("href"), sourceUrl).href);
  });
  const consumed = [];
  const pages = sections.map(([title, start, end, tags], index) => {
    const blocks = paragraphs.slice(start - 1, end);
    consumed.push(...blocks);
    const markdown = blocks.map((node) => converter.turndown($.html(node))).join("\n\n");
    const rendered = load(renderMarkdown(markdown));
    assert.equal(compact(rendered("body").text()), compact(blocks.map((node) => $(node).text()).join("")), `${title}: text changed during conversion`);
    assert.deepEqual(rendered("a[href]").map((_, node) => rendered(node).attr("href")).get(), blocks.flatMap((node) => $(node).find("a[href]").map((_, link) => $(link).attr("href")).get()), `${title}: source links changed`);
    return { pageid: 1001 + index, title, revisionId: 1, tags, markdown: `# ${title}\n\n${markdown}` };
  });
  assert.deepEqual(consumed, paragraphs, "Every source paragraph must appear exactly once, in source order");
  return validateBook({ schemaVersion: 2, sourceUrl, fetchedAt, pages });
}

export async function importWorldHistory() {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
  const html = await response.text();
  const book = convertWorldHistory(html);
  await mkdir(`${root}.cache/world-history`, { recursive: true });
  await writeFile(`${root}.cache/world-history/source.html`, html);
  await writeFile(`${root}.cache/world-history/previous-book.json`, await readFile(`${root}data/book.json`));
  await writeFile(`${root}data/book.json.tmp`, `${JSON.stringify(book, null, 2)}\n`);
  await rename(`${root}data/book.json.tmp`, `${root}data/book.json`);
  console.log(`Imported all 31 source paragraphs and their reference links into ${book.pages.length} ordered history pages.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  importWorldHistory().catch((error) => { console.error(error); process.exitCode = 1; });

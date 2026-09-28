import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { loadKnowledgeBase, parseMarkdown, slugify } from "../src/kb.ts";
import { SearchIndex, tokenize } from "../src/search.ts";

const DOCS = fileURLToPath(new URL("../docs", import.meta.url));

test("markdown splits into one section per ## heading with paragraph chunks", () => {
  const md = "# Guide\n\nIntro ignored.\n\n## First Step!\n\nPara one.\nstill one.\n\nPara two.\n\n## Empty\n\n## Last\n\n- a\n- b\n";
  assert.deepEqual(parseMarkdown("guide.md", md), [
    { source: "guide.md#first-step", title: "Guide › First Step!", paragraphs: ["Para one.\nstill one.", "Para two."] },
    { source: "guide.md#last", title: "Guide › Last", paragraphs: ["- a\n- b"] },
  ]);
  assert.equal(slugify("Two-factor  authentication"), "two-factor-authentication");
});

test("tokenizer lowercases, drops stopwords and folds simple plurals", () => {
  assert.deepEqual(tokenize("How do I add Users to my invoices?"), ["add", "user", "invoice"]);
  assert.deepEqual(tokenize("business access"), ["business", "access"]);
});

test("the bundled docs load into citable sections", async () => {
  const sections = await loadKnowledgeBase(DOCS);
  assert.equal(sections.length, 19);
  assert.ok(sections.every((s) => /^[a-z]+\.md#[a-z0-9-]+$/.test(s.source)));
});

test("search ranks the section that answers the question first", async () => {
  const index = new SearchIndex(await loadKnowledgeBase(DOCS));
  const top = (q: string) => index.search(q, 1)[0]?.section.source;
  assert.equal(top("Can I get a refund on my yearly plan?"), "refunds.md#refund-policy");
  assert.equal(top("do you accept paypal"), "billing.md#payment-methods");
  assert.equal(top("how do I turn on two-factor authentication"), "account.md#two-factor-authentication");
  assert.equal(top("does xero sync back changes"), "integrations.md#accounting-software");
  assert.deepEqual(index.search("zebra quantum", 3), []);
});

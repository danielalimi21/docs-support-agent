import assert from "node:assert/strict";
import { test } from "node:test";
import type Anthropic from "@anthropic-ai/sdk";
import { searchResultBlocks, toReply } from "../src/agent.ts";
import { grade, type EvalCase } from "../src/grade.ts";

type Content = Anthropic.Beta.BetaMessage["content"];
const response = (content: unknown[], stop_reason: Anthropic.Beta.BetaMessage["stop_reason"] = "end_turn") =>
  ({ content: content as Content, stop_reason });

const citation = (source: string, cited_text: string) => ({
  type: "search_result_location", source, title: `Title of ${source}`, cited_text,
  search_result_index: 0, start_block_index: 0, end_block_index: 1,
});

test("sections become citable search_result blocks, one text block per paragraph", () => {
  const [block] = searchResultBlocks([{ source: "a.md#x", title: "A › X", paragraphs: ["one", "two"] }]);
  assert.deepEqual(block, {
    type: "search_result", source: "a.md#x", title: "A › X",
    content: [{ type: "text", text: "one" }, { type: "text", text: "two" }],
    citations: { enabled: true },
  });
});

test("an answer joins text blocks and de-duplicates citations by source", () => {
  const reply = toReply(response([
    { type: "text", text: "Yearly plans can be refunded ", citations: [citation("refunds.md#refund-policy", "Yearly plans can be refunded in full within 30 days.")] },
    { type: "text", text: "within 30 days.", citations: [citation("refunds.md#refund-policy", "Refunds are reviewed by our billing team.")] },
  ]));
  assert.deepEqual(reply, {
    kind: "answer",
    text: "Yearly plans can be refunded within 30 days.",
    citations: [{
      source: "refunds.md#refund-policy",
      title: "Title of refunds.md#refund-policy",
      quote: "Yearly plans can be refunded in full within 30 days.\nRefunds are reviewed by our billing team.",
    }],
  });
});

test("an escalate_to_human call becomes an escalation, with a default message if the model wrote none", () => {
  const reply = toReply(response([
    { type: "tool_use", id: "t1", name: "escalate_to_human", input: { reason: "not_in_docs", summary: "Asks about Salesforce." } },
  ], "tool_use"));
  assert.equal(reply.kind, "escalation");
  assert.ok(reply.kind === "escalation" && reply.reason === "not_in_docs" && reply.text.length > 0);
});

test("refusals and truncated answers become errors, not half answers", () => {
  assert.equal(toReply(response([], "refusal")).kind, "error");
  assert.equal(toReply(response([{ type: "text", text: "The plan costs", citations: null }], "max_tokens")).kind, "error");
});

test("grading checks kind, required citation, required text and escalation reason", () => {
  const answerCase: EvalCase = { id: "x", question: "q", expect: "answer", must_cite: "a.md#x", must_include: ["30 days", ["card", "Visa"]] };
  const good = { kind: "answer" as const, text: "Within 30 DAYS, by Visa.", citations: [{ source: "a.md#x", title: "", quote: "" }] };
  assert.deepEqual(grade(answerCase, good), { pass: true, failures: [] });
  assert.deepEqual(grade(answerCase, { ...good, text: "Soon.", citations: [] }).failures, [
    "did not cite a.md#x (cited: nothing)",
    'missing "30 days"',
    'missing "card" or "Visa"',
  ]);

  const escalateCase: EvalCase = { id: "y", question: "q", expect: "escalate", reason: "needs_staff_action" };
  assert.deepEqual(grade(escalateCase, good).failures, ["expected escalation, got answer"]);
  assert.deepEqual(
    grade(escalateCase, { kind: "escalation", reason: "not_in_docs", summary: "", text: "" }).failures,
    ["escalated with reason not_in_docs, expected needs_staff_action"],
  );
});

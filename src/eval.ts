import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { AgentReply } from "./agent.ts";
import { grade, type EvalCase, type Grade } from "./grade.ts";
import { createAgent } from "./setup.ts";

// Runs every case in evals/cases.json against the live agent and grades it.
// Costs real API calls: 18 cases ≈ 18 requests.

const CONCURRENCY = 4;

const cases: EvalCase[] = JSON.parse(await readFile("evals/cases.json", "utf8"));
const { agent } = await createAgent();

const results: Array<{ case: EvalCase; reply: AgentReply; grade: Grade }> = new Array(cases.length);
let next = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (next < cases.length) {
      const i = next++;
      const reply = await agent.ask(cases[i].question, cases[i].history ?? []);
      results[i] = { case: cases[i], reply, grade: grade(cases[i], reply) };
    }
  }),
);

for (const r of results) {
  console.log(`${r.grade.pass ? "PASS" : "FAIL"}  ${r.case.id}${r.grade.pass ? "" : `: ${r.grade.failures.join("; ")}`}`);
}
const passed = results.filter((r) => r.grade.pass).length;
const byKind = (kind: EvalCase["expect"]) => {
  const subset = results.filter((r) => r.case.expect === kind);
  return `${subset.filter((r) => r.grade.pass).length}/${subset.length}`;
};
console.log(`\n${passed}/${results.length} passed  (answers ${byKind("answer")}, escalations ${byKind("escalate")})`);

await mkdir("evals/results", { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
await writeFile(`evals/results/${stamp}.json`, JSON.stringify(results, null, 2) + "\n");
process.exit(passed === results.length ? 0 : 1);

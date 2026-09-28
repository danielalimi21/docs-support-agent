import type { AgentReply, EscalationReason, Turn } from "./agent.ts";

export interface EvalCase {
  id: string;
  question: string;
  history?: Turn[];
  expect: "answer" | "escalate";
  /** For answers: a source the reply must cite. */
  must_cite?: string;
  /** For answers: each entry must appear in the text; an array entry passes if any alternative appears. */
  must_include?: Array<string | string[]>;
  /** For escalations: the expected reason, if it matters. */
  reason?: EscalationReason;
}

export interface Grade {
  pass: boolean;
  failures: string[];
}

export function grade(testCase: EvalCase, reply: AgentReply): Grade {
  const failures: string[] = [];
  const expectedKind = testCase.expect === "answer" ? "answer" : "escalation";

  if (reply.kind !== expectedKind) {
    failures.push(`expected ${expectedKind}, got ${reply.kind}`);
    return { pass: false, failures };
  }

  if (reply.kind === "answer") {
    if (testCase.must_cite && !reply.citations.some((c) => c.source === testCase.must_cite)) {
      failures.push(`did not cite ${testCase.must_cite} (cited: ${reply.citations.map((c) => c.source).join(", ") || "nothing"})`);
    }
    const text = reply.text.toLowerCase();
    for (const required of testCase.must_include ?? []) {
      const options = Array.isArray(required) ? required : [required];
      if (!options.some((option) => text.includes(option.toLowerCase()))) {
        failures.push(`missing ${options.map((o) => `"${o}"`).join(" or ")}`);
      }
    }
  }

  if (reply.kind === "escalation" && testCase.reason && reply.reason !== testCase.reason) {
    failures.push(`escalated with reason ${reply.reason}, expected ${testCase.reason}`);
  }

  return { pass: failures.length === 0, failures };
}

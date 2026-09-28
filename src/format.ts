import type { AgentReply } from "./agent.ts";

/** Plain-text rendering of a reply for the terminal and the eval report. */
export function formatReply(reply: AgentReply): string {
  if (reply.kind === "answer") {
    const sources = reply.citations.map((c) => `  [${c.source}] ${c.title}`);
    return sources.length > 0 ? `${reply.text}\n\nSources:\n${sources.join("\n")}` : reply.text;
  }
  if (reply.kind === "escalation") {
    return `${reply.text}\n\n→ Handed to a human (${reply.reason}): ${reply.summary}`;
  }
  return `⚠ ${reply.text}`;
}

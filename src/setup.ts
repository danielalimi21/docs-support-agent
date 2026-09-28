import Anthropic from "@anthropic-ai/sdk";
import { SupportAgent } from "./agent.ts";
import { loadKnowledgeBase } from "./kb.ts";
import { SearchIndex } from "./search.ts";

/** Builds the agent from environment config: DOCS_DIR (default ./docs), PRODUCT_NAME (default Tallybook). */
export async function createAgent(): Promise<{ agent: SupportAgent; sectionCount: number; productName: string }> {
  const docsDir = process.env.DOCS_DIR ?? "docs";
  const productName = process.env.PRODUCT_NAME ?? "Tallybook";
  const sections = await loadKnowledgeBase(docsDir);
  const agent = new SupportAgent(new Anthropic(), new SearchIndex(sections), productName);
  return { agent, sectionCount: sections.length, productName };
}

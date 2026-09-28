import { createInterface } from "node:readline/promises";
import type { Turn } from "./agent.ts";
import { formatReply } from "./format.ts";
import { createAgent } from "./setup.ts";

// npm run ask -- "How do I cancel?"   → one answer
// npm run ask                         → interactive chat (empty line to quit)

const { agent, sectionCount, productName } = await createAgent();
const question = process.argv.slice(2).join(" ").trim();

if (question) {
  console.log(formatReply(await agent.ask(question)));
} else {
  console.log(`${productName} support (${sectionCount} help-center sections loaded). Empty line to quit.\n`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const history: Turn[] = [];
  while (true) {
    const line = (await rl.question("you> ")).trim();
    if (!line) break;
    const reply = await agent.ask(line, history);
    console.log(`\n${formatReply(reply)}\n`);
    history.push({ role: "user", text: line }, { role: "assistant", text: reply.text });
  }
  rl.close();
}

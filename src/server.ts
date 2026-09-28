import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { z } from "zod";
import { createAgent } from "./setup.ts";

// POST /api/ask  {"question": "...", "history": [{"role": "user"|"assistant", "text": "..."}]}
// GET  /         the chat widget in public/index.html

const MAX_BODY_BYTES = 32 * 1024;
const MAX_HISTORY_TURNS = 20;

const AskRequest = z.object({
  question: z.string().trim().min(1).max(2000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(8000) }))
    .max(MAX_HISTORY_TURNS)
    .default([]),
});

const { agent, sectionCount, productName } = await createAgent();
const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

function send(res: ServerResponse, status: number, body: string, type = "application/json") {
  res.writeHead(status, { "content-type": `${type}; charset=utf-8` });
  res.end(body);
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new Error("body too large");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/") {
    return send(res, 200, page.replaceAll("{{PRODUCT_NAME}}", productName), "text/html");
  }
  if (req.method === "POST" && req.url === "/api/ask") {
    let parsed;
    try {
      parsed = AskRequest.safeParse(JSON.parse(await readBody(req)));
    } catch {
      return send(res, 400, JSON.stringify({ error: "Request body must be JSON under 32 KB." }));
    }
    if (!parsed.success) return send(res, 400, JSON.stringify({ error: parsed.error.issues[0]?.message ?? "Invalid request." }));
    try {
      const reply = await agent.ask(parsed.data.question, parsed.data.history);
      return send(res, 200, JSON.stringify(reply));
    } catch (err) {
      console.error(err);
      return send(res, 500, JSON.stringify({ error: "Unexpected server error." }));
    }
  }
  send(res, 404, JSON.stringify({ error: "Not found." }));
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`${productName} support on http://localhost:${port} (${sectionCount} sections)`));

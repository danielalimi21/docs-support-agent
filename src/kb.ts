import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

// A knowledge base is a folder of Markdown files. Each file has one "# Title" and
// is split into sections at every "## Heading". A section is the unit that search
// ranks and that the model cites; its paragraphs are the smallest citable pieces.

export interface Section {
  /** Stable reference, e.g. "billing.md#changing-your-plan". */
  source: string;
  /** Human-readable label, e.g. "Plans and billing › Changing your plan". */
  title: string;
  paragraphs: string[];
}

export function slugify(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function parseMarkdown(fileName: string, markdown: string): Section[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const docTitle = lines.find((l) => l.startsWith("# "))?.slice(2).trim() ?? fileName;
  const sections: Section[] = [];
  let heading: string | null = null;
  let body: string[] = [];

  const flush = () => {
    if (heading === null) return;
    const paragraphs = body
      .join("\n")
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (paragraphs.length > 0) {
      sections.push({ source: `${fileName}#${slugify(heading)}`, title: `${docTitle} › ${heading}`, paragraphs });
    }
  };

  for (const line of lines) {
    if (line.startsWith("## ")) {
      flush();
      heading = line.slice(3).trim();
      body = [];
    } else if (heading !== null) {
      body.push(line);
    }
  }
  flush();
  return sections;
}

export async function loadKnowledgeBase(dir: string): Promise<Section[]> {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".md")).sort();
  const sections: Section[] = [];
  for (const file of files) {
    sections.push(...parseMarkdown(file, await readFile(path.join(dir, file), "utf8")));
  }
  if (sections.length === 0) throw new Error(`No "## " sections found in Markdown files under ${dir}`);
  return sections;
}

import type { Section } from "./kb.ts";

// BM25 keyword search over sections. No embeddings service or vector database:
// for a help center of a few hundred sections this is fast, free, deterministic
// and easy to debug. Headings are counted twice because they summarize the section.

const STOPWORDS = new Set(
  "a an and are as at be but by can do does for from how i if in into is it my of on or our so that the their them then there these this to was we what when where which who why will with you your".split(" "),
);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .filter((t) => !STOPWORDS.has(t))
    .map((t) => (t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t));
}

export interface SearchHit {
  section: Section;
  score: number;
}

export class SearchIndex {
  private readonly docs: Array<{ section: Section; terms: Map<string, number>; length: number }>;
  private readonly docFreq = new Map<string, number>();
  private readonly avgLength: number;

  constructor(sections: Section[], private readonly k1 = 1.2, private readonly b = 0.75) {
    this.docs = sections.map((section) => {
      const heading = section.title.split(" › ").pop() ?? "";
      const tokens = [...tokenize(heading), ...tokenize(heading), ...tokenize(section.paragraphs.join(" "))];
      const terms = new Map<string, number>();
      for (const t of tokens) terms.set(t, (terms.get(t) ?? 0) + 1);
      for (const t of terms.keys()) this.docFreq.set(t, (this.docFreq.get(t) ?? 0) + 1);
      return { section, terms, length: tokens.length };
    });
    this.avgLength = this.docs.reduce((sum, d) => sum + d.length, 0) / Math.max(1, this.docs.length);
  }

  search(query: string, limit = 4): SearchHit[] {
    const queryTerms = [...new Set(tokenize(query))];
    const n = this.docs.length;
    return this.docs
      .map(({ section, terms, length }) => {
        let score = 0;
        for (const term of queryTerms) {
          const tf = terms.get(term);
          if (!tf) continue;
          const df = this.docFreq.get(term) ?? 0;
          const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
          score += idf * ((tf * (this.k1 + 1)) / (tf + this.k1 * (1 - this.b + (this.b * length) / this.avgLength)));
        }
        return { section, score };
      })
      .filter((hit) => hit.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

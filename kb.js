// Offline search over PeopleBooks bundled with the extension (built by tools/build_kb.py).
// Claude calls this through the search_peoplebook tool; nothing here leaves the browser.

const KB_FILES = ["kb/peoplebook-fa.json"];

const STOP = new Set(("a an and are as at be by can do does for from has have how i if in into is it its " +
  "of on or that the this to was what when where which why will with you your not no").split(" "));

const tokenize = s => (s.toLowerCase().match(/[a-z0-9]+(?:[_-][a-z0-9]+)*/g) || [])
  .filter(t => t.length > 1 && !STOP.has(t));

let indexPromise = null;

async function loadIndex() {
  const books = await Promise.all(KB_FILES.map(f => fetch(chrome.runtime.getURL(f)).then(r => r.json())));
  const docs = [];
  const df = new Map();
  for (const book of books) {
    for (const [page, crumb, text] of book.pages) {
      // Headings count twice so a page about "Setting Up Pell" ranks above a passing mention.
      const tokens = tokenize(`${crumb} ${crumb} ${text}`);
      const tf = new Map();
      for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
      for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
      docs.push({ book, page, crumb, text, lower: text.toLowerCase(), tf, len: tokens.length });
    }
  }
  const avgLen = docs.reduce((n, d) => n + d.len, 0) / docs.length;
  return { docs, df, avgLen };
}

// BM25 ranking, plus a boost when the exact phrase (e.g. an error message) appears on the page.
export async function searchPeopleBook(query, limit = 5) {
  indexPromise ||= loadIndex();
  const { docs, df, avgLen } = await indexPromise;
  const terms = [...new Set(tokenize(query))];
  if (!terms.length) return [];
  const phrase = query.toLowerCase().replace(/\s+/g, " ").trim();
  const k1 = 1.2, b = 0.75, N = docs.length;

  const scored = [];
  for (const d of docs) {
    let score = 0;
    for (const t of terms) {
      const f = d.tf.get(t);
      if (!f) continue;
      const n = df.get(t);
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.len / avgLen));
    }
    if (score > 0 && phrase.length > 8 && d.lower.includes(phrase)) score *= 2;
    if (score > 0) scored.push({ d, score });
  }
  scored.sort((x, y) => y.score - x.score);

  return scored.slice(0, limit).map(({ d }) => ({
    source: `${d.book.url}#page=${d.page}`,
    title: `${d.book.short} p. ${d.page}: ${d.crumb}`,
    text: d.text
  }));
}

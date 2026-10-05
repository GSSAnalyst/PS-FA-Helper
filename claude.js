// Talks to the Claude API directly from the extension.
import { searchPeopleBook } from "./kb.js";

const API_URL = "https://api.anthropic.com/v1/messages";

// Where Claude is allowed to search and read. Edit this list to add or remove sources.
export const SEARCH_DOMAINS = [
  "docs.oracle.com",      // PeopleSoft PeopleBooks (Campus Solutions online help)
  "fsapartners.ed.gov",   // COD Technical Reference, ISIR Guide, Electronic Announcements, DCLs, FSA Handbook
  "studentaid.gov",
  "csac.ca.gov",          // Cal Grant, MCS
  "ecfr.gov",             // Federal regulations (34 CFR)
  "federalregister.gov"   // Final rules and notices
];

// Key starting points. Sent with the first question so Claude can open them directly
// (the web fetch tool only opens URLs that appeared in the conversation).
export const REFERENCE_LIBRARY = [
  ["FSA Handbook (all volumes)", "https://fsapartners.ed.gov/knowledge-center/fsa-handbook"],
  ["System technical references: COD Technical Reference, ISIR Guide, CPS, SAIG", "https://fsapartners.ed.gov/knowledge-center/library/resource-type/System%20Technical%20References"],
  ["COD XML Schema", "https://fsapartners.ed.gov/knowledge-center/library/resource-type/COD%20XML%20Schema"],
  ["Electronic Announcements", "https://fsapartners.ed.gov/knowledge-center/library/resource-type/Electronic%20Announcements"],
  ["Dear Colleague Letters", "https://fsapartners.ed.gov/knowledge-center/library/resource-type/Dear%20Colleague%20Letters"],
  ["Handbooks, manuals and guides", "https://fsapartners.ed.gov/knowledge-center/library/resource-type/Handbooks%2C%20Manuals%2C%20or%20Guides"],
  ["Worksheets, schedules and tables (Pell schedules, R2T4 worksheets)", "https://fsapartners.ed.gov/knowledge-center/library/resource-type/Worksheets%2C%20Schedules%2C%20and%20Tables"],
  ["Federal Registers", "https://fsapartners.ed.gov/knowledge-center/library/resource-type/Federal%20Registers"],
  ["34 CFR 668 (General provisions, SAP, verification, R2T4)", "https://www.ecfr.gov/current/title-34/subtitle-B/chapter-VI/part-668"],
  ["34 CFR 685 (Direct Loans)", "https://www.ecfr.gov/current/title-34/subtitle-B/chapter-VI/part-685"],
  ["34 CFR 690 (Pell Grant)", "https://www.ecfr.gov/current/title-34/subtitle-B/chapter-VI/part-690"],
  ["PeopleSoft Campus Solutions 9.2 PeopleBooks (all PDFs)", "https://docs.oracle.com/cd/F54774_01/psft/index.html"]
];

const LOCAL_TOOLS = [{
  name: "search_peoplebook",
  description: "Search the full text of the Oracle PeopleBook 'PeopleSoft Campus Solutions 9.2: Financial Aid' (about 1,800 pages, bundled offline). Returns the best-matching pages with page numbers and chapter/section headings. Use it for any question about PeopleSoft FA pages, navigation, setup tables, processes, fields or messages. Use short keyword queries (an error's key words, a page or process name, a field name); search again with different words if the first results miss.",
  input_schema: {
    type: "object",
    properties: { query: { type: "string", description: "Keywords, e.g. 'ISIR suspense management' or 'COD Pell origination reject'" } },
    required: ["query"],
    additionalProperties: false
  },
  strict: true
}];

export function buildSystemPrompt(officeNotes) {
  let prompt = `You are a senior PeopleSoft Campus Solutions Financial Aid analyst helping a university financial aid office team. Your users are business systems analysts and financial aid staff, not developers.

Expertise: PeopleSoft Campus Solutions Financial Aid (ISIR load and suspense, verification, packaging and awarding, Pell, Direct Loans, COD origination and disbursement, SAP, disbursement, R2T4, FA setup tables), plus federal aid rules and COD processing.

Sources available to you:
- search_peoplebook: the complete Oracle Financial Aid PeopleBook, searched locally. Use it first for anything about PeopleSoft behavior, pages, navigation, setup, processes and fields. Cite the pages you use.
- web_search and web_fetch, limited to Oracle docs, FSA Partner Connect, StudentAid.gov, CSAC, eCFR and the Federal Register. Use them for COD rules and edit codes, ISIR fields and comment codes, Pell/Direct Loan rules, Electronic Announcements and regulations. Prefer the current award year's documents. Fetch specific pages or documents; avoid fetching very large PDFs whole when a search result points to the relevant section.

How to answer:
- For an error message: say plainly what it means, list the most likely causes in order, say where to check in PeopleSoft (navigation paths, setup tables, process names), then give fix steps.
- For a screenshot: first read what is on screen (page name, component, fields, messages, values), then answer the question about it. Do not repeat any student names, IDs, SSNs or dates of birth you can see.
- Never invent navigation paths, message set numbers, field names, or COD edit codes. If the sources don't confirm something, say "verify in your environment" and explain what to look for.
- The PeopleBook is the April 2022 edition; mention when newer PeopleTools or regulatory changes may differ.
- Separate delivered PeopleSoft behavior from things that may be campus customizations.
- Keep answers practical and short. Use short headings and steps. No long preambles.
- If the user's text appears to include student personal information, do not repeat it back.`;

  if (officeNotes && officeNotes.trim()) {
    prompt += `\n\nOffice notes written by this team about their own setup and known issues. Treat them as reliable local context, and mention when you use them:\n<office_notes>\n${officeNotes.trim()}\n</office_notes>`;
  }
  return prompt;
}

// Masks things that look like SSNs or student/emplid numbers before anything leaves the browser.
export function maskIds(text) {
  return text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]")
    .replace(/\b\d{7,10}\b/g, "[ID]");
}

// Haiku 4.5 only supports the basic web tools; newer models get dynamic filtering.
function webTools(model) {
  const basic = model.startsWith("claude-haiku");
  return [
    { type: basic ? "web_search_20250305" : "web_search_20260209", name: "web_search",
      allowed_domains: SEARCH_DOMAINS, max_uses: 5 },
    { type: basic ? "web_fetch_20250910" : "web_fetch_20260318", name: "web_fetch",
      allowed_domains: SEARCH_DOMAINS, max_uses: 4, max_content_tokens: 40000, citations: { enabled: true } }
  ];
}

// Puts the reference library in front of the first question (stable text, so it caches).
function withReferenceLibrary(history) {
  const library = "Reference library (you may open these with web_fetch):\n" +
    REFERENCE_LIBRARY.map(([title, url]) => `- ${title}: ${url}`).join("\n");
  const [first, ...rest] = history;
  const content = typeof first.content === "string" ? [{ type: "text", text: first.content }] : first.content;
  return [{ role: "user", content: [{ type: "text", text: library }, ...content] }, ...rest];
}

async function runLocalTool(block) {
  if (block.name !== "search_peoplebook") {
    return { type: "tool_result", tool_use_id: block.id, is_error: true, content: `Unknown tool ${block.name}` };
  }
  const hits = await searchPeopleBook(String(block.input?.query || ""), 5);
  if (!hits.length) {
    return { type: "tool_result", tool_use_id: block.id, content: "No matching PeopleBook pages. Try different keywords." };
  }
  return {
    type: "tool_result", tool_use_id: block.id,
    content: hits.map(h => ({
      type: "search_result", source: h.source, title: h.title,
      content: [{ type: "text", text: h.text }], citations: { enabled: true }
    }))
  };
}

export async function askClaude({ apiKey, model, history, officeNotes, onStatus = () => {} }) {
  const tools = [...LOCAL_TOOLS, ...webTools(model)];
  const fallbacks = model === "claude-sonnet-5-5" || model === "claude-opus-5-5";
  const headers = {
    "content-type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true"
  };
  // If the model declines a request, re-run it on Anthropic's recommended fallback model.
  if (fallbacks) headers["anthropic-beta"] = "server-side-fallback-2026-07-01";

  let messages = withReferenceLibrary(history);
  let allContent = [];
  let stopReason = null;

  // Each round either finishes, pauses a long server-side search ("pause_turn"),
  // or asks us to run search_peoplebook ("tool_use").
  for (let round = 0; round < 10; round++) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        max_tokens: 16000,
        system: buildSystemPrompt(officeNotes),
        tools,
        messages,
        cache_control: { type: "ephemeral" },
        ...(fallbacks && { fallbacks: "default" })
      })
    });

    if (!res.ok) {
      let detail = "";
      try { detail = (await res.json()).error?.message || ""; } catch {}
      if (res.status === 401) throw new Error("The API key was rejected. Check it in Settings.");
      if (res.status === 429) throw new Error("Rate limit reached. Wait a minute and try again.");
      if (res.status === 413) throw new Error("The question is too large. Try fewer or smaller screenshots, or start a new chat.");
      throw new Error(`Claude API error ${res.status}${detail ? ": " + detail : ""}`);
    }

    const data = await res.json();
    const content = data.content || [];
    allContent = allContent.concat(content);
    stopReason = data.stop_reason;
    reportProgress(content, onStatus);

    if (stopReason === "pause_turn") {
      messages = [...messages, { role: "assistant", content }];
      continue;
    }
    if (stopReason === "tool_use") {
      const calls = content.filter(b => b.type === "tool_use");
      const results = await Promise.all(calls.map(runLocalTool));
      messages = [...messages, { role: "assistant", content }, { role: "user", content: results }];
      continue;
    }
    break;
  }

  if (stopReason === "refusal") {
    throw new Error("Claude declined to answer this one. Try rephrasing the question.");
  }
  const result = parseResponse(allContent);
  if (stopReason === "max_tokens") result.text += "\n\n_(Answer was cut off. Ask a follow-up to continue.)_";
  return result;
}

function reportProgress(content, onStatus) {
  for (const b of content) {
    if (b.type === "tool_use" && b.name === "search_peoplebook") onStatus(`Searching the PeopleBook for “${b.input?.query}”`);
    if (b.type === "server_tool_use" && b.name === "web_search") onStatus(`Searched the web for “${b.input?.query}”`);
    if (b.type === "server_tool_use" && b.name === "web_fetch") onStatus(`Read ${shortUrl(b.input?.url)}`);
  }
}

function shortUrl(url) {
  try { const u = new URL(url); return u.hostname + (u.pathname.length > 30 ? u.pathname.slice(0, 30) + "…" : u.pathname); }
  catch { return "a page"; }
}

function parseResponse(content) {
  let text = "";
  const sources = new Map();
  const counts = { peoplebook: 0, web: 0, fetch: 0 };
  const add = (url, title) => { if (url && !sources.has(url)) sources.set(url, { url, title: title || url }); };

  for (const block of content) {
    if (block.type === "tool_use" && block.name === "search_peoplebook") counts.peoplebook++;
    if (block.type === "server_tool_use") counts[block.name === "web_fetch" ? "fetch" : "web"]++;
    if (block.type === "web_fetch_tool_result" && block.content?.type === "web_fetch_result") {
      add(block.content.url, block.content.content?.title);
    }
    if (block.type !== "text") continue;
    text += block.text;
    for (const c of block.citations || []) {
      if (c.type === "search_result_location") add(c.source, c.title);
      else add(c.url, c.title);
    }
  }
  return { text: text.trim(), sources: [...sources.values()], counts };
}

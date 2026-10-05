import { askClaude, maskIds } from "./claude.js";
import { renderMarkdown } from "./markdown.js";

const $ = id => document.getElementById(id);
const thread = $("thread"), input = $("input"), sendBtn = $("send");
let settings = { apiKey: "", model: "claude-sonnet-5-5", maskIds: true, officeNotes: "" };
let history = [];   // [{role, content}] history for follow-up questions (user turns may include screenshots)
let attachments = []; // screenshots waiting to be sent: [{media_type, data, url}]
let busy = false;

const MAX_IMAGES = 5;
const MAX_EDGE = 2000;               // px; keeps screenshot text legible without huge requests
const KEEP_IMAGES_FOR_TURNS = 3;     // older screenshots are dropped from history to keep requests small

// ---------- Settings ----------
async function loadSettings() {
  const s = await chrome.storage.local.get(["apiKey", "model", "maskIds", "officeNotes"]);
  settings = { ...settings, ...s };
  $("maskNote").hidden = !settings.maskIds;
}
function showSettings(show) {
  $("chatView").hidden = show;
  $("settingsView").hidden = !show;
  if (show) {
    $("apiKey").value = settings.apiKey || "";
    $("model").value = settings.model;
    $("maskIds").checked = settings.maskIds;
    $("officeNotes").value = settings.officeNotes || "";
  }
}
$("openSettings").onclick = () => showSettings(true);
$("cancelSettings").onclick = () => showSettings(false);
$("saveSettings").onclick = async () => {
  settings = {
    apiKey: $("apiKey").value.trim(),
    model: $("model").value,
    maskIds: $("maskIds").checked,
    officeNotes: $("officeNotes").value
  };
  await chrome.storage.local.set(settings);
  $("maskNote").hidden = !settings.maskIds;
  showSettings(false);
  input.focus();
};

// ---------- Thread rendering ----------
function add(el) { $("empty")?.remove(); thread.appendChild(el); thread.scrollTop = thread.scrollHeight; return el; }
function div(cls, html) { const d = document.createElement("div"); d.className = cls; if (html != null) d.innerHTML = html; return d; }

function originOf(url) {
  const page = url.match(/\.pdf#page=(\d+)$/);
  if (page) return `PeopleBook p. ${page[1]}`;
  const host = new URL(url).hostname;
  if (host.endsWith("docs.oracle.com")) return "Oracle PeopleBooks";
  if (host.endsWith("fsapartners.ed.gov")) return "FSA Partner Connect";
  if (host.endsWith("studentaid.gov")) return "StudentAid.gov";
  if (host.endsWith("csac.ca.gov")) return "CSAC";
  if (host.endsWith("ecfr.gov")) return "eCFR";
  if (host.endsWith("federalregister.gov")) return "Federal Register";
  return host;
}

function renderAnswer(result) {
  const box = div("msg-answer", renderMarkdown(result.text || "_No answer returned._"));
  if (result.sources.length) {
    const wrap = div("sources");
    for (const s of result.sources) {
      const a = document.createElement("a");
      a.className = "source"; a.href = s.url; a.target = "_blank"; a.rel = "noopener";
      a.innerHTML = `<span class="origin"></span><span class="title"></span>`;
      a.querySelector(".origin").textContent = originOf(s.url);
      a.querySelector(".title").textContent = s.title;
      a.title = s.title;
      wrap.appendChild(a);
    }
    box.appendChild(wrap);
  }
  const meta = div("meta");
  meta.innerHTML = `<span></span><button type="button">Copy answer</button>`;
  meta.querySelector("span").textContent = describeCounts(result.counts);
  meta.querySelector("button").onclick = async e => {
    await navigator.clipboard.writeText(result.text);
    e.target.textContent = "Copied";
    setTimeout(() => (e.target.textContent = "Copy answer"), 1500);
  };
  box.appendChild(meta);
  return box;
}

function describeCounts({ peoplebook, web, fetch }) {
  const plural = (n, word) => `${n} ${word}${n > 1 ? "s" : ""}`;
  const parts = [];
  if (peoplebook) parts.push(`PeopleBook ${plural(peoplebook, "search")}`);
  if (web) parts.push(`web ${plural(web, "search")}`);
  if (fetch) parts.push(`${plural(fetch, "document")} read`);
  return parts.length ? parts.join(" · ") : "Answered without searching";
}

// ---------- Screenshots ----------
function readImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const src = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(src); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(src); reject(new Error(`Couldn't read ${file.name || "that image"}.`)); };
    img.src = src;
  });
}

// Scales the image so its long edge is at most MAX_EDGE, and re-encodes it.
// PNG keeps screen text crisp; very large PNGs fall back to high-quality JPEG.
async function toAttachment(file) {
  const img = await readImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  let url = canvas.toDataURL("image/png");
  if (url.length > 4_000_000) url = canvas.toDataURL("image/jpeg", 0.9);
  const [, media_type, data] = url.match(/^data:(.+?);base64,(.*)$/);
  return { media_type, data, url };
}

async function addFiles(files) {
  const images = [...files].filter(f => f.type.startsWith("image/"));
  for (const file of images) {
    if (attachments.length >= MAX_IMAGES) { flash(`Up to ${MAX_IMAGES} screenshots per question.`); break; }
    try { attachments.push(await toAttachment(file)); }
    catch (err) { flash(err.message); }
  }
  renderAttachments();
}

function renderAttachments() {
  const tray = $("attachments");
  tray.replaceChildren(...attachments.map((a, i) => {
    const item = div("attachment");
    const img = document.createElement("img");
    img.src = a.url; img.alt = `Screenshot ${i + 1}`;
    const remove = document.createElement("button");
    remove.type = "button"; remove.textContent = "×"; remove.title = "Remove screenshot";
    remove.onclick = () => { attachments.splice(i, 1); renderAttachments(); };
    item.append(img, remove);
    return item;
  }));
  tray.hidden = $("imageWarning").hidden = !attachments.length;
}

function flash(message) {
  const note = $("maskNote"), previous = note.textContent, wasHidden = note.hidden;
  note.textContent = message; note.hidden = false; note.classList.add("warn");
  setTimeout(() => { note.textContent = previous; note.hidden = wasHidden; note.classList.remove("warn"); }, 3000);
}

$("attach").onclick = () => $("fileInput").click();
$("fileInput").onchange = e => { addFiles(e.target.files); e.target.value = ""; };
input.addEventListener("paste", e => {
  const files = [...(e.clipboardData?.files || [])];
  if (files.some(f => f.type.startsWith("image/"))) { e.preventDefault(); addFiles(files); }
});
$("composer").addEventListener("dragover", e => { e.preventDefault(); $("composer").classList.add("dragging"); });
$("composer").addEventListener("dragleave", () => $("composer").classList.remove("dragging"));
$("composer").addEventListener("drop", e => {
  e.preventDefault(); $("composer").classList.remove("dragging");
  addFiles(e.dataTransfer.files);
});

// Replaces screenshots in older turns with a note, so long chats stay under the request size limit.
function trimOldImages() {
  const userTurns = history.filter(m => m.role === "user" && Array.isArray(m.content));
  for (const turn of userTurns.slice(0, -KEEP_IMAGES_FOR_TURNS)) {
    if (!turn.content.some(b => b.type === "image")) continue;
    turn.content = turn.content.map(b => b.type === "image" ? { type: "text", text: "[earlier screenshot removed]" } : b);
  }
}

// ---------- Asking ----------
async function ask(raw) {
  const images = attachments;
  const question = raw.trim() || (images.length ? "What does this screenshot show, and what should I do about it?" : "");
  if (!question || busy) return;
  if (!settings.apiKey) { showSettings(true); $("apiKey").focus(); return; }

  const outgoing = settings.maskIds ? maskIds(question) : question;
  const bubble = add(div("msg-user"));
  if (images.length) {
    const strip = div("msg-images");
    for (const a of images) { const img = document.createElement("img"); img.src = a.url; img.alt = "Screenshot"; strip.appendChild(img); }
    bubble.appendChild(strip);
  }
  bubble.appendChild(document.createTextNode(outgoing));
  input.value = "";
  attachments = []; renderAttachments();
  busy = true; sendBtn.disabled = true;
  const waiting = add(div("thinking", images.length ? "Reading the screenshot" : "Searching the PeopleBook and FSA guidance"));

  // Images go before the text: Claude reads them best that way.
  const content = images.length
    ? [...images.map(a => ({ type: "image", source: { type: "base64", media_type: a.media_type, data: a.data } })),
       { type: "text", text: outgoing }]
    : outgoing;
  history.push({ role: "user", content });
  try {
    const result = await askClaude({
      apiKey: settings.apiKey, model: settings.model,
      history, officeNotes: settings.officeNotes,
      onStatus: status => { waiting.textContent = status; thread.scrollTop = thread.scrollHeight; }
    });
    waiting.remove();
    add(renderAnswer(result));
    history.push({ role: "assistant", content: result.text || "(no answer)" });
    if (history.length > 20) history = history.slice(-20);   // keep follow-ups cheap
    trimOldImages();
  } catch (err) {
    history.pop();
    if (images.length && !attachments.length) { attachments = images; renderAttachments(); }   // let them retry
    waiting.remove();
    add(div("error")).textContent = err.message;
  } finally {
    busy = false; sendBtn.disabled = false; input.focus();
  }
}

$("composer").addEventListener("submit", e => { e.preventDefault(); ask(input.value); });
input.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input.value); }
});
document.querySelectorAll("[data-starter]").forEach(b =>
  b.addEventListener("click", () => { input.value = b.dataset.starter; input.focus(); }));

$("newChat").onclick = () => { location.reload(); };

// ---------- Right-click "Ask FA Helper about this" ----------
async function takePending() {
  const { pendingQuestion } = await chrome.storage.session.get("pendingQuestion");
  if (pendingQuestion) {
    await chrome.storage.session.remove("pendingQuestion");
    input.value = `Explain this PeopleSoft error and how to fix it:\n\n${pendingQuestion}`;
    input.focus();
  }
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && changes.pendingQuestion?.newValue) takePending();
});

// ---------- Start ----------
await loadSettings();
if (!settings.apiKey) showSettings(true);
await takePending();

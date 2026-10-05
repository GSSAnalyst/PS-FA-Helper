// Small, safe Markdown renderer: everything is HTML-escaped first.
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

export function renderMarkdown(src) {
  const lines = src.replace(/\r/g, "").split("\n");
  let html = "", list = null, para = [], code = null;

  const flushPara = () => { if (para.length) { html += `<p>${inline(para.join(" "))}</p>`; para = []; } };
  const closeList = () => { if (list) { html += `</${list}>`; list = null; } };

  for (const line of lines) {
    if (code !== null) {
      if (line.trim().startsWith("```")) { html += `<pre><code>${esc(code.join("\n"))}</code></pre>`; code = null; }
      else code.push(line);
      continue;
    }
    if (line.trim().startsWith("```")) { flushPara(); closeList(); code = []; continue; }

    const h = line.match(/^(#{1,4})\s+(.*)/);
    const ul = line.match(/^\s*[-*•]\s+(.*)/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)/);

    if (h) { flushPara(); closeList(); html += `<${h[1].length <= 2 ? "h3" : "h4"}>${inline(h[2])}</${h[1].length <= 2 ? "h3" : "h4"}>`; }
    else if (ul || ol) {
      flushPara();
      const type = ul ? "ul" : "ol";
      if (list !== type) { closeList(); html += `<${type}>`; list = type; }
      html += `<li>${inline((ul || ol)[1])}</li>`;
    }
    else if (!line.trim()) { flushPara(); closeList(); }
    else { closeList(); para.push(line.trim()); }
  }
  if (code !== null) html += `<pre><code>${esc(code.join("\n"))}</code></pre>`;
  flushPara(); closeList();
  return html;
}

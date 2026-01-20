export function markdownToSafeHtml(markdown: string): string {
  const escapeHtml = (s: string) =>
    s
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');

  const applyInline = (s: string) => {
    // After escaping, we can safely add a few whitelisted tags.
    let out = escapeHtml(s);
    out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/`([^`]+?)`/g, '<code>$1</code>');
    return out;
  };

  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const html: string[] = [];

  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      html.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      html.push('</ol>');
      inOl = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      closeLists();
      continue;
    }

    const h3 = line.match(/^###\s+(.*)$/);
    if (h3) {
      closeLists();
      html.push(`<h3>${applyInline(h3[1])}</h3>`);
      continue;
    }

    const h2 = line.match(/^##\s+(.*)$/);
    if (h2) {
      closeLists();
      html.push(`<h2>${applyInline(h2[1])}</h2>`);
      continue;
    }

    const h1 = line.match(/^#\s+(.*)$/);
    if (h1) {
      closeLists();
      html.push(`<h1>${applyInline(h1[1])}</h1>`);
      continue;
    }

    const ul = line.match(/^-\s+(.*)$/);
    if (ul) {
      if (inOl) {
        html.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        html.push('<ul>');
        inUl = true;
      }
      html.push(`<li>${applyInline(ul[1])}</li>`);
      continue;
    }

    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (ol) {
      if (inUl) {
        html.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        html.push('<ol>');
        inOl = true;
      }
      html.push(`<li>${applyInline(ol[1])}</li>`);
      continue;
    }

    closeLists();
    html.push(`<p>${applyInline(line)}</p>`);
  }

  closeLists();

  return html.join('\n');
}

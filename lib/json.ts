// Parses a JSON array of objects; if the model's output was cut off, keeps
// every complete top-level object instead of failing the whole batch.
export function parseJsonObjects<T>(text: string): T[] {
  const startIdx = text.indexOf("[");
  if (startIdx === -1) return [];
  const full = text.match(/\[[\s\S]*\]/);
  if (full) {
    try { return JSON.parse(full[0]); } catch { /* fall through to salvage */ }
  }
  const out: T[] = [];
  let depth = 0, inString = false, escaped = false, objStart = -1;
  for (let i = startIdx + 1; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") { if (depth === 0) objStart = i; depth++; }
    else if (ch === "}") {
      depth--;
      if (depth === 0 && objStart !== -1) {
        try { out.push(JSON.parse(text.slice(objStart, i + 1))); } catch { /* skip malformed */ }
        objStart = -1;
      }
    }
  }
  return out;
}

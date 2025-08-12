// utils/sqlAliasMap.ts
export function buildAliasMap(sql: string): Record<string, string | null> {
    if (!sql) return {};
    const s = sql
      .replace(/--.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
  
    const m = s.match(/select\s+([\s\S]+?)\s+from\s+/i);
    if (!m) return {};
  
    const selectList = m[1];
    const items = splitTopLevel(selectList);
  
    const map: Record<string, string | null> = {};
    for (const raw of items) {
      const part = raw.trim();
      if (!part) continue;
  
      // ✅ 한글/유니코드 별칭도 허용: [^\s,]+
      const asMatch = part.match(/\s+as\s+(\[[^\]]+\]|"[^"]+"|`[^`]+`|[^\s,]+)\s*$/i);
      let alias: string | null = null;
      let expr = part;
  
      if (asMatch) {
        alias = strip(asMatch[1]);
        expr = part.slice(0, asMatch.index).trim();
      } else {
        // AS 없는 경우도 유니코드 허용
        const tail = part.match(/(\[[^\]]+\]|"[^"]+"|`[^`]+`|[^\s,]+)\s*$/);
        alias = tail ? strip(tail[1]) : null;
        if (alias && alias.includes(".")) alias = alias.split(".").pop()!.replace(/\[|\]/g, "");
      }
  
      // 원본 컬럼 추정 (table.col 형태의 마지막 세그먼트)
      let source: string | null = null;
      const srcMatch =
        expr.match(/(?:\[[^\]]+\]|[^\s,()]+)\s*(?:\.\s*)?(?:\[[^\]]+\]|[^\s,()]+)\s*$/) ||
        expr.match(/(\[[^\]]+\]|[^\s,()]+)\s*$/);
  
      if (srcMatch) {
        const token = srcMatch[0].trim();
        const last = token.split(".").pop()!;
        source = strip(last);
      }
  
      if (alias) map[alias] = source;
    }
    return map;
  }
  
  function strip(t: string) {
    if (!t) return t;
    if (t.startsWith("[") && t.endsWith("]")) return t.slice(1, -1);
    if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1);
    if (t.startsWith("`") && t.endsWith("`")) return t.slice(1, -1);
    return t;
  }
  
  function splitTopLevel(selectList: string): string[] {
    const out: string[] = [];
    let cur = "", paren = 0, bracket = 0, quote: string | null = null;
  
    for (let i = 0; i < selectList.length; i++) {
      const ch = selectList[i];
      const prev = i > 0 ? selectList[i - 1] : "";
  
      if (!quote && (ch === "'" || ch === '"')) {
        quote = ch; cur += ch; continue;
      } else if (quote) {
        cur += ch; if (ch === quote && prev !== "\\") quote = null; continue;
      }
  
      if (ch === "(") paren++;
      else if (ch === ")") paren = Math.max(0, paren - 1);
      else if (ch === "[") bracket++;
      else if (ch === "]") bracket = Math.max(0, bracket - 1);
  
      if (ch === "," && paren === 0 && bracket === 0) { out.push(cur); cur = ""; }
      else { cur += ch; }
    }
    if (cur.trim()) out.push(cur);
    return out;
}
  
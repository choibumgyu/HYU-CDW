// utils/formatSql.ts
import { buildAliasMap } from "./sqlAliasMap";

// 핵심: SELECT 리스트를 깔끔하게 줄바꿈 + AS 정렬 + 원본 컬럼 주석 표시
export function formatSqlForDisplay(sql: string): string {
    if (!sql) return "";

    // 1) 주석 제거
    const s = sql
        .replace(/--.*$/gm, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .trim();

    // 2) 주요 절 줄바꿈 (WHERE/GROUP/HAVING 안 AND/OR는 4단계에서 처리)
    let pretty = s
        .replace(/\s+select\s+/i, "\nSELECT ")
        .replace(/\s+from\s+/i, "\nFROM ")
        .replace(/\s+inner\s+join\s+/gi, "\n  INNER JOIN ")
        .replace(/\s+left\s+join\s+/gi, "\n  LEFT JOIN ")
        .replace(/\s+right\s+join\s+/gi, "\n  RIGHT JOIN ")
        .replace(/\s+full\s+join\s+/gi, "\n  FULL JOIN ")
        .replace(/\s+join\s+/gi, "\n  JOIN ")
        .replace(/\s+on\s+/gi, "\n    ON ")
        .replace(/\s+where\s+/i, "\nWHERE ")
        .replace(/\s+group\s+by\s+/i, "\nGROUP BY ")
        .replace(/\s+having\s+/i, "\nHAVING ")
        .replace(/\s+order\s+by\s+/i, "\nORDER BY ");

    // 3) SELECT 리스트 정렬
    const m = pretty.match(/(\nSELECT )([\s\S]+?)(\nFROM )/i);
    if (m) {
        const selectHead = m[1];
        const selectList = m[2];
        const fromHead = m[3];
        const prettySelect = alignSelectItems(selectList, sql);
        pretty = pretty.replace(selectHead + selectList + fromHead, `${selectHead}${prettySelect}${fromHead}`);
    }

    // 4) WHERE/GROUP/HAVING 내부 AND/OR 줄바꿈
    pretty = pretty
        .replace(/\nWHERE([\s\S]*?)(\nGROUP BY|\nHAVING|\nORDER BY|$)/gi, (all, body, tail) => {
            const b = body.replace(/\s+AND\s+/gi, "\n  AND ").replace(/\s+OR\s+/gi, "\n  OR ");
            return `\nWHERE${b}${tail ?? ""}`;
        })
        .replace(/\nGROUP BY([\s\S]*?)(\nHAVING|\nORDER BY|$)/gi, (all, body, tail) => {
            const b = body.replace(/,\s*/g, ",\n  ");
            return `\nGROUP BY${b}${tail ?? ""}`;
        })
        .replace(/\nHAVING([\s\S]*?)(\nORDER BY|$)/gi, (all, body, tail) => {
            const b = body.replace(/\s+AND\s+/gi, "\n  AND ").replace(/\s+OR\s+/gi, "\n  OR ");
            return `\nHAVING${b}${tail ?? ""}`;
        })
        .replace(/\nORDER BY([\s\S]*)$/gi, (all, body) => {
            const b = body.replace(/,\s*/g, ",\n  ");
            return `\nORDER BY${b}`;
        });

    // 5) 괄호 블록 포맷팅 (서브쿼리/EXISTS 등 "SQL스러운" 괄호만) — 함수/IN(...)는 보존
    pretty = formatSqlishParens(pretty);

    // 6) 꼬리 정리
    pretty = pretty.replace(/\s*;\s*$/g, "").replace(/\n{3,}/g, "\n\n");
    return pretty.trim();
}

/** SELECT 항목을 한 줄씩 정렬 + AS 기준 정렬 + (원본컬럼) 주석 추가 */
function alignSelectItems(selectList: string, originalSql: string): string {
    const items = splitTopLevelCompat(selectList);
    const aliasMap = buildAliasMap(originalSql);

    const rows = items.map(raw => {
        const part = raw.trim().replace(/^\s*,\s*/, "");
        const asMatch = part.match(/\s+as\s+(\[[^\]]+\]|"[^"]+"|`[^`]+`|[^\s,]+)\s*$/i);
        if (asMatch) {
            const alias = strip(asMatch[1]);
            const expr = part.slice(0, asMatch.index).trim();
            return { expr, alias };
        }
        const tail = part.match(/(\[[^\]]+\]|"[^"]+"|`[^`]+`|[^\s,]+)\s*$/);
        const alias = tail ? strip(tail[1]).replace(/^\w+\./, "") : null;
        return { expr: part, alias: alias ?? "" };
    });

    const maxExpr = Math.min(120, Math.max(...rows.map(r => r.expr.length), 0));
    const softBreak = (t: string) => {
        if (t.length <= maxExpr) return t;
        const idx = t.slice(0, maxExpr).lastIndexOf(" ");
        return idx > 40 ? t.slice(0, idx) + "\n  " + t.slice(idx + 1) : t;
    };

    const lines = rows.map((r, i) => {
        const source = r.alias ? aliasMap[r.alias] : null;
        const expr = softBreak(r.expr);
        const asPart = r.alias ? ` AS ${r.alias}` : "";
        const comment = source ? `  -- ← ${source}` : "";
        return `  ${expr}${asPart}${comment}${i < rows.length - 1 ? "," : ""}`;
    });

    return "\n" + lines.join("\n");
}

function strip(t: string) {
    if (!t) return t;
    if (t.startsWith("[") && t.endsWith("]")) return t.slice(1, -1);
    if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1);
    if (t.startsWith("`") && t.endsWith("`")) return t.slice(1, -1);
    return t;
}

/** SELECT 리스트를 최상위 콤마 기준으로 분리 */
function splitTopLevelCompat(selectList: string): string[] {
    const out: string[] = [];
    let cur = "", paren = 0, bracket = 0, quote: string | null = null;

    for (let i = 0; i < selectList.length; i++) {
        const ch = selectList[i];
        const prev = i > 0 ? selectList[i - 1] : "";

        if (!quote && (ch === "'" || ch === '"')) { quote = ch; cur += ch; continue; }
        else if (quote) { cur += ch; if (ch === quote && prev !== "\\") quote = null; continue; }

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

/**
 * 괄호 블록 포맷팅(서브쿼리/EXISTS 등 "SQL스러운" 괄호만 들여쓰기)
 * - 괄호 안에 SELECT/WHERE/JOIN/UNION/EXISTS/WITH 등 **키워드가 있을 때만** 줄바꿈/들여쓰기 적용
 * - 함수 호출(YEAR(...), CAST(...))이나 IN(...) 리스트는 **그대로 유지**
 * - 문자열('…' / "…")과 [대괄호 식별자]는 안전하게 건너뜀
 */
function formatSqlishParens(input: string): string {
    let out = "";
    let i = 0;
    let quote: string | null = null;
    let inBracket = false;

    while (i < input.length) {
        const ch = input[i];
        const prev = i > 0 ? input[i - 1] : "";

        // [ 식별자 ] 보호
        if (!quote && ch === "[" && !inBracket) {
            inBracket = true; out += ch; i++; continue;
        }
        if (inBracket) {
            out += ch;
            if (ch === "]") inBracket = false;
            i++;
            continue;
        }

        // 따옴표 보호
        if (!quote && (ch === "'" || ch === '"')) {
            quote = ch; out += ch; i++; continue;
        } else if (quote) {
            out += ch;
            if (ch === quote && prev !== "\\") quote = null;
            i++;
            continue;
        }

        // 여는 괄호 처리
        if (ch === "(") {
            // 이전 토큰이 함수명인지(영문/숫자/언더스코어 또는 ] 로 끝) 체크
            const prevToken = /[\w\]]$/.test(out) ? "maybeFunc" : "other";

            // 대응 닫는 괄호 위치 찾기 (내부 인용/괄호 고려)
            const { end, inner } = grabParenBlock(input, i);

            // 내부에 SQL 키워드가 있으면 "SQL스러운" 괄호로 간주
            const isSqlish = /\b(select|with|exists|from|where|join|group\s+by|order\s+by|union|intersect|except)\b/i.test(inner);

            if (isSqlish && prevToken !== "maybeFunc") {
                // 들여쓰기 수준 계산: 현재 out의 마지막 줄 들여쓰기 공백 수를 기반으로
                const currentIndent = out.match(/(^|\n)([ \t]*)[^\n]*$/)?.[2] ?? "";
                const indent2 = currentIndent + "  ";

                // 내부 줄 앞에 들여쓰기 추가 (양끝 공백 정리)
                const innerTrim = inner.trim();
                const indentedInner = innerTrim
                    .split("\n")
                    .map((line) => indent2 + line.trimEnd())
                    .join("\n");

                out += "(\n" + indentedInner + "\n" + currentIndent + ")";
            } else {
                // 함수 호출/IN 리스트 등은 그대로 유지
                out += "(" + inner + ")";
            }

            i = end + 1; // 블록 끝으로 점프
            continue;
        }

        out += ch;
        i++;
    }

    // 과다 개행 정리
    return out.replace(/\n{3,}/g, "\n\n");
}

/** 현재 위치의 괄호 블록 추출: i는 '(' 인덱스 */
function grabParenBlock(input: string, i: number): { end: number; inner: string } {
    let depth = 0;
    let j = i;
    let quote: string | null = null;
    let inBracket = false;

    for (; j < input.length; j++) {
        const ch = input[j];
        const prev = j > 0 ? input[j - 1] : "";

        if (!quote && ch === "[" && !inBracket) { inBracket = true; continue; }
        if (inBracket) { if (ch === "]") inBracket = false; continue; }

        if (!quote && (ch === "'" || ch === '"')) { quote = ch; continue; }
        if (quote) { if (ch === quote && prev !== "\\") quote = null; continue; }

        if (ch === "(") depth++;
        else if (ch === ")") {
            depth--;
            if (depth === 0) break;
        }
    }

    const inner = input.slice(i + 1, j);
    return { end: j, inner };
}

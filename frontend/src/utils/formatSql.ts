// utils/formatSql.ts
// SQL 포매팅 + SELECT 항목 정렬 + (별칭 옆) 원본컬럼 주석
// 주석은 parser(AST) 기반으로: COUNT(*) → 주석 생략, COUNT(col) → ← col

import { Parser } from "node-sql-parser";

// mssql(T-SQL) 기준. 필요하면 'postgresql' 등으로 변경 가능
const parser = new Parser();

/* ----------------------- 공용 헬퍼 ----------------------- */
function strip(t: string) {
    if (!t) return t;
    if (t.startsWith("[") && t.endsWith("]")) return t.slice(1, -1);
    if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1);
    if (t.startsWith("`") && t.endsWith("`")) return t.slice(1, -1);
    return t;
}

/** AST에서 가장 바깥 SELECT 노드를 찾아 반환 */
function findOutermostSelect(ast: any): any | null {
    const nodes = Array.isArray(ast) ? ast : [ast];

    const dfs = (node: any): any | null => {
        if (!node || typeof node !== "object") return null;
        if (node.type === "select" && node.columns) return node;

        // WITH
        if (node.type === "with" && node.stmt) return dfs(node.stmt);

        // UNION 계열
        if (node.type === "union" && node.left) return dfs(node.left);

        // FROM 서브쿼리
        if (node.type === "select" && node.from) {
            for (const f of node.from) {
                if (f?.expr?.type === "select") {
                    const inner = dfs(f.expr);
                    if (inner) return inner;
                }
            }
        }
        return null;
    };

    for (const n of nodes) {
        const sel = dfs(n);
        if (sel) return sel;
        if (n?.type === "select") return n;
    }
    return null;
}

/** expr에서 "원본 컬럼" 비슷한 것을 최대한 뽑아내기 */
function resolveSourceFromExpr(expr: any): string | null {
    if (!expr) return null;

    if (expr.type === "column_ref") {
        return expr.column || null;
    }

    if (expr.type === "aggr_func" || expr.type === "function") {
        const arg = expr.args?.expr;
        const args = Array.isArray(arg) ? arg : (arg ? [arg] : []);
        if (!args.length) return null; // COUNT(*) 등
        if (args.length === 1 && args[0]?.type === "column_ref") {
            return args[0].column || null;
        }
        return null;
    }

    // CASE/이항식/괄호 등: 안쪽에서 첫 column_ref를 찾음
    if (
        expr.type === "case" ||
        expr.type === "binary_expr" ||
        expr.type === "expr_list" ||
        expr.type === "paren"
    ) {
        const stack = [expr];
        while (stack.length) {
            const cur = stack.pop();
            if (!cur || typeof cur !== "object") continue;
            if (cur.type === "column_ref") return cur.column || null;
            for (const k of Object.keys(cur)) {
                const v = (cur as any)[k];
                if (v && typeof v === "object") {
                    if (Array.isArray(v)) stack.push(...v);
                    else stack.push(v);
                }
            }
        }
        return null;
    }

    return null;
}

/** parser로 SELECT 리스트를 읽어 alias→source 힌트 맵 생성 */
function buildSourceHintMap(sql: string): Record<string, string | null> {
    const hints: Record<string, string | null> = {};
    try {
        const ast = parser.astify(sql, { database: "mssql" } as any);
        const sel = findOutermostSelect(ast);
        if (!sel?.columns) return hints;

        for (const col of sel.columns) {
            // node-sql-parser: { expr, as, ... }
            const aliasRaw = col.as ? String(col.as) : null;
            let alias = aliasRaw ? strip(aliasRaw) : null;

            if (!alias) {
                // 별칭 없고 단일 컬럼이면 그 컬럼명을 alias로 사용
                if (col.expr?.type === "column_ref") alias = col.expr.column || null;
            }
            if (!alias) continue;

            const source = resolveSourceFromExpr(col.expr);
            // COUNT(*) 등은 source=null → 주석 생략
            hints[alias] = source ?? null;
        }
    } catch {
        // 파서 실패 시 힌트 없이 진행
    }
    return hints;
}

/* ----------------------- 본 기능 ----------------------- */

// 핵심: SELECT 리스트를 깔끔하게 줄바꿈 + AS 정렬 + 원본 컬럼 주석 표시
export function formatSqlForDisplay(sql: string): string {
    if (!sql) return "";

    // 1) 주석 제거
    const s = sql
        .replace(/--.*$/gm, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .trim();

    // 2) 주요 절 줄바꿈
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

    // 3) SELECT 리스트 정렬 + 주석
    const m = pretty.match(/(\nSELECT )([\s\S]+?)(\nFROM )/i);
    if (m) {
        const selectHead = m[1];
        const selectList = m[2];
        const fromHead = m[3];
        const prettySelect = alignSelectItems(selectList, sql); // ← 주석 생성 포함
        pretty = pretty.replace(selectHead + selectList + fromHead, `${selectHead}${prettySelect}${fromHead}`);
    }

    // 4) WHERE/GROUP/HAVING 내부 AND/OR 줄바꿈
    pretty = pretty
        .replace(/\nWHERE([\s\S]*?)(\nGROUP BY|\nHAVING|\nORDER BY|$)/gi, (_all, body, tail) => {
            const b = body.replace(/\s+AND\s+/gi, "\n  AND ").replace(/\s+OR\s+/gi, "\n  OR ");
            return `\nWHERE${b}${tail ?? ""}`;
        })
        .replace(/\nGROUP BY([\s\S]*?)(\nHAVING|\nORDER BY|$)/gi, (_all, body, tail) => {
            const b = body.replace(/,\s*/g, ",\n  ");
            return `\nGROUP BY${b}${tail ?? ""}`;
        })
        .replace(/\nHAVING([\s\S]*?)(\nORDER BY|$)/gi, (_all, body, tail) => {
            const b = body.replace(/\s+AND\s+/gi, "\n  AND ").replace(/\s+OR\s+/gi, "\n  OR ");
            return `\nHAVING${b}${tail ?? ""}`;
        })
        .replace(/\nORDER BY([\s\S]*)$/gi, (_all, body) => {
            const b = body.replace(/,\s*/g, ",\n  ");
            return `\nORDER BY${b}`;
        });

    // 5) 괄호 블록 포맷팅 (서브쿼리/EXISTS 등 SQL스러운 괄호만)
    pretty = formatSqlishParens(pretty);

    // 6) 꼬리 정리
    pretty = pretty.replace(/\s*;\s*$/g, "").replace(/\n{3,}/g, "\n\n");
    return pretty.trim();
}

/** SELECT 항목을 한 줄씩 정렬 + AS 기준 정렬 + (원본컬럼) 주석 추가 */
function alignSelectItems(selectList: string, originalSql: string): string {
    // 1) AST 기반 alias→source 힌트 맵 생성
    const sourceHints = buildSourceHintMap(originalSql);

    // 2) 기존 분리 로직으로 항목을 나눠 텍스트 표현/별칭 추출
    const items = splitTopLevelCompat(selectList);

    const rows = items.map(raw => {
        const part = raw.trim().replace(/^\s*,\s*/, "");
        const asMatch = part.match(/\s+as\s+(\[[^\]]+\]|"[^"]+"|`[^`]+`|[^\s,]+)\s*$/i);
        if (asMatch) {
            const alias = strip(asMatch[1]);
            const expr = part.slice(0, asMatch.index).trim();
            return { expr, alias };
        }
        const tail = part.match(/(\[[^\]]+\]|"[^"]+"|`[^`]+`|[^\s,]+)\s*$/);
        const alias = tail ? strip(tail[1]).replace(/^\w+\./, "") : "";
        return { expr: part, alias };
    });

    // 3) 긴 표현식 soft break
    const maxExpr = Math.min(120, Math.max(...rows.map(r => r.expr.length), 0));
    const softBreak = (t: string) => {
        if (t.length <= maxExpr) return t;
        const idx = t.slice(0, maxExpr).lastIndexOf(" ");
        return idx > 40 ? t.slice(0, idx) + "\n  " + t.slice(idx + 1) : t;
    };

    // 4) 라인 생성: 주석은 sourceHints로부터
    const lines = rows.map((r, i) => {
        const expr = softBreak(r.expr);
        const asPart = r.alias ? ` AS ${r.alias}` : "";
        const source = r.alias ? sourceHints[r.alias] : null;
        const comment = source ? `  -- ← ${source}` : ""; // COUNT(*) 등은 null → 주석 생략
        return `  ${expr}${asPart}${comment}${i < rows.length - 1 ? "," : ""}`;
    });

    return "\n" + lines.join("\n");
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
 * 괄호 블록 포맷팅(서브쿼리/EXISTS 등만 들여쓰기)
 * - 함수 호출/IN(...) 리스트는 그대로 유지
 */
function formatSqlishParens(input: string): string {
    let out = "";
    let i = 0;
    let quote: string | null = null;
    let inBracket = false;

    while (i < input.length) {
        const ch = input[i];
        const prev = i > 0 ? input[i - 1] : "";

        if (!quote && ch === "[" && !inBracket) { inBracket = true; out += ch; i++; continue; }
        if (inBracket) { out += ch; if (ch === "]") inBracket = false; i++; continue; }

        if (!quote && (ch === "'" || ch === '"')) { quote = ch; out += ch; i++; continue; }
        else if (quote) { out += ch; if (ch === quote && prev !== "\\") quote = null; i++; continue; }

        if (ch === "(") {
            const prevToken = /[\w\]]$/.test(out) ? "maybeFunc" : "other";
            const { end, inner } = grabParenBlock(input, i);
            const isSqlish = /\b(select|with|exists|from|where|join|group\s+by|order\s+by|union|intersect|except)\b/i.test(inner);

            if (isSqlish && prevToken !== "maybeFunc") {
                const currentIndent = out.match(/(^|\n)([ \t]*)[^\n]*$/)?.[2] ?? "";
                const indent2 = currentIndent + "  ";
                const innerTrim = inner.trim();
                const indentedInner = innerTrim
                    .split("\n")
                    .map((line) => indent2 + line.trimEnd())
                    .join("\n");
                out += "(\n" + indentedInner + "\n" + currentIndent + ")";
            } else {
                out += "(" + inner + ")";
            }
            i = end + 1;
            continue;
        }

        out += ch;
        i++;
    }
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

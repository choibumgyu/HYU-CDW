// utils/sqlAliasMap.ts  (parser 기반 리팩토링)

import { Parser } from 'node-sql-parser';

// mssql(T-SQL) 방언 지정. 필요시 'postgresql' 등으로 교체 가능
const parser = new Parser();

/** 따옴표/대괄호 제거 */
function strip(t?: string | null): string | null {
  if (!t) return null;
  if (t.startsWith("[") && t.endsWith("]")) return t.slice(1, -1);
  if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1);
  if (t.startsWith("`") && t.endsWith("`")) return t.slice(1, -1);
  return t;
}

/** expr에서 "원본 컬럼" 비슷한 것을 최대한 뽑아내기 */
function resolveSourceFromExpr(expr: any): string | null {
  if (!expr) return null;

  // 단일 컬럼 참조: table.column
  if (expr.type === 'column_ref') {
    // expr.column: 실제 컬럼명, expr.table: 테이블 별칭
    return expr.column || null;
  }

  // 집계/함수 호출: COUNT(col), SUM(col) 등
  if (expr.type === 'aggr_func' || expr.type === 'function') {
    const args = Array.isArray(expr.args?.expr) ? expr.args.expr : (expr.args?.expr ? [expr.args.expr] : []);
    // COUNT(*) 인 경우는 소스가 없음
    if (!args.length) return null;
    // 단일 인자가 컬럼이면 그걸 소스로 반환
    if (args.length === 1 && args[0]?.type === 'column_ref') {
      return args[0].column || null;
    }
    return null;
  }

  // CASE, BINARY EXPR 등 복합식: 내부에서 첫 번째 column_ref를 찾는다
  if (expr.type === 'case' || expr.type === 'binary_expr' || expr.type === 'expr_list' || expr.type === 'paren') {
    const stack = [expr];
    while (stack.length) {
      const cur = stack.pop();
      if (!cur || typeof cur !== 'object') continue;
      if (cur.type === 'column_ref') return cur.column || null;
      for (const k of Object.keys(cur)) {
        const v = (cur as any)[k];
        if (v && typeof v === 'object') {
          if (Array.isArray(v)) stack.push(...v);
          else stack.push(v);
        }
      }
    }
    return null;
  }

  return null;
}

/** AST에서 "가장 바깥 SELECT"를 찾아 반환 */
function findOutermostSelect(ast: any): any | null {
  if (!ast) return null;
  // node-sql-parser는 단일문/다중문에 따라 object/array로 나옵니다.
  const nodes = Array.isArray(ast) ? ast : [ast];

  const dfs = (node: any): any | null => {
    if (!node || typeof node !== 'object') return null;
    if (node.type === 'select' && node.columns) return node;

    // WITH 문
    if (node.type === 'with' && node.stmt) return dfs(node.stmt);

    // UNION 계열
    if (node.type === 'union' && node.left) return dfs(node.left);

    // 서브쿼리
    if (node.type === 'select' && node.from) {
      for (const f of node.from) {
        if (f && f.expr && f.expr.type === 'select') {
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
    if (n.type === 'select') return n;
  }
  return null;
}

/**
 * parser 기반 aliasMap 빌드:
 *  - key: SELECT 별칭(표시 이름) 또는 컬럼명
 *  - value: 원본 컬럼명(가능하면) / 함수식인 경우 null
 */
export function buildAliasMap(sql: string): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  if (!sql) return map;

  try {
    const ast = parser.astify(sql, { database: 'mssql' } as any);
    const select = findOutermostSelect(ast);
    if (!select?.columns) return map;

    for (const col of select.columns) {
      // node-sql-parser: { expr, as, ... }
      const aliasRaw: string | null = strip(col.as ?? null);
      let alias: string | null = aliasRaw;

      // 별칭이 없고 단일 컬럼 참조면 그 컬럼명을 alias로 씀
      if (!alias) {
        if (col.expr?.type === 'column_ref') {
          alias = col.expr.column || null;
        } else {
          // 별칭도 없고 함수/표현식이면 의미있는 alias가 없다 → 생략
          alias = null;
        }
      }

      if (!alias) continue;

      const source = resolveSourceFromExpr(col.expr);
      map[alias] = source ?? null;
    }

    return map;
  } catch (_e) {
    // 파서 실패 시, 최소한의 호환을 위해 기존(레거시) 로직으로 폴백
    return legacyBuildAliasMap(sql);
  }
}

/* ------------------------- 레거시 폴백(간단 버전) ------------------------- */
/** 레거시: SELECT 리스트를 정규식으로 찢어서 alias → source 추정 */
function legacyBuildAliasMap(sql: string): Record<string, string | null> {
  const s = sql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  const m = s.match(/select\s+([\s\S]+?)\s+from\s+/i);
  if (!m) return {};
  const selectList = m[1];
  const items = splitTopLevel(selectList);

  const map: Record<string, string | null> = {};
  for (const raw of items) {
    const part = raw.trim();
    if (!part) continue;

    const asMatch = part.match(/\s+as\s+(\[[^\]]+\]|"[^"]+"|`[^`]+`|[^\s,]+)\s*$/i);
    let alias: string | null = null;
    let expr = part;

    if (asMatch) {
      alias = strip(asMatch[1]);
      expr = part.slice(0, asMatch.index).trim();
    } else {
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

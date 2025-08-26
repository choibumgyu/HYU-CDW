// utils/detectPreAggregated.ts
import { shouldHideColumnByName, isSensitiveIdentifierName } from "@/utils/analyzeData";

export type PreAgg = { labelKey: string; countKey: string } | null;

// ── 토큰 정규화 & 이름 매칭 유틸
function canon(s?: string | null) {
  if (!s) return "";
  return String(s)
    .replace(/[\[\]"`]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[\s.\-\/]+/g, "_"); // 공백/점/하이픈/슬래시 → _
}

function nameHas(hay: string, aliasMap?: Record<string, string | null>, ...needles: string[]) {
  const a = canon(hay);
  const b = canon(aliasMap?.[hay] ?? "");
  return needles.some(n => {
    const x = canon(n);
    return a.includes(x) || (b && b.includes(x));
  });
}

// 숫자/정수 판정 (숫자 문자열 허용)
const isFiniteNumber = (v: any): boolean => {
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v === "string") {
    const n = Number(v.trim());
    return Number.isFinite(n);
  }
  return false;
};
const isIntLike = (v: any) => isFiniteNumber(v) && Math.floor(Number(v)) === Number(v);

const uniqueSize = (arr: any[]) => new Set(arr.map(v => String(v))).size;
const duplicateRatio = (arr: any[]) => {
  const n = arr.length, u = uniqueSize(arr);
  return n === 0 ? 0 : (n - u) / n;
};

const DUP_RATIO_THRESHOLD = 0.02;      // 라벨 중복비율(=중복 적으면 사전집계)
const MAX_LABEL_CARDINALITY = 100;     // 라벨 후보 상한

// 숫자/정수 판정 (숫자 문자열 허용) 등 기존 유틸은 그대로 두고,
// 아래 detectPreAggregated 함수만 교체하세요.

// count 이름 힌트
const hasCountHint = (col: string, aliasMap?: Record<string, string | null>) =>
  nameHas(col, aliasMap, "count", "cnt", "num", "number", "total", "sum", "n", "건수", "횟수", "수");

// ✅ aliasMap을 인자로 받도록 변경!
export function detectPreAggregated(
  rows: Array<Record<string, any>>,
  aliasMap?: Record<string, string | null>
): PreAgg {
  if (!rows?.length) return null;
  const cols = Object.keys(rows[0] ?? {});
  if (cols.length < 2) return null;

  // ─────────────────────────────────────────────────────────
  // 0) 2컬럼 특수 처리: 방향을 확정적으로 고정
  //    라벨은 저카디널리티, 값은 수치형(정수 위주) + count 이름 힌트 가점
  if (cols.length === 2) {
    const [a, b] = cols;

    const isNum = (k: string) => rows.every(r => isFiniteNumber(r?.[k]));
    const intRatio = (k: string) =>
      rows.filter(r => isIntLike(r?.[k])).length / Math.max(rows.length, 1);
    const card = (k: string) => uniqueSize(rows.map(r => r[k]));

    const score = (labelKey: string, countKey: string) => {
      let s = 0;
      if (isNum(countKey)) s += 5;                       // 값이 수치형
      if (intRatio(countKey) >= 0.9) s += 2;             // 값이 정수 위주
      s += Math.max(0, 100 - Math.min(card(labelKey), 100)); // 라벨 카디널리티 낮을수록 가점
      if (hasCountHint(countKey, aliasMap)) s += 50;     // count 이름 힌트
      return s;
    };

    const cand1 = { labelKey: a, countKey: b, score: score(a, b) };
    const cand2 = { labelKey: b, countKey: a, score: score(b, a) };
    const best = cand1.score >= cand2.score ? cand1 : cand2;

    // 사전집계 성립(라벨 중복 매우 적고 값 전부 수치) 확인 후 반환
    const dupRatio = duplicateRatio(rows.map(r => r[best.labelKey]));
    const looksPreAgg =
      rows.every(r => isFiniteNumber(r[best.countKey])) && dupRatio <= DUP_RATIO_THRESHOLD;
    if (looksPreAgg) return { labelKey: best.labelKey, countKey: best.countKey };
    // 2컬럼인데 조건이 아슬하면 아래 일반 경로로 한 번 더 시도
  }

  // ─────────────────────────────────────────────────────────
  // 1) 값(count) 열 후보 선택: 이름 힌트가 있는 컬럼을 동점 시 우선
  const numericCols = cols.filter(c => rows.every(r => isFiniteNumber(r?.[c])));
  if (!numericCols.length) return null;

  const countScore = (col: string) =>
    (hasCountHint(col, aliasMap) ? 10 : 0) +
    (rows.filter(r => isIntLike(r[col])).length / rows.length >= 0.95 ? 1 : 0);

  const countKey = numericCols
    .map(c => ({ c, score: countScore(c), hint: hasCountHint(c, aliasMap) ? 1 : 0 }))
    .sort((a, b) => (b.score - a.score) || (b.hint - a.hint))[0]?.c;
  if (!countKey) return null;

  // ─────────────────────────────────────────────────────────
  // 2) 라벨(label) 열 후보
  const displayable = cols.filter(
    c => c !== countKey && !shouldHideColumnByName(c) && !isSensitiveIdentifierName(c)
  );

  // 2-1) 이름 힌트(별칭/원본 포함)
  let labelKey =
    displayable.find(c =>
      nameHas(c, aliasMap, "concept_id", "source_value", "concept", "concept_name", "name", "desc", "label")
    ) ?? null;

  // 2-2) 문자열/NULL 허용 (저카디널리티)
  if (!labelKey) {
    const isStringish = (v: any) => v == null || typeof v === "string";
    const stringCandidates = displayable
      .filter(c => rows.every(r => isStringish(r?.[c])))
      .map(c => ({ c, card: uniqueSize(rows.map(r => r[c])) }))
      .filter(x => x.card > 1 && x.card <= MAX_LABEL_CARDINALITY)
      .sort((a, b) => a.card - b.card);
    labelKey = stringCandidates[0]?.c ?? null;
  }

  // 2-3) 숫자 이산값(정수 위주) 후보
  if (!labelKey) {
    const numericDiscrete = displayable
      .filter(c => rows.every(r => isFiniteNumber(r?.[c])))
      .map(c => {
        const vals = rows.map(r => r[c]);
        const card = uniqueSize(vals);
        const intR = rows.filter(r => isIntLike(r[c])).length / rows.length;
        return { c, card, intR };
      })
      .filter(x => x.card > 1 && x.card <= MAX_LABEL_CARDINALITY && x.intR >= 0.9)
      .sort((a, b) => a.card - b.card);
    labelKey = numericDiscrete[0]?.c ?? displayable[0] ?? null;
  }

  if (!labelKey) return null;

  // ─────────────────────────────────────────────────────────
  // 3) 마지막 스왑 세이프가드: 라벨이 count처럼 보이고 값이 그렇지 않으면 교체
  let finalLabel = labelKey;
  let finalCount = countKey;
  if (hasCountHint(finalLabel, aliasMap) && !hasCountHint(finalCount, aliasMap)) {
    [finalLabel, finalCount] = [finalCount, finalLabel];
  }

  // 사전집계 판정: 라벨 중복 거의 없음 + 값이 수치
  const dupRatio = duplicateRatio(rows.map(r => r[finalLabel]));
  const looksPreAgg =
    rows.every(r => isFiniteNumber(r[finalCount])) && dupRatio <= DUP_RATIO_THRESHOLD;
  if (!looksPreAgg) return null;

  return { labelKey: finalLabel, countKey: finalCount };
}


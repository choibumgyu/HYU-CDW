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

// ✅ aliasMap을 인자로 받도록 변경!
export function detectPreAggregated(
  rows: Array<Record<string, any>>,
  aliasMap?: Record<string, string | null>
): PreAgg {
  if (!rows?.length) return null;
  const cols = Object.keys(rows[0]);
  if (cols.length < 2) return null;

  // ----- 값(count) 열 후보 -----
  const numericCols = cols.filter(c => rows.every(r => isFiniteNumber(r?.[c])));
  if (!numericCols.length) return null;

  const countScore = (col: string) =>
    (nameHas(col, aliasMap, "count","cnt","num","number","total","sum","n","건수","횟수","수") ? 10 : 0) +
    (rows.filter(r => isIntLike(r[col])).length / rows.length >= 0.95 ? 1 : 0);

  const countKey = numericCols
    .map(c => ({ c, score: countScore(c) }))
    .sort((a, b) => b.score - a.score)[0]?.c;
  if (!countKey) return null;

  // ----- 라벨(label) 열 후보 -----
  const displayable = cols.filter(c => c !== countKey && !shouldHideColumnByName(c) && !isSensitiveIdentifierName(c));

  // 1) 이름 힌트(별칭/원본 포함)
  let labelKey = displayable.find(c => nameHas(c, aliasMap, "concept_id","source_value","concept","concept_name","name","desc","label"));

  // 2) 문자열/NULL 허용 (저카디널리티)
  if (!labelKey) {
    const isStringish = (v: any) => v == null || typeof v === "string";
    const stringCandidates = displayable
      .filter(c => rows.every(r => isStringish(r?.[c])))
      .map(c => ({ c, card: uniqueSize(rows.map(r => r[c])) }))
      .filter(x => x.card > 1 && x.card <= MAX_LABEL_CARDINALITY)
      .sort((a, b) => a.card - b.card);
    labelKey = stringCandidates[0]?.c;
  }

  // 3) 숫자 이산값(정수 위주) 후보
  if (!labelKey) {
    const numericDiscrete = displayable
      .filter(c => rows.every(r => isFiniteNumber(r?.[c])))
      .map(c => {
        const vals = rows.map(r => r[c]);
        const card = uniqueSize(vals);
        const intRatio = rows.filter(r => isIntLike(r[c])).length / rows.length;
        return { c, card, intRatio };
      })
      .filter(x => x.card > 1 && x.card <= MAX_LABEL_CARDINALITY && x.intRatio >= 0.9)
      .sort((a, b) => a.card - b.card);
    labelKey = numericDiscrete[0]?.c ?? displayable[0] ?? null;
  }

  if (!labelKey) return null;

  // ----- 사전집계 판정: 라벨 중복이 거의 없음 + 값이 전부 수치 -----
  const dupRatio = duplicateRatio(rows.map(r => r[labelKey]));
  const looksPreAgg = rows.every(r => isFiniteNumber(r[countKey])) && dupRatio <= DUP_RATIO_THRESHOLD;
  if (!looksPreAgg) return null;

  return { labelKey, countKey };
}

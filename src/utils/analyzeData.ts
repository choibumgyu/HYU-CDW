// utils/analyzeData.ts

// ──────────────────────────────
// 내부 유틸: 이름/값 기반 필터링 규칙
const ID_NAME_PATTERNS = [
  /(^|[_\.])(identifier|pk)($|_)/i,
  /_key$/i,
  /source_concept_id$/i,
  /type_concept_id$/i,
];

const ID_EXACT_NAMES = new Set([
  "id", "logid", "unique_device_id",
]);

// 민감 식별자(한글/영문) 이름 패턴: 반드시 숨김
const SENSITIVE_NAME_PATTERNS = [
  /(환자)?등록번호|환자번호|병록번호|차트번호/i,
  /\b(mrn|chart(_?no)?|registration(_?no)?)\b/i,
];

// concept 테이블이 없어도 보여주고 싶은 concept_id 예외
const EXCEPTION_CONCEPT_IDS = new Set([
  "gender_concept_id",
  "race_concept_id",
  "ethnicity_concept_id",
  "visit_concept_id",
  "condition_concept_id",
  "drug_concept_id",
  "procedure_concept_id",
  "measurement_concept_id",
  "observation_concept_id",
]);

const DATE_NAME_PATTERNS = [
  /_date$/i,
  /_datetime$/i,
  /_time$/i,
  /(^|_)(timestamp)$/i,
  /(^|_)birth_datetime$/i,
  /(^|_)death_date$/i,
  /(^|_)visit_(start|end)_date$/i,
  /(^|_)condition_(start|end)_date$/i,
  /(^|_)measurement_date$/i,
];

const TEXT_NAME_PATTERNS = [
  /(^|_)(content|description|desc|note|remark|remarks|comment|error_msg|text)($|_)/i,
];


// 무조건 제외할 특정 *_source_value
const FORCE_SKIP_SOURCE_VALUES = new Set([
  "person_source_value",
  "provider_source_value",
  "location_source_value",
]);

function percentile(nums: number[], p: number) {
  if (nums.length === 0) return NaN;
  const s = [...nums].sort((a, b) => a - b);
  const idx = (s.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return s[lo];
  const w = idx - lo;
  return s[lo] * (1 - w) + s[hi] * w;
}

// 값 기반 판정: 날짜처럼 보이는 문자열?
function looksLikeDateValue(v: unknown): boolean {
  if (v instanceof Date && !isNaN(v.valueOf())) return true;
  if (typeof v !== "string") return false;
  const s = v.trim();
  if (/^\d{4}$/.test(s)) return false;              // 연도 단독은 제외
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(s)) return true; // 2025-08-05 / 2025/08/05
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return true; // ISO 8601
  return false;
}

// 값 기반 판정: 장문 텍스트?
function looksLikeLongText(values: unknown[]): boolean {
  const strings = values
    .filter(v => v != null)
    .map(v => String(v));
  if (strings.length === 0) return false;
  const maxLen = strings.reduce((m, t) => Math.max(m, t.length), 0);
  const avgLen = strings.reduce((s, t) => s + t.length, 0) / strings.length;
  return maxLen >= 256 || avgLen >= 64;
}

// 값 기반 판정: ID처럼 보이는 정수 & 높은 고유비율
function looksLikeIdByStats(values: unknown[]): boolean {
  const filtered = values.filter(v => v != null);
  if (!filtered.length) return false;

  const strings = filtered.map(v => String(v).trim());

  // R1) 자릿수 많은 숫자 형태(예: 6자리 이상) 비중이 높으면 ID로 간주 (샘플 적어도 적용)
  const longDigitRatio = strings.filter(s => /^\d{6,}$/.test(s)).length / strings.length;
  if (longDigitRatio >= 0.8) return true;

  // 숫자 변환
  const asNum = strings
    .map(s => Number(s))
    .filter(n => typeof n === "number" && Number.isFinite(n)) as number[];

  if (!asNum.length) return false;

  // R2) 소표본 완화: n>=20이면 완화된 기준 적용, n>=100이면 기존의 엄격 기준
  const n = asNum.length;
  const intRatio = asNum.filter(n => Number.isInteger(n)).length / n;
  const uniqRatio = new Set(strings).size / strings.length;

  if (n >= 100) {
    // 기존 엄격 기준
    if (intRatio >= 0.98 && uniqRatio >= 0.98) return true;
  } else if (n >= 20) {
    // 완화 기준
    if (intRatio >= 0.9 && uniqRatio >= 0.9) return true;
  }

  // R3) 값 범위가 지나치게 넓은 정수(연속형 분포 아님)도 ID로 의심
  if (n >= 20 && intRatio >= 0.95) {
    const min = Math.min(...asNum);
    const max = Math.max(...asNum);
    const range = max - min;
    // 범위가 표본 수 대비 너무 커서 카운트/측정치라 보기 어려운 경우
    if (range > n * 50) return true;
  }

  return false;
}


function normalizeName(name: string): string {
  return name.replace(/\[|\]/g, "").trim().toLowerCase();
}

// 이름 기반 스킵 규칙
function shouldSkipByName(normalizedName: string): boolean {
  // 민감 패턴만 차단
  if (SENSITIVE_NAME_PATTERNS.some(rx => rx.test(normalizedName))) return true;

  // 강제 블랙리스트 source_value만 차단
  if (FORCE_SKIP_SOURCE_VALUES.has(normalizedName)) return true;

  // 날짜/텍스트
  if (DATE_NAME_PATTERNS.some(rx => rx.test(normalizedName))) return true;
  if (TEXT_NAME_PATTERNS.some(rx => rx.test(normalizedName))) return true;

  return false;
}


// ──────────────────────────────
// 공개 API

// 범주형 컬럼 자동 감지 (고유값이 적은 경우)
export function detectCategoricalColumns(data: any[], threshold = 10): string[] {
  if (!data || data.length === 0) return [];
  const uniq: Record<string, Set<any>> = {};
  data.forEach(row => {
    for (const k in row) {
      (uniq[k] ??= new Set()).add(row[k]);
    }
  });
  return Object.entries(uniq)
    .filter(([_, set]) => set.size <= threshold)
    .map(([k]) => k);
}

// 숫자형이지만 실제로는 범주형인 컬럼 감지
export function detectNumericCategoricalColumns(data: any[], threshold = 10): string[] {
  if (!data || data.length === 0) return [];
  const out: string[] = [];
  const cols = Object.keys(data[0]);
  for (const col of cols) {
    const values = data.map(r => r[col]).filter(v => v != null);
    const uniq = new Set(values);
    const allNumeric = Array.from(uniq).every(v => typeof v === "number" || !isNaN(Number(v as any)));
    if (allNumeric && uniq.size > 1 && uniq.size <= threshold) out.push(col);
  }
  return out;
}

// 결측치 많거나 단일값만 있는 컬럼 제외
export function filterValidColumns(data: any[]): string[] {
  if (!data || data.length === 0) return [];
  const cols = Object.keys(data[0]);
  const n = data.length;

  const noMissing = cols.filter(c => {
    const miss = data.filter(r => r[c] == null).length;
    // 기존: miss / n < 0.5
    return miss / n < 0.8; // 결측 허용률 완화
  });
  const noUniform = noMissing.filter(c => new Set(data.map(r => r[c])).size > 1);
  return noUniform;
}

// 요약 생성
export function analyzeDataSummary(
  data: any[],
  aliasMap?: Record<string, string | null>
) {
  if (!data || data.length === 0) return null;

  const result: Record<string,
    | { type: "numericContinuous"; mean: number; min: number; max: number; distribution: number[]; binLabels: string[] }
    | { type: "categorical"; counts: Record<string, number> }
  > = {};

  const cols = filterValidColumns(data);

  for (const col of cols) {
    const originalName = normalizeName(aliasMap?.[col] ?? col);

    // 1) 이름 기반 스킵
    if (shouldSkipByName(originalName)) continue;

    const values = data.map(r => r[col]);

    // 개념/소스 컬럼 허용 여부 (ID 통계기반 필터에서 예외)
    const conceptAllowed =
      /_concept_id$/i.test(originalName) && EXCEPTION_CONCEPT_IDS.has(originalName);
    const sourceAllowed =
      /_source_value$/i.test(originalName) && !FORCE_SKIP_SOURCE_VALUES.has(originalName);

    // 2) 값 기반 스킵
    const dateLikeRatio = values.filter(looksLikeDateValue).length / Math.max(values.length, 1);
    if (dateLikeRatio >= 0.7) continue; // 70% 이상이 날짜처럼 보일 때만 제외
    if (looksLikeLongText(values)) continue;

    // 👉 개념/소스 컬럼은 ID-통계 기반 필터 예외 (분포 보려고 허용)
    if (!conceptAllowed && !sourceAllowed && looksLikeIdByStats(values)) continue;

    // 3) 통계 분류
    const coerceNum = (v: any) => (typeof v === "number" ? v : (typeof v === "string" ? Number(v.trim()) : NaN));
    const numericValues = values
      .map(coerceNum)
      .filter((n) => Number.isFinite(n)) as number[];

    if (numericValues.length > 0) {
      const uniqueSize = new Set(numericValues).size;
      const DISCRETE_THRESHOLD = 15;

      if (uniqueSize <= DISCRETE_THRESHOLD) {
        // 숫자형이지만 실질적으로 범주형
        const counts: Record<string, number> = {};
        numericValues.forEach(v => {
          const k = v.toString();
          counts[k] = (counts[k] || 0) + 1;
        });
        result[col] = { type: "categorical", counts };
      } else {
        // 연속형 numeric: p95 상한 + 꼬리 bin
        const mean = numericValues.reduce((s, v) => s + v, 0) / numericValues.length;
        const min = Math.min(...numericValues);
        const rawMax = Math.max(...numericValues);

        const p95 = percentile(numericValues, 0.95);
        const useTailBinning = (rawMax / Math.max(1, p95)) > 1.5;
        const max = useTailBinning ? p95 : rawMax;

        const bins = 10;
        const range = Math.max(1, max - min);
        const step = range / bins;
        const distribution = Array(bins + (useTailBinning ? 1 : 0)).fill(0);

        numericValues.forEach(v => {
          if (useTailBinning && v > max) {
            distribution[bins]++;
          } else {
            const idx = Math.min(bins - 1, Math.floor((v - min) / step));
            distribution[idx]++;
          }
        });

        const binLabels: string[] = Array.from({ length: bins }, (_, i) => {
          const start = Math.round(min + i * step);
          const end = Math.round(min + (i + 1) * step);
          return `${start}-${end}`;
        });
        if (useTailBinning) binLabels.push(`≥ ${Math.round(max)}`);

        result[col] = {
          type: "numericContinuous",
          mean,
          min,
          max: rawMax, // 실제 최대값은 그대로 표시
          distribution,
          binLabels
        };
      }
    } else {
      // 문자열/불리언 등 → 범주형
      const counts: Record<string, number> = {};
      values.forEach(v => {
        const k = (v == null ? "NULL" : String(v));
        counts[k] = (counts[k] || 0) + 1;
      });
      result[col] = { type: "categorical", counts };
    }
  }

  return result;
}

// ──────────────────────────────
// 외부에서 재사용할 헬퍼들

export function _normalizeName_forPublic(name: string): string {
  return normalizeName(name);
}

export function shouldHideColumnByName(name: string): boolean {
  return shouldSkipByName(normalizeName(name));
}

// 사전집계/차트 등에서 바로 쓸 수 있게: 민감 식별자 이름 감지
export function isSensitiveIdentifierName(name: string): boolean {
  const n = normalizeName(name);

  // concept_id는 차단 안 함 (예외 목록 유지할 필요 없음)
  if (/_concept_id$/i.test(n)) return false;

  // 민감 패턴
  if (SENSITIVE_NAME_PATTERNS.some(rx => rx.test(n))) return true;

  // 블랙리스트 ID만 차단
  if (ID_EXACT_NAMES.has(n)) return true;

  return false;
}
// utils/analyzeData.ts

// ──────────────────────────────
// 내부 유틸: 이름/값 기반 필터링 규칙
const ID_NAME_PATTERNS = [
  /(^|[_\.])(id|identifier|pk)($|_)/i,
  /_id$/i,
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

// _source_value 정책
//   - 기본: 전부 제외
//   - 예외(유지): 아래 화이트리스트
const ALLOWED_SOURCE_VALUES = new Set([
  "gender_source_value",
  "race_source_value",
  "ethnicity_source_value",
  "drug_source_value",
  "condition_source_value",
  "procedure_source_value",
  "measurement_source_value",
  "observation_source_value",
  "device_source_value",
  "specimen_source_value",
]);

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

// --- 유틸 헬퍼 ---
function isConceptLikeAllowed(name: string): boolean {
  const n = normalizeName(name);
  return /_concept_id$/i.test(n) && EXCEPTION_CONCEPT_IDS.has(n);
}
function isAllowedSourceValueName(name: string): boolean {
  const n = normalizeName(name);
  return /_source_value$/i.test(n) && ALLOWED_SOURCE_VALUES.has(n);
}

// 값 기반 판정: 날짜처럼 보이는 문자열?
function looksLikeDateValue(v: unknown): boolean {
  if (v instanceof Date && !isNaN(v.valueOf())) return true;
  if (typeof v !== "string") return false;
  const s = v.trim();
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
  if (filtered.length === 0) return false;
  const nums = filtered.filter(v => typeof v === "number" && Number.isFinite(v)) as number[];
  if (nums.length === 0) return false;
  const intRatio = nums.filter(n => Number.isInteger(n)).length / nums.length;
  const uniqueRatio = new Set(filtered.map(v => String(v))).size / filtered.length;
  return intRatio > 0.95 && uniqueRatio > 0.8;
}

function normalizeName(name: string): string {
  return name.replace(/\[|\]/g, "").trim().toLowerCase();
}

// 이름 기반 스킵 규칙
function shouldSkipByName(normalizedName: string): boolean {
  // concept_id: 예외만 허용, 나머지는 이름기반으로 스킵
  if (/_concept_id$/i.test(normalizedName) && !EXCEPTION_CONCEPT_IDS.has(normalizedName)) {
    return true;
  }

  // 민감 식별자(등록번호/MRN/차트번호 등) 우선 차단
  if (SENSITIVE_NAME_PATTERNS.some(rx => rx.test(normalizedName))) return true;

  // 일반적인 *_id / *_key
  if (ID_EXACT_NAMES.has(normalizedName)) return true;
  if (ID_NAME_PATTERNS.some(rx => rx.test(normalizedName))) return true;

  // 날짜/장문 텍스트
  if (DATE_NAME_PATTERNS.some(rx => rx.test(normalizedName))) return true;
  if (TEXT_NAME_PATTERNS.some(rx => rx.test(normalizedName))) return true;

  // *_source_value 정책: 허용 셋만 통과
  if (/_source_value$/i.test(normalizedName) && !ALLOWED_SOURCE_VALUES.has(normalizedName)) {
    return true;
  }

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
    return miss / n < 0.5;
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
      /_source_value$/i.test(originalName) && ALLOWED_SOURCE_VALUES.has(originalName);

    // 2) 값 기반 스킵
    if (values.some(looksLikeDateValue)) continue;
    if (looksLikeLongText(values)) continue;

    // 👉 개념/소스 컬럼은 ID-통계 기반 필터 예외 (분포 보려고 허용)
    if (!conceptAllowed && !sourceAllowed && looksLikeIdByStats(values)) continue;

    // 3) 통계 분류
    const numericValues = values.filter(
      v => typeof v === "number" && Number.isFinite(v as number)
    ) as number[];

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

    // concept_id 처리: 기본은 민감(숨김), 예외만 허용
    if (/_concept_id$/i.test(n)) {
      return !EXCEPTION_CONCEPT_IDS.has(n);
    }

    // 민감 식별자 패턴
    if (SENSITIVE_NAME_PATTERNS.some(rx => rx.test(n))) return true;

    // 일반 ID 패턴
    if (ID_EXACT_NAMES.has(n)) return true;
    if (ID_NAME_PATTERNS.some(rx => rx.test(n))) return true;

    return false;
  }
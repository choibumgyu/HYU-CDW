// utils/analyzeData.ts

// ──────────────────────────────
// 내부 유틸: 이름/값 기반 필터링 규칙
const ID_NAME_PATTERNS = [
    /(^|[_\.])(id|identifier|pk)($|_)/i,
    /_id$/i,
    /_key$/i,
    /concept_id$/i,
    /source_concept_id$/i,
    /type_concept_id$/i,
  ];
  const ID_EXACT_NAMES = new Set([
    "id", "logid", "unique_device_id",
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
    "drug_source_value",
    "condition_source_value",
    "procedure_source_value",
    "gender_source_value",
    "race_source_value",
    "ethnicity_source_value",
  ]);
  
  // 무조건 제외할 특정 *_source_value
  const FORCE_SKIP_SOURCE_VALUES = new Set([
    "person_source_value",
    "provider_source_value",
    "location_source_value",
  ]);
  
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
    if (ID_EXACT_NAMES.has(normalizedName)) return true;
    if (ID_NAME_PATTERNS.some(rx => rx.test(normalizedName))) return true;
    if (DATE_NAME_PATTERNS.some(rx => rx.test(normalizedName))) return true;
    if (TEXT_NAME_PATTERNS.some(rx => rx.test(normalizedName))) return true;
  
    // _source_value 정책 적용
    if (FORCE_SKIP_SOURCE_VALUES.has(normalizedName)) return true;
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
  
      // 2) 값 기반 스킵
      if (values.some(looksLikeDateValue)) continue;
      if (looksLikeLongText(values)) continue;
      if (looksLikeIdByStats(values)) continue;
  
      // 3) 통계 분류
      const numericValues = values.filter(
        v => typeof v === "number" && Number.isFinite(v as number)
      ) as number[];
  
      if (numericValues.length > 0) {
        const uniqueSize = new Set(numericValues).size;
        const DISCRETE_THRESHOLD = 15;
  
        if (uniqueSize <= DISCRETE_THRESHOLD) {
          const counts: Record<string, number> = {};
          numericValues.forEach(v => {
            const k = v.toString();
            counts[k] = (counts[k] || 0) + 1;
          });
          result[col] = { type: "categorical", counts };
        } else {
          const mean = numericValues.reduce((s, v) => s + v, 0) / numericValues.length;
          const min = Math.min(...numericValues);
          const max = Math.max(...numericValues);
  
          const bins = 10;
          const range = max - min || 1;
          const step = range / bins;
          const distribution = Array(bins).fill(0);
          numericValues.forEach(v => {
            const idx = Math.min(bins - 1, Math.floor((v - min) / step));
            distribution[idx]++;
          });
  
          const binLabels = Array.from({ length: bins }, (_, i) => {
            const start = Math.round(min + i * step);
            const end = Math.round(min + (i + 1) * step);
            return `${start}-${end}`;
          });
  
          result[col] = { type: "numericContinuous", mean, min, max, distribution, binLabels };
        }
      } else {
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
  
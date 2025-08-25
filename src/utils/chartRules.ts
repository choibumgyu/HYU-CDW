// utils/chartRules.ts
export const COUNT_NAME_HINTS = [
    /(^|_)(count|cnt|n|num|number|total|sum|건수|횟수|수)($|_)/i,
    /(person|patient|visit|drug|condition|measurement|observation)_count$/i,
    // ✅ 한국어 일반형 보완: "...환자수", "...건수", "...횟수"로 끝나면 카운트로 간주
    /(환자수|건수|횟수)$/i,
];

export const CONTINUOUS_NAME_HINTS = [
    /(^|_)(age|days?|duration|period|value(_as_number)?|amount|cost|price|score|rate|ratio|bmi|height|weight|systolic|diastolic|level|lab|measure)(_|$)/i,
];

const canon = (s?: string | null) =>
    (s ?? "").replace(/[\[\]"`]/g, "").toLowerCase().trim().replace(/[\s.\-\/]+/g, "_");

const isFiniteNumber = (v: any) => {
    if (typeof v === "number") return Number.isFinite(v);
    if (typeof v === "string") return Number.isFinite(Number(v.trim()));
    return false;
};

const isIntLike = (v: any) => isFiniteNumber(v) && Math.floor(Number(v)) === Number(v);

export const looksContinuousName = (colName: string) =>
    CONTINUOUS_NAME_HINTS.some(rx => rx.test(canon(colName)));

export const looksCountName = (colName: string) =>
    COUNT_NAME_HINTS.some(rx => rx.test(canon(colName)));

export const isCountLikeColumn = (
    rows: Record<string, any>[],
    key: string,
    displayName: string
) => {
    const intRatio =
        rows.filter(r => isIntLike(r?.[key])).length / Math.max(rows.length, 1);
    return looksCountName(displayName) && !looksContinuousName(displayName) && intRatio >= 0.95;
};

/** Top-N 스펙을 한 번에 결정 (사전집계 우선, 실패 시 폴백/2컬럼 휴리스틱) */
export function getTopChartSpec(
    rows: Record<string, any>[],
    opts: {
        aliasMap?: Record<string, string | null>;
        preAgg?: { labelKey: string; countKey: string } | null;
    }
): { labelKey: string; countKey: string } | null {
    if (!rows?.length) return null;

    // 1) 사전집계가 있다면 검증 후 사용
    if (opts.preAgg?.labelKey && opts.preAgg?.countKey) {
        const vName = opts.aliasMap?.[opts.preAgg.countKey] ?? opts.preAgg.countKey;
        if (isCountLikeColumn(rows, opts.preAgg.countKey, vName)) {
            return { labelKey: opts.preAgg.labelKey, countKey: opts.preAgg.countKey };
        }
    }

    // 2) 2컬럼 휴리스틱 (라벨1+카운트1 구조)
    const cols = Object.keys(rows[0]);
    if (cols.length === 2) {
        const [a, b] = cols;
        const labelIsStringish = (k: string) => rows.every(r => r[k] == null || typeof r[k] === "string");
        const colIsNum = (k: string) => rows.every(r => isFiniteNumber(r?.[k]));

        // a:값, b:라벨
        if (colIsNum(a) && labelIsStringish(b)) {
            const vName = opts.aliasMap?.[a] ?? a;
            if (isCountLikeColumn(rows, a, vName)) return { labelKey: b, countKey: a };
        }
        // b:값, a:라벨
        if (colIsNum(b) && labelIsStringish(a)) {
            const vName = opts.aliasMap?.[b] ?? b;
            if (isCountLikeColumn(rows, b, vName)) return { labelKey: a, countKey: b };
        }
    }

    // 3) 일반 폴백 (수치형 후보 중 가장 count 같은 것 + 문자열 저카디널리티 라벨)
    const numericKeys = cols.filter(k => rows.every(r => isFiniteNumber(r?.[k])));
    // count-like 우선 정렬
    const valueKey =
        numericKeys
            .map(k => {
                const vName = opts.aliasMap?.[k] ?? k;
                const score = isCountLikeColumn(rows, k, vName) ? 10 : 0;
                return { k, score };
            })
            .sort((a, b) => b.score - a.score)[0]?.k ?? null;

    if (!valueKey) return null;

    const valueName = opts.aliasMap?.[valueKey] ?? valueKey;
    if (!isCountLikeColumn(rows, valueKey, valueName)) return null;

    const stringish = (k: string) => rows.every(r => r[k] == null || typeof r[k] === "string");
    const uniq = (k: string) => new Set(rows.map(r => String(r[k]))).size;

    const labelKey =
        cols
            .filter(k => k !== valueKey && stringish(k))
            .map(k => ({ k, card: uniq(k) }))
            .filter(x => x.card > 1 && x.card <= 100)
            .sort((a, b) => a.card - b.card)[0]?.k ?? null;

    return labelKey ? { labelKey, countKey: valueKey } : null;
}

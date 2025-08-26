// utils/chartRules.ts
import { shouldHideColumnByName, isSensitiveIdentifierName } from "@/utils/analyzeData";

/* ---------- 이름 힌트 ---------- */
export const COUNT_NAME_HINTS = [
    /(^|_)(count|cnt|n|num|number|total|sum|건수|횟수|수)($|_)/i,
    /(person|patient|visit|drug|condition|measurement|observation)_count$/i,
    /(환자수|건수|횟수)$/i,
];

export const CONTINUOUS_NAME_HINTS = [
    /(^|_)(age|days?|duration|period|value(_as_number)?|amount|cost|price|score|rate|ratio|bmi|height|weight|systolic|diastolic|level|lab|measure)(_|$)/i,
];

const canon = (s?: string | null) =>
    (s ?? "")
        .replace(/[\[\]"`]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9가-힣_]+/g, "_")
        .replace(/[\s.\-\/]+/g, "_");

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
    const intRatio = rows.filter(r => isIntLike(r?.[key])).length / Math.max(rows.length, 1);
    return looksCountName(displayName) && !looksContinuousName(displayName) && intRatio >= 0.95;
};

/* ---------- 값 기반 ID 가드 (분포로 판정) ---------- */
const looksLikeIdByStats = (values: unknown[]): boolean => {
    const filtered = values.filter(v => v != null);
    if (!filtered.length) return false;
    const asNum = filtered
        .map(v => (typeof v === "string" ? Number(v) : v))
        .filter(v => typeof v === "number" && Number.isFinite(v)) as number[];
    if (!asNum.length) return false;
    const intRatio = asNum.filter(n => Number.isInteger(n)).length / asNum.length;
    const uniqRatio = new Set(filtered.map(v => String(v))).size / filtered.length;
    // 보수적: 정수 비율 높고 고유값 비율도 높은 경우 ID로 간주
    return intRatio >= 0.98 && uniqRatio >= 0.98;
};
const valuesOf = (rows: any[], k: string) => rows.map(r => r?.[k]);

/** Top-N 스펙을 한 번에 결정 (사전집계 우선, 실패 시 폴백/2컬럼 휴리스틱) */
export function getTopChartSpec(
    rows: Record<string, any>[],
    opts: {
        aliasMap?: Record<string, string | null>;
        preAgg?: { labelKey: string; countKey: string } | null;
    }
): { labelKey: string; countKey: string } | null {
    if (!rows?.length) return null;

    const cols = Object.keys(rows[0]);

    // ---- 여기 헬퍼들을 상단에 공통 정의 (아래 모든 분기에서 사용) ----
    const colIsNum = (k: string) => rows.every(r => isFiniteNumber(r?.[k]));
    const card = (k: string) => new Set(rows.map(r => String(r[k]))).size;
    const lowCard = (k: string) => card(k) <= 100;
    const uniq = (k: string) => card(k);
    const valuesOf = (rs: any[], k: string) => rs.map(r => r?.[k]);

    // 1) 사전집계 있으면 검증 + 라벨 가드
    if (opts.preAgg?.labelKey && opts.preAgg?.countKey) {
        const lk = opts.preAgg.labelKey;
        const vk = opts.preAgg.countKey;

        const labelBlocked =
            shouldHideColumnByName(lk) ||
            isSensitiveIdentifierName(lk) ||
            looksLikeIdByStats(valuesOf(rows, lk));

        if (!labelBlocked) {
            const vName = opts.aliasMap?.[vk] ?? vk;
            if (isCountLikeColumn(rows, vk, vName)) {
                return { labelKey: lk, countKey: vk };
            }
        }
    }

    // 2) 2컬럼 휴리스틱
    if (cols.length === 2) {
        const [a, b] = cols;

        // 이름 기반으로 카운트 같은 쪽을 값으로 우선 확정
        const dispA = opts.aliasMap?.[a] ?? a;
        const dispB = opts.aliasMap?.[b] ?? b;
        const aCountLike = isCountLikeColumn(rows, a, dispA);
        const bCountLike = isCountLikeColumn(rows, b, dispB);

        if (aCountLike && !bCountLike) return { labelKey: b, countKey: a };
        if (!aCountLike && bCountLike) return { labelKey: a, countKey: b };

        // 둘 다 애매하면 기존 휴리스틱
        if (colIsNum(a) && lowCard(b)) {
            const intRatio = rows.filter(r => isIntLike(r?.[a])).length / Math.max(rows.length, 1);
            if (intRatio >= 0.9) return { labelKey: b, countKey: a };
        }
        if (colIsNum(b) && lowCard(a)) {
            const intRatio = rows.filter(r => isIntLike(r?.[b])).length / Math.max(rows.length, 1);
            if (intRatio >= 0.9) return { labelKey: a, countKey: b };
        }
    }

    // 3) 일반 폴백: 값 후보 + 라벨 후보(가드 적용)
    const numericKeys = cols.filter(k => colIsNum(k));
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

    const labelCandidates = cols
        .filter(k => k !== valueKey && lowCard(k))
        // 이름/민감/값 기반 ID 전면 제외
        .filter(k =>
            !(
                shouldHideColumnByName(k) ||
                isSensitiveIdentifierName(k) ||
                looksLikeIdByStats(valuesOf(rows, k))
            )
        );

    const labelKey =
        labelCandidates
            .map(k => ({ k, card: uniq(k) }))
            .filter(x => x.card > 1 && x.card <= 100)
            .sort((a, b) => a.card - b.card)[0]?.k ?? null;

    if (!labelKey) return null;

    // 최종 세이프가드
    if (shouldHideColumnByName(labelKey) || isSensitiveIdentifierName(labelKey)) return null;
    if (looksLikeIdByStats(valuesOf(rows, labelKey))) return null;

    return { labelKey, countKey: valueKey };
}
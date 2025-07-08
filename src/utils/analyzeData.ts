// utils/analyzeData.ts

// 범주형 컬럼 자동 감지 (고유값이 적은 경우)
export function detectCategoricalColumns(data: any[], threshold = 10): string[] {
    if (!data || data.length === 0) return [];

    const columnUniqueCounts: Record<string, Set<any>> = {};

    data.forEach(row => {
        for (const key in row) {
            if (!columnUniqueCounts[key]) columnUniqueCounts[key] = new Set();
            columnUniqueCounts[key].add(row[key]);
        }
    });

    return Object.entries(columnUniqueCounts)
        .filter(([_, set]) => set.size <= threshold)
        .map(([key]) => key);
}

// 숫자형이지만 실제로는 범주형인 컬럼 감지
export function detectNumericCategoricalColumns(data: any[], threshold = 10): string[] {
    if (!data || data.length === 0) return [];

    const numericCategoricals: string[] = [];
    const columns = Object.keys(data[0]);

    for (const col of columns) {
        const values = data.map(row => row[col]).filter(v => v !== null && v !== undefined);
        const uniqueValues = new Set(values);
        const allNumeric = Array.from(uniqueValues).every(v => typeof v === 'number' || !isNaN(Number(v)));

        if (allNumeric && uniqueValues.size > 1 && uniqueValues.size <= threshold) {
            numericCategoricals.push(col);
        }
    }

    return numericCategoricals;
}

// 결측치 비율이 높은 컬럼 제외
export function filterColumnsByMissingRate(data: any[], threshold = 0.5): string[] {
    if (!data || data.length === 0) return [];

    const totalRows = data.length;
    const result: string[] = [];

    const columns = Object.keys(data[0]);

    for (const col of columns) {
        const missingCount = data.filter(row => row[col] === null || row[col] === undefined).length;
        const missingRate = missingCount / totalRows;
        if (missingRate < threshold) {
            result.push(col);
        }
    }

    return result;
}

// 모든 값이 동일한 컬럼 제거
export function removeUniformColumns(data: any[]): string[] {
    if (!data || data.length === 0) return [];

    return Object.keys(data[0]).filter(col => {
        const unique = new Set(data.map(row => row[col]));
        return unique.size > 1;
    });
}

// 컬럼명이 없는 경우 제거
export function removeEmptyColumnNames(columns: string[]): string[] {
    return columns.filter(col => col && col.trim() !== "");
}

// 이상치가 많은 컬럼 감지
export function detectOutlierColumns(data: any[], iqrFactor = 3): string[] {
    if (!data || data.length === 0) return [];

    const outlierColumns: string[] = [];

    for (const col of Object.keys(data[0])) {
        const values = data.map(row => Number(row[col])).filter(v => !isNaN(v));
        if (values.length < 5) continue;

        const sorted = [...values].sort((a, b) => a - b);
        const q1 = sorted[Math.floor(sorted.length * 0.25)];
        const q3 = sorted[Math.floor(sorted.length * 0.75)];
        const iqr = q3 - q1;
        const upperBound = q3 + iqrFactor * iqr;

        const hasExtremeOutlier = values.some(v => v > upperBound * 10);
        if (hasExtremeOutlier) outlierColumns.push(col);
    }

    return outlierColumns;
}

// ✅ 통합 필터링 함수
export function filterValidColumns(data: any[]): string[] {
    if (!data || data.length === 0) return [];

    const initialColumns = Object.keys(data[0]);

    const nonEmpty = removeEmptyColumnNames(initialColumns);
    const noMissing = filterColumnsByMissingRate(data);
    const noUniform = removeUniformColumns(data);
    const noOutlier = initialColumns.filter(col => !detectOutlierColumns(data).includes(col));

    return nonEmpty
        .filter(col => noMissing.includes(col))
        .filter(col => noUniform.includes(col))
        .filter(col => noOutlier.includes(col));
}

// 🔧 숫자형 컬럼 여부 확인
export function isNumericColumn(columnData: any[]): boolean {
    const valid = columnData.filter(v => v !== null && v !== undefined);
    const numeric = valid.filter(v => typeof v === 'number' || !isNaN(Number(v)));
    return numeric.length / valid.length > 0.8;
}

// 🔧 합산 가능한 컬럼 여부 판단
const UNSUMMABLE_COLUMNS = ['person_id', 'visit_occurrence_id', 'observation_id', 'measurement_id'];

export function isSummable(columnName: string): boolean {
    const lower = columnName.toLowerCase();
    return !UNSUMMABLE_COLUMNS.includes(lower) && !lower.endsWith('_id');
}

// 🔧 이상치 존재 여부 확인
export function hasOutliers(values: number[]): boolean {
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;
    return values.some(v => v < lower || v > upper);
}

// 🔧 집계 방식 추천
export function suggestAggregation(columnName: string): "count" | "sum" | "avg" {
    const lower = columnName.toLowerCase();
    if (lower.includes("cost") || lower.includes("days") || lower.includes("length")) return "sum";
    if (lower.includes("value") || lower.includes("score")) return "avg";
    return "count";
}

// 🔧 범주형 값 상위 n개 추출
export function truncateCategoricalValues(columnData: any[], limit = 10): string[] {
    const counts: Record<string, number> = {};
    columnData.forEach(val => {
        counts[val] = (counts[val] || 0) + 1;
    });
    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([val]) => val);
}

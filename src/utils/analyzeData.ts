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
        const allNumeric = Array.from(uniqueValues).every(
            v => typeof v === "number" || !isNaN(Number(v))
        );
        if (allNumeric && uniqueValues.size > 1 && uniqueValues.size <= threshold) {
            numericCategoricals.push(col);
        }
    }
    return numericCategoricals;
}

// 결측치 많거나 단일값만 있는 컬럼 제외
export function filterValidColumns(data: any[]): string[] {
    if (!data || data.length === 0) return [];

    const initialColumns = Object.keys(data[0]);
    const totalRows = data.length;

    const noMissing = initialColumns.filter(col => {
        const missingCount = data.filter(row => row[col] === null || row[col] === undefined).length;
        return missingCount / totalRows < 0.5;
    });

    const noUniform = noMissing.filter(col => {
        const unique = new Set(data.map(row => row[col]));
        return unique.size > 1;
    });

    return noUniform;
}

// 데이터 요약(summary) 생성
export function analyzeDataSummary(data: any[]) {
    if (!data || data.length === 0) return null;

    const result: Record<string,
        | { type: "id"; uniqueCount: number }
        | { type: "numericContinuous"; mean: number; min: number; max: number; distribution: number[]; binLabels: string[] }
        | { type: "categorical"; counts: Record<string, number> }
    > = {};

    for (const col of Object.keys(data[0])) {
        const lower = col.toLowerCase();
        const isId = lower.endsWith("_id") || lower === "id";
        if (isId) {
            const uniqueCount = new Set(data.map((row) => row[col])).size;
            result[col] = { type: "id", uniqueCount };
            continue;
        }

        const values = data.map((row) => row[col]);
        const numericValues = values.filter((v) => typeof v === "number" && !isNaN(v as number)) as number[];

        if (numericValues.length > 0) {
            const uniqueNumeric = Array.from(new Set(numericValues));
            const DISCRETE_THRESHOLD = 15;
            if (uniqueNumeric.length <= DISCRETE_THRESHOLD) {
                const counts: Record<string, number> = {};
                numericValues.forEach((v) => {
                    const key = v.toString();
                    counts[key] = (counts[key] || 0) + 1;
                });
                result[col] = { type: "categorical", counts };
            } else {
                const mean = numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length;
                const min = Math.min(...numericValues);
                const max = Math.max(...numericValues);

                const bins = 10;
                const range = max - min || 1;
                const step = range / bins;
                const distribution = Array(bins).fill(0);
                numericValues.forEach((v) => {
                    const index = Math.min(bins - 1, Math.floor((v - min) / step));
                    distribution[index]++;
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
            values.forEach((v) => {
                const key = (v === null || v === undefined ? "NULL" : v).toString();
                counts[key] = (counts[key] || 0) + 1;
            });
            result[col] = { type: "categorical", counts };
        }
    }
    return result;
}

// TopNByNumericChart.tsx
'use client';

import { useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import { translateColumn } from "@/utils/translate";
import { shouldHideColumnByName, isSensitiveIdentifierName } from "@/utils/analyzeData";
import { ensureChartJsRegistered } from '@/components/charts/setupChartJs';
ensureChartJsRegistered();

// ID 처럼 보이는지 값 분포로 판별 (정수비율↑, 고유비율↑ 등)
function looksLikeIdByStats(values: unknown[]): boolean {
    const filtered = values.filter(v => v != null);
    if (!filtered.length) return false;

    const asNum = filtered
        .map(v => (typeof v === "string" ? Number(v) : v))
        .filter(v => typeof v === "number" && Number.isFinite(v)) as number[];

    if (asNum.length) {
        const intRatio = asNum.filter(n => Number.isInteger(n)).length / asNum.length;
        const uniqRatio = new Set(filtered.map(v => String(v))).size / filtered.length;
        if (intRatio > 0.95 && uniqRatio > 0.8) return true;
    }

    const strings = filtered.map(v => String(v));
    const avgLen = strings.reduce((s, t) => s + t.length, 0) / strings.length;
    const uniqRatio = new Set(strings).size / strings.length;
    if (avgLen >= 6 && uniqRatio > 0.8) return true;

    return false;
}

export function TopNByNumericChart({
    rows, labelCol, valueCol, topN = 10,
}: {
    rows: Record<string, any>[];
    labelCol: string;
    valueCol: string;
    topN?: number;
}) {
    // ✅ 이름 기반 가드: 라벨/값 모두 검사
    if (shouldHideColumnByName(labelCol) || isSensitiveIdentifierName(labelCol)) return null;
    if (shouldHideColumnByName(valueCol) || isSensitiveIdentifierName(valueCol)) return null;

    const [mode, setMode] = useState<"top" | "others">("top");

    const {
        chartLabels, chartValues, title,
        topEntries, otherEntries, topSum, otherSum, total,
        blockedByValueGuard,
    } = useMemo(() => {
        const labelName = translateColumn(labelCol);
        const valueName = translateColumn(valueCol);

        const valid = rows.filter(
            r => r[labelCol] != null && Number.isFinite(Number(r[valueCol]))
        );

        // ✅ 값 컬럼 분포 가드 (등록번호 같이 유니크/정수 위주면 차트 금지)
        const blockedByValueGuard = looksLikeIdByStats(valid.map(r => r[valueCol]));
        // 라벨 값도 한 번 더 체크(안전)
        if (looksLikeIdByStats(valid.map(r => r[labelCol]))) {
            return {
                chartLabels: [], chartValues: [], title: "", topEntries: [], otherEntries: [],
                topSum: 0, otherSum: 0, total: 0, blockedByValueGuard: true
            };
        }

        // 동일 라벨 합산
        const agg = new Map<string, number>();
        for (const r of valid) {
            const k = String(r[labelCol]);
            const v = Number(r[valueCol]);
            agg.set(k, (agg.get(k) || 0) + v);
        }

        const entries = [...agg.entries()].sort((a, b) => b[1] - a[1]);
        const total = entries.reduce((s, [, v]) => s + v, 0);
        const title = `${labelName}별 ${valueName}`;

        const topEntries = entries.slice(0, topN);
        const otherEntries = entries.slice(topN);
        const topSum = topEntries.reduce((s, [, v]) => s + v, 0);
        const otherSum = otherEntries.reduce((s, [, v]) => s + v, 0);

        let chartLabels: string[] = [];
        let chartValues: number[] = [];

        if (entries.length <= 10) {
            chartLabels = entries.map(([k]) => k);
            chartValues = entries.map(([, v]) => v);
        } else if (entries.length < 50) {
            chartLabels = [...topEntries.map(([k]) => k), "기타"];
            chartValues = [...topEntries.map(([, v]) => v), otherSum];
        } else {
            chartLabels = topEntries.map(([k]) => k);
            chartValues = topEntries.map(([, v]) => v);
        }

        return {
            chartLabels, chartValues, title,
            topEntries, otherEntries, topSum, otherSum, total,
            blockedByValueGuard,
        };
    }, [rows, labelCol, valueCol, topN]);

    if (!chartLabels.length || blockedByValueGuard) return null;

    const bg = chartLabels.map(v => (v === "기타" ? "rgba(156,163,175,0.7)" : "rgba(54,162,235,0.5)"));
    const coverage = total ? (topSum / total) * 100 : 0;
    const othersPct = total ? (otherSum / total) * 100 : 0;

    return (
        <div className="p-4 border rounded-lg shadow-sm bg-white">
            <h3 className="font-semibold mb-2">{title}</h3>
            <div className="h-48">
                <Bar
                    data={{ labels: chartLabels, datasets: [{ label: title, data: chartValues, backgroundColor: bg }] }}
                    options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                />
            </div>
            {otherEntries.length > 0 && (
                <div className="mt-3 text-sm text-gray-600 flex items-center gap-3 flex-wrap">
                    {mode === "top" ? (
                        <>
                            <span>상위 {topN} 합계 {topSum.toLocaleString()} ({coverage.toFixed(1)}%)</span>
                            <span>·</span>
                            <span>기타 {otherEntries.length}개 합계 {otherSum.toLocaleString()} ({othersPct.toFixed(1)}%)</span>
                            <button className="ml-1 px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200"
                                onClick={() => setMode("others")}>
                                기타 미리보기
                            </button>
                        </>
                    ) : (
                        <>
                            <span>기타 상위 {Math.min(topN, otherEntries.length)}개 미리보기</span>
                            {otherEntries.length > topN && <span>· 나머지 {otherEntries.length - topN}개 생략</span>}
                            <button className="ml-1 px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200"
                                onClick={() => setMode("top")}>
                                상위 {topN}로 돌아가기
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

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
    if (filtered.length < 100) return false; // 표본 작으면 차단 안함
    const asNum = filtered.map(v => (typeof v === "string" ? Number(v) : v))
        .filter(v => typeof v === "number" && Number.isFinite(v)) as number[];
    if (!asNum.length) return false;
    const intRatio = asNum.filter(n => Number.isInteger(n)).length / asNum.length;
    const uniqRatio = new Set(filtered.map(v => String(v))).size / filtered.length;
    return intRatio >= 0.98 && uniqRatio >= 0.98; // 더 보수적으로
}

export function TopNByNumericChart({
    rows, labelCol, valueCol, topN = 10, labelDisplay, valueDisplay,
}: {
    rows: Record<string, any>[];
    labelCol: string;
    valueCol: string;
    topN?: number;
    labelDisplay?: string;
    valueDisplay?: string;
}) {

    const labelHide = shouldHideColumnByName(labelCol) || isSensitiveIdentifierName(labelCol);
    const valueHide = shouldHideColumnByName(valueCol) || isSensitiveIdentifierName(valueCol);

    // concept_id 라벨은 강제 허용 (drug_concept_id 같은 케이스)
    const labelIsConceptId = /_concept_id$/i.test(labelCol);
    if (!labelIsConceptId && (labelHide || valueHide)) {
        return null;
    }

    const [mode, setMode] = useState<"top" | "others">("top");

    const {
        chartLabels, chartValues, title,
        topEntries, otherEntries, topSum, otherSum, total,
        blockedByValueGuard, maxTop,
    } = useMemo(() => {
        const labelName = labelDisplay ?? translateColumn(labelCol);
        const valueName = valueDisplay ?? translateColumn(valueCol);

        const valid = rows.filter(
            r => r[labelCol] != null && Number.isFinite(Number(r[valueCol]))
        );

        // ✅ 값 컬럼 분포 가드 (등록번호 같이 유니크/정수 위주면 차트 금지)
        const blockedByValueGuard = looksLikeIdByStats(valid.map(r => r[valueCol]));


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

        // ✅ TopN의 최대값 (Y축 고정을 위해)
        const maxTop = topEntries.length ? Math.max(...topEntries.map(([, v]) => v)) : 0;

        // 교체: mode에 따라 TopN 또는 기타 상위 N 미리보기
        const displayEntries = mode === "top" ? topEntries : otherEntries.slice(0, topN);
        const chartLabels = displayEntries.map(([k]) => k);
        const chartValues = displayEntries.map(([, v]) => v);

        return {
            chartLabels, chartValues, title,
            topEntries, otherEntries, topSum, otherSum, total,
            blockedByValueGuard, maxTop,
        };
    }, [rows, labelCol, valueCol, topN, mode]);

    if (!chartLabels.length || blockedByValueGuard) return null;

    const bg = chartLabels.map(() => "rgba(54,162,235,0.5)");
    const coverage = total ? (topSum / total) * 100 : 0;
    const othersPct = total ? (otherSum / total) * 100 : 0;

    return (
        <div className="p-4 border rounded-lg shadow-sm bg-white">
            <h3 className="font-semibold mb-2">{title}</h3>
            <div className="h-48">
                <Bar
                    data={{ labels: chartLabels, datasets: [{ label: title, data: chartValues, backgroundColor: bg }] }}
                    options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            y: {
                                beginAtZero: true,
                                // ✅ TopN 최대값 기준으로 고정 (전부 0이면 최소 1)
                                suggestedMax: Math.max(1, maxTop ?? 0),
                                ticks: { callback: (v) => Number(v).toLocaleString() },
                            },
                        },
                    }}
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

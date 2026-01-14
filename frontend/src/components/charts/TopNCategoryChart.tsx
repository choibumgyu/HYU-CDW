// TopNCategoryChart.tsx
'use client';

import { useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import { ensureChartJsRegistered } from '@/components/charts/setupChartJs';
ensureChartJsRegistered();

type Props = {
    title: string;
    counts: Record<string, number>;
    topN?: number;          // 기본 10
};

export function TopNCategoryChart({
    title,
    counts,
    topN = 10,
}: Props) {
    const [mode, setMode] = useState<"top" | "others">("top");

    const { sorted, top, others, topSum, othersSum, total, maxY } = useMemo(() => {
        const entries = Object.entries(counts).filter(([, v]) => Number.isFinite(v));
        const sorted = entries.sort((a, b) => b[1] - a[1]);

        const top = sorted.slice(0, topN);
        const others = sorted.slice(topN);

        const sum = (arr: [string, number][]) => arr.reduce((s, [, c]) => s + c, 0);
        const topSum = sum(top);
        const othersSum = sum(others);
        const total = sum(sorted);

        // y축 고정: 항상 상위 N의 최대값 기준
        const maxY = Math.max(...top.map(([, v]) => v), 0);

        return { sorted, top, others, topSum, othersSum, total, maxY };
    }, [counts, topN]);

    // 보여줄 데이터
    const show = mode === "top" ? top : others.slice(0, topN);
    const labels = show.map(([k]) => k);
    const values = show.map(([, v]) => v);

    const coverage = total ? (topSum / total) * 100 : 0;
    const othersPct = total ? (othersSum / total) * 100 : 0;

    if (!labels.length) return null;

    const numberFmt = (n: number) => n.toLocaleString();

    const data = {
        labels,
        datasets: [
            {
                label: title,
                data: values,
                backgroundColor: "rgba(54, 162, 235, 0.5)",
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            y: {
                suggestedMax: Math.max(1, maxY ?? 0),
                beginAtZero: true,
                max: maxY > 0 ? maxY : undefined, // ✅ y축을 상위 N 기준으로 고정
                ticks: {
                    callback: (value: string | number) => numberFmt(Number(value)),
                },
            },
        },
    } as const;

    return (
        <div className="p-4 border rounded-lg shadow-sm bg-white">
            <h3 className="font-semibold mb-2">{title}</h3>

            <div className="h-48">
                <Bar data={data} options={options} />
            </div>

            {/* ✅ 드릴다운 토글 유지, 단 기타 막대는 없음 */}
            {others.length > 0 && (
                <div className="mt-3 text-sm text-gray-600 flex items-center gap-3 flex-wrap">
                    {mode === "top" ? (
                        <>
                            <span>
                                상위 {topN} 합계 {numberFmt(topSum)} ({coverage.toFixed(1)}%)
                            </span>
                            <span>·</span>
                            <span>
                                기타 {others.length}개 합계 {numberFmt(othersSum)} ({othersPct.toFixed(1)}%)
                            </span>
                            <button
                                className="ml-1 px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200"
                                onClick={() => setMode("others")}
                            >
                                기타 자세히 보기
                            </button>
                        </>
                    ) : (
                        <>
                            <span>
                                기타 상위 {Math.min(topN, others.length)} 개 미리보기
                            </span>
                            {others.length > topN && (
                                <span>· 나머지 {others.length - topN}개 생략</span>
                            )}
                            <button
                                className="ml-1 px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200"
                                onClick={() => setMode("top")}
                            >
                                상위 {topN}로 돌아가기
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

export default TopNCategoryChart;

"use client";

import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";
import { ChartBaseProps } from "@/types/ChartBaseProps";
import {
    filterValidColumns,
    detectCategoricalColumns,
} from "@/utils/analyzeData";
import { translateColumn } from "@/utils/translate"; // ✅ 컬럼명 번역 함수

export default function PieChart({
                                     xAxis,
                                     yAxis,
                                     data,
                                     setChartInstance,
                                 }: ChartBaseProps) {
    const chartRef = useRef<HTMLDivElement>(null);
    const [groupedMode, setGroupedMode] = useState(false); // ✅ 기본 해제
    const [manualToggle, setManualToggle] = useState(false);

    const yValues = data.map((row) => Number(row[yAxis])).filter((v) => !isNaN(v));
    const isYNumericSummable = yValues.length > 0 && new Set(yValues).size > 1;
    const toggleDisabled = !isYNumericSummable;

    // ✅ 자동 그룹화 제거
    // useEffect(() => {
    //     if (!manualToggle && xAxis && data.length > 0) {
    //         const isXCategorical = detectCategoricalColumns(data).includes(xAxis);
    //         setGroupedMode(isXCategorical);
    //     }
    // }, [xAxis, data, manualToggle]);

    useEffect(() => {
        if (!chartRef.current || !xAxis || data.length === 0) return;

        const validColumns = filterValidColumns(data);
        const isXCategorical = detectCategoricalColumns(data).includes(xAxis);
        if (groupedMode && (!validColumns.includes(xAxis) || !isXCategorical)) return;

        const chart = echarts.init(chartRef.current);
        setChartInstance(chart);

        const seriesData = groupedMode
            ? Object.entries(
                data.reduce((acc, row) => {
                    const key = row[xAxis] ?? "null";
                    acc[key] = (acc[key] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>)
            ).map(([name, value]) => ({ name, value }))
            : data
                .map((row) => ({
                    name: row[xAxis],
                    value: Number(row[yAxis]) || 0,
                }))
                .filter((d) => d.name && !isNaN(d.value));

        chart.setOption({
            tooltip: {
                trigger: "item",
                formatter: (params: any) =>
                    `${translateColumn(xAxis)}: ${params.name}<br>` +
                    `${translateColumn(yAxis)}: ${params.value} (${params.percent}%)`,
            },
            legend: {
                top: "bottom",
                type: "scroll",
            },
            series: [
                {
                    name: groupedMode ? "Count" : translateColumn(yAxis),
                    type: "pie",
                    radius: "60%",
                    data: seriesData,
                    label: {
                        show: true,
                        formatter: "{b}: {d}%",
                    },
                },
            ],
        });

        return () => chart.dispose();
    }, [xAxis, yAxis, data, groupedMode]);

    return (
        <div className="w-full h-[550px]">
            <div className="flex justify-end mb-2 text-sm">
                <label className="flex items-center gap-1">
                    <input
                        type="checkbox"
                        checked={groupedMode}
                        disabled={toggleDisabled}
                        onChange={() => {
                            setGroupedMode((prev) => !prev);
                            setManualToggle(true);
                        }}
                    />
                    그룹화된 값으로 보기
                </label>
            </div>
            <div ref={chartRef} className="w-full h-[500px]" />
        </div>
    );
}

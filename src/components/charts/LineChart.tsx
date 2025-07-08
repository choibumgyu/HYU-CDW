"use client";

import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";
import { ChartBaseProps } from "@/types/ChartBaseProps";
import {
    detectCategoricalColumns,
    filterValidColumns,
} from "@/utils/analyzeData";

export default function LineChart({ xAxis, yAxis, data, setChartInstance }: ChartBaseProps) {
    const chartRef = useRef<HTMLDivElement>(null);
    const [groupedMode, setGroupedMode] = useState(false);
    const [manualToggle, setManualToggle] = useState(false);

    const yValues = data.map((row) => Number(row[yAxis])).filter((v) => !isNaN(v));
    const isYNumericSummable = yValues.length > 0 && new Set(yValues).size > 1;
    const toggleDisabled = !isYNumericSummable;

    useEffect(() => {
        if (!manualToggle && xAxis && data.length > 0) {
            const isXCategorical = detectCategoricalColumns(data).includes(xAxis);
            setGroupedMode(isXCategorical);
        }
    }, [xAxis, data, manualToggle]);

    useEffect(() => {
        if (!chartRef.current || !xAxis || !yAxis || data.length === 0) return;

        const validColumns = filterValidColumns(data);
        const isCategorical = detectCategoricalColumns(data).includes(xAxis);
        if (groupedMode && (!validColumns.includes(xAxis) || !isCategorical)) return;

        const grouped = groupedMode
            ? Object.entries(
                data.reduce((acc, row) => {
                    const key = row[xAxis]!;
                    acc[key] = (acc[key] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>)
            )
            : data
                .map((row) => [row[xAxis], Number(row[yAxis]) || 0])
                .filter(([x, y]) => x && !isNaN(y));

        const chart = echarts.init(chartRef.current);
        setChartInstance(chart);

        chart.setOption({
            tooltip: { trigger: "axis" },
            xAxis: {
                type: "category",
                data: grouped.map(([x]) => x),
                axisLabel: {
                    rotate: 45,
                    formatter: function (value: any) {
                        return value?.toString().length > 6 ? value.toString().slice(-4) : value;
                    },
                },
            },
            yAxis: { type: "value", name: yAxis },
            series: [
                {
                    type: "line",
                    data: grouped.map(([_, y]) => y),
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

"use client";

import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";
import { ChartBaseProps } from "@/types/ChartBaseProps";
import {
    filterValidColumns,
    detectCategoricalColumns,
} from "@/utils/analyzeData";

export default function ScatterChart({ xAxis, yAxis, data, setChartInstance }: ChartBaseProps) {
    const chartRef = useRef<HTMLDivElement>(null);
    const [groupedMode, setGroupedMode] = useState(false);
    const [manualToggle, setManualToggle] = useState(false);

    useEffect(() => {
        if (!manualToggle && xAxis && data.length > 0) {
            const isXCategorical = detectCategoricalColumns(data).includes(xAxis);
            setGroupedMode(isXCategorical);
        }
    }, [xAxis, data, manualToggle]);

    useEffect(() => {
        if (!chartRef.current || !xAxis || !yAxis || data.length === 0) return;

        const chart = echarts.init(chartRef.current);
        setChartInstance(chart);

        const validColumns = filterValidColumns(data);
        const isValid = validColumns.includes(xAxis) && validColumns.includes(yAxis);
        if (!isValid) return;

        const rawPoints = data
            .map(row => [Number(row[xAxis]), Number(row[yAxis])] as [number, number])
            .filter(([x, y]) => !isNaN(x) && !isNaN(y));

        const seriesData = groupedMode
            ? Object.entries(
                rawPoints.reduce((acc, [x, y]) => {
                    const key = `${x},${y}`;
                    acc[key] = (acc[key] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>)
            ).map(([key, count]) => {
                const [x, y] = key.split(",").map(Number);
                return { value: [x, y], symbolSize: Math.min(count * 5, 30) };
            })
            : rawPoints.map(([x, y]) => ({
                value: [x, y],
                symbolSize: 10,
            }));

        const xValues = rawPoints.map(([x]) => x);
        const xMin = xValues.length > 0 ? Math.floor(Math.min(...xValues) - 10) : undefined;

        chart.setOption({
            tooltip: { trigger: "item" },
            xAxis: {
                type: "value",
                name: xAxis,
                min: xMin,
                axisLabel: {
                    rotate: 45,
                    formatter: (value: number) => {
                        const str = value.toString();
                        return str.length > 6 ? str.slice(0, 3) + "…" + str.slice(-2) : str;
                    },
                },
            },
            yAxis: {
                type: "value",
                name: yAxis,
            },
            series: [
                {
                    type: "scatter",
                    data: seriesData,
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
                        onChange={() => {
                            setGroupedMode(prev => !prev);
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

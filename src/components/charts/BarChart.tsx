"use client";

import * as echarts from "echarts";
import { useEffect, useRef, useState } from "react";
import { ChartBaseProps } from "@/types/ChartBaseProps";
import {
    detectCategoricalColumns,
    filterValidColumns,
} from "@/utils/analyzeData";
import { translateColumn } from "@/utils/translate";

export default function BarChart({
                                     xAxis,
                                     yAxis,
                                     data,
                                     setChartInstance,
                                 }: ChartBaseProps) {
    const chartRef = useRef<HTMLDivElement>(null);
    const [groupedMode, setGroupedMode] = useState(false);
    const [userInteracted, setUserInteracted] = useState(false);

    const yValues = data.map((row) => Number(row[yAxis])).filter((v) => !isNaN(v));
    const isYNumericSummable = yValues.length > 0 && new Set(yValues).size > 1;
    const toggleDisabled = !isYNumericSummable;

    const colorPalette = [
        '#5470C6', '#91CC75', '#FAC858', '#EE6666', '#73C0DE',
        '#3BA272', '#FC8452', '#9A60B4', '#EA7CCC'
    ];

    useEffect(() => {
        if (!xAxis || !yAxis || data.length === 0 || !chartRef.current) return;

        const chart = echarts.init(chartRef.current);
        chart.clear(); // 기존 차트 초기화
        setChartInstance(chart);

        try {
            let grouped: [string, number][] = [];

            if (groupedMode) {
                const temp: Record<string, number> = {};

                for (const row of data) {
                    const key = row[xAxis] ?? "null";
                    temp[key] = (temp[key] || 0) + 1;
                }

                grouped = Object.entries(temp);
            } else {
                const grouped: [string, number][] = data
                    .map((row) => {
                        const xVal = row[xAxis] ?? "null";
                        const yVal = Number(row[yAxis]);
                        return [xVal.toString(), isNaN(yVal) ? 0 : yVal] as [string, number];
                    })
                    .filter(([x, y]) => x !== undefined && !isNaN(y));
            }

            const total = grouped.reduce((sum, [_, val]) => sum + val, 0);

            const barWidth = () => {
                const count = grouped.length;
                if (count >= 50) return 10;
                if (count >= 30) return 20;
                if (count >= 15) return 40;
                return 60;
            };

            const seriesData = grouped.map(([x, y], index) => ({
                value: y,
                itemStyle: {
                    color: colorPalette[index % colorPalette.length],
                },
            }));

            chart.setOption({
                tooltip: {
                    trigger: "axis",
                    axisPointer: { type: "shadow" },
                    formatter: function (params: any) {
                        const value = params[0]?.value;
                        const name = params[0]?.name;
                        return `${translateColumn(xAxis)}: ${name}<br>${translateColumn(yAxis)}: ${value}`;
                    },
                },
                xAxis: {
                    type: "category",
                    name: translateColumn(xAxis),
                    data: grouped.map(([x]) => x),
                },
                yAxis: {
                    type: "value",
                    name: translateColumn(yAxis),
                },
                series: [
                    {
                        type: "bar",
                        data: seriesData,
                        barWidth: barWidth(),
                        label: groupedMode
                            ? {
                                show: true,
                                position: "top",
                                formatter: function (params: any) {
                                    const percent =
                                        total > 0 ? ((params.value / total) * 100).toFixed(1) : "0";
                                    return `${percent}%`;
                                },
                            }
                            : { show: false },
                    },
                ],
            });
        } catch (err) {
            console.warn("BarChart rendering error:", err);
        }

        return () => {
            chart.dispose();
        };
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
                            setUserInteracted(true);
                        }}
                    />
                    그룹화된 값으로 보기
                </label>
            </div>
            <div ref={chartRef} className="w-full h-[500px]" />
        </div>
    );
}

"use client";

import * as echarts from "echarts";
import { useEffect, useRef, useState } from "react";
import { ChartBaseProps } from "@/types/ChartBaseProps";
import {
    detectCategoricalColumns,
    filterValidColumns,
} from "@/utils/analyzeData";

export default function BarChart({
                                     xAxis,
                                     yAxis,
                                     data,
                                     setChartInstance,
                                 }: ChartBaseProps) {
    const chartRef = useRef<HTMLDivElement>(null);
    const [groupedMode, setGroupedMode] = useState(true);
    const [userInteracted, setUserInteracted] = useState(false);

    const yValues = data.map((row) => Number(row[yAxis])).filter((v) => !isNaN(v));
    const isYNumericSummable = yValues.length > 0 && new Set(yValues).size > 1;
    const toggleDisabled = !isYNumericSummable;

    const colorPalette = [
        '#5470C6', '#91CC75', '#FAC858', '#EE6666', '#73C0DE',
        '#3BA272', '#FC8452', '#9A60B4', '#EA7CCC'
    ];

    useEffect(() => {
        const validColumns = filterValidColumns(data);
        const isCategorical = detectCategoricalColumns(data).includes(xAxis);

        if (!userInteracted && isCategorical && validColumns.includes(xAxis)) {
            setGroupedMode(true);
        }
    }, [xAxis, data, userInteracted]);

    useEffect(() => {
        if (!xAxis || !yAxis || data.length === 0 || !chartRef.current) return;

        const chart = echarts.init(chartRef.current);
        setChartInstance(chart);

        const grouped = groupedMode
            ? Object.entries(
                data.reduce((acc, row) => {
                    const key = row[xAxis] ?? "null";
                    acc[key] = (acc[key] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>)
            )
            : data
                .map((row) => [row[xAxis], Number(row[yAxis]) || 0])
                .filter(([x, y]) => x !== undefined && !isNaN(y));

        // 🔒 grouped이 0이면 종료
        if (grouped.length === 0) return;

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
            },
            xAxis: {
                type: "category",
                data: grouped.map(([x]) => x),
            },
            yAxis: {
                type: "value",
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
                                const percent = total > 0 ? ((params.value / total) * 100).toFixed(1) : "0";
                                return `${percent}%`;
                            },
                        }
                        : { show: false },
                },
            ],
        });

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

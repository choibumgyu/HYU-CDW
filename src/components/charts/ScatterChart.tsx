import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";

interface ChartRow {
    [key: string]: string | number | null;
}

interface ScatterChartProps {
    xAxis: string;
    yAxis: string;
    data: ChartRow[];
}

export default function ScatterChart({ xAxis, yAxis, data }: ScatterChartProps) {
    const chartRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!chartRef.current || !xAxis || !yAxis || data.length === 0) return;

        echarts.dispose(chartRef.current);
        const chart = echarts.init(chartRef.current);

        const seriesData = data.map((row) => {
            const xVal = row[xAxis];
            const yVal = Number(row[yAxis]);
            return [xVal, isNaN(yVal) ? 0 : yVal];
        });

        chart.setOption({
            tooltip: { trigger: "item" },
            xAxis: {
                type: "category",
                name: xAxis,
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
    }, [xAxis, yAxis, data]);

    return <div ref={chartRef} className="w-full h-[500px]" />;
}

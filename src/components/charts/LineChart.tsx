import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";

interface ChartRow {
    [key: string]: string | number | null;
}

interface LineChartProps {
    xAxis: string;
    yAxis: string;
    data: ChartRow[];
}

export default function LineChart({ xAxis, yAxis, data }: LineChartProps) {
    const chartRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!chartRef.current || !xAxis || !yAxis || data.length === 0) return;

        echarts.dispose(chartRef.current);
        const chart = echarts.init(chartRef.current);

        const xData = data.map((row) => row[xAxis]);
        const yData = data.map((row) => {
            const val = Number(row[yAxis]);
            return isNaN(val) ? 0 : val;
        });

        chart.setOption({
            tooltip: { trigger: "axis" },
            xAxis: {
                type: "category",
                data: xData,
                name: xAxis,
            },
            yAxis: {
                type: "value",
                name: yAxis,
            },
            series: [
                {
                    type: "line",
                    data: yData,
                },
            ],
        });
    }, [xAxis, yAxis, data]);

    return <div ref={chartRef} className="w-full h-[500px]" />;
}

"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { ChartBaseProps } from "@/types/ChartBaseProps";

export default function PieChart({ xAxis, yAxis, data, setChartInstance }: ChartBaseProps) {
    const chartRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!chartRef.current) return;

        const chart = echarts.init(chartRef.current);
        setChartInstance(chart); // ✅ 인스턴스 상위로 전달

        const seriesData = data.map(item => ({
            name: item[xAxis],
            value: Number(item[yAxis]),
        }));

        chart.setOption({
            tooltip: { trigger: "item" },
            legend: { top: "bottom" },
            series: [
                {
                    name: yAxis,
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
    }, [xAxis, yAxis, data]);

    return <div ref={chartRef} className="w-full h-[500px]" />;
}

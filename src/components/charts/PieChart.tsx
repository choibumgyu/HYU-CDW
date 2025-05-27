import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";

interface ChartRow {
    [key: string]: string | number | null;
}

interface PieChartProps {
    xAxis: string;
    yAxis: string;
    data: ChartRow[];
}

export default function PieChart({ xAxis, yAxis, data }: PieChartProps) {
    const chartRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!chartRef.current || !xAxis || !yAxis || !data.length) return;

        // 기존 인스턴스 제거 후 새로 생성
        echarts.dispose(chartRef.current);
        const chart = echarts.init(chartRef.current);

        const pieData = data.map((row) => ({
            name: row[xAxis] ?? "없음",
            value: Number(row[yAxis]) || 0,
        }));

        chart.setOption({
            tooltip: { trigger: "item" },
            series: [
                {
                    type: "pie",
                    radius: "50%",
                    data: pieData,
                    label: {
                        show: true,
                        formatter: "{b}: {d}%",
                    },
                },
            ],
        });
    }, [xAxis, yAxis, data]);

    return <div ref={chartRef} className="w-full h-[500px]" />;
}

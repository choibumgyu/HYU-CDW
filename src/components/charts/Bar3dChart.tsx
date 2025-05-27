"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import "echarts-gl";
import { Bar3dProps } from "@/types/ChartBaseProps";

export default function Bar3dChart({
                                       xAxis,
                                       yAxis,
                                       zAxis,
                                       data,
                                       setChartInstance,
                                   }: Bar3dProps) {
    const chartRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!chartRef.current) return;

        const chart = echarts.init(chartRef.current);
        setChartInstance(chart); // ✅ 전달

        const seriesData = data.map(item => [
            item[xAxis],
            item[yAxis],
            isNaN(Number(item[zAxis])) ? 0 : Number(item[zAxis]),
        ]);

        chart.setOption({
            tooltip: {
                formatter: (params: any) =>
                    `${xAxis}: ${params.value[0]}<br>${yAxis}: ${params.value[1]}<br>${zAxis}: ${params.value[2]}`,
            },
            xAxis3D: { type: "category", name: xAxis },
            yAxis3D: { type: "category", name: yAxis },
            zAxis3D: { type: "value", name: zAxis },
            grid3D: {
                boxWidth: 100,
                boxDepth: 80,
                viewControl: {
                    projection: "orthographic",
                    autoRotate: true,
                },
            },
            series: [
                {
                    type: "bar3D",
                    data: seriesData.map(item => ({ value: item })),
                },
            ],
        });

        return () => chart.dispose();
    }, [xAxis, yAxis, zAxis, data]);

    return <div ref={chartRef} className="w-full h-[500px]" />;
}

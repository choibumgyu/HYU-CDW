import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import "echarts-gl";

interface ChartRow {
    [key: string]: string | number | null;
}

interface Bar3DChartProps {
    xAxis: string;
    yAxis: string;
    zAxis: string;
    data: ChartRow[];
}

export default function Bar3DChart({ xAxis, yAxis, zAxis, data }: Bar3DChartProps) {
    const chartRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!chartRef.current || !xAxis || !yAxis || !zAxis || data.length === 0) return;

        echarts.dispose(chartRef.current);
        const chart = echarts.init(chartRef.current);

        const seriesData = data.map((row) => [
            row[xAxis],
            row[yAxis],
            isNaN(Number(row[zAxis])) ? 0 : Number(row[zAxis])
        ]);

        chart.setOption({
            tooltip: {
                formatter: (params: any) =>
                    `${xAxis}: ${params.value[0]}<br>${yAxis}: ${params.value[1]}<br>${zAxis}: ${params.value[2]}`,
            },
            title: {
                text: "3D Bar Chart",
                left: "center",
            },
            xAxis3D: {
                type: "category",
                name: xAxis,
            },
            yAxis3D: {
                type: "category",
                name: yAxis,
            },
            zAxis3D: {
                type: "value",
                name: zAxis,
            },
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
                    data: seriesData.map((item) => ({ value: item })),
                },
            ],
        });
    }, [xAxis, yAxis, zAxis, data]);

    return <div ref={chartRef} className="w-full h-[500px]" />;
}

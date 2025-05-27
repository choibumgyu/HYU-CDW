import { ChartBaseProps } from "@/types/ChartBaseProps";
import * as echarts from "echarts";
import { useEffect, useRef } from "react";

export default function LineChart({ xAxis, yAxis, data, setChartInstance }: ChartBaseProps) {
    const chartRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!chartRef.current) return;
        const chart = echarts.init(chartRef.current);
        setChartInstance(chart);

        chart.setOption({
            xAxis: { type: "category", data: data.map(d => d[xAxis]), name: xAxis },
            yAxis: { type: "value", name: yAxis },
            tooltip: { trigger: "axis" },
            series: [{ type: "line", data: data.map(d => Number(d[yAxis])) }]
        });

        return () => chart.dispose();
    }, [xAxis, yAxis, data]);

    return <div ref={chartRef} className="w-full h-[500px]" />;
}

"use client";

import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";
import "echarts-gl";
import { Bar3dProps } from "@/types/ChartBaseProps";
import { detectCategoricalColumns } from "@/utils/analyzeData";
import { translateColumn } from "@/utils/translate"; // ✅ 컬럼명 번역 함수

export default function Bar3dChart({
                                       xAxis,
                                       yAxis,
                                       zAxis,
                                       data,
                                       setChartInstance,
                                   }: Bar3dProps) {
    const chartRef = useRef<HTMLDivElement>(null);
    const [groupedMode, setGroupedMode] = useState(false); // ✅ 기본 해제
    const [zMode, setZMode] = useState<"count" | "sum" | "avg">("count");

    const colorPalette = [
        "#5470C6", "#91CC75", "#FAC858", "#EE6666", "#73C0DE",
        "#3BA272", "#FC8452", "#9A60B4", "#EA7CCC"
    ];

    // ✅ 자동 그룹화 비활성화
    /*
    useEffect(() => {
      const categoricals = detectCategoricalColumns(data);
      if (categoricals.includes(xAxis) && categoricals.includes(yAxis)) {
        setGroupedMode(true);
      }
    }, [xAxis, yAxis, data]);
    */

    useEffect(() => {
        if (!zAxis && zMode !== "count") {
            setZMode("count");
        }
    }, [zAxis]);

    useEffect(() => {
        if (!chartRef.current) return;
        const chart = echarts.init(chartRef.current);
        setChartInstance(chart);

        let seriesData: any[] = [];

        if (groupedMode) {
            const grouped: Record<string, Record<string, number[]>> = {};

            for (const row of data) {
                const x = row[xAxis];
                const y = row[yAxis];
                const z = zAxis ? Number(row[zAxis]) : 1;

                if (!grouped[x]) grouped[x] = {};
                if (!grouped[x][y]) grouped[x][y] = [];
                grouped[x][y].push(z);
            }

            let index = 0;
            for (const x in grouped) {
                for (const y in grouped[x]) {
                    const values = grouped[x][y];
                    const value =
                        zMode === "count"
                            ? values.length
                            : zMode === "sum"
                                ? values.reduce((a, b) => a + b, 0)
                                : values.reduce((a, b) => a + b, 0) / values.length;

                    seriesData.push({
                        value: [x, y, value],
                        itemStyle: {
                            color: colorPalette[index % colorPalette.length],
                        },
                    });
                    index++;
                }
            }
        } else {
            seriesData = data.map((row, index) => ({
                value: [
                    row[xAxis],
                    row[yAxis],
                    isNaN(Number(row[zAxis])) ? 0 : Number(row[zAxis]),
                ],
                itemStyle: {
                    color: colorPalette[index % colorPalette.length],
                },
            }));
        }

        chart.setOption({
            tooltip: {
                formatter: (params: any) =>
                    `${translateColumn(xAxis)}: ${params.value[0]}<br>` +
                    `${translateColumn(yAxis)}: ${params.value[1]}<br>` +
                    `${translateColumn(zAxis || "count")}: ${params.value[2]}`,
            },
            xAxis3D: { type: "category", name: translateColumn(xAxis) },
            yAxis3D: { type: "category", name: translateColumn(yAxis) },
            zAxis3D: { type: "value", name: translateColumn(zAxis || "count") },
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
                    data: seriesData,
                },
            ],
        });

        return () => chart.dispose();
    }, [xAxis, yAxis, zAxis, data, groupedMode, zMode]);

    return (
        <div className="w-full h-[550px]">
            <div className="flex justify-end gap-4 text-sm mb-2">
                <label className="flex items-center gap-1">
                    <input
                        type="checkbox"
                        checked={groupedMode}
                        onChange={() => setGroupedMode((prev) => !prev)}
                    />
                    그룹화된 값으로 보기
                </label>

                {groupedMode && (
                    <select
                        className="border px-2 py-1 rounded text-sm"
                        value={zMode}
                        onChange={(e) =>
                            setZMode(e.target.value as "count" | "sum" | "avg")
                        }
                    >
                        <option value="count">Z값: 개수</option>
                        {zAxis && (
                            <>
                                <option value="sum">Z값: 합계</option>
                                <option value="avg">Z값: 평균</option>
                            </>
                        )}
                    </select>
                )}
            </div>

            <div ref={chartRef} className="w-full h-[500px]" />
        </div>
    );
}

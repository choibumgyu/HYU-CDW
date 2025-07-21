"use client";

import { useEffect, useRef, useState } from "react";
import 'echarts-gl';
import * as echarts from "echarts";

import DataTable from "@/components/charts/DataTable";
import BarChart from "@/components/charts/BarChart";
import LineChart from "@/components/charts/LineChart";
import ScatterChart from "@/components/charts/ScatterChart";
import Bar3dChart from "@/components/charts/Bar3dChart";
import PieChart from "@/components/charts/PieChart";

import BackToAiButton from "@/components/ui/BackToAiButton";
import { translateColumn } from "@/utils/translate";

interface ChartRow {
    [key: string]: string | number | null;
}

export default function AnalysisPage() {
    const chartRef = useRef<HTMLDivElement>(null);
    const [sql, setSql] = useState("");
    const [xAxis, setXAxis] = useState("");
    const [yAxis, setYAxis] = useState("");
    const [zAxis, setZAxis] = useState("");
    const [limit, setLimit] = useState<number | undefined>(undefined);
    const [globalData, setGlobalData] = useState<ChartRow[]>([]);
    const [columnNames, setColumnNames] = useState<string[]>([]);
    const [currentChartType, setCurrentChartType] = useState<string | null>(null);
    const [hoveredAxis, setHoveredAxis] = useState<string | null>(null);
    const [error, setError] = useState<string>("");
    const [chartInstance, setChartInstance] = useState<echarts.ECharts | null>(null);
    const [showScrollTop, setShowScrollTop] = useState(false);

    const fetchChartData = async (customQuery?: string) => {
        try {
            const queryToRun = customQuery || sql;
            setCurrentChartType("table");

            const response = await fetch("/api/sql-execute", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({ sql: queryToRun })
            });

            const result: { data?: ChartRow[]; error?: string; detail?: any } = await response.json();
            console.log("📦 DuckDNS 응답 전체:", JSON.stringify(result, null, 2));

            if (response.status === 422) {
                const msg = result?.detail?.[0]?.msg || "유효성 오류 발생";
                throw new Error(`422 오류: ${msg}`);
            }

            if (response.status === 400) {
                throw new Error("❌ 입력한 SQL 문에 문법 오류가 있어 실행할 수 없습니다.");
            }

            if (!response.ok || result.error) {
                throw new Error(result.error || `서버 오류: HTTP ${response.status}`);
            }

            if (!Array.isArray(result.data)) {
                throw new Error("데이터 형식이 올바르지 않습니다.");
            }

            setXAxis("");
            setYAxis("");
            setZAxis("");
            setLimit(undefined);

            setGlobalData(result.data);
            setColumnNames(
                Object.keys(result.data[0]).filter(key =>
                    result.data!.some(row => row[key] !== "N/A")
                )
            );

            setCurrentChartType("table");
            setError("");
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "알 수 없는 오류";
            console.error("SQL 실행 오류:", message);
            setError("❌ SQL 실행 오류: " + message);
        }
    };

    useEffect(() => {
        const stored = sessionStorage.getItem("custom_sql");
        if (stored) {
            setSql(stored);
            fetchChartData(stored);
            sessionStorage.removeItem("custom_sql");
        }
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            const scrolledDown = window.scrollY > 300;
            const longPage = document.body.scrollHeight > 2000;
            setShowScrollTop(scrolledDown && longPage);
        };

        window.addEventListener("scroll", handleScroll);
        handleScroll();

        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const filteredData = limit ? globalData.slice(0, limit) : globalData;

    const calculateSummary = (col: string) => {
        const values = filteredData.map(row => Number(row[col])).filter(val => !isNaN(val));
        if (values.length === 0) return null;

        const sorted = [...values].sort((a, b) => a - b);
        const median = sorted.length % 2 === 0
            ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
            : sorted[Math.floor(sorted.length / 2)];

        return {
            mean: values.reduce((a, b) => a + b, 0) / values.length,
            median,
            max: Math.max(...values),
            min: Math.min(...values),
            count: values.length,
        };
    };

    const downloadChartImage = () => {
        if (!chartInstance) {
            alert("그래프가 먼저 생성되어야 합니다.");
            return;
        }
        const base64 = chartInstance.getDataURL({ type: "png", pixelRatio: 2 });
        const link = document.createElement("a");
        link.href = base64;
        link.download = "chart.png";
        link.click();
    };

    const downloadCSV = () => {
        if (!filteredData.length) {
            alert("다운로드할 데이터가 없습니다.");
            return;
        }

        const header = Object.keys(filteredData[0]);
        const rows = filteredData.map(row => header.map(h => `"${String(row[h] ?? "")}"`).join(","));
        const csvContent = [header.join(","), ...rows].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "table.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const renderSummaryTooltip = (col: string) => {
        const summary = calculateSummary(col);
        if (!summary) return null;
        return (
            <div className="absolute z-10 bg-white border p-2 rounded-md text-sm shadow-lg">
                <p><strong>{translateColumn(col)} 요약</strong></p>
                <p>개수: {summary.count}</p>
                <p>평균: {summary.mean.toFixed(2)}</p>
                <p>중앙값: {summary.median}</p>
                <p>최댓값: {summary.max}</p>
                <p>최솟값: {summary.min}</p>
            </div>
        );
    };

    return (
        <div className="font-sans text-center">
            <BackToAiButton />
            <h1 className="text-3xl font-bold mt-6">CDW 데이터 시각화</h1>

            {/* 쿼리 입력 */}
            <div className="w-4/5 mx-auto my-4 flex flex-col items-end bg-white p-4 rounded-lg">
                <textarea
                    rows={4}
                    placeholder="SQL 쿼리를 입력하세요."
                    className="w-full mb-2 border rounded p-2"
                    value={sql}
                    onChange={(e) => setSql(e.target.value)}
                />
                <button
                    onClick={() => fetchChartData()}
                    title="쿼리 실행"
                    className="w-10 h-10 flex items-center justify-center text-xl border rounded-full bg-gray-100 hover:bg-gray-200 active:bg-gray-300"
                >
                    ▶
                </button>
            </div>

            {error && (
                <div className="text-red-600 font-semibold mb-4">{error}</div>
            )}

            {/* 축 선택 */}
            <div className="flex justify-center gap-4 flex-wrap mt-4">
                {["xAxis", "yAxis", currentChartType === "bar3D" ? "zAxis" : null]
                    .filter(Boolean)
                    .map((axis) => {
                        const value =
                            axis === "xAxis" ? xAxis : axis === "yAxis" ? yAxis : zAxis;
                        const setter =
                            axis === "xAxis" ? setXAxis : axis === "yAxis" ? setYAxis : setZAxis;
                        const label = axis!.charAt(0).toUpperCase();

                        return (
                            <div
                                key={axis}
                                className="relative inline-block w-auto min-w-[8rem] max-w-[20rem]"
                                title={`${translateColumn(value)} (${label}축 선택)`}
                                onMouseEnter={() => setHoveredAxis(axis!)}
                                onMouseLeave={() => setHoveredAxis(null)}
                            >
                                <select
                                    value={value}
                                    onChange={(e) => setter(e.target.value)}
                                    className="appearance-none w-full border border-gray-300 rounded-full px-4 py-2 pr-10 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                                >
                                    <option value="">{label}</option>
                                    {columnNames.map((name) => (
                                        <option key={name} value={name}>
                                            {translateColumn(name)}
                                        </option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-400">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                                {hoveredAxis === axis && value && (
                                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50">
                                        {renderSummaryTooltip(value)}
                                    </div>
                                )}
                            </div>
                        );
                    })}
            </div>


            {/* 데이터 제한 */}
            <div className="my-6 flex justify-center">
                <div className="text-left">
                    <input
                        type="number"
                        min={1}
                        value={limit || ""}
                        onChange={(e) => {
                            const value = parseInt(e.target.value);
                            setLimit(isNaN(value) ? undefined : value);
                        }}
                        className="border rounded px-2 py-1 w-24"
                        placeholder="Top N"
                    />
                    {globalData.length > 0 && (
                        <p className="text-xs text-gray-400 mt-1 text-center">
                            총 {globalData.length}개 데이터
                        </p>
                    )}
                </div>
            </div>

            {/* 차트 선택 */}
            <div className="flex justify-center flex-wrap gap-4 mt-8">
                <ChartButton
                    label={<img src="/images/bar.png" title="Bar Chart" className="w-8 h-8" />}
                    onClick={() => setCurrentChartType("bar")}
                />
                <ChartButton
                    label={<img src="/images/line.png" title="Line Chart" className="w-8 h-8" />}
                    onClick={() => setCurrentChartType("line")}
                />
                <ChartButton
                    label={<img src="/images/scatter.png" title="Scatter Chart" className="w-8 h-8" />}
                    onClick={() => setCurrentChartType("scatter")}
                />
                <ChartButton
                    label={<img src="/images/bar.png" title="3D Bar Chart" className="w-8 h-8" />}
                    onClick={() => setCurrentChartType("bar3D")}
                />
                <ChartButton
                    label={<img src="/images/pie.png" title="Pie Chart" className="w-8 h-8" />}
                    onClick={() => setCurrentChartType("pie")}
                />
                <ChartButton
                    label={<img src="/images/table.png" title="Table View" className="w-8 h-8" />}
                    onClick={() => setCurrentChartType("table")}
                />
            </div>

            {/* 차트 렌더링 */}
            {filteredData.length > 0 ? (
                currentChartType === "bar" ? (
                    <BarChart xAxis={xAxis} yAxis={yAxis} data={filteredData} setChartInstance={setChartInstance} />
                ) : currentChartType === "line" ? (
                    <LineChart xAxis={xAxis} yAxis={yAxis} data={filteredData} setChartInstance={setChartInstance} />
                ) : currentChartType === "scatter" ? (
                    <ScatterChart xAxis={xAxis} yAxis={yAxis} data={filteredData} setChartInstance={setChartInstance} />
                ) : currentChartType === "pie" ? (
                    <PieChart xAxis={xAxis} yAxis={yAxis} data={filteredData} setChartInstance={setChartInstance} />
                ) : currentChartType === "bar3D" ? (
                    <Bar3dChart xAxis={xAxis} yAxis={yAxis} zAxis={zAxis} data={filteredData} setChartInstance={setChartInstance} />
                ) : currentChartType === "table" ? (
                    <DataTable data={filteredData} columns={columnNames} />
                ) : (
                    <div ref={chartRef} className="relative w-4/5 h-[500px] mx-auto my-4" />
                )
            ) : (
                <div className="w-4/5 h-[400px] mx-auto mt-8 flex items-center justify-center text-gray-500 text-sm">
                    <div className="text-center">
                        <div className="animate-pulse text-4xl mb-2">📭</div>
                        <p className="text-base font-semibold">조회된 데이터가 없습니다</p>
                        <p className="text-sm text-gray-600 font-medium mt-1">
                            SQL을 수정하거나 축을 선택하세요
                        </p>
                    </div>
                </div>
            )}

            {/* 다운로드 버튼 */}
            <div className="fixed top-[80px] right-6 flex gap-2 z-30">
                <button
                    onClick={downloadChartImage}
                    title="그래프 다운로드"
                    className={`flex items-center gap-1 px-3 py-1 text-sm rounded-full shadow transition
            ${currentChartType === "table"
                        ? "bg-gray-300 text-white cursor-not-allowed pointer-events-none"
                        : "bg-cyan-500 hover:bg-cyan-600 text-white"}`}
                >
                    📈 <span className="hidden sm:inline">차트</span>
                </button>
                <button
                    onClick={downloadCSV}
                    title="CSV 다운로드"
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-cyan-500 hover:bg-cyan-600 text-white rounded-full shadow"
                >
                    📄 <span className="hidden sm:inline">CSV</span>
                </button>
            </div>

            {/* TOP 버튼 */}
            {currentChartType === "table" && showScrollTop && (
                <div className="fixed bottom-6 right-6 z-30">
                    <button
                        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                        title="맨 위로"
                        className="flex items-center justify-center px-3 py-2 text-sm bg-gray-500 hover:bg-gray-600 text-white rounded-full shadow"
                    >
                        TOP
                    </button>
                </div>
            )}
        </div>
    );
}

function ChartButton({
                         label,
                         onClick,
                     }: {
    label: React.ReactNode;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className="flex items-center justify-center w-20 h-20 border rounded-2xl shadow-md text-6xl hover:bg-gray-100 transition"
        >
            {label}
        </button>
    );
}

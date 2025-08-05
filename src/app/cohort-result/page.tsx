'use client';

import { useEffect, useState, useMemo } from "react";
import DataTable from "@/components/charts/DataTable";
import BackToAiButton from "@/components/ui/BackToAiButton";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { translateColumn } from "@/utils/translate";
import { analyzeDataSummary } from "@/utils/analyzeData";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface RowData {
    [key: string]: string | number | null;
}

function isSQL(query: string): boolean {
    return /^\s*select\b/i.test(query.trim());
}

export default function CohortResultPage() {
    const [sql, setSql] = useState<string | null>(null);
    const [data, setData] = useState<RowData[]>([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const storedSql = sessionStorage.getItem("cohort_sql");
        if (storedSql && isSQL(storedSql)) {
            setSql(storedSql);
        } else {
            setError("❌ SQL이 제공되지 않았거나 유효하지 않습니다.");
        }
    }, []);

    useEffect(() => {
        if (!sql) return;
        const fetchData = async () => {
            try {
                setLoading(true);
                setError("");

                const token = sessionStorage.getItem("token");

                const res = await fetch("/api/sql-execute", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                        ...(token && { Authorization: `Bearer ${token}` })
                    },
                    body: JSON.stringify({ sql }),
                });

                const contentType = res.headers.get("content-type") || "";
                let result: any = {};
                if (contentType.includes("application/json")) {
                    result = await res.json();
                } else {
                    const text = await res.text();
                    const titleMatch = text.match(/<title>(.*?)<\/title>/i);
                    const title = titleMatch ? titleMatch[1] : `HTML 응답 (HTTP ${res.status})`;
                    throw new Error(title);
                }

                if (!res.ok || result.error) {
                    throw new Error(result.error || `서버 오류: HTTP ${res.status}`);
                }

                const rows = Array.isArray(result.data) ? result.data : [];
                setData(rows);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "알 수 없는 오류";
                setError(message);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [sql]);

    const summary = useMemo(() => analyzeDataSummary(data), [data]);

    const SummaryCards = () => {
        if (!summary) return null;
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {Object.entries(summary).map(([col, info]) => {
                    const label = translateColumn(col);
                    if (info.type === "numericContinuous") {
                        return (
                            <div key={col} className="border rounded-lg p-4 shadow-sm bg-white">
                                <h3 className="font-semibold mb-2">{label}</h3>
                                <p>평균: {info.mean.toFixed(2)}</p>
                                <p>최소: {info.min}</p>
                                <p>최대: {info.max}</p>
                            </div>
                        );
                    }
                    if (info.type === "id") {
                        return (
                            <div key={col} className="border rounded-lg p-4 shadow-sm bg-white">
                                <h3 className="font-semibold mb-2">{label}</h3>
                                <p>고유값 개수: {info.uniqueCount}</p>
                            </div>
                        );
                    }
                    if (info.type === "categorical") {
                        const entries = Object.entries(info.counts)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 5);
                        return (
                            <div key={col} className="border rounded-lg p-4 shadow-sm bg-white">
                                <h3 className="font-semibold mb-2">{label}</h3>
                                {entries.map(([val, count]) => (
                                    <p key={val}>
                                        {val}: {count}
                                    </p>
                                ))}
                            </div>
                        );
                    }
                })}
            </div>
        );
    };

    const Charts = () => {
        if (!summary) return null;
        return (
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(summary).map(([col, info]) => {
                    const label = translateColumn(col);
                    if (info.type === "categorical") {
                        const entries = Object.entries(info.counts);
                        const sorted = entries.sort((a, b) => b[1] - a[1]);
                        const labels = sorted.slice(0, 10).map(([v]) => v);
                        const counts = sorted.slice(0, 10).map(([, c]) => c);
                        return (
                            <div key={col} className="p-4 border rounded-lg shadow-sm bg-white">
                                <h3 className="font-semibold mb-2">{label} (상위 10)</h3>
                                <div className="h-48">
                                    <Bar
                                        data={{
                                            labels,
                                            datasets: [
                                                {
                                                    label,
                                                    data: counts,
                                                    backgroundColor: "rgba(54, 162, 235, 0.5)",
                                                },
                                            ],
                                        }}
                                        options={{
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            plugins: { legend: { display: false } },
                                        }}
                                    />
                                </div>
                            </div>
                        );
                    }
                    if (info.type === "numericContinuous") {
                        const histLabels = info.binLabels || info.distribution.map((_, i) => `${i + 1}`);
                        return (
                            <div key={col} className="p-4 border rounded-lg shadow-sm bg-white">
                                <h3 className="font-semibold mb-2">{label} (분포)</h3>
                                <div className="h-48">
                                    <Bar
                                        data={{
                                            labels: histLabels,
                                            datasets: [
                                                {
                                                    label,
                                                    data: info.distribution,
                                                    backgroundColor: "rgba(255, 99, 132, 0.5)",
                                                },
                                            ],
                                        }}
                                        options={{
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            plugins: { legend: { display: false } },
                                        }}
                                    />
                                </div>
                            </div>
                        );
                    }
                    return null;
                })}
            </div>
        );
    };

    const columnKeys = data.length > 0 ? Object.keys(data[0]) : [];

    return (
        <div className="max-w-7xl mx-auto p-6">
            <BackToAiButton />
            <h1 className="text-2xl font-bold mb-4">🧬 코호트 분석</h1>

            {loading && <p className="text-gray-500">데이터 불러오는 중...</p>}
            {error && <p className="text-red-600 font-semibold">{error}</p>}

            {!loading && !error && data.length === 0 && (
                <p className="text-gray-500">데이터가 없습니다.</p>
            )}

            {!loading && !error && data.length > 0 && (
                <>
                    <SummaryCards />
                    <div className="mb-6">
                        <DataTable data={data} columns={columnKeys} />
                    </div>
                    <Charts />
                </>
            )}
        </div>
    );
}

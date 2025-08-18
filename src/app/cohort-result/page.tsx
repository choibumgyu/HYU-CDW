'use client';

import { useEffect, useState, useMemo, useRef } from "react"; // useRef 포함
import DataTable from "@/components/charts/DataTable";
import BackToAiButton from "@/components/ui/BackToAiButton";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { translateColumn } from "@/utils/translate";
import { analyzeDataSummary } from "@/utils/analyzeData";
import { buildAliasMap } from "@/utils/sqlAliasMap";

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
    const abortRef = useRef<AbortController | null>(null);

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
            const ac = new AbortController();
            abortRef.current = ac;
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
                    signal: ac.signal,
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
            } catch (err: any) {
                if (err?.name === "AbortError") {
                    setError("실행이 중지되었습니다.");
                } else {
                    const message = err instanceof Error ? err.message : "알 수 없는 오류";
                    setError(message);
                }
            } finally {
                setLoading(false);
                abortRef.current = null;
            }
        };
        fetchData();

        // SQL 변경/언마운트 시 진행 중 요청 취소
        return () => {
            abortRef.current?.abort();
        };
    }, [sql]);

    const summary = useMemo(() => {
        const aliasMap = sql ? buildAliasMap(sql) : undefined;
        return analyzeDataSummary(data, aliasMap);
    }, [data, sql]);

    const SummaryCards = () => {
        if (!summary) return null;
        const entries = Object.entries(summary);

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <div className="border rounded-lg p-4 shadow-sm bg-white">
                    <h3 className="font-semibold mb-2">총 데이터</h3>
                    <p>{data.length} 건</p>
                </div>

                {entries.map(([col, info]) => {
                    const label = translateColumn(col);

                    if ((info as any).type === "numericContinuous") {
                        const n = info as any;
                        return (
                            <div key={col} className="border rounded-lg p-4 shadow-sm bg-white">
                                <h3 className="font-semibold mb-2">{label}</h3>
                                <p>평균: {n.mean.toFixed(2)}</p>
                                <p>최소: {n.min}</p>
                                <p>최대: {n.max}</p>
                            </div>
                        );
                    }

                    if ((info as any).type === "categorical") {
                        const n = info as any;
                        const top = Object.entries(n.counts).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 5);
                        return (
                            <div key={col} className="border rounded-lg p-4 shadow-sm bg-white">
                                <h3 className="font-semibold mb-2">{label}</h3>
                                {top.map(([val, count]) => (
                                    <p key={val}>{val}: {count as number}</p>
                                ))}
                            </div>
                        );
                    }

                    return null;
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
                            <div key={col} className="p-4 border rounded-lg shadow_sm bg-white">
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

    const handleStop = async () => {
        try {
            const auth = sessionStorage.getItem("token");
            await fetch("/api/sql-execute/cancel", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(auth && { Authorization: `Bearer ${auth}` }),
                },
            });

        } catch (e) {
            console.warn("cancel API 호출 실패(무시 가능):", e);
        } finally {
            abortRef.current?.abort();   // 즉시 프론트 요청 중지
            setLoading(false);
            setData([]);           // 결과 숨김
            setError("실행이 중지되었습니다."); // 안내문
        }
    };

    return (
        <div className="max-w-7xl mx-auto p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <BackToAiButton />
                    <h1 className="text-2xl font-bold">🧬 코호트 분석</h1>
                </div>

                {loading && (
                    <button
                        type="button"
                        onClick={handleStop}
                        className="px-3 py-1.5 rounded shadow-sm text-white bg-red-600 hover:bg-red-700"
                        aria-label="실행 중지"
                    >
                        실행 중지
                    </button>
                )}
            </div>


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

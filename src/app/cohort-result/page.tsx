// src/app/cohort-result/page.tsx
'use client';

import { useEffect, useState, useMemo } from "react";
import DataTable from "@/components/charts/DataTable";
import BackToAiButton from "@/components/ui/BackToAiButton";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { translateColumn } from "@/utils/translate";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface RowData {
    [key: string]: string | number | null;
}

function isSQL(query: string): boolean {
    return /^\s*select\b/i.test(query.trim());
}

export default function CohortResultPage() {
    // 사용자가 직접 SQL을 입력하지 않으므로 inputSql 상태 삭제
    const [sql, setSql] = useState<string | null>(null);
    const [data, setData] = useState<RowData[]>([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // 페이지 로드 시 sessionStorage에서 SQL 읽어오기
    useEffect(() => {
        const storedSql = sessionStorage.getItem("cohort_sql");
        if (storedSql && isSQL(storedSql)) {
            setSql(storedSql);
        } else {
            setError("❌ SQL이 제공되지 않았거나 유효하지 않습니다.");
        }
    }, []);

    // SQL 실행 및 데이터 로딩
    useEffect(() => {
        if (!sql) return;

        const fetchData = async () => {
            try {
                setLoading(true);
                setError("");

                const res = await fetch("/api/sql-execute", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                    },
                    body: JSON.stringify({ sql }),
                });

                const result = await res.json();
                if (!res.ok || result.error) {
                    throw new Error(result.error || `서버 오류: HTTP ${res.status}`);
                }
                // result.data가 배열이 아니면 빈 배열로 처리
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

    // 이후 summary 계산, 카드/차트 렌더링 로직은 동일 (고유값 판단 로직 포함)
    const summary = useMemo(() => {
        if (data.length === 0) return null;
        const result: Record<
            string,
            | { type: "id"; uniqueCount: number }
            | { type: "numericContinuous"; mean: number; min: number; max: number; distribution: number[] }
            | { type: "categorical"; counts: Record<string, number> }
        > = {};

        const columns = Object.keys(data[0]);
        for (const col of columns) {
            const lower = col.toLowerCase();
            const isId = lower.endsWith("_id") || lower === "id";
            if (isId) {
                const uniqueCount = new Set(data.map((row) => row[col])).size;
                result[col] = { type: "id", uniqueCount };
                continue;
            }

            const values = data.map((row) => row[col]);
            const numericValues = values.filter(
                (v) => typeof v === "number" && !isNaN(v as number)
            ) as number[];
            if (numericValues.length > 0) {
                const uniqueNumeric = Array.from(new Set(numericValues));
                const DISCRETE_THRESHOLD = 15;
                if (uniqueNumeric.length <= DISCRETE_THRESHOLD) {
                    const counts: Record<string, number> = {};
                    numericValues.forEach((v) => {
                        const key = v.toString();
                        counts[key] = (counts[key] || 0) + 1;
                    });
                    result[col] = { type: "categorical", counts };
                } else {
                    const mean =
                        numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length;
                    const min = Math.min(...numericValues);
                    const max = Math.max(...numericValues);
                    const bins = 10;
                    const range = max - min || 1;
                    const distribution = Array(bins).fill(0);
                    numericValues.forEach((v) => {
                        const index = Math.min(
                            bins - 1,
                            Math.floor(((v - min) / range) * bins)
                        );
                        distribution[index]++;
                    });
                    result[col] = {
                        type: "numericContinuous",
                        mean,
                        min,
                        max,
                        distribution,
                    };
                }
            } else {
                const counts: Record<string, number> = {};
                values.forEach((v) => {
                    const key = (v === null || v === undefined ? "NULL" : v).toString();
                    counts[key] = (counts[key] || 0) + 1;
                });
                result[col] = { type: "categorical", counts };
            }
        }
        return result;
    }, [data]);

    // 카드/차트 컴포넌트는 이전과 동일
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
            <div className="mb-6">
                {Object.entries(summary).map(([col, info]) => {
                    const label = translateColumn(col);
                    if (info.type === "categorical") {
                        const entries = Object.entries(info.counts);
                        const sorted = entries.sort((a, b) => b[1] - a[1]);
                        const labels = sorted.slice(0, 10).map(([v]) => v);
                        const counts = sorted.slice(0, 10).map(([, c]) => c);
                        return (
                            <div key={col} className="mb-6">
                                <h3 className="font-semibold">{label} (상위 10)</h3>
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
                                        plugins: { legend: { display: false } },
                                    }}
                                />
                            </div>
                        );
                    }
                    if (info.type === "numericContinuous") {
                        const histLabels = info.distribution.map((_, i) => `${i + 1}`);
                        return (
                            <div key={col} className="mb-6">
                                <h3 className="font-semibold">{label} (분포)</h3>
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
                                        plugins: { legend: { display: false } },
                                    }}
                                />
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

            {/* 테스트 입력 영역이 제거되었으므로 여기에 아무 것도 없음 */}
            {loading && <p className="text-gray-500">데이터 불러오는 중...</p>}
            {error && <p className="text-red-600 font-semibold">{error}</p>}

            {!loading && !error && data.length === 0 && (
                <p className="text-gray-500">데이터가 없습니다.</p>
            )}

            {!loading && !error && data.length > 0 && (
                <>
                    <SummaryCards />
                    <Charts />
                    <DataTable data={data} columns={columnKeys} />
                </>
            )}
        </div>
    );
}

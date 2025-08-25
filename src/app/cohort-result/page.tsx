'use client';

import { useEffect, useState, useMemo, useRef } from "react";
import DataTable from "@/components/charts/DataTable";
import BackToAiButton from "@/components/ui/BackToAiButton";
import { translateColumn } from "@/utils/translate";
import { analyzeDataSummary, isSensitiveIdentifierName } from "@/utils/analyzeData";
import { buildAliasMap } from "@/utils/sqlAliasMap";
import { detectPreAggregated } from "@/utils/detectPreAggregated";
import { getTopChartSpec } from "@/utils/chartRules";

import NumericHistogramChart from "@/components/charts/NumericHistogramChart";
import { TopNCategoryChart } from "@/components/charts/TopNCategoryChart";
import { TopNByNumericChart } from "@/components/charts/TopNByNumericChart";

interface RowData {
    [key: string]: string | number | null;
}

type SummaryValue =
    | { type: "numericContinuous"; mean: number; min: number; max: number; distribution: number[]; binLabels: string[] }
    | { type: "categorical"; counts: Record<string, number> };

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
        if (storedSql && isSQL(storedSql)) setSql(storedSql);
        else setError("❌ SQL이 제공되지 않았거나 유효하지 않습니다.");
    }, []);

    useEffect(() => {
        if (!sql) return;
        const ac = new AbortController();
        abortRef.current = ac;

        (async () => {
            try {
                setLoading(true);
                setError("");

                const token = sessionStorage.getItem("token");
                const res = await fetch("/api/sql-execute", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                        ...(token && { Authorization: `Bearer ${token}` }),
                    },
                    body: JSON.stringify({ sql }),
                    signal: ac.signal,
                });

                const ct = res.headers.get("content-type") || "";
                const payload = ct.includes("application/json") ? await res.json() : (() => { throw new Error(`HTML 응답 (HTTP ${res.status})`); })();

                if (!res.ok || payload.error) throw new Error(payload.error || `서버 오류: HTTP ${res.status}`);
                setData(Array.isArray(payload.data) ? payload.data : []);
            } catch (e: any) {
                if (e?.name === "AbortError") setError("실행이 중지되었습니다.");
                else setError(e?.message || "알 수 없는 오류");
            } finally {
                setLoading(false);
                abortRef.current = null;
            }
        })();

        return () => abortRef.current?.abort();
    }, [sql]);

    const aliasMap = useMemo(() => (sql ? buildAliasMap(sql) : undefined), [sql]);
    const preAgg = useMemo(() => detectPreAggregated(data as any[], aliasMap), [data, aliasMap]);

    // ✅ 요약(raw) → 민감컬럼 제거 버전(summary)
    const rawSummary = useMemo(() => analyzeDataSummary(data, aliasMap), [data, aliasMap]);
    const summary = useMemo<Record<string, SummaryValue> | null>(() => {
        if (!rawSummary) return null;
        const out: any = { ...rawSummary };
        for (const k of Object.keys(out)) if (isSensitiveIdentifierName(k)) delete out[k];
        return out;
    }, [rawSummary]);

    // ✅ 일반 요약에서 사전집계(label,count) 컬럼 제거
    const preAggKeys = useMemo(() => {
        const s = new Set<string>();
        if (preAgg?.labelKey) s.add(preAgg.labelKey);
        if (preAgg?.countKey) s.add(preAgg.countKey);
        return s;
    }, [preAgg]);

    const summaryWithoutPreAgg = useMemo(() => {
        if (!summary) return null;
        const out: Record<string, SummaryValue> = {};
        for (const [k, v] of Object.entries(summary)) {
            if (!preAggKeys.has(k)) out[k] = v;
        }
        return Object.keys(out).length ? out : null;
    }, [summary, preAggKeys]);

    // ✅ Top-N 사양: 단 한 줄 (사전집계 우선 + 규칙 기반 폴백)
    const topSpec = useMemo(
        () => getTopChartSpec(data as any[], { aliasMap, preAgg }),
        [data, aliasMap, preAgg]
    );

    const columnKeys = data.length > 0 ? Object.keys(data[0] as Record<string, any>) : [];

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
        } catch { }
        finally {
            abortRef.current?.abort();
            setLoading(false);
            setData([]);
            setError("실행이 중지되었습니다.");
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
            {!loading && !error && data.length === 0 && <p className="text-gray-500">데이터가 없습니다.</p>}

            {!loading && !error && data.length > 0 && (
                <>
                    {/* 1) 요약 섹션 */}
                    <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="border rounded-lg p-4 shadow-sm bg-white">
                            <h3 className="font-semibold mb-2">총 데이터</h3>
                            <p>{data.length} 건</p>
                        </div>

                        {summaryWithoutPreAgg &&
                            Object.entries(summaryWithoutPreAgg).map(([col, info]: any) => {
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
                                const top5 = Object.entries(info.counts).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5);
                                const rest = Math.max(0, Object.keys(info.counts).length - 5);
                                return (
                                    <div key={col} className="border rounded-lg p-4 shadow-sm bg-white">
                                        <h3 className="font-semibold mb-2">{label}</h3>
                                        {top5.map(([v, c]) => (
                                            <p key={v}>{v}: {c as number}</p>
                                        ))}
                                        {rest > 0 && <p className="text-gray-500 text-sm">… 외 {rest}개</p>}
                                    </div>
                                );
                            })}
                    </div>

                    {/* 2) 원본 테이블 */}
                    <div className="mb-6">
                        <DataTable data={data} columns={columnKeys} />
                    </div>

                    {/* 3) 차트 섹션 (사전집계/폴백 TopN + 일반 카테고리 + 연속형 분포) */}
                    {(summaryWithoutPreAgg || topSpec) && (
                        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* 사전집계/폴백 Top-N (label,count) */}
                            {topSpec && (
                                <TopNByNumericChart
                                    rows={data as any[]}
                                    labelCol={topSpec.labelKey}
                                    valueCol={topSpec.countKey}
                                    topN={10}
                                />
                            )}

                            {/* 일반 요약 기반 차트들: categorical + numericContinuous */}
                            {summaryWithoutPreAgg &&
                                Object.entries(summaryWithoutPreAgg).map(([col, info]: any) => {
                                    const title = translateColumn(col);

                                    // 범주형: TopN + 기타 자동 처리
                                    if (info.type === "categorical") {
                                        return (
                                            <TopNCategoryChart
                                                key={col}
                                                title={title}
                                                counts={info.counts as Record<string, number>}
                                                topN={10}
                                            />
                                        );
                                    }

                                    // 연속형: 히스토그램(분포)
                                    if (info.type === "numericContinuous") {
                                        const labels = info.binLabels || info.distribution.map((_: any, i: number) => `${i + 1}`);
                                        return (
                                            <NumericHistogramChart
                                                key={col}
                                                title={`${title} (분포)`}
                                                labels={labels}
                                                distribution={info.distribution}
                                            />
                                        );
                                    }
                                    return null;
                                })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

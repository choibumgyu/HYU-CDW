'use client';

import { useEffect, useState, useMemo, useRef } from "react";
import DataTable from "@/components/charts/DataTable";
import BackToAiButton from "@/components/ui/BackToAiButton";
import { translateColumn } from "@/utils/translate";
import { analyzeDataSummary, isSensitiveIdentifierName, shouldHideColumnByName } from "@/utils/analyzeData";
import { buildAliasMap } from "@/utils/sqlAliasMap";
import { detectPreAggregated } from "@/utils/detectPreAggregated";
import { getTopChartSpec, looksCountName } from "@/utils/chartRules";

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

    const getDisplayName = (sourceKey: string) => {
        // aliasMap: alias -> source
        // 원본키 → 별칭(있으면) 역탐색해서, 번역 함수에 넣어도 되고
        const alias = Object.entries(aliasMap ?? {}).find(([, src]) => src === sourceKey)?.[0];
        // 1) 별칭이 있으면 별칭을 번역, 2) 없으면 원본키를 번역
        return translateColumn(alias ?? sourceKey);
    };

    // NEW: alias를 원본키로 되돌린 데이터
    const normalizedData = useMemo(() => {
        if (!data?.length) return [];
        return data.map(row => {
            const out: Record<string, any> = {};
            for (const k of Object.keys(row)) {
                const sourceKey = aliasMap?.[k] ?? k;   // ← 별칭이면 원본으로 되돌림
                out[sourceKey] = (row as any)[k];
            }
            return out;
        });
    }, [data, aliasMap]);

    const preAgg = useMemo(() => detectPreAggregated(normalizedData as any[], aliasMap), [normalizedData, aliasMap]);

    // ✅ 요약(raw) → 민감컬럼 제거 버전(summary)
    const rawSummary = useMemo(() => analyzeDataSummary(normalizedData, aliasMap), [normalizedData, aliasMap]);
    const summary = useMemo<Record<string, SummaryValue> | null>(() => {
        if (!rawSummary) return null;
        const out: any = { ...rawSummary };
        for (const k of Object.keys(out)) if (isSensitiveIdentifierName(k)) delete out[k];
        return out;
    }, [rawSummary]);


    const rawTopSpec = useMemo(
        () => getTopChartSpec(normalizedData as any[], { aliasMap, preAgg }),
        [normalizedData, aliasMap, preAgg]
    );

    // ✅ Top-N 사양: 단 한 줄 (사전집계 우선 + 규칙 기반 폴백)
    const topSpec = useMemo(() => {
        if (!rawTopSpec) return null;
        const { labelKey, countKey } = rawTopSpec;
        if (shouldHideColumnByName(labelKey) || isSensitiveIdentifierName(labelKey)) return null;
        return rawTopSpec;
    }, [rawTopSpec]);

    const topSummary = useMemo(() => {
        if (!topSpec || !normalizedData?.length) return null;

        const labelCol = topSpec.labelKey;
        const valueCol = topSpec.countKey;

        // label/value가 유효한 행만
        const valid = (normalizedData as any[]).filter(
            r => r[labelCol] != null && Number.isFinite(Number(r[valueCol]))
        );

        // 동일 라벨 합산
        const agg = new Map<string, number>();
        for (const r of valid) {
            const k = String(r[labelCol]);
            const v = Number(r[valueCol]);
            agg.set(k, (agg.get(k) || 0) + v);
        }

        const entries = [...agg.entries()].sort((a, b) => b[1] - a[1]);
        const topN = 10; // 카드에서도 10 기준(필요시 공통 상수로)
        const topEntries = entries.slice(0, topN);
        const otherEntries = entries.slice(topN);

        const sum = (arr: [string, number][]) => arr.reduce((s, [, v]) => s + v, 0);
        const topSum = sum(topEntries);
        const otherSum = sum(otherEntries);
        const total = sum(entries);

        return {
            title: `${getDisplayName(labelCol)}별 ${getDisplayName(valueCol)}`,
            topEntries,
            otherEntries,
            topSum,
            otherSum,
            total,
            topN,
            allCount: entries.length,
        };
    }, [topSpec, normalizedData]);

    // ✅ 일반 요약에서 사전집계(label,count) 컬럼 제거
    const preAggKeys = useMemo(() => {
        const s = new Set<string>();
        if (topSpec?.countKey) s.add(topSpec.countKey);
        if (topSpec?.labelKey) s.add(topSpec.labelKey);
        return s;
    }, [topSpec]);

    const summaryWithoutPreAgg = useMemo(() => {
        if (!summary) return null;
        const out: Record<string, SummaryValue> = {};
        for (const [k, v] of Object.entries(summary)) {
            if (shouldHideColumnByName(k) || isSensitiveIdentifierName(k)) continue;
            if (preAggKeys.has(k)) continue;

            // ✅ count-like 이름이면(별칭/키 기준) 요약에서 제외
            const displayName = aliasMap?.[k] ?? k;
            if (looksCountName(displayName)) continue;

            // ✅ 범주형인데 값이 전부 1(=의미 없는 분포)이면 제외
            if ((v as any)?.type === "categorical") {
                const vals = Object.values((v as any).counts || {}) as number[];
                if (vals.length && Math.max(...vals) <= 1) continue;
            }

            out[k] = v;
        }
        return Object.keys(out).length ? out : null;
    }, [summary, preAggKeys, aliasMap]);


    const hasCategoricalInSummary = useMemo(() => {
        if (!summaryWithoutPreAgg) return false;
        return Object.values(summaryWithoutPreAgg).some((v: any) => v?.type === "categorical");
    }, [summaryWithoutPreAgg]);

    const fallbackCat = useMemo(() => {
        if (!summaryWithoutPreAgg) return null;
        // 카디널리티 2~100 사이의 범주형 중에서 하나 선택 (원하는 기준으로 정렬 가능)
        const cats = Object.entries(summaryWithoutPreAgg)
            .filter(([, v]: any) => v?.type === "categorical")
            .map(([k, v]: any) => ({ key: k, counts: v.counts, card: Object.keys(v.counts ?? {}).length }))
            .filter(x => x.card >= 2 && x.card <= 100)
            .sort((a, b) => b.card - a.card); // 예: 카드inality 큰 순
        return cats[0] ?? null;
    }, [summaryWithoutPreAgg]);

    const columnKeys = useMemo(() => {
        const set = new Set<string>();
        for (const r of data as RowData[]) Object.keys(r || {}).forEach(k => set.add(k));
        return Array.from(set);
    }, [data]);

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
                        {/* 총 데이터 */}
                        <div className="border rounded-lg p-4 shadow-sm bg-white">
                            <h3 className="font-semibold mb-2">총 데이터</h3>
                            <p>{data.length} 건</p>
                        </div>

                        {summaryWithoutPreAgg &&
                            Object.entries(summaryWithoutPreAgg).map(([col, info]: any) => {
                                const label = getDisplayName(col);
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
                                        {top5.map(([v, c]) => (<p key={v}>{v}: {c as number}</p>))}
                                        {rest > 0 && <p className="text-gray-500 text-sm">… 외 {rest}개</p>}
                                    </div>
                                );
                            })}

                        {topSummary && (
                            <div className="border rounded-lg p-4 shadow-sm bg-white">
                                <h3 className="font-semibold mb-2">{topSummary.title}</h3>
                                {topSummary.topEntries.slice(0, 5).map(([label, cnt]) => (
                                    <p key={label}>{label}: {cnt.toLocaleString()}</p>
                                ))}
                                {topSummary.topEntries.length > 5 && (
                                    <p className="text-gray-500 text-sm">… 외 {Math.max(0, topSummary.allCount - 5)}개</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 2) 원본 테이블 */}
                    <div className="mb-6">
                        <DataTable data={data} columns={columnKeys} />
                    </div>

                    {(summaryWithoutPreAgg || topSpec || fallbackCat) && (
                        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* 1) 사전집계 TopN: 있으면 항상 표시 */}
                            {topSpec && (
                                <TopNByNumericChart
                                    rows={normalizedData as any[]}
                                    labelCol={topSpec.labelKey}
                                    valueCol={topSpec.countKey}
                                    labelDisplay={getDisplayName(topSpec.labelKey)}
                                    valueDisplay={getDisplayName(topSpec.countKey)}
                                    topN={10}
                                />
                            )}

                            {/* 2) 요약 기반 차트들: categorical + numericContinuous 전부 렌더 */}
                            {summaryWithoutPreAgg &&
                                Object.entries(summaryWithoutPreAgg).map(([col, info]: any) => {
                                    if (shouldHideColumnByName(col) || isSensitiveIdentifierName(col)) return null;
                                    const title = getDisplayName(col);

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

                            {/* 3) 폴백: 요약에 범주형이 아예 없을 때만 1장 그리기 */}
                            {!hasCategoricalInSummary && !topSpec && fallbackCat && (
                                <TopNCategoryChart
                                    title={getDisplayName(fallbackCat.key)}  // 번역 일관
                                    counts={fallbackCat.counts}
                                    topN={10}
                                />
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

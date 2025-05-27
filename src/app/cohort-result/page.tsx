"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DataTable from "@/components/charts/DataTable";

interface RowData {
    [key: string]: string | number | null;
}

function isSQL(query: string): boolean {
    return /^\s*select\s+.+\s+from\s+/i.test(query);
}

export default function CohortResultPage() {
    const router = useRouter();
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
        if (!sql || !isSQL(sql)) return;

        const fetchData = async () => {
            try {
                setLoading(true);
                setError("");

                const res = await fetch("/api/sql-execute", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json"
                    },
                    body: JSON.stringify({ sql })
                });

                const result = await res.json();
                console.log("📦 DuckDNS 응답 전체:", JSON.stringify(result, null, 2));

                if (res.status === 422) {
                    const msg = result?.detail?.[0]?.msg || "유효성 오류 발생";
                    throw new Error(`422 오류: ${msg}`);
                }

                if (res.status === 400) {
                    throw new Error("❌ 입력한 SQL 문에 문법 오류가 있어 실행할 수 없습니다.");
                }

                if (!res.ok || result.error) {
                    throw new Error(result.error || `서버 오류: HTTP ${res.status}`);
                }

                if (!Array.isArray(result.data)) {
                    throw new Error("데이터 형식이 올바르지 않습니다.");
                }

                setData(result.data);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "알 수 없는 오류";
                setError(message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [sql]);

    return (
        <div className="max-w-6xl mx-auto p-6">
            <h1 className="text-2xl font-bold mb-4">🧬 코호트 결과</h1>
            {loading && <p className="text-gray-500">데이터 불러오는 중...</p>}
            {error && <p className="text-red-600 font-semibold">{error}</p>}
            {!loading && !error && data.length > 0 && (
                <DataTable data={data} columns={Object.keys(data[0])} />
            )}
        </div>
    );
}

export const dynamic = "force-dynamic";

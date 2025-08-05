import { NextRequest, NextResponse } from "next/server";
import { setTimeout } from 'timers/promises';

export async function POST(req: NextRequest) {
    try {
        const { sql } = await req.json();
        if (!sql || typeof sql !== "string") {
            return NextResponse.json({ error: "SQL 쿼리가 없습니다." }, { status: 400 });
        }

        const controller = new AbortController();
        const timeout = 300_000; // 5분

       const timeoutId = setTimeout(() => controller.abort(), timeout);


        const token = req.headers.get("authorization");
        const baseUrl = process.env.NEXT_PUBLIC_OPEN_API;

        const apiRes = await fetch(`${baseUrl}/sql-executor/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                ...(token && { Authorization: token })
            },
            body: JSON.stringify({ sql }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        const result = await apiRes.json();

        if (apiRes.status === 422) {
            const msg = result?.detail?.[0]?.msg || "유효성 오류 발생";
            return NextResponse.json({ error: msg }, { status: 422 });
        }

        if (!apiRes.ok || result.error) {
            return NextResponse.json(
                { error: result.error || `서버 오류: ${apiRes.status}` },
                { status: apiRes.status }
            );
        }

        const rows = Array.isArray(result.data) ? result.data : [];
        return NextResponse.json({ data: rows });

    } catch (err: any) {
        if (err.name === 'AbortError') {
            return NextResponse.json({ error: "❌ SQL 실행이 5분을 초과해 중단되었습니다." }, { status: 408 });
        }

        const message = err instanceof Error ? err.message : "서버 오류 발생";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

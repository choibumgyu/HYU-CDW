import { NextRequest, NextResponse } from 'next/server';
//import { setTimeout } from 'timers/promises'; // Node.js 내장 타이머

export async function POST(req: NextRequest) {
    const { question } = await req.json();

    const controller = new AbortController();
    const timeout = 300_000; // 5분 (ms)

   const timeoutId = setTimeout(() => controller.abort(), timeout);


    try {
        const token = req.headers.get("authorization");
        const baseUrl = process.env.NEXT_PUBLIC_OPEN_API;

        const res = await fetch(`${baseUrl}/sql-generator/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token && { Authorization: token })
            },
            body: JSON.stringify({ text: question }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        const data = await res.json();

        if (res.status === 422) {
            const errorMsg = data?.detail?.[0]?.msg || "유효성 오류가 발생했습니다.";
            return NextResponse.json({
                sql: data.sql,
                error: data.error,
                debug: data,
                answer: `❌ [422 오류] ${errorMsg}`
            });
        }

        if (data.error) {
            return NextResponse.json({
                sql: data.sql,
                error: data.error,
                debug: data,
                answer: `❌ DuckDNS 오류: ${data.error}`
            });
        }

        const sql = data.sql;
        return NextResponse.json({
            sql: data.sql,
            error: data.error,
            debug: data,
            answer: (sql ? sql : `❌ SQL이 생성되지 않았습니다.\n\n${JSON.stringify(data, null, 2)}`)
        });

    } catch (err: any) {
        if (err.name === 'AbortError') {
            return NextResponse.json({ answer: "❌ 요청이 5분을 초과하여 중단되었습니다." });
        }
        console.error("❌ API 호출 실패:", err);
        return NextResponse.json({ answer: "❌ 서버 오류로 응답을 받을 수 없습니다." });
    }
}

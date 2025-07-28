import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    const { question } = await req.json();

    try {
        const token = req.headers.get("authorization"); // 클라이언트에서 전달된 토큰

        // 현재 요청의 프로토콜과 호스트를 가져옴
        const protocol = req.headers.get("x-forwarded-proto") || "https";
        const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
        const url = `${protocol}://${host}`;
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || url;

        const res = await fetch(`${baseUrl}/sql-generator`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token && { Authorization: token }) // 외부 API로 토큰 전달
            },
            body: JSON.stringify({ text: question })
        });
        // 예: /app/api/ask-ai/route.ts
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

    } catch (err) {
        console.error("❌ API 호출 실패:", err);
        return NextResponse.json({ answer: "❌ 서버 오류로 응답을 받을 수 없습니다." });
    }
}

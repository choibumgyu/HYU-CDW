import { NextRequest, NextResponse } from "next/server";
// ✅ 로컬 DB 연결 (lib/db.ts에 설정한 Pool 사용)
import pool from "../../../../lib/db";

export async function POST(req: NextRequest) {
    try {
        const { sql } = await req.json();

        if (!sql || typeof sql !== "string") {
            return NextResponse.json({ error: "SQL 쿼리가 없습니다." }, { status: 400 });
        }

        // ✅ [임시] 로컬 PostgreSQL 실행
        /*
        try {
            const result = await pool.query(sql);
            return NextResponse.json({ data: result.rows });
        } catch (err: any) {
            console.error("❌ 로컬 DB 실행 오류:", err.message);
            return NextResponse.json({ error: err.message }, { status: 400 });
        }
        */

        // 🔁 [원래 API 호출 방식 - 추후 복구용 주석]

        const endpoint = process.env.NEXT_PUBLIC_OPEN_API + "/sql-executor/";

        const token = req.headers.get("authorization"); // 클라이언트에서 받은 토큰 가져오기

        const apiRes = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                ...(token && { Authorization: token }) // 토큰이 있으면 외부 API로 전달
            },
            body: JSON.stringify({ sql })
        });


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

        return NextResponse.json({ data: result.data });
        //여기까지 주석
    } catch (err) {
        const message = err instanceof Error ? err.message : "서버 오류 발생";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

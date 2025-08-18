import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const { token, executionId } = await req.json();
        const cancelToken = token ?? executionId; // 백엔드 스펙에 맞게 사용
        if (!cancelToken) {
            return NextResponse.json({ error: "취소용 실행 토큰이 없습니다." }, { status: 400 });
        }

        const auth = req.headers.get("authorization");
        const baseUrl = process.env.NEXT_PUBLIC_OPEN_API;

        const res = await fetch(`${baseUrl}/sql-executor/cancel`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(auth && { Authorization: auth }),
            },
            body: JSON.stringify({ token: cancelToken }),
        });

        const ct = res.headers.get("content-type") || "";
        const data = ct.includes("application/json") ? await res.json() : {};
        if (!res.ok) {
            return NextResponse.json(
                { error: data?.error || `취소 실패 (HTTP ${res.status})` },
                { status: res.status }
            );
        }
        return NextResponse.json({ ok: true, data });
    } catch (e: any) {
        const msg = e instanceof Error ? e.message : "취소 요청 중 오류";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

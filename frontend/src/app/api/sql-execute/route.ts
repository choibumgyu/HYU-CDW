import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    const controller = new AbortController();
    const timeout = 300_000; // 5분
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const onClientAbort = () => controller.abort();
    req.signal?.addEventListener?.("abort", onClientAbort);

    try {
        const { sql } = await req.json();
        if (!sql || typeof sql !== "string") {
            return NextResponse.json({ error: "SQL 쿼리가 없습니다." }, { status: 400 });
        }


        const token = req.headers.get("authorization");
        const baseUrl = process.env.NEXT_PUBLIC_OPEN_API;

        const apiRes = await fetch(`${baseUrl}/sql-executor/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                ...(token && { Authorization: token }),
            },
            body: JSON.stringify({ sql }),
            signal: controller.signal, // ★ Abort 전파
        });

        // ---- (1) content-type 확인 ----
        const contentType = apiRes.headers.get("content-type") || "";

        // ---- (2) 에러 상태 처리 ----
        if (!apiRes.ok) {
            if (!contentType.includes("application/json")) {
                const htmlText = await apiRes.text();
                return NextResponse.json(
                    {
                        error: `서버 오류: ${apiRes.status} (HTML 응답)`,
                        htmlPreview: htmlText.slice(0, 200),
                    },
                    { status: apiRes.status }
                );
            }

            const errorResult = await apiRes.json().catch(() => ({}));
            return NextResponse.json(
                { error: errorResult?.error || `서버 오류: ${apiRes.status}` },
                { status: apiRes.status }
            );
        }

        // ---- (3) JSON만 파싱 ----
        if (!contentType.includes("application/json")) {
            const text = await apiRes.text();
            return NextResponse.json(
                { error: "서버 응답이 JSON이 아닙니다.", htmlPreview: text.slice(0, 200) },
                { status: 500 }
            );
        }

        const result = await apiRes.json();

        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        const rows = Array.isArray(result.data) ? result.data : [];
        const execToken = result.token ?? result.executionId ?? null;
        return NextResponse.json({ data: rows, token: execToken });
    } catch (err: any) {
        if (err?.name === "AbortError") {
            return NextResponse.json(
                { error: "❌ SQL 실행이 사용자 취소 또는 5분 초과로 중단되었습니다." },
                { status: 408 }
            );
        }
        const message = err instanceof Error ? err.message : "서버 오류 발생";
        return NextResponse.json({ error: message }, { status: 500 });
    } finally {
        clearTimeout(timeoutId);
        // @ts-ignore
        req.signal?.removeEventListener?.("abort", onClientAbort);
    }
}

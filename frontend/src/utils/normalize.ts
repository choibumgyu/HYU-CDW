// 전송 전, 질문 텍스트 정규화
export function normalizeQuestionForAPI(input: string): string {
    if (!input) return "";

    let s = input;

    // 1) 유니코드 정규화 (한글/조합문자 안정화)
    s = s.normalize("NFC");

    // 2) 보이는 스페이스처럼 보이지만 다른 코드 포인트들 제거/치환
    // - NO-BREAK SPACE( ) -> 일반 스페이스
    s = s.replace(/\u00A0/g, " ");
    // - Zero-width류 제거: ZWSP, ZWJ, ZWNJ, BOM
    s = s.replace(/[\u200B-\u200D\uFEFF]/g, "");

    // 3) 스마트 쿼트 -> 일반 쿼트 (모델/파서 오인 방지)
    s = s
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'");

    // 4) 줄바꿈을 공백으로 치환 (백엔드가 줄바꿈을 못 받는다면)
    s = s.replace(/\r\n/g, "\n").replace(/\n+/g, " ");

    // 5) 연속 공백 1칸으로 축약 + 양끝 trim
    s = s.replace(/\s+/g, " ").trim();

    return s;
}

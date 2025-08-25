"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatSqlForDisplay } from "@/utils/formatSql";
import { normalizeQuestionForAPI } from "@/utils/normalize";

interface ChatMessage {
    role: "user" | "bot";
    message: string;        // 화면 표시용 (SQL 포맷 결과 or 오류 메시지)
    rawSql?: string | null; // 실행/이동용 원본 SQL (오류면 null)
}

export default function AiChatPage() {
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLTextAreaElement | null>(null); // 입력창 포커스용 Ref
    const router = useRouter();

    // 대화 복원
    useEffect(() => {
        const saved = sessionStorage.getItem("chat_history");
        setChatHistory(saved ? JSON.parse(saved) : []);
    }, []);

    // 스크롤 하단 고정
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatHistory]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        // 1) 사용자 메시지는 '원문'으로 기록 (UI 표시용)
        const userMessage: ChatMessage = { role: "user", message: input };
        const baseHistory = [...chatHistory, userMessage];

        // 2) 전송 직전에만 정규화본 생성 (백엔드 파서 안정화)
        const normalizedQuestion = normalizeQuestionForAPI(input);

        // 3) 백엔드에는 정규화본만 전송 (원문은 필요 시 로그용으로 별도 필드에)
        const token = sessionStorage.getItem("token");
        const response = await fetch("/api/ask-ai/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token && { Authorization: `Bearer ${token}` }),
            },
            body: JSON.stringify({
                question: normalizedQuestion, // ⬅️ 전송용은 정규화본
                // raw_text: input,            // ⬅️ (선택) 서버 로그/디버깅용
            }),
        });

        const data = await response.json();
        const answer: string = data?.answer ?? "❌ SQL이 생성되지 않았습니다.";

        const sql =
            extractFromCodeBlock(answer) ??
            extractFromSelect(answer);

        const isSql = !!sql && /select/i.test(sql);
        const pretty = isSql ? formatSqlForDisplay(sql!) : answer;

        const botMessage: ChatMessage = {
            role: "bot",
            message: pretty,
            rawSql: isSql ? sql! : null,
        };

        const final = [...baseHistory, botMessage];
        setChatHistory(final);
        sessionStorage.setItem("chat_history", JSON.stringify(final));
        setInput("");
        if (inputRef.current) {
            inputRef.current.style.height = "40px";
            inputRef.current.style.overflowY = "hidden";
        }
    };
    const handleRoute = (target: "analysis" | "cohort-result", sql: string | null | undefined) => {
        if (!sql) {
            alert("❌ 실행할 SQL이 없습니다.");
            return;
        }
        sessionStorage.setItem(target === "analysis" ? "custom_sql" : "cohort_sql", sql);
        router.push(`/${target}`);
    };

    return (
        <div className="w-full max-w-6xl mx-auto p-4 flex flex-col h-[calc(100vh-100px)]">
            <h1 className="text-2xl font-bold mb-3">💬 AI 챗봇 (SQL 도우미)</h1>

            {/* 채팅 영역 */}
            <div className="bg-gray-100 rounded-md p-3 flex-1 min-h-[400px] max-h-[calc(100vh-260px)] overflow-y-auto border">
                {chatHistory.map((chat, idx) => (
                    <div
                        key={idx}
                        className={`mb-3 flex ${chat.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                        <div className="flex flex-col max-w-[85%]">
                            {/* 라벨 */}
                            <div className={`text-sm font-semibold mb-1 ${chat.role === "user" ? "text-right" : "text-left"}`}>
                                {chat.role === "user" ? "👤 나" : "🤖 GPT"}
                            </div>

                            {/* 말풍선 */}
                            <div
                                className={`px-4 py-3 rounded-lg border leading-relaxed inline-block ${chat.role === "user"
                                    ? "bg-white text-left"
                                    : "bg-blue-50 text-left border-blue-300"
                                    }`}
                            >
                                {chat.role === "bot" && chat.rawSql ? (
                                    <div className="whitespace-pre-wrap break-words font-mono text-base leading-relaxed">
                                        {chat.message}
                                    </div>
                                ) : (
                                    <div className={`whitespace-pre-wrap break-words ${chat.role === "bot" ? "text-red-600" : ""}`}>
                                        {chat.message}
                                    </div>
                                )}
                            </div>

                            {/* ✏ 사용자 메시지에만 수정 버튼 추가 */}
                            {chat.role === "user" && (
                                <button
                                    onClick={() => {
                                        setInput(chat.message);

                                        // 상태 업데이트 이후 강제로 높이 조절
                                        setTimeout(() => {
                                            if (inputRef.current) {
                                                const target = inputRef.current;
                                                target.style.height = "auto";
                                                const maxHeight = 200;

                                                if (target.scrollHeight > maxHeight) {
                                                    target.style.height = `${maxHeight}px`;
                                                    target.style.overflowY = "auto";
                                                } else {
                                                    target.style.height = `${target.scrollHeight}px`;
                                                    target.style.overflowY = "hidden";
                                                }

                                                target.focus();
                                            }
                                        }, 0);
                                    }}

                                    className="mt-1 ml-auto px-2 py-1 bg-yellow-400 hover:bg-yellow-500 text-xs rounded transition-colors"
                                >
                                    ✏ 수정하기
                                </button>

                            )}

                            {/* 봇 답변 버튼 */}
                            {chat.role === "bot" && (
                                <div className="mt-3 flex gap-3">
                                    <button
                                        onClick={() => handleRoute("analysis", chat.rawSql)}
                                        className="px-3 py-1 rounded bg-indigo-600 text-white text-sm"
                                    >
                                        📊 시각화로 보기
                                    </button>
                                    <button
                                        onClick={() => handleRoute("cohort-result", chat.rawSql)}
                                        className="px-3 py-1 rounded bg-green-600 text-white text-sm"
                                    >
                                        🧬 코호트 결과 보기
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* 입력 폼 */}
            <form onSubmit={handleSubmit} className="mt-3 flex gap-2 items-end">
                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => {
                        setInput(e.target.value);

                        // ✅ 자동 리사이즈
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = "auto"; // 높이 초기화 후 다시 계산
                        const maxHeight = 200; // 최대 높이 (px 단위)

                        // ✅ 최대 높이를 초과하면 스크롤 표시
                        if (target.scrollHeight > maxHeight) {
                            target.style.height = `${maxHeight}px`;
                            target.style.overflowY = "auto"; // 내부 스크롤 활성화
                        } else {
                            target.style.height = `${target.scrollHeight}px`;
                            target.style.overflowY = "hidden"; // 불필요한 스크롤 제거
                        }
                    }}
                    placeholder="예: 65세 이상 여성 환자 보여줘 (Enter=전송, Shift+Enter=줄바꿈)"
                    className="flex-1 p-2 border rounded resize-none leading-relaxed"
                    rows={1}
                    style={{
                        minHeight: "40px",   // 최소 높이
                        maxHeight: "200px",  // 최대 높이 설정
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();   // 기본 줄바꿈 방지
                            handleSubmit(e);      // 전송 실행
                        }
                        // Shift+Enter는 줄바꿈 허용
                    }}
                />
                <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded h-fit"
                >
                    전송
                </button>
            </form>



            {/* 대화 초기화 버튼 */}
            <div className="mt-2 flex justify-end">
                <button
                    onClick={() => {
                        setChatHistory([]);
                        sessionStorage.removeItem("chat_history");
                    }}
                    className="text-sm text-red-600 hover:underline"
                >
                    💥 대화 초기화
                </button>
            </div>
        </div>
    );
}

/* ============== helpers: SQL 추출 (간단/안전) ============== */
// ```sql ... ``` 코드블록 안의 SQL 우선 추출
function extractFromCodeBlock(text: string): string | null {
    const m = text.match(/```(?:sql)?\s*([\s\S]*?)```/i);
    return m?.[1]?.trim() || null;
}

// 일반 텍스트에서 SELECT로 시작하는 한 문단만 추출
function extractFromSelect(text: string): string | null {
    const m = text.match(/\bselect\b[\s\S]+/i);
    if (!m) return null;
    return m[0].split(/\n\n|;|\n📊|\n🧬/)[0].trim();
}

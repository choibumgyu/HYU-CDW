"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatSqlForDisplay } from "@/utils/formatSql";

interface ChatMessage {
  role: "user" | "bot";
  message: string;        // 화면 표시용 (SQL 포맷 결과 or 오류 메시지)
  rawSql?: string | null; // 실행/이동용 원본 SQL (오류면 null)
}

export default function AiChatPage() {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
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

    // 사용자 메시지 추가
    const userMessage: ChatMessage = { role: "user", message: input };
    const baseHistory = [...chatHistory, userMessage];

    // API 호출
    const token = sessionStorage.getItem("token");
    const response = await fetch("/api/ask-ai/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({ question: input }),
    });

    const data = await response.json();
    const answer: string = data?.answer ?? "❌ SQL이 생성되지 않았습니다.";

    // SQL 추출 (코드블록 우선 → SELECT 블록)
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
          // ✅ 메시지 아이템: user는 오른쪽, bot은 왼쪽에 "블록 전체"가 붙음
          <div
            key={idx}
            className={`mb-3 flex ${chat.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {/* 블록 전체(라벨 + 말풍선 + 버튼)를 한 컬럼으로 묶기 */}
            <div className="flex flex-col max-w-[85%]">
              {/* 라벨: user는 오른쪽 정렬, bot은 왼쪽 정렬 */}
              <div className={`text-sm font-semibold mb-1 ${chat.role === "user" ? "text-right" : "text-left"}`}>
                {chat.role === "user" ? "👤 나" : "🤖 GPT"}
              </div>

              {/* 말풍선: 유동 폭 + 내부 텍스트 왼쪽 정렬 */}
              <div
                className={`px-4 py-3 rounded-lg border leading-relaxed inline-block ${
                  chat.role === "user"
                    ? "bg-white text-left"
                    : "bg-blue-50 text-left border-blue-300"
                }`}
              >
                {/* SQL은 monospace로, 오류는 일반 텍스트 */}
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

              {/* 봇 답변에만 버튼 (블록 정렬을 따라 좌/우에 자연스럽게 붙음) */}
              {chat.role === "bot" && (
                <div className={`mt-3 flex gap-3 "justify-start"}`}>
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
      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="예: 65세 이상 여성 환자 보여줘"
          className="flex-1 p-2 border rounded"
        />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
          전송
        </button>
      </form>

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
  // 두 줄 공백/세미콜론/버튼 라벨에서 컷
  return m[0].split(/\n\n|;|\n📊|\n🧬/)[0].trim();
}

"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ChatMessage {
    role: "user" | "bot";
    message: string;
}

export default function AiChatPage() {
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const router = useRouter();

    useEffect(() => {
        const saved = sessionStorage.getItem("chat_history");
        setChatHistory(saved ? JSON.parse(saved) : []);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage: ChatMessage = { role: "user", message: input };
        const newHistory = [...chatHistory, userMessage];

        const response = await fetch("/api/ask-ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: input })
        });
        const data = await response.json();
        console.log("🔍 응답 데이터:", JSON.stringify(data.debug, null, 2));
        const botMessageText = data.answer || "❌ 답변을 받지 못했습니다.";

        const botMessage: ChatMessage = {
            role: "bot",
            message: botMessageText
        };

        const finalHistory = [...newHistory, botMessage];
        setChatHistory(finalHistory);
        sessionStorage.setItem("chat_history", JSON.stringify(finalHistory));

        setInput("");
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatHistory]);

    const handleRoute = (target: "analysis" | "cohort-result", sql: string) => {
        sessionStorage.setItem(
            target === "analysis" ? "custom_sql" : "cohort_sql",
            sql
        );
        router.push(`/${target}`);
    };

    return (
        <div className="w-full max-w-6xl mx-auto p-4 flex flex-col h-[calc(100vh-100px)]">
            <h1 className="text-2xl font-bold mb-4">💬 AI 챗봇 (SQL 도우미)</h1>
            <div className="bg-gray-100 rounded-md p-4 flex-1 min-h-[400px] max-h-[calc(100vh-260px)] overflow-y-auto border">
                {chatHistory.map((chat, idx) => (
                    <div
                        key={idx}
                        className={`mb-4 p-3 rounded-lg whitespace-pre-wrap ${
                            chat.role === "user"
                                ? "bg-white text-right border"
                                : "bg-blue-50 text-left border border-blue-300"
                        }`}
                    >
                        <strong>{chat.role === "user" ? "👤 나" : "🤖 GPT"}</strong>
                        <div className="mt-1">{chat.message}</div>
                        {chat.role === "bot" && (
                            <div className="mt-3 flex gap-3">
                                <button
                                    onClick={() => handleRoute("analysis", chat.message)}
                                    className="px-3 py-1 rounded bg-indigo-600 text-white text-sm"
                                >
                                    📊 시각화로 보기
                                </button>
                                <button
                                    onClick={() => handleRoute("cohort-result", chat.message)}
                                    className="px-3 py-1 rounded bg-green-600 text-white text-sm"
                                >
                                    🧬 코호트 결과 보기
                                </button>
                            </div>
                        )}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="예: 65세 이상 여성 환자 보여줘"
                    className="flex-1 p-2 border rounded"
                />
                <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded"
                >
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

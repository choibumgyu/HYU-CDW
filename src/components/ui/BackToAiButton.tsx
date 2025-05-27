"use client";
import { useRouter } from "next/navigation";

export default function BackToAiButton() {
    const router = useRouter();
    return (
        <div className="fixed top-[80px] left-0 -ml-12 z-30">
            <button
                onClick={() => router.push("/ai-chat")}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full shadow"
                title="AI 챗봇으로 돌아가기"
            >
                ← 챗봇
            </button>
        </div>
    );
}
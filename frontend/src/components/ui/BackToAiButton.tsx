"use client";
import { useRouter } from "next/navigation";

export default function BackToAiButton() {
    const router = useRouter();
    return (
        <div className="fixed top-[80px] left-6 lg:left-[270px] z-30">
            <button
                onClick={() => router.push("/ai-chat")}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-indigo-500 hover:bg-indigo-600 text-white rounded-full shadow"
                title="AI 챗봇으로 돌아가기"
            >
                ← 챗봇
            </button>
        </div>
    );
}
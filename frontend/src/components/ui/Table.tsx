"use client";

// components/layout/Sidebar.tsx
import { Home, BarChart, Settings, Users, Folder } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function Sidebar() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button
                className="absolute top-4 left-4 z-50 bg-gray-800 text-white p-2 rounded-md lg:hidden"
                onClick={() => setIsOpen(!isOpen)}
            >
                ☰
            </button>
            <div className={`responsive-sidebar ${isOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>
                <h2 className="text-xl font-bold mb-6 text-center lg:text-left">CDW Dashboard</h2>
                <ul className="space-y-4">
                    <li>
                        <Link href="/" className="flex items-center gap-2 p-2 hover:bg-gray-700 rounded">
                            <Home className="w-5 h-5" /> 홈
                        </Link>
                    </li>
                    <li>
                        <Link href="/analysis" className="flex items-center gap-2 p-2 hover:bg-gray-700 rounded">
                            <BarChart className="w-5 h-5" /> 데이터 분석
                        </Link>
                    </li>
                    <li>
                        <Link href="/patients/profile" className="flex items-center gap-2 p-2 hover:bg-gray-700 rounded">
                            <Users className="w-5 h-5" /> 프로필
                        </Link>
                    </li>
                    <li>
                        <Link href="/cohorts/definition" className="flex items-center gap-2 p-2 hover:bg-gray-700 rounded">
                            <Folder className="w-5 h-5" /> 코호트 정의
                        </Link>
                    </li>
                    <li>
                        <Link href="/incidence" className="flex items-center gap-2 p-2 hover:bg-gray-700 rounded">
                            <Folder className="w-5 h-5" /> 발생률
                        </Link>
                    </li>
                    <li>
                        <Link href="/settings" className="flex items-center gap-2 p-2 hover:bg-gray-700 rounded">
                            <Settings className="w-5 h-5" /> 설정
                        </Link>
                    </li>
                </ul>
            </div>
            {isOpen && <div className="fixed inset-0 bg-transparent transition-opacity lg:hidden" onClick={() => setIsOpen(false)}></div>}
        </>
    );
};

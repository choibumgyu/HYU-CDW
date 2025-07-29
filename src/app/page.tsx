"use client";

import Layout from "@/components/layout/Layout";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const router = useRouter();
    const endpoint = process.env.NEXT_PUBLIC_OPEN_API2;


    // 로그인 여부 확인
    useEffect(() => {
        const token = sessionStorage.getItem("token");
        setIsLoggedIn(!!token);
    }, []);

    const handleStartAnalysis = () => {
        if (isLoggedIn) {
            router.push("/analysis");
        } else {
            alert("로그인이 필요한 기능입니다. 로그인 페이지로 이동합니다.");
            router.push("/login");
        }
    };

    // 관리자 접근 핸들러
    const handleAdminAccess = async () => {
        if (!isLoggedIn) {
            alert("로그인이 필요한 기능입니다. 로그인 페이지로 이동합니다.");
            router.push("/login");
            return;
        }

        try {
            const token = sessionStorage.getItem("token");
            const res = await fetch(endpoint+"/api/auth/me", {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!res.ok) throw new Error("유저 정보 조회 실패");

            const user = await res.json();
            if (user.role === "admin") {
                router.push("/admin");
            } else {
                alert("관리자만 이용 가능한 기능입니다.");
            }
        } catch (err) {
            console.error(err);
            alert("사용자 인증에 실패했습니다. 다시 로그인해주세요.");
            router.push("/login");
        }
    };

    return (
        <Layout>
            <div className="flex flex-col items-center justify-start min-h-screen py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl w-full space-y-8 text-center">
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 mb-2">
                        <span className="inline-block">Clinical Datawarehouse에</span>{" "}
                        <span className="inline-block">오신 것을 환영합니다</span>
                    </h1>
                    <p className="mt-4 text-lg sm:text-xl text-gray-600 mb-8">
                        환자 데이터 분석 및 코호트 관리를 위한 통합 플랫폼입니다.
                    </p>

                    {/* 데이터 분석 시작하기 버튼 */}
                    <div className="mt-8 space-y-4">
                        <button
                            onClick={handleStartAnalysis}
                            className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                        >
                            데이터 분석 시작하기
                        </button>
                    </div>

                    {/* 관리자 페이지로 이동 버튼 */}
                    <div className="mt-4 space-y-4">
                        <button
                            onClick={handleAdminAccess}
                            className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                        >
                            관리자 페이지로 이동
                        </button>
                    </div>

                    {/* 주요 기능 섹션 */}
                    <div className="mt-12">
                        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-4">주요 기능</h2>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <div className="bg-white overflow-hidden shadow rounded-lg">
                                <div className="px-4 py-5 sm:p-6">
                                    <h3 className="text-lg font-medium text-gray-900">데이터 분석</h3>
                                    <p className="mt-1 text-sm text-gray-600">환자 데이터를 다양한 관점에서 분석합니다.</p>
                                </div>
                            </div>
                            <div className="bg-white overflow-hidden shadow rounded-lg">
                                <div className="px-4 py-5 sm:p-6">
                                    <h3 className="text-lg font-medium text-gray-900">코호트 관리</h3>
                                    <p className="mt-1 text-sm text-gray-600">환자 그룹을 효과적으로 관리합니다.</p>
                                </div>
                            </div>
                            <div className="bg-white overflow-hidden shadow rounded-lg">
                                <div className="px-4 py-5 sm:p-6">
                                    <h3 className="text-lg font-medium text-gray-900">리포트 생성</h3>
                                    <p className="mt-1 text-sm text-gray-600">분석 결과를 쉽게 리포트로 만듭니다.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
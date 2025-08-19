"use client";
import { useState } from "react";

export default function Page() {
    const [formData, setFormData] = useState({ email: "", password: "" });
    const [showPassword, setShowPassword] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const endpoint = process.env.NEXT_PUBLIC_OPEN_API2;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const response = await fetch(endpoint+"/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (response.ok) {
            // (로그인 성공 분기)
            /*
            sessionStorage.setItem(
                "flashToast",
                JSON.stringify({ level: "success", message: data.message || "로그인 성공" })
            );
            */
            sessionStorage.setItem("token", data.access_token);  //토큰 저장 추가.
            window.location.href = "/";
        } else {
            alert(data.detail);
        }
    };

    return (
        <div className="flex justify-center items-center min-h-screen bg-gray-50">
            <form onSubmit={handleSubmit} className="bg-white shadow-md rounded px-8 pt-6 pb-8 w-full max-w-md">
                <h2 className="text-2xl font-bold mb-6 text-center">로그인</h2>

                <label className="block text-gray-700 mb-2">이메일</label>
                <input type="text" name="email" value={formData.email} onChange={handleChange} className="mb-4 w-full px-3 py-2 border rounded" required />

                <label className="block text-gray-700 mb-2">비밀번호</label>
                <div className="relative mb-4">
                    <input type={showPassword ? "text" : "password"} name="password" value={formData.password} onChange={handleChange} className="w-full px-3 py-2 border rounded" required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600" tabIndex={-1}>
                        <img src={showPassword ? "/images/eye.png" : "/images/eye_password.png"} alt="비밀번호 보기" className="w-5 h-5" />
                    </button>
                </div>

                <button type="submit" className="w-full bg-black text-white py-2 rounded hover:bg-gray-800 transition">로그인</button>
            </form>
        </div>
    );
}
"use client";
import { useState } from "react";

export default function SignupPage() {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
        employeeNumber: ""
    });

    const [errors, setErrors] = useState<{ password?: string }>({});
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;
    const endpoint = process.env.NEXT_PUBLIC_OPEN_API2;


    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));

        if (name === "password") {
            if (!passwordRegex.test(value)) {
                setErrors((prev) => ({
                    ...prev,
                    password: "비밀번호: 8~16자의 영문 대/소문자, 숫자, 특수문자를 사용해 주세요.",
                }));
            } else {
                setErrors((prev) => ({ ...prev, password: "" }));
            }
        }
    };

    const handleSignup = async () => {
        const response = await fetch(endpoint+"/api/auth/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: formData.name,
                email: formData.email,
                password: formData.password,
                employeeNumber: formData.employeeNumber
            }),
        });

        const data = await response.json();

        if (response.status === 409) {
            alert("이미 존재하는 계정의 메일입니다.");
            return;
        }

        if (!response.ok) {
            alert("회원가입 중 오류가 발생했습니다.");
            return;
        }

        alert(data.message);
    };
    return (
        <div style={{
            minHeight: "100vh",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "#f5f5f5"
        }}>
            <div style={{
                backgroundColor: "white",
                padding: "40px",
                borderRadius: "12px",
                boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
                width: "420px",
                textAlign: "center"
            }}>
                <h2 style={{ marginBottom: "16px", fontSize: "24px", color: "#333" }}>회원가입</h2>

                <input name="name" placeholder="이름" value={formData.name} onChange={handleChange} style={inputStyle} />
                <input name="email" placeholder="이메일" value={formData.email} onChange={handleChange} style={inputStyle} />
                <input name="employeeNumber" placeholder="병원 사번" value={formData.employeeNumber} onChange={handleChange} style={inputStyle} />
                <input name="password" type="password" placeholder="비밀번호" value={formData.password} onChange={handleChange} style={inputStyle} />
                {errors.password && <p className="text-sm text-red-500 mb-2">{errors.password}</p>}
                <input name="confirmPassword" type="password" placeholder="비밀번호 확인" value={formData.confirmPassword} onChange={handleChange} style={inputStyle} />
                {formData.confirmPassword && (
                    <p className={`text-sm ${formData.password === formData.confirmPassword ? "text-green-600" : "text-red-600"}`}>
                        {formData.password === formData.confirmPassword ? "비밀번호가 일치합니다" : "비밀번호가 일치하지 않습니다"}
                    </p>
                )}
                <button onClick={handleSignup} style={buttonStyle}>회원가입</button>
            </div>
        </div>
    );
}

const inputStyle = {
    width: "100%",
    padding: "12px 16px",
    marginBottom: "16px",
    border: "1px solid #ccc",
    borderRadius: "8px",
    fontSize: "16px"
};

const buttonStyle = {
    width: "100%",
    padding: "12px 16px",
    backgroundColor: "#4CAF50",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "16px",
    cursor: "pointer",
    marginTop: "8px"
};
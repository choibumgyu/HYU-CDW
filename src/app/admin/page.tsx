"use client";
import { useEffect, useState } from "react";

interface User {
    id: number;
    name: string;
    email: string;
    employee_number: string;
    account_locked?: boolean;
}

export default function AdminPage() {
    const [view, setView] = useState<"pending" | "management" | "blocked">("pending");
    const [pendingUsers, setPendingUsers] = useState<User[]>([]);
    const [searchName, setSearchName] = useState("");
    const [searchResult, setSearchResult] = useState<User | null>(null);
    const [blockedUsers, setBlockedUsers] = useState<User[]>([]);

    const token = sessionStorage.getItem("token");

    const endpoint = process.env.NEXT_PUBLIC_OPEN_API;

    const fetchPendingUsers = async () => {
        const response = await fetch(endpoint+"/unapproved_user", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        const data = await response.json();
        setPendingUsers(data);
    };

    const fetchBlockedUsers = async () => {
        const response = await fetch(endpoint+"/blocked_users", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        const data = await response.json();
        setBlockedUsers(data);
    };

    const handleApprove = async (email: string) => {
        const response = await fetch(endpoint+"/approve", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ email }),
        });
        const data = await response.json();
        alert(data.text);
        fetchPendingUsers();
    };

    const handleReject = async (email: string) => {
        const response = await fetch(endpoint+"/reject", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ email }),
        });
        const data = await response.json();
        alert(data.text);
        fetchPendingUsers();
    };

    const handleUnblock = async (email: string) => {
        const response = await fetch(endpoint+"/unblock", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ email }),
        });
        const data = await response.json();
        alert(data.text);
        fetchBlockedUsers();
    };

    const handleSearch = async () => {
       const response = await fetch(`${endpoint}/search?name=${searchName}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        const data = await response.json();
        setSearchResult(data);
    };

    useEffect(() => {
        if (view === "pending") {
            fetchPendingUsers();
        } else if (view === "blocked") {
            fetchBlockedUsers();
        }
    }, [view]);

    return (
        <div style={{ padding: "40px" }}>
            <div style={{ marginBottom: "24px", display: "flex", gap: "12px" }}>
                <button
                    onClick={() => setView("pending")}
                    style={{
                        padding: "8px 16px",
                        backgroundColor: view === "pending" ? "#007bff" : "#f0f0f0",
                        color: view === "pending" ? "white" : "black",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontWeight: view === "pending" ? "bold" : "normal",
                    }}
                >
                    승인 요청 목록
                </button>

                <button
                    onClick={() => setView("management")}
                    style={{
                        padding: "8px 16px",
                        backgroundColor: view === "management" ? "#007bff" : "#f0f0f0",
                        color: view === "management" ? "white" : "black",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontWeight: view === "management" ? "bold" : "normal",
                    }}
                >
                    회원 관리
                </button>

                <button
                    onClick={() => setView("blocked")}
                    style={{
                        padding: "8px 16px",
                        backgroundColor: view === "blocked" ? "#007bff" : "#f0f0f0",
                        color: view === "blocked" ? "white" : "black",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontWeight: view === "blocked" ? "bold" : "normal",
                    }}
                >
                    차단 회원 목록
                </button>
            </div>


            {view === "pending" ? (
                <div>
                    <h2>승인 대기중인 사용자</h2>
                    {pendingUsers.length === 0 ? (
                        <p>대기중인 사용자가 없습니다.</p>
                    ) : (
                        <ul style={{ listStyle: "none", padding: 0 }}>
                            {pendingUsers.map((user) => (
                                <li key={user.id} style={{ padding: "16px", marginBottom: "16px", backgroundColor: "#f0f0f0", borderRadius: "8px" }}>
                                    <div><strong>이름:</strong> {user.name}</div>
                                    <div><strong>이메일:</strong> {user.email}</div>
                                    <div><strong>사번:</strong> {user.employee_number}</div>
                                    <button onClick={() => handleApprove(user.email)} style={{ marginTop: "8px", padding: "8px 16px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", marginRight: "8px" }}>승인하기</button>
                                    <button onClick={() => handleReject(user.email)} style={{ marginTop: "8px", padding: "8px 16px", backgroundColor: "#dc3545", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>거절하기</button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            ) : view === "management" ? (
                <div>
                    <h2>회원 검색</h2>
                    <input type="text" placeholder="이름으로 검색" value={searchName} onChange={(e) => setSearchName(e.target.value)} style={{ padding: "8px", width: "300px", marginRight: "8px" }} />
                    <button onClick={handleSearch} style={{ padding: "8px 16px" }}>검색</button>
                    {searchResult && (
                        <div style={{ marginTop: "24px" }}>
                            <h3>검색 결과</h3>
                            <div><strong>이름:</strong> {searchResult.name}</div>
                            <div><strong>이메일:</strong> {searchResult.email}</div>
                            <div><strong>사번:</strong> {searchResult.employee_number}</div>
                        </div>
                    )}
                </div>
            ) : (
                <div>
                    <h2>차단된 회원 목록</h2>
                    {blockedUsers.length === 0 ? (
                        <p>차단된 회원이 없습니다.</p>
                    ) : (
                        <ul style={{ listStyle: "none", padding: 0 }}>
                            {blockedUsers.map((user) => (
                                <li key={user.id} style={{ padding: "16px", marginBottom: "16px", backgroundColor: "#f8d7da", borderRadius: "8px" }}>
                                    <div><strong>이름:</strong> {user.name}</div>
                                    <div><strong>이메일:</strong> {user.email}</div>
                                    <div><strong>사번:</strong> {user.employee_number}</div>
                                    <button onClick={() => handleUnblock(user.email)} style={{ marginTop: "8px", padding: "8px 16px", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>차단 해제</button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
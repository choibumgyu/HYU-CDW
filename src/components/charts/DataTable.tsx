import React from "react";
import { translateColumn } from "@/utils/translate"; // 경로 확인 필요

interface ChartRow {
    [key: string]: string | number | null;
}

export default function DataTable({
                                      data,
                                      columns,
                                  }: {
    data: ChartRow[];
    columns: string[];
}) {
    return (
        <div
            className="w-full max-w-6xl mx-auto relative"
            style={{ overflowX: "auto" }}
        >
            <div
                style={{
                    overflowX: "auto",
                    overflowY: "hidden",
                    maxWidth: "100%",
                }}
            >
                <table className="table-auto border-collapse w-full text-sm">
                    <thead className="bg-gray-100">
                    <tr>
                        {columns.map((col) => (
                            <th
                                key={col}
                                className="px-4 py-2 border font-semibold text-left whitespace-nowrap"
                            >
                                {translateColumn(col)}
                            </th>
                        ))}
                    </tr>
                    </thead>
                    <tbody>
                    {data.map((row, i) => (
                        <tr
                            key={i}
                            className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
                        >
                            {columns.map((col) => (
                                <td
                                    key={col}
                                    className="px-4 py-1 border whitespace-nowrap"
                                >
                                    {row[col]}
                                </td>
                            ))}
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

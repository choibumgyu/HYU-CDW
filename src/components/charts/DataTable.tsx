import React from "react";

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
    console.log("📊 DataTable 렌더됨");
    console.log("👉 columns:", columns);
    console.log("👉 data:", data);

    return (
        <div className="w-full max-w-5xl mx-auto overflow-x-auto rounded-md shadow-sm border border-gray-200 p-2">
            <table className="table-auto border-collapse text-sm mx-auto">
                <thead>
                <tr className="bg-gray-100">
                    {columns.map((key) => (
                        <th
                            key={key}
                            className="px-4 py-2 border font-semibold text-left whitespace-nowrap"
                        >
                            {key}
                        </th>
                    ))}
                </tr>
                </thead>
                <tbody>
                {data.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        {columns.map((key) => (
                            <td
                                key={key}
                                className="px-4 py-1 border whitespace-nowrap"
                            >
                                {row[key]}
                            </td>
                        ))}
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
}

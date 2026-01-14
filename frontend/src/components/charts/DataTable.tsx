// components/charts/DataTable.tsx
import { translateColumn } from "@/utils/translate";

interface DataTableProps {
    data: Record<string, any>[];
    columns: string[];
}

export default function DataTable({ data, columns }: DataTableProps) {
    return (
        <div className="overflow-x-auto max-h-[400px] border rounded-lg shadow-sm">
            <table className="min-w-full border-separate border-spacing-0 border border-gray-300">
                <thead className="sticky top-0 bg-white z-10">
                    <tr>
                        {columns.map((col, index) => (
                            <th
                                key={index}
                                className="px-4 py-2 text-left text-sm font-medium border-b border-r border-gray-300 bg-white"
                            >
                                {translateColumn(col)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, rowIndex) => (
                        <tr key={rowIndex} className="hover:bg-gray-50">
                            {columns.map((col, colIndex) => (
                                <td
                                    key={colIndex}
                                    className="px-4 py-2 text-sm border-b border-r border-gray-300"
                                >
                                    {row[col]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// src/utils/getColumnMeta.ts
import columnMeta from "../../lib/columnMeta.json";

export interface ColumnMeta {
    table_name: string;
    column_name: string;
}

export function getColumnMeta(): ColumnMeta[] {
    return columnMeta as ColumnMeta[];
}

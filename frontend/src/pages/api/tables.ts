import type { NextApiRequest, NextApiResponse } from 'next'
import pool from '../../../lib/db'

interface TableRow {
  table_name: string;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try {
        const client = await pool.connect();
        const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'cdmdatabaseschema' 
      AND table_type = 'BASE TABLE'
    `);
        client.release();
        res.status(200).json(result.rows.map((row: TableRow) => row.table_name));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
}
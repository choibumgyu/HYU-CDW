import type { NextApiRequest, NextApiResponse } from 'next'
import pool from '../../../lib/db'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const { table } = req.query;

    if (!table || typeof table !== 'string') {
        return res.status(400).json({ error: 'Table name is required' });
    }

    try {
        const client = await pool.connect();
        const result = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'cdmdatabaseschema' 
            AND table_name = $1
        `, [table]);
        client.release();

        res.status(200).json(result.rows.map(row => row.column_name));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
}
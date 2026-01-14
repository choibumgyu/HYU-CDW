import type { NextApiRequest, NextApiResponse } from 'next';
import pool from 'lib/db';

type Data =
    | { data: any[] }
    | { error: string };

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<Data>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { sql } = req.body;

  if (!sql || typeof sql !== "string") {
    return res.status(400).json({ error: "SQL 쿼리를 문자열로 전달해주세요." });
  }

  try {
    const client = await pool.connect();
    const result = await client.query(sql);
    client.release();
    return res.status(200).json({ data: result.rows });  // ✅ 바로 rows만 넘김
  } catch (err: any) {
    console.error("쿼리 실행 중 오류:", err);
    return res.status(500).json({ error: err.message || "쿼리 실행 실패" });
  }
}


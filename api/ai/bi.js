import { answerBiQuestion } from '../lib/ai/bi.js';

// POST /api/ai/bi
// Body: { question: string }
// Returns: { answer: string, sql: string, data: object[], row_count: number }
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { question } = req.body || {};

  if (!question || typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({ error: 'question is required' });
  }

  try {
    const result = await answerBiQuestion(question.trim());
    return res.status(200).json(result);
  } catch (error) {
    console.error('BI error:', error);
    return res.status(500).json({
      error: 'שגיאה בעיבוד השאלה',
      details: String(error?.message || error),
    });
  }
}

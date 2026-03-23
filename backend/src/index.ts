import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { runFromText } from './pipeline/run.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

/**
 * POST /api/check-ingredient
 * Body: { text: string }
 *
 * One LLM call (NL parsing) then deterministic rule engine.
 * Returns: { query: IngredientQuery, verdict: Verdict }
 */
app.post('/api/check-ingredient', async (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== 'string' || text.trim() === '') {
    return res.status(400).json({ error: '"text" field is required' });
  }

  try {
    const { query, verdict } = await runFromText(text.trim());
    console.log(`\n[nl] "${text}" → ${query.name} → ${verdict.status} (${verdict.confidence})\n`);
    return res.json({ query, verdict });
  } catch (error) {
    console.error('[nl] Error:', error);
    return res.status(500).json({
      error: 'Failed to process query',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.listen(PORT, () => {
  console.log(`\nEU Cosmetics Compliance Agent — http://localhost:${PORT}\n`);
});

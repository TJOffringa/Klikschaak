import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { pool, query } from '../config/database.js';

const router = Router();

// GET /api/games - Get user's game history
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  if (!pool) {
    res.status(503).json({ error: 'Database not available' });
    return;
  }

  try {
    const userId = req.user!.userId;

    const { rows: games } = await query(
      `SELECT * FROM games
       WHERE (white_player = $1 OR black_player = $1) AND status = 'finished'
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId]
    );

    res.json({ games });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/games/:id - Get specific game details
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  if (!pool) {
    res.status(503).json({ error: 'Database not available' });
    return;
  }

  try {
    const { id } = req.params;

    const { rows } = await query('SELECT * FROM games WHERE id = $1', [id]);

    if (rows.length === 0) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    res.json({ game: rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

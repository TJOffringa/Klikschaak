import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { supabase } from '../config/database.js';

const router = Router();

// GET /api/games - Get user's game history
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  if (!supabase) {
    res.status(503).json({ error: 'Database not available' });
    return;
  }

  try {
    const userId = req.user!.userId;

    const { data: games, error } = await supabase
      .from('games')
      .select('*')
      .or(`white_player.eq.${userId},black_player.eq.${userId}`)
      .eq('status', 'finished')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      res.status(500).json({ error: 'Failed to fetch games' });
      return;
    }

    res.json({ games });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/games/:id - Get specific game details
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  if (!supabase) {
    res.status(503).json({ error: 'Database not available' });
    return;
  }

  try {
    const { id } = req.params;

    const { data: game, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    res.json({ game });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

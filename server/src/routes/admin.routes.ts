import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { pool, query } from '../config/database.js';

const router = Router();

// Middleware to check if user is admin
async function adminMiddleware(req: Request, res: Response, next: Function): Promise<void> {
  if (!pool) {
    res.status(503).json({ error: 'Database not available' });
    return;
  }

  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const { rows } = await query('SELECT is_admin FROM users WHERE id = $1', [userId]);

  if (rows.length === 0 || !rows[0].is_admin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  next();
}

// GET /api/admin/users - Get all users
router.get('/users', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  if (!pool) {
    res.status(503).json({ error: 'Database not available' });
    return;
  }

  try {
    const { rows: users } = await query(
      'SELECT id, username, email, friend_code, created_at, stats, is_admin FROM users ORDER BY created_at DESC'
    );

    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/admin/users/:id - Delete a user
router.delete('/users/:id', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  if (!pool) {
    res.status(503).json({ error: 'Database not available' });
    return;
  }

  const { id } = req.params;
  const adminId = req.user?.userId;

  // Prevent self-deletion
  if (id === adminId) {
    res.status(400).json({ error: 'Cannot delete yourself' });
    return;
  }

  try {
    await query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/users/:id/toggle-admin - Toggle admin status
router.post('/users/:id/toggle-admin', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  if (!pool) {
    res.status(503).json({ error: 'Database not available' });
    return;
  }

  const { id } = req.params;
  const adminId = req.user?.userId;

  // Prevent self-demotion
  if (id === adminId) {
    res.status(400).json({ error: 'Cannot change your own admin status' });
    return;
  }

  try {
    // Get current status
    const { rows } = await query('SELECT is_admin FROM users WHERE id = $1', [id]);

    if (rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const newStatus = !rows[0].is_admin;

    // Toggle status
    await query('UPDATE users SET is_admin = $1 WHERE id = $2', [newStatus, id]);

    res.json({ success: true, is_admin: newStatus });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

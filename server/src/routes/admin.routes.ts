import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { supabase } from '../config/database.js';

const router = Router();

// Middleware to check if user is admin
async function adminMiddleware(req: Request, res: Response, next: Function): Promise<void> {
  if (!supabase) {
    res.status(503).json({ error: 'Database not available' });
    return;
  }

  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', userId)
    .single();

  if (error || !user || !user.is_admin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  next();
}

// GET /api/admin/users - Get all users
router.get('/users', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  if (!supabase) {
    res.status(503).json({ error: 'Database not available' });
    return;
  }

  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, email, friend_code, created_at, stats, is_admin')
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: 'Failed to fetch users' });
      return;
    }

    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/admin/users/:id - Delete a user
router.delete('/users/:id', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  if (!supabase) {
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
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) {
      res.status(500).json({ error: 'Failed to delete user' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/users/:id/toggle-admin - Toggle admin status
router.post('/users/:id/toggle-admin', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  if (!supabase) {
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
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', id)
      .single();

    if (fetchError || !user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Toggle status
    const { error } = await supabase
      .from('users')
      .update({ is_admin: !user.is_admin })
      .eq('id', id);

    if (error) {
      res.status(500).json({ error: 'Failed to update user' });
      return;
    }

    res.json({ success: true, is_admin: !user.is_admin });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { registerUser, loginUser, getUserById } from '../services/auth.service.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  const result = await registerUser(username, email, password);

  if (result.success) {
    res.status(201).json({
      user: result.user,
      token: result.token,
    });
  } else {
    res.status(400).json({ error: result.error });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'Missing username or password' });
    return;
  }

  const result = await loginUser(username, password);

  if (result.success) {
    res.json({
      user: result.user,
      token: result.token,
    });
  } else {
    res.status(401).json({ error: result.error });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  const user = await getUserById(req.user!.userId);

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({
    id: user.id,
    username: user.username,
    friendCode: user.friend_code,
    stats: user.stats,
  });
});

export default router;

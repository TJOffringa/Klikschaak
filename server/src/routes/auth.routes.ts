import { Router, Request, Response } from 'express';
import {
  registerUser,
  loginUser,
  getUserById,
  googleLogin,
  verifyEmail,
  resendVerificationEmail,
  requestPasswordReset,
  resetPassword,
} from '../services/auth.service.js';
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

// POST /api/auth/google
router.post('/google', async (req: Request, res: Response) => {
  const { idToken } = req.body;

  if (!idToken) {
    res.status(400).json({ error: 'Missing idToken' });
    return;
  }

  const result = await googleLogin(idToken);

  if (result.success) {
    res.json({
      user: result.user,
      token: result.token,
    });
  } else {
    res.status(401).json({ error: result.error });
  }
});

// GET /api/auth/verify-email?token=xxx
router.get('/verify-email', async (req: Request, res: Response) => {
  const token = req.query.token as string;

  if (!token) {
    res.status(400).json({ error: 'Missing token' });
    return;
  }

  const result = await verifyEmail(token);

  if (result.success) {
    res.json({ success: true });
  } else {
    res.status(400).json({ error: result.error });
  }
});

// POST /api/auth/resend-verification
router.post('/resend-verification', authMiddleware, async (req: Request, res: Response) => {
  const result = await resendVerificationEmail(req.user!.userId);

  if (result.success) {
    res.json({ success: true });
  } else {
    res.status(400).json({ error: result.error });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ error: 'Missing email' });
    return;
  }

  await requestPasswordReset(email);
  res.json({ success: true }); // Always success to prevent email enumeration
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  const { token, password } = req.body;

  if (!token || !password) {
    res.status(400).json({ error: 'Missing token or password' });
    return;
  }

  const result = await resetPassword(token, password);

  if (result.success) {
    res.json({ success: true });
  } else {
    res.status(400).json({ error: result.error });
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
    emailVerified: user.email_verified,
    stats: user.stats,
    isAdmin: user.is_admin || false,
  });
});

export default router;

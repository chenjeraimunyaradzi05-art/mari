import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { calculateTrustScore } from '../services/trust.service';

const router = Router();

// ===========================================
// GET TRUST SCORE
// ===========================================
router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await calculateTrustScore(req.user!.id);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

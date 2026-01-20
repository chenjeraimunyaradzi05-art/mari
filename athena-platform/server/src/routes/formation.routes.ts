import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth'; // Assuming this exists
import * as FormationService from '../services/formation.service';
import { BusinessType } from '@prisma/client';

const router = Router();

// Protect all routes
router.use(authenticate);

// Get all registrations
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const registrations = await FormationService.getUserRegistrations(req.user!.id);
    res.json(registrations);
  } catch (error) {
    next(error);
  }
});

// Create registration
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { type, businessName } = req.body;
    
    if (!Object.values(BusinessType).includes(type)) {
      res.status(400).json({ error: 'Invalid business type' });
      return;
    }

    const registration = await FormationService.createRegistration(
      req.user!.id,
      type,
      businessName
    );
    res.status(201).json(registration);
  } catch (error) {
    next(error);
  }
});

// Get single registration
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const registration = await FormationService.getRegistration(
      req.user!.id,
      req.params.id
    );
    res.json(registration);
  } catch (error) {
    next(error);
  }
});

// Update registration data
router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const registration = await FormationService.updateRegistration(
      req.user!.id,
      req.params.id,
      req.body
    );
    res.json(registration);
  } catch (error) {
    next(error);
  }
});

// Submit registration
router.post('/:id/submit', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const registration = await FormationService.submitRegistration(
      req.user!.id,
      req.params.id
    );
    res.json(registration);
  } catch (error) {
    next(error);
  }
});

export default router;

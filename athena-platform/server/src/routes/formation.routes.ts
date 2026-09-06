import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth'; // Assuming this exists
import * as FormationService from '../services/formation.service';
import * as Abr from '../services/abr.service';
import { BusinessType } from '@prisma/client';

const router = Router();

// Protect all routes
router.use(authenticate);

// The Australian Business Register, live when ABR_GUID is set; the ASIC register by link.
router.get('/lookup/abn/:abn', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const abn = Abr.digitsOnly(req.params.abn);
    const valid = Abr.isValidAbn(abn);
    const entity = valid && Abr.isConfigured() ? await Abr.lookupAbn(abn) : null;
    res.json({ success: true, data: { abn, formatted: valid ? Abr.formatAbn(abn) : null, valid, configured: Abr.isConfigured(), entity, lookupUrl: Abr.ABR_LOOKUP_URL } });
  } catch (error) {
    next(error);
  }
});

router.get('/lookup/acn/:acn', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const acn = Abr.digitsOnly(req.params.acn);
    const valid = Abr.isValidAcn(acn);
    res.json({ success: true, data: { acn, formatted: valid ? Abr.formatAcn(acn) : null, valid, registerUrl: Abr.ASIC_CONNECT_SEARCH_URL } });
  } catch (error) {
    next(error);
  }
});

router.get('/lookup/name', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    if (!Abr.isConfigured()) {
      return res.json({ success: true, data: { configured: false, matches: [], lookupUrl: Abr.ABR_LOOKUP_URL } });
    }
    const matches = await Abr.searchNames(q);
    res.json({ success: true, data: { configured: true, matches, lookupUrl: Abr.ABR_LOOKUP_URL } });
  } catch (error) {
    next(error);
  }
});

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

// Fetch the payment details for a registration that is awaiting payment.
// Submitting already returns these, but an applicant who abandoned checkout
// needs a way back to the same intent without re-submitting.
router.post('/:id/payment-intent', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const payment = await FormationService.getFormationPayment(req.user!.id, req.params.id);
    res.json(payment);
  } catch (error) {
    next(error);
  }
});

// Confirm payment from the browser after Stripe checkout. The webhook is the
// authoritative path; this exists so the applicant is not left looking at a
// PAYMENT_PENDING screen while the webhook is in flight.
router.post('/:id/confirm-payment', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { paymentIntentId } = req.body;

    if (typeof paymentIntentId !== 'string' || paymentIntentId.trim().length === 0) {
      res.status(400).json({ error: 'paymentIntentId is required' });
      return;
    }

    const registration = await FormationService.confirmFormationPayment(
      req.user!.id,
      req.params.id,
      paymentIntentId.trim()
    );
    res.json(registration);
  } catch (error) {
    next(error);
  }
});

export default router;

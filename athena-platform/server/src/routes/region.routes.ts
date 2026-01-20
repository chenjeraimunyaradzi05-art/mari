import { Router } from 'express';
import { REGION_CONFIG, SUPPORTED_CURRENCIES, SUPPORTED_LOCALES } from '../config/regions';

const router = Router();

// ===========================================
// GET REGION CONFIG (PUBLIC)
// ===========================================
router.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      regions: REGION_CONFIG,
      supportedCurrencies: SUPPORTED_CURRENCIES,
      supportedLocales: SUPPORTED_LOCALES,
    },
  });
});

export default router;

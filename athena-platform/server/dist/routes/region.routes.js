"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const regions_1 = require("../config/regions");
const router = (0, express_1.Router)();
// ===========================================
// GET REGION CONFIG (PUBLIC)
// ===========================================
router.get('/', (_req, res) => {
    res.json({
        success: true,
        data: {
            regions: regions_1.REGION_CONFIG,
            supportedCurrencies: regions_1.SUPPORTED_CURRENCIES,
            supportedLocales: regions_1.SUPPORTED_LOCALES,
        },
    });
});
exports.default = router;
//# sourceMappingURL=region.routes.js.map
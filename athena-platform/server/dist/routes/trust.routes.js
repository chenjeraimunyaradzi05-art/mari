"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const trust_service_1 = require("../services/trust.service");
const router = (0, express_1.Router)();
// ===========================================
// GET TRUST SCORE
// ===========================================
router.get('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const data = await (0, trust_service_1.calculateTrustScore)(req.user.id);
        res.json({
            success: true,
            data,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=trust.routes.js.map
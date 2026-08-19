"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth"); // Assuming this exists
const FormationService = __importStar(require("../services/formation.service"));
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
// Protect all routes
router.use(auth_1.authenticate);
// Get all registrations
router.get('/', async (req, res, next) => {
    try {
        const registrations = await FormationService.getUserRegistrations(req.user.id);
        res.json(registrations);
    }
    catch (error) {
        next(error);
    }
});
// Create registration
router.post('/', async (req, res, next) => {
    try {
        const { type, businessName } = req.body;
        if (!Object.values(client_1.BusinessType).includes(type)) {
            res.status(400).json({ error: 'Invalid business type' });
            return;
        }
        const registration = await FormationService.createRegistration(req.user.id, type, businessName);
        res.status(201).json(registration);
    }
    catch (error) {
        next(error);
    }
});
// Get single registration
router.get('/:id', async (req, res, next) => {
    try {
        const registration = await FormationService.getRegistration(req.user.id, req.params.id);
        res.json(registration);
    }
    catch (error) {
        next(error);
    }
});
// Update registration data
router.patch('/:id', async (req, res, next) => {
    try {
        const registration = await FormationService.updateRegistration(req.user.id, req.params.id, req.body);
        res.json(registration);
    }
    catch (error) {
        next(error);
    }
});
// Submit registration
router.post('/:id/submit', async (req, res, next) => {
    try {
        const registration = await FormationService.submitRegistration(req.user.id, req.params.id);
        res.json(registration);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=formation.routes.js.map
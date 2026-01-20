"use strict";
/**
 * Salary Equity Routes
 * Pay gap detection, salary benchmarking, negotiation coaching
 *
 * Matches the existing salary-equity.service.ts function signatures
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const salary_equity_service_1 = __importDefault(require("../services/salary-equity.service"));
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
/**
 * @route GET /api/salary/benchmark
 * @desc Get salary benchmark for a role
 * @access Private
 */
router.get('/benchmark', auth_1.authenticate, async (req, res) => {
    try {
        const { role, location, experience, industry } = req.query;
        if (!role || !location) {
            return res.status(400).json({ error: 'Role and location are required' });
        }
        // Call with correct signature: getSalaryBenchmark(role, location, filters?)
        const filters = {
            yearsExperience: experience ? parseInt(experience) : undefined,
            industry: industry,
        };
        const benchmark = await salary_equity_service_1.default.getSalaryBenchmark(role, location, filters);
        res.json(benchmark);
    }
    catch (error) {
        logger_1.logger.error('Failed to get salary benchmark', { error });
        res.status(500).json({ error: 'Failed to get benchmark' });
    }
});
/**
 * @route GET /api/salary/range
 * @desc Get salary range for a role (requires level)
 * @access Private
 */
router.get('/range', auth_1.authenticate, async (req, res) => {
    try {
        const { role, location, level } = req.query;
        if (!role || !location || !level) {
            return res.status(400).json({ error: 'Role, location, and level are required' });
        }
        // Call with correct signature: getSalaryRange(role, location, level)
        const range = salary_equity_service_1.default.getSalaryRange(role, location, level);
        if (!range) {
            return res.status(404).json({ error: 'No salary data found for criteria' });
        }
        res.json(range);
    }
    catch (error) {
        logger_1.logger.error('Failed to get salary range', { error });
        res.status(500).json({ error: 'Failed to get range' });
    }
});
/**
 * @route POST /api/salary/analyze-gap
 * @desc Analyze pay gap for current salary
 * @access Private
 */
router.post('/analyze-gap', auth_1.authenticate, async (req, res) => {
    try {
        const { currentSalary, role, location } = req.body;
        if (!role || !location) {
            return res.status(400).json({
                error: 'Role and location are required'
            });
        }
        // Call with correct signature: analyzePayGap(role, location, currentSalary?)
        const analysis = await salary_equity_service_1.default.analyzePayGap(role, location, currentSalary);
        res.json(analysis);
    }
    catch (error) {
        logger_1.logger.error('Failed to analyze pay gap', { error });
        res.status(500).json({ error: 'Failed to analyze pay gap' });
    }
});
/**
 * @route POST /api/salary/negotiation-script
 * @desc Generate personalized negotiation script
 * @access Private
 *
 * Scenario must be one of: 'new_job', 'raise', 'promotion', 'counter_offer'
 */
router.post('/negotiation-script', auth_1.authenticate, async (req, res) => {
    try {
        const { currentSalary, targetSalary, role, scenario, achievements, yearsAtCompany } = req.body;
        if (!targetSalary || !role || !scenario) {
            return res.status(400).json({
                error: 'Target salary, role, and scenario are required'
            });
        }
        // Validate scenario
        const validScenarios = ['new_job', 'raise', 'promotion', 'counter_offer'];
        if (!validScenarios.includes(scenario)) {
            return res.status(400).json({
                error: `Scenario must be one of: ${validScenarios.join(', ')}`
            });
        }
        // Call with correct signature: generateNegotiationScript(situation, context)
        const context = {
            currentSalary,
            targetSalary,
            role,
            achievements,
            yearsAtCompany,
        };
        const script = salary_equity_service_1.default.generateNegotiationScript(scenario, context);
        res.json(script);
    }
    catch (error) {
        logger_1.logger.error('Failed to generate negotiation script', { error });
        res.status(500).json({ error: 'Failed to generate script' });
    }
});
/**
 * @route POST /api/salary/submit
 * @desc Submit anonymous salary data
 * @access Private
 */
router.post('/submit', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { role, level, industry, location, yearsExperience, education, baseSalary, totalCompensation, gender, } = req.body;
        // Validate required fields per SalaryData interface
        if (!role || !level || !industry || !location || !baseSalary || !totalCompensation) {
            return res.status(400).json({
                error: 'Required: role, level, industry, location, baseSalary, totalCompensation'
            });
        }
        // Call with correct signature: submitSalaryData(userId, data: Omit<SalaryData, 'isVerified'>)
        const data = {
            role,
            level,
            industry,
            location,
            yearsExperience: yearsExperience || 0,
            education: education || 'Not specified',
            baseSalary,
            totalCompensation,
            gender: gender,
        };
        const success = await salary_equity_service_1.default.submitSalaryData(userId, data);
        if (success) {
            res.status(201).json({
                message: 'Salary data submitted successfully',
                submitted: true,
            });
        }
        else {
            res.status(500).json({ error: 'Failed to submit data' });
        }
    }
    catch (error) {
        logger_1.logger.error('Failed to submit salary data', { error });
        res.status(500).json({ error: 'Failed to submit data' });
    }
});
/**
 * @route GET /api/salary/company/:companyName/transparency
 * @desc Get company transparency score
 * @access Private
 */
router.get('/company/:companyName/transparency', auth_1.authenticate, async (req, res) => {
    try {
        const { companyName } = req.params;
        // Call with correct signature: getCompanyTransparencyScore(companyName)
        const score = salary_equity_service_1.default.getCompanyTransparencyScore(decodeURIComponent(companyName));
        res.json(score);
    }
    catch (error) {
        logger_1.logger.error('Failed to get company transparency score', { error });
        res.status(500).json({ error: 'Failed to get transparency score' });
    }
});
exports.default = router;
//# sourceMappingURL=salary.routes.js.map
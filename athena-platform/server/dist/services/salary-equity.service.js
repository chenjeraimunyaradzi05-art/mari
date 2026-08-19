"use strict";
/**
 * Salary Equity Service
 * Pay gap detection, salary benchmarking, and negotiation coaching
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSalaryBenchmark = getSalaryBenchmark;
exports.analyzePayGap = analyzePayGap;
exports.getSalaryRange = getSalaryRange;
exports.generateNegotiationScript = generateNegotiationScript;
exports.submitSalaryData = submitSalaryData;
exports.getCompanyTransparencyScore = getCompanyTransparencyScore;
const logger_1 = require("../utils/logger");
// Simulated salary database (would be real data in production)
const SALARY_DATABASE = [
    { role: 'Software Engineer', level: 'Junior', industry: 'Technology', location: 'Sydney', yearsExperience: 1, education: 'Bachelor', baseSalary: 75000, totalCompensation: 80000, gender: 'female', isVerified: true },
    { role: 'Software Engineer', level: 'Junior', industry: 'Technology', location: 'Sydney', yearsExperience: 1, education: 'Bachelor', baseSalary: 82000, totalCompensation: 88000, gender: 'male', isVerified: true },
    { role: 'Software Engineer', level: 'Mid', industry: 'Technology', location: 'Sydney', yearsExperience: 3, education: 'Bachelor', baseSalary: 110000, totalCompensation: 125000, gender: 'female', isVerified: true },
    { role: 'Software Engineer', level: 'Mid', industry: 'Technology', location: 'Sydney', yearsExperience: 3, education: 'Bachelor', baseSalary: 120000, totalCompensation: 138000, gender: 'male', isVerified: true },
    { role: 'Software Engineer', level: 'Senior', industry: 'Technology', location: 'Sydney', yearsExperience: 5, education: 'Bachelor', baseSalary: 150000, totalCompensation: 180000, gender: 'female', isVerified: true },
    { role: 'Software Engineer', level: 'Senior', industry: 'Technology', location: 'Sydney', yearsExperience: 5, education: 'Bachelor', baseSalary: 165000, totalCompensation: 200000, gender: 'male', isVerified: true },
    { role: 'Product Manager', level: 'Junior', industry: 'Technology', location: 'Sydney', yearsExperience: 2, education: 'Bachelor', baseSalary: 95000, totalCompensation: 105000, gender: 'female', isVerified: true },
    { role: 'Product Manager', level: 'Mid', industry: 'Technology', location: 'Sydney', yearsExperience: 4, education: 'Master', baseSalary: 140000, totalCompensation: 160000, gender: 'female', isVerified: true },
    { role: 'Product Manager', level: 'Senior', industry: 'Technology', location: 'Sydney', yearsExperience: 7, education: 'Master', baseSalary: 180000, totalCompensation: 220000, gender: 'male', isVerified: true },
    { role: 'Data Scientist', level: 'Mid', industry: 'Technology', location: 'Sydney', yearsExperience: 3, education: 'Master', baseSalary: 130000, totalCompensation: 150000, gender: 'female', isVerified: true },
    { role: 'Data Scientist', level: 'Senior', industry: 'Technology', location: 'Sydney', yearsExperience: 6, education: 'PhD', baseSalary: 175000, totalCompensation: 210000, gender: 'male', isVerified: true },
    { role: 'Marketing Manager', level: 'Mid', industry: 'Marketing', location: 'Melbourne', yearsExperience: 4, education: 'Bachelor', baseSalary: 95000, totalCompensation: 105000, gender: 'female', isVerified: true },
    { role: 'Marketing Manager', level: 'Senior', industry: 'Marketing', location: 'Melbourne', yearsExperience: 7, education: 'Master', baseSalary: 130000, totalCompensation: 150000, gender: 'male', isVerified: true },
    { role: 'Financial Analyst', level: 'Junior', industry: 'Finance', location: 'Sydney', yearsExperience: 1, education: 'Bachelor', baseSalary: 70000, totalCompensation: 75000, gender: 'female', isVerified: true },
    { role: 'Financial Analyst', level: 'Senior', industry: 'Finance', location: 'Sydney', yearsExperience: 5, education: 'Master', baseSalary: 140000, totalCompensation: 180000, gender: 'male', isVerified: true },
];
// Benchmark cache
const benchmarkCache = new Map();
/**
 * Get salary benchmark for a role and location
 */
async function getSalaryBenchmark(role, location, filters) {
    const cacheKey = `${role}-${location}-${JSON.stringify(filters || {})}`;
    if (benchmarkCache.has(cacheKey)) {
        return benchmarkCache.get(cacheKey);
    }
    // Filter salary data
    let data = SALARY_DATABASE.filter(s => s.role.toLowerCase().includes(role.toLowerCase()) &&
        s.location.toLowerCase().includes(location.toLowerCase()));
    if (filters?.industry) {
        data = data.filter(s => s.industry.toLowerCase() === filters.industry.toLowerCase());
    }
    if (filters?.level) {
        data = data.filter(s => s.level.toLowerCase() === filters.level.toLowerCase());
    }
    if (data.length < 3) {
        return null; // Not enough data for reliable benchmark
    }
    const salaries = data.map(s => s.totalCompensation).sort((a, b) => a - b);
    const benchmark = {
        role,
        location,
        percentile10: getPercentile(salaries, 10),
        percentile25: getPercentile(salaries, 25),
        percentile50: getPercentile(salaries, 50),
        percentile75: getPercentile(salaries, 75),
        percentile90: getPercentile(salaries, 90),
        sampleSize: data.length,
        lastUpdated: new Date(),
    };
    benchmarkCache.set(cacheKey, benchmark);
    return benchmark;
}
/**
 * Analyze pay gap for a specific role
 */
async function analyzePayGap(role, location, currentSalary) {
    // Get salary data by gender
    const roleData = SALARY_DATABASE.filter(s => s.role.toLowerCase().includes(role.toLowerCase()) &&
        s.location.toLowerCase().includes(location.toLowerCase()));
    const femaleSalaries = roleData
        .filter(s => s.gender === 'female')
        .map(s => s.totalCompensation);
    const maleSalaries = roleData
        .filter(s => s.gender === 'male')
        .map(s => s.totalCompensation);
    const femaleAvg = femaleSalaries.length > 0
        ? femaleSalaries.reduce((a, b) => a + b, 0) / femaleSalaries.length
        : 0;
    const maleAvg = maleSalaries.length > 0
        ? maleSalaries.reduce((a, b) => a + b, 0) / maleSalaries.length
        : 0;
    const genderGap = maleAvg > 0 ? ((maleAvg - femaleAvg) / maleAvg) * 100 : 0;
    // Calculate potential increase
    let potentialIncrease = 0;
    if (currentSalary && currentSalary < femaleAvg) {
        potentialIncrease = femaleAvg - currentSalary;
    }
    else if (currentSalary && genderGap > 0) {
        potentialIncrease = currentSalary * (genderGap / 100);
    }
    const recommendations = [];
    if (genderGap > 15) {
        recommendations.push(`The gender pay gap for ${role} in ${location} is significant at ${genderGap.toFixed(1)}%. You should negotiate for pay equity.`);
    }
    if (currentSalary && currentSalary < femaleAvg) {
        recommendations.push(`Your salary is below the average for women in this role. Consider requesting a raise of $${potentialIncrease.toLocaleString()}.`);
    }
    recommendations.push('Document your achievements and impact with specific metrics.');
    recommendations.push('Research competitor salaries and industry benchmarks.');
    recommendations.push('Practice negotiation with our AI Interview Coach.');
    return {
        role,
        location,
        genderGap: Math.round(genderGap * 10) / 10,
        industryGap: Math.round(genderGap * 0.8 * 10) / 10, // Simplified calculation
        experienceAdjustedGap: Math.round(genderGap * 0.7 * 10) / 10,
        recommendations,
        potentialIncrease: Math.round(potentialIncrease),
    };
}
/**
 * Get salary range for job posting transparency
 */
function getSalaryRange(role, location, level) {
    const data = SALARY_DATABASE.filter(s => s.role.toLowerCase().includes(role.toLowerCase()) &&
        s.location.toLowerCase().includes(location.toLowerCase()) &&
        s.level.toLowerCase() === level.toLowerCase());
    if (data.length === 0) {
        return null;
    }
    const salaries = data.map(s => s.baseSalary).sort((a, b) => a - b);
    return {
        min: salaries[0],
        max: salaries[salaries.length - 1],
        median: getPercentile(salaries, 50),
    };
}
/**
 * Generate negotiation script based on situation
 */
function generateNegotiationScript(situation, context) {
    const scripts = {
        new_job: {
            situation: 'New Job Offer Negotiation',
            openingStatement: `Thank you for the offer. I'm very excited about the opportunity to join as ${context.role}. I'd like to discuss the compensation package.`,
            keyPoints: [
                `Based on my research, the market rate for this role is $${context.targetSalary.toLocaleString()}.`,
                'I bring [X years] of experience and a track record of [specific achievements].',
                'I\'m confident I can deliver significant value in this role.',
            ],
            counterResponses: {
                'budget_constraints': 'I understand budget constraints. Could we discuss a signing bonus or earlier review date to bridge the gap?',
                'need_to_check': 'Of course, I\'ll give you time to review. When can I expect to hear back?',
                'final_offer': 'I appreciate that. Could we explore other benefits like additional PTO or professional development budget?',
            },
            closingStatement: 'I\'m committed to making this work. What flexibility do you have on the total compensation?',
            tips: [
                'Always negotiate - 70% of employers expect it.',
                'Focus on your value, not your needs.',
                'Get the offer in writing before accepting.',
                'Consider the full package: salary, bonus, equity, benefits.',
            ],
        },
        raise: {
            situation: 'Salary Raise Negotiation',
            openingStatement: `I'd like to discuss my compensation. Over the past ${context.yearsAtCompany || 'year'}, I've made significant contributions.`,
            keyPoints: [
                ...(context.achievements || ['Led key project', 'Exceeded targets']).map(a => `I ${a}`),
                `I'm requesting an adjustment to $${context.targetSalary.toLocaleString()} to align with my contributions and market rates.`,
            ],
            counterResponses: {
                'not_in_budget': 'I understand budget cycles. Can we schedule a review in 3 months with specific targets?',
                'need_approval': 'What information would help you make the case to leadership?',
                'partial_raise': 'Thank you. Can we also discuss a path to reaching my target salary?',
            },
            closingStatement: 'I\'m committed to continuing to deliver results. What can we agree on today?',
            tips: [
                'Time your ask after a major win or during review cycles.',
                'Know your worth - use market data.',
                'Quantify your achievements with specific numbers.',
                'Have a backup plan if the answer is no.',
            ],
        },
        promotion: {
            situation: 'Promotion Negotiation',
            openingStatement: `I'd like to discuss my career progression and the ${context.role} role.`,
            keyPoints: [
                'I\'ve consistently exceeded expectations in my current role.',
                'I\'ve already been taking on responsibilities at the next level.',
                `The market rate for ${context.role} is $${context.targetSalary.toLocaleString()}.`,
            ],
            counterResponses: {
                'not_ready': 'I\'d appreciate specific feedback on what I need to develop. Can we create a 90-day plan?',
                'no_openings': 'I understand. Can we discuss a title change and compensation adjustment to reflect my current contributions?',
                'prove_yourself': 'I\'m happy to take on a stretch assignment. Can we agree on criteria for success and a timeline?',
            },
            closingStatement: 'I\'m ready for this challenge. What are the next steps to formalize this?',
            tips: [
                'Document your achievements throughout the year.',
                'Build relationships with decision-makers.',
                'Volunteer for visible projects.',
                'Ask for feedback regularly.',
            ],
        },
        counter_offer: {
            situation: 'Counter Offer Negotiation',
            openingStatement: `I've received an offer from another company, and I wanted to discuss this with you before making a decision.`,
            keyPoints: [
                `The offer is for $${context.targetSalary.toLocaleString()}, which is ${Math.round(((context.targetSalary - (context.currentSalary || 0)) / (context.currentSalary || 1)) * 100)}% above my current salary.`,
                'I value my work here and would prefer to stay.',
                'I\'m looking for a competitive counter offer.',
            ],
            counterResponses: {
                'let_you_go': 'I appreciate our time together. I\'ll work to ensure a smooth transition.',
                'match_offer': 'Thank you. Can we also discuss my growth path here?',
                'partial_match': 'I appreciate the effort. Can we bridge the gap with a retention bonus or accelerated review?',
            },
            closingStatement: 'I need to give them an answer by [date]. What can you offer?',
            tips: [
                'Only use this if you\'re willing to leave.',
                'Don\'t bluff - it can backfire.',
                'Consider why you wanted to leave in the first place.',
                'Get any counter offer in writing.',
            ],
        },
    };
    return scripts[situation] || scripts.new_job;
}
/**
 * Submit anonymous salary data
 */
async function submitSalaryData(userId, data) {
    try {
        // In production, store in database with encryption for sensitive fields
        const salaryEntry = {
            ...data,
            isVerified: false,
            submittedAt: new Date(),
            submittedBy: userId, // Anonymized in reporting
        };
        // Add to in-memory database for now
        SALARY_DATABASE.push({ ...salaryEntry, isVerified: false });
        logger_1.logger.info('Salary data submitted', { role: data.role, location: data.location });
        return true;
    }
    catch (error) {
        logger_1.logger.error('Failed to submit salary data', { error });
        return false;
    }
}
/**
 * Get salary transparency score for a company
 */
function getCompanyTransparencyScore(companyName) {
    // Simulated scoring (would use real data in production)
    const factors = [
        { name: 'Salary ranges in job postings', score: 80, weight: 0.3 },
        { name: 'Equal pay certification', score: 60, weight: 0.25 },
        { name: 'Gender pay gap reporting', score: 70, weight: 0.25 },
        { name: 'Employee salary satisfaction', score: 75, weight: 0.2 },
    ];
    const score = factors.reduce((acc, f) => acc + f.score * f.weight, 0);
    const recommendations = [];
    if (factors[0].score < 70) {
        recommendations.push('Ask about salary range before applying.');
    }
    if (factors[1].score < 70) {
        recommendations.push('Research industry salary benchmarks.');
    }
    return {
        score: Math.round(score),
        factors,
        recommendations,
    };
}
// Helper functions
function getPercentile(sortedArr, percentile) {
    const index = (percentile / 100) * (sortedArr.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) {
        return sortedArr[lower];
    }
    return sortedArr[lower] + (sortedArr[upper] - sortedArr[lower]) * (index - lower);
}
exports.default = {
    getSalaryBenchmark,
    analyzePayGap,
    getSalaryRange,
    generateNegotiationScript,
    submitSalaryData,
    getCompanyTransparencyScore,
};
//# sourceMappingURL=salary-equity.service.js.map
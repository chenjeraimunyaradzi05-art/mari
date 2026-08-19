/**
 * Salary Equity Service
 * Pay gap detection, salary benchmarking, and negotiation coaching
 */
export interface SalaryData {
    role: string;
    level: string;
    industry: string;
    location: string;
    yearsExperience: number;
    education: string;
    baseSalary: number;
    totalCompensation: number;
    gender?: 'female' | 'male' | 'other';
    isVerified: boolean;
}
export interface SalaryBenchmark {
    role: string;
    location: string;
    percentile10: number;
    percentile25: number;
    percentile50: number;
    percentile75: number;
    percentile90: number;
    sampleSize: number;
    lastUpdated: Date;
}
export interface PayGapAnalysis {
    role: string;
    location: string;
    genderGap: number;
    industryGap: number;
    experienceAdjustedGap: number;
    recommendations: string[];
    potentialIncrease: number;
}
export interface NegotiationScript {
    situation: string;
    openingStatement: string;
    keyPoints: string[];
    counterResponses: Record<string, string>;
    closingStatement: string;
    tips: string[];
}
/**
 * Get salary benchmark for a role and location
 */
export declare function getSalaryBenchmark(role: string, location: string, filters?: {
    industry?: string;
    level?: string;
    yearsExperience?: number;
}): Promise<SalaryBenchmark | null>;
/**
 * Analyze pay gap for a specific role
 */
export declare function analyzePayGap(role: string, location: string, currentSalary?: number): Promise<PayGapAnalysis>;
/**
 * Get salary range for job posting transparency
 */
export declare function getSalaryRange(role: string, location: string, level: string): {
    min: number;
    max: number;
    median: number;
} | null;
/**
 * Generate negotiation script based on situation
 */
export declare function generateNegotiationScript(situation: 'new_job' | 'raise' | 'promotion' | 'counter_offer', context: {
    currentSalary?: number;
    targetSalary: number;
    role: string;
    achievements?: string[];
    yearsAtCompany?: number;
}): NegotiationScript;
/**
 * Submit anonymous salary data
 */
export declare function submitSalaryData(userId: string, data: Omit<SalaryData, 'isVerified'>): Promise<boolean>;
/**
 * Get salary transparency score for a company
 */
export declare function getCompanyTransparencyScore(companyName: string): {
    score: number;
    factors: {
        name: string;
        score: number;
        weight: number;
    }[];
    recommendations: string[];
};
declare const _default: {
    getSalaryBenchmark: typeof getSalaryBenchmark;
    analyzePayGap: typeof analyzePayGap;
    getSalaryRange: typeof getSalaryRange;
    generateNegotiationScript: typeof generateNegotiationScript;
    submitSalaryData: typeof submitSalaryData;
    getCompanyTransparencyScore: typeof getCompanyTransparencyScore;
};
export default _default;
//# sourceMappingURL=salary-equity.service.d.ts.map
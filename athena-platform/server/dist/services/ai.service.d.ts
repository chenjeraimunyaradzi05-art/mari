declare class AiService {
    private openai;
    private isProduction;
    private allowSimulation;
    constructor();
    private shouldSimulate;
    private ensureOpenAI;
    optimizeResume(resumeText: string, jobDescription?: string): Promise<any>;
    generateCareerPath(profileData: any, goal?: string): Promise<any>;
    enrichSocialContent(content: string, mediaUrls?: string[]): Promise<any>;
    generateInterviewQuestions(jobDescription: string, type?: 'behavioral' | 'technical' | 'mixed'): Promise<any>;
    evaluateInterviewAnswer(params: {
        question: string;
        answer: string;
        jobRole?: string;
        interviewType?: string;
        difficulty?: string;
    }): Promise<{
        feedback: string;
        analysis: {
            rating: number;
            strengths: string[];
            improvements: string[];
        };
        nextQuestion: string;
    }>;
    generateContent(topic: string, contentType?: string, platform?: string): Promise<string>;
    validateBusinessIdea(idea: string, targetMarket?: string, problemSolved?: string): Promise<string>;
    chat(message: string, history?: any[]): Promise<string>;
    evaluateJobMatch(userProfile: string, jobDescription: string): Promise<any>;
    private getSimulatedResumeResponse;
    private getSimulatedCareerPathResponse;
}
export declare const aiService: AiService;
export {};
//# sourceMappingURL=ai.service.d.ts.map
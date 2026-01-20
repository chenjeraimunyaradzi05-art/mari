declare class AiService {
    private openai;
    constructor();
    optimizeResume(resumeText: string, jobDescription?: string): Promise<any>;
    generateCareerPath(profileData: any, goal?: string): Promise<any>;
    enrichSocialContent(content: string, mediaUrls?: string[]): Promise<any>;
    generateInterviewQuestions(jobDescription: string, type?: 'behavioral' | 'technical' | 'mixed'): Promise<any>;
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
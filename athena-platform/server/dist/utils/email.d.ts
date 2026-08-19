interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}
export declare function sendEmail(options: EmailOptions): Promise<boolean>;
export declare function sendVerificationEmail(email: string, firstName: string, token: string): Promise<boolean>;
export declare function sendPasswordResetEmail(email: string, firstName: string, token: string): Promise<boolean>;
export declare function sendWelcomeEmail(email: string, firstName: string): Promise<boolean>;
export {};
//# sourceMappingURL=email.d.ts.map
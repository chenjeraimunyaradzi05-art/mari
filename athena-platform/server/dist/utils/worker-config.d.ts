export interface WorkerStartupValidationResult {
    ok: boolean;
    errors: string[];
}
export interface WorkerStartupValidationOptions {
    forceEnabled?: boolean;
    requireEnableFlag?: boolean;
}
export declare function isProductionRuntime(): boolean;
export declare function isConfiguredEnv(name: string): boolean;
export declare function resolveWorkerRedisUrl(): string;
export declare function validateWorkerStartupConfiguration(options?: WorkerStartupValidationOptions): WorkerStartupValidationResult;
//# sourceMappingURL=worker-config.d.ts.map
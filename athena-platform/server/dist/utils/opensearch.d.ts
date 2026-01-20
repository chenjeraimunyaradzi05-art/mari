import { Client } from '@opensearch-project/opensearch';
export declare const initializeOpenSearch: () => Promise<void>;
export declare const getOpenSearchClient: () => Client | null;
export declare const IndexNames: {
    USERS: string;
    JOBS: string;
    POSTS: string;
    COURSES: string;
    VIDEOS: string;
    MENTORS: string;
};
export declare const indexDocument: (index: string, id: string, document: any) => Promise<void>;
export declare const deleteDocument: (index: string, id: string) => Promise<void>;
//# sourceMappingURL=opensearch.d.ts.map
import { Client } from '@opensearch-project/opensearch';
export declare const isOpenSearchEnabled: () => boolean;
export declare const initializeOpenSearch: () => Promise<boolean>;
export declare const getOpenSearchClient: () => Client | null;
export declare const isOpenSearchConnected: () => boolean;
export declare const IndexNames: {
    USERS: string;
    JOBS: string;
    POSTS: string;
    COURSES: string;
    VIDEOS: string;
    MENTORS: string;
};
export declare const indexDocument: (index: string, id: string, document: any) => Promise<boolean>;
export declare const deleteDocument: (index: string, id: string) => Promise<boolean>;
//# sourceMappingURL=opensearch.d.ts.map
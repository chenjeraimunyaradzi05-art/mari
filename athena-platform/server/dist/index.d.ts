import { Application } from 'express';
import { Server as SocketIOServer } from 'socket.io';
declare const app: Application;
declare const httpServer: import("http").Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse>;
declare const io: SocketIOServer<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
export { io };
export { app, httpServer };
/**
 * Main startup function — exported so start.ts (crash-safe wrapper) can call it.
 * Also called directly when this file is the entry point (require.main === module).
 */
export declare function startServer(): Promise<void>;
export default app;
//# sourceMappingURL=index.d.ts.map
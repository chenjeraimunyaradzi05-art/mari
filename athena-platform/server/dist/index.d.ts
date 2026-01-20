import { Application } from 'express';
import { Server as SocketIOServer } from 'socket.io';
declare const app: Application;
declare const httpServer: import("http").Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse>;
declare const io: SocketIOServer<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
export { io };
export { app, httpServer };
export default app;
//# sourceMappingURL=index.d.ts.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAudit = logAudit;
const prisma_1 = require("./prisma");
async function logAudit(params) {
    const { action, actorUserId = null, targetUserId = null, ipAddress = null, userAgent = null, metadata = null, } = params;
    const sanitizedMetadata = metadata
        ? JSON.parse(JSON.stringify(metadata))
        : null;
    await prisma_1.prisma.auditLog.create({
        data: {
            action,
            actorUserId,
            targetUserId,
            ipAddress,
            userAgent,
            metadata: sanitizedMetadata ?? undefined,
        },
    });
}
//# sourceMappingURL=audit.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashOpaqueToken = hashOpaqueToken;
const crypto_1 = require("crypto");
function hashOpaqueToken(token) {
    return (0, crypto_1.createHash)('sha256').update(token).digest('hex');
}
//# sourceMappingURL=opaqueToken.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTokenExpiresInSeconds = exports.decodeToken = exports.verifyToken = exports.generateRefreshToken = exports.generateAccessToken = void 0;
exports.getJwtSecretOrThrow = getJwtSecretOrThrow;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = require("crypto");
function getJwtSecretOrThrow() {
    const secret = process.env.JWT_SECRET;
    if (secret) {
        return secret;
    }
    if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET must be set in production');
    }
    return 'dev-only-secret-not-for-production';
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
const generateAccessToken = (payload) => {
    const options = {
        expiresIn: JWT_EXPIRES_IN,
        jwtid: (0, crypto_1.randomUUID)(),
    };
    return jsonwebtoken_1.default.sign(payload, getJwtSecretOrThrow(), options);
};
exports.generateAccessToken = generateAccessToken;
const generateRefreshToken = (payload) => {
    const options = {
        expiresIn: JWT_REFRESH_EXPIRES_IN,
        jwtid: (0, crypto_1.randomUUID)(),
    };
    return jsonwebtoken_1.default.sign(payload, getJwtSecretOrThrow(), options);
};
exports.generateRefreshToken = generateRefreshToken;
const verifyToken = (token) => {
    return jsonwebtoken_1.default.verify(token, getJwtSecretOrThrow());
};
exports.verifyToken = verifyToken;
const decodeToken = (token) => {
    try {
        return jsonwebtoken_1.default.decode(token);
    }
    catch {
        return null;
    }
};
exports.decodeToken = decodeToken;
const getTokenExpiresInSeconds = (token) => {
    const decoded = (0, exports.decodeToken)(token);
    if (!decoded?.exp) {
        return null;
    }
    return Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
};
exports.getTokenExpiresInSeconds = getTokenExpiresInSeconds;
//# sourceMappingURL=jwt.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DUMMY_PASSWORD_HASH = exports.generateRandomToken = exports.comparePassword = exports.hashPassword = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const node_crypto_1 = require("node:crypto");
const SALT_ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 12;
const hashPassword = async (password) => {
    return bcryptjs_1.default.hash(password, SALT_ROUNDS);
};
exports.hashPassword = hashPassword;
const comparePassword = async (password, hash) => {
    return bcryptjs_1.default.compare(password, hash);
};
exports.comparePassword = comparePassword;
const generateRandomToken = () => {
    return (0, node_crypto_1.randomBytes)(32).toString('hex');
};
exports.generateRandomToken = generateRandomToken;
/**
 * A valid bcrypt hash that no realistic password will ever match.
 * Used to keep login timings identical whether or not the email exists,
 * which neutralises bcrypt-timing email enumeration.
 *
 * The hash below is bcrypt-of a 32-byte random string generated once
 * at module load — fixed for the process lifetime so timings are stable.
 */
exports.DUMMY_PASSWORD_HASH = bcryptjs_1.default.hashSync((0, node_crypto_1.randomBytes)(32).toString('hex'), SALT_ROUNDS);
//# sourceMappingURL=password.js.map
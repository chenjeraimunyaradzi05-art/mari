"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';
// Pretty format for development
const devFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.colorize(), winston_1.default.format.printf(({ level, message, timestamp, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
        log += ` ${JSON.stringify(meta)}`;
    }
    return log;
}));
// Structured JSON format for production (machine-readable)
const prodFormat = winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json());
exports.logger = winston_1.default.createLogger({
    level: isProd ? 'info' : isTest ? 'error' : 'debug',
    format: isProd ? prodFormat : devFormat,
    transports: isTest
        ? [new winston_1.default.transports.Console({ silent: true })]
        : [
            new winston_1.default.transports.Console(),
            ...(isProd
                ? []
                : [
                    new winston_1.default.transports.File({ filename: 'logs/error.log', level: 'error' }),
                    new winston_1.default.transports.File({ filename: 'logs/combined.log' }),
                ]),
        ],
});
//# sourceMappingURL=logger.js.map
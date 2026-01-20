"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readSafetyStore = readSafetyStore;
exports.writeSafetyStore = writeSafetyStore;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const STORE_PATH = path_1.default.join(__dirname, '..', 'data', 'safety-store.json');
async function ensureStoreDir() {
    const dir = path_1.default.dirname(STORE_PATH);
    await promises_1.default.mkdir(dir, { recursive: true });
}
async function readSafetyStore() {
    try {
        const data = await promises_1.default.readFile(STORE_PATH, 'utf-8');
        return JSON.parse(data);
    }
    catch {
        await ensureStoreDir();
        const empty = { reports: [], blocks: [] };
        await promises_1.default.writeFile(STORE_PATH, JSON.stringify(empty, null, 2));
        return empty;
    }
}
async function writeSafetyStore(store) {
    await ensureStoreDir();
    await promises_1.default.writeFile(STORE_PATH, JSON.stringify(store, null, 2));
}
//# sourceMappingURL=safety-store.js.map
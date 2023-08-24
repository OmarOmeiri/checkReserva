"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const devlogger_1 = __importDefault(require("devlogger"));
exports.logger = new devlogger_1.default({
    levelStyles: {
        error: ['bgRed'],
        info: ['bgBlue', 'cyan'],
        warn: ['yellow', 'inverse']
    }
});

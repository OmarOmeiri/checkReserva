"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_util_1 = require("node:util");
const logger_1 = require("./logger");
const consts_1 = require("./consts");
const wait = (ms) => __awaiter(void 0, void 0, void 0, function* () {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
});
const checkArgs = (args) => {
    const sleep = Number(args.sleep);
    if (!sleep) {
        logger_1.logger.error('Sleep argument must be defined.');
        process.exit(1);
    }
    if (Number.isNaN(sleep)) {
        logger_1.logger.error('Sleep argument must be a number.');
        process.exit(1);
    }
    return {
        sleep: sleep * 60000,
    };
};
(() => __awaiter(void 0, void 0, void 0, function* () {
    const args = checkArgs((0, node_util_1.parseArgs)({
        options: {
            sleep: {
                type: "string",
                short: "s",
                default: '30',
            },
        },
    }).values);
    const { sleep } = args;
    while (true) {
        yield (0, consts_1.run)();
        logger_1.logger.info(`Will run again in ${sleep / 60000} minutes.`);
        yield wait(sleep);
    }
}))();

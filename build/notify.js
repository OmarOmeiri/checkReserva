"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notify = void 0;
const spawn = require("child_process").spawn;
const notify = (title, value) => {
    const pythonProcess = spawn('python3', [`${__dirname}/notify.py`, title, value]);
};
exports.notify = notify;

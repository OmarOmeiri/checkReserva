const spawn = require("child_process").spawn;

export const notify = (title: string, value: string) => {
  const pythonProcess = spawn('python', [`${__dirname}/notify.py`, title, value]);
}
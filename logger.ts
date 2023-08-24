
import DevLogger from 'devlogger'

export const logger = new DevLogger({
  levelStyles: {
    error:  ['bgRed'],
    info: ['bgBlue', 'cyan'],
    warn: ['yellow', 'inverse']
  }
})
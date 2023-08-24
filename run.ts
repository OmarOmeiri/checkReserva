import { parseArgs } from 'node:util';
import { logger } from './logger';
import { run } from './consts';

type Args = {
  sleep: string | undefined;
}

type ArgsP = {
  sleep: number,
}

type ArgsParsed = Omit<{
  [k in keyof Args]: Exclude<Args[k], undefined>
}, keyof ArgsP> & ArgsP



const wait  = async (ms: number) => new Promise<void>((resolve) => {
  setTimeout(() => {
    resolve()
  }, ms);
})

const checkArgs = (args: Args): ArgsParsed => {
  const sleep = Number(args.sleep);
  
  if (!sleep) {
    logger.error('Sleep argument must be defined.');
    process.exit(1);
  }
  
  if (Number.isNaN(sleep)) {
    logger.error('Sleep argument must be a number.');
    process.exit(1);
  }
  
  return {
    sleep: sleep * 60000,
  }
}


(async () => {
  const args = checkArgs(parseArgs({
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
    await run();
    logger.info(`Will run again in ${sleep / 60000} minutes.`)
    await wait(sleep);
  }
  
})()

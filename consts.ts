import dayjs from 'dayjs';
import weekYear from 'dayjs/plugin/weekOfYear'
import utc from 'dayjs/plugin/utc'
import axios from 'axios';
import { writeFile, readFile } from 'fs/promises'
import { IResources, ReservaParsed, ReservaRaw } from './types';
import { groupBy } from 'lodash';
import { notify } from './notify'
import { logger } from './logger';

type FreeResv = {
  [date: string]: number[]
}

dayjs.extend(weekYear);
dayjs.extend(utc);

const config = {
  url: (start: string, end: string) => `https://agenda.aeroclubedoparana.com.br/escala/get_reserves.php?start=${start}&end=${end}`,
  resourcesUrl: 'https://agenda.aeroclubedoparana.com.br/escala/get_resources.php',
  cacheFile: `${__dirname}/cache.json`,
  instructors: [
    'PIRAGINE',
    'JOSÉ',
    'MONTEIRO',
    'BOSCOLO',
    'MIRÓ',
  ],
  reserveHours: [
    8,
    9,
    11,
    14,
    15,
  ]
}

const resourceIdsToInclude: string[] = [];

const parseDate = (date: string) => dayjs(date)

const makeWeekDates = () => {
  let current = dayjs().startOf('day');
  const currentWeek = current.week();
  const dates: {start: string, end: string}[] = [];
  while (true) {
    if (current.day() === 0) continue;
    dates.push({
      start: `${current.format('YYYY-MM-DD')}T00:00:00-03:00`,
      end: `${current.add(1, 'day').format('YYYY-MM-DD')}T00:00:00-03:00`
    })
    current = current.add(1, 'day');
    if (current.week() !== currentWeek) {
      break
    }
  }
  return dates;
}

const makeRequest = <T>(url: string) => (
  axios.get<T>(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36'
    }
  })
)

const getResourceIds = async () => {
  const res = await makeRequest<IResources[]>(config.resourcesUrl);
  const data = res.data;
  data.forEach(d => {
    if (config.instructors.includes(d.title)) {
      resourceIdsToInclude.push(d.id);
    }
  })
  return data;
}

const getReserves = async () => {
  try {
    const dates = makeWeekDates();
    const res = await Promise.all(dates.map(d => makeRequest<ReservaRaw[]>(config.url(d.start, d.end))))
    return dates.map((d, i) => (
      [d.start, res[i].data] as [string, ReservaRaw[]]
    ))
  } catch (error) {
    console.log('error: ', error);
  }
}

const parseReverveItem = (item: ReservaRaw): ReservaParsed => {
  return {
    start: parseDate(item.start),
    end: parseDate(item.end).add(10, 'minutes'),
    resId: item.resourceId,
    desc: item.description,
  }
}

const checkForFreeReserves = (reservesByInstructor: {[date: string]: Record<string, ReservaParsed[]>}) => {
  const freeReserves: FreeResv = {};
  Object.entries(reservesByInstructor)
  .forEach(([date, reserves]) => {
    Object.entries(reserves)
    .forEach(([i, rs]) => {
      const rsHours = rs.reduce((rH, r) => {
        const st = r.start.hour();
        const end = r.end.hour();
        const duration = Math.abs(r.end.diff(r.start, 'hours'));
        if (duration === 1) rH.push({start: st, end})
        else {
          let curr = st;
          for (const i of Array(duration).keys()) {
            rH.push({start: curr, end: curr + 1})
            curr += 1;
          }
        }
        return rH
      }, [] as {start: number, end: number}[])
      const freeR = config.reserveHours
      .filter((rh) => {
        if (rsHours.some((r) => r.start === rh)) return false;
        return true;
      })

      if (freeR.length) {
        freeReserves[date] = [
          ...(freeReserves[date] || []),
          ...freeR
        ]
      }
    })
  })
  return freeReserves;
}

const parseReserves = (res: [string, ReservaRaw[]][], resourceIds: IResources[]): Record<string, Record<string, ReservaParsed[]>> => {
  const allReserves: {[date: string]: Record<string, ReservaParsed[]>} = {};
  for (const [date, resv] of res) {
    const reserves = resv
      .filter((r) => (
        resourceIds.find(rid => rid.id === r.resourceId) || false
      ) 
        // && (!/^bg/i.test(r.id))
        && resourceIdsToInclude.includes(r.resourceId)
      )
      .map(parseReverveItem)
      .filter((r) => {
        return r.start.date() === dayjs(date).date()
      });
      allReserves[date] = groupBy(reserves, (r) => r.resId)

    }
    return allReserves
}

const setCache = async (resv: FreeResv) => {
  const now = Date.now();
  await writeFile(config.cacheFile, JSON.stringify({
    time: now,
    resv
  }))
}

const getCache = async (): Promise<FreeResv | null> => {

  try {
    const now = Date.now();
    const cache =  JSON.parse((await readFile(config.cacheFile)).toString()) || {}
    if ((now - cache.now) > 8.64e+7) return null
    return cache.resv || {};
  } catch {
    return {}
  }
}

const isEqualLastNotification = async (resv: FreeResv) => {
  const last = await getCache();
  if (last === null) return false;
  const keys = Array.from(new Set([...Object.keys(resv), ...Object.keys(last)]))
  for (const k of keys) {
    if (
      k in last
      && k in resv
      && last[k].every(item => resv[k].includes(item))
      && resv[k].every(item => last[k].includes(item))
    ) continue
    return false
  }
  return true;
}

const shouldNotify = async (resv: FreeResv) => {
  if (!Object.keys(resv).length) return false;
  if ((await isEqualLastNotification(resv))) return false
  return true
}

export const run = async () => {
  const resourceIds = await getResourceIds()
  const res = await getReserves();
  // await writeFile(`${__dirname}/res.json`, JSON.stringify(res))
  // const res = JSON.parse((await readFile(`${__dirname}/res.json`)).toString());
  if (!res) return;
  const reservesByInstructor = parseReserves(res, resourceIds);
  const freeReserves = checkForFreeReserves(reservesByInstructor)

  if (Object.keys(freeReserves).length) {
    logger.info(`Free reservations: ${JSON.stringify(freeReserves)}`)
  }

  if ((await shouldNotify(freeReserves))) {
    logger.info(logger.style.blue.bgGreen('Sending push notification...'));
    const freeReserveDateStr = Object.entries(freeReserves)
    .reduce((str, [dateStr, rs]) => {
      const dt = new Date(dateStr);
      for (const r of rs) {
        dt.setHours(r);
        str.push(dt.toLocaleString());
      }
      return str
    }, [] as string[])

    notify('Reservas disponíveis', freeReserveDateStr.join(', '))
    await setCache(freeReserves);
  }
  return freeReserves;
}

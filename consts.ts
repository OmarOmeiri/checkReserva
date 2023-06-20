import dayjs from 'dayjs';
import weekYear from 'dayjs/plugin/weekOfYear'
import axios from 'axios';
import { writeFile, readFile } from 'fs/promises'
import { IResources, ReservaParsed, ReservaRaw } from './types';
import { groupBy } from 'lodash';
import { notify } from './notify'

dayjs.extend(weekYear);

const config = {
  url: (start: string, end: string) => `https://agenda.aeroclubedoparana.com.br/escala/get_reserves.php?start=${start}&end=${end}`,
  resourcesUrl: 'https://agenda.aeroclubedoparana.com.br/escala/get_resources.php',
  instructors: [
    'PIRAGINE',
    'JOSÉ',
    'CUNHA',
    'MONTEIRO',
    'DONADEL',
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
    end: parseDate(item.end),
    resId: item.resourceId,
    desc: item.description,
  }
}

const checkForFreeReserves = (reservesByInstructor: {[date: string]: Record<string, ReservaParsed[]>}) => {
  const freeReserves: {[date: string]: number[]} = {};
  Object.entries(reservesByInstructor)
  .forEach(([date, reserves]) => {
    Object.entries(reserves)
    .forEach(([i, rs]) => {
      const rsHours = rs.reduce((rH, r) => {
        const st = r.start.hour();
        const end = r.end.hour();
        const duration = end - st;
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
    const excludes = resv
      .filter((r) => /^bg/i.test(r.id))
      .map(parseReverveItem)
    const reserves = resv
      .filter((r) => (
        resourceIds.find(rid => rid.id === r.resourceId) || false
      ) 
        && (!/^bg/i.test(r.id))
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

(async () => {
  const resourceIds = await getResourceIds()
  const res = await getReserves();
  // await writeFile(`${__dirname}/res.json`, JSON.stringify(res))
  // const res = JSON.parse((await readFile(`${__dirname}/res.json`)).toString());
  if (!res) return;
  const reservesByInstructor = parseReserves(res, resourceIds);
  const freeReserves = checkForFreeReserves(reservesByInstructor)
  console.log('freeReserves: ', freeReserves);
  if (Object.keys(freeReserves).length) {
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
  }
})()
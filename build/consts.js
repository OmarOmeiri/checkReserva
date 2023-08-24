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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dayjs_1 = __importDefault(require("dayjs"));
const weekOfYear_1 = __importDefault(require("dayjs/plugin/weekOfYear"));
const utc_1 = __importDefault(require("dayjs/plugin/utc"));
const axios_1 = __importDefault(require("axios"));
const promises_1 = require("fs/promises");
const lodash_1 = require("lodash");
const notify_1 = require("./notify");
dayjs_1.default.extend(weekOfYear_1.default);
dayjs_1.default.extend(utc_1.default);
const config = {
    url: (start, end) => `https://agenda.aeroclubedoparana.com.br/escala/get_reserves.php?start=${start}&end=${end}`,
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
};
const resourceIdsToInclude = [];
const parseDate = (date) => (0, dayjs_1.default)(date);
const makeWeekDates = () => {
    let current = (0, dayjs_1.default)().startOf('day');
    const currentWeek = current.week();
    const dates = [];
    while (true) {
        if (current.day() === 0)
            continue;
        dates.push({
            start: `${current.format('YYYY-MM-DD')}T00:00:00-03:00`,
            end: `${current.add(1, 'day').format('YYYY-MM-DD')}T00:00:00-03:00`
        });
        current = current.add(1, 'day');
        if (current.week() !== currentWeek) {
            break;
        }
    }
    return dates;
};
const makeRequest = (url) => (axios_1.default.get(url, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36'
    }
}));
const getResourceIds = () => __awaiter(void 0, void 0, void 0, function* () {
    const res = yield makeRequest(config.resourcesUrl);
    const data = res.data;
    data.forEach(d => {
        if (config.instructors.includes(d.title)) {
            resourceIdsToInclude.push(d.id);
        }
    });
    return data;
});
const getReserves = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const dates = makeWeekDates();
        const res = yield Promise.all(dates.map(d => makeRequest(config.url(d.start, d.end))));
        return dates.map((d, i) => [d.start, res[i].data]);
    }
    catch (error) {
        console.log('error: ', error);
    }
});
const parseReverveItem = (item) => {
    return {
        start: parseDate(item.start),
        end: parseDate(item.end).add(10, 'minutes'),
        resId: item.resourceId,
        desc: item.description,
    };
};
const checkForFreeReserves = (reservesByInstructor) => {
    const freeReserves = {};
    Object.entries(reservesByInstructor)
        .forEach(([date, reserves]) => {
        Object.entries(reserves)
            .forEach(([i, rs]) => {
            const rsHours = rs.reduce((rH, r) => {
                const st = r.start.hour();
                const end = r.end.hour();
                const duration = Math.abs(r.end.diff(r.start, 'hours'));
                if (duration === 1)
                    rH.push({ start: st, end });
                else {
                    let curr = st;
                    for (const i of Array(duration).keys()) {
                        rH.push({ start: curr, end: curr + 1 });
                        curr += 1;
                    }
                }
                return rH;
            }, []);
            const freeR = config.reserveHours
                .filter((rh) => {
                if (rsHours.some((r) => r.start === rh))
                    return false;
                return true;
            });
            if (freeR.length) {
                freeReserves[date] = [
                    ...(freeReserves[date] || []),
                    ...freeR
                ];
            }
        });
    });
    return freeReserves;
};
const parseReserves = (res, resourceIds) => {
    const allReserves = {};
    for (const [date, resv] of res) {
        const reserves = resv
            .filter((r) => (resourceIds.find(rid => rid.id === r.resourceId) || false)
            // && (!/^bg/i.test(r.id))
            && resourceIdsToInclude.includes(r.resourceId))
            .map(parseReverveItem)
            .filter((r) => {
            return r.start.date() === (0, dayjs_1.default)(date).date();
        });
        allReserves[date] = (0, lodash_1.groupBy)(reserves, (r) => r.resId);
    }
    return allReserves;
};
const setCache = (resv) => __awaiter(void 0, void 0, void 0, function* () {
    const now = Date.now();
    yield (0, promises_1.writeFile)(config.cacheFile, JSON.stringify({
        time: now,
        resv
    }));
});
const getCache = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const now = Date.now();
        const cache = JSON.parse((yield (0, promises_1.readFile)(config.cacheFile)).toString()) || {};
        if ((now - cache.now) > 8.64e+7)
            return null;
        return cache.resv || {};
    }
    catch (_a) {
        return {};
    }
});
const isEqualLastNotification = (resv) => __awaiter(void 0, void 0, void 0, function* () {
    const last = yield getCache();
    if (last === null)
        return false;
    const keys = Array.from(new Set([...Object.keys(resv), ...Object.keys(last)]));
    for (const k of keys) {
        if (k in last
            && k in resv
            && last[k].every(item => resv[k].includes(item))
            && resv[k].every(item => last[k].includes(item)))
            continue;
        return false;
    }
    return true;
});
const shouldNotify = (resv) => __awaiter(void 0, void 0, void 0, function* () {
    if (!Object.keys(resv).length)
        return false;
    if ((yield isEqualLastNotification(resv)))
        return false;
    return true;
});
(() => __awaiter(void 0, void 0, void 0, function* () {
    const resourceIds = yield getResourceIds();
    const res = yield getReserves();
    // await writeFile(`${__dirname}/res.json`, JSON.stringify(res))
    // const res = JSON.parse((await readFile(`${__dirname}/res.json`)).toString());
    if (!res)
        return;
    const reservesByInstructor = parseReserves(res, resourceIds);
    const freeReserves = checkForFreeReserves(reservesByInstructor);
    console.log(`freeReserves: [${(0, dayjs_1.default)().format('YYYY-MM-DD hh:mm')}]`, freeReserves);
    if ((yield shouldNotify(freeReserves))) {
        const freeReserveDateStr = Object.entries(freeReserves)
            .reduce((str, [dateStr, rs]) => {
            const dt = new Date(dateStr);
            for (const r of rs) {
                dt.setHours(r);
                str.push(dt.toLocaleString());
            }
            return str;
        }, []);
        (0, notify_1.notify)('Reservas disponíveis', freeReserveDateStr.join(', '));
        yield setCache(freeReserves);
    }
}))();

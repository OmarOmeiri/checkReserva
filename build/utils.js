"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.windowArray = exports.range = void 0;
/**
 * Returns a range of numbers
 * @param from
 * @param to
 * @param step
 * @returns
 */
function range(from, to, step = 1) {
    let rev = false;
    if (!step)
        return [];
    // eslint-disable-next-line no-param-reassign
    step = Math.round(step);
    if (from > to) {
        rev = true;
        // eslint-disable-next-line no-param-reassign
        [from, to] = [to, from];
    }
    if (step < 0) {
        rev = true;
        // eslint-disable-next-line no-param-reassign
        step = Math.abs(step);
    }
    const amplitude = to - from;
    if (amplitude < 1 || amplitude < step)
        return [from];
    if (rev)
        return [...Array(Math.floor((to - from) / step) + 1)].map((v, i) => from + i * step).reverse();
    return [...Array(Math.floor((to - from) / step) + 1)].map((v, i) => from + i * step);
}
exports.range = range;
/**
 * Generator that yields an array chunked by the size param
 * and moves the window by the windowMove param
 * @param arr
 * @param size
 * @param [windowSize] default = 1
 */
function* windowArray(arr, size, windowMove = 1) {
    if (windowMove < 1)
        throw new Error('Window dislocation cannot be less than 1.');
    if (size < 2)
        throw new Error('Window size cannot be less than 2.');
    const lng = arr.length;
    const iterations = windowMove > 1
        ? Math.ceil(((lng - (size - 1)) / windowMove) % lng)
        : lng - (size - 1);
    const ixs = Array.from(Array(iterations).keys()).map((i) => i * windowMove);
    for (const i of ixs) {
        yield range(i, i + (size - 1)).map((j) => arr[j]);
    }
}
exports.windowArray = windowArray;

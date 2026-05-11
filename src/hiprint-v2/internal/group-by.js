/**
 * group-by.js — array grouping helpers.
 *
 * V1: hinnn.groupBy / hinnn.orderBy (bundle.js line 281-323).
 */

/**
 * Group an array of objects by a derived key. Returns array of group objects,
 * each containing the shared fields + `rows` (matched items).
 *
 * @template T
 * @param {T[]} arr   Items to group
 * @param {string[]} fields  Field names to copy into each group object
 * @param {(item:T) => *} keyFn  Group key extractor (stringified via JSON.stringify)
 * @returns {Array<Object & {rows: T[]}>}
 *
 * @example
 *   groupBy([{type:'a',n:1},{type:'a',n:2},{type:'b',n:3}], ['type'], r => r.type)
 *   // → [{type:'a', rows:[...]}, {type:'b', rows:[...]}]
 */
export function groupBy(arr, fields, keyFn) {
  const map = {}
  arr.forEach((item) => {
    const key = JSON.stringify(keyFn(item))
    if (!map[key]) {
      map[key] = { rows: [] }
      fields.forEach((f) => {
        map[key][f] = item[f]
      })
    }
    map[key].rows.push(item)
  })
  return Object.keys(map).map((k) => map[k])
}

/**
 * Quick-sort array by a key function (V1 recursive impl, preserved).
 *
 * @template T
 * @param {T[]} arr
 * @param {(item:T) => number|string} keyFn
 * @returns {T[]}  New sorted array
 */
export function orderBy(arr, keyFn) {
  if (arr.length <= 1) return arr.slice()
  const work = arr.slice()
  const mid = Math.floor(work.length / 2)
  const pivot = work.splice(mid, 1)[0]
  const lower = []
  const higher = []
  for (const item of work) {
    if (keyFn(item) < keyFn(pivot)) {
      lower.push(item)
    } else {
      higher.push(item)
    }
  }
  return orderBy(lower, keyFn).concat([pivot], orderBy(higher, keyFn))
}

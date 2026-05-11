/**
 * group-by.ts — array grouping helpers (ported from V2).
 *
 * V1: hinnn.groupBy / hinnn.orderBy (bundle.js line 281-323).
 */

/**
 * Group an array of objects by a derived key. Returns array of group objects,
 * each containing the shared fields + `rows` (matched items).
 *
 * @example
 *   groupBy([{type:'a',n:1},{type:'a',n:2},{type:'b',n:3}], ['type'], r => r.type)
 *   // → [{type:'a', rows:[{type:'a',n:1},{type:'a',n:2}]}, {type:'b', rows:[...]}]
 */
export function groupBy<T extends Record<string, unknown>>(
  arr: readonly T[],
  fields: readonly string[],
  keyFn: (item: T) => unknown
): Array<Partial<T> & { rows: T[] }> {
  const map: Record<string, Partial<T> & { rows: T[] }> = {}
  arr.forEach((item) => {
    const key = JSON.stringify(keyFn(item))
    let bucket = map[key]
    if (!bucket) {
      bucket = { rows: [] as T[] } as unknown as Partial<T> & { rows: T[] }
      fields.forEach((f) => {
        ;(bucket as Record<string, unknown>)[f] = item[f]
      })
      map[key] = bucket
    }
    bucket.rows.push(item)
  })
  return Object.keys(map).map((k) => map[k]!)
}

/**
 * Quick-sort array by a key function (V1 recursive impl, preserved).
 *
 * @returns A new sorted array; input is not mutated.
 */
export function orderBy<T>(
  arr: readonly T[],
  keyFn: (item: T) => number | string
): T[] {
  if (arr.length <= 1) return arr.slice()
  const work = arr.slice()
  const mid = Math.floor(work.length / 2)
  const pivotArr = work.splice(mid, 1)
  const pivot = pivotArr[0]!
  const lower: T[] = []
  const higher: T[] = []
  for (const item of work) {
    if (keyFn(item) < keyFn(pivot)) {
      lower.push(item)
    } else {
      higher.push(item)
    }
  }
  return orderBy(lower, keyFn).concat([pivot], orderBy(higher, keyFn))
}

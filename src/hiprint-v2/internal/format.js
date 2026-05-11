/**
 * format.js — date / number formatters.
 *
 * V1: hinnn.dateFormat / hinnn.numFormat (bundle.js line 324-360).
 *
 * 行为与 V1 100% 一致 (包括边界):
 *   - dateFormat('2024-01-02', 'yyyy-MM-dd HH:mm:ss') → '2024-01-02 00:00:00'
 *   - numFormat(3.14159, 2) → '3.14'
 *   - 失败时 console.error + return '' (R1 PM-013 修后的 logging)
 */

/**
 * Format a Date / date-like value using a pattern.
 *
 * Pattern tokens (case-sensitive):
 *  - y+   year
 *  - M+   month (1-12, padded based on token width)
 *  - d+   day of month
 *  - H+   hour (24-hour)
 *  - m+   minute
 *  - s+   second
 *  - q+   quarter (1-4)
 *  - S    millisecond
 *
 * @param {*} value
 * @param {string} pattern
 * @returns {string}
 */
export function dateFormat(value, pattern) {
  if (!value) return ''
  try {
    const o = new Date('' + value)
    const map = {
      'y+': o.getFullYear(),
      'M+': o.getMonth() + 1,
      'd+': o.getDate(),
      'H+': o.getHours(),
      'm+': o.getMinutes(),
      's+': o.getSeconds(),
      'q+': Math.floor((o.getMonth() + 3) / 3),
      S: o.getMilliseconds(),
    }
    let result = pattern
    if (/(y+)/.test(result)) {
      result = result.replace(
        RegExp.$1,
        (o.getFullYear() + '').substr(4 - RegExp.$1.length)
      )
    }
    for (const i in map) {
      if (new RegExp('(' + i + ')').test(result)) {
        const v = map[i]
        result = result.replace(
          RegExp.$1,
          RegExp.$1.length === 1 ? v : ('00' + v).substr(('' + v).length)
        )
      }
    }
    return result
  } catch (err) {
    console.error('[hiprint] format failed:', err)
    return ''
  }
}

/**
 * Format a number value with decimal precision.
 *
 * @param {number|string} value
 * @param {number|string} [precision]  digits after decimal point. 0 / undefined → integer
 * @returns {string|number}  toFixed string when precision > 0, else integer
 */
export function numFormat(value, precision) {
  if (value === undefined || value === null || value === '') return ''
  try {
    const o = typeof value === 'string' ? parseFloat(value) : value
    const l = parseInt(precision)
    if (l > 0) return o.toFixed(l)
    return parseInt(o.toString())
  } catch (err) {
    console.error('[hiprint] format failed:', err)
    return ''
  }
}

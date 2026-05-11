/**
 * image.js — Image rendering + base64 conversion helpers.
 *
 * V1 source: bundle.js line 9223-9230 (updateTargetImage),
 *            line 500-516 (imageToBase64 + xhrLoadImage),
 *            line 3760-3800 (image-option dialog upload + refresh).
 *
 * V2 split:
 *  - createImageTarget(src, options) — pure: returns jQuery <img> element with attrs set
 *  - loadImage(src, onload, onerror) — pure: new Image() with onerror guard (R3 silent #8 fix)
 *  - imageToBase64(srcUrl, cache) — converts URL to data: URI via canvas
 *
 * Invariants:
 *  - [XSS B1] Never string-concat src into HTML; always use .attr('src', val) (jQuery attribute escape)
 *  - [silent #8] new Image() must have onerror handler, else broken URLs hang callback chains
 */

import { i18n } from '@hiprint-v2/internal'

/**
 * Create a fresh <img> jQuery element with src set safely.
 *
 * @param {string} src
 * @param {{ width?: string|number, height?: string|number, fit?: string, borderRadius?: string|number }} [options]
 * @returns {jQuery}
 */
export function createImageTarget(src, options) {
  options = options || {}
  // [XSS B1] .attr() escapes the value — never use string concat with .html()
  const $img = window
    .$('<img>')
    .attr({
      src: src || '',
      style: 'width:100%;height:100%;',
    })
  if (options.fit) $img.css('object-fit', options.fit)
  if (options.borderRadius) $img.css('border-radius', options.borderRadius)
  return $img
}

/**
 * Update an existing image target. Reuses <img> if present, else creates one.
 *
 * @param {jQuery} $container  parent jQuery element (.hiprint-printElement-image-content)
 * @param {string} src  user-controlled image URL (file/http/data)
 * @param {object} [options]
 */
export function updateImageTarget($container, src, options) {
  const $existing = $container.find('img')
  if ($existing.length) {
    $existing.attr('src', src || '')
    return $existing
  }
  const $img = createImageTarget(src, options)
  $container.empty().append($img)
  return $img
}

/**
 * Load image asynchronously with onerror guard. Always invokes one of the callbacks.
 *
 * @param {string} src
 * @param {(img: HTMLImageElement) => void} onload
 * @param {(err?: Error) => void} [onerror]
 */
export function loadImage(src, onload, onerror) {
  if (!src) {
    if (typeof onerror === 'function') onerror(new Error('empty src'))
    return
  }
  const img = new Image()
  // [silent #8] always bind onerror BEFORE src, else 404 leaves callback chain hanging
  img.onerror = function () {
    console.warn('[hiprint] image load failed for', src)
    if (typeof onerror === 'function') onerror()
  }
  img.onload = function () {
    if (typeof onload === 'function') onload(img)
  }
  img.src = src
  // Cached image may already be complete
  if (img.complete && img.naturalWidth) {
    if (typeof onload === 'function') onload(img)
  }
}

/**
 * Convert image URL to data: URI via canvas (CORS-permitting).
 * Caches results in passed-in object (per-template scope).
 *
 * @param {string} srcUrl
 * @param {Object<string, string>} [cache]  Mutated to store result by srcUrl
 * @returns {Promise<string>}  data:image/png;base64,... or original srcUrl on failure
 */
export function imageToBase64Async(srcUrl, cache) {
  return new Promise((resolve) => {
    if (!srcUrl || srcUrl.indexOf('base64') >= 0) {
      resolve(srcUrl)
      return
    }
    if (cache && cache[srcUrl]) {
      resolve(cache[srcUrl])
      return
    }
    loadImage(
      srcUrl,
      (img) => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = img.width
          canvas.height = img.height
          canvas.getContext('2d').drawImage(img, 0, 0)
          const dataUrl = canvas.toDataURL('image/png')
          if (cache) cache[srcUrl] = dataUrl
          resolve(dataUrl)
        } catch (err) {
          console.error('[hiprint] imageToBase64 canvas failed:', err)
          resolve(srcUrl) // fallback: original URL
        }
      },
      () => {
        // load failed → return original URL (caller can fallback render)
        resolve(srcUrl)
      }
    )
  })
}

/**
 * Build "image load failed" fallback element with i18n message.
 *
 * @returns {jQuery}
 */
export function createImageFailFallback() {
  return window
    .$('<div></div>')
    .css({ color: '#999', fontSize: '12px' })
    .text(i18n.__('图片加载失败') || 'Image load failed')
}

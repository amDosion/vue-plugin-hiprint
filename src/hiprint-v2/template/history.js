/**
 * template/history.js — PrintTemplate undo/redo mixin.
 *
 * V1 source: bundle.js line 12442-12450 area (undo/redo trigger event-bus).
 * V1 actual history logic lived in a separate file under the shortcut handler
 * (hiprintTemplateDataShortcutKey_* event). V2 keeps the same event-bus contract.
 *
 * Invariants (V2 必须保留):
 *  - PM-003 R3: assertNotDestroyed
 *  - undo / redo 触发 event-bus key 'hiprintTemplateDataShortcutKey_<id>'
 *    so external history listener (P10c) can advance historyPos.
 *  - addHistoryEntry: 内部 helper for tests + future history listener
 */

import { assertNotDestroyed } from '@hiprint-v2/internal'

export const historyMixin = {
  /**
   * Append a history entry (snapshot of current JSON).
   *
   * @param {string} [type='change']  free-form label ('编辑修改' / '移动' / '删除' / ...)
   */
  addHistoryEntry(type) {
    if (assertNotDestroyed(this, 'addHistoryEntry')) return
    if (!this.history) return
    // Trim forward history if redo state present
    if (this.historyPos < this.historyList.length - 1) {
      this.historyList = this.historyList.slice(0, this.historyPos + 1)
    }
    const snapshot = this.getJson ? this.getJson() : {}
    this.historyList.push({
      id: this._generateId(),
      type: type || 'change',
      json: JSON.parse(JSON.stringify(snapshot)),
    })
    this.historyPos = this.historyList.length - 1
  },

  /**
   * Trigger undo via event-bus (V1 delegates to shortcut-key listener).
   * Falls back to direct historyList manipulation if no listener attached.
   */
  undo() {
    if (assertNotDestroyed(this, 'undo')) return
    const bus = typeof window !== 'undefined' && window.hinnn && window.hinnn.event
    if (bus) {
      bus.trigger('hiprintTemplateDataShortcutKey_' + this.id, 'undo')
    }
    // V2 fallback: rewind locally if no listener
    if (this.historyPos > 0) {
      this.historyPos -= 1
      const entry = this.historyList[this.historyPos]
      if (entry && entry.json && typeof this.update === 'function') {
        // mark history-driven update so addHistoryEntry isn't re-triggered
        this._inHistoryRestore = true
        try {
          this.update(entry.json)
        } finally {
          this._inHistoryRestore = false
        }
      }
    }
  },

  /**
   * Trigger redo via event-bus + fallback advance.
   */
  redo() {
    if (assertNotDestroyed(this, 'redo')) return
    const bus = typeof window !== 'undefined' && window.hinnn && window.hinnn.event
    if (bus) {
      bus.trigger('hiprintTemplateDataShortcutKey_' + this.id, 'redo')
    }
    if (this.historyPos < this.historyList.length - 1) {
      this.historyPos += 1
      const entry = this.historyList[this.historyPos]
      if (entry && entry.json && typeof this.update === 'function') {
        this._inHistoryRestore = true
        try {
          this.update(entry.json)
        } finally {
          this._inHistoryRestore = false
        }
      }
    }
  },

  /**
   * Inspect current history position.
   * @returns {{ pos:number, total:number, canUndo:boolean, canRedo:boolean }}
   */
  getHistoryState() {
    if (assertNotDestroyed(this, 'getHistoryState')) {
      return { pos: 0, total: 0, canUndo: false, canRedo: false }
    }
    return {
      pos: this.historyPos,
      total: this.historyList.length,
      canUndo: this.historyPos > 0,
      canRedo: this.historyPos < this.historyList.length - 1,
    }
  },
}

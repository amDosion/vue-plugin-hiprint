/**
 * ui/index.spec.js — Barrel surface check.
 *
 * Locks the P11 V2 export contract: V2 entry re-exports all UI factories.
 */
import { describe, it, expect } from 'vitest'
import * as ui from '../index.js'

describe('ui barrel exports', () => {
  it('exports buildToolbar', () => {
    expect(typeof ui.buildToolbar).toBe('function')
  })
  it('exports buildDesigner', () => {
    expect(typeof ui.buildDesigner).toBe('function')
  })
  it('exports createElementListPanel + refreshElementList + destroyElementListPanel', () => {
    expect(typeof ui.createElementListPanel).toBe('function')
    expect(typeof ui.refreshElementList).toBe('function')
    expect(typeof ui.destroyElementListPanel).toBe('function')
  })
  it('exports createPropertyPanel + bindPropertyPanel', () => {
    expect(typeof ui.createPropertyPanel).toBe('function')
    expect(typeof ui.bindPropertyPanel).toBe('function')
  })
  it('exports uid generators', () => {
    expect(typeof ui._generateToolbarUid).toBe('function')
    expect(typeof ui._generateDesignerUid).toBe('function')
  })
})

describe('v2 entry re-exports ui factories', () => {
  it('hiprint-v2/index.js exposes buildToolbar / buildDesigner', async () => {
    const v2 = await import('../../index.js')
    expect(typeof v2.buildToolbar).toBe('function')
    expect(typeof v2.buildDesigner).toBe('function')
    expect(typeof v2.createElementListPanel).toBe('function')
    expect(typeof v2.createPropertyPanel).toBe('function')
  })
})

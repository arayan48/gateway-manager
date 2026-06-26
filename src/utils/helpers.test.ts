import { describe, it, expect } from 'vitest'
import { genId, isValidIp, sanitizeLabel } from './helpers'

describe('genId', () => {
  it('returns a string of 7 characters', () => {
    const id = genId()
    expect(id).toHaveLength(7)
    expect(typeof id).toBe('string')
  })

  it('returns unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, () => genId()))
    expect(ids.size).toBe(100)
  })
})

describe('isValidIp', () => {
  it('accepts valid IPs', () => {
    expect(isValidIp('192.168.1.1')).toBe(true)
    expect(isValidIp('10.10.0.2')).toBe(true)
    expect(isValidIp('255.255.255.255')).toBe(true)
    expect(isValidIp('0.0.0.0')).toBe(true)
  })

  it('rejects invalid IPs', () => {
    expect(isValidIp('999.999.999.999')).toBe(false)
    expect(isValidIp('256.1.1.1')).toBe(false)
    expect(isValidIp('1.2.3')).toBe(false)
    expect(isValidIp('1.2.3.4.5')).toBe(false)
    expect(isValidIp('')).toBe(false)
    expect(isValidIp('abc.def.ghi.jkl')).toBe(false)
    expect(isValidIp('1.2.3.4a')).toBe(false)
  })

  it('trims whitespace', () => {
    expect(isValidIp('  10.10.0.1  ')).toBe(true)
  })
})

describe('sanitizeLabel', () => {
  it('strips dangerous characters', () => {
    expect(sanitizeLabel('hello`world')).toBe('helloworld')
    expect(sanitizeLabel('test$var')).toBe('testvar')
    expect(sanitizeLabel('cmd;rm -rf')).toBe('cmdrm -rf')
    expect(sanitizeLabel('a|b&c<d>e')).toBe('abcde')
  })

  it('preserves safe characters', () => {
    expect(sanitizeLabel('FiveM Server')).toBe('FiveM Server')
    expect(sanitizeLabel('Port 8080')).toBe('Port 8080')
  })

  it('truncates to 60 characters', () => {
    const long = 'a'.repeat(100)
    expect(sanitizeLabel(long)).toHaveLength(60)
  })
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fitInt4 } from './compensation'

test('fitInt4 keeps a normal annual salary', () => {
  assert.equal(fitInt4(180_000), 180_000)
})

test('fitInt4 rejects INT4 overflow', () => {
  assert.equal(fitInt4(9_500_000_000), null)
  assert.equal(fitInt4(11_000_000_000), null)
})

test('fitInt4 rejects zero, negative, and non-finite values', () => {
  assert.equal(fitInt4(0), null)
  assert.equal(fitInt4(-1), null)
  assert.equal(fitInt4(Number.NaN), null)
  assert.equal(fitInt4(Number.POSITIVE_INFINITY), null)
  assert.equal(fitInt4(null), null)
  assert.equal(fitInt4(undefined), null)
})

test('fitInt4 accepts the INT4 max', () => {
  assert.equal(fitInt4(2_147_483_647), 2_147_483_647)
})

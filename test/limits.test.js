const { test } = require('node:test')
const assert = require('node:assert')
const { canAdd, canSaveGroup, PLAN_LIMITS } = require('../limits.js')

test('free plan allows up to the limit and blocks the next one', () => {
  assert.strictEqual(canAdd('free', 'elements', 4), true)
  assert.strictEqual(canAdd('free', 'elements', 5), false)
  assert.strictEqual(canAdd('free', 'templates', 0), true)
  assert.strictEqual(canAdd('free', 'templates', 1), false)
  assert.strictEqual(canAdd('free', 'boards', 0), true)
  assert.strictEqual(canAdd('free', 'boards', 1), false)
})

test('pro plan does not cap elements or boards', () => {
  assert.strictEqual(canAdd('pro', 'elements', 100000), true)
  assert.strictEqual(canAdd('pro', 'boards', 100000), true)
})

test('an unknown plan is treated as free', () => {
  assert.strictEqual(canAdd('hacked', 'elements', 5), false)
})

test('free users can overwrite their one group but not fill a second', () => {
  assert.strictEqual(canSaveGroup('free', { 3: ['a'] }, '3'), true)
  assert.strictEqual(canSaveGroup('free', { 3: ['a'] }, '4'), false)
  assert.strictEqual(canSaveGroup('free', {}, '4'), true)
})

test('an emptied group does not use up the free slot', () => {
  assert.strictEqual(canSaveGroup('free', { 3: [] }, '4'), true)
})

test('pro users can fill every group slot', () => {
  const six = { 1: ['a'], 2: ['a'], 3: ['a'], 4: ['a'], 5: ['a'], 6: ['a'] }
  assert.strictEqual(canSaveGroup('pro', six, '7'), true)
  assert.strictEqual(PLAN_LIMITS.pro.groups, 7)
})

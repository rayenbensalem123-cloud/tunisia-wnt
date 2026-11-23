import assert from 'node:assert/strict'
import { inCategory, otherCategories, memberCategories, categoryLabel } from '../lib/categories.ts'

const dual = { teamCategory: 'U20', otherCategories: ['SENIORS'] }
assert.equal(inCategory(dual, 'U20'), true)
assert.equal(inCategory(dual, 'SENIORS'), true)
assert.equal(inCategory(dual, 'U17'), false)
assert.deepEqual(memberCategories(dual), ['U20', 'SENIORS'])
assert.deepEqual(otherCategories(dual, 'U20'), ['SENIORS'])
assert.deepEqual(otherCategories(dual, 'SENIORS'), ['U20'])
assert.equal(categoryLabel('LIGUE'), 'LIGUE FÉMININE')

// Legacy cards have no otherCategories at all.
const plain = { teamCategory: 'SENIORS' }
assert.equal(inCategory(plain, 'U20'), false)
assert.deepEqual(otherCategories(plain, 'SENIORS'), [])

console.log('Category tests passed.')

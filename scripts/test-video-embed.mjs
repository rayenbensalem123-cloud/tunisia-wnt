import assert from 'node:assert/strict'
import { videoPlayback } from '../lib/video-embed.ts'

const embed = videoPlayback('https://youtu.be/abc12345')
assert.equal(embed?.type, 'iframe')
assert.match(embed.src, /youtube-nocookie\.com\/embed\/abc12345/)
assert.match(embed.src, /modestbranding=1/)
assert.match(embed.src, /rel=0/)
assert.equal(videoPlayback('not a link'), null)
assert.equal(videoPlayback('https://example.com/video'), null)

console.log('Video embed tests passed.')

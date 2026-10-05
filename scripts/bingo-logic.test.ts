// Run with:  bun scripts/bingo-logic.test.ts
import assert from "node:assert/strict"
import {
  SQUARES, dealCard, evaluateCard, scoreCard, matchKey, findPlayed, buildLeaderboard, goalMinutes, cleanEventMinutes,
  type BingoMatch, LOCK_LIMIT,
} from "../lib/bingo-logic"

let n = 0
const t = (name: string, fn: () => void) => { fn(); n++; console.log("ok -", name) }

const played: BingoMatch = {
  opponent: "Algeria", date: "2026-10-10", result: "2-1", status: "approved",
  scorers: [{ playerId: 7, goals: 2 }],
  yellowCards: [4], redCards: [],
  subs: [{ out: 9, in: 14 }, { out: 6, in: 15 }, { out: 3, in: 16 }],
  eventMinutes: { "g:7:1": 12, "g:7:2": 78, "y:4": 25, "s:9:14": 55, "s:6:15": 70, "s:3:16": 80 },
  tunisiaPossession: "58", tunisiaCorners: "5", opponentCorners: "4", tunisiaShotsOnTarget: "6",
  tunisiaFouls: "9", opponentFouls: "13", tunisiaShots: "14", opponentShots: "7",
}
const state = (id: string, m: BingoMatch) => {
  const r = SQUARES.find(s => s.id === id)!.check(m)
  return r === null ? "void" : r ? "yes" : "no"
}

t("every square has unique id and 3 labels", () => {
  assert.equal(new Set(SQUARES.map(s => s.id)).size, SQUARES.length)
  for (const s of SQUARES) for (const l of ["en", "fr", "ar"] as const) assert.ok(s.label[l].length > 3, `${s.id} ${l}`)
})

t("dealing is deterministic and per-user", () => {
  const k = matchKey(played)
  const a = dealCard(k, "Sarra").map(s => s.id)
  assert.deepEqual(a, dealCard(k, "sarra ").map(s => s.id))
  assert.notDeepEqual(a, dealCard(k, "Mounir").map(s => s.id))
  assert.notDeepEqual(a, dealCard("2026-11-01|egypt", "Sarra").map(s => s.id))
})

t("cards have 9 unique squares, 3 minute squares, no contradictions", () => {
  for (let i = 0; i < 400; i++) {
    const card = dealCard(`k${i}`, `u${i % 7}`)
    assert.equal(card.length, 9)
    assert.equal(new Set(card.map(s => s.id)).size, 9)
    assert.equal(card.filter(s => s.kind === "minute").length, 3)
    for (const a of card) for (const b of card) if (a !== b) {
      assert.ok(!(a.excl?.includes(b.id)), `${a.id} vs ${b.id}`)
    }
  }
})

t("result & goal squares", () => {
  assert.equal(state("win", played), "yes")
  assert.equal(state("draw", played), "no")
  assert.equal(state("clean", played), "no")
  assert.equal(state("btts", played), "yes")
  assert.equal(state("tn2", played), "yes")
  assert.equal(state("tn3", played), "no")
  assert.equal(state("over25", played), "yes")
  assert.equal(state("under3", played), "no")
})

t("scorer, card, sub and stat squares", () => {
  assert.equal(state("brace", played), "yes")
  assert.equal(state("twoScorers", played), "no")
  assert.equal(state("subScorer", played), "no")
  assert.equal(state("yellow", played), "yes")
  assert.equal(state("noCards", played), "no")
  assert.equal(state("red", played), "no")
  assert.equal(state("threeSubs", played), "yes")
  assert.equal(state("poss55", played), "yes")
  assert.equal(state("corners8", played), "yes")
  assert.equal(state("sot5", played), "yes")
  assert.equal(state("fouls20", played), "yes")
  assert.equal(state("moreShots", played), "yes")
})

t("exact-minute squares use the recorded minutes", () => {
  assert.deepEqual(goalMinutes(played), [12, 78])
  assert.equal(state("early", played), "yes")       // 12'
  assert.equal(state("firstHalf", played), "yes")
  assert.equal(state("secondHalf", played), "yes")  // 78'
  assert.equal(state("late", played), "yes")        // 78 >= 75
  assert.equal(state("bothHalves", played), "yes")
  assert.equal(state("earlyYellow", played), "yes") // 25'
  assert.equal(state("earlySub", played), "yes")    // first sub at 55'
})

t("minute squares are void (not wrong) when minutes were not entered, and false when provably not", () => {
  const noMinutes: BingoMatch = { ...played, eventMinutes: {} }
  assert.equal(state("early", noMinutes), "void")
  assert.equal(state("bothHalves", noMinutes), "void")
  assert.equal(state("earlyYellow", noMinutes), "void")
  const late: BingoMatch = { ...played, eventMinutes: { "g:7:1": 50, "g:7:2": 80, "y:4": 70, "s:9:14": 65, "s:6:15": 70, "s:3:16": 80 } }
  assert.equal(state("early", late), "no")
  assert.equal(state("firstHalf", late), "no")
  assert.equal(state("earlyYellow", late), "no")
  assert.equal(state("earlySub", late), "no")
  const goalless: BingoMatch = { opponent: "x", date: "2026-10-10", result: "0-0", scorers: [], eventMinutes: {} }
  assert.equal(state("early", goalless), "no")
  assert.equal(state("brace", goalless), "no")
  assert.equal(state("draw", goalless), "yes")
  assert.equal(state("clean", goalless), "yes")
})

t("stats left blank are void", () => {
  const bare: BingoMatch = { opponent: "x", date: "2026-10-10", result: "1-0", scorers: [{ playerId: 1, goals: 1 }] }
  assert.equal(state("poss55", bare), "void")
  assert.equal(state("corners8", bare), "void")
  assert.equal(state("moreShots", bare), "void")
  assert.equal(state("win", bare), "yes")
})

t("scoring: 10 per locked hit, 15 per fully locked & true line", () => {
  const card = dealCard("k", "u")
  const all = card.map(() => "yes" as const)
  const lock = card.slice(0, 5).map(s => s.id) // squares 0-4 → includes row 0 (0,1,2) and row 1 needs 5
  const s = scoreCard(card, all, lock)
  assert.equal(s.correct, 5)
  assert.equal(s.lines.length, 1)
  assert.equal(s.points, 5 * 10 + 15)
  const none = scoreCard(card, card.map(() => "no" as const), lock)
  assert.equal(none.points, 0)
  const v = scoreCard(card, card.map(() => "void" as const), lock)
  assert.equal(v.points, 0)
  assert.equal(LOCK_LIMIT, 5)
})

t("fixture and its recorded match share one key; findPlayed prefers the richer record", () => {
  const fixture = { opponent: "ALGERIA ", date: "2026-10-10" }
  assert.equal(matchKey(fixture), matchKey(played))
  const thin: BingoMatch = { opponent: "Algeria", date: "2026-10-10", result: "2-1", status: "approved" }
  const pending: BingoMatch = { ...played, status: "pending" }
  const got = findPlayed([thin, played, pending], matchKey(fixture))
  assert.equal(got, played)
  assert.equal(findPlayed([pending], matchKey(fixture)), null)
})

t("leaderboard: scores picks, ignores late edits and unplayed fixtures", () => {
  const key = matchKey(played)
  const card = dealCard(key, "sarra")
  const hit = card.find(s => s.check(played) === true)!.id
  const rows = buildLeaderboard(
    [
      { username: "sarra", matchKey: key, picks: [hit], updatedAt: "2026-10-09T10:00:00Z" },
      { username: "late", matchKey: key, picks: [hit], updatedAt: "2026-10-11T08:00:00Z" },
      { username: "future", matchKey: "2027-01-01|egypt", picks: [hit], updatedAt: "2026-10-09T10:00:00Z" },
    ],
    [played]
  )
  assert.equal(rows.length, 1)
  assert.equal(rows[0].username, "sarra")
  assert.ok(rows[0].points >= 10)
})

t("cleanEventMinutes drops minutes of removed events and out-of-range values", () => {
  const m: BingoMatch = {
    scorers: [{ playerId: 7, goals: 1 }], yellowCards: [4], redCards: [], subs: [{ out: 9, in: 14 }],
    eventMinutes: { "g:7:1": 12, "g:7:2": 80, "g:8:1": 30, "y:4": 25, "r:4": 40, "s:9:14": 55, "s:1:2": 60, "y:5": 999 },
  }
  assert.deepEqual(cleanEventMinutes(m), { "g:7:1": 12, "y:4": 25, "s:9:14": 55 })
})

console.log(`\n${n} tests passed`)

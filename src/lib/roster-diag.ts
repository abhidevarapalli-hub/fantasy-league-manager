import { buildOptimalActive11, LeagueConfig } from './roster-validation';
import { Player } from './supabase-types';

const p = (id: string, role: Player['role'], intl = false): Player => ({
    id, name: id, team: 'A', role, isInternational: intl,
});

// ─── Configs ─────────────────────────────────────────────────────────
const C8: LeagueConfig = { managerCount: 6, activeSize: 8, benchSize: 1, minBatWk: 2, maxBatWk: 5, minBowlers: 2, maxBowlers: 4, minAllRounders: 1, maxAllRounders: 3, maxInternational: 4, requireWk: true };
const C8_NW: LeagueConfig = { ...C8, requireWk: false };
const C8_MIN: LeagueConfig = { managerCount: 6, activeSize: 8, benchSize: 1, minBatWk: 1, maxBatWk: 6, minBowlers: 1, maxBowlers: 6, minAllRounders: 1, maxAllRounders: 6, maxInternational: 4, requireWk: false };
const C9: LeagueConfig = { managerCount: 6, activeSize: 9, benchSize: 2, minBatWk: 3, maxBatWk: 6, minBowlers: 2, maxBowlers: 4, minAllRounders: 1, maxAllRounders: 3, maxInternational: 4, requireWk: true };
const C9_NW: LeagueConfig = { ...C9, requireWk: false };
const C10: LeagueConfig = { managerCount: 8, activeSize: 10, benchSize: 2, minBatWk: 3, maxBatWk: 6, minBowlers: 3, maxBowlers: 5, minAllRounders: 2, maxAllRounders: 4, maxInternational: 4, requireWk: true };
const C10_HB: LeagueConfig = { managerCount: 8, activeSize: 10, benchSize: 2, minBatWk: 2, maxBatWk: 4, minBowlers: 4, maxBowlers: 6, minAllRounders: 1, maxAllRounders: 3, maxInternational: 4, requireWk: true };
const C10_LI: LeagueConfig = { ...C10, maxInternational: 2 };
const C11: LeagueConfig = { managerCount: 8, activeSize: 11, benchSize: 3, minBatWk: 4, maxBatWk: 7, minBowlers: 3, maxBowlers: 6, minAllRounders: 2, maxAllRounders: 4, maxInternational: 4, requireWk: true };
// Config with 0 flex (mandatory fills all slots): activeSize=9, mandatory=WK(1)+BAT(2)+AR(3)+BWL(3)=9
const C9_ZF: LeagueConfig = { managerCount: 6, activeSize: 9, benchSize: 2, minBatWk: 3, maxBatWk: 5, minBowlers: 3, maxBowlers: 5, minAllRounders: 3, maxAllRounders: 5, maxInternational: 4, requireWk: true };
// Low intl limit
const C9_LI: LeagueConfig = { ...C9, maxInternational: 2 };

const scenarios: { name: string; cfg: LeagueConfig; players: Player[] }[] = [
    // ═══ FULL ROSTER DRAFTED, POSITION MISMATCHES (9-player config) ═══
    { name: 'F01', cfg: C9, players: [p('1', 'Batsman'), p('2', 'Batsman'), p('3', 'Batsman'), p('4', 'All Rounder'), p('5', 'Bowler'), p('6', 'Bowler'), p('7', 'Batsman'), p('8', 'Batsman'), p('9', 'Batsman'), p('b1', 'Batsman'), p('b2', 'Batsman')] },
    // F01: C9, 11 players, no WK. 6BAT+1AR+2BWL+2b

    { name: 'F02', cfg: C9, players: [p('1', 'Wicket Keeper'), p('2', 'Batsman'), p('3', 'Batsman'), p('4', 'Batsman'), p('5', 'Batsman'), p('6', 'Batsman'), p('7', 'Batsman'), p('8', 'Batsman'), p('9', 'Batsman'), p('b1', 'Batsman'), p('b2', 'Batsman')] },
    // F02: C9, 11 players, 1WK+10BAT, no BWL no AR

    { name: 'F03', cfg: C9, players: [p('1', 'Wicket Keeper'), p('2', 'Bowler'), p('3', 'Bowler'), p('4', 'Bowler'), p('5', 'Bowler'), p('6', 'All Rounder'), p('7', 'All Rounder'), p('8', 'All Rounder'), p('9', 'Batsman'), p('b1', 'Batsman'), p('b2', 'Bowler')] },
    // F03: C9, 1WK+1BAT+3AR+4BWL+1b(BAT)+1b(BWL). All mandatory met.

    { name: 'F04', cfg: C9, players: [p('1', 'All Rounder'), p('2', 'All Rounder'), p('3', 'All Rounder'), p('4', 'All Rounder'), p('5', 'All Rounder'), p('6', 'All Rounder'), p('7', 'All Rounder'), p('8', 'All Rounder'), p('9', 'All Rounder'), p('b1', 'All Rounder'), p('b2', 'All Rounder')] },
    // F04: C9, all AR. No WK, no BAT, no BWL.

    { name: 'F05', cfg: C9, players: [p('1', 'Wicket Keeper'), p('2', 'Batsman'), p('3', 'Batsman'), p('4', 'All Rounder'), p('5', 'Bowler'), p('6', 'Batsman'), p('7', 'Batsman'), p('8', 'Batsman'), p('9', 'Batsman'), p('b1', 'Batsman'), p('b2', 'Batsman')] },
    // F05: C9, 1WK+8BAT+1AR+1BWL. Missing 1 BWL.

    // ═══ FULL ROSTER DRAFTED, POSITION MISMATCHES (10-player config) ═══
    { name: 'F06', cfg: C10, players: [p('1', 'Wicket Keeper'), p('2', 'Batsman'), p('3', 'Batsman'), p('4', 'All Rounder'), p('5', 'All Rounder'), p('6', 'Bowler'), p('7', 'Bowler'), p('8', 'Bowler'), p('9', 'Batsman'), p('10', 'Batsman'), p('b1', 'Batsman'), p('b2', 'Batsman')] },
    // F06: C10, full 12-player roster, all mandatory met.

    { name: 'F07', cfg: C10, players: [p('1', 'Batsman'), p('2', 'Batsman'), p('3', 'Batsman'), p('4', 'Batsman'), p('5', 'All Rounder'), p('6', 'All Rounder'), p('7', 'Bowler'), p('8', 'Bowler'), p('9', 'Bowler'), p('10', 'Batsman'), p('b1', 'Batsman'), p('b2', 'Batsman')] },
    // F07: C10, no WK. full 12 players.

    { name: 'F08', cfg: C10, players: [p('1', 'Wicket Keeper'), p('2', 'Batsman'), p('3', 'Batsman'), p('4', 'Batsman'), p('5', 'Batsman'), p('6', 'Batsman'), p('7', 'Batsman'), p('8', 'Batsman'), p('9', 'Batsman'), p('10', 'Batsman'), p('b1', 'Batsman'), p('b2', 'Batsman')] },
    // F08: C10, 1WK+11BAT. No AR, no BWL.

    { name: 'F09', cfg: C10, players: [p('1', 'Bowler'), p('2', 'Bowler'), p('3', 'Bowler'), p('4', 'Bowler'), p('5', 'Bowler'), p('6', 'Bowler'), p('7', 'Bowler'), p('8', 'Bowler'), p('9', 'Bowler'), p('10', 'Bowler'), p('b1', 'Bowler'), p('b2', 'Bowler')] },
    // F09: C10, all bowlers. No WK, no BAT, no AR.

    { name: 'F10', cfg: C10, players: [p('1', 'Wicket Keeper'), p('2', 'Wicket Keeper'), p('3', 'Wicket Keeper'), p('4', 'All Rounder'), p('5', 'All Rounder'), p('6', 'Bowler'), p('7', 'Bowler'), p('8', 'Bowler'), p('9', 'Batsman'), p('10', 'Batsman'), p('b1', 'Batsman'), p('b2', 'Batsman')] },
    // F10: C10, 3WK+2BAT+2AR+3BWL+2b. Multiple WKs, all mandatory met.

    // ═══ FULL ROSTER, HEAVY BOWLING CONFIG (C10_HB) ═══
    { name: 'F11', cfg: C10_HB, players: [p('1', 'Wicket Keeper'), p('2', 'Batsman'), p('3', 'All Rounder'), p('4', 'Bowler'), p('5', 'Bowler'), p('6', 'Bowler'), p('7', 'Bowler'), p('8', 'Batsman'), p('9', 'Batsman'), p('10', 'Batsman'), p('b1', 'Batsman'), p('b2', 'Batsman')] },
    // F11: C10_HB, all mandatory met. 1WK+4BAT+1AR+4BWL+2b.

    { name: 'F12', cfg: C10_HB, players: [p('1', 'Wicket Keeper'), p('2', 'Batsman'), p('3', 'All Rounder'), p('4', 'Bowler'), p('5', 'Bowler'), p('6', 'Batsman'), p('7', 'Batsman'), p('8', 'Batsman'), p('9', 'Batsman'), p('10', 'Batsman'), p('b1', 'Batsman'), p('b2', 'Batsman')] },
    // F12: C10_HB, 1WK+7BAT+1AR+2BWL. Need 4 BWL, have 2. Unfilled=2.

    { name: 'F13', cfg: C10_HB, players: [p('1', 'Wicket Keeper'), p('2', 'Bowler'), p('3', 'Bowler'), p('4', 'Bowler'), p('5', 'Bowler'), p('6', 'Bowler'), p('7', 'Bowler'), p('8', 'Bowler'), p('9', 'Bowler'), p('10', 'All Rounder'), p('b1', 'Bowler'), p('b2', 'Bowler')] },
    // F13: C10_HB, 1WK+0BAT+1AR+8BWL+2b(BWL). Missing BAT slots.

    // ═══ FULL ROSTER, ZERO FLEX CONFIG (C9_ZF) ═══
    { name: 'F14', cfg: C9_ZF, players: [p('1', 'Wicket Keeper'), p('2', 'Batsman'), p('3', 'Batsman'), p('4', 'All Rounder'), p('5', 'All Rounder'), p('6', 'All Rounder'), p('7', 'Bowler'), p('8', 'Bowler'), p('9', 'Bowler'), p('b1', 'Batsman'), p('b2', 'Bowler')] },
    // F14: C9_ZF, perfect lineup. All 9 mandatory filled, 0 flex.

    { name: 'F15', cfg: C9_ZF, players: [p('1', 'Batsman'), p('2', 'Batsman'), p('3', 'Batsman'), p('4', 'All Rounder'), p('5', 'All Rounder'), p('6', 'All Rounder'), p('7', 'Bowler'), p('8', 'Bowler'), p('9', 'Bowler'), p('b1', 'Batsman'), p('b2', 'Bowler')] },
    // F15: C9_ZF, no WK. All else met.

    { name: 'F16', cfg: C9_ZF, players: [p('1', 'Wicket Keeper'), p('2', 'Batsman'), p('3', 'Batsman'), p('4', 'Batsman'), p('5', 'Batsman'), p('6', 'Batsman'), p('7', 'Bowler'), p('8', 'Bowler'), p('9', 'Bowler'), p('b1', 'Batsman'), p('b2', 'Bowler')] },
    // F16: C9_ZF, no AR (need 3). 1WK+5BAT+0AR+3BWL.

    // ═══ INTERNATIONAL LIMIT SCENARIOS ═══
    { name: 'I01', cfg: C9, players: [p('1', 'Wicket Keeper', true), p('2', 'Batsman', true), p('3', 'Batsman', true), p('4', 'All Rounder', true), p('5', 'Bowler', true), p('6', 'Bowler'), p('7', 'Batsman'), p('8', 'Batsman'), p('9', 'Batsman'), p('b1', 'Batsman'), p('b2', 'Batsman')] },
    // I01: C9 (max 4 intl), 5 intl players. 5th intl (BWL) gets benched.

    { name: 'I02', cfg: C9, players: [p('1', 'Batsman', true), p('2', 'Batsman', true), p('3', 'Batsman', true), p('4', 'Batsman', true), p('5', 'Wicket Keeper', true), p('6', 'Bowler'), p('7', 'Bowler'), p('8', 'All Rounder'), p('9', 'Batsman'), p('b1', 'Batsman'), p('b2', 'Batsman')] },
    // I02: C9, 5 intl. WK is 5th intl, gets skipped. + no WK unfilled.

    { name: 'I03', cfg: C10, players: [p('1', 'Wicket Keeper', true), p('2', 'Batsman', true), p('3', 'All Rounder', true), p('4', 'Bowler', true), p('5', 'Bowler', true), p('6', 'Bowler', true), p('7', 'All Rounder'), p('8', 'Batsman'), p('9', 'Batsman'), p('10', 'Batsman'), p('b1', 'Batsman'), p('b2', 'Batsman')] },
    // I03: C10, 6 intl but max 4. Two intl BWL get benched. May cause unfilled BWL.

    { name: 'I04', cfg: C10_LI, players: [p('1', 'Wicket Keeper', true), p('2', 'Batsman', true), p('3', 'Batsman', true), p('4', 'All Rounder'), p('5', 'All Rounder'), p('6', 'Bowler'), p('7', 'Bowler'), p('8', 'Bowler'), p('9', 'Batsman'), p('10', 'Batsman'), p('b1', 'Batsman'), p('b2', 'Batsman')] },
    // I04: C10 with maxIntl=2. 3 intl but max 2. 3rd intl BAT benched.

    { name: 'I05', cfg: C9, players: [p('1', 'Wicket Keeper', true), p('2', 'Batsman', true), p('3', 'Batsman', true), p('4', 'Batsman', true), p('5', 'Bowler', true), p('6', 'Bowler', true), p('7', 'All Rounder', true), p('8', 'Batsman', true), p('9', 'Batsman', true), p('b1', 'Batsman', true), p('b2', 'Batsman', true)] },
    // I05: C9, ALL 11 players intl! Only 4 can play.

    { name: 'I06', cfg: C9_LI, players: [p('1', 'Wicket Keeper', true), p('2', 'Batsman', true), p('3', 'Batsman'), p('4', 'All Rounder'), p('5', 'Bowler'), p('6', 'Bowler'), p('7', 'Batsman'), p('8', 'Batsman'), p('9', 'Batsman'), p('b1', 'Batsman'), p('b2', 'Batsman')] },
    // I06: C9 maxIntl=2. Exactly at limit. All should be fine.

    { name: 'I07', cfg: C10, players: [p('1', 'Bowler', true), p('2', 'Bowler', true), p('3', 'Bowler', true), p('4', 'Bowler', true), p('5', 'Bowler', true), p('6', 'Wicket Keeper'), p('7', 'Batsman'), p('8', 'Batsman'), p('9', 'All Rounder'), p('10', 'All Rounder'), p('b1', 'Batsman'), p('b2', 'Batsman')] },
    // I07: C10, 5 intl bowlers (max 4). Only 4 play. Need 3 BWL mandatory + flex?

    { name: 'I08', cfg: C10_HB, players: [p('1', 'Bowler', true), p('2', 'Bowler', true), p('3', 'Bowler', true), p('4', 'Bowler', true), p('5', 'Bowler', true), p('6', 'Wicket Keeper'), p('7', 'Batsman'), p('8', 'All Rounder'), p('9', 'Batsman'), p('10', 'Batsman'), p('b1', 'Batsman'), p('b2', 'Batsman')] },
    // I08: C10_HB need 4 BWL. 5 intl BWL (max 4). Need BWL, have 4 intl+0 domestic.

    { name: 'I09', cfg: C9, players: [p('1', 'Wicket Keeper', true), p('2', 'Wicket Keeper', true), p('3', 'Batsman', true), p('4', 'Batsman', true), p('5', 'All Rounder'), p('6', 'Bowler'), p('7', 'Bowler'), p('8', 'Batsman'), p('9', 'Batsman'), p('b1', 'Batsman'), p('b2', 'Batsman')] },
    // I09: C9, 2 intl WK + 2 intl BAT (=4 intl exactly at cap). All mandatory should be met.

    { name: 'I10', cfg: C10, players: [p('1', 'Wicket Keeper', true), p('2', 'All Rounder', true), p('3', 'All Rounder', true), p('4', 'All Rounder', true), p('5', 'Bowler', true), p('6', 'Batsman'), p('7', 'Batsman'), p('8', 'Bowler'), p('9', 'Bowler'), p('10', 'Batsman'), p('b1', 'Batsman'), p('b2', 'Batsman')] },
    // I10: C10, 5 intl. AR3 is 5th intl, gets benched. Only 1 AR domestic available for 2 AR slots.

    { name: 'I11', cfg: C9, players: [p('1', 'Batsman', true), p('2', 'Bowler', true), p('3', 'All Rounder', true), p('4', 'Wicket Keeper', true), p('5', 'Batsman', true), p('6', 'Bowler'), p('7', 'Batsman'), p('8', 'Batsman'), p('9', 'Batsman'), p('b1', 'Batsman'), p('b2', 'Batsman')] },
    // I11: C9, 5 intl. 5th intl (BAT) benched. 4 intl fill WK,BAT,AR,BWL. + domestic BWL fills 2nd BWL.

    // ═══ MIXED SCENARIOS — 8-PLAYER CONFIG ═══
    { name: 'M01', cfg: C8, players: [p('1', 'Wicket Keeper'), p('2', 'Batsman'), p('3', 'All Rounder'), p('4', 'Bowler'), p('5', 'Bowler'), p('6', 'All Rounder'), p('7', 'All Rounder'), p('8', 'Batsman'), p('9', 'Bowler')] },
    // M01: C8, perfect + all mandatory met. 1WK+2BAT+3AR+3BWL = 9 players.

    { name: 'M02', cfg: C8, players: [p('1', 'Bowler'), p('2', 'Bowler'), p('3', 'Bowler'), p('4', 'Bowler'), p('5', 'Bowler'), p('6', 'Bowler'), p('7', 'Bowler'), p('8', 'Bowler'), p('9', 'Bowler')] },
    // M02: C8, all bowlers. No WK, no BAT, no AR.

    { name: 'M03', cfg: C8, players: [p('1', 'Wicket Keeper'), p('2', 'Wicket Keeper'), p('3', 'Wicket Keeper'), p('4', 'Bowler'), p('5', 'Bowler'), p('6', 'All Rounder'), p('7', 'Batsman'), p('8', 'Batsman'), p('9', 'Batsman')] },
    // M03: C8, 3 WK (1 fills WK, 2 fill BAT slots). All mandatory met.

    { name: 'M04', cfg: C8_NW, players: [p('1', 'Batsman'), p('2', 'Batsman'), p('3', 'Batsman'), p('4', 'Bowler'), p('5', 'Bowler'), p('6', 'All Rounder'), p('7', 'Batsman'), p('8', 'Batsman'), p('9', 'Batsman')] },
    // M04: C8_NW (no WK req). All mandatory met. 6BAT+1AR+2BWL.

    { name: 'M05', cfg: C8_MIN, players: [p('1', 'Batsman'), p('2', 'Batsman'), p('3', 'Batsman'), p('4', 'Batsman'), p('5', 'Batsman'), p('6', 'Batsman'), p('7', 'Batsman'), p('8', 'Batsman'), p('9', 'Batsman')] },
    // M05: C8_MIN (very lax reqs, no WK). All batsmen. Need 1 BWL + 1 AR.

    { name: 'M06', cfg: C8_MIN, players: [p('1', 'All Rounder'), p('2', 'All Rounder'), p('3', 'All Rounder'), p('4', 'All Rounder'), p('5', 'All Rounder'), p('6', 'All Rounder'), p('7', 'All Rounder'), p('8', 'All Rounder'), p('9', 'All Rounder')] },
    // M06: C8_MIN, all AR. AR fills AR mandatory. No BAT slot, no BWL slot.

    { name: 'M07', cfg: C8, players: [p('1', 'Wicket Keeper'), p('2', 'Batsman'), p('3', 'All Rounder'), p('4', 'Bowler'), p('5', 'Bowler'), p('6', 'Batsman'), p('7', 'All Rounder'), p('8', 'All Rounder')] },
    // M07: C8, exactly 8 players, all mandatory met. No bench.

    { name: 'M08', cfg: C8, players: [p('1', 'Wicket Keeper', true), p('2', 'Batsman', true), p('3', 'All Rounder', true), p('4', 'Bowler', true), p('5', 'Bowler', true), p('6', 'Batsman'), p('7', 'All Rounder'), p('8', 'All Rounder'), p('9', 'Batsman')] },
    // M08: C8, 5 intl but max 4. 5th intl BWL benched. 1 unfilled BWL.

    // ═══ MIXED SCENARIOS — 10-PLAYER CONFIG ═══
    { name: 'M09', cfg: C10, players: [p('1', 'Wicket Keeper'), p('2', 'Batsman'), p('3', 'Batsman'), p('4', 'All Rounder'), p('5', 'All Rounder'), p('6', 'Bowler'), p('7', 'Bowler'), p('8', 'Bowler'), p('9', 'All Rounder'), p('10', 'All Rounder'), p('b1', 'All Rounder'), p('b2', 'All Rounder')] },
    // M09: C10, all mandatory met, many AR.

    { name: 'M10', cfg: C10, players: [p('1', 'Wicket Keeper'), p('2', 'Wicket Keeper'), p('3', 'Wicket Keeper'), p('4', 'Wicket Keeper'), p('5', 'All Rounder'), p('6', 'All Rounder'), p('7', 'Bowler'), p('8', 'Bowler'), p('9', 'Bowler'), p('10', 'Batsman'), p('b1', 'Batsman'), p('b2', 'Batsman')] },
    // M10: C10, 4 WKs. 1 fills WK, extras fill BAT slots.

    { name: 'M11', cfg: C10, players: [p('1', 'Wicket Keeper'), p('2', 'Batsman'), p('3', 'Batsman'), p('4', 'All Rounder'), p('5', 'Bowler'), p('6', 'Bowler'), p('7', 'Bowler'), p('8', 'Batsman'), p('9', 'Batsman'), p('10', 'Batsman'), p('b1', 'Batsman'), p('b2', 'Batsman')] },
    // M11: C10, 1WK+6BAT+1AR+3BWL+2b. Missing 1 AR (need 2).

    { name: 'M12', cfg: C10, players: [p('1', 'Wicket Keeper'), p('2', 'Batsman'), p('3', 'Batsman'), p('4', 'Batsman'), p('5', 'Batsman'), p('6', 'Batsman'), p('7', 'Bowler'), p('8', 'Bowler'), p('9', 'Bowler'), p('10', 'Batsman'), p('b1', 'Batsman'), p('b2', 'Batsman')] },
    // M12: C10, WK+8BAT+3BWL+2b. No AR at all (need 2).

    // ═══ MIXED SCENARIOS — 11-PLAYER CONFIG ═══
    { name: 'M13', cfg: C11, players: [p('1', 'Wicket Keeper'), p('2', 'Batsman'), p('3', 'Batsman'), p('4', 'Batsman'), p('5', 'All Rounder'), p('6', 'All Rounder'), p('7', 'Bowler'), p('8', 'Bowler'), p('9', 'Bowler'), p('10', 'Batsman'), p('11', 'All Rounder'), p('b1', 'Batsman'), p('b2', 'Batsman'), p('b3', 'Batsman')] },
    // M13: C11, perfect. All mandatory met.

    { name: 'M14', cfg: C11, players: [p('1', 'Wicket Keeper'), p('2', 'Batsman'), p('3', 'Batsman'), p('4', 'Batsman'), p('5', 'Batsman'), p('6', 'Batsman'), p('7', 'Batsman'), p('8', 'Batsman'), p('9', 'Batsman'), p('10', 'Batsman'), p('11', 'Batsman'), p('b1', 'Batsman'), p('b2', 'Batsman'), p('b3', 'Batsman')] },
    // M14: C11, WK+13BAT! No AR, no BWL.

    { name: 'M15', cfg: C11, players: Array.from({ length: 14 }, (_, i) => p(`bwl${i}`, 'Bowler')) },
    // M15: C11, all 14 bowlers.

    { name: 'M16', cfg: C11, players: [p('1', 'Wicket Keeper', true), p('2', 'Batsman', true), p('3', 'Batsman', true), p('4', 'All Rounder', true), p('5', 'All Rounder', true), p('6', 'Bowler', true), p('7', 'Bowler'), p('8', 'Bowler'), p('9', 'Batsman'), p('10', 'Batsman'), p('11', 'Batsman'), p('b1', 'Batsman'), p('b2', 'Batsman'), p('b3', 'Batsman')] },
    // M16: C11, 6 intl (max 4). 5th+6th intl get benched.

    { name: 'M17', cfg: C11, players: [p('1', 'Wicket Keeper'), p('2', 'Batsman'), p('3', 'Batsman'), p('4', 'All Rounder'), p('5', 'All Rounder'), p('6', 'Bowler'), p('7', 'Bowler'), p('8', 'Bowler'), p('9', 'All Rounder'), p('10', 'Batsman'), p('11', 'Bowler'), p('b1', 'All Rounder'), p('b2', 'Batsman'), p('b3', 'Bowler')] },
    // M17: C11, rich roster. All mandatory met, varied roles.

    // ═══ EDGE CASES ═══
    { name: 'E01', cfg: C9, players: [p('1', 'Wicket Keeper'), p('2', 'Batsman'), p('3', 'Batsman'), p('4', 'All Rounder'), p('5', 'Bowler'), p('6', 'Bowler'), p('7', 'Batsman'), p('8', 'Batsman'), p('9', 'Batsman')] },
    // E01: C9, exactly 9 players = activeSize, all mandatory met, no bench.

    { name: 'E02', cfg: C10, players: [p('1', 'Wicket Keeper'), p('2', 'Batsman'), p('3', 'Batsman'), p('4', 'All Rounder'), p('5', 'All Rounder'), p('6', 'Bowler'), p('7', 'Bowler'), p('8', 'Bowler'), p('9', 'Batsman'), p('10', 'All Rounder')] },
    // E02: C10, exactly 10 players = activeSize, all mandatory met, no bench.

    { name: 'E03', cfg: C9, players: [p('1', 'Wicket Keeper'), p('2', 'All Rounder'), p('3', 'Bowler'), p('4', 'Bowler')] },
    // E03: C9, only 4 players. Many unfilled. All should stay active.

    { name: 'E04', cfg: C10, players: [p('1', 'Bowler')] },
    // E04: C10, single player.

    { name: 'E05', cfg: C9_ZF, players: [p('1', 'Wicket Keeper'), p('2', 'Batsman'), p('3', 'Batsman'), p('4', 'All Rounder'), p('5', 'All Rounder'), p('6', 'All Rounder'), p('7', 'Bowler'), p('8', 'Bowler'), p('9', 'Bowler'), p('b1', 'Batsman'), p('b2', 'Bowler'), p('b3', 'All Rounder')] },
    // E05: C9_ZF, 12 players, all mandatory met. Extras overflow to bench. 0 flex means 9 active.

    { name: 'E06', cfg: C9, players: [p('1', 'Wicket Keeper', true), p('2', 'Batsman', true), p('3', 'Batsman', true), p('4', 'Batsman', true), p('5', 'All Rounder'), p('6', 'Bowler'), p('7', 'Bowler'), p('8', 'Batsman'), p('9', 'Batsman'), p('b1', 'Batsman'), p('b2', 'Batsman')] },
    // E06: C9, exactly 4 intl, at limit. All mandatory met.

    { name: 'E07', cfg: C10_HB, players: [p('1', 'Wicket Keeper'), p('2', 'Batsman'), p('3', 'All Rounder'), p('4', 'Bowler'), p('5', 'Bowler'), p('6', 'Bowler'), p('7', 'Bowler'), p('8', 'Bowler'), p('9', 'Bowler'), p('10', 'Bowler'), p('b1', 'Bowler'), p('b2', 'Bowler')] },
    // E07: C10_HB, surplus bowlers. 1WK+1BAT+1AR+7BWL+2b(BWL). All mandatory met.

    { name: 'E08', cfg: C10, players: [p('1', 'Wicket Keeper'), p('2', 'Batsman'), p('3', 'Batsman'), p('4', 'All Rounder'), p('5', 'All Rounder'), p('6', 'Bowler'), p('7', 'Bowler'), p('8', 'Bowler'), p('9', 'Batsman', true), p('10', 'Batsman', true), p('b1', 'Batsman', true), p('b2', 'Batsman', true)] },
    // E08: C10, mix of domestic mandatory + intl flex. 4 intl BAT, 2 fill flex. All mandatory met.
];

for (const s of scenarios) {
    const { active, bench } = buildOptimalActive11(s.players, s.cfg);
    const intlA = active.filter(x => x.isInternational).length;
    console.log(`${s.name}: active=${active.length} bench=${bench.length} intlActive=${intlA} total=${active.length + bench.length} active=[${active.map(x => x.id + ':' + x.role + (x.isInternational ? '*' : '')).join(',')}] bench=[${bench.map(x => x.id + ':' + x.role + (x.isInternational ? '*' : '')).join(',')}]`);
}

# Roster Slot Verification Table

The roster validation logic has been verified against **79 test scenarios** across 10+ league configurations.

## Core Rule: Effective Capacity
Unfilled mandatory slots reduce the **display capacity** but do not displace players 1:1.
```typescript
effectiveCapacity = activeSize − unfilledMandatory
toDisplace = max(0, preActiveCount − effectiveCapacity)
```
*This ensures players in valid All Rounder or Flex slots remain **Active** even if other roles (like Wicket Keeper) are missing.*

---

## 79-Scenario Test Matrix

All tests pass ✅ in [roster-validation.test.ts](file:///Users/abhiramdevarapalli/fantasy-league-manager/src/lib/roster-validation.test.ts).

### 1. Baseline Scenarios (S01-S26)
*Covers 8-player and 11-player standard configs with varied missing roles.*

| ID | Config | Scenario | Unfilled | Active | Bench |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **S01** | STD | Perfect 14 | 0 | 11 | 3 |
| **S16** | STD | All mandatory missing except AR | 7 | 4 | 10 |
| **S20** | S8 | 3 ARs only | 4 | 3 | 0 |

### 2. Full Roster Mismatches (F01-F16)
*Scenarios where a full roster (11-14) is drafted but with the wrong positional mix.*

| ID | Config | Scenario | Unfilled | Active | Bench |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **F01** | S9 | No WK (6B+1A+2BWL) | 1 | 8 | 3 |
| **F04** | S9 | All All Rounders (11) | 5 | 4 | 7 |
| **F12** | C10_HB | Missing 2 Bowlers | 2 | 8 | 4 |
| **F14** | C9_ZF | Perfect Lineup (Zero Flex) | 0 | 9 | 2 |
| **M15** | C11 | All Bowlers (14) | 6 | 5 | 9 |

### 3. International Limit Interactions (I01-I11)
*Interaction between `maxInternational` and mandatory positional requirements.*

| ID | Config | Scenario | Unfilled | Active | Intl Active |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **I01** | S9 | 5 intl (max 4), 1 benched | 0 | 8 | 4 |
| **I02** | S9 | WK is 5th intl (benched) | 1 | 8 | 4 |
| **I05** | S9 | All 11 players are international | 5 | 4 | 4 |
| **I07** | C10 | 5 intl bowlers (max 4) | 0 | 10 | 4 |

### 4. Boundary & Edge Cases (E01-E08)
*Empty rosters, exact capacity, and surplus roles.*

| ID | Config | Scenario | Active | Result |
| :--- | :--- | :--- | :--- | :--- |
| **E01** | S9 | Exactly 9 players drafted | 9 | Pass |
| **E03** | S9 | Only 4 players drafted | 4 | Pass |
| **E08** | C10 | Intl flexibility / Domestic mandatory | 10 | Pass |

---

## Verification Run Status
```bash
npx vitest run src/lib/roster-validation.test.ts
```
**Status:** `79 passed (79)` ✅

## Key Observations
- **Bench Overflow**: The bench correctly exceeds `benchSize` when players are displaced due to unfilled mandatory slots, keeping the total roster count intact.
- **Role Prioritization**: Mandatory roles are always filled before Flex slots, ensuring the "Best 11" logic follows league rules.
- **Lax Configs**: Validated that `requireWk=false` correctly removes the WK penalty while maintaining other positional minimums.

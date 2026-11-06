# Deposit presence & anti-fraud brainstorm

**Plan / critique only — no implementation.**  
**Date context:** Aug 9, 2026  

Companion to [`deposit-escrow-payment-plan.md`](./deposit-escrow-payment-plan.md) (money rails) and [`app-store-release-plan.md`](./app-store-release-plan.md) (store payments decision). This doc **challenges** a proposed GPS presence rule for validating FirmShakes and brainstorms how bad actors game deposits.

---

## Repo facts (what exists today)

| Area | Today |
|---|---|
| Deposit amount | `$10` (`MEETUP_DEPOSIT_AMOUNT`) — UX only; payment is **mock** |
| Agreement states | `proposed` → `accepted` → `deposit_paid` → `en_route` → `completed` \| `no_show_*` \| `cancelled` |
| Location during meetup | `locationTracking.ts` polls ~**60s**, posts coords for **ETA / progress** on `MeetupPage` — **not** a presence oracle |
| Presence / check-in | **None** — no 15 ft rule, no dwell timer, no QR handshake, no mutual “I see you” |
| Money | Mock `deposit_paid`; Stripe Checkout stub exists on API; no escrow release / 50-50 split yet |
| Product promise (landing) | Broken FirmShake → offended party gets **50%** of deposit |

**Implication:** Moving to **real deposits in v1** is a money + dispute problem first. A 15 ft / 5 min GPS rule is a **new oracle** that does not exist in code and should not be treated as ready-to-ship truth.

---

## A. Intended incentive (restate)

| Goal | Mechanism (proposed) |
|---|---|
| Buyer shows up at the agreed place/time | Buyer stakes a **deposit**; forfeits (partially) on no-show |
| Prove presence so deposit can settle fairly | Both devices within **~15 feet** for **~5 minutes** → FirmShake “valid” / complete |
| Deter casual flake | Economic stake + presence gate before claim/settle |

**What is sound:** Aligning money with **show-up obligation** is the right core product. A small, clear deposit ($10 today) plus a 50/50 split when the deal is broken matches landing copy and creates a reason to keep the appointment.

**What is not yet sound:** Treating **phone GPS proximity** as the sole or primary proof that both humans met. That turns a hard social/legal question (“who showed up?”) into a soft sensor problem that attackers and noise both break.

---

## B. Challenge: will 15 ft + 5 min work?

**Short answer: not as a sole oracle.** It can be a *supporting signal*, not the judge.

### GPS accuracy vs 15 feet

- **15 ft ≈ 4.5 m.** Consumer GNSS outdoors is often **±5–15 m** under good sky; urban canyons, parking structures, malls, apartments push error to **tens of meters**.
- “Both devices report within 15 ft” often means **both phones are guessing in the same error blob**, not that bodies are within arm’s reach.
- Wi‑Fi / cell assist improves *city-level* fixes; it does **not** reliably deliver sub-5 m truth indoors.
- **False negatives:** honest meetups fail the window (indoor meetup, seller in doorway, buyer in car). Support load + angry “I was there!” disputes.
- **False positives:** two people a block apart, or one spoofed fix, can still land inside a loose radius if you widen the threshold to reduce false negatives — which then fails the anti-gaming goal.

### Battery, background, and OS limits

- Today’s client polls **once per minute while the meetup screen is active** — nowhere near continuous 5-minute high-accuracy ranging.
- **iOS** aggressively limits background location; “when in use” is the honest App Store posture (see app-store plan). A 5-minute continuous proximity window may require the app **foregrounded** on both sides — fragile UX.
- Users who lock the phone, switch to Maps, or deny precise location break the oracle even when they showed up.

### Clock sync and who starts the timer

- Device clocks drift; “5 continuous minutes” needs a **server clock** and defined start rule.
- Who starts? First mutual proximity sample? Scheduled `meetupAt`? Either party can game start/stop by toggling location permission.
- Gaps: one party walks to the bathroom for 90 seconds — does the window reset? Any rule here is either gameable or unfair to normals.

### Collusion and thin presence

- Buyer + seller both present for 5 minutes to unlock “completed,” then dispute item condition / non-delivery outside the deposit model (deposit was only for **show-up**, not item quality).
- Completing proximity does not prove **goods exchanged** or **correct listing** — only that phones were (claimed) near each other.

### Remote spoofing

- Fake GPS apps, developer mock locations, rooted/jailbroken devices, emulators, and some MDM/dev builds can report arbitrary lat/lng.
- Client-reported coordinates are **untrusted input**. Server can store them for audit; it cannot treat them as cryptographic truth.
- Pairwise spoofing: attacker sets both devices (or one real + one virtual) to the same pin for 5 minutes.

### Proxy attendance

- Send a friend with the phone; deposit “presence” succeeds without the contracting party.
- Seller’s roommate stands near the pin while seller is elsewhere.
- GPS (and even BT ranging) proves **device**, not **identity**.

### Verdict on the proposed rule

| Claim | Assessment |
|---|---|
| Deposit deters buyer no-shows | **Sound** if money is real and outcomes are enforced |
| 15 ft + 5 min GPS = valid FirmShake | **Weak** — below reliable GPS precision; spoofable; high false fail |
| Presence near owner *or* promised spot | Spot geofence is more operable than pairwise 15 ft; still not identity |

---

## C. Buyer gaming vectors

| Vector | How it works | Why GPS-15ft doesn’t stop it |
|---|---|---|
| Deposit as harassment | Pay $10, book seller’s evening, ghost, then claim **seller** no-show | Outcome depends on who wins the evidence fight; GPS noise favors whoever writes the narrative first |
| Minimal / spoofed presence | Arrive briefly, spoof dwell, leave | 5 min of spoofed crumbs looks like compliance |
| Chargeback after “completed” | Card dispute after refund/release | Payment risk; location logs help Stripe evidence but don’t prevent the dispute |
| Multi-account | New buyer accounts burn sellers / farm refunds | Need velocity + device binding, not meters |
| Location off until claim | Deny location during meetup; later assert seller never came | Asymmetric: seller may have crumbs, buyer claims blindness |
| Agree to bad pin, then blame seller | Accept absurd meetup spot, no-show, dispute | Process / reputation issue |

**Economic note:** At **$10**, some buyers will treat the deposit as a cheap option on the seller’s time. Presence theater does not change that math; **reputation + cancel windows + caps** do.

---

## D. Seller gaming vectors (deep dive)

This is the sharp edge: **buyer has money locked; seller often has location-setting power and symmetric claim buttons.**

### 1. Seller no-shows, claims buyer didn’t come

- If either party can unilaterally mark `no_show_*`, the seller can file first after the window.
- If settlement keys off “buyer never entered 15 ft of me,” the seller simply **never enables** accurate location, stands slightly away, or spoofs elsewhere.
- Buyer’s crumbs near the **agreed pin** may be the only honest signal — which is why **pin geofence + schedule** beats pairwise distance to seller’s live phone.

### 2. Impossible or hostile meetup location

- Seller accepts then moves the pin (if editable) to a gated / closed / unsafe spot.
- Seller sets pin correctly but waits at a different entrance; buyer GPS looks “wrong.”
- Mitigation is product: lock pin after `deposit_paid`, require mutual pin change, time-box edits.

### 3. Stand just outside the radius (the “16 ft” attack)

- Classic oracle attack: stay **just outside** the threshold so buyer never “validates,” then claim buyer no-show or keep leverage.
- With GPS error, “16 ft” is indistinguishable from “8 ft.” A sharp 15 ft cutoff is **theater**.
- Widening to 100–300 ft reduces this attack but also reduces presence meaning — again showing GPS alone is the wrong primary proof.

### 4. Cancel / stall after deposit locked

- Seller cancels late; buyer’s Saturday is burned; refund policy unclear.
- Seller delays `en_route` / check-in until buyer’s window expires.
- Need clear **cancel cutoffs**, fees, and who can cancel after `deposit_paid` (see escrow plan decisions).

### 5. Collusion / alt accounts / deposit farming

- Seller’s alt “buyer” pays deposit → proximity complete with second phone in the same house → refund on “completed” (wash) **or** trigger seller-no-show to extract **50% compensation** to a Connect account (if payouts exist).
- At $10 this is small-dollar fraud / bonus hunting; at higher deposits or automated volume it becomes laundry-shaped.
- Signals: shared devices, shared payment instruments, same Wi‑Fi/IP, rapid cycles, new accounts paying each other.

### 6. Second device as the “buyer”

- Seller brings two phones; completes mutual proximity alone; marks buyer no-show on the real buyer’s agreement — or completes a fake agreement.
- Pairwise GPS/BT between “two parties” fails if both devices are seller-controlled.
- Needs **identity** (account risk) + **handshake that requires two UIs the real humans operate** (QR scan of server-issued nonces), not only two GPS streams.

### 7. Selective location sharing

- Seller shares location only when it helps a claim; disables precise location when buyer approaches.
- ETA UX already tells users the other party sees progress **not** raw coords — good for privacy, bad if you later pretend GPS was bilateral proof.

### Seller-side bottom line

**Buyer-only deposits + GPS proximity oracle skews power toward a strategic seller** who controls the pin, can withhold or spoof location, and can exploit inconclusive evidence. Without (a) a strong bilateral handshake, (b) a default that does **not** automatically pay the seller on ambiguity, and (c) reputation/velocity controls, seller gaming is rational.

---

## E. Signals to detect bad actors

Evaluate each for **cost, privacy, and false positives**. Prefer stacking weak signals over one brittle rule.

### Presence proof

| Signal | Strength | Cost / privacy | False positives |
|---|---|---|---|
| Absolute GPS pairwise ≤15 ft | Weak | Medium (always-on precise location) | High indoors / urban |
| Geofence both devices near **agreed pin** (e.g. 100–200 m) within scheduled window | Medium support | Medium | Medium (parking, large venues) |
| Bluetooth RSSI / UWB relative ranging | Stronger *when available* | High (permissions, OEM variance) | Medium; Android/iOS fragmentation |
| **One-time QR / code handshake** (each scans or confirms server nonce) | **Strong for “both apps operated at meetup”** | Low–medium | Low if UX clear |
| Dual in-app “I see the other party” during window | Medium (social, not crypto) | Low | Collusion / mis-tap |
| Photo check-in | Weak–medium | High privacy / moderation | Lighting, fakes, creepy UX |
| Server location crumbs (hashed / coarse for ops) | Audit only | Privacy-sensitive; retain carefully | N/A (evidence, not auto-judge) |

**Challenge:** BT/UWB is uneven across devices; don’t make it required for v1. **QR (or typed one-time code) is the practical “FirmShake” ritual** — it matches the brand better than silent GPS.

### Reputation

| Signal | Use |
|---|---|
| Completed meetup rate / no-show rate | Soft limits after patterns |
| Dispute rate & lost-dispute rate | Cool-downs, deposit caps |
| Account age, profile completeness, MFA | Progressive trust |
| Graph: same device / payment instrument across “opponents” | Collusion detection |
| Block / report history | Already have blocks — feed risk |

**Challenge:** Cold-start users look like fraud; too-aggressive blocks kill marketplace liquidity. Prefer **limits** (concurrent escrows, max $/day) over instant bans.

### Economic

| Control | Use |
|---|---|
| Real Stripe escrow + delayed payout | Chargeback buffer (escrow plan) |
| Velocity: max open deposits, max deposits/day | Stops farming |
| New account lower limits / higher scrutiny | Progressive trust |
| Optional **seller stake** on high-risk meetups | Reduces seller no-show / false claims (product tradeoff) |
| Cancel windows & fees after `deposit_paid` | Stops late bait-and-cancel |

**Challenge:** Seller deposits add friction; may be phase-2. Asymmetric buyer-only deposits need **asymmetric defaults** that don’t auto-reward seller on noise.

### Device integrity

| Signal | Use |
|---|---|
| Detect mock-location flags where OS exposes them | Soft risk score, not hard ban (bypassable) |
| Block obvious emulators for deposit-releasing flows | Imperfect |
| Bind risk to device + payment instrument | Multi-account |

**Challenge:** Determined attackers bypass client integrity. Treat as **signal**, never sole deny.

### Dispute process

| Element | Why it matters |
|---|---|
| Evidence package: schedule, pin, crumb timeline, handshake events, chat excerpts | Chargebacks + human review |
| Time-boxed claim window after `meetupAt` | Stops weeks-later warfare |
| **Default on inconclusive evidence** (product decision) | Prevents “first to claim wins” |
| Human review for $ amounts / repeat disputers | $10 may be auto-rules; repeat abuse needs eyes |
| Cool-down after lost dispute | Deterrence |

**Challenge:** Founder-inbox ops don’t scale; automate defaults early, escalate repeats.

---

## F. Recommended direction (opinionated)

**Keep the deposit incentive. Do not ship GPS-only 15 ft / 5 min as the definition of a valid FirmShake.**

### Layered model

1. **Economic stake (required for “real deposits”)**  
   Stripe capture + internal escrow ledger; webhook-only `deposit_paid`; release/split server-side — per [`deposit-escrow-payment-plan.md`](./deposit-escrow-payment-plan.md).

2. **Scheduled window + geofence to agreed pin (supporting)**  
   Both parties expected near the **locked meetup pin** in a window around `meetupAt` (± grace). Use generous radius (order of **~100 m+**, not 15 ft). Crumbs support disputes; they do not auto-forfeit alone.

3. **Strong handshake as primary “FirmShake valid”**  
   Server-issued **one-time QR or code**: both parties complete in-app during the window → eligible for `completed` / full buyer refund (or your chosen complete policy). This is presence of **two willing app operators**, which matches “we met” better than GNSS.

4. **GPS / BT as supporting evidence only**  
   ETA (already built), optional geofence badges, optional BT ranging later. Never the sole switch that moves money.

5. **Clear defaults when evidence conflicts**  
   Example policy to debate (not gospel):  
   - Mutual handshake → complete / refund deposit.  
   - Neither handshake + neither credible pin presence → **full refund to buyer** (platform does not enrich on ambiguity); optional small cancel fee later.  
   - One-sided claim only → enter `disputed` / evidence window; **no instant 50% payout**.  
   - Proven one-sided pin presence + other silent → lean toward no-show of the silent party **after** grace, with appeal.  
   The exact default is an open decision — but **“seller wins on GPS fail” is the wrong default.**

6. **Reputation + velocity**  
   Caps on concurrent escrows; new-account limits; cool-downs; Connect KYC before compensation payouts; delay payouts for chargeback buffer.

### Where the user’s idea is right vs wrong

| Right | Wrong / premature |
|---|---|
| Real deposits in v1 if the product promise is trust | Mock framing can stay for *store review* tactics, but product intent is live money — that raises the fraud bar |
| Need *some* presence notion to settle fairly | **15 ft GPS for 5 min** as the validity definition |
| Anti-gaming intent (can’t claim without showing up) | Absolute GNSS as anti-gaming control |
| Buyer show-up obligation | Ignoring seller-side gaming and inconclusive defaults |

---

## G. Open decisions for the user

Resolve before coding presence or releasing live deposits:

1. **Inconclusive default** — Full refund to buyer, split platform/buyer, hold for review, or other? (Most important anti-seller-gaming lever.)
2. **Primary completion proof** — QR/code handshake vs mutual “confirm complete” buttons vs GPS dwell (recommend QR/code + mutual confirm; GPS support only).
3. **Seller deposit?** — Never / optional / required after N buyer no-show claims against them?
4. **Who can file `no_show_*`?** — Unilateral with delay, mutual only, or system-timeout only?
5. **Radius & window** — If geofence used: meters and ± minutes around `meetupAt`; indoor venues policy.
6. **Complete = full refund?** — Confirm escrow plan decision #3 with presence rules.
7. **Cancel after `deposit_paid`** — Cutoff before `meetupAt`; fee; who initiates.
8. **Payout delay** for 50% compensation (chargebacks).
9. **Ops** — Who reviews disputes in v1; SLA; auto vs manual threshold ($ and repeat count).
10. **Privacy** — Retention of location crumbs; what appears in user-facing dispute UI vs admin-only.
11. **v1 money** — Confirm abandoning “mock deposits for App Store v1” as product intent; if live money ships, Stripe Phase B/C from escrow plan become launch blockers.

---

## H. v1 scope note (real deposits desired)

**Product shift:** Prior docs preferred mock deposits for App Store v1 or waiting on Stripe. **Current intent: real deposits in v1.** That means escrow Phase B (capture) and a minimal Phase C (release / no-show split) are on the critical path — not a post-1.0 nice-to-have.

### Minimum anti-fraud bar for first **paid** deposit release

Ship-with-money floor (do not skip):

- [ ] Webhook-only `deposit_paid`; no client-trusted payment success.
- [ ] Escrow hold + **server** outcomes: complete → refund; no-show → 50/50 per Terms; cancel policy documented.
- [ ] **Bilateral completion** path (mutual confirm and/or QR) — not GPS auto-complete.
- [ ] **No instant compensation** on unilateral no-show without grace / evidence window.
- [ ] Explicit **default on timeout / inconclusive** (recommend buyer refund for v1 simplicity).
- [ ] Velocity caps: concurrent escrows, deposits/day, new-account limits.
- [ ] Stripe Radar / 3DS as appropriate; freeze on `charge.dispute.created`.
- [ ] Connect KYC before any compensation payout; payout delay buffer.
- [ ] Terms / Privacy / App Store review notes match live money + location use.
- [ ] Basic audit log: agreement transitions, deposit ids, handshake events (location crumbs optional, admin-only).

### Can wait until 1.1+

- 15 ft / 5 min continuous proximity engine.
- UWB / Bluetooth ranging.
- Full trust scores / graph collusion ML.
- Photo check-in.
- Seller deposits.
- Rich map timeline playback UI (keep raw crumbs admin-side first).
- Wallet top-up / Venmo rails.

### App Store implication

Live deposits increase review and compliance surface (Privacy nutrition, Terms, physical-goods payment justification). Mock is easier for *review logistics*; **live** is what you want for product — budget Stripe + dispute defaults before calling v1 “done.”

---

## Related docs

| Doc | Relevance |
|---|---|
| [`deposit-escrow-payment-plan.md`](./deposit-escrow-payment-plan.md) | Stripe escrow, 50/50 split, chargebacks |
| [`app-store-release-plan.md`](./app-store-release-plan.md) | Store payments decision #6; location privacy |
| [`MILESTONES.md`](./MILESTONES.md) | Phase 6 deposits / penalties |
| Landing / design | Offended party **50%** compensation copy |

---

## One-line summary

**Deposits for show-up are the right incentive; GPS-only 15 ft × 5 min is a weak, gameable oracle — especially for seller-side attacks. Validate FirmShakes with money + schedule/pin + bilateral handshake, use location as evidence, and pick an explicit default when evidence is inconclusive.**

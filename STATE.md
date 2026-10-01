# SmartBet Frontend — Application State & Architecture Specification

> **Status:** Production Ready / Active Development  
> **Framework:** Angular 20 (Standalone Components + Signals)  
> **Styling:** Custom SCSS + Dark Glassmorphic Design System  
> **Graphics Engine:** Custom HTML5 Canvas 2D Rendering Engine (60 FPS + Particle Physics)  
> **Last Verified Production Build:** `ng build` — 0 Errors, 491.51 kB raw bundle (114.48 kB gzipped)

---

## 1. Executive Summary & UI Architecture

The **SmartBet Frontend** (`smartbet-aviator-frontend`) is a web client delivering the classic Aviator multiplayer experience. It communicates with the .NET 10 SignalR backend via high-speed WebSockets, rendering smooth flight trajectories, real-time multiplier counters, dual betting control panels, a multiplayer leaderboard strip, and full South African / global payment gateway interfaces.

```
 ┌──────────────────────────────────────────────────────────────────┐
 │                     SmartBet Angular App                         │
 ├──────────────────────────────────────────────────────────────────┤
 │ AppComponent (Root Host & Layout)                                │
 │  └── AviatorGameComponent (Primary Arena)                         │
 │       ├── Header Navigation (Brand, Live Time, Balance, Profile) │
 │       ├── History Multiplier Strip (Last 20 Multipliers + Modal) │
 │       ├── HTML5 Canvas Arena (Aircraft, Curve, Particles, 60FPS) │
 │       ├── Dual Betting Panels (Quick Wagers, Auto-Cashout)       │
 │       ├── Live Multiplayer Bets Board (All / My Bets / Top Wins) │
 │       ├── AuthModalComponent (Login, Register, Forgot Password)  │
 │       ├── DepositModalComponent (Ozow, Capitec Pay, Card, Crypto)│
 │       ├── WithdrawModalComponent (EFT, eWallet, CashSend, USDT)  │
 │       └── Provably Fair Verifier Modal                           │
 └──────────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack & Key Dependencies

| Dependency | Version | Purpose |
| :--- | :--- | :--- |
| **Angular Core / Common** | `^20.0.0` | Modern standalone component architecture & reactive Signals |
| **Angular Forms** | `^20.0.0` | Reactive & template-driven inputs for betting & modals |
| **@microsoft/signalr** | `^8.0.7` | WebSocket client connecting to ASP.NET Core GameHub |
| **TypeScript** | `~5.8.0` | Strict type checking and modern ECMAScript features |
| **RxJS** | `~7.8.0` | Reactive async primitives |
| **SCSS** | Embedded | Premium dark aesthetic with neon glowing tokens |

---

## 3. State Management & Core Services

### 3.1 `GameService` (`services/game.service.ts`)
Central reactive hub managing SignalR connection lifecycle, authoritative game state, player balance, and historical round feeds.
* **Signals & State Store:**
  - `userId`: Persistent player ID (synced with `localStorage['smartbet_aviator_user_id']`).
  - `userName`: Display name (`Pilot_XXXXX` or authenticated user name).
  - `userBalance`: Live atomic balance in Rand (ZAR `R`). Defaults to `R0.00`.
  - `connectionState`: `'disconnected' | 'connecting' | 'connected' | 'reconnecting'`.
  - `gameState`: `GameState.WaitingForBets` | `GameState.Flying` | `GameState.Crashed`.
  - `currentMultiplier`: Live flight multiplier (starts at `1.00x`).
  - `flightSeconds`: Elapsed flight duration in seconds.
  - `remainingCountdown`: Betting countdown timer (10s down to 0s).
  - `activeBets`: Array of `ActiveBet` currently in play for the active round.
  - `roundHistory`: List of recent 20 rounds with crash multipliers and cryptographic seeds.
  - `latestCashouts`: Real-time stream of player cashout events.
  - `soundEnabled`: Audio effects toggle boolean signal.
* **SignalR WebSocket Methods:**
  - `placeBet(amount, autoCashoutMultiplier, panelIndex)`
  - `requestCashout(betId, panelIndex)`
  - `refreshHistory()` / `fetchInitialHistory()`
  - `verifyRound(serverSeed, clientSeed, roundId)`

### 3.2 `AuthService` (`services/auth.service.ts`)
Manages pilot authentication, JWT session persistence in `localStorage`, demo account login, and balance synchronization.
* **Reactive Signals:**
  - `currentUser`: `UserProfile | null` (`userId`, `userName`, `email`, `balance`).
  - `authToken`: Bearer session token.
  - `isLoggedIn`: Computed boolean based on `currentUser() !== null`.
  - `isLoading`: Async operation loader indicator.
  - `authError`: Validation or network error message string.
* **Methods:**
  - `register({ userName, email, password })` $\rightarrow$ Registers new account with `R0.00` starting balance.
  - `login({ emailOrUsername, password })` $\rightarrow$ Authenticates and restores balance.
  - `resetPassword({ email, newPassword })` $\rightarrow$ Simulates password recovery.
  - `logout()` $\rightarrow$ Clears session, resets to anonymous pilot with `R0.00`.
  - `updateUserBalance(newBalance)` $\rightarrow$ Syncs wallet state across all services.

### 3.3 `WalletService` (`services/wallet.service.ts`)
Handles deposits, withdrawals, and transaction ledger updates.
* **Reactive Signals:**
  - `isProcessing`: Boolean loading state during transaction submission.
  - `operationError` / `operationSuccess`: Feedback message signals.
  - `recentTransactions`: Array of `WalletTransaction` records.
* **Methods:**
  - `deposit(DepositRequest)`: Supports Instant EFT (Ozow/SiD), Capitec Pay, Visa/Mastercard, 1Voucher/OTT, Crypto (USDT/BTC).
  - `withdraw(WithdrawRequest)`: Validates minimum R50.00 threshold, executes Bank EFT, FNB eWallet, or USDT TRC-20 transfers.

---

## 4. Components & Canvas Visual Engine

### 4.1 HTML5 Canvas Flight Engine (`canvas-renderer.ts`)
* **Renderer Specifications:**
  - High-DPI support (`window.devicePixelRatio` scaling).
  - 60 FPS requestAnimationFrame animation loop.
  - Dynamic responsive resizing (`ResizeObserver`).
* **Visual Components:**
  1. **Coordinate Grid & Axes:** Glowing cyan/dark-gray grid lines with dynamic labels (`t` seconds, `M` multiplier).
  2. **Bezier Flight Trajectory Curve:** Dynamic gradient fill (`#E61C5A` crimson to `#FFB300` amber) beneath the flight path.
  3. **Aircraft Rendering:** Procedural vector-drawn red fighter plane with glowing jet engine exhaust thrust.
  4. **Jet Exhaust Particle System:** Multi-colored spark particles (`rgba(230, 28, 90)`, `rgba(255, 179, 0)`) with velocity damping and alpha fade.
  5. **Crash Explosion Physics:** On crash, plane accelerates upward/rightward with rotational velocity and spawns explosive debris particles before fading away.
  6. **Countdown Ring Animation:** 10-second circular progress indicator during `WaitingForBets` phase.

### 4.2 Dual Betting Panels (`aviator-game.component.ts`)
* **Features:**
  - Two independent betting panels (`Panel 1` and `Panel 2`).
  - Quick amount presets: `+R10`, `+R50`, `+R100`, `+R500`.
  - Auto-Cashout toggle with customizable multiplier target (e.g. `1.50x`, `2.00x`).
  - Dynamic button states:
    - `WaitingForBets` $\rightarrow$ **"BET R..."** (places wager).
    - `Flying` (Bet Active) $\rightarrow$ **"CASH OUT R..."** (displays real-time live win value).
    - `Flying` (Cashed Out) $\rightarrow$ **"CASHED OUT R..."** (amber success state).
    - `Crashed` $\rightarrow$ Resets ready for next countdown.

### 4.3 Multiplayer Bet Board & Round History Strip
* **Multiplayer Board:**
  - Tabs: **All Bets** (live participant feed), **My Bets** (player history), **Top Wins** (highest win multipliers).
  - Shows Pilot Name, Bet Amount, Cashout Multiplier, and Win Amount.
* **History Strip:**
  - Top scrollable strip showing recent crash multipliers (color-coded: blue for $<2.00\times$, purple for $2.00\times - 9.99\times$, crimson for $\ge 10.00\times$).
  - Click-to-Verify: Opens the Provably Fair modal pre-loaded with `ServerSeed`, `ClientSeed`, and `RoundId`.

### 4.4 Modals
1. **Auth Modal (`auth-modal.component.ts`):** Tabbed interface for Login, Register, Forgot Password with input validation.
2. **Deposit Modal (`deposit-modal.component.ts`):** South African payment selector, voucher PIN input, quick amount chips.
3. **Withdraw Modal (`withdraw-modal.component.ts`):** Bank selector (Capitec, FNB, Standard Bank, Nedbank, ABSA, etc.), account number input, percentage shortcuts (25%, 50%, 75%, 100%).
4. **Provably Fair Verifier Modal:** Allows any player to recalculate the HMAC-SHA512 crash point locally and verify round integrity.

---

## 5. Build & Performance Metrics

- **Production Build:** `ng build` completed in ~36 seconds with **0 errors**.
- **Bundle Output:**
  - `main.js`: 453.95 kB (Transfer: 102.16 kB)
  - `polyfills.js`: 34.59 kB (Transfer: 11.33 kB)
  - `styles.css`: 2.97 kB (Transfer: 991 B)
  - **Total Transfer Size:** ~**114.48 kB** (Extremely lightweight and fast load times).
- **Audio Synthesis:** Built-in Web Audio API synthesizer for zero-asset, low-latency audio effects (click, countdown beep, flight hum, cashout chime, crash explosion).

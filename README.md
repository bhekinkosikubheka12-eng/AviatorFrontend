# 🚀 SmartBet Aviator Frontend

<div align="center">

  <!-- Live Gameplay Video Demo -->
  <video src="https://firebasestorage.googleapis.com/v0/b/huntic-ab5f7.firebasestorage.app/o/demo_2.mp4?alt=media&token=a3b9fb3d-157c-4231-acef-919f65354084" width="100%" controls autoplay loop muted playsinline style="max-width: 1000px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6); margin-bottom: 20px;">
    Your browser does not support the video tag.
  </video>

  [![Angular](https://img.shields.io/badge/Angular-20.0-DD0031?style=for-the-badge&logo=angular&logoColor=white)](https://angular.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![SignalR](https://img.shields.io/badge/SignalR-WebSocket-512BD4?style=for-the-badge&logo=dotnet&logoColor=white)](https://dotnet.microsoft.com/)
  [![HTML5 Canvas](https://img.shields.io/badge/HTML5_Canvas-60_FPS-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/)
  [![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

  <p align="center">
    <strong>A high-performance, real-time multiplayer Aviator crash game client built with Angular 20, SignalR WebSockets, and custom HTML5 Canvas 2D particle physics engine.</strong>
  </p>

</div>

---

## 🌟 Key Features

- **🎮 60 FPS HTML5 Canvas Physics Engine**
  - Smooth Bezier flight trajectory curves with dynamic gradient filling.
  - Procedural vector jet fighter aircraft with animated glowing engine thrusters.
  - Multi-colored jet exhaust particle sparks with realistic velocity damping.
  - Dramatic explosive crash physics and debris dispersal.
  - High-DPI screen support (`window.devicePixelRatio`) with responsive auto-resizing.

- **⚡ Real-Time SignalR WebSocket Streaming**
  - Sub-millisecond multiplier ticks synced with the authoritative game server.
  - Multiplayer live cashout events and synchronized round countdowns.
  - Automatic reconnection handling with graceful state recovery.

- **🎛️ Dual Independent Betting Consoles**
  - Two parallel betting panels allowing simultaneous independent wagers.
  - Quick stake adjustment chips (`+R10`, `+R50`, `+R100`, `+R500`).
  - Auto-cashout multiplier triggers (e.g., `1.50x`, `2.00x`, `5.00x`).
  - Dynamic interactive button states (*Bet*, *Waiting*, *Cash Out*, *Cashed Out*).

- **📊 Multiplayer Feed & Round History**
  - Dynamic multiplier history strip displaying the last 20 rounds with color-coded odds tiers (Blue `< 2x`, Purple `2x - 10x`, Crimson `≥ 10x`).
  - Multiplayer tabbed leaderboard: **All Bets**, **My Bets**, and **Top Wins**.

- **🔒 Provably Fair Verification Modal**
  - Built-in cryptographic verifier allowing players to validate any round's multiplier using HMAC-SHA512 with the Server Seed and Client Seed.

- **💳 Payment & Wallet UI**
  - **Deposit Modal**: Instant EFT (Ozow, SiD), Capitec Pay, Visa / Mastercard, 1Voucher / OTT, and Crypto (USDT / BTC).
  - **Withdraw Modal**: South African banking institutions (Capitec, FNB, Standard Bank, Nedbank, ABSA), FNB eWallet, and Crypto.

- **🔊 Procedural Web Audio Engine**
  - Lightweight, zero-asset sound generator using native Web Audio API oscillators: countdown beeps, engine flight hum, cashout victory chimes, and crash explosion rumbles.

---

## 🛠️ Tech Stack

- **Framework:** [Angular 20](https://angular.dev/) (Standalone Components, Angular Signals)
- **Language:** [TypeScript 5.8](https://www.typescriptlang.org/)
- **Real-Time Client:** [@microsoft/signalr](https://www.npmjs.com/package/@microsoft/signalr)
- **Styling:** Custom SCSS with a modern dark glassmorphic design system
- **Rendering:** HTML5 Canvas 2D Context + `requestAnimationFrame` loop
- **State Management:** Angular Reactive Signals (`signal`, `computed`, `effect`)

---

## 📂 Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── aviator-game/       # Core game arena & Canvas renderer
│   │   │   ├── auth-modal/         # Login, Register & Password reset
│   │   │   ├── deposit-modal/      # Payment gateway selection & deposit UI
│   │   │   ├── withdraw-modal/     # Cashout & bank transfer UI
│   │   │   └── provably-fair/      # HMAC-SHA512 verification modal
│   │   ├── services/
│   │   │   ├── game.service.ts     # SignalR connection & game state signals
│   │   │   ├── auth.service.ts     # User authentication & profile state
│   │   │   ├── wallet.service.ts   # Deposit & withdrawal transaction store
│   │   │   └── audio.service.ts    # Web Audio API sound synthesizer
│   │   ├── models/                 # TypeScript interfaces & types
│   │   ├── app.component.ts        # Root shell
│   │   └── app.config.ts           # Angular standalone application config
│   ├── styles/                     # Global SCSS variables, mixins & theme
│   ├── index.html
│   └── main.ts
├── angular.json
├── package.json
└── tsconfig.json
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18.x, v20.x, or v22.x recommended)
- [npm](https://www.npmjs.com/) (v9.x or higher)
- [Angular CLI](https://angular.dev/tools/cli) (v20.x):
  ```bash
  npm install -g @angular/cli
  ```

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/bhekinkosikubheka12-eng/AviatorFrontend.git
   cd AviatorFrontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm start
   # or
   ng serve
   ```

4. **Open in browser:**
   Navigate to `http://localhost:4200/`

---

## 🔗 Backend Companion

This frontend connects to the companion ASP.NET Core SignalR backend:
- **Backend Repository:** [AviatorBackend](https://github.com/bhekinkosikubheka12-eng/AviatorBackend)
- Default SignalR Hub URL: `http://localhost:5000/gamehub` or `https://localhost:7001/gamehub`

---

## 🎬 Gameplay Demo

The gameplay recording showcases:
- High-precision 60 FPS HTML5 Canvas flight trajectory and particle physics
- Real-time multiplier synchronization via SignalR
- Dual betting panel operation with instant cashout response

---

## 📄 License

This project is licensed under the MIT License — see the LICENSE file for details.

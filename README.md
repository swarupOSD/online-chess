# ♟️ Antigravity Chess Arena

Antigravity Chess Arena is a professional-grade, mobile-first real-time online chess platform designed for competitive multiplayer matchups, offline training, and tournament broadcasts. Built using Node.js, Express, Socket.io, and chess.js.

---

## 🚀 Features

### 1. Multiplayer Gameplay & Stability
* **Server-Authoritative Validation:** The server is the single source of truth for all game states. Client-side chess.js is only used for UI validation.
* **Desync & Concurrency Prevention:** Implements room locking during move execution to eliminate duplicate moves or illegal state flashing.
* **Robust Reconnections:** Player disconnects trigger a 30-second grace window to reconnect and restore active board positions, timers, and opponent states seamlessly.
* **Game Modes:** Support for Online Multiplayer (Socket.io), Play vs Computer (AI), and Offline Local Play.

### 2. Live Spectator Broadcast (TV Mode)
* **Real-time Streaming:** Watch live games with zero perceptible latency.
* **Broadcast Layout:** Blinking red **LIVE** indicator, evaluator bars, and bottom spectator status panels.
* **Stream Pause & Controls:** Pause/Resume the live feed dynamically. The client buffers moves while paused and catches up instantly on resume.
* **Mobile Spectator Drawer:** Restructured mobile view containing PGN notation, player details, room info, and a rolling match events log.

### 3. In-Game AI Coach & Hint Overlay
* **Heuristic Engine:** Offline, non-blocking evaluation module assessing material balance, check threats, center space, castling, and piece threats.
* **Gold Arrow Hints:** Draws visual gold SVG arrows from selected pieces to recommended cells.
* **Move Quality Feedback:** Analyzes played moves in real-time, flashing alert badges above the board (e.g. *✔ Excellent move!*, *Good move*, *⚠ Inaccuracy*, *❌ Blunder risk detected*).

---

## 🛠️ Technology Stack
* **Backend:** Node.js, Express
* **Real-time Sync:** Socket.io
* **Chess Logic Engine:** chess.js
* **Frontend UI:** HTML5, Vanilla CSS Grid, Bootstrap 5, SVG Icons

---

## 📦 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v16 or higher recommended)

### Installation
1. Clone the repository or extract the project directory:
   ```bash
   cd online-chess
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the application:
   ```bash
   npm start
   ```
   *(or run `node server.js`)*

4. Open your browser and navigate to:
   ```text
   http://localhost:3000
   ```

---

## 📂 Project Structure
```text
├── server.js              # Server-authoritative game loops, clock ticks & socket relays
├── package.json           # Project configurations & dependency versions
├── .gitignore             # Excludes node_modules, logs and system metadata from Git tracking
└── public/
    ├── index.html         # Lobby portal for selecting modes, time controls, and spectating
    ├── game.html          # Professional 3-column chess arena board & Mobile drawer tabs
    ├── css/
    │   └── style.css      # Custom glassmorphic stylesheet and animation keyframes
    └── js/
        ├── chess-game.js  # Main client-side rendering controller & AI Coaching heuristics
        └── chess-pieces.js# Lightweight SVG definitions library for rendering high-fidelity chess pieces
```

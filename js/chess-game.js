// Client-Side Chess Game Controller
document.addEventListener('DOMContentLoaded', () => {
  // Parse URL Parameters
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode') || 'online'; // 'online', 'ai', 'local'
  const action = urlParams.get('action');
  const paramName = urlParams.get('name') || 'Player';
  const paramColor = urlParams.get('color') || 'white';
  const paramTime = urlParams.get('time') || '600';
  const paramRoom = urlParams.get('room');

  // Preferences & Sound Configurations (localStorage persistence)
  let currentTheme = localStorage.getItem('chess_theme') || 'dark';
  let currentBoardStyle = localStorage.getItem('chess_board_style') || 'emerald';
  let isMuted = localStorage.getItem('chess_sound_muted') === 'true';

  applyThemeAndStyles();

  // Core Game State Variables
  let socket = null;
  if (mode === 'online') {
    const socketUrl = window.location.hostname.includes('github.io') 
      ? 'https://arena-chess.onrender.com' 
      : undefined;
    socket = io(socketUrl);
  }

  let chess = new Chess();
  let myColor = 'white'; // 'white', 'black', or 'spectator'
  let myUsername = paramName;
  let roomCode = paramRoom || '';
  let timeLimit = parseInt(paramTime, 10);
  
  let selectedSquare = null;
  let validMovesForSelected = [];
  let lastMove = null; // { from: 'e2', to: 'e4' }
  
  let gameClocks = { white: 0, black: 0 };
  let activeTurn = 'w'; // 'w' or 'b'
  let isMyTurn = false;
  let opponentName = 'Waiting for opponent...';
  let opponentConnected = false;

  // Move submission concurrency lock
  let isProcessingMove = false;

  // Local Offline Mode interval timer
  let localTimerInterval = null;

  // Spectator Broadcast State Variables
  let isLivePaused = false;
  let latestSpectatorState = null;
  let whitePlayerName = 'White Player';
  let blackPlayerName = 'Black Player';

  // AI Coach state variables
  let isCoachEnabled = localStorage.getItem('chess_ai_coach_enabled') !== 'false';
  let evaluationCache = {};
  let currentFeedbackTimeout = null;

  // Persistent map of piece squareName -> DOM element
  let boardPieces = {};

  // Pointer Dragging States
  let activeDragPiece = null;
  let dragStartSquare = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let initialXPercent = 0;
  let initialYPercent = 0;
  let hasDraggedPastThreshold = false;
  let dragPointerId = null;
  let wasDragging = false;
  
  // HTML Element references
  const boardEl = document.getElementById('board');
  const roomCodeDisplay = document.getElementById('room-code-display');
  const gameStatusAlert = document.getElementById('game-status-alert');
  const aiThinkingIndicator = document.getElementById('ai-thinking-indicator');
  
  const playerNameEl = document.getElementById('player-name');
  const playerBadgeEl = document.getElementById('player-badge');
  const playerTimerEl = document.getElementById('player-timer');
  const playerCapturedEl = document.getElementById('player-captured');
  
  const opponentNameEl = document.getElementById('opponent-name');
  const opponentBadgeEl = document.getElementById('opponent-badge');
  const opponentTimerEl = document.getElementById('opponent-timer');
  const opponentCapturedEl = document.getElementById('opponent-captured');
  const opponentStatusDot = document.getElementById('opponent-status');
  
  const moveListEl = document.getElementById('move-list');
  const mobileMoveListEl = document.getElementById('mobile-move-list');

  const chatMessagesEl = document.getElementById('chat-messages');
  const mobileChatMessagesEl = document.getElementById('mobile-chat-messages');

  const chatForm = document.getElementById('chat-form');
  const mobileChatForm = document.getElementById('mobile-chat-form');
  const chatInput = document.getElementById('chat-input');
  const mobileChatInput = document.getElementById('mobile-chat-input');
  
  const btnResign = document.getElementById('btn-resign');
  const btnOfferDraw = document.getElementById('btn-offer-draw');
  const btnCopyLink = document.getElementById('btn-copy-link');
  const btnRematchOffer = document.getElementById('btn-rematch-offer');

  // Mobile drawer links
  const btnMobileResign = document.getElementById('btn-mobile-resign');
  const btnMobileOfferDraw = document.getElementById('btn-mobile-offer-draw');
  
  const promotionModal = new bootstrap.Modal(document.getElementById('promotionModal'));
  const gameOverModal = new bootstrap.Modal(document.getElementById('gameOverModal'));
  const gameOverTitle = document.getElementById('game-over-title');
  const gameOverReason = document.getElementById('game-over-reason');
  
  let pendingPromotion = null; // Stores { from, to } during promotion selection

  // Web Audio API Synthesized sound engine
  const soundEngine = {
    audioCtx: null,
    
    init() {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
    },
    
    playMove() {
      if (isMuted) return;
      this.init();
      if (!this.audioCtx) return;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, this.audioCtx.currentTime + 0.08);
      
      gain.gain.setValueAtTime(0.12, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.08);
      
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.08);
    },
    
    playCapture() {
      if (isMuted) return;
      this.init();
      if (!this.audioCtx) return;
      
      const bufferSize = this.audioCtx.sampleRate * 0.08;
      const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noise = this.audioCtx.createBufferSource();
      noise.buffer = buffer;
      
      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 600;
      
      const gain = this.audioCtx.createGain();
      gain.gain.setValueAtTime(0.18, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.08);
      
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.audioCtx.destination);
      
      noise.start();
      noise.stop(this.audioCtx.currentTime + 0.08);
    },
    
    playCheck() {
      if (isMuted) return;
      this.init();
      if (!this.audioCtx) return;
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.audioCtx.destination);
      
      osc1.frequency.value = 650;
      osc2.frequency.value = 653; 
      
      gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.18);
      
      osc1.start();
      osc2.start();
      osc1.stop(this.audioCtx.currentTime + 0.18);
      osc2.stop(this.audioCtx.currentTime + 0.18);
    },
    
    playGameOver() {
      if (isMuted) return;
      this.init();
      if (!this.audioCtx) return;
      const now = this.audioCtx.currentTime;
      const frequencies = [261.63, 329.63, 392.00, 523.25]; 
      
      frequencies.forEach((freq, index) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.05 + index * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6 + index * 0.05);
        
        osc.start(now + index * 0.05);
        osc.stop(now + 0.8 + index * 0.05);
      });
    }
  };

  // Preference manager functions
  function applyThemeAndStyles() {
    // Body theme
    if (currentTheme === 'light') {
      document.body.classList.add('light-theme');
      document.getElementById('theme-icon').className = 'bi bi-moon-fill text-success';
    } else {
      document.body.classList.remove('light-theme');
      document.getElementById('theme-icon').className = 'bi bi-sun-fill text-success';
    }

    // Board styles
    document.body.classList.remove('board-wood', 'board-slate');
    if (currentBoardStyle === 'wood') {
      document.body.classList.add('board-wood');
    } else if (currentBoardStyle === 'slate') {
      document.body.classList.add('board-slate');
    }

    // Sound toggle UI
    const soundIcon = document.getElementById('sound-icon');
    if (isMuted) {
      soundIcon.className = 'bi bi-volume-mute-fill text-secondary';
    } else {
      soundIcon.className = 'bi bi-volume-up-fill text-success';
    }
  }

  // Bind top navbar preference toggles
  document.getElementById('btn-toggle-theme').addEventListener('click', () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('chess_theme', currentTheme);
    applyThemeAndStyles();
  });

  document.getElementById('btn-toggle-sound').addEventListener('click', () => {
    isMuted = !isMuted;
    localStorage.setItem('chess_sound_muted', isMuted);
    applyThemeAndStyles();
  });

  // AI Coach toggle support
  function applyCoachToggleState() {
    const toggleText = document.getElementById('coach-toggle-text');
    const icon = document.getElementById('coach-icon');
    const toggleBtn = document.getElementById('btn-toggle-coach');
    
    if (isCoachEnabled) {
      document.documentElement.classList.add('coach-enabled');
      if (toggleText) toggleText.innerText = 'Coach ON';
      if (icon) icon.className = 'bi bi-brain text-success';
      if (toggleBtn) toggleBtn.className = 'btn btn-sm btn-glass px-2.5';
      evaluateCurrentPosition();
    } else {
      document.documentElement.classList.remove('coach-enabled');
      if (toggleText) toggleText.innerText = 'Coach OFF';
      if (icon) icon.className = 'bi bi-brain text-secondary';
      if (toggleBtn) toggleBtn.className = 'btn btn-sm btn-glass px-2.5 opacity-50';
      clearCoachOverlays();
    }
  }

  const btnToggleCoach = document.getElementById('btn-toggle-coach');
  if (btnToggleCoach) {
    btnToggleCoach.addEventListener('click', () => {
      isCoachEnabled = !isCoachEnabled;
      localStorage.setItem('chess_ai_coach_enabled', isCoachEnabled);
      applyCoachToggleState();
    });
  }

  document.getElementById('style-emerald').addEventListener('click', (e) => {
    e.preventDefault();
    currentBoardStyle = 'emerald';
    localStorage.setItem('chess_board_style', currentBoardStyle);
    applyThemeAndStyles();
  });

  document.getElementById('style-wood').addEventListener('click', (e) => {
    e.preventDefault();
    currentBoardStyle = 'wood';
    localStorage.setItem('chess_board_style', currentBoardStyle);
    applyThemeAndStyles();
  });

  document.getElementById('style-slate').addEventListener('click', (e) => {
    e.preventDefault();
    currentBoardStyle = 'slate';
    localStorage.setItem('chess_board_style', currentBoardStyle);
    applyThemeAndStyles();
  });

  // Fullscreen Toggle controller
  const btnToggleFullscreen = document.getElementById('btn-toggle-fullscreen');
  if (btnToggleFullscreen) {
    btnToggleFullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(() => {
          document.getElementById('fullscreen-icon').className = 'bi bi-fullscreen-exit text-success';
        }).catch(err => {
          console.error(`Error enabling fullscreen: ${err.message}`);
        });
      } else {
        document.exitFullscreen().then(() => {
          document.getElementById('fullscreen-icon').className = 'bi bi-arrows-fullscreen text-success';
        });
      }
    });
  }

  document.addEventListener('fullscreenchange', () => {
    const icon = document.getElementById('fullscreen-icon');
    if (icon) {
      if (document.fullscreenElement) {
        icon.className = 'bi bi-fullscreen-exit text-success';
      } else {
        icon.className = 'bi bi-arrows-fullscreen text-success';
      }
    }
  });

  // Autoplay Web Audio policy bypass
  const initAudioOnInteraction = () => {
    soundEngine.init();
    if (soundEngine.audioCtx && soundEngine.audioCtx.state === 'suspended') {
      soundEngine.audioCtx.resume();
    }
    document.body.removeEventListener('click', initAudioOnInteraction);
    document.body.removeEventListener('touchstart', initAudioOnInteraction);
    document.body.removeEventListener('pointerdown', initAudioOnInteraction);
  };
  document.body.addEventListener('click', initAudioOnInteraction);
  document.body.addEventListener('touchstart', initAudioOnInteraction);
  document.body.addEventListener('pointerdown', initAudioOnInteraction);

  // Link mobile drawer buttons to desktop handlers
  if (btnMobileResign) {
    btnMobileResign.addEventListener('click', () => btnResign.click());
  }
  if (btnMobileOfferDraw) {
    btnMobileOfferDraw.addEventListener('click', () => btnOfferDraw.click());
  }

  // Initialize Game Modes
  if (mode === 'online' && socket) {
    document.getElementById('mode-icon').innerHTML = '<i class="bi bi-globe2 me-2"></i>';
    document.getElementById('mobile-game-mode-display').innerText = 'Mode: Online Multiplayer';
    document.getElementById('mobile-room-display').classList.remove('d-none');

    socket.off('sync_state');
    socket.off('player_join');
    socket.off('player_disconnect');
    socket.off('move_made');
    socket.off('invalid_move');
    socket.off('clock_update');
    socket.off('chat_message');
    socket.off('gameOver');
    socket.off('drawOffered');
    socket.off('drawDeclined');
    socket.off('rematchOffered');
    socket.off('colorSwap');
    socket.off('spectator_sync_state');
    socket.off('spectator_move_broadcast');
    socket.off('spectator_clock_sync');
    socket.off('spectator_game_end');
    socket.off('spectator_chat');
    socket.off('spectator_count_update');

    socket.on('connect', () => {
      console.log('Connected to server socket.');
      
      if (action === 'create') {
        socket.emit('player_join', {
          username: myUsername,
          preferredColor: paramColor,
          timeLimit: timeLimit,
          isCreation: true
        });
      } else if (action === 'spectate' && paramRoom) {
        socket.emit('join_spectator', {
          roomId: paramRoom,
          username: myUsername
        });
      } else if (action === 'join' && paramRoom) {
        socket.emit('player_join', {
          username: myUsername,
          roomCode: paramRoom,
          isCreation: false
        });
      }
    });

    socket.on('sync_state', (data) => {
      roomCode = data.roomCode;
      myColor = data.myColor;
      myUsername = data.myUsername;
      timeLimit = data.timeLimit;
      activeTurn = data.turn;
      isMyTurn = (activeTurn === 'w' && myColor === 'white') || (activeTurn === 'b' && myColor === 'black');

      roomCodeDisplay.innerText = roomCode;
      document.getElementById('mobile-room-display').innerText = `Room: ${roomCode}`;

      const newUrl = `${window.location.origin}${window.location.pathname}?mode=online&action=join&room=${roomCode}`;
      window.history.replaceState({ path: newUrl }, '', newUrl);

      chess = new Chess();
      chess.load(data.fen);

      selectedSquare = null;
      validMovesForSelected = [];
      isProcessingMove = false;

      gameClocks.white = data.clocks.white;
      gameClocks.black = data.clocks.black;

      reconstructCapturedPieces();
      reconstructPGNHistory(data.pgn);

      if (myColor === 'spectator') {
        gameStatusAlert.innerText = 'Spectating Game';
        gameStatusAlert.className = 'badge bg-info badge-custom py-2 px-3 fw-semibold';
        btnResign.disabled = true;
        btnMobileResign.disabled = true;
        btnOfferDraw.disabled = true;
        btnMobileOfferDraw.disabled = true;

        playerNameEl.innerText = data.myUsername || 'Spectator';
        playerBadgeEl.innerText = 'Spec';
        playerBadgeEl.className = 'badge bg-secondary text-white ms-1';

        opponentNameEl.innerText = data.opponentName || 'White Player';
        opponentBadgeEl.innerText = 'White';
        opponentBadgeEl.className = 'badge bg-white text-dark ms-1';
        opponentStatusDot.className = data.opponentConnected ? 'status-dot online' : 'status-dot offline';

        if (data.blackName) {
          playerNameEl.innerText = data.opponentName || 'White';
          playerBadgeEl.innerText = 'White';
          playerBadgeEl.className = 'badge bg-white text-dark ms-1';

          opponentNameEl.innerText = data.blackName || 'Black';
          opponentBadgeEl.innerText = 'Black';
          opponentBadgeEl.className = 'badge bg-dark border border-secondary text-secondary ms-1';
          opponentStatusDot.className = data.blackConnected ? 'status-dot online' : 'status-dot offline';
        }
      } else {
        opponentName = data.opponentName || 'Waiting...';
        opponentConnected = data.opponentConnected;
        opponentStatusDot.className = opponentConnected ? 'status-dot online' : 'status-dot offline';

        setupPlayerProfiles();
        updateStatusHeader();

        const gameStarted = !!data.opponentName;
        btnResign.disabled = !gameStarted;
        btnMobileResign.disabled = !gameStarted;
        btnOfferDraw.disabled = !gameStarted;
        btnMobileOfferDraw.disabled = !gameStarted;
      }

      updateTimerDisplays();
      renderBoard(false); // static initial render
      applyCoachToggleState();
    });

    socket.on('player_join', (data) => {
      if (data.color !== myColor && myColor !== 'spectator') {
        opponentName = data.name;
        opponentConnected = data.connected;
        opponentStatusDot.className = 'status-dot online';

        setupPlayerProfiles();
        updateStatusHeader();

        btnResign.disabled = false;
        btnMobileResign.disabled = false;
        btnOfferDraw.disabled = false;
        btnMobileOfferDraw.disabled = false;

        appendSystemMessage(`${data.name} connected.`);
      }
    });

    socket.on('player_disconnect', (data) => {
      if (data.color !== myColor && myColor !== 'spectator') {
        opponentConnected = false;
        opponentStatusDot.className = 'status-dot offline';

        gameStatusAlert.innerText = 'Opponent disconnected!';
        gameStatusAlert.className = 'badge bg-danger badge-custom py-2 px-3 fw-semibold';

        appendSystemMessage(`${opponentName} disconnected. Reconnect window active (30s)...`);
      }
    });

    socket.on('move_made', (data) => {
      // Check played move quality before updating chess engine state
      const wasMyMove = data.move.color === (myColor === 'white' ? 'w' : 'b');
      if (wasMyMove) {
        checkMoveQuality(data.move);
      }

      isProcessingMove = false; 
      activeTurn = data.turn;
      isMyTurn = (activeTurn === 'w' && myColor === 'white') || (activeTurn === 'b' && myColor === 'black');

      // Trigger transition layout updates on client
      renderBoard(true, data.move, data.fen);
      
      gameClocks.white = data.clocks.white;
      gameClocks.black = data.clocks.black;

      updateStatusHeader();
      updateTimerDisplays();
      reconstructCapturedPieces();
      reconstructPGNHistory(data.pgn);
      evaluateCurrentPosition();
    });

    socket.on('invalid_move', (data) => {
      isProcessingMove = false; 
      alert(data.error || 'Invalid action request.');

      if (data.error && (data.error.includes('not found') || data.error.includes('finished'))) {
        window.location.href = `index.html?error=${encodeURIComponent(data.error)}`;
      }

      renderBoard(false);
    });

    socket.on('clock_update', (clocks) => {
      gameClocks.white = clocks.white;
      gameClocks.black = clocks.black;
      updateTimerDisplays();
    });

    socket.on('chat_message', (data) => {
      appendChatMessage(data.sender, data.color, data.text);
    });

    socket.on('gameOver', ({ winner, reason, winnerName }) => {
      soundEngine.playGameOver();
      btnResign.disabled = true;
      btnMobileResign.disabled = true;
      btnOfferDraw.disabled = true;
      btnMobileOfferDraw.disabled = true;
      showLocalGameOverModal(winner, reason, winnerName);
    });

    socket.on('drawOffered', ({ color }) => {
      if (color === myColor) return;
      appendSystemMessage(`${opponentName} offered a draw.`);
      
      const msgDiv = document.createElement('div');
      msgDiv.className = 'chat-message my-2 p-2 bg-dark rounded border border-info border-opacity-20 text-center';
      msgDiv.innerHTML = `
        <div class="small text-info mb-1">${opponentName} offers a draw. Do you accept?</div>
        <div class="d-flex gap-2 justify-content-center">
          <button class="btn btn-xs btn-success py-1 px-3 text-white border-0" id="draw-accept-btn">Accept</button>
          <button class="btn btn-xs btn-danger py-1 px-3 text-white border-0" id="draw-decline-btn">Decline</button>
        </div>
      `;
      
      chatMessagesEl.appendChild(msgDiv);
      chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;

      // Also append to mobile chat container
      const mobileMsgDiv = msgDiv.cloneNode(true);
      mobileChatMessagesEl.appendChild(mobileMsgDiv);
      mobileChatMessagesEl.scrollTop = mobileChatMessagesEl.scrollHeight;

      const setupDrawButtons = (node) => {
        node.querySelector('#draw-accept-btn').addEventListener('click', () => {
          socket.emit('respondDraw', { accept: true });
          msgDiv.remove();
          mobileMsgDiv.remove();
        });
        node.querySelector('#draw-decline-btn').addEventListener('click', () => {
          socket.emit('respondDraw', { accept: false });
          msgDiv.remove();
          mobileMsgDiv.remove();
        });
      };

      setupDrawButtons(chatMessagesEl);
      setupDrawButtons(mobileChatMessagesEl);
    });

    socket.on('drawDeclined', () => {
      appendSystemMessage('Draw offer declined by opponent.');
    });

    socket.on('rematchOffered', ({ color }) => {
      if (color === myColor) return;
      appendSystemMessage(`${opponentName} offered a rematch.`);
      btnRematchOffer.innerText = 'Accept Rematch';
      btnRematchOffer.className = 'btn btn-success py-2.5';
    });

    socket.on('colorSwap', (newColor) => {
      myColor = newColor;
      setupPlayerProfiles();
    });

    // Spectator Real-Time View Syncs
    socket.on('spectator_sync_state', (data) => {
      document.documentElement.classList.add('is-spectating');
      myColor = 'spectator';
      activeTurn = data.gameStatus;
      isMyTurn = false;
      timeLimit = data.timeLimit || 600;
      
      whitePlayerName = data.whitePlayer.name || 'White Player';
      blackPlayerName = data.blackPlayer.name || 'Black Player';

      chess = new Chess();
      chess.load(data.fen);

      selectedSquare = null;
      validMovesForSelected = [];
      isProcessingMove = false;

      gameClocks.white = data.clocks.white;
      gameClocks.black = data.clocks.black;

      reconstructCapturedPieces();
      reconstructPGNHistory(data.pgn);
      updateEvaluationBar();

      gameStatusAlert.innerText = 'Spectating Game';
      gameStatusAlert.className = 'badge bg-info badge-custom py-2 px-3 fw-semibold';

      btnResign.disabled = true;
      btnMobileResign.disabled = true;
      btnOfferDraw.disabled = true;
      btnMobileOfferDraw.disabled = true;

      // Render players
      playerNameEl.innerText = whitePlayerName;
      playerBadgeEl.innerText = 'White';
      playerBadgeEl.className = 'badge bg-white text-dark ms-1';

      opponentNameEl.innerText = blackPlayerName;
      opponentBadgeEl.innerText = 'Black';
      opponentBadgeEl.className = 'badge bg-dark border border-secondary text-secondary ms-1';
      opponentStatusDot.className = data.blackPlayer.connected ? 'status-dot online' : 'status-dot offline';

      // Mobile players drawer
      const mobWhiteName = document.getElementById('mobile-spec-white-name');
      const mobBlackName = document.getElementById('mobile-spec-black-name');
      const mobWhiteStatus = document.getElementById('mobile-spec-white-status');
      const mobBlackStatus = document.getElementById('mobile-spec-black-status');
      const mobRoom = document.getElementById('mobile-spec-room-display');

      if (mobWhiteName) mobWhiteName.innerText = whitePlayerName;
      if (mobBlackName) mobBlackName.innerText = blackPlayerName;
      if (mobWhiteStatus) mobWhiteStatus.className = data.whitePlayer.connected ? 'status-dot online' : 'status-dot offline';
      if (mobBlackStatus) mobBlackStatus.className = data.blackPlayer.connected ? 'status-dot online' : 'status-dot offline';
      if (mobRoom) mobRoom.innerText = roomCode;

      updateTimerDisplays();
      updateSpectatorCountDisplays(data.spectatorCount || 1);
      renderBoard(false);

      const desktopStatus = document.getElementById('desktop-game-status');
      if (desktopStatus) {
        const displayTurn = activeTurn === 'w' ? 'White' : 'Black';
        desktopStatus.innerText = `${displayTurn}'s Turn`;
        desktopStatus.className = 'fw-bold h6 mb-0 text-info';
      }

      // Initial check overlay highlight
      if (chess.in_check()) {
        const checkSquare = findKingSquare(activeTurn);
        if (checkSquare) {
          const checkSqEl = document.querySelector(`.square[data-square="${checkSquare}"]`);
          if (checkSqEl) checkSqEl.classList.add('in-check', 'in-check-pulse');
        }
      }

      logSpectatorEvent(`Joined Room ${roomCode} as spectator.`);
      logSpectatorEvent(`Match state synchronized. Turn: ${activeTurn === 'w' ? 'White' : 'Black'}.`);
    });

    socket.on('spectator_move_broadcast', (data) => {
      // Buffer if paused
      if (isLivePaused) {
        latestSpectatorState = data;
        return;
      }

      activeTurn = data.turn || (chess.history().length % 2 === 0 ? 'w' : 'b');
      isMyTurn = false;

      // Update state and re-render completely from FEN snapshots
      chess.load(data.fen);
      renderBoard(true, data.lastMove, data.fen);

      // Handle check pulse explicitly for spectator
      if (data.checkStatus) {
        const checkSquare = findKingSquare(chess.turn());
        if (checkSquare) {
          const checkSqEl = document.querySelector(`.square[data-square="${checkSquare}"]`);
          if (checkSqEl) checkSqEl.classList.add('in-check', 'in-check-pulse');
        }
      }

      // Handle last move highlight pulse for spectator
      if (data.lastMove) {
        const toSqEl = document.querySelector(`.square[data-square="${data.lastMove.to}"]`);
        if (toSqEl) toSqEl.classList.add('last-move-spectator-pulse');
      }

      gameClocks.white = data.clocks.white;
      gameClocks.black = data.clocks.black;

      updateTimerDisplays();
      reconstructCapturedPieces();
      reconstructPGNHistory(data.pgnUpdate);
      updateEvaluationBar();

      const desktopStatus = document.getElementById('desktop-game-status');
      if (desktopStatus) {
        const displayTurn = chess.turn() === 'w' ? 'White' : 'Black';
        desktopStatus.innerText = `${displayTurn}'s Turn`;
        desktopStatus.className = 'fw-bold h6 mb-0 text-info';
      }

      // Log to spectator events
      const activeName = data.lastMove.color === 'w' ? whitePlayerName : blackPlayerName;
      logSpectatorEvent(`${activeName} played ${data.lastMove.san}`);
      if (data.lastMove.captured) {
        logSpectatorEvent(`${activeName} captured on ${data.lastMove.to}`);
      }
      if (data.checkStatus) {
        logSpectatorEvent(`Check! ${chess.turn() === 'w' ? 'White' : 'Black'} King is in check.`);
      }
    });

    socket.on('spectator_clock_sync', (clocks) => {
      if (isLivePaused) {
        // Only buffer if we don't have a move buffered (move has priority)
        if (!latestSpectatorState) {
          latestSpectatorState = { clocks: { white: clocks.whiteTime, black: clocks.blackTime } };
        } else if (latestSpectatorState.clocks) {
          latestSpectatorState.clocks.white = clocks.whiteTime;
          latestSpectatorState.clocks.black = clocks.blackTime;
        }
        return;
      }
      gameClocks.white = clocks.whiteTime;
      gameClocks.black = clocks.blackTime;
      updateTimerDisplays();
    });

    socket.on('spectator_game_end', ({ winner, reason, winnerName }) => {
      if (isLivePaused) {
        latestSpectatorState = { gameOver: true, winner, reason, winnerName };
        return;
      }
      soundEngine.playGameOver();
      showLocalGameOverModal(winner, reason, winnerName);
      logSpectatorEvent(`Game Ended! Winner: ${winnerName || winner || 'Draw'}. Reason: ${reason}.`);
    });

    socket.on('spectator_chat', (data) => {
      appendChatMessage(data.sender, 'spectator', data.text);
    });

    socket.on('spectator_count_update', (data) => {
      updateSpectatorCountDisplays(data.count);
    });
  } else {
    // 3. STANDALONE OFFLINE MODES
    document.getElementById('room-info-header').innerText = 'Game Mode';
    document.getElementById('room-code-container').classList.add('d-none');
    chatForm.classList.add('d-none');
    
    btnResign.disabled = false;
    btnMobileResign.disabled = false;
    btnOfferDraw.disabled = (mode === 'ai'); 
    btnMobileOfferDraw.disabled = (mode === 'ai');

    chess = new Chess();
    lastMove = null;
    selectedSquare = null;
    validMovesForSelected = [];

    gameClocks.white = timeLimit;
    gameClocks.black = timeLimit;
    
    if (mode === 'ai') {
      document.getElementById('mode-icon').innerHTML = '<i class="bi bi-robot me-2 text-success"></i>';
      document.getElementById('mobile-game-mode-display').innerText = 'Mode: Play vs Computer';

      let assignedColor = paramColor;
      if (paramColor === 'random') {
        assignedColor = Math.random() < 0.5 ? 'white' : 'black';
      }
      myColor = assignedColor;
      myUsername = paramName;
      opponentName = 'Computer AI';
      opponentConnected = true;
      opponentStatusDot.className = 'status-dot online';

      setupPlayerProfiles();
      activeTurn = 'w';
      isMyTurn = (myColor === 'white');

      updateTimerDisplays();
      renderBoard(false);

      if (timeLimit > 0) {
        startOfflineGameTimer();
      }

      if (myColor === 'black') {
        triggerAIMove();
      }
    } else {
      document.getElementById('mode-icon').innerHTML = '<i class="bi bi-people-fill me-2 text-success"></i>';
      document.getElementById('mobile-game-mode-display').innerText = 'Mode: Offline Local Play';

      myColor = 'white';
      myUsername = 'White Player';
      opponentName = 'Black Player';
      opponentConnected = true;
      opponentStatusDot.className = 'status-dot online';

      setupPlayerProfiles();
      activeTurn = 'w';
      isMyTurn = true; 

      updateTimerDisplays();
      renderBoard(false);

      if (timeLimit > 0) {
        startOfflineGameTimer();
      }
    }
  }

  // Local Pass and Play Ticker
  function startOfflineGameTimer() {
    if (timeLimit === 0) return;
    if (localTimerInterval) clearInterval(localTimerInterval);

    localTimerInterval = setInterval(() => {
      if (chess.game_over()) {
        clearInterval(localTimerInterval);
        return;
      }

      if (chess.turn() === 'w') {
        gameClocks.white = Math.max(0, gameClocks.white - 1);
      } else {
        gameClocks.black = Math.max(0, gameClocks.black - 1);
      }

      updateTimerDisplays();

      if (gameClocks.white <= 0 || gameClocks.black <= 0) {
        clearInterval(localTimerInterval);
        handleOfflineGameOver('timeout');
      }
    }, 1000);
  }

  function handleOfflineGameOver(reasonOverride = null) {
    if (localTimerInterval) {
      clearInterval(localTimerInterval);
    }
    
    soundEngine.playGameOver();
    btnResign.disabled = true;
    btnMobileResign.disabled = true;
    btnOfferDraw.disabled = true;
    btnMobileOfferDraw.disabled = true;

    let outcomeTitle = 'Game Over';
    let outcomeReason = '';
    let winner = null;

    if (reasonOverride === 'timeout') {
      const activeColor = chess.turn();
      winner = activeColor === 'w' ? 'black' : 'white';
      const winnerName = (mode === 'ai') 
        ? (winner === myColor ? myUsername : 'Computer AI') 
        : (winner === 'white' ? 'White Player' : 'Black Player');
      outcomeReason = `${winnerName} wins on time.`;
      outcomeTitle = (mode === 'ai') ? (winner === myColor ? 'Victory!' : 'Defeat!') : 'Game Over';
    } else if (chess.in_checkmate()) {
      const loser = chess.turn();
      winner = loser === 'w' ? 'black' : 'white';
      
      if (mode === 'ai') {
        outcomeTitle = (winner === myColor) ? 'Victory!' : 'Defeat!';
        outcomeReason = (winner === myColor) ? `${myUsername} wins by checkmate.` : 'Computer AI wins by checkmate.';
      } else {
        outcomeReason = `${winner === 'white' ? 'White' : 'Black'} Player wins by checkmate.`;
      }
    } else if (chess.in_stalemate()) {
      outcomeTitle = 'Draw!';
      outcomeReason = 'Draw by stalemate.';
    } else if (chess.in_threefold_repetition()) {
      outcomeTitle = 'Draw!';
      outcomeReason = 'Draw by threefold repetition.';
    } else if (chess.insufficient_material()) {
      outcomeTitle = 'Draw!';
      outcomeReason = 'Draw due to insufficient mating material.';
    } else if (chess.in_draw()) {
      outcomeTitle = 'Draw!';
      outcomeReason = 'Draw.';
    }

    showLocalGameOverModal(winner, reasonOverride || 'checkmate', null, outcomeTitle, outcomeReason);
  }

  function showLocalGameOverModal(winner, reason, winnerName = null, titleOverride = null, reasonOverride = null) {
    let outcomeTitle = titleOverride || 'Game Over';
    let outcomeReason = reasonOverride || '';

    if (!titleOverride) {
      if (winner === null) {
        outcomeTitle = 'Draw!';
        if (reason === 'stalemate') outcomeReason = 'Draw by stalemate.';
        else if (reason === 'repetition') outcomeReason = 'Draw by threefold repetition.';
        else if (reason === 'material') outcomeReason = 'Draw due to insufficient mating material.';
        else if (reason === 'draw-agreement') outcomeReason = 'Draw agreed by mutual consent.';
        else outcomeReason = 'The game ended in a draw.';
      } else {
        const isWinnerMe = winner === myColor;
        outcomeTitle = isWinnerMe ? 'Victory!' : 'Defeat!';
        const displayWinnerName = winnerName || (winner === 'white' ? 'White' : 'Black');
        
        if (reason === 'checkmate') outcomeReason = `${displayWinnerName} wins by checkmate.`;
        else if (reason === 'resignation') outcomeReason = `${displayWinnerName} wins by resignation.`;
        else if (reason === 'timeout') outcomeReason = `${displayWinnerName} wins on time.`;
        else if (reason === 'abandonment') outcomeReason = `${displayWinnerName} wins by abandonment.`;
      }
    }

    gameOverTitle.innerText = outcomeTitle;
    gameOverReason.innerText = outcomeReason;

    const iconContainer = document.getElementById('game-over-icon');
    if (winner === myColor) {
      iconContainer.innerHTML = '<i class="bi bi-trophy-fill text-success" style="font-size: 3rem;"></i>';
    } else if (winner === 'spectator' || winner === null) {
      iconContainer.innerHTML = '<i class="bi bi-handshake text-info" style="font-size: 3rem;"></i>';
    } else {
      iconContainer.innerHTML = '<i class="bi bi-flag-fill text-danger" style="font-size: 3rem;"></i>';
    }

    btnRematchOffer.disabled = false;
    btnRematchOffer.innerText = (mode === 'online') ? 'Offer Rematch' : 'Play Again';
    btnRematchOffer.className = 'btn btn-glass-primary py-2.5';

    gameOverModal.show();

    gameStatusAlert.innerText = `Game Over: ${outcomeTitle}`;
    gameStatusAlert.className = 'badge bg-dark border border-secondary text-secondary py-2 px-3 fw-semibold';

    appendSystemMessage(`Game over: ${outcomeReason}`);
  }

  // Client-Side Chess AI move generator (heuristic based)
  function triggerAIMove() {
    isProcessingMove = true; 
    aiThinkingIndicator.classList.remove('d-none'); // Show animated AI dots
    
    // AI Move Delay of 500-800ms
    const delay = 500 + Math.floor(Math.random() * 300);
    
    setTimeout(() => {
      aiThinkingIndicator.classList.add('d-none'); // Hide indicator
      if (chess.game_over()) {
        isProcessingMove = false;
        return;
      }

      const legalMoves = chess.moves({ verbose: true });
      if (legalMoves.length === 0) {
        isProcessingMove = false;
        return;
      }

      const chosenMove = selectBestAIMove(legalMoves);
      const resultMove = chess.move(chosenMove);

      activeTurn = chess.turn();
      isMyTurn = true; 
      isProcessingMove = false; 

      // Trigger GPU animated moves on board
      renderBoard(true, resultMove, chess.fen());

      updateStatusHeader();
      reconstructCapturedPieces();
      reconstructPGNHistory(chess.history({ verbose: true }));

      if (chess.game_over()) {
        handleOfflineGameOver();
      }
    }, delay);
  }

  function selectBestAIMove(moves) {
    const checkmateMoves = [];
    const checkMoves = [];
    const captureMoves = [];
    const developmentalMoves = [];
    const otherMoves = [];

    const tempChess = new Chess(chess.fen());

    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      
      tempChess.load(chess.fen());
      const tempMove = tempChess.move({ from: move.from, to: move.to, promotion: 'q' });

      if (tempMove) {
        if (tempChess.in_checkmate()) {
          checkmateMoves.push(move);
        } else if (tempChess.in_check()) {
          checkMoves.push(move);
        }
      }

      if (move.captured) {
        captureMoves.push(move);
      } else {
        // Developmental / Center control prioritizations
        const centerSquares = ['d4', 'd5', 'e4', 'e5', 'c4', 'c5', 'f4', 'f5'];
        const isCenterMove = centerSquares.includes(move.to);
        const isDevelopment = ['n', 'b'].includes(move.piece);

        if (isCenterMove || isDevelopment) {
          developmentalMoves.push(move);
        } else {
          otherMoves.push(move);
        }
      }
    }

    // 1. Checkmate (highest priority)
    if (checkmateMoves.length > 0) {
      return checkmateMoves[Math.floor(Math.random() * checkmateMoves.length)];
    }

    // 2. Capture (highest value first)
    if (captureMoves.length > 0) {
      const pieceValues = { q: 9, r: 5, b: 3, n: 3, p: 1 };
      captureMoves.sort((a, b) => {
        const valA = pieceValues[a.captured] || 0;
        const valB = pieceValues[b.captured] || 0;
        return valB - valA;
      });

      const highestVal = pieceValues[captureMoves[0].captured] || 0;
      const bestCaptures = captureMoves.filter(m => (pieceValues[m.captured] || 0) === highestVal);
      return bestCaptures[Math.floor(Math.random() * bestCaptures.length)];
    }

    // 3. Checks
    if (checkMoves.length > 0) {
      return checkMoves[Math.floor(Math.random() * checkMoves.length)];
    }

    // 4. Center control / developmental
    if (developmentalMoves.length > 0) {
      return developmentalMoves[Math.floor(Math.random() * developmentalMoves.length)];
    }

    // 5. Fallback random
    return moves[Math.floor(Math.random() * moves.length)];
  }

  // Executes localized moves for AI/Local pass-and-play
  function executeLocalMove(from, to, promotion = null) {
    const movePayload = { from, to };
    if (promotion) {
      movePayload.promotion = promotion;
    }

    // Check played move quality before making the move
    checkMoveQuality(movePayload);

    const moveResult = chess.move(movePayload);
    if (!moveResult) return;

    selectedSquare = null;
    validMovesForSelected = [];
    activeTurn = chess.turn();

    // Trigger transition rendering on client
    renderBoard(true, moveResult, chess.fen());

    updateStatusHeader();
    reconstructCapturedPieces();
    reconstructPGNHistory(chess.history({ verbose: true }));
    evaluateCurrentPosition();

    if (chess.game_over()) {
      handleOfflineGameOver();
      return;
    }

    if (mode === 'ai') {
      isMyTurn = false; 
      triggerAIMove();
    } else {
      isMyTurn = true; 
    }
  }

  // Helper coordinate mapper
  function getSquareCoords(squareName) {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const file = squareName[0];
    const rank = parseInt(squareName[1], 10);
    
    const fileIdx = files.indexOf(file);
    const rankIdx = rank - 1; 
    
    let x, y;
    if (myColor === 'black') {
      x = (7 - fileIdx) * 100;
      y = rankIdx * 100;
    } else {
      x = fileIdx * 100;
      y = (7 - rankIdx) * 100;
    }
    return { x, y };
  }

  // Refactored Board rendering: implements absolute piece coordinates for GPU slides
  function renderBoard(animate = false, lastMoveObj = null, newFen = null) {
    // 1. Initial Static Board Setup (Renders Grid cells under pieces)
    const gridSquares = document.querySelectorAll('.square');
    if (gridSquares.length === 0) {
      boardEl.innerHTML = '';
      
      const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      const ranks = [1, 2, 3, 4, 5, 6, 7, 8];
      const viewRanks = myColor === 'black' ? ranks : [...ranks].reverse();
      const viewFiles = myColor === 'black' ? [...files].reverse() : files;
      
      viewRanks.forEach(rank => {
        viewFiles.forEach(file => {
          const squareName = file + rank;
          const squareEl = document.createElement('div');
          const isLight = (files.indexOf(file) + rank) % 2 !== 0;
          
          squareEl.className = `square ${isLight ? 'light' : 'dark'}`;
          squareEl.setAttribute('data-square', squareName);
          
          // Coordinate Labels
          if (myColor === 'black') {
            if (rank === 8) {
              const fileLbl = document.createElement('span');
              fileLbl.className = 'coordinate file';
              fileLbl.innerText = file;
              squareEl.appendChild(fileLbl);
            }
            if (file === 'h') {
              const rankLbl = document.createElement('span');
              rankLbl.className = 'coordinate rank';
              rankLbl.innerText = rank;
              squareEl.appendChild(rankLbl);
            }
          } else {
            if (rank === 1) {
              const fileLbl = document.createElement('span');
              fileLbl.className = 'coordinate file';
              fileLbl.innerText = file;
              squareEl.appendChild(fileLbl);
            }
            if (file === 'a') {
              const rankLbl = document.createElement('span');
              rankLbl.className = 'coordinate rank';
              rankLbl.innerText = rank;
              squareEl.appendChild(rankLbl);
            }
          }

          // Click handler (Click-to-move accessibility on empty cells)
          squareEl.addEventListener('click', () => {
            if (myColor === 'spectator' || !isMyTurn || isProcessingMove) return;
            if (selectedSquare) {
              handleMoveAttempt(selectedSquare, squareName);
            }
          });

          boardEl.appendChild(squareEl);
        });
      });
    }

    // 2. Load chess state engine
    if (newFen) {
      chess.load(newFen);
    }
    if (lastMoveObj) {
      lastMove = lastMoveObj;
    }

    // 3. Highlight check and moves on grid cells
    document.querySelectorAll('.square').forEach(sqEl => {
      sqEl.classList.remove('selected', 'last-move', 'in-check');
    });

    let checkSquare = null;
    if (chess.in_check()) {
      const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      for (let r = 1; r <= 8; r++) {
        for (let f = 0; f < 8; f++) {
          const sq = files[f] + r;
          const piece = chess.get(sq);
          if (piece && piece.type === 'k' && piece.color === activeTurn) {
            checkSquare = sq;
            break;
          }
        }
        if (checkSquare) break;
      }
    }

    if (checkSquare) {
      const checkSqEl = document.querySelector(`.square[data-square="${checkSquare}"]`);
      if (checkSqEl) {
        checkSqEl.classList.add('in-check');
      }
      
      if (animate) {
        soundEngine.playCheck();
      }
    } else if (animate && lastMoveObj) {
      // Normal move sounds (check took priority)
      const isCapture = lastMoveObj.flags.includes('c') || lastMoveObj.flags.includes('e');
      if (isCapture) {
        soundEngine.playCapture();
      } else {
        soundEngine.playMove();
      }
    }

    if (lastMove) {
      const fromSqEl = document.querySelector(`.square[data-square="${lastMove.from}"]`);
      const toSqEl = document.querySelector(`.square[data-square="${lastMove.to}"]`);
      if (fromSqEl) fromSqEl.classList.add('last-move');
      if (toSqEl) toSqEl.classList.add('last-move');
    }

    // 4. Update absolutely-positioned piece locations
    if (!animate) {
      // Complete Redraw
      document.querySelectorAll('.piece').forEach(el => el.remove());
      boardPieces = {};

      const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      for (let r = 1; r <= 8; r++) {
        for (let f = 0; f < 8; f++) {
          const squareName = files[f] + r;
          const piece = chess.get(squareName);

          if (piece) {
            createPieceDOM(squareName, piece.color + piece.type);
          }
        }
      }
    } else if (lastMoveObj) {
      // Transitioning elements (prevents teleporting!)
      const from = lastMoveObj.from;
      const to = lastMoveObj.to;
      
      // Capture trajectory animation
      const isCapture = lastMoveObj.flags.includes('c') || lastMoveObj.flags.includes('e');
      if (isCapture) {
        let capturedSquare = to;
        if (lastMoveObj.flags.includes('e')) {
          // En passant offset
          capturedSquare = to[0] + from[1];
        }
        
        const capturedEl = boardPieces[capturedSquare];
        if (capturedEl) {
          const rectPiece = capturedEl.getBoundingClientRect();
          const capturingPieceColor = lastMoveObj.color;
          const capturedPieceColor = capturingPieceColor === 'w' ? 'b' : 'w';
          
          const isPlayerWhite = (myColor === 'white' || mode === 'local');
          let trayId;
          if (capturedPieceColor === 'w') {
            trayId = isPlayerWhite ? 'opponent-captured' : 'player-captured';
          } else {
            trayId = isPlayerWhite ? 'player-captured' : 'opponent-captured';
          }
          
          const trayEl = document.getElementById(trayId);
          if (trayEl) {
            const rectTray = trayEl.getBoundingClientRect();
            const dx = (rectTray.left + rectTray.width / 2) - (rectPiece.left + rectPiece.width / 2);
            const dy = (rectTray.top + rectTray.height / 2) - (rectPiece.top + rectPiece.height / 2);
            
            capturedEl.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.4s ease';
            capturedEl.style.transform += ` translate3d(${dx}px, ${dy}px, 0) scale(0.2)`;
            capturedEl.style.opacity = '0';
            capturedEl.style.pointerEvents = 'none';
            capturedEl.style.zIndex = '999';
          } else {
            capturedEl.classList.add('captured-fade');
          }
          
          setTimeout(() => capturedEl.remove(), 400);
          delete boardPieces[capturedSquare];
        }
      }

      // Slide piece to coordinates
      const movingEl = boardPieces[from];
      if (movingEl) {
        const { x, y } = getSquareCoords(to);
        movingEl.style.transform = `translate(${x}%, ${y}%)`;
        movingEl.setAttribute('data-square', to);
        
        // Promotion swap
        if (lastMoveObj.flags.includes('p')) {
          const promotedPiece = chess.get(to);
          const promotedCode = promotedPiece.color + promotedPiece.type;
          movingEl.innerHTML = window.CHESS_PIECES[promotedCode];
          movingEl.setAttribute('data-piece', promotedCode);
        }

        boardPieces[to] = movingEl;
        delete boardPieces[from];
      }

      // Castling auxiliary Rook move slides
      if (lastMoveObj.flags.includes('k') || lastMoveObj.flags.includes('q')) {
        let rookFrom, rookTo;
        if (to === 'g1') { rookFrom = 'h1'; rookTo = 'f1'; }
        else if (to === 'c1') { rookFrom = 'a1'; rookTo = 'd1'; }
        else if (to === 'g8') { rookFrom = 'h8'; rookTo = 'f8'; }
        else if (to === 'c8') { rookFrom = 'a8'; rookTo = 'd8'; }

        const rookEl = boardPieces[rookFrom];
        if (rookEl) {
          const { x: rx, y: ry } = getSquareCoords(rookTo);
          rookEl.style.transform = `translate(${rx}%, ${ry}%)`;
          rookEl.setAttribute('data-square', rookTo);
          
          boardPieces[rookTo] = rookEl;
          delete boardPieces[rookFrom];
        }
      }

      // Board Reconciliation sanity check to prevent desyncs
      setTimeout(() => {
        reconcileBoardElements();
      }, 300);
    }

    renderBoardHighlightDots();
  }

  // Instantiates piece DOM nodes and attaches drag and click listeners
  function createPieceDOM(squareName, pieceCode) {
    const pieceEl = document.createElement('div');
    pieceEl.className = 'piece';
    pieceEl.setAttribute('data-piece', pieceCode);
    pieceEl.setAttribute('data-square', squareName);
    pieceEl.innerHTML = window.CHESS_PIECES[pieceCode];

    const { x, y } = getSquareCoords(squareName);
    pieceEl.style.transform = `translate(${x}%, ${y}%)`;

    const piece = chess.get(squareName);
    const isPieceMyColor = (piece.color === 'w' && myColor === 'white') || (piece.color === 'b' && myColor === 'black');
    const isPieceTurnColor = piece.color === chess.turn();
    const isPieceDraggable = (mode === 'local') ? isPieceTurnColor : (isPieceMyColor && isMyTurn);

    if (isPieceDraggable && myColor !== 'spectator') {
      pieceEl.classList.add('playable');
      pieceEl.addEventListener('pointerdown', (e) => {
        if (isProcessingMove) return;
        
        soundEngine.init();
        if (soundEngine.audioCtx && soundEngine.audioCtx.state === 'suspended') {
          soundEngine.audioCtx.resume();
        }

        e.preventDefault();
        
        activeDragPiece = pieceEl;
        dragStartSquare = squareName;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        dragPointerId = e.pointerId;
        hasDraggedPastThreshold = false;
        wasDragging = false;

        const { x: basePctX, y: basePctY } = getSquareCoords(squareName);
        initialXPercent = basePctX;
        initialYPercent = basePctY;

        pieceEl.setPointerCapture(e.pointerId);
        pieceEl.classList.add('dragging');
        pieceEl.style.transition = 'none';
        pieceEl.style.zIndex = '1000';
      });

      pieceEl.addEventListener('pointermove', (e) => {
        if (activeDragPiece !== pieceEl || dragPointerId !== e.pointerId) return;
        e.preventDefault();
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;

        if (!hasDraggedPastThreshold) {
          if (Math.hypot(dx, dy) > 8) {
            hasDraggedPastThreshold = true;
            wasDragging = true;
            selectedSquare = dragStartSquare;
            validMovesForSelected = chess.moves({ square: dragStartSquare, verbose: true });
            renderBoardHighlightDots();
          }
        }

        if (hasDraggedPastThreshold) {
          pieceEl.style.transform = `translate(${initialXPercent}%, ${initialYPercent}%) translate3d(${dx}px, ${dy}px, 0)`;
        }
      });

      pieceEl.addEventListener('pointerup', (e) => {
        if (activeDragPiece !== pieceEl || dragPointerId !== e.pointerId) return;

        activeDragPiece = null;
        dragPointerId = null;
        pieceEl.releasePointerCapture(e.pointerId);
        pieceEl.classList.remove('dragging');
        pieceEl.style.zIndex = '';
        pieceEl.style.transition = '';

        if (hasDraggedPastThreshold) {
          pieceEl.style.pointerEvents = 'none';
          const dropTarget = document.elementFromPoint(e.clientX, e.clientY);
          pieceEl.style.pointerEvents = '';

          const squareEl = dropTarget ? dropTarget.closest('.square') : null;
          const targetSquare = squareEl ? squareEl.getAttribute('data-square') : null;

          if (targetSquare && targetSquare !== dragStartSquare) {
            handleMoveAttempt(dragStartSquare, targetSquare);
          } else {
            // Snap back
            const { x, y } = getSquareCoords(dragStartSquare);
            pieceEl.style.transform = `translate(${x}%, ${y}%)`;
          }
        }
        dragStartSquare = null;
      });

      pieceEl.addEventListener('pointercancel', (e) => {
        if (activeDragPiece !== pieceEl) return;
        activeDragPiece = null;
        dragPointerId = null;
        pieceEl.releasePointerCapture(e.pointerId);
        pieceEl.classList.remove('dragging');
        pieceEl.style.zIndex = '';
        pieceEl.style.transition = '';
        const { x, y } = getSquareCoords(dragStartSquare);
        pieceEl.style.transform = `translate(${x}%, ${y}%)`;
        dragStartSquare = null;
      });
    }

    // Click handler (Click-to-select pieces / tap-to-move fallback)
    pieceEl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (wasDragging) {
        wasDragging = false;
        return;
      }
      if (myColor === 'spectator' || !isMyTurn || isProcessingMove) return;
      
      const isTurnPiece = piece && piece.color === chess.turn();
      const isPlayablePiece = (mode === 'local') ? isTurnPiece : (piece && ((piece.color === 'w' && myColor === 'white') || (piece.color === 'b' && myColor === 'black')));

      if (selectedSquare === squareName) {
        selectedSquare = null;
        validMovesForSelected = [];
        renderBoardHighlightDots();
      } else if (isPlayablePiece) {
        selectedSquare = squareName;
        validMovesForSelected = chess.moves({ square: squareName, verbose: true });
        renderBoardHighlightDots();
      } else if (selectedSquare) {
        handleMoveAttempt(selectedSquare, squareName);
      }
    });

    boardEl.appendChild(pieceEl);
    boardPieces[squareName] = pieceEl;
  }

  // Verifies that absolute piece locations align with internal chess model
  function reconcileBoardElements() {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    for (let r = 1; r <= 8; r++) {
      for (let f = 0; f < 8; f++) {
        const sq = files[f] + r;
        const piece = chess.get(sq);
        const code = piece ? (piece.color + piece.type) : null;
        const el = boardPieces[sq];
        
        if (code) {
          if (!el || el.getAttribute('data-piece') !== code) {
            if (el) el.remove();
            createPieceDOM(sq, code);
          } else {
            // Confirm transform translate coordinate alignment
            const { x, y } = getSquareCoords(sq);
            el.style.transform = `translate(${x}%, ${y}%)`;
            el.setAttribute('data-square', sq);
          }
        } else if (el) {
          el.remove();
          delete boardPieces[sq];
        }
      }
    }
  }

  function renderBoardHighlightDots() {
    document.querySelectorAll('.square').forEach(sqEl => {
      sqEl.classList.remove('selected', 'recommended-move-hint');
      const hint = sqEl.querySelector('.move-hint, .capture-hint');
      if (hint) hint.remove();
    });

    // Clear SVG overlay lines
    const overlay = document.getElementById('arrow-overlay');
    if (overlay) overlay.querySelectorAll('line').forEach(l => l.remove());

    if (selectedSquare) {
      const selectedSqEl = document.querySelector(`.square[data-square="${selectedSquare}"]`);
      if (selectedSqEl) selectedSqEl.classList.add('selected');

      // Draw AI Coach hint if enabled
      if (isCoachEnabled && myColor !== 'spectator') {
        const isMyTurnColor = (chess.turn() === 'w' && myColor === 'white') || (chess.turn() === 'b' && myColor === 'black') || (mode === 'local');
        if (isMyTurnColor) {
          const currentFen = chess.fen();
          const evalRes = evaluationCache[currentFen];
          if (evalRes && evalRes.scoredMoves) {
            // Find the highest scoring legal move starting from this selectedSquare
            const squareMoves = evalRes.scoredMoves.filter(m => m.move.from === selectedSquare);
            if (squareMoves.length > 0) {
              const bestMoveForPiece = squareMoves[0];
              const targetSqEl = document.querySelector(`.square[data-square="${bestMoveForPiece.move.to}"]`);
              if (targetSqEl) {
                targetSqEl.classList.add('recommended-move-hint');
                drawCoachArrow(selectedSquare, bestMoveForPiece.move.to);
              }
            }
          }
        }
      }
    }

    validMovesForSelected.forEach(move => {
      const targetSqEl = document.querySelector(`.square[data-square="${move.to}"]`);
      if (targetSqEl) {
        const hintEl = document.createElement('div');
        const hasPiece = chess.get(move.to);
        if (hasPiece) {
          hintEl.className = 'capture-hint';
        } else {
          hintEl.className = 'move-hint';
        }
        targetSqEl.appendChild(hintEl);
      }
    });
  }

  // Executes local move attempts
  function handleMoveAttempt(fromSquare, toSquare) {
    if (isProcessingMove) return;

    const legalMove = validMovesForSelected.find(m => m.from === fromSquare && m.to === toSquare);
    
    if (!legalMove) {
      selectedSquare = null;
      validMovesForSelected = [];
      renderBoardHighlightDots();
      return;
    }

    const isPawn = legalMove.piece === 'p';
    const reachedEnd = toSquare.endsWith('8') || toSquare.endsWith('1');
    
    if (isPawn && reachedEnd) {
      pendingPromotion = { from: fromSquare, to: toSquare };
      openPromotionSelector();
    } else {
      if (mode === 'online') {
        isProcessingMove = true; 
        submitMove(fromSquare, toSquare);
      } else {
        executeLocalMove(fromSquare, toSquare);
      }
    }
  }

  function openPromotionSelector() {
    const container = document.getElementById('promotion-options');
    container.innerHTML = '';
    
    const types = [
      { id: 'q', name: 'Queen' },
      { id: 'r', name: 'Rook' },
      { id: 'b', name: 'Bishop' },
      { id: 'n', name: 'Knight' }
    ];
    
    const colorPrefix = (mode === 'local') ? (chess.turn()) : (myColor === 'white' ? 'w' : 'b');
    
    types.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-glass border-secondary p-2 flex-grow-1';
      btn.style.width = '60px';
      btn.style.height = '60px';
      
      const pieceCode = colorPrefix + opt.id;
      btn.innerHTML = window.CHESS_PIECES[pieceCode];
      
      btn.addEventListener('click', () => {
        if (mode === 'online') {
          isProcessingMove = true; 
          submitMove(pendingPromotion.from, pendingPromotion.to, opt.id);
        } else {
          executeLocalMove(pendingPromotion.from, pendingPromotion.to, opt.id);
        }
        promotionModal.hide();
        pendingPromotion = null;
      });
      
      container.appendChild(btn);
    });
    
    promotionModal.show();
  }

  function submitMove(from, to, promotion = null) {
    const movePayload = { from, to };
    if (promotion) {
      movePayload.promotion = promotion;
    }
    if (socket) {
      socket.emit('make_move', movePayload);
    }
  }

  // Populate Captured pieces visually (with active-turn indicators on player cards)
  function reconstructCapturedPieces() {
    const startingCounts = {
      p: 8, n: 2, b: 2, r: 2, q: 1
    };
    
    const whitePresent = { p: 0, n: 0, b: 0, r: 0, q: 0 };
    const blackPresent = { p: 0, n: 0, b: 0, r: 0, q: 0 };
    
    const board = chess.board();
    board.forEach(row => {
      row.forEach(square => {
        if (square) {
          if (square.color === 'w') {
            whitePresent[square.type]++;
          } else {
            blackPresent[square.type]++;
          }
        }
      });
    });

    const whiteCaptured = [];
    const blackCaptured = [];
    
    Object.keys(startingCounts).forEach(type => {
      const lost = startingCounts[type] - whitePresent[type];
      for (let i = 0; i < lost; i++) {
        whiteCaptured.push('w' + type);
      }
    });
    
    Object.keys(startingCounts).forEach(type => {
      const lost = startingCounts[type] - blackPresent[type];
      for (let i = 0; i < lost; i++) {
        blackCaptured.push('b' + type);
      }
    });

    const currentActiveColor = (mode === 'local') ? 'white' : myColor;

    if (myColor === 'spectator') {
      renderCapturedSVGs(blackCaptured, playerCapturedEl);
      renderCapturedSVGs(whiteCaptured, opponentCapturedEl);
      
      const specWhiteCaptured = document.getElementById('mobile-spec-white-captured');
      const specBlackCaptured = document.getElementById('mobile-spec-black-captured');
      if (specWhiteCaptured) renderCapturedSVGs(blackCaptured, specWhiteCaptured);
      if (specBlackCaptured) renderCapturedSVGs(whiteCaptured, specBlackCaptured);
      
      const whiteCard = document.getElementById('player-card');
      const blackCard = document.getElementById('opponent-card');
      const currentTurn = chess.turn();
      if (currentTurn === 'w') {
        whiteCard.classList.add('active-turn-card');
        blackCard.classList.remove('active-turn-card');
      } else {
        blackCard.classList.add('active-turn-card');
        whiteCard.classList.remove('active-turn-card');
      }
    } else {
      const myCapturedContainer = currentActiveColor === 'white' ? playerCapturedEl : opponentCapturedEl;
      const opponentCapturedContainer = currentActiveColor === 'white' ? opponentCapturedEl : playerCapturedEl;
      
      renderCapturedSVGs(currentActiveColor === 'white' ? blackCaptured : whiteCaptured, myCapturedContainer);
      renderCapturedSVGs(currentActiveColor === 'white' ? whiteCaptured : blackCaptured, opponentCapturedContainer);

      // Sync mobile drawer tab for captured pieces
      const mobileMyCapturedContainer = document.getElementById('mobile-player-captured');
      const mobileOpponentCapturedContainer = document.getElementById('mobile-opponent-captured');
      if (mobileMyCapturedContainer && mobileOpponentCapturedContainer) {
        renderCapturedSVGs(currentActiveColor === 'white' ? blackCaptured : whiteCaptured, mobileMyCapturedContainer);
        renderCapturedSVGs(currentActiveColor === 'white' ? whiteCaptured : blackCaptured, mobileOpponentCapturedContainer);
      }

      // Apply pulsing turn styles to profile cards
      const currentTurn = chess.turn();
      const isPlayerWhite = currentActiveColor === 'white';
      
      const myProfileCard = document.getElementById('player-card');
      const opponentProfileCard = document.getElementById('opponent-card');

      if (currentTurn === 'w') {
        if (isPlayerWhite) {
          myProfileCard.classList.add('active-turn-card');
          opponentProfileCard.classList.remove('active-turn-card');
        } else {
          opponentProfileCard.classList.add('active-turn-card');
          myProfileCard.classList.remove('active-turn-card');
        }
      } else {
        if (isPlayerWhite) {
          opponentProfileCard.classList.add('active-turn-card');
          myProfileCard.classList.remove('active-turn-card');
        } else {
          myProfileCard.classList.add('active-turn-card');
          opponentProfileCard.classList.remove('active-turn-card');
        }
      }
    }
  }

  function renderCapturedSVGs(piecesArray, containerElement) {
    containerElement.innerHTML = '';
    piecesArray.forEach(code => {
      const div = document.createElement('div');
      div.className = 'd-inline-block me-1';
      div.innerHTML = window.CHESS_PIECES[code];
      containerElement.appendChild(div);
    });
  }

  // Populate Notation list in sidebar log (and mobile tab list)
  function reconstructPGNHistory(history) {
    moveListEl.innerHTML = '';
    mobileMoveListEl.innerHTML = '';
    
    for (let i = 0; i < history.length; i += 2) {
      const moveNum = Math.floor(i / 2) + 1;
      
      const rowDiv = document.createElement('div');
      rowDiv.className = 'move-row w-100';
      
      const numSpan = document.createElement('span');
      numSpan.className = 'move-num';
      numSpan.style.width = '40px';
      numSpan.style.display = 'inline-block';
      numSpan.innerText = `${moveNum}.`;
      
      const whiteMove = document.createElement('span');
      whiteMove.className = 'move-item';
      whiteMove.style.width = '40%';
      whiteMove.style.display = 'inline-block';
      whiteMove.innerText = history[i].san || history[i];
      
      rowDiv.appendChild(numSpan);
      rowDiv.appendChild(whiteMove);
      
      if (history[i + 1]) {
        const blackMove = document.createElement('span');
        blackMove.className = 'move-item';
        blackMove.style.width = '40%';
        blackMove.style.display = 'inline-block';
        blackMove.innerText = history[i + 1].san || history[i + 1];
        rowDiv.appendChild(blackMove);
      } else {
        const spacer = document.createElement('span');
        spacer.style.width = '40%';
        spacer.style.display = 'inline-block';
        rowDiv.appendChild(spacer);
      }
      
      // Append to desktop log
      moveListEl.appendChild(rowDiv.cloneNode(true));
      
      // Append to mobile log
      mobileMoveListEl.appendChild(rowDiv.cloneNode(true));

      // Append to mobile spec log
      const mobileSpecMoveList = document.getElementById('mobile-spec-move-list');
      if (mobileSpecMoveList) {
        mobileSpecMoveList.appendChild(rowDiv.cloneNode(true));
      }
    }
    
    // Auto Scroll lists
    const historyContainer = document.getElementById('move-history');
    const mobileHistoryContainer = document.getElementById('mobile-move-history');
    const mobileSpecHistoryContainer = document.getElementById('mobile-spec-move-history');
    historyContainer.scrollTop = historyContainer.scrollHeight;
    mobileHistoryContainer.scrollTop = mobileHistoryContainer.scrollHeight;
    if (mobileSpecHistoryContainer) mobileSpecHistoryContainer.scrollTop = mobileSpecHistoryContainer.scrollHeight;
  }

  // Resignation and draw handlers
  btnResign.addEventListener('click', () => {
    if (confirm('Are you sure you want to resign?')) {
      if (mode === 'online' && socket) {
        socket.emit('resign');
      } else {
        if (localTimerInterval) clearInterval(localTimerInterval);
        
        soundEngine.playGameOver();
        btnResign.disabled = true;
        btnMobileResign.disabled = true;
        btnOfferDraw.disabled = true;
        btnMobileOfferDraw.disabled = true;
        
        let outcomeTitle = 'Game Over';
        let outcomeReason = '';
        let iconHtml = '';
        let winner = null;
        
        if (mode === 'ai') {
          outcomeTitle = 'Defeat!';
          outcomeReason = `${myUsername} resigned. Computer AI wins.`;
          iconHtml = '<i class="bi bi-flag-fill text-danger" style="font-size: 3rem;"></i>';
          winner = 'black'; 
        } else {
          const activeTurnColor = chess.turn() === 'w' ? 'White' : 'Black';
          const winnerColor = chess.turn() === 'w' ? 'Black' : 'White';
          outcomeReason = `${activeTurnColor} Player resigned. ${winnerColor} Player wins.`;
          iconHtml = '<i class="bi trophy-fill text-success" style="font-size: 3rem;"></i>';
          winner = chess.turn() === 'w' ? 'black' : 'white';
        }
        
        gameOverTitle.innerText = outcomeTitle;
        gameOverReason.innerText = outcomeReason;
        document.getElementById('game-over-icon').innerHTML = iconHtml;
        
        btnRematchOffer.disabled = false;
        btnRematchOffer.innerText = 'Play Again';
        btnRematchOffer.className = 'btn btn-glass-primary py-2.5';
        
        gameOverModal.show();
        
        gameStatusAlert.innerText = `Game Over: ${outcomeTitle}`;
        gameStatusAlert.className = 'badge bg-dark border border-secondary text-secondary py-2 px-3 fw-semibold';
        
        appendSystemMessage(outcomeReason);
      }
    }
  });

  btnOfferDraw.addEventListener('click', () => {
    if (mode === 'online' && socket) {
      socket.emit('offerDraw');
      appendSystemMessage('Draw offer sent to opponent.');
    } else if (mode === 'local') {
      if (confirm('Do you both agree to a draw?')) {
        if (localTimerInterval) clearInterval(localTimerInterval);
        
        soundEngine.playGameOver();
        btnResign.disabled = true;
        btnMobileResign.disabled = true;
        btnOfferDraw.disabled = true;
        btnMobileOfferDraw.disabled = true;
        
        gameOverTitle.innerText = 'Draw!';
        gameOverReason.innerText = 'Game drawn by mutual agreement.';
        document.getElementById('game-over-icon').innerHTML = '<i class="bi bi-handshake text-info" style="font-size: 3rem;"></i>';
        
        btnRematchOffer.disabled = false;
        btnRematchOffer.innerText = 'Play Again';
        btnRematchOffer.className = 'btn btn-glass-primary py-2.5';
        
        gameOverModal.show();
        
        gameStatusAlert.innerText = 'Game Over: Draw';
        gameStatusAlert.className = 'badge bg-dark border border-secondary text-secondary py-2 px-3 fw-semibold';
        
        appendSystemMessage('Draw declared by mutual agreement.');
      }
    }
  });

  btnRematchOffer.addEventListener('click', () => {
    if (mode === 'online' && socket) {
      socket.emit('offerRematch');
      btnRematchOffer.disabled = true;
      btnRematchOffer.innerText = 'Rematch Offered...';
      btnRematchOffer.className = 'btn btn-glass py-2.5';
      appendSystemMessage('You offered a rematch.');
    } else {
      gameOverModal.hide();
      
      chess = new Chess();
      lastMove = null;
      selectedSquare = null;
      validMovesForSelected = [];
      
      gameClocks.white = timeLimit;
      gameClocks.black = timeLimit;
      updateTimerDisplays();
      
      if (mode === 'ai') {
        myColor = myColor === 'white' ? 'black' : 'white';
        setupPlayerProfiles();
        
        activeTurn = 'w';
        isMyTurn = (myColor === 'white');
        
        if (myColor === 'black') {
          triggerAIMove();
        }
      } else {
        activeTurn = 'w';
        isMyTurn = true;
      }
      
      updateStatusHeader();
      reconstructCapturedPieces();
      reconstructPGNHistory([]);
      renderBoard(false);
      
      btnResign.disabled = false;
      btnMobileResign.disabled = false;
      btnOfferDraw.disabled = (mode === 'ai'); 
      btnMobileOfferDraw.disabled = (mode === 'ai');
      
      if (timeLimit > 0) {
        startOfflineGameTimer();
      }
      
      appendSystemMessage('Fresh match started!');
    }
  });

  btnCopyLink.addEventListener('click', () => {
    const inviteUrl = `${window.location.origin}/index.html?room=${roomCode}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      const originalText = btnCopyLink.innerHTML;
      btnCopyLink.innerHTML = '<i class="bi bi-check2-circle me-1"></i> Copied!';
      btnCopyLink.className = 'btn btn-sm btn-success border-0 text-white';
      
      setTimeout(() => {
        btnCopyLink.innerHTML = originalText;
        btnCopyLink.className = 'btn btn-sm btn-glass text-success border-success border-opacity-25';
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  });

  // Desktop and Mobile Chat Message submissions
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    
    if (mode === 'online' && socket) {
      if (myColor === 'spectator') {
        socket.emit('spectator_chat', text);
      } else {
        socket.emit('chat_message', text);
      }
    }
    chatInput.value = '';
    chatInput.focus();
  });

  mobileChatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = mobileChatInput.value.trim();
    if (!text) return;
    
    if (mode === 'online' && socket) {
      if (myColor === 'spectator') {
        socket.emit('spectator_chat', text);
      } else {
        socket.emit('chat_message', text);
      }
    }
    mobileChatInput.value = '';
    mobileChatInput.focus();
  });

  // Setup Profile card names
  function setupPlayerProfiles() {
    const currentActiveColor = (mode === 'local') ? 'white' : myColor;

    if (currentActiveColor === 'white') {
      playerNameEl.innerText = myUsername;
      playerBadgeEl.innerText = 'White';
      playerBadgeEl.className = 'badge bg-white text-dark ms-1';
      
      opponentNameEl.innerText = opponentName;
      opponentBadgeEl.innerText = 'Black';
      opponentBadgeEl.className = 'badge bg-dark border border-secondary text-secondary ms-1';
    } else {
      playerNameEl.innerText = myUsername;
      playerBadgeEl.innerText = 'Black';
      playerBadgeEl.className = 'badge bg-dark border border-secondary text-secondary ms-1';
      
      opponentNameEl.innerText = opponentName;
      opponentBadgeEl.innerText = 'White';
      opponentBadgeEl.className = 'badge bg-white text-dark ms-1';
    }
  }

  function updateStatusHeader() {
    const desktopStatus = document.getElementById('desktop-game-status');
    
    if (myColor === 'spectator') {
      const displayTurn = activeTurn === 'w' ? 'White' : 'Black';
      gameStatusAlert.innerText = `${displayTurn}'s Turn`;
      gameStatusAlert.className = 'badge bg-info badge-custom py-2 px-3 fw-semibold';
      
      if (desktopStatus) {
        desktopStatus.innerText = `${displayTurn}'s Turn`;
        desktopStatus.className = 'fw-bold h6 mb-0 text-info';
      }
      return;
    }

    const currentTurn = chess.turn();

    if (mode === 'local') {
      const activeName = currentTurn === 'w' ? 'White Player' : 'Black Player';
      gameStatusAlert.innerText = `${activeName}'s Turn`;
      gameStatusAlert.className = 'badge bg-success badge-custom py-2 px-3 fw-semibold';
      
      if (desktopStatus) {
        desktopStatus.innerText = `${activeName}'s Turn`;
        desktopStatus.className = 'fw-bold h6 mb-0 text-success';
      }
    } else {
      const isPlayerTurn = (currentTurn === 'w' && myColor === 'white') || (currentTurn === 'b' && myColor === 'black');
      if (isPlayerTurn) {
        gameStatusAlert.innerText = 'Your Turn';
        gameStatusAlert.className = 'badge bg-success badge-custom py-2 px-3 fw-semibold';
        
        if (desktopStatus) {
          desktopStatus.innerText = 'Your Turn';
          desktopStatus.className = 'fw-bold h6 mb-0 text-success';
        }
      } else {
        gameStatusAlert.innerText = "Opponent's Turn";
        gameStatusAlert.className = 'badge bg-dark border border-secondary text-secondary py-2 px-3 fw-semibold';
        
        if (desktopStatus) {
          desktopStatus.innerText = "Opponent's Turn";
          desktopStatus.className = 'fw-bold h6 mb-0 text-secondary';
        }
      }
    }
  }

  function formatTime(seconds) {
    if (seconds === 0 && timeLimit === 0) return '∞';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function updateTimerDisplays() {
    const whiteFormatted = formatTime(gameClocks.white);
    const blackFormatted = formatTime(gameClocks.black);
    
    const currentActiveColor = (mode === 'local') ? 'white' : myColor;

    if (myColor === 'spectator') {
      playerTimerEl.innerText = whiteFormatted;
      opponentTimerEl.innerText = blackFormatted;
      toggleLowTimeClass(playerTimerEl, gameClocks.white);
      toggleLowTimeClass(opponentTimerEl, gameClocks.black);
      
      const specWhiteTimer = document.getElementById('mobile-spec-white-timer');
      const specBlackTimer = document.getElementById('mobile-spec-black-timer');
      if (specWhiteTimer) specWhiteTimer.innerText = whiteFormatted;
      if (specBlackTimer) specBlackTimer.innerText = blackFormatted;
    } else {
      if (currentActiveColor === 'white') {
        playerTimerEl.innerText = whiteFormatted;
        opponentTimerEl.innerText = blackFormatted;
        
        toggleLowTimeClass(playerTimerEl, gameClocks.white);
        toggleLowTimeClass(opponentTimerEl, gameClocks.black);
      } else {
        playerTimerEl.innerText = blackFormatted;
        opponentTimerEl.innerText = whiteFormatted;
        
        toggleLowTimeClass(playerTimerEl, gameClocks.black);
        toggleLowTimeClass(opponentTimerEl, gameClocks.white);
      }
    }
  }

  function toggleLowTimeClass(element, seconds) {
    if (timeLimit > 0 && seconds < 10) {
      element.classList.add('low-time');
    } else {
      element.classList.remove('low-time');
    }
  }

  function appendChatMessage(sender, color, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-message';
    
    const senderColorClass = color === 'white' ? 'white' : 'black';
    msgDiv.innerHTML = `
      <span class="message-sender ${senderColorClass}">${escapeHtml(sender)}:</span>
      <span class="message-text text-white-50">${escapeHtml(text)}</span>
    `;
    
    // Append to desktop chat
    chatMessagesEl.appendChild(msgDiv.cloneNode(true));
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;

    // Append to mobile chat drawer tab
    mobileChatMessagesEl.appendChild(msgDiv.cloneNode(true));
    mobileChatMessagesEl.scrollTop = mobileChatMessagesEl.scrollHeight;
  }

  function appendSystemMessage(msg) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-message';
    msgDiv.innerHTML = `<span class="message-system">${msg}</span>`;
    
    // Append to desktop chat
    chatMessagesEl.appendChild(msgDiv.cloneNode(true));
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;

    // Append to mobile chat tab drawer
    mobileChatMessagesEl.appendChild(msgDiv.cloneNode(true));
    mobileChatMessagesEl.scrollTop = mobileChatMessagesEl.scrollHeight;
  }

  function escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
  }

  // ==========================================================================
  // Spectator Mode Support Functions
  // ==========================================================================

  function updateEvaluationBar() {
    if (myColor !== 'spectator' && !isCoachEnabled) return;
    const board = chess.board();
    let score = 0;
    const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p) {
          const val = pieceValues[p.type] || 0;
          if (p.color === 'w') {
            score += val;
          } else {
            score -= val;
          }
        }
      }
    }
    let clampedScore = Math.max(-8, Math.min(8, score));
    let heightPct = ((clampedScore + 8) / 16) * 100;
    
    const evalFill = document.getElementById('eval-fill');
    const evalText = document.getElementById('eval-text');
    if (evalFill && evalText) {
      evalFill.style.height = `${heightPct}%`;
      let displayScore = score > 0 ? `+${score.toFixed(1)}` : (score < 0 ? `${score.toFixed(1)}` : '0.0');
      evalText.innerText = displayScore;
    }
  }

  function updateSpectatorCountDisplays(count) {
    const headerCount = document.getElementById('header-spec-count');
    const bottomCount = document.getElementById('bottom-spec-count');
    const mobileCount = document.getElementById('mobile-spec-count-display');
    if (headerCount) headerCount.innerText = count;
    if (bottomCount) bottomCount.innerText = `${count} spectator${count === 1 ? '' : 's'}`;
    if (mobileCount) mobileCount.innerText = `${count} spectator${count === 1 ? '' : 's'}`;
  }

  function logSpectatorEvent(message) {
    const logEl = document.getElementById('mobile-spec-events-log');
    if (logEl) {
      const div = document.createElement('div');
      div.className = 'chat-message my-1';
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      div.innerHTML = `<span class="text-secondary small me-2">[${time}]</span> <span class="message-text">${message}</span>`;
      logEl.appendChild(div);
      logEl.scrollTop = logEl.scrollHeight;
    }
    
    // Also log to main desktop chat for convenience of the broadcast screen
    const systemDiv = document.createElement('div');
    systemDiv.className = 'chat-message';
    systemDiv.innerHTML = `<span class="message-system">${message}</span>`;
    chatMessagesEl.appendChild(systemDiv);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  }

  function findKingSquare(color) {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    for (let r = 1; r <= 8; r++) {
      for (let f = 0; f < 8; f++) {
        const sq = files[f] + r;
        const piece = chess.get(sq);
        if (piece && piece.type === 'k' && piece.color === color) {
          return sq;
        }
      }
    }
    return null;
  }

  // Bind spectator playback buttons
  const btnPauseLive = document.getElementById('btn-pause-live');
  if (btnPauseLive) {
    btnPauseLive.addEventListener('click', () => {
      isLivePaused = !isLivePaused;
      const pauseIcon = document.getElementById('pause-icon');
      const pauseText = document.getElementById('pause-text');
      
      if (isLivePaused) {
        btnPauseLive.className = 'btn btn-sm btn-danger px-2.5';
        if (pauseIcon) pauseIcon.className = 'bi bi-play-fill';
        if (pauseText) pauseText.innerText = 'Resume';
        logSpectatorEvent('Live broadcast paused.');
      } else {
        btnPauseLive.className = 'btn btn-sm btn-glass px-2.5';
        if (pauseIcon) pauseIcon.className = 'bi bi-pause-fill';
        if (pauseText) pauseText.innerText = 'Pause';
        logSpectatorEvent('Resuming live broadcast...');
        
        if (latestSpectatorState) {
          if (latestSpectatorState.gameOver) {
            soundEngine.playGameOver();
            showLocalGameOverModal(latestSpectatorState.winner, latestSpectatorState.reason, latestSpectatorState.winnerName);
          } else if (latestSpectatorState.fen) {
            chess.load(latestSpectatorState.fen);
            renderBoard(true, latestSpectatorState.lastMove, latestSpectatorState.fen);
            gameClocks.white = latestSpectatorState.clocks.white;
            gameClocks.black = latestSpectatorState.clocks.black;
            updateTimerDisplays();
            reconstructCapturedPieces();
            reconstructPGNHistory(latestSpectatorState.pgnUpdate);
            updateEvaluationBar();
          }
          latestSpectatorState = null;
        }
        
        if (socket) {
          socket.emit('request_spectator_state');
        }
      }
    });
  }

  // Bind speed buttons
  const speed05 = document.getElementById('speed-0.5');
  const speed1 = document.getElementById('speed-1');
  const speed2 = document.getElementById('speed-2');
  const speedSpan = document.getElementById('current-speed');
  
  if (speed05 && speedSpan) {
    speed05.addEventListener('click', (e) => {
      e.preventDefault();
      speedSpan.innerText = '0.5x';
      logSpectatorEvent('Broadcast playback speed set to 0.5x');
    });
  }
  if (speed1 && speedSpan) {
    speed1.addEventListener('click', (e) => {
      e.preventDefault();
      speedSpan.innerText = '1x';
      logSpectatorEvent('Broadcast playback speed set to 1x');
    });
  }
  if (speed2 && speedSpan) {
    speed2.addEventListener('click', (e) => {
      e.preventDefault();
      speedSpan.innerText = '2x';
      logSpectatorEvent('Broadcast playback speed set to 2x');
    });
  }

  // ==========================================================================
  // Real-Time AI Coach & Hint Evaluator Logic (Frontend Heuristics)
  // ==========================================================================

  function evaluateCurrentPosition() {
    if (!isCoachEnabled || myColor === 'spectator') {
      clearCoachOverlays();
      return;
    }
    
    const positionFen = chess.fen();
    showCoachThinking(true);
    
    setTimeout(() => {
      if (evaluationCache[positionFen]) {
        displayCoachResults(evaluationCache[positionFen]);
        showCoachThinking(false);
        return;
      }
      
      const result = runHeuristicEvaluation(positionFen);
      evaluationCache[positionFen] = result;
      displayCoachResults(result);
      showCoachThinking(false);
    }, 100);
  }

  function showCoachThinking(show) {
    const spinner = document.getElementById('coach-thinking-spinner');
    const mobSpinner = document.getElementById('mobile-coach-thinking-spinner');
    if (spinner) {
      if (show) spinner.classList.remove('d-none');
      else spinner.classList.add('d-none');
    }
    if (mobSpinner) {
      if (show) mobSpinner.classList.remove('d-none');
      else mobSpinner.classList.add('d-none');
    }
  }

  function runHeuristicEvaluation(fen) {
    const tempChess = new Chess(fen);
    const activeColor = tempChess.turn();
    const legalMoves = tempChess.moves({ verbose: true });
    
    if (legalMoves.length === 0) {
      return {
        bestMove: null,
        alternatives: [],
        winChance: 50,
        scoredMoves: []
      };
    }
    
    const scoredMoves = legalMoves.map(move => {
      tempChess.load(fen);
      const appliedMove = tempChess.move(move);
      
      let score = 0;
      if (!appliedMove) return { move, score: -9999 };
      
      // 1. Checkmate priority
      if (tempChess.in_checkmate()) {
        score += 10000;
      }
      
      // 2. Checks
      if (tempChess.in_check()) {
        score += 60;
      }
      
      // 3. Captures & Material advantage
      const pieceValues = { p: 10, n: 30, b: 30, r: 50, q: 90, k: 0 };
      if (move.captured) {
        const capturedVal = pieceValues[move.captured] || 0;
        const attackerVal = pieceValues[move.piece] || 0;
        score += capturedVal * 1.5;
        if (attackerVal < capturedVal) {
          score += (capturedVal - attackerVal) * 2;
        }
      }
      
      // 4. Center control
      const centerSquares = ['d4', 'd5', 'e4', 'e5', 'c4', 'c5', 'f4', 'f5'];
      if (centerSquares.includes(move.to)) {
        score += 12;
      }
      
      // 5. Piece development
      if (['n', 'b'].includes(move.piece)) {
        const isWhite = move.color === 'w';
        const startingRank = isWhite ? '1' : '8';
        if (move.from.endsWith(startingRank)) {
          score += 15;
        }
      }
      
      // 6. Castling security
      if (move.flags.includes('k') || move.flags.includes('q')) {
        score += 40;
      }
      
      // 7. Prevent moving into attack
      const oppMoves = tempChess.moves({ verbose: true });
      const isAttacked = oppMoves.some(m => m.to === move.to && m.captured);
      if (isAttacked) {
        const pieceVal = pieceValues[move.piece] || 0;
        score -= pieceVal * 1.2;
      }
      
      return {
        move,
        score,
        san: appliedMove.san
      };
    });
    
    scoredMoves.sort((a, b) => b.score - a.score);
    
    const bestMove = scoredMoves[0];
    const alternatives = scoredMoves.slice(1, 4).filter(m => m.score > -100);
    
    let materialDiff = calculateMaterialDifference(tempChess, activeColor);
    let winChance = 50 + (materialDiff * 4);
    if (bestMove && bestMove.score > 20) {
      winChance += 5;
    }
    winChance = Math.max(5, Math.min(95, winChance));
    
    return {
      bestMove,
      alternatives,
      winChance: Math.round(winChance),
      scoredMoves
    };
  }

  function calculateMaterialDifference(chessObj, activeColor) {
    const board = chessObj.board();
    const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    let material = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p) {
          const val = pieceValues[p.type] || 0;
          if (p.color === activeColor) {
            material += val;
          } else {
            material -= val;
          }
        }
      }
    }
    return material;
  }

  function displayCoachResults(result) {
    const descContainer = document.getElementById('coach-suggestions-container');
    const mobContainer = document.getElementById('mobile-coach-suggestions-container');
    const descProbability = document.getElementById('eval-probability');
    const mobProbability = document.getElementById('mobile-eval-probability');
    
    if (!result.bestMove) {
      const emptyHtml = `
        <div class="text-center py-3 text-secondary-50 small">
          <i class="bi bi-robot fs-3 block mb-2 text-success"></i>
          <div>No moves available. Match has ended!</div>
        </div>
      `;
      if (descContainer) descContainer.innerHTML = emptyHtml;
      if (mobContainer) mobContainer.innerHTML = emptyHtml;
      return;
    }
    
    const bestMoveExplanation = getMoveExplanation(result.bestMove.move);
    
    const bestMoveHtml = `
      <div class="coach-move-pill move-quality-excellent mb-2">
        <div>
          <span class="badge bg-success me-2">Best</span>
          <span class="fw-extrabold text-white fs-5">${result.bestMove.san}</span>
          <div class="small text-secondary mt-1">${bestMoveExplanation}</div>
        </div>
      </div>
    `;
    
    let altsHtml = '';
    result.alternatives.forEach((alt, idx) => {
      const qualityClass = idx === 0 ? 'move-quality-good' : 'move-quality-risky';
      const qualityBadge = idx === 0 ? 'bg-primary' : 'bg-warning text-dark';
      const qualityName = idx === 0 ? 'Good' : 'Risky';
      const altExplanation = getMoveExplanation(alt.move);
      altsHtml += `
        <div class="coach-move-pill ${qualityClass} mb-2">
          <div>
            <span class="badge ${qualityBadge} me-2">${qualityName}</span>
            <span class="fw-bold text-white-50">${alt.san}</span>
            <div class="small text-secondary mt-1">${altExplanation}</div>
          </div>
        </div>
      `;
    });
    
    const fullHtml = bestMoveHtml + (altsHtml || '<div class="text-secondary small">No strong alternatives.</div>');
    
    if (descContainer) descContainer.innerHTML = fullHtml;
    if (mobContainer) mobContainer.innerHTML = fullHtml;
    
    const myPercentage = result.winChance;
    const oppPercentage = 100 - myPercentage;
    const probText = `${myPercentage}% / ${oppPercentage}%`;
    if (descProbability) descProbability.innerText = probText;
    if (mobProbability) mobProbability.innerText = probText;
  }

  function getMoveExplanation(move) {
    const pieceNames = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };
    const pieceName = pieceNames[move.piece] || 'Piece';
    
    if (move.flags.includes('k') || move.flags.includes('q')) {
      return 'Secures king safety and connects the rooks.';
    }
    if (move.captured) {
      const capturedPiece = pieceNames[move.captured] || 'piece';
      return `Captures opponent's ${capturedPiece} on ${move.to}.`;
    }
    if (move.flags.includes('p')) {
      return 'Promotes a passed pawn to an active major piece!';
    }
    
    const centerSquares = ['d4', 'd5', 'e4', 'e5', 'c4', 'c5', 'f4', 'f5'];
    if (centerSquares.includes(move.to)) {
      return `Positions the ${pieceName.toLowerCase()} to claim space in the center.`;
    }
    
    const isWhite = move.color === 'w';
    const startingRank = isWhite ? '1' : '8';
    if (['n', 'b'].includes(move.piece) && move.from.endsWith(startingRank)) {
      return `Develops the ${pieceName.toLowerCase()} to activate piece coordination.`;
    }
    
    return `Coordinates the ${pieceName.toLowerCase()} towards ${move.to}.`;
  }

  function clearCoachOverlays() {
    const overlay = document.getElementById('arrow-overlay');
    if (overlay) overlay.querySelectorAll('line').forEach(l => l.remove());
    document.querySelectorAll('.square').forEach(sqEl => {
      sqEl.classList.remove('recommended-move-hint');
    });
    removeMoveFeedback();
  }

  function drawCoachArrow(fromSq, toSq) {
    const overlay = document.getElementById('arrow-overlay');
    if (!overlay) return;
    
    overlay.querySelectorAll('line').forEach(l => l.remove());
    
    const fromCoords = getSquareCoords(fromSq);
    const toCoords = getSquareCoords(toSq);
    
    const x1 = fromCoords.x + 50;
    const y1 = fromCoords.y + 50;
    const x2 = toCoords.x + 50;
    const y2 = toCoords.y + 50;
    
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('stroke', 'gold');
    line.setAttribute('stroke-width', '12');
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('opacity', '0.78');
    line.setAttribute('marker-end', 'url(#arrowhead)');
    
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.hypot(dx, dy);
    if (distance > 30) {
      const offset = 30;
      const ratio = (distance - offset) / distance;
      const adjX2 = x1 + dx * ratio;
      const adjY2 = y1 + dy * ratio;
      line.setAttribute('x2', adjX2);
      line.setAttribute('y2', adjY2);
    }
    
    overlay.appendChild(line);
  }

  function checkMoveQuality(move) {
    if (!isCoachEnabled) return;
    const prevFen = chess.fen();
    const prevEval = evaluationCache[prevFen];
    if (prevEval && prevEval.scoredMoves) {
      const bestMove = prevEval.bestMove;
      const playedMove = prevEval.scoredMoves.find(m => m.move.from === move.from && m.move.to === move.to);
      
      if (playedMove) {
        if (bestMove && playedMove.move.from === bestMove.move.from && playedMove.move.to === bestMove.move.to) {
          showMoveFeedback('excellent');
        } else {
          const index = prevEval.scoredMoves.indexOf(playedMove);
          if (index > 0 && index < 3) {
            showMoveFeedback('good');
          } else {
            const bestScore = bestMove ? bestMove.score : 0;
            const playedScore = playedMove.score;
            if (bestScore - playedScore > 80) {
              showMoveFeedback('blunder');
            } else {
              showMoveFeedback('inaccuracy');
            }
          }
        }
      }
    }
  }

  function showMoveFeedback(quality) {
    removeMoveFeedback();
    
    const boardWrapper = document.querySelector('.chess-board-wrapper');
    if (!boardWrapper) return;
    
    const alert = document.createElement('div');
    alert.className = `move-feedback-alert feedback-${quality}`;
    
    let text = '';
    if (quality === 'excellent') text = '✔ Excellent move!';
    else if (quality === 'good') text = 'Good move';
    else if (quality === 'inaccuracy') text = '⚠ Inaccuracy';
    else if (quality === 'blunder') text = '❌ Blunder risk detected';
    
    alert.innerText = text;
    boardWrapper.appendChild(alert);
    
    setTimeout(() => alert.classList.add('show'), 10);
    
    currentFeedbackTimeout = setTimeout(() => {
      alert.classList.remove('show');
      setTimeout(() => alert.remove(), 300);
    }, 1800);
  }

  function removeMoveFeedback() {
    if (currentFeedbackTimeout) {
      clearTimeout(currentFeedbackTimeout);
      currentFeedbackTimeout = null;
    }
    const existing = document.querySelectorAll('.move-feedback-alert');
    existing.forEach(el => el.remove());
  }
});

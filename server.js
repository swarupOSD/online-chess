const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Chess } = require('chess.js');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Serve static folders and files explicitly and securely from the root
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/game.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'game.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Fallback to lobby for unknown routes
app.get('*', (req, res) => {
  res.redirect('/index.html');
});

// Game rooms database (in-memory)
const rooms = {};

// Helper to generate a unique 6-digit room code
function generateRoomCode() {
  let code;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (rooms[code]);
  return code;
}

// Helper to clean up room timers, intervals, and timeouts to prevent memory leaks
function clearRoomTimers(room) {
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }
  if (room.reconnectTimers.white) {
    clearTimeout(room.reconnectTimers.white);
    room.reconnectTimers.white = null;
  }
  if (room.reconnectTimers.black) {
    clearTimeout(room.reconnectTimers.black);
    room.reconnectTimers.black = null;
  }
}

// Start game timer ticking (Server-Authoritative Clock Control)
function startGameTimer(roomCode) {
  const room = rooms[roomCode];
  if (!room || room.timeLimit === 0 || room.gameOver) return;

  if (room.timerInterval) {
    clearInterval(room.timerInterval);
  }

  room.lastMoveTimestamp = Date.now();

  room.timerInterval = setInterval(() => {
    const activeColor = room.chessState.turn() === 'w' ? 'white' : 'black';
    const activePlayer = room.players[activeColor];

    if (activePlayer && activePlayer.connected) {
      const now = Date.now();
      const elapsed = Math.floor((now - room.lastMoveTimestamp) / 1000);

      if (elapsed > 0) {
        activePlayer.timeLeft = Math.max(0, activePlayer.timeLeft - elapsed);
        room.lastMoveTimestamp = now;

        // Broadcast clock_update to room
        io.to(roomCode).emit('clock_update', {
          white: room.players.white.timeLeft,
          black: room.players.black ? room.players.black.timeLeft : room.timeLimit
        });

        // Broadcast spectator_clock_sync to spectators
        if (room.spectators && room.spectators.length > 0) {
          room.spectators.forEach(spectatorId => {
            io.to(spectatorId).emit('spectator_clock_sync', {
              whiteTime: room.players.white.timeLeft,
              blackTime: room.players.black ? room.players.black.timeLeft : room.timeLimit,
              activePlayer: activeColor,
              serverTimestamp: Date.now()
            });
          });
        }

        // Check for timeout
        if (activePlayer.timeLeft <= 0) {
          clearRoomTimers(room);
          room.gameOver = true;
          const winner = activeColor === 'white' ? 'black' : 'white';
          
          io.to(roomCode).emit('gameOver', {
            winner: winner,
            reason: 'timeout',
            winnerName: room.players[winner] ? room.players[winner].name : winner
          });
        }
      }
    }
  }, 1000);
}

// Socket.io Connection Logic
io.on('connection', (socket) => {
  let userRoomCode = null;
  let userColor = null;
  let userUsername = null;

  console.log(`Socket connected: ${socket.id}`);

  // Consolidated Player Join / Create Room Handler
  socket.on('player_join', ({ username, roomCode, preferredColor, timeLimit, isCreation }) => {
    userUsername = username;

    // 1. Room Creation
    if (isCreation) {
      const code = generateRoomCode();
      const parsedTime = parseInt(timeLimit, 10);

      rooms[code] = {
        code: code,
        timeLimit: parsedTime,
        players: {
          white: null,
          black: null
        },
        spectators: [],
        chessState: new Chess(),
        gameOver: false,
        drawOfferFrom: null,
        rematchOffers: { white: false, black: false },
        reconnectTimers: { white: null, black: null },
        timerInterval: null,
        locked: false,
        lastMoveTimestamp: null
      };

      // Assign requested color or pick random
      let assignedColor = preferredColor;
      if (preferredColor === 'random') {
        assignedColor = Math.random() < 0.5 ? 'white' : 'black';
      }

      rooms[code].players[assignedColor] = {
        socketId: socket.id,
        name: username,
        connected: true,
        timeLeft: parsedTime,
        lastActive: Date.now()
      };

      userRoomCode = code;
      userColor = assignedColor;

      socket.join(code);
      
      // Emit sync_state to initialize room dashboard on client
      socket.emit('sync_state', {
        roomCode: code,
        myColor: assignedColor,
        myUsername: username,
        timeLimit: parsedTime,
        fen: rooms[code].chessState.fen(),
        pgn: rooms[code].chessState.history({ verbose: true }),
        turn: rooms[code].chessState.turn(),
        clocks: {
          white: parsedTime,
          black: parsedTime
        },
        opponentName: null,
        opponentConnected: false
      });

      console.log(`Room ${code} created by ${username} (${assignedColor})`);
      return;
    }

    // 2. Joining existing room
    const code = roomCode;
    const room = rooms[code];

    if (!room) {
      socket.emit('invalid_move', { error: 'Room not found! Check your code.' });
      return;
    }

    if (room.gameOver) {
      socket.emit('invalid_move', { error: 'This game has already finished.' });
      return;
    }

    // Reconnection State Restore
    let reconnecting = false;
    let assignedColor = null;

    if (room.players.white && room.players.white.name === username && !room.players.white.connected) {
      reconnecting = true;
      assignedColor = 'white';
    } else if (room.players.black && room.players.black.name === username && !room.players.black.connected) {
      reconnecting = true;
      assignedColor = 'black';
    }

    if (reconnecting) {
      // Cancel reconnect timer
      if (room.reconnectTimers[assignedColor]) {
        clearTimeout(room.reconnectTimers[assignedColor]);
        room.reconnectTimers[assignedColor] = null;
      }

      room.players[assignedColor].socketId = socket.id;
      room.players[assignedColor].connected = true;

      userRoomCode = code;
      userColor = assignedColor;

      socket.join(code);
      
      // Restore full state of the board, timers, and opponent connection status
      socket.emit('sync_state', {
        roomCode: code,
        myColor: assignedColor,
        myUsername: username,
        timeLimit: room.timeLimit,
        fen: room.chessState.fen(),
        pgn: room.chessState.history({ verbose: true }),
        turn: room.chessState.turn(),
        clocks: {
          white: room.players.white ? room.players.white.timeLeft : room.timeLimit,
          black: room.players.black ? room.players.black.timeLeft : room.timeLimit
        },
        opponentName: assignedColor === 'white' 
          ? (room.players.black ? room.players.black.name : null) 
          : (room.players.white ? room.players.white.name : null),
        opponentConnected: assignedColor === 'white' 
          ? (room.players.black ? room.players.black.connected : false) 
          : (room.players.white ? room.players.white.connected : false)
      });

      // Broadcast reconnection notification to the room
      socket.to(code).emit('player_join', {
        color: assignedColor,
        name: username,
        connected: true
      });

      // Resume clock countdown if both players connected
      if (room.players.white && room.players.black && room.timeLimit > 0) {
        startGameTimer(code);
      }

      console.log(`Player ${username} reconnected to Room ${code} as ${assignedColor}`);
      return;
    }

    // Assign empty slot
    if (!room.players.white) {
      assignedColor = 'white';
    } else if (!room.players.black) {
      assignedColor = 'black';
    } else {
      // Spectator join
      room.spectators.push(socket.id);
      userRoomCode = code;
      userColor = 'spectator';

      socket.join(code);
      
      socket.emit('sync_state', {
        roomCode: code,
        myColor: 'spectator',
        myUsername: username,
        timeLimit: room.timeLimit,
        fen: room.chessState.fen(),
        pgn: room.chessState.history({ verbose: true }),
        turn: room.chessState.turn(),
        clocks: {
          white: room.players.white ? room.players.white.timeLeft : room.timeLimit,
          black: room.players.black ? room.players.black.timeLeft : room.timeLimit
        },
        opponentName: room.players.white ? room.players.white.name : 'White',
        opponentConnected: room.players.white ? room.players.white.connected : false,
        blackName: room.players.black ? room.players.black.name : null,
        blackConnected: room.players.black ? room.players.black.connected : false,
        spectatorCount: room.spectators.length
      });

      io.to(code).emit('spectator_count_update', { count: room.spectators.length });

      console.log(`Spectator joined Room ${code}`);
      return;
    }

    // Populate newly assigned player slot
    room.players[assignedColor] = {
      socketId: socket.id,
      name: username,
      connected: true,
      timeLeft: room.timeLimit,
      lastActive: Date.now()
    };

    userRoomCode = code;
    userColor = assignedColor;

    socket.join(code);
    
    socket.emit('sync_state', {
      roomCode: code,
      myColor: assignedColor,
      myUsername: username,
      timeLimit: room.timeLimit,
      fen: room.chessState.fen(),
      pgn: room.chessState.history({ verbose: true }),
      turn: room.chessState.turn(),
      clocks: {
        white: room.players.white ? room.players.white.timeLeft : room.timeLimit,
        black: room.players.black ? room.players.black.timeLeft : room.timeLimit
      },
      opponentName: assignedColor === 'white' 
        ? (room.players.black ? room.players.black.name : null) 
        : (room.players.white ? room.players.white.name : null),
      opponentConnected: assignedColor === 'white' 
        ? (room.players.black ? room.players.black.connected : false) 
        : (room.players.white ? room.players.white.connected : false)
    });

    socket.to(code).emit('player_join', {
      color: assignedColor,
      name: username,
      connected: true
    });

    console.log(`Player ${username} joined Room ${code} as ${assignedColor}`);

    // If both slots are now filled, start the match!
    if (room.players.white && room.players.black) {
      // Sync White player details
      io.to(room.players.white.socketId).emit('sync_state', {
        roomCode: code,
        myColor: 'white',
        myUsername: room.players.white.name,
        timeLimit: room.timeLimit,
        fen: room.chessState.fen(),
        pgn: room.chessState.history({ verbose: true }),
        turn: room.chessState.turn(),
        clocks: { white: room.players.white.timeLeft, black: room.players.black.timeLeft },
        opponentName: room.players.black.name,
        opponentConnected: true
      });

      // Sync Black player details
      io.to(room.players.black.socketId).emit('sync_state', {
        roomCode: code,
        myColor: 'black',
        myUsername: room.players.black.name,
        timeLimit: room.timeLimit,
        fen: room.chessState.fen(),
        pgn: room.chessState.history({ verbose: true }),
        turn: room.chessState.turn(),
        clocks: { white: room.players.white.timeLeft, black: room.players.black.timeLeft },
        opponentName: room.players.white.name,
        opponentConnected: true
      });

      // Start the clock ticking
      if (room.timeLimit > 0) {
        startGameTimer(code);
      }
      console.log(`Game started in Room ${code}`);
    }
  });

  // Server-Authoritative Move Execution & Validation
  socket.on('make_move', (moveData) => {
    if (!userRoomCode || !userColor || userColor === 'spectator') return;
    const room = rooms[userRoomCode];
    if (!room || room.gameOver) return;

    // 1. Move processing room lock (prevents double execution)
    if (room.locked) {
      console.log(`[Move Rejected] Room ${userRoomCode} is currently processing a move.`);
      socket.emit('invalid_move', { error: 'Move already processing. Please wait.' });
      return;
    }

    room.locked = true;

    try {
      // 2. Validate turn
      const expectedTurn = room.chessState.turn();
      if ((expectedTurn === 'w' && userColor !== 'white') || (expectedTurn === 'b' && userColor !== 'black')) {
        socket.emit('invalid_move', { error: 'It is not your turn!' });
        return;
      }

      // 3. Validate and apply move
      const move = room.chessState.move(moveData);
      if (move === null) {
        socket.emit('invalid_move', { error: 'Illegal move!' });
        return;
      }
      room.lastMove = move;

      // 4. Deduct elapsed time using server-side timestamps
      if (room.timeLimit > 0 && room.lastMoveTimestamp) {
        const elapsed = Math.floor((Date.now() - room.lastMoveTimestamp) / 1000);
        room.players[userColor].timeLeft = Math.max(0, room.players[userColor].timeLeft - elapsed);
      }
      room.lastMoveTimestamp = Date.now();

      // 5. Broadcast authoritative move_made to all users in the room
      io.to(userRoomCode).emit('move_made', {
        move: move,
        fen: room.chessState.fen(),
        pgn: room.chessState.history({ verbose: true }),
        turn: room.chessState.turn(),
        clocks: {
          white: room.players.white ? room.players.white.timeLeft : room.timeLimit,
          black: room.players.black ? room.players.black.timeLeft : room.timeLimit
        }
      });

      // Broadcast spectator_move_broadcast to room spectators
      if (room.spectators && room.spectators.length > 0) {
        room.spectators.forEach(spectatorId => {
          io.to(spectatorId).emit('spectator_move_broadcast', {
            fen: room.chessState.fen(),
            lastMove: move,
            pgnUpdate: room.chessState.history({ verbose: true }),
            moveNumber: Math.floor(room.chessState.history().length / 2) + 1,
            checkStatus: room.chessState.in_check(),
            clocks: {
              white: room.players.white ? room.players.white.timeLeft : room.timeLimit,
              black: room.players.black ? room.players.black.timeLeft : room.timeLimit
            }
          });
        });
      }

      // 6. Check game over conditions
      if (room.chessState.game_over()) {
        clearRoomTimers(room);
        room.gameOver = true;

        let reason = 'draw';
        let winner = null;
        let winnerName = null;

        if (room.chessState.in_checkmate()) {
          reason = 'checkmate';
          winner = room.chessState.turn() === 'w' ? 'black' : 'white';
          winnerName = room.players[winner].name;
        } else if (room.chessState.in_stalemate()) {
          reason = 'stalemate';
        } else if (room.chessState.in_threefold_repetition()) {
          reason = 'repetition';
        } else if (room.chessState.insufficient_material()) {
          reason = 'material';
        } else if (room.chessState.in_draw()) {
          reason = 'draw';
        }

        io.to(userRoomCode).emit('gameOver', {
          winner,
          reason,
          winnerName
        });

        // Broadcast spectator_game_end to room spectators
        if (room.spectators && room.spectators.length > 0) {
          room.spectators.forEach(spectatorId => {
            io.to(spectatorId).emit('spectator_game_end', {
              winner,
              reason,
              winnerName
            });
          });
        }
        
        console.log(`Game ended in Room ${userRoomCode} via ${reason}`);
      }
    } catch (err) {
      console.error(`Move execution error: ${err}`);
      socket.emit('invalid_move', { error: 'An error occurred processing the move.' });
    } finally {
      // Release lock
      room.locked = false;
    }
  });

  // Chat message relay
  socket.on('chat_message', (text) => {
    if (!userRoomCode || !userColor) return;
    const room = rooms[userRoomCode];
    if (!room) return;

    const senderName = room.players[userColor] ? room.players[userColor].name : 'Spectator';

    // Broadcast only via server. Sender does not render locally until broadcast.
    io.to(userRoomCode).emit('chat_message', {
      sender: senderName,
      color: userColor,
      text: text
    });
  });

  // Resignation
  socket.on('resign', () => {
    if (!userRoomCode || !userColor || userColor === 'spectator') return;
    const room = rooms[userRoomCode];
    if (!room || room.gameOver) return;

    clearRoomTimers(room);
    room.gameOver = true;
    
    const opponentColor = userColor === 'white' ? 'black' : 'white';
    const opponentName = room.players[opponentColor] ? room.players[opponentColor].name : opponentColor;

    io.to(userRoomCode).emit('gameOver', {
      winner: opponentColor,
      reason: 'resignation',
      winnerName: opponentName
    });

    console.log(`Game ended in Room ${userRoomCode} via resignation by ${userColor}`);
  });

  // Draw offers
  socket.on('offerDraw', () => {
    if (!userRoomCode || !userColor || userColor === 'spectator') return;
    const room = rooms[userRoomCode];
    if (!room || room.gameOver) return;

    room.drawOfferFrom = userColor;
    socket.to(userRoomCode).emit('drawOffered', { color: userColor });
  });

  // Draw response
  socket.on('respondDraw', ({ accept }) => {
    if (!userRoomCode || !userColor || userColor === 'spectator') return;
    const room = rooms[userRoomCode];
    if (!room || room.gameOver || !room.drawOfferFrom) return;

    if (room.drawOfferFrom === userColor) return;

    if (accept) {
      clearRoomTimers(room);
      room.gameOver = true;
      io.to(userRoomCode).emit('gameOver', {
        winner: null,
        reason: 'draw-agreement'
      });
      console.log(`Game ended in Room ${userRoomCode} via draw agreement`);
    } else {
      socket.to(userRoomCode).emit('drawDeclined');
    }
    room.drawOfferFrom = null;
  });

  // Rematch management
  socket.on('offerRematch', () => {
    if (!userRoomCode || !userColor || userColor === 'spectator') return;
    const room = rooms[userRoomCode];
    if (!room || !room.gameOver) return;

    room.rematchOffers[userColor] = true;
    socket.to(userRoomCode).emit('rematchOffered', { color: userColor });

    // If both players accept rematch, restart game and swap colors
    if (room.rematchOffers.white && room.rematchOffers.black) {
      room.chessState = new Chess();
      room.gameOver = false;
      room.rematchOffers = { white: false, black: false };
      room.drawOfferFrom = null;
      
      const tempWhite = room.players.white;
      const tempBlack = room.players.black;
      
      room.players.white = tempBlack;
      room.players.black = tempWhite;

      const whiteSocket = io.sockets.sockets.get(room.players.white.socketId);
      const blackSocket = io.sockets.sockets.get(room.players.black.socketId);
      
      if (whiteSocket) {
        whiteSocket.emit('colorSwap', 'white');
      }
      if (blackSocket) {
        blackSocket.emit('colorSwap', 'black');
      }

      room.players.white.timeLeft = room.timeLimit;
      room.players.black.timeLeft = room.timeLimit;

      // Broadcast start state
      io.to(userRoomCode).emit('gameStart', {
        players: {
          white: { name: room.players.white.name },
          black: { name: room.players.black.name }
        },
        timeLimit: room.timeLimit
      });

      if (room.timeLimit > 0) {
        startGameTimer(userRoomCode);
      }
      console.log(`Rematch started in Room ${userRoomCode}. Colors swapped.`);
    }
  });

  // Spectator Join Event
  socket.on('join_spectator', ({ roomId, username }) => {
    const room = rooms[roomId];
    if (!room) {
      socket.emit('invalid_move', { error: 'Room not found.' });
      return;
    }

    userRoomCode = roomId;
    userColor = 'spectator';
    socket.username = username || 'Spectator';

    // Add to spectators list if not already present
    if (!room.spectators.includes(socket.id)) {
      room.spectators.push(socket.id);
    }

    socket.join(roomId);

    socket.emit('spectator_sync_state', {
      fen: room.chessState.fen(),
      pgn: room.chessState.history({ verbose: true }),
      lastMove: room.lastMove || null,
      whitePlayer: {
        name: room.players.white ? room.players.white.name : 'Waiting...',
        connected: room.players.white ? room.players.white.connected : false
      },
      blackPlayer: {
        name: room.players.black ? room.players.black.name : 'Waiting...',
        connected: room.players.black ? room.players.black.connected : false
      },
      clocks: {
        white: room.players.white ? room.players.white.timeLeft : room.timeLimit,
        black: room.players.black ? room.players.black.timeLeft : room.timeLimit
      },
      gameStatus: room.chessState.turn(),
      moveNumber: Math.floor(room.chessState.history().length / 2) + 1,
      spectatorCount: room.spectators.length
    });

    io.to(roomId).emit('spectator_count_update', { count: room.spectators.length });

    console.log(`Spectator ${socket.username} joined room ${roomId} via join_spectator.`);
  });

  // Spectator Game State Request
  socket.on('request_spectator_state', () => {
    if (!userRoomCode || userColor !== 'spectator') return;
    const room = rooms[userRoomCode];
    if (!room) return;

    socket.emit('spectator_sync_state', {
      fen: room.chessState.fen(),
      pgn: room.chessState.history({ verbose: true }),
      lastMove: room.lastMove || null,
      whitePlayer: {
        name: room.players.white ? room.players.white.name : 'Waiting...',
        connected: room.players.white ? room.players.white.connected : false
      },
      blackPlayer: {
        name: room.players.black ? room.players.black.name : 'Waiting...',
        connected: room.players.black ? room.players.black.connected : false
      },
      clocks: {
        white: room.players.white ? room.players.white.timeLeft : room.timeLimit,
        black: room.players.black ? room.players.black.timeLeft : room.timeLimit
      },
      gameStatus: room.chessState.turn(),
      moveNumber: Math.floor(room.chessState.history().length / 2) + 1,
      spectatorCount: room.spectators.length
    });
  });

  // Spectator chat message
  socket.on('spectator_chat', (text) => {
    if (!userRoomCode || userColor !== 'spectator') return;
    const room = rooms[userRoomCode];
    if (!room) return;

    const senderName = socket.username || 'Spectator';
    room.spectators.forEach(spectatorId => {
      io.to(spectatorId).emit('spectator_chat', {
        sender: senderName,
        text: text
      });
    });
  });

  // Disconnect handling with 30s grace period and memory leak cleanup
  socket.on('disconnect', () => {
    if (!userRoomCode || !userColor) return;
    const room = rooms[userRoomCode];
    if (!room) return;

    if (userColor === 'spectator') {
      room.spectators = room.spectators.filter(id => id !== socket.id);
      io.to(userRoomCode).emit('spectator_count_update', { count: room.spectators.length });
      return;
    }

    const player = room.players[userColor];
    if (player) {
      player.connected = false;
      player.lastActive = Date.now();

      // Pause active ticking during player disconnection
      if (room.timerInterval) {
        clearInterval(room.timerInterval);
        room.timerInterval = null;
      }

      // Notify the remaining client
      socket.to(userRoomCode).emit('player_disconnect', { color: userColor });
      console.log(`Player ${player.name} (${userColor}) disconnected from Room ${userRoomCode}. 30s reconnect window started.`);

      // Grace period timer for reconnection
      room.reconnectTimers[userColor] = setTimeout(() => {
        if (!player.connected) {
          clearRoomTimers(room);
          room.gameOver = true;

          const opponentColor = userColor === 'white' ? 'black' : 'white';
          const opponent = room.players[opponentColor];

          io.to(userRoomCode).emit('gameOver', {
            winner: opponentColor,
            reason: 'abandonment',
            winnerName: opponent ? opponent.name : opponentColor
          });

          console.log(`Player ${player.name} abandoned Room ${userRoomCode}. Cleaning up room resources.`);
          
          // Complete memory leak cleanup - delete room
          delete rooms[userRoomCode];
        }
      }, 30000); // 30 seconds
    }
  });
});

// Start listening
server.listen(PORT, () => {
  console.log(`Antigravity Chess Server listening on port ${PORT}`);
});

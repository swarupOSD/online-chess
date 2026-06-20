// Professional Chess Player Profile Manager
(function() {
  const PROFILE_KEY = 'chess_player_profile';

  // 10 Vector SVG Avatars
  const AVATARS = {
    'pawn-shield': `<svg viewBox="0 0 100 100" class="avatar-svg"><defs><linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#4ade80"/><stop offset="100%" stop-color="#22c55e"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g1)" rx="20"/><path d="M50 25c-5 0-9 4-9 9 0 3 1.5 5.5 4 7-6 3-10 9-10 16v3h30v-3c0-7-4-13-10-16 2.5-1.5 4-4 4-7 0-5-4-9-9-9z" fill="#ffffff"/><path d="M30 65h40v10H30z" fill="#ffffff" opacity="0.8"/></svg>`,
    'knight-charge': `<svg viewBox="0 0 100 100" class="avatar-svg"><defs><linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#1d4ed8"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g2)" rx="20"/><path d="M35 25c0 0 8-3 15 5s7 15 7 15c0 0-3-5-10-5c0 0 2 3-2 8c-4 5-4 12-4 12c0 0-3-3-8-1c-2 4 4 6 7 6c5 0 9-2 11-6c2-4 4-6 4-6c7 1 10-3 10-3c0 0-1-7-6-13c-6-7-12-8-12-8z" fill="#ffffff"/><circle cx="43" cy="38" r="4" fill="#1d4ed8"/></svg>`,
    'rook-fort': `<svg viewBox="0 0 100 100" class="avatar-svg"><defs><linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#a855f7"/><stop offset="100%" stop-color="#7e22ce"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g3)" rx="20"/><path d="M35 30v8h30v-8H60v4h-5v-4h-10v4h-5v-4h-5zM37 42l3 25h20l3-25H37zM30 72h40v8H30z" fill="#ffffff"/></svg>`,
    'bishop-mitre': `<svg viewBox="0 0 100 100" class="avatar-svg"><defs><linearGradient id="g4" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ec4899"/><stop offset="100%" stop-color="#be185d"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g4)" rx="20"/><path d="M50 20c-10 12-15 22-15 30c0 8.3 6.7 15 15 15s15-6.7 15-15c0-8-5-18-15-30zm-3 15h6v12h-6V35zm-4 4h14v3H43v-3zM35 70h30v8H35v-8z" fill="#ffffff"/></svg>`,
    'queen-sparkle': `<svg viewBox="0 0 100 100" class="avatar-svg"><defs><linearGradient id="g5" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#d97706"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g5)" rx="20"/><path d="M30 35l7 27h26l7-27l-10 12l-10-20l-10 20l-10-12zM32 67h36v8H32z" fill="#ffffff"/><circle cx="30" cy="31" r="3" fill="#ffffff"/><circle cx="40" cy="43" r="2.5" fill="#ffffff"/><circle cx="50" cy="23" r="3" fill="#ffffff"/><circle cx="60" cy="43" r="2.5" fill="#ffffff"/><circle cx="70" cy="31" r="3" fill="#ffffff"/></svg>`,
    'king-crown': `<svg viewBox="0 0 100 100" class="avatar-svg"><defs><linearGradient id="g6" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#eab308"/><stop offset="100%" stop-color="#ca8a04"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g6)" rx="20"/><path d="M47 15h6v8h-6zm-4 3h14v3H43zM32 40c6-6 11-9 18-9s12 3 18 9H32zM30 45C38 34 42 27 50 27s12 7 20 18H30zm2 20h36v8H32v-8z" fill="#ffffff"/></svg>`,
    'tactician-brain': `<svg viewBox="0 0 100 100" class="avatar-svg"><defs><linearGradient id="g7" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#14b8a6"/><stop offset="100%" stop-color="#0f766e"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g7)" rx="20"/><path d="M50 25c-11 0-20 7-20 18c0 5 2.5 10 6 13c2 2 3 5 3 8v3h22v-3c0-3 1-6 3-8c3.5-3 6-8 6-13c0-11-9-18-20-18zm-8 12c-2.8 0-5-2.2-5-5s2.2-5 5-5s5 2.2 5 5s-2.2 5-5 5zm16 0c-2.8 0-5-2.2-5-5s2.2-5 5-5s5 2.2 5 5s-2.2 5-5 5z" fill="#ffffff" opacity="0.9"/><path d="M40 72h20v5H40z" fill="#ffffff"/></svg>`,
    'speed-lightning': `<svg viewBox="0 0 100 100" class="avatar-svg"><defs><linearGradient id="g8" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ef4444"/><stop offset="100%" stop-color="#b91c1c"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g8)" rx="20"/><path d="M55 20L35 50h15L45 80l25-40H55z" fill="#ffffff"/></svg>`,
    'alien-chess': `<svg viewBox="0 0 100 100" class="avatar-svg"><defs><linearGradient id="g9" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#06b6d4"/><stop offset="100%" stop-color="#0891b2"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g9)" rx="20"/><circle cx="50" cy="50" r="28" fill="#ffffff"/><ellipse cx="40" cy="45" rx="6" ry="10" fill="#0891b2"/><ellipse cx="60" cy="45" rx="6" ry="10" fill="#0891b2"/><path d="M42 62q8 5 16 0" stroke="#0891b2" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="40" cy="42" r="2" fill="#ffffff"/><circle cx="60" cy="42" r="2" fill="#ffffff"/></svg>`,
    'grandmaster-hat': `<svg viewBox="0 0 100 100" class="avatar-svg"><defs><linearGradient id="g10" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#64748b"/><stop offset="100%" stop-color="#334155"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g10)" rx="20"/><path d="M30 45h40v10H30z" fill="#ffffff"/><path d="M35 45V25h30v20z" fill="#ffffff" opacity="0.85"/><circle cx="42" cy="55" r="5" fill="#eab308"/><circle cx="58" cy="55" r="5" fill="#eab308"/><path d="M48 64q4 2 8 0" stroke="#ffffff" stroke-width="2.5" fill="none"/></svg>`
  };

  // 6 Custom Banners (CSS Linear Gradients)
  const BANNERS = {
    'emerald-glow': 'linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%)',
    'midnight-galaxy': 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #4c1d95 100%)',
    'sunset-gold': 'linear-gradient(135deg, #7c2d12 0%, #b45309 50%, #f59e0b 100%)',
    'obsidian-sleek': 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #334155 100%)',
    'cyberpunk-neon': 'linear-gradient(135deg, #701a75 0%, #4a044e 50%, #0369a1 100%)',
    'royal-gold': 'linear-gradient(135deg, #581c87 0%, #3b0764 50%, #a21caf 100%)'
  };

  // Default Profile Schema
  function createDefaultProfile() {
    // Generate a unique 6-digit User ID
    const randomId = 'USR-' + Math.floor(100000 + Math.random() * 900000).toString();
    const date = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const joinDate = `${months[date.getMonth()]} ${date.getFullYear()}`;

    // Get current name if it exists in localStorage
    const savedName = localStorage.getItem('chess_username') || 'GrandmasterPawn';

    return {
      username: savedName,
      playerId: randomId,
      avatar: 'pawn-shield',
      banner: 'emerald-glow',
      country: 'US',
      joinDate: joinDate,
      ratings: {
        bullet: { current: 1200, peak: 1200, lastChange: 0 },
        blitz: { current: 1200, peak: 1200, lastChange: 0 },
        rapid: { current: 1200, peak: 1200, lastChange: 0 },
        classical: { current: 1200, peak: 1200, lastChange: 0 }
      },
      stats: {
        matches: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winStreak: 0,
        bestWinStreak: 0,
        totalPlayTime: 0, // in seconds
        totalMoves: 0
      },
      achievements: {
        'first_victory': { unlocked: false, date: null },
        'wins_10': { unlocked: false, date: null },
        'wins_25': { unlocked: false, date: null },
        'wins_50': { unlocked: false, date: null },
        'wins_100': { unlocked: false, date: null },
        'win_streak_5': { unlocked: false, date: null },
        'win_streak_10': { unlocked: false, date: null },
        'chess_master': { unlocked: false, date: null },
        'tournament_winner': { unlocked: false, date: null }
      },
      history: []
    };
  }

  // Initializer
  function getProfile() {
    let data = localStorage.getItem(PROFILE_KEY);
    if (!data) {
      const def = createDefaultProfile();
      localStorage.setItem(PROFILE_KEY, JSON.stringify(def));
      return def;
    }
    try {
      const parsed = JSON.parse(data);
      // Backwards compatibility / integrity check
      if (!parsed.ratings) parsed.ratings = createDefaultProfile().ratings;
      if (!parsed.stats) parsed.stats = createDefaultProfile().stats;
      if (!parsed.achievements) parsed.achievements = createDefaultProfile().achievements;
      if (!parsed.history) parsed.history = [];
      return parsed;
    } catch(e) {
      const def = createDefaultProfile();
      localStorage.setItem(PROFILE_KEY, JSON.stringify(def));
      return def;
    }
  }

  function saveProfile(profile) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    // Keep username in sync with existing platform storage
    localStorage.setItem('chess_username', profile.username);
  }

  // Get Rating Category based on time control in seconds
  function getRatingCategory(timeLimit) {
    if (timeLimit === 0) return 'casual';
    if (timeLimit < 180) return 'bullet';      // < 3 mins
    if (timeLimit < 600) return 'blitz';       // 3 to < 10 mins
    if (timeLimit <= 1800) return 'rapid';     // 10 to 30 mins
    return 'classical';                        // > 30 mins
  }

  // Get Rank Division badge based on rating
  function getRankBadge(rating) {
    if (rating < 1000) return { name: 'Bronze', class: 'bg-bronze', icon: 'bi-shield-fill text-bronze' };
    if (rating < 1200) return { name: 'Silver', class: 'bg-silver', icon: 'bi-shield-fill text-silver' };
    if (rating < 1400) return { name: 'Gold', class: 'bg-gold', icon: 'bi-shield-fill text-gold' };
    if (rating < 1600) return { name: 'Platinum', class: 'bg-platinum', icon: 'bi-shield-fill text-platinum' };
    if (rating < 1800) return { name: 'Diamond', class: 'bg-diamond', icon: 'bi-diamond-fill text-diamond' };
    if (rating < 2000) return { name: 'Master', class: 'bg-master', icon: 'bi-award-fill text-master' };
    return { name: 'Grandmaster', class: 'bg-gm', icon: 'bi-trophy-fill text-gm' };
  }

  // Record completed match outcome
  function recordMatch(mode, timeLimit, opponentName, result, movesCount, durationSeconds) {
    const profile = getProfile();
    
    // Increment general metrics
    profile.stats.matches += 1;
    profile.stats.totalMoves += movesCount;
    profile.stats.totalPlayTime += durationSeconds;

    const ratingCat = getRatingCategory(timeLimit);
    let ratingChange = 0;

    if (result === 'win') {
      profile.stats.wins += 1;
      profile.stats.winStreak += 1;
      if (profile.stats.winStreak > profile.stats.bestWinStreak) {
        profile.stats.bestWinStreak = profile.stats.winStreak;
      }
      
      // Update ratings only for Online multiplayer matches
      if (mode === 'online' && ratingCat !== 'casual') {
        const ratingObj = profile.ratings[ratingCat];
        const gain = 12 + Math.floor(Math.random() * 7); // Gain +12 to +18
        ratingChange = gain;
        ratingObj.current += gain;
        ratingObj.lastChange = gain;
        if (ratingObj.current > ratingObj.peak) {
          ratingObj.peak = ratingObj.current;
        }
      }
    } else if (result === 'loss') {
      profile.stats.losses += 1;
      profile.stats.winStreak = 0;

      if (mode === 'online' && ratingCat !== 'casual') {
        const ratingObj = profile.ratings[ratingCat];
        const loss = 10 + Math.floor(Math.random() * 5); // Loss -10 to -14
        ratingChange = -loss;
        ratingObj.current = Math.max(100, ratingObj.current - loss);
        ratingObj.lastChange = -loss;
      }
    } else if (result === 'draw') {
      profile.stats.draws += 1;
      profile.stats.winStreak = 0;

      if (mode === 'online' && ratingCat !== 'casual') {
        const ratingObj = profile.ratings[ratingCat];
        // Draw rating changes slightly (+1 or -1 or 0)
        const change = Math.random() < 0.5 ? 1 : (Math.random() < 0.5 ? -1 : 0);
        ratingChange = change;
        ratingObj.current = Math.max(100, ratingObj.current + change);
        ratingObj.lastChange = change;
        if (ratingObj.current > ratingObj.peak) {
          ratingObj.peak = ratingObj.current;
        }
      }
    }

    // Recalculate Win Rate %
    const totalMatches = profile.stats.matches;
    profile.stats.winRate = Math.round((profile.stats.wins / totalMatches) * 100) || 0;

    // List of random avatars for opponents
    const keys = Object.keys(AVATARS);
    const opponentAvatarKey = keys[Math.floor(Math.random() * keys.length)];

    // Log to match history
    const dateObj = new Date();
    const formattedDate = `${dateObj.getDate()} ${dateObj.toLocaleString('default', { month: 'short' })} ${dateObj.getFullYear()}`;
    const timeControlStr = timeLimit === 0 ? 'Casual' : `${Math.round(timeLimit / 60)}m`;

    const matchRecord = {
      id: 'MCH-' + Math.floor(100000 + Math.random() * 900000).toString(),
      opponentName: opponentName || (mode === 'ai' ? 'Computer AI' : 'Local Opponent'),
      opponentAvatar: opponentAvatarKey,
      result: result, // 'win', 'loss', 'draw'
      date: formattedDate,
      timeControl: timeControlStr,
      mode: mode,
      ratingChange: ratingChange
    };

    profile.history.unshift(matchRecord);
    if (profile.history.length > 50) {
      profile.history.pop(); // Cap history to 50 entries
    }

    // Check Achievements updates
    checkAchievements(profile, mode, ratingCat);

    saveProfile(profile);
  }

  // Check achievements milestones
  function checkAchievements(profile, lastMode, lastRatingCat) {
    const wins = profile.stats.wins;
    const streak = profile.stats.bestWinStreak;
    const achievements = profile.achievements;
    const dateStr = new Date().toLocaleDateString();

    const triggerUnlock = (key) => {
      if (!achievements[key].unlocked) {
        achievements[key].unlocked = true;
        achievements[key].date = dateStr;
        // Trigger a custom event so the UI can play badge unlock animation if active
        const event = new CustomEvent('achievementUnlocked', { detail: { badge: key } });
        window.dispatchEvent(event);
      }
    };

    // Wins achievements
    if (wins >= 1) triggerUnlock('first_victory');
    if (wins >= 10) triggerUnlock('wins_10');
    if (wins >= 25) triggerUnlock('wins_25');
    if (wins >= 50) triggerUnlock('wins_50');
    if (wins >= 100) triggerUnlock('wins_100');

    // Streak achievements
    if (streak >= 5) triggerUnlock('win_streak_5');
    if (streak >= 10) triggerUnlock('win_streak_10');

    // Chess Master: any online rating reaches 1400
    const ratings = profile.ratings;
    if (ratings.bullet.current >= 1400 || ratings.blitz.current >= 1400 || 
        ratings.rapid.current >= 1400 || ratings.classical.current >= 1400) {
      triggerUnlock('chess_master');
    }

    // Tournament Winner: Win an online game or beat the AI
    if (lastMode === 'online' || lastMode === 'ai') {
      if (wins >= 1) triggerUnlock('tournament_winner');
    }
  }

  // Export Profile Manager to global window object
  window.ChessProfile = {
    AVATARS: AVATARS,
    BANNERS: BANNERS,
    getProfile: getProfile,
    saveProfile: saveProfile,
    recordMatch: recordMatch,
    getRankBadge: getRankBadge,
    getRatingCategory: getRatingCategory
  };
})();

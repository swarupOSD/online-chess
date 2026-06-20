// Modern vector SVGs for chess pieces. 
// Uses standard, clean vector shapes optimized for styling and scalability.
window.CHESS_PIECES = {
  // White Pieces
  wp: `<svg viewBox="0 0 45 45" class="chess-piece-svg white-piece" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-.83 1.06-1.41 2.34-1.41 3.97v3h11v-3c0-1.63-.58-2.91-1.41-3.97C28.06 24.84 29 23.03 29 21c0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
  
  wr: `<svg viewBox="0 0 45 45" class="chess-piece-svg white-piece" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 39h27v-3H9v3zm3-3h21v-4H12v4zm2.5-4l1.5-12h19l1.5 12h-22z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M12 12v8h4v-8h-4zm7 0v8h3v-8h-3zm6 0v8h3v-8h-3zm6 0v8h4v-8h-4z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M9 9v3h27V9H9z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
  
  wn: `<svg viewBox="0 0 45 45" class="chess-piece-svg white-piece" xmlns="http://www.w3.org/2000/svg">
    <path d="M 22,10 C 22,10 19,11 16,15 C 13,19 13,23 13,23 C 13,23 14,20 18,20 C 18,20 17,21 15,24 C 13,27 13,31 13,31 C 13,31 15,30 18,28 C 19,30 22,31 24,31 C 26,31 28,30 29,28 C 31,31 32,31 32,31 C 32,31 31,27 29,24 C 27,21 26,20 26,20 C 30,20 31,23 31,23 C 31,23 31,19 28,15 C 25,11 22,10 22,10 z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M 9,39 L 36,39 L 36,36 L 9,36 L 9,39 z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M 11.5,30 C 11.5,30 12,32 15,32 C 18,32 20,31 20,31 C 20,31 20,32 22,32 C 24,32 25,31 25,31 C 25,31 27,32 30,32 C 33,32 33.5,30 33.5,30 L 11.5,30 z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="17" cy="14" r="1.5" fill="#000"/>
  </svg>`,
  
  wb: `<svg viewBox="0 0 45 45" class="chess-piece-svg white-piece" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 36h27v-3H9v3zm3-3h21v-2H12v2zm3.5-2c1.5-2 3-5 3-9 0-3.5 2-6 4.5-6s4.5 2.5 4.5 6c0 4 1.5 7 3 9h-15z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="22.5" cy="11.5" r="2" fill="#fff" stroke="#000" stroke-width="1.5"/>
    <path d="M22.5 14v5M20 16.5h5" stroke="#000" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
  
  wq: `<svg viewBox="0 0 45 45" class="chess-piece-svg white-piece" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm10-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm10 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm10 3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm-15-7a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" fill="#fff" stroke="#000" stroke-width="1.5"/>
    <path d="M9 37h27v-3H9v3zm3-3h21v-3H12v3zm.5-3l2.5-17 7.5 11 7.5-11 2.5 17h-20z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  
  wk: `<svg viewBox="0 0 45 45" class="chess-piece-svg white-piece" xmlns="http://www.w3.org/2000/svg">
    <path d="M8.5 36h28v-3h-28v3zm3-3h22v-3h-22v3zm11-19.5V8M20 11h5" stroke="#000" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M11.5 30c2.5-3 5-4.5 11-4.5s8.5 1.5 11 4.5h-22z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M11.5 30C15 24 17 18 22.5 18S30 24 33.5 30h-22z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  // Black Pieces
  bp: `<svg viewBox="0 0 45 45" class="chess-piece-svg black-piece" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-.83 1.06-1.41 2.34-1.41 3.97v3h11v-3c0-1.63-.58-2.91-1.41-3.97C28.06 24.84 29 23.03 29 21c0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#313131" stroke="#000" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
  
  br: `<svg viewBox="0 0 45 45" class="chess-piece-svg black-piece" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 39h27v-3H9v3zm3-3h21v-4H12v4zm2.5-4l1.5-12h19l1.5 12h-22z" fill="#313131" stroke="#000" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M12 12v8h4v-8h-4zm7 0v8h3v-8h-3zm6 0v8h3v-8h-3zm6 0v8h4v-8h-4z" fill="#313131" stroke="#000" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M9 9v3h27V9H9z" fill="#313131" stroke="#000" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
  
  bn: `<svg viewBox="0 0 45 45" class="chess-piece-svg black-piece" xmlns="http://www.w3.org/2000/svg">
    <path d="M 22,10 C 22,10 19,11 16,15 C 13,19 13,23 13,23 C 13,23 14,20 18,20 C 18,20 17,21 15,24 C 13,27 13,31 13,31 C 13,31 15,30 18,28 C 19,30 22,31 24,31 C 26,31 28,30 29,28 C 31,31 32,31 32,31 C 32,31 31,27 29,24 C 27,21 26,20 26,20 C 30,20 31,23 31,23 C 31,23 31,19 28,15 C 25,11 22,10 22,10 z" fill="#313131" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M 9,39 L 36,39 L 36,36 L 9,36 L 9,39 z" fill="#313131" stroke="#000" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M 11.5,30 C 11.5,30 12,32 15,32 C 18,32 20,31 20,31 C 20,31 20,32 22,32 C 24,32 25,31 25,31 C 25,31 27,32 30,32 C 33,32 33.5,30 33.5,30 L 11.5,30 z" fill="#313131" stroke="#000" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="17" cy="14" r="1.5" fill="#fff"/>
  </svg>`,
  
  bb: `<svg viewBox="0 0 45 45" class="chess-piece-svg black-piece" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 36h27v-3H9v3zm3-3h21v-2H12v2zm3.5-2c1.5-2 3-5 3-9 0-3.5 2-6 4.5-6s4.5 2.5 4.5 6c0 4 1.5 7 3 9h-15z" fill="#313131" stroke="#000" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="22.5" cy="11.5" r="2" fill="#313131" stroke="#000" stroke-width="1.5"/>
    <path d="M22.5 14v5M20 16.5h5" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
  
  bq: `<svg viewBox="0 0 45 45" class="chess-piece-svg black-piece" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm10-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm10 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm10 3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm-15-7a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" fill="#313131" stroke="#000" stroke-width="1.5"/>
    <path d="M9 37h27v-3H9v3zm3-3h21v-3H12v3zm.5-3l2.5-17 7.5 11 7.5-11 2.5 17h-20z" fill="#313131" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  
  bk: `<svg viewBox="0 0 45 45" class="chess-piece-svg black-piece" xmlns="http://www.w3.org/2000/svg">
    <path d="M8.5 36h28v-3h-28v3zm3-3h22v-3h-22v3zm11-19.5V8M20 11h5" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M11.5 30c2.5-3 5-4.5 11-4.5s8.5 1.5 11 4.5h-22z" fill="#313131" stroke="#000" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M11.5 30C15 24 17 18 22.5 18S30 24 33.5 30h-22z" fill="#313131" stroke="#000" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`
};

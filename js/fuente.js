// =====================================================
// Fuentes de píxeles
//  - Fuente 3×5 (la de siempre): textos y etiquetas
//  - Dígitos grandes 5×7 (de DuMulti): números del HUD
// =====================================================
(function () {
  'use strict';

  // ---------- Fuente 3×5 (5 filas de 3 columnas) ----------
  const GLIFOS = {
    A: '.#. #.# ### #.# #.#', B: '##. #.# ##. #.# ##.', C: '.## #.. #.. #.. .##',
    D: '##. #.# #.# #.# ##.', E: '### #.. ##. #.. ###', F: '### #.. ##. #.. #..',
    G: '.## #.. #.# #.# .##', H: '#.# #.# ### #.# #.#', I: '### .#. .#. .#. ###',
    J: '..# ..# ..# #.# .#.', K: '#.# #.# ##. #.# #.#', L: '#.. #.. #.. #.. ###',
    M: '#.# ### ### #.# #.#', N: '##. #.# #.# #.# #.#', O: '.#. #.# #.# #.# .#.',
    P: '##. #.# ##. #.. #..', Q: '.#. #.# #.# ##. .##', R: '##. #.# ##. #.# #.#',
    S: '.## #.. .#. ..# ##.', T: '### .#. .#. .#. .#.', U: '#.# #.# #.# #.# ###',
    V: '#.# #.# #.# #.# .#.', W: '#.# #.# #.# ### #.#', X: '#.# #.# .#. #.# #.#',
    Y: '#.# #.# .#. .#. .#.', Z: '### ..# .#. #.. ###',
    0: '### #.# #.# #.# ###', 1: '.#. ##. .#. .#. ###', 2: '##. ..# .#. #.. ###',
    3: '##. ..# .#. ..# ##.', 4: '#.# #.# ### ..# ..#', 5: '### #.. ##. ..# ##.',
    6: '.## #.. ### #.# ###', 7: '### ..# .#. .#. .#.', 8: '### #.# ### #.# ###',
    9: '### #.# ### ..# ##.',
    ' ': '... ... ... ... ...', '.': '... ... ... ... .#.', ',': '... ... ... .#. #..',
    ':': '... .#. ... .#. ...', '-': '... ... ### ... ...', '/': '..# ..# .#. #.. #..',
    '!': '.#. .#. .#. ... .#.', '?': '##. ..# .#. ... .#.', '+': '... .#. ### .#. ...',
    '=': '... ### ... ### ...', '(': '..# .#. .#. .#. ..#', ')': '#.. .#. .#. .#. #..',
    '>': '#.. .#. ..# .#. #..', '<': '..# .#. #.. .#. ..#', "'": '.#. .#. ... ... ...',
    '*': '... #.# .#. #.# ...', 'x': '... #.# .#. #.# ...', '%': '#.# ..# .#. #.. #.#',
    '[': '.## .#. .#. .#. .##', ']': '##. .#. .#. .#. ##.', '_': '... ... ... ... ###',
    '#': '#.# ### #.# ### #.#', '|': '.#. .#. .#. .#. .#.'
  };
  const FILAS = {};
  Object.keys(GLIFOS).forEach(function (k) { FILAS[k] = GLIFOS[k].split(' '); });

  // ---------- Dígitos grandes 5×7 (HUD) ----------
  const GRANDES = {
    0: '.###. ##..# #.#.# #.#.# #.#.# #..## .###.',
    1: '..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.',
    2: '.###. #...# ....# ..##. .#... #.... #####',
    3: '####. ....# ....# .###. ....# ....# ####.',
    4: '...#. ..##. .#.#. #..#. #####. ...#. ...#.',
    5: '##### #.... ####. ....# ....# #...# .###.',
    6: '.###. #.... #.... ####. #...# #...# .###.',
    7: '##### ....# ...#. ..#.. .#... .#... .#...',
    8: '.###. #...# #...# .###. #...# #...# .###.',
    9: '.###. #...# #...# .#### ....# ....# .###.',
    '%': '##..# ##.#. ...#. ..#.. .#... .#.## #..##',
    '-': '..... ..... ..... ##### ..... ..... .....',
    ' ': '..... ..... ..... ..... ..... ..... .....'
  };
  const FILAS_G = {};
  Object.keys(GRANDES).forEach(function (k) { FILAS_G[k] = GRANDES[k].split(' ').map(function (f) { return f.slice(0, 5); }); });

  // Convierte a mayúsculas sin tildes (la fuente no tiene minúsculas). La Ñ queda como N.
  function normalizar(s) {
    return String(s).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  // Dibuja texto 3×5 con fillRect en cualquier objeto que tenga fillRect (canvas o lienzo de textura)
  function dibujarCrudo(ctx, str, x, y, color, esc) {
    esc = esc || 1;
    const s = normalizar(str);
    if (color) ctx.fillStyle = color;
    for (let n = 0; n < s.length; n++) {
      const g = FILAS[s[n]] || FILAS['?'];
      for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) {
        if (g[r][q] === '#') ctx.fillRect(x + (n * 4 + q) * esc, y + r * esc, esc, esc);
      }
    }
  }

  // Dibuja dígitos grandes 5×7 (cada carácter ocupa 6 columnas)
  function dibujarGrande(ctx, str, x, y, color, esc) {
    esc = esc || 1;
    if (color) ctx.fillStyle = color;
    const s = String(str);
    for (let n = 0; n < s.length; n++) {
      const g = FILAS_G[s[n]] || FILAS_G[' '];
      for (let r = 0; r < 7; r++) for (let q = 0; q < 5; q++) {
        if (g[r][q] === '#') ctx.fillRect(x + (n * 6 + q) * esc, y + r * esc, esc, esc);
      }
    }
  }

  W.fuente = {
    FILAS: FILAS,
    normalizar: normalizar,
    dibujarCrudo: dibujarCrudo,
    dibujarGrande: dibujarGrande,
    ancho: function (str, esc) { return Math.max(0, normalizar(str).length * 4 - 1) * (esc || 1); },
    anchoGrande: function (str, esc) { return Math.max(0, String(str).length * 6 - 1) * (esc || 1); }
  };
})();

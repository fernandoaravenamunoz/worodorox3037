// =====================================================
// Fuente de píxeles 3×5 compartida (HUD, hologramas, libreta, salas 2D)
// =====================================================
(function () {
  'use strict';

  // 5 filas de 3 columnas por letra
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
    '[': '.## .#. .#. .#. .##', ']': '##. .#. .#. .#. ##.', '_': '... ... ... ... ###'
  };
  const FILAS = {};
  Object.keys(GLIFOS).forEach(function (k) { FILAS[k] = GLIFOS[k].split(' '); });

  // Convierte a mayúsculas sin tildes (la fuente no tiene minúsculas). La Ñ queda como N.
  function normalizar(s) {
    return String(s).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  // Dibuja texto con fillRect en cualquier contexto 2D (útil para texturas)
  function dibujarCrudo(ctx, str, x, y, color, esc) {
    esc = esc || 1;
    const s = normalizar(str);
    ctx.fillStyle = color;
    for (let n = 0; n < s.length; n++) {
      const g = FILAS[s[n]] || FILAS['?'];
      for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) {
        if (g[r][q] === '#') ctx.fillRect(x + (n * 4 + q) * esc, y + r * esc, esc, esc);
      }
    }
  }

  W.fuente = {
    FILAS: FILAS,
    normalizar: normalizar,
    dibujarCrudo: dibujarCrudo,
    ancho: function (str, esc) { return (normalizar(str).length * 4 - 1) * (esc || 1); }
  };
})();

// =====================================================
// Retrato del personaje para el centro del HUD (estilo de la cara de Doom)
// Adaptado de js/ui/retrato.js de DuMulti a los 5 sobrevivientes de Worodorox.
// Se dibuja con código a partir de los colores de W.PERSONAJES[id].colores.
// Cuadros: 0 al frente, 1 mira a la izquierda, 2 mira a la derecha, 3 parpadea, 4 dolor
// =====================================================
(function () {
  'use strict';
  const TAM = 34;
  const cache = {};

  function oscuro(h, k) {
    const c = W.texturas.hexARgb(h);
    return 'rgb(' + Math.round(c[0] * k) + ',' + Math.round(c[1] * k) + ',' + Math.round(c[2] * k) + ')';
  }
  // Rasgos de cada personaje (peinado y accesorio)
  const RASGOS = {
    chispa: { peinado: 'cresta', extra: 'antiparras' },
    tuerca: { peinado: 'casco', extra: 'barba' },
    lata: { peinado: 'moño', extra: 'lentes' },
    flaco: { peinado: 'puas', extra: 'visor' },
    varilla: { peinado: 'gorra', extra: '' }
  };

  function cuadro(id, n) {
    const p = W.PERSONAJES[id] || W.PERSONAJES.chispa, c = p.colores;
    const ra = RASGOS[id] || RASGOS.chispa;
    const r = { piel: c.piel, pielS: oscuro(c.piel, 0.72), pelo: c.pelo, peloS: oscuro(c.pelo, 0.65), ropa: c.ropa, detalle: c.detalle };
    const cv = document.createElement('canvas');
    cv.width = TAM; cv.height = TAM;
    const g = cv.getContext('2d');
    const R = function (x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); };

    // Hombros y cuello
    R(3, 29, 28, 5, r.ropa); R(3, 29, 28, 1, r.detalle);
    R(12, 29, 10, 2, '#07060d');
    R(13, 24, 8, 6, r.pielS);
    // Cabeza
    R(9, 7, 16, 20, r.piel);
    R(8, 9, 18, 16, r.piel);
    R(21, 9, 5, 16, r.pielS); R(20, 25, 4, 2, r.pielS);
    R(10, 26, 12, 1, r.pielS);
    R(6, 15, 2, 6, r.piel); R(26, 15, 2, 6, r.pielS);
    // Ojos
    const dolor = n === 4;
    if (n === 3) {
      R(11, 17, 5, 1, '#3a2418'); R(19, 17, 5, 1, '#3a2418');
    } else {
      R(11, 15, 5, 4, '#e6e3ff'); R(19, 15, 5, 4, '#e6e3ff');
      const dx = n === 1 ? -1 : n === 2 ? 1 : 0;
      R(13 + dx, 16, 2, 2, '#16151f'); R(21 + dx, 16, 2, 2, '#16151f');
      R(13 + dx, 16, 1, 1, r.detalle); R(21 + dx, 16, 1, 1, r.detalle);
      if (dolor) { R(11, 15, 5, 1, r.pielS); R(19, 15, 5, 1, r.pielS); }
    }
    R(10, dolor ? 14 : 13, 6, 1, r.peloS); R(19, dolor ? 14 : 13, 6, 1, r.peloS);
    R(17, 18, 2, 4, r.pielS); R(16, 21, 3, 1, r.pielS);
    R(10, 20, 2, 1, '#c05a4a'); R(23, 20, 2, 1, '#a04a3a');
    if (dolor) { R(14, 23, 7, 2, '#3a1418'); R(15, 23, 5, 1, '#e6e3ff'); }
    else { R(13, 23, 9, 2, '#3a1418'); R(14, 23, 7, 1, '#e6e3ff'); R(21, 22, 1, 1, '#3a1418'); }

    // Peinado
    switch (ra.peinado) {
      case 'puas': {
        R(7, 6, 20, 6, r.pelo); R(7, 10, 3, 5, r.pelo); R(24, 10, 3, 4, r.peloS);
        const puas = [[7, 6, -2], [10, 9, -1], [14, 7, 0], [17, 10, 1], [21, 8, 1], [24, 5, 2]];
        for (const q of puas) for (let j = 0; j < q[1]; j++) {
          const w = Math.max(1, 4 - (j * 4 / q[1] | 0));
          R(q[0] + Math.round(q[2] * j / q[1]), 6 - j, w, 1, j > q[1] * 0.6 ? r.peloS : r.pelo);
        }
        break;
      }
      case 'casco':
        R(7, 4, 20, 8, r.pelo); R(7, 11, 20, 2, r.peloS); R(9, 5, 6, 1, '#7a828d'); R(16, 6, 3, 3, r.detalle);
        break;
      case 'moño':
        R(8, 5, 18, 6, r.pelo); R(13, 0, 8, 6, r.pelo); R(15, 1, 3, 1, '#ffffff'); R(22, 6, 4, 5, r.peloS);
        break;
      case 'cresta':
        R(9, 6, 16, 3, r.peloS); R(14, 0, 6, 8, r.pelo); R(15, 0, 2, 7, '#ffd9b0');
        break;
      default: // gorra
        R(8, 4, 18, 7, r.pelo); R(4, 9, 12, 2, r.peloS); R(18, 6, 3, 2, '#e6e3ff');
    }
    if (ra.extra === 'antiparras') {
      R(9, 9, 16, 1, '#2a2a3c');
      R(10, 8, 6, 3, '#2a2a3c'); R(18, 8, 6, 3, '#2a2a3c');
      R(11, 9, 4, 1, '#22e4ff'); R(19, 9, 4, 1, '#22e4ff');
    } else if (ra.extra === 'lentes') {
      R(10, 14, 7, 6, '#4a4f63'); R(18, 14, 7, 6, '#4a4f63'); R(11, 15, 5, 4, '#c8fbff'); R(19, 15, 5, 4, '#c8fbff');
      R(13, 16, 2, 2, '#16151f'); R(21, 16, 2, 2, '#16151f');
    } else if (ra.extra === 'visor' && n !== 3) {
      R(9, 14, 17, 5, '#16151f'); R(10, 15, 15, 2, '#22e4ff');
    } else if (ra.extra === 'barba') {
      R(9, 21, 16, 6, r.peloS); R(13, 23, 8, 2, '#3a1418');
    }
    return cv;
  }

  function cuadros(id) {
    if (cache[id]) return cache[id];
    cache[id] = [0, 1, 2, 3, 4].map(function (n) { return cuadro(id, n); });
    return cache[id];
  }

  // Animación tipo Doom: mira a los lados de vez en cuando y parpadea
  function elegir(t, herido) {
    if (herido) return 4;
    if (t % 6 > 5.82) return 3;
    const fase = Math.floor(t / 1.7) % 5;
    return fase === 1 ? 1 : fase === 3 ? 2 : 0;
  }

  W.Retrato = { TAM: TAM, cuadros: cuadros, elegir: elegir, RASGOS: RASGOS };
})();

// =====================================================
// Personajes jugables: pandilleros cyberpunk con un arma y una ventaja
// También dibuja el arma en primera persona y el sprite lateral (salas 2D).
// =====================================================
(function () {
  'use strict';
  const PAL = W.paleta;

  // alcance: casillas (3D) | alcance2d: píxeles | aturdir: segundos
  W.PERSONAJES = {
    chispa: {
      id: 'chispa', nombre: 'CHISPA', arma: 'RESORTERA', tipo: 'A DISTANCIA',
      ventaja: 'ACTIVA INTERRUPTORES LEJANOS Y LEE HOLOGRAMAS DE LEJOS',
      alcance: 6, alcance2d: 999, proyectil: true, velProyectil: 230, recarga: 0.45, aturdir: 4.5,
      vida: 10, velocidad: 1.0, salto: 1.0, bonoPuzzle: 0, distHolograma: 3.6,
      colores: { piel: '#e0a37a', pelo: '#ff8a2b', ropa: '#22e4ff', pantalon: '#2a2a3c', detalle: '#c8fbff' }
    },
    tuerca: {
      id: 'tuerca', nombre: 'TUERCA', arma: 'FIERRO', tipo: 'CUERPO A CUERPO, FUERTE',
      ventaja: 'ATURDE MAS TIEMPO Y FUERZA REJILLAS REFORZADAS',
      alcance: 1.5, alcance2d: 13, proyectil: false, recarga: 0.55, aturdir: 9,
      vida: 10, velocidad: 0.95, salto: 0.95, bonoPuzzle: 0, distHolograma: 1.6, fuerza: true,
      colores: { piel: '#c98a5e', pelo: '#3a3a52', ropa: '#6b6f80', pantalon: '#3d2a2a', detalle: '#e8b923' }
    },
    lata: {
      id: 'lata', nombre: 'DONA LATA', arma: 'SARTEN', tipo: 'CUERPO A CUERPO, DEFENSIVO',
      ventaja: 'BLOQUEA DISPAROS DE FRENTE Y RESISTE UN GOLPE EXTRA',
      alcance: 1.4, alcance2d: 12, proyectil: false, recarga: 0.5, aturdir: 5.5,
      vida: 12, velocidad: 0.95, salto: 0.95, bonoPuzzle: 0, distHolograma: 1.6, bloquea: true,
      colores: { piel: '#e8b796', pelo: '#e6e3ff', ropa: '#b44dff', pantalon: '#4a1a73', detalle: '#ff2bd6' }
    },
    flaco: {
      id: 'flaco', nombre: 'FLACO NEON', arma: 'TENEDORES', tipo: 'LANZAMIENTO RAPIDO',
      ventaja: 'CORRE MAS RAPIDO Y SALTA MAS ALTO EN 2D',
      alcance: 4.5, alcance2d: 110, proyectil: true, velProyectil: 320, recarga: 0.22, aturdir: 3.5,
      vida: 10, velocidad: 1.2, salto: 1.17, bonoPuzzle: 0, distHolograma: 1.6,
      colores: { piel: '#b07850', pelo: '#ff2bd6', ropa: '#1d1236', pantalon: '#16151f', detalle: '#ff2bd6' }
    },
    varilla: {
      id: 'varilla', nombre: 'VARILLA', arma: 'PALO', tipo: 'ALCANCE MEDIO',
      ventaja: 'MAS TIEMPO EN LOS PUZZLES DE SELLADO',
      alcance: 2.1, alcance2d: 19, proyectil: false, recarga: 0.45, aturdir: 5,
      vida: 10, velocidad: 1.0, salto: 1.0, bonoPuzzle: 8, distHolograma: 1.6,
      colores: { piel: '#d9a07a', pelo: '#4dff8a', ropa: '#1d4a2c', pantalon: '#2a2a3c', detalle: '#4dff8a' }
    }
  };
  W.ORDEN_PERSONAJES = ['chispa', 'tuerca', 'lata', 'flaco', 'varilla'];

  // ---------- Sprite lateral 8×14 (salas 2D y retratos) ----------
  // dir: 1 derecha, -1 izquierda; paso: fase de caminata; esc: escala
  function dibujarCuerpo(ctx, id, x, y, dir, paso, esc, atacando) {
    const p = W.PERSONAJES[id], c = p.colores;
    esc = esc || 1;
    function px(ix, iy, w, h, col) {
      const xx = dir >= 0 ? ix : 8 - ix - w;
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(x + xx * esc), Math.round(y + iy * esc), w * esc, h * esc);
    }
    const ancho = id === 'tuerca' ? 1 : 0;      // Tuerca es más corpulento
    const flaco = id === 'flaco' ? 1 : 0;
    // Pelo y cabeza
    px(2, 0, 4, 2, c.pelo);
    if (id === 'chispa') px(1, 0, 2, 3, c.pelo);          // cresta
    if (id === 'flaco') px(3, -1, 2, 1, c.pelo);
    if (id === 'lata') { px(1, 0, 6, 2, c.pelo); }
    px(2, 2, 4, 3, c.piel);
    px(5, 3, 1, 1, '#07060d');                             // ojo
    if (id === 'flaco') px(4, 3, 2, 1, PAL.cian);           // visor
    // Torso
    px(2 - ancho, 5, 4 + ancho * 2 - flaco, 4, c.ropa);
    px(3, 6, 2, 1, c.detalle);
    // Brazo (adelante si ataca)
    if (atacando) px(5, 6, 3, 1, c.piel);
    else px(5 - flaco, 6, 1, 3, c.piel);
    // Piernas animadas
    const s = Math.sin(paso) > 0 ? 1 : 0;
    px(2, 9, 2, 3 + s, c.pantalon);
    px(4, 9, 2, 4 - s, c.pantalon);
    px(2, 12 + s, 2, 1, '#0b0c12');
    px(4, 13 - s, 2, 1, '#0b0c12');
    if (id === 'lata') px(1, 8, 6, 2, c.ropa);             // falda
  }

  // ---------- Arma en primera persona ----------
  // fase: 0 reposo, 0..1 animación de ataque. bob: balanceo
  function dibujarArmaFP(ctx, id, fase, bob, tiempo) {
    const A = W.config.ANCHO, H = W.config.ALTO - W.config.HUD_ALTO;
    const p = W.PERSONAJES[id], c = p.colores;
    const golpe = fase > 0 ? Math.sin(fase * Math.PI) : 0;
    const ox = Math.round(A - 92 - golpe * 34 + Math.sin(bob) * 3);
    const oy = Math.round(H - 50 + Math.abs(Math.cos(bob)) * 3 - golpe * 12);
    function r(x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(ox + x, oy + y, w, h); }
    // Mano
    r(30, 34, 22, 16, c.piel);
    r(30, 34, 22, 3, '#ffffff22');
    r(28, 44, 30, 8, c.ropa);
    if (id === 'chispa') {
      // Resortera: horqueta con elástico
      r(36, 10, 5, 28, '#7a4a2a'); r(28, 6, 5, 12, '#7a4a2a'); r(44, 6, 5, 12, '#7a4a2a');
      r(30, 8, 17, 2, golpe > 0.2 ? '#e8b923' : '#c8b08a');
      if (fase > 0 && fase < 0.5) r(36, -4 - fase * 40, 4, 4, '#8d93ad');
    } else if (id === 'tuerca') {
      // Fierro: barra metálica gruesa
      r(36, -14, 7, 50, '#6b6f80'); r(37, -14, 2, 50, '#a8aec0'); r(34, -18, 11, 6, '#4a4f63');
    } else if (id === 'lata') {
      // Sartén: disco negro con mango
      r(38, 14, 5, 24, '#3a2a1a');
      r(22, -10, 38, 26, '#16151f'); r(26, -14, 30, 4, '#16151f'); r(26, 16, 30, 3, '#16151f');
      r(28, -8, 10, 3, '#4a4f63');
    } else if (id === 'flaco') {
      // Tenedores: tres tenedores entre los dedos
      for (let k = 0; k < 3; k++) {
        const x = 30 + k * 8;
        r(x, 4, 2, 32, '#c8cbd8'); r(x - 2, -6, 6, 2, '#c8cbd8');
        r(x - 2, -12, 1, 6, '#c8cbd8'); r(x, -12, 1, 6, '#c8cbd8'); r(x + 2, -12, 1, 6, '#c8cbd8');
      }
      r(28, 28, 26, 2, PAL.magenta);
    } else {
      // Palo: vara larga de madera con cinta verde
      r(38, -40, 5, 78, '#8a5a32'); r(39, -40, 1, 78, '#b07a4a');
      r(37, 0, 7, 4, PAL.verde);
    }
    // Destello de neón al golpear
    if (golpe > 0.6 && Math.floor(tiempo * 30) % 2 === 0) { r(20, -20, 3, 3, PAL.amarillo); r(56, -10, 2, 2, PAL.cianClaro); }
  }

  W.Personajes = { dibujarCuerpo: dibujarCuerpo, dibujarArmaFP: dibujarArmaFP };
})();

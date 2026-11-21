// =====================================================
// Arma en primera persona (32 bits): la mano del personaje con su arma
//   Chispa: resortera · Tuerca: fierro · Doña Lata: sartén · Flaco Neón: tenedores · Varilla: palo
// Se dibuja con código una sola vez por personaje (con sombreado, como los puños de DuMulti)
// y luego se copia cada cuadro con el balanceo al caminar y la animación de ataque.
// =====================================================
(function () {
  'use strict';
  const PA = W.config.PANT;
  const AN = 150, AL = 140;          // tamaño del dibujo del arma
  const cache = {};

  function col(rgb, k) { return 'rgb(' + Math.min(255, rgb[0] * k | 0) + ',' + Math.min(255, rgb[1] * k | 0) + ',' + Math.min(255, rgb[2] * k | 0) + ')'; }
  function rgb(h) { return W.texturas.hexARgb(h); }

  // Barra cilíndrica sombreada entre dos puntos (palos, fierros, mangos)
  function barra(R, x0, y0, x1, y1, grosor, base, brillo) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
    const nx = -(y1 - y0) / n, ny = (x1 - x0) / n;
    for (let k = 0; k <= n; k++) {
      const t = k / n, cx = x0 + (x1 - x0) * t, cy = y0 + (y1 - y0) * t;
      for (let g = -grosor; g <= grosor; g++) {
        const u = g / grosor;
        const kk = 0.45 + 0.7 * Math.sqrt(Math.max(0, 1 - u * u)) - u * 0.15;
        R(Math.round(cx + nx * g), Math.round(cy + ny * g), 1, 1, col(base, kk * (brillo || 1)));
      }
    }
  }

  // Puño que agarra (forma de DuMulti), con la manga del personaje
  function puno(R, ox, oy, piel, ropa, detalle) {
    for (let y = 40; y < 76; y++) {
      const a = (y - 40) / 36;
      const x0 = 24 + a * 12, x1 = 54 + a * 20;
      for (let x = Math.floor(x0); x < x1; x++) {
        const u = (x - x0) / (x1 - x0);
        const k = 0.45 + 0.75 * Math.sin(Math.PI * Math.min(1, u * 1.1));
        R(ox + x, oy + y, 1, 1, y < 46 ? col(piel, k * 0.9) : col(ropa, k));
      }
    }
    R(ox + 25, oy + 45, 32, 2, '#07060d');
    R(ox + 27, oy + 46, 26, 1, detalle);
    const cx = 38, cy = 25, ax = 29, ay = 21;
    for (let y = 0; y < 48; y++) for (let x = 6; x < 70; x++) {
      const dx = (x + 0.5 - cx) / ax, dy = (y + 0.5 - cy) / ay;
      const f = Math.pow(Math.abs(dx), 3) + Math.pow(Math.abs(dy), 3);
      if (f > 1) continue;
      let k = 0.95 - dx * 0.28 - dy * 0.32;
      if (f > 0.78) k *= 0.72;
      const fx = (x - 12) / 13;
      if (Math.abs(fx - Math.round(fx)) < 0.06 && fx > 0.5 && fx < 3.5 && y > 6 && y < 30) k *= 0.55;
      const nud = Math.abs(fx - Math.floor(fx) - 0.5);
      if (y > 3 && y < 11 && nud < 0.28 && fx > 0 && fx < 4) k *= 1.18;
      R(ox + x, oy + y, 1, 1, col(piel, k));
    }
    for (let y = 26; y < 40; y++) for (let x = 10; x < 46; x++) {
      const dx = (x + 0.5 - 27) / 18, dy = (y + 0.5 - 33) / 6.5;
      if (dx * dx + dy * dy > 1) continue;
      R(ox + x, oy + y, 1, 1, col(piel, 1.05 - dy * 0.3 - dx * 0.12));
    }
    R(ox + 12, oy + 27, 30, 1, col(piel, 0.5));
    R(ox + 41, oy + 30, 3, 1, '#e6d0c0');
  }

  function dibujar(id) {
    const p = W.PERSONAJES[id] || W.PERSONAJES.chispa, c = p.colores;
    const cv = document.createElement('canvas');
    cv.width = AN; cv.height = AL;
    const g = cv.getContext('2d');
    const R = function (x, y, w, h, cc) { g.fillStyle = cc; g.fillRect(x, y, w, h); };
    const piel = rgb(c.piel), ropa = rgb(c.ropa);
    const ox = 50, oy = 64;            // el puño queda abajo a la derecha del dibujo
    const madera = rgb('#7a4a2a'), metal = rgb('#8a93a8');

    if (id === 'chispa') {
      // Resortera: horqueta de madera con elástico y piedra
      barra(R, ox + 38, oy + 30, ox + 34, oy - 6, 4, madera);
      barra(R, ox + 34, oy - 4, ox + 16, oy - 40, 3, madera);
      barra(R, ox + 34, oy - 4, ox + 56, oy - 38, 3, madera);
      R(ox + 14, oy - 44, 6, 5, '#5a3418'); R(ox + 54, oy - 42, 6, 5, '#5a3418');
      for (let k = 0; k <= 20; k++) {
        const t = k / 20, x = ox + 17 + (ox + 57 - (ox + 17)) * t, y = oy - 40 + Math.sin(t * Math.PI) * 9;
        R(Math.round(x), Math.round(y), 1, 2, '#e8b923');
      }
      R(ox + 33, oy - 33, 6, 5, '#8d93ad'); R(ox + 34, oy - 33, 2, 1, '#c8cbd6');
    } else if (id === 'tuerca') {
      // Fierro: barra de acero gruesa con óxido y cinta
      barra(R, ox + 40, oy + 36, ox + 6, oy - 62, 6, metal);
      for (let k = 0; k < 9; k++) R(ox + 18 + k * 2 - (k % 3), oy - 30 + k * 4, 3, 2, '#7a4a2a');
      barra(R, ox + 36, oy + 22, ox + 32, oy + 10, 7, rgb('#2a2a3c'));
      R(ox + 4, oy - 66, 14, 6, '#4a4f63'); R(ox + 4, oy - 66, 14, 1, '#c8cbd6');
    } else if (id === 'lata') {
      // Sartén: mango y disco negro en perspectiva
      barra(R, ox + 40, oy + 26, ox + 28, oy - 18, 4, rgb('#3a2a1a'));
      for (let j = -26; j <= 26; j++) for (let i = -40; i <= 40; i++) {
        const e = (i * i) / 1600 + (j * j) / 676;
        if (e > 1) continue;
        const borde = e > 0.82;
        const k = borde ? 0.9 + (-i * 0.004 - j * 0.01) : 0.45 + (-i * 0.003 - j * 0.006);
        R(ox + 16 + i, oy - 46 + j, 1, 1, col(rgb(borde ? '#4a4f63' : '#1c1b26'), k * 1.2));
      }
      R(ox - 4, oy - 60, 24, 2, '#7a828d'); R(ox + 30, oy - 40, 8, 1, '#3a3a52');
    } else if (id === 'flaco') {
      // Tenedores: tres tenedores entre los dedos, con cinta magenta
      for (let k = 0; k < 3; k++) {
        const x = ox + 14 + k * 16;
        barra(R, x + 4, oy + 10, x, oy - 34, 2, rgb('#c8cbd8'), 1.1);
        R(x - 4, oy - 38, 9, 3, '#c8cbd8');
        for (let d = 0; d < 4; d++) R(x - 4 + d * 3, oy - 52, 1, 14, '#e6e3ff');
      }
      R(ox + 8, oy + 2, 52, 3, '#ff2bd6');
    } else {
      // Palo: vara larga de madera con cinta verde
      barra(R, ox + 44, oy + 40, ox - 30, oy - 64, 5, rgb('#8a5a32'));
      for (let k = 0; k < 4; k++) R(ox - 2 + k * 2, oy - 22 + k * 3, 8, 2, '#4dff8a');
    }
    puno(R, ox, oy, piel, ropa, c.detalle);
    if (id === 'flaco') for (let k = 0; k < 3; k++) R(ox + 15 + k * 16, oy + 4, 5, 8, '#c8cbd8');   // mangos por delante de los dedos
    return cv;
  }

  // fase: 0 reposo, 0..1 animación de ataque. bob: balanceo al caminar
  function dibujarArma(ctx, id, fase, bob, tiempo, andar) {
    const img = cache[id] || (cache[id] = dibujar(id));
    const A = PA.ANCHO, VH = PA.VISTA_ALTO;
    const a = andar === undefined ? 1 : andar;
    const bx = Math.cos(bob) * 7 * a;
    const by = Math.abs(Math.sin(bob)) * 6 * a + Math.sin(tiempo * 1.6) * 1.2;
    let gx = 0, gy = 0, esc = 1;
    if (fase > 0) {
      const e = fase < 0.35 ? fase / 0.35 : 1 - (fase - 0.35) / 0.65;
      const s = e * e * (3 - 2 * e);
      const p = W.PERSONAJES[id] || {};
      if (p.proyectil) { gx = -20 * s; gy = 14 * s; }        // lanzar: tira hacia atrás
      else { gx = -86 * s; gy = -28 * s; esc = 1 + 0.12 * s; }   // golpe: barre hacia el centro
    }
    ctx.imageSmoothingEnabled = false;
    const w = Math.round(AN * esc), h = Math.round(AL * esc);
    ctx.drawImage(img, Math.round(A - w - 18 + bx + gx), Math.round(VH - h + 22 + by + gy), w, h);
    // Destello al lanzar o golpear
    if (fase > 0.15 && fase < 0.5) {
      ctx.fillStyle = W.paleta.amarilloClaro;
      const fx = Math.round(A / 2 + 20 + gx * 0.2), fy = Math.round(VH / 2 + 10);
      ctx.fillRect(fx, fy, 3, 3); ctx.fillRect(fx + 6, fy - 4, 2, 2); ctx.fillRect(fx - 5, fy + 3, 2, 2);
    }
  }

  W.ArmaFP = { dibujar: dibujarArma };
})();

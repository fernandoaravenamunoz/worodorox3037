// =====================================================
// Texturas procedurales (estilo 16 bits cyberpunk)
// Paredes y pisos de 64×64, sprites de 32×32.
// Cada textura tiene:
//   px: colores empaquetados (Uint32, formato del canvas). En sprites, 0 = transparente.
//   em: 1 si el píxel es emisivo (neón: no se oscurece con la distancia)
// Cada zona (1 a 4) tiene su propio juego de paredes, piso y techo.
// =====================================================
(function () {
  'use strict';
  const T = W.config.TEX;

  // ---------- Utilidades de color ----------
  function lim(v) { return v < 0 ? 0 : v > 255 ? 255 : v | 0; }
  function hexARgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  // Empaqueta RGB en el orden que usa ImageData en equipos little-endian (ABGR)
  function empacar(r, g, b) { return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0; }
  function color(h, k) {
    if (k === undefined) k = 1;
    const c = hexARgb(h);
    return empacar(lim(c[0] * k), lim(c[1] * k), lim(c[2] * k));
  }

  // Números pseudoaleatorios con semilla (las texturas salen siempre iguales)
  function azar(semilla) {
    let s = semilla >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- Lienzo de dibujo para una textura ----------
  function Lienzo(tam) {
    this.t = tam || T;
    this.px = new Uint32Array(this.t * this.t);
    this.em = new Uint8Array(this.t * this.t);
  }
  Lienzo.prototype.pix = function (x, y, c, e) {
    const t = this.t;
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= t || y >= t) return;
    const i = y * t + x;
    this.px[i] = color(c);
    this.em[i] = e ? 1 : 0;
  };
  Lienzo.prototype.rect = function (x, y, w, h, c, e) {
    const v = color(c), t = this.t;
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + w; i++) {
        if (i < 0 || j < 0 || i >= t || j >= t) continue;
        const k = j * t + i;
        this.px[k] = v;
        this.em[k] = e ? 1 : 0;
      }
    }
  };
  // Tramado (dithering): pinta en patrón de tablero de ajedrez
  Lienzo.prototype.trama = function (x, y, w, h, c, e) {
    const v = color(c), t = this.t;
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + w; i++) {
        if (((i + j) & 1) !== 0 || i < 0 || j < 0 || i >= t || j >= t) continue;
        const k = j * t + i;
        this.px[k] = v;
        this.em[k] = e ? 1 : 0;
      }
    }
  };
  Lienzo.prototype.anillo = function (cx, cy, r0, r1, c, e) {
    for (let j = Math.floor(cy - r1); j <= Math.ceil(cy + r1); j++) {
      for (let i = Math.floor(cx - r1); i <= Math.ceil(cx + r1); i++) {
        const d = Math.hypot(i + 0.5 - cx, j + 0.5 - cy);
        if (d >= r0 && d <= r1) this.pix(i, j, c, e);
      }
    }
  };
  // Variación sutil de brillo para que el metal no se vea plano
  Lienzo.prototype.ruido = function (rnd, amp) {
    for (let k = 0; k < this.px.length; k++) {
      const c = this.px[k];
      if (this.em[k] || c === 0) continue;
      const f = 1 + (rnd() * 2 - 1) * amp;
      this.px[k] = empacar(lim((c & 255) * f), lim(((c >>> 8) & 255) * f), lim(((c >>> 16) & 255) * f));
    }
  };
  Lienzo.prototype.copia = function () {
    const L = new Lienzo(this.t);
    L.px.set(this.px); L.em.set(this.em);
    return L;
  };

  // ---------- Paletas de cada zona ----------
  const ZONAS = {
    1: { base: '#2a2a3c', luz: '#3a3a52', sombra: '#16151f', remache: '#7a828d', neon: '#ff2bd6', neonClaro: '#ffd0f5', neonOsc: '#7a1466', piso: '#121119', pisoLinea: '#22202f', techo: '#120f1f', lampara: '#ffb3f0' },
    2: { base: '#382d29', luz: '#4f3f36', sombra: '#191210', remache: '#a08060', neon: '#ff8a2b', neonClaro: '#ffd9b0', neonOsc: '#6b3510', piso: '#15110f', pisoLinea: '#2b221d', techo: '#140e0b', lampara: '#ffcf8a' },
    3: { base: '#241a33', luz: '#36284a', sombra: '#0f0a17', remache: '#7a6a9d', neon: '#b44dff', neonClaro: '#e6c8ff', neonOsc: '#4a1a73', piso: '#100c18', pisoLinea: '#211a30', techo: '#0d0814', lampara: '#d9a6ff' },
    4: { base: '#1d2a30', luz: '#2c3e47', sombra: '#0b1215', remache: '#6f8a94', neon: '#22e4ff', neonClaro: '#c8fbff', neonOsc: '#0f5a6b', piso: '#0d1316', pisoLinea: '#1b282e', techo: '#0a1012', lampara: '#b3f4ff' }
  };

  // ---------- Base común: panel metálico 2×2 ----------
  function panelBase(L, z) {
    L.rect(0, 0, T, T, z.base);
    for (let py = 0; py < 2; py++) {
      for (let px = 0; px < 2; px++) {
        const x = px * 32, y = py * 32;
        L.rect(x, y, 32, 1, z.luz);        // brillo superior
        L.rect(x, y, 1, 32, z.luz);        // brillo izquierdo
        L.rect(x, y + 31, 32, 1, z.sombra);// sombra inferior
        L.rect(x + 31, y, 1, 32, z.sombra);// sombra derecha
        [[3, 3], [27, 3], [3, 27], [27, 27]].forEach(function (p) {
          L.rect(x + p[0], y + p[1], 2, 2, z.remache);  // remaches
          L.pix(x + p[0] + 1, y + p[1] + 1, z.luz);
        });
      }
    }
  }

  // ---------- 1: panel metálico ----------
  function texPanel(z, n) {
    const L = new Lienzo();
    panelBase(L, z);
    for (let i = 0; i < 5; i++) L.rect(38, 40 + i * 3, 20, 1, z.sombra); // rejilla
    L.trama(0, 56, T, 8, z.sombra);                                     // suciedad
    L.ruido(azar(11 + n), 0.06);
    return L;
  }

  // ---------- 2: panel con tira de neón ----------
  function texNeon(z, n) {
    const L = new Lienzo();
    panelBase(L, z);
    L.rect(0, 24, T, 10, z.sombra);
    L.trama(0, 25, T, 2, z.neonOsc);
    L.trama(0, 31, T, 2, z.neonOsc);
    L.rect(0, 27, T, 4, z.neon, 1);
    L.rect(0, 28, T, 1, z.neonClaro, 1);
    L.rect(0, 24, T, 1, z.luz);
    L.rect(0, 34, T, 1, z.sombra);
    L.rect(8, 46, 4, 2, '#22e4ff', 1);   // luz de estado cian
    L.rect(14, 46, 4, 2, '#0f5a6b');
    L.ruido(azar(22 + n), 0.05);
    return L;
  }

  // ---------- 3: tuberías ----------
  function texTuberias(z, n) {
    const L = new Lienzo();
    L.rect(0, 0, T, T, z.sombra);
    const tubos = [[4, 12], [24, 10], [42, 16]];
    tubos.forEach(function (t) {
      const x = t[0], w = t[1];
      for (let i = 0; i < w; i++) {
        const k = 0.45 + 0.75 * Math.sin(Math.PI * (i + 0.5) / w);  // sombreado cilíndrico
        const v = color(n === 2 ? '#6b5a4a' : '#4a4f63', k);
        for (let y = 0; y < T; y++) { const q = y * T + x + i; L.px[q] = v; L.em[q] = 0; }
      }
      for (let y = 6; y < T; y += 16) L.rect(x - 1, y, w + 2, 3, z.base);  // abrazaderas
    });
    L.rect(22, 38, 14, 3, '#a01818');   // válvula
    L.rect(27, 34, 4, 10, '#ff3b3b');
    L.trama(4, 50, 12, 14, '#1d6b7a');  // condensación
    L.ruido(azar(33 + n), 0.05);
    return L;
  }

  // ---------- 6: decoración propia de cada zona ----------
  function texCapsula() {
    const L = new Lienzo();
    L.rect(0, 0, T, T, '#24243a');
    L.rect(8, 2, 48, 60, '#3a3d54');
    L.rect(8, 2, 48, 4, '#565d67');
    L.rect(12, 7, 40, 48, '#0e3a44');
    L.trama(12, 7, 40, 48, '#1d6b7a');
    L.trama(12, 42, 40, 13, '#9fe8f5');                  // escarcha
    L.anillo(32, 15, 0, 4, '#0a1a24');                   // silueta del sujeto dormido
    L.rect(30, 19, 4, 3, '#0a1a24');
    L.rect(20, 22, 24, 5, '#0a1a24');
    L.rect(19, 27, 4, 16, '#0a1a24');
    L.rect(41, 27, 4, 16, '#0a1a24');
    L.rect(25, 27, 14, 24, '#0a1a24');
    L.rect(15, 9, 2, 40, '#5fd3e6');                     // reflejo del vidrio
    L.rect(20, 57, 4, 2, '#22e4ff', 1);
    L.rect(30, 57, 4, 2, '#22e4ff', 1);
    L.rect(40, 57, 4, 2, '#ff3b3b', 1);
    L.ruido(azar(66), 0.04);
    return L;
  }
  function texMaquinaria(z) {
    const L = new Lienzo();
    panelBase(L, z);
    L.rect(6, 6, 52, 30, '#1a1411');
    // Engranaje grande
    L.anillo(22, 21, 6, 11, '#6b5a4a');
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4;
      L.rect(Math.round(22 + Math.cos(a) * 12) - 1, Math.round(21 + Math.sin(a) * 12) - 1, 3, 3, '#6b5a4a');
    }
    L.anillo(22, 21, 0, 3, '#a08060');
    // Pistón
    L.rect(40, 8, 10, 26, '#4f3f36');
    L.rect(43, 8, 4, 26, '#8a7a6a');
    // Rendija de horno (emisiva)
    L.rect(8, 42, 48, 6, '#2b0d05');
    L.rect(10, 44, 44, 2, '#ff8a2b', 1);
    L.trama(10, 43, 44, 1, '#ffcf8a', 1);
    // Franjas de advertencia
    for (let x = 0; x < T; x++) for (let y = 54; y < 60; y++) {
      L.pix(x, y, (((x + y) >> 2) & 1) ? '#e8b923' : '#15151a');
    }
    L.ruido(azar(67), 0.05);
    return L;
  }
  function texServidor(z) {
    const L = new Lienzo();
    L.rect(0, 0, T, T, '#0f0a17');
    L.rect(4, 2, 56, 60, '#1c1528');
    L.rect(4, 2, 56, 2, '#36284a');
    const rnd = azar(68);
    for (let fila = 0; fila < 9; fila++) {
      const y = 6 + fila * 6;
      L.rect(7, y, 50, 5, '#120d1c');
      L.rect(7, y, 50, 1, '#2a2040');
      for (let i = 0; i < 6; i++) {
        const r = rnd();
        const c = r < 0.35 ? '#4dff8a' : r < 0.6 ? '#22e4ff' : r < 0.75 ? '#ff2bd6' : '#2a2040';
        L.rect(10 + i * 4, y + 2, 2, 1, c, c !== '#2a2040');
      }
      for (let i = 0; i < 4; i++) L.rect(38 + i * 4, y + 1, 2, 3, '#0a0710');  // ventilación
    }
    L.ruido(azar(69), 0.04);
    return L;
  }
  function texVentanal(z) {
    const L = new Lienzo();
    panelBase(L, z);
    L.rect(6, 8, 52, 40, '#020308');
    const rnd = azar(70);
    for (let k = 0; k < 40; k++) {
      L.pix(7 + rnd() * 50, 9 + rnd() * 38, rnd() < 0.3 ? '#c8fbff' : '#6f8a94', 1);
    }
    // Planeta lejano
    L.anillo(44, 22, 0, 7, '#1d6b7a', 1);
    L.trama(38, 16, 12, 12, '#4dd2ff', 1);
    L.anillo(44, 22, 7, 8, '#0f5a6b', 1);
    // Marco
    L.rect(6, 8, 52, 2, z.luz); L.rect(6, 46, 52, 2, z.sombra);
    L.rect(31, 8, 2, 40, z.base);
    L.rect(10, 52, 44, 3, '#22e4ff', 1);
    L.ruido(azar(71), 0.04);
    return L;
  }

  // ---------- Puertas ----------
  // Base: franjas de peligro + hojas metálicas + panel de cerradura de cierto color
  function puertaBase(colFranja, colLuz, colLuzClaro) {
    const L = new Lienzo();
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        if (x < 6 || x >= 58 || y < 6 || y >= 60) {
          L.pix(x, y, (((x + y) >> 2) & 1) ? colFranja : '#15151a');
        }
      }
    }
    L.rect(6, 6, 52, 54, '#2d3140');
    L.rect(6, 6, 52, 1, '#4a4f63');
    L.rect(31, 6, 2, 54, '#0b0c12');
    for (let y = 12; y < 58; y += 8) { L.rect(9, y, 20, 1, '#3d4256'); L.rect(35, y, 8, 1, '#3d4256'); }
    L.rect(44, 24, 11, 18, '#0b0c12');
    L.rect(46, 26, 7, 7, colLuz, 1);
    L.rect(48, 28, 3, 3, colLuzClaro, 1);
    L.rect(46, 35, 7, 1, '#22e4ff', 1);
    L.rect(46, 38, 7, 1, '#22e4ff', 1);
    return L;
  }
  function texPuertaNormal() {
    const L = puertaBase('#4a4f63', '#22e4ff', '#c8fbff');
    L.rect(26, 1, 12, 3, '#22e4ff', 1);
    L.ruido(azar(54), 0.04);
    return L;
  }
  function texPuertaMagenta() {
    const L = puertaBase('#ff2bd6', '#ff2bd6', '#ffd0f5');
    L.rect(26, 1, 12, 3, '#ff3b3b', 1);
    // calavera simple de advertencia
    L.rect(14, 24, 10, 8, '#ff2bd6', 1);
    L.rect(16, 26, 2, 2, '#0b0c12'); L.rect(20, 26, 2, 2, '#0b0c12');
    L.rect(16, 32, 6, 2, '#ff2bd6', 1);
    L.ruido(azar(55), 0.04);
    return L;
  }
  function texPuertaTarjeta() {
    const L = puertaBase('#e6e3ff', '#e6e3ff', '#ffffff');
    L.rect(44, 24, 11, 18, '#0b0c12');
    L.rect(46, 27, 7, 10, '#e6e3ff', 1);    // ranura de tarjeta
    L.rect(48, 28, 3, 8, '#0b0c12');
    L.rect(13, 22, 12, 8, '#e6e3ff', 1);    // ícono de tarjeta
    L.rect(14, 23, 10, 2, '#22e4ff', 1);
    L.rect(26, 1, 12, 3, '#e6e3ff', 1);
    L.ruido(azar(56), 0.04);
    return L;
  }

  // ---------- 7: acceso a ducto (puerta amarilla hacia sala 2D) ----------
  function texDucto() {
    const L = new Lienzo();
    L.rect(0, 0, T, T, '#1c1b2b');
    L.rect(4, 4, 56, 56, '#e8b923');
    L.rect(9, 9, 46, 46, '#14131d');
    for (let y = 13; y < 52; y += 4) L.rect(12, y, 40, 2, '#262838');
    for (let k = 0; k < 3; k++) {
      for (let j = 0; j < 4; j++) {
        L.rect(20 + j, 18 + k * 10 + j, 2, 2, '#e8b923', 1);
        L.rect(42 - j, 18 + k * 10 + j, 2, 2, '#e8b923', 1);
      }
    }
    L.rect(4, 4, 56, 2, '#ffd34a', 1);
    L.ruido(azar(77), 0.04);
    return L;
  }

  // ---------- 8: estación de respaldo (apagada / activa) ----------
  function texEstacion(z, activa) {
    const L = new Lienzo();
    panelBase(L, z);
    const c = activa ? '#4dff8a' : '#22e4ff';
    L.rect(13, 9, 38, 48, '#1d1f2e');
    L.rect(17, 13, 30, 22, '#06141a');
    L.rect(19, 16, 14, 1, c, 1);
    L.rect(19, 20, 20, 1, c, 1);
    L.rect(19, 24, 10, 1, c, 1);
    L.rect(19, 28, 17, 1, c, 1);
    L.rect(39, 24, 5, 1, '#c8fbff', 1);
    L.rect(41, 22, 1, 5, '#c8fbff', 1);
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
      const centro = i === 1 && j === 1;
      L.rect(19 + i * 6, 39 + j * 5, 4, 3, centro ? c : '#3a3d54', centro);
    }
    L.rect(13, 54, 38, 2, c, 1);
    return L;
  }

  // ---------- 11: compuerta de salida ----------
  function texSalida() {
    const L = new Lienzo();
    L.rect(0, 0, T, T, '#0b1a12');
    L.rect(4, 4, 56, 58, '#123020');
    L.rect(4, 4, 56, 2, '#4dff8a', 1);
    L.rect(4, 4, 2, 58, '#4dff8a', 1);
    L.rect(58, 4, 2, 58, '#4dff8a', 1);
    W.fuente.dibujarCrudo({ fillRect: function (x, y, w, h) { L.rect(x, y, w, h, '#4dff8a', 1); } }, 'SALIDA', 21, 10, '', 1);
    // flecha hacia arriba
    for (let j = 0; j < 8; j++) L.rect(32 - j, 22 + j, j * 2 + 1, 1, '#4dff8a', 1);
    L.rect(29, 30, 7, 14, '#4dff8a', 1);
    L.trama(8, 48, 48, 12, '#1d6b3a');
    return L;
  }

  // ---------- 12: aplastador (compuerta hidráulica) ----------
  function texAplastador() {
    const L = new Lienzo();
    L.rect(0, 0, T, T, '#2d3140');
    for (let y = 0; y < T; y += 8) L.rect(0, y, T, 2, '#1a1c26');
    for (let x = 0; x < T; x++) for (let y = 54; y < T; y++) {
      L.pix(x, y, (((x + y) >> 2) & 1) ? '#ff3b3b' : '#15151a', ((x + y) >> 2) & 1);
    }
    L.rect(26, 10, 12, 30, '#4a4f63');
    L.rect(29, 10, 6, 30, '#8a93a8');
    L.ruido(azar(57), 0.05);
    return L;
  }

  // ---------- 13: núcleo de la IA (dos cuadros de animación) ----------
  function texNucleo(cuadro) {
    const L = new Lienzo();
    L.rect(0, 0, T, T, '#0d0814');
    L.anillo(32, 32, 26, 30, '#4a1a73', 1);
    L.anillo(32, 32, 20, 24, '#b44dff', 1);
    L.anillo(32, 32, 0, 14, '#2b0a3a');
    L.anillo(32, 32, 0, cuadro ? 9 : 7, '#ff3b3b', 1);
    L.anillo(32, 32, 0, cuadro ? 4 : 3, '#ffd0d0', 1);
    for (let k = 0; k < 12; k++) {
      const a = k * Math.PI / 6 + (cuadro ? 0.26 : 0);
      L.rect(Math.round(32 + Math.cos(a) * 17), Math.round(32 + Math.sin(a) * 17), 2, 2, '#ff2bd6', 1);
    }
    return L;
  }

  // ---------- 4: holograma (marco vacío) y holograma desde un canvas ----------
  function texHologramaBase(z) {
    const L = new Lienzo();
    panelBase(L, z);
    L.rect(6, 6, 52, 52, '#0b0d16');
    L.trama(7, 7, 50, 50, '#0b2a33');
    for (let y = 8; y < 57; y += 3) L.rect(7, y, 50, 1, '#081820');
    L.rect(6, 6, 52, 1, '#22e4ff', 1); L.rect(6, 57, 52, 1, '#22e4ff', 1);
    L.rect(6, 6, 1, 52, '#22e4ff', 1); L.rect(57, 6, 1, 52, '#22e4ff', 1);
    return L;
  }
  // Crea una textura de holograma dibujando con una función de canvas 2D
  // dibujar(ctx, ancho, alto): dibuja la pista en un área de 50×50
  let lienzoTemporal = null;
  function hologramaDesde(zona, dibujar) {
    const L = texHologramaBase(ZONAS[zona] || ZONAS[1]);
    if (!lienzoTemporal) {
      lienzoTemporal = document.createElement('canvas');
      lienzoTemporal.width = 50; lienzoTemporal.height = 50;
    }
    const c = lienzoTemporal.getContext('2d', { willReadFrequently: true });
    c.clearRect(0, 0, 50, 50);
    dibujar(c, 50, 50);
    const d = c.getImageData(0, 0, 50, 50).data;
    for (let y = 0; y < 50; y++) for (let x = 0; x < 50; x++) {
      const i = (y * 50 + x) * 4;
      if (d[i + 3] < 128) continue;
      const k = (y + 7) * T + (x + 7);
      L.px[k] = empacar(d[i], d[i + 1], d[i + 2]);
      L.em[k] = 1;
    }
    return L;
  }

  // ---------- Pisos ----------
  function texPiso(z, n) {
    const L = new Lienzo();
    L.rect(0, 0, T, T, z.piso);
    for (let py = 0; py < 4; py++) {
      for (let px = 0; px < 4; px++) {
        const x = px * 16, y = py * 16;
        L.rect(x, y, 16, 1, z.pisoLinea);
        L.rect(x, y, 1, 16, z.pisoLinea);
        for (let k = 0; k < 4; k++) L.rect(x + 3, y + 3 + k * 3, 10, 1, '#0a0910');
      }
    }
    L.rect(0, 0, 2, 2, '#0f5a6b', 1);
    L.ruido(azar(88 + n), 0.07);
    return L;
  }
  // Piso eléctrico: estado 0 apagado, 1 aviso (chispas), 2 activo
  function texElectrico(z, estado) {
    const L = new Lienzo();
    L.rect(0, 0, T, T, '#0d1218');
    for (let i = 0; i < T; i += 8) { L.rect(i, 0, 1, T, '#1e2a36'); L.rect(0, i, T, 1, '#1e2a36'); }
    L.rect(2, 2, 60, 2, '#e8b923'); L.rect(2, 60, 60, 2, '#e8b923');
    const rnd = azar(90 + estado);
    if (estado >= 1) {
      const n = estado === 1 ? 10 : 60;
      for (let k = 0; k < n; k++) {
        let x = rnd() * T, y = rnd() * T;
        for (let s = 0; s < (estado === 2 ? 6 : 2); s++) {
          L.pix(x, y, estado === 2 ? '#ffffff' : '#22e4ff', 1);
          x += rnd() * 4 - 2; y += rnd() * 4 - 2;
        }
      }
      if (estado === 2) L.trama(0, 0, T, T, '#22e4ff', 1);
    }
    return L;
  }
  // Gas: estado 0 sin gas, 1 aviso (burbujas), 2 nube tóxica
  function texGas(z, estado) {
    const L = texPiso(z, 5);
    const rnd = azar(95 + estado);
    if (estado === 1) for (let k = 0; k < 14; k++) L.anillo(rnd() * T, rnd() * T, 1, 2, '#4dff8a', 1);
    if (estado === 2) { L.trama(0, 0, T, T, '#3bd16a', 1); for (let k = 0; k < 20; k++) L.anillo(rnd() * T, rnd() * T, 0, 3, '#a8ffbf', 1); }
    if (estado === 0) for (let k = 0; k < 4; k++) L.rect(8 + k * 14, 30, 6, 4, '#1d3a26');   // rejillas
    return L;
  }
  // Baldosa con símbolo: 0 cuadrado, 1 círculo, 2 triángulo
  function texBaldosa(z, simbolo) {
    const L = new Lienzo();
    L.rect(0, 0, T, T, '#0f0c1a');
    L.rect(2, 2, 60, 60, '#1a1530');
    L.rect(2, 2, 60, 1, '#2d2650');
    const c = '#7ff3ff';
    if (simbolo === 0) { L.rect(18, 18, 28, 3, c, 1); L.rect(18, 43, 28, 3, c, 1); L.rect(18, 18, 3, 28, c, 1); L.rect(43, 18, 3, 28, c, 1); }
    else if (simbolo === 1) L.anillo(32, 32, 11, 14, c, 1);
    else for (let j = 0; j < 26; j++) {
      const m = j >> 1, y = 19 + j;
      if (j >= 24) L.rect(32 - m, y, 2 * m + 1, 1, c, 1);
      else { L.rect(32 - m - 1, y, 2, 1, c, 1); L.rect(32 + m, y, 2, 1, c, 1); }
    }
    return L;
  }
  // Descompresión: flechas en la dirección del empuje (0 der, 1 abajo, 2 izq, 3 arriba)
  function texVentila(z, dir) {
    const L = texPiso(z, 7);
    for (let k = 0; k < 2; k++) {
      for (let j = 0; j < 8; j++) {
        const a = 20 + k * 18 + j, b = 32 - 8 + j, b2 = 32 + 8 - j;
        // flecha ">" en coordenadas locales, luego se rota
        const pts = [[a - j * 2 + 8, b], [a - j * 2 + 8, b2]];
        pts.forEach(function (p) {
          let x = p[0], y = p[1];
          for (let r = 0; r < dir; r++) { const t = x; x = T - 1 - y; y = t; }
          L.rect(x, y, 2, 2, '#9fe8f5', 1);
        });
      }
    }
    return L;
  }
  // Aviso de aplastador: franjas rojas en el piso
  function texAvisoAplastador() {
    const L = new Lienzo();
    for (let x = 0; x < T; x++) for (let y = 0; y < T; y++) {
      L.pix(x, y, (((x + y) >> 3) & 1) ? '#ff3b3b' : '#1a0a0a', ((x + y) >> 3) & 1);
    }
    return L;
  }

  // ---------- Techos ----------
  function texTecho(z, conLuz, n) {
    const L = new Lienzo();
    L.rect(0, 0, T, T, z.techo);
    L.rect(0, 0, T, 1, z.luz);
    L.rect(0, 0, 1, T, z.luz);
    L.rect(0, 32, T, 1, z.sombra);
    if (conLuz) {
      L.rect(22, 29, 20, 6, z.base);
      L.rect(24, 31, 16, 2, z.lampara, 1);
    }
    L.ruido(azar((conLuz ? 99 : 98) + n), 0.06);
    return L;
  }

  // ===================== SPRITES (32×32) =====================
  const S = W.config.SPR;
  // Dron patrullero: esfera con ojo rojo y hélices
  function sprDron(aturdido) {
    const L = new Lienzo(S);
    L.anillo(16, 15, 0, 9, '#3a3d54');
    L.anillo(16, 15, 7, 9, '#565d67');
    L.anillo(13, 12, 0, 3, '#6f7890');
    L.anillo(16, 16, 0, 4, '#0b0c12');
    L.anillo(16, 16, 0, 2.5, aturdido ? '#e8b923' : '#ff3b3b', 1);
    L.rect(2, 4, 10, 2, '#8d93ad'); L.rect(20, 4, 10, 2, '#8d93ad');   // hélices
    L.rect(6, 5, 2, 4, '#4a4f63'); L.rect(24, 5, 2, 4, '#4a4f63');
    L.rect(12, 24, 8, 2, '#2a2a3c');
    L.rect(13, 26, 2, 3, '#ff3b3b', !aturdido); L.rect(17, 26, 2, 3, '#ff3b3b', !aturdido);
    if (aturdido) { L.pix(6, 12, '#e8b923', 1); L.pix(26, 10, '#e8b923', 1); L.pix(24, 22, '#e8b923', 1); }
    return L;
  }
  // Perseguidor: robot araña bajo
  function sprPerseguidor(aturdido) {
    const L = new Lienzo(S);
    const ojo = aturdido ? '#e8b923' : '#ff3b3b';
    L.rect(9, 12, 14, 10, '#3d2a2a');
    L.rect(10, 12, 12, 2, '#6b4040');
    L.rect(11, 15, 3, 2, ojo, 1); L.rect(18, 15, 3, 2, ojo, 1);
    L.rect(15, 18, 2, 1, ojo, 1);
    for (let k = 0; k < 3; k++) {                      // patas
      L.rect(3 + k * 2, 20 + k, 6, 2, '#565d67'); L.rect(2 + k * 2, 22 + k, 2, 8 - k * 2, '#565d67');
      L.rect(23 - k * 2, 20 + k, 6, 2, '#565d67'); L.rect(28 - k * 2, 22 + k, 2, 8 - k * 2, '#565d67');
    }
    L.rect(14, 8, 4, 4, '#2a2a3c'); L.rect(15, 6, 2, 2, ojo, 1);   // antena
    if (aturdido) { L.pix(5, 10, '#e8b923', 1); L.pix(27, 9, '#e8b923', 1); }
    return L;
  }
  // Guardián: torre blindada que bloquea el pasillo
  function sprGuardian(aturdido) {
    const L = new Lienzo(S);
    const ojo = aturdido ? '#e8b923' : '#ff3b3b';
    L.rect(7, 4, 18, 27, '#2d3140');
    L.rect(7, 4, 18, 2, '#565d67');
    L.rect(5, 12, 4, 14, '#3a3d54'); L.rect(23, 12, 4, 14, '#3a3d54');  // brazos/escudos
    L.rect(10, 8, 12, 5, '#0b0c12');
    L.rect(11, 9, 10, 3, ojo, 1);
    for (let y = 16; y < 30; y += 3) L.rect(10, y, 12, 1, '#1a1c26');
    for (let x = 7; x < 25; x++) L.pix(x, 30, ((x >> 1) & 1) ? '#ff3b3b' : '#15151a', ((x >> 1) & 1) && !aturdido);
    if (aturdido) { L.pix(4, 6, '#e8b923', 1); L.pix(27, 4, '#e8b923', 1); }
    return L;
  }
  // Chatarra: enemigo sellado
  function sprChatarra() {
    const L = new Lienzo(S);
    L.rect(8, 25, 16, 5, '#3a3d54');
    L.rect(11, 22, 7, 4, '#565d67');
    L.rect(19, 24, 4, 2, '#2a2a3c');
    L.rect(13, 27, 2, 1, '#22e4ff', 1);
    L.pix(15, 20, '#22e4ff', 1); L.pix(17, 18, '#22e4ff', 1);
    return L;
  }
  // Botiquín
  function sprBotiquin() {
    const L = new Lienzo(S);
    L.rect(10, 20, 12, 10, '#e6e3ff');
    L.rect(10, 20, 12, 2, '#ffffff');
    L.rect(15, 22, 2, 6, '#4dff8a', 1);
    L.rect(13, 24, 6, 2, '#4dff8a', 1);
    return L;
  }
  // Láser: rayos horizontales (encendido o aviso)
  function sprLaser(estado) {
    const L = new Lienzo(S);
    L.rect(0, 0, 2, S, '#4a4f63'); L.rect(30, 0, 2, S, '#4a4f63');   // emisores
    if (estado === 0) return L;
    const c = estado === 2 ? '#ff3b3b' : '#6b1010';
    for (let y = 6; y < S; y += 6) {
      if (estado === 2) { L.rect(2, y, 28, 1, c, 1); L.trama(2, y - 1, 28, 3, '#ff8080', 1); }
      else L.trama(2, y, 28, 1, '#ff3b3b', 1);
    }
    return L;
  }
  // Destello del impacto del arma
  function sprImpacto() {
    const L = new Lienzo(S);
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4;
      for (let r = 3; r < 10; r++) L.pix(16 + Math.cos(a) * r, 16 + Math.sin(a) * r, k & 1 ? '#e8b923' : '#ffffff', 1);
    }
    return L;
  }

  // ---------- Generación por zona (con caché) ----------
  const cacheZona = {};
  function zona(n) {
    if (cacheZona[n]) return cacheZona[n];
    const z = ZONAS[n] || ZONAS[1];
    const decor = n === 2 ? texMaquinaria(z) : n === 3 ? texServidor(z) : n === 4 ? texVentanal(z) : texCapsula();
    const juego = {
      paredes: {
        1: texPanel(z, n), 2: texNeon(z, n), 3: texTuberias(z, n), 4: texHologramaBase(z),
        5: COMUNES.puerta, 6: decor, 7: COMUNES.ducto, 8: texEstacion(z, false),
        9: COMUNES.puertaMagenta, 10: COMUNES.puertaTarjeta, 11: COMUNES.salida,
        12: COMUNES.aplastador, 13: COMUNES.nucleo[0]
      },
      estacionActiva: texEstacion(z, true),
      piso: texPiso(z, n),
      techoA: texTecho(z, true, n),
      techoB: texTecho(z, false, n),
      electrico: [texElectrico(z, 0), texElectrico(z, 1), texElectrico(z, 2)],
      gas: [texGas(z, 0), texGas(z, 1), texGas(z, 2)],
      baldosas: [texBaldosa(z, 0), texBaldosa(z, 1), texBaldosa(z, 2)],
      ventila: [texVentila(z, 0), texVentila(z, 1), texVentila(z, 2), texVentila(z, 3)],
      avisoAplastador: COMUNES.avisoAplastador
    };
    cacheZona[n] = juego;
    return juego;
  }

  const COMUNES = {
    puerta: texPuertaNormal(),
    puertaMagenta: texPuertaMagenta(),
    puertaTarjeta: texPuertaTarjeta(),
    ducto: texDucto(),
    salida: texSalida(),
    aplastador: texAplastador(),
    nucleo: [texNucleo(0), texNucleo(1)],
    avisoAplastador: texAvisoAplastador()
  };

  // ---------- Sprite (32×32) dibujado con una función de canvas 2D ----------
  // Los píxeles transparentes quedan en 0. Sirve para sprites de personajes.
  let lienzoSprite = null;
  function spriteDesde(dibujar) {
    if (!lienzoSprite) {
      lienzoSprite = document.createElement('canvas');
      lienzoSprite.width = S; lienzoSprite.height = S;
    }
    const c = lienzoSprite.getContext('2d', { willReadFrequently: true });
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, S, S);
    dibujar(c);
    const d = c.getImageData(0, 0, S, S).data;
    const L = new Lienzo(S);
    for (let i = 0; i < S * S; i++) {
      if (d[i * 4 + 3] < 128) continue;
      L.px[i] = empacar(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
      L.em[i] = d[i * 4 + 3] === 254 ? 1 : 0;   // alfa 254 = píxel emisivo (marcador de color)
    }
    return L;
  }

  // Otros jugadores en el laberinto (multijugador): su personaje + un rombo con el color de su puesto
  const COLORES_PUESTO = ['#22e4ff', '#ff2bd6', '#e8b923', '#4dff8a'];
  const cacheJugador = {};
  function spriteJugador(personaje, puesto, atrapado) {
    const clave = personaje + '|' + puesto + '|' + (atrapado ? 1 : 0);
    if (cacheJugador[clave]) return cacheJugador[clave];
    const L = spriteDesde(function (c) {
      if (atrapado) {
        // Tendido en el suelo
        c.translate(30, 18); c.rotate(Math.PI / 2);
        W.Personajes.dibujarCuerpo(c, personaje, 0, 0, 1, 0, 2, false);
        c.setTransform(1, 0, 0, 1, 0, 0);
      } else {
        W.Personajes.dibujarCuerpo(c, personaje, 8, 4, 1, 0, 2, false);
      }
      // Marcador de color (emisivo: se ve de lejos)
      c.fillStyle = COLORES_PUESTO[puesto % 4];
      c.globalAlpha = 254 / 255;
      const y = atrapado ? 10 : 0;
      c.fillRect(15, y, 2, 1); c.fillRect(14, y + 1, 4, 1); c.fillRect(15, y + 2, 2, 1);
      c.globalAlpha = 1;
    });
    cacheJugador[clave] = L;
    return L;
  }

  W.texturas = {
    zona: zona,
    hologramaDesde: hologramaDesde,
    spriteDesde: spriteDesde,
    spriteJugador: spriteJugador,
    COLORES_PUESTO: COLORES_PUESTO,
    comunes: COMUNES,
    sprites: {
      dron: sprDron(false), dronAturdido: sprDron(true),
      perseguidor: sprPerseguidor(false), perseguidorAturdido: sprPerseguidor(true),
      guardian: sprGuardian(false), guardianAturdido: sprGuardian(true),
      chatarra: sprChatarra(), botiquin: sprBotiquin(),
      laser: [sprLaser(0), sprLaser(1), sprLaser(2)],
      impacto: sprImpacto()
    },
    // utilidades para otros módulos
    azar: azar,
    empacar: empacar,
    color: color
  };
})();

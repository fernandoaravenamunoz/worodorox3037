// =====================================================
// Texturas procedurales 64×64 — Worodorox 3073 · 32 bits ("Alarma neón", como DuMulti)
// Todo se dibuja con código: no hay imágenes externas.
//
// Cada textura es un "Lienzo" con:
//   px : colores empaquetados (Uint32 en el orden del canvas). 0 = transparente.
//   em : 1 si el píxel es emisivo (neón: no lo oscurecen la luz ni la niebla)
//   luz: (opcional) { col, k, radio, canal } si la pared ilumina su entorno (ver luces.js)
// Texturas animadas: objeto { anim: true, cuadros: [Lienzo], fps, actual, luz }.
// W.texturas.actualizar(t) elige el cuadro vigente de cada animación.
//
// Cada zona (1 a 4) tiene su color de neón y su metal:
//   1 Criogenia magenta · 2 Industrial naranja · 3 Núcleo violeta · 4 Hangar cian
// Basado en js/motor3d/texturas.js de DuMulti (Lienzo, panel, daños, pantallas, alarma,
// cápsula, compuerta, piso, plasma, techo) y en las texturas de Worodorox 16 bits.
// =====================================================
(function () {
  'use strict';
  const T = W.config.TEX;
  const PAL = W.paleta;

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
  function mezclaHex(h1, h2, t) {
    const a = hexARgb(h1), b = hexARgb(h2);
    return empacar(lim(a[0] + (b[0] - a[0]) * t), lim(a[1] + (b[1] - a[1]) * t), lim(a[2] + (b[2] - a[2]) * t));
  }
  function escalar(c, k) {
    return empacar(lim((c & 255) * k), lim(((c >>> 8) & 255) * k), lim(((c >>> 16) & 255) * k));
  }
  function escalarHex(h, k) {
    const c = hexARgb(h);
    return '#' + [c[0] * k, c[1] * k, c[2] * k].map(function (v) { return ('0' + lim(v).toString(16)).slice(-2); }).join('');
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
  Lienzo.prototype.pixC = function (x, y, v, e) {
    const t = this.t;
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= t || y >= t) return;
    const i = y * t + x;
    this.px[i] = v; this.em[i] = e ? 1 : 0;
  };
  Lienzo.prototype.pix = function (x, y, c, e) { this.pixC(x, y, color(c), e); };
  Lienzo.prototype.rect = function (x, y, w, h, c, e) {
    const v = color(c);
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.pixC(i, j, v, e);
  };
  Lienzo.prototype.trama = function (x, y, w, h, c, e) {
    const v = color(c);
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (((i + j) & 1) === 0) this.pixC(i, j, v, e);
  };
  Lienzo.prototype.grad = function (x, y, w, h, c1, c2, vertical, e) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const t = vertical ? j / Math.max(1, h - 1) : i / Math.max(1, w - 1);
      this.pixC(x + i, y + j, mezclaHex(c1, c2, t), e);
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
  Lienzo.prototype.linea = function (x0, y0, x1, y1, c, e) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
    const v = color(c);
    for (let k = 0; k <= n; k++) {
      const t = n ? k / n : 0;
      this.pixC(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), v, e);
    }
  };
  Lienzo.prototype.oscurecer = function (x, y, w, h, k) {
    const t = this.t;
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      if (i < 0 || j < 0 || i >= t || j >= t) continue;
      const q = j * t + i;
      if (this.px[q] && !this.em[q]) this.px[q] = escalar(this.px[q], k);
    }
  };
  Lienzo.prototype.mancha = function (cx, cy, r, k, rnd) {
    const t = this.t;
    for (let j = Math.floor(cy - r); j <= cy + r; j++) for (let i = Math.floor(cx - r); i <= cx + r; i++) {
      if (i < 0 || j < 0 || i >= t || j >= t) continue;
      const d = Math.hypot(i - cx, j - cy) / r + (rnd() - 0.5) * 0.35;
      if (d > 1) continue;
      const q = j * t + i;
      if (!this.px[q] || this.em[q]) continue;
      this.px[q] = escalar(this.px[q], 1 + (k - 1) * (1 - d));
    }
  };
  Lienzo.prototype.ruido = function (rnd, amp) {
    for (let k = 0; k < this.px.length; k++) {
      const c = this.px[k];
      if (this.em[k] || c === 0) continue;
      this.px[k] = escalar(c, 1 + (rnd() * 2 - 1) * amp);
    }
  };
  Lienzo.prototype.texto = function (str, x, y, c, e) {
    const L = this;
    W.fuente.dibujarCrudo({ fillRect: function (a, b, w, h) { L.rect(a, b, w, h, c, e); } }, str, x, y, null, 1);
  };
  Lienzo.prototype.copia = function () {
    const L = new Lienzo(this.t);
    L.px.set(this.px); L.em.set(this.em);
    if (this.luz) L.luz = this.luz;
    return L;
  };
  function franjas(L, x, y, w, h, c1, c2, ancho, e1) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      const on = (((i + j) / ancho) | 0) & 1;
      L.pix(i, j, on ? c1 : c2, on && e1);
    }
  }
  function conLuz(L, col, k, radio, canal) { L.luz = { col: col, k: k, radio: radio, canal: canal || 0 }; return L; }

  // ---------- Animaciones ----------
  const animadas = [];
  function animada(cuadros, fps, luz) {
    const a = { anim: true, cuadros: cuadros, fps: fps, actual: cuadros[0], luz: luz || cuadros[0].luz || null };
    animadas.push(a);
    return a;
  }
  function actualizar(t, fases) {
    for (const a of animadas) {
      const n = a.cuadros.length;
      let k = ((Math.floor(t * a.fps) % n) + n) % n;
      if (a.alarma && fases) k = ((Math.floor(fases.giroAlarma * n) % n) + n) % n;
      a.actual = a.cuadros[k];
    }
  }

  // ---------- Colores de cada zona ----------
  const ZONAS = {
    1: { neon: '#ff2bd6', neonClaro: '#ffd0f5', neonOsc: '#7a1466', m1: '#33304a', m2: '#25233a', luz: '#3e3b58', luz2: '#4f4c6a', sombra: '#17151f', negro: '#0b0a12', remache: '#7a828d', piso: '#14121c', pisoLinea: '#28243a', techo: '#110f1a', tinte: [1.0, 0.86, 1.18] },
    2: { neon: '#ff8a2b', neonClaro: '#ffd9b0', neonOsc: '#6b3510', m1: '#3d322c', m2: '#2b221e', luz: '#4f4138', luz2: '#5f5044', sombra: '#191210', negro: '#0d0907', remache: '#a08060', piso: '#16110e', pisoLinea: '#2e241d', techo: '#130e0b', tinte: [1.12, 0.92, 0.82] },
    3: { neon: '#b44dff', neonClaro: '#e6c8ff', neonOsc: '#4a1a73', m1: '#2b2140', m2: '#1e1630', luz: '#3a2c55', luz2: '#4a3a68', sombra: '#0f0a17', negro: '#08050e', remache: '#7a6a9d', piso: '#110c19', pisoLinea: '#241b34', techo: '#0d0814', tinte: [0.98, 0.84, 1.24] },
    4: { neon: '#22e4ff', neonClaro: '#c8fbff', neonOsc: '#0f5a6b', m1: '#22323a', m2: '#18242b', luz: '#2f4550', luz2: '#3d5866', sombra: '#0b1215', negro: '#060b0d', remache: '#6f8a94', piso: '#0e1417', pisoLinea: '#1d2b31', techo: '#0a1012', tinte: [0.86, 0.98, 1.16] }
  };

  // ---------- Base común: panel metálico 2×2 con bisel y remaches ----------
  function panelBase(L, z) {
    L.grad(0, 0, T, T, z.m1, z.m2, true);
    for (let py = 0; py < 2; py++) for (let px = 0; px < 2; px++) {
      const x = px * 32, y = py * 32;
      L.rect(x, y, 32, 1, z.luz2);
      L.rect(x, y, 1, 32, z.luz);
      L.rect(x, y + 31, 32, 1, z.negro);
      L.rect(x + 31, y, 1, 32, z.sombra);
      [[3, 3], [27, 3], [3, 27], [27, 27]].forEach(function (p) {
        L.rect(x + p[0], y + p[1], 2, 2, z.remache);
        L.pix(x + p[0], y + p[1], '#b4bac4');
        L.pix(x + p[0] + 1, y + p[1] + 2, z.negro);
      });
    }
  }

  // =====================================================
  // PAREDES
  // =====================================================
  // 1: pared metálica dañada (3 variantes)
  function texDanada(z, v, n) {
    const rnd = azar(101 + v * 17 + n * 5);
    const L = new Lienzo();
    panelBase(L, z);
    for (let k = 0; k < 3 + v; k++) {
      const cx = 6 + rnd() * 52, cy = 6 + rnd() * 52, r = 3 + rnd() * 5;
      L.mancha(cx, cy, r, 0.62, rnd);
      L.mancha(cx - 1, cy - r * 0.6, r * 0.5, 1.25, rnd);
    }
    for (let k = 0; k < 6; k++) {
      const x0 = rnd() * 64, y0 = rnd() * 64, l = 5 + rnd() * 12, a = -0.4 + rnd() * 0.8;
      L.linea(x0, y0, x0 + Math.cos(a) * l, y0 + Math.sin(a) * l, z.luz2);
    }
    L.mancha(v === 1 ? 40 : 18, v === 2 ? 20 : 44, 13, 0.35, rnd);
    L.mancha(v === 1 ? 40 : 18, v === 2 ? 20 : 44, 7, 0.55, rnd);
    if (v === 0) {
      // Panel arrancado: cables y una chispa
      L.rect(36, 6, 22, 20, '#07060d');
      L.rect(36, 6, 22, 1, z.luz);
      const cables = ['#4a1414', '#0b3a46', '#4f4214', '#2f3245'];
      for (let k = 0; k < 4; k++) for (let x = 37; x < 57; x++) {
        const y = 9 + k * 4 + Math.round(Math.sin((x - 36) / 20 * Math.PI) * (2 + k));
        L.pix(x, y, cables[k]); L.pix(x, y + 1, escalarHex(cables[k], 0.6));
      }
      L.pix(47, 15, '#ffd34a', 1); L.pix(48, 14, '#ffffff', 1); L.pix(49, 15, '#ffd34a', 1);
      L.pix(46, 13, z.neon, 1);
      for (let j = 0; j < 7; j++) L.rect(51 + j, 26 + j, 7 - j, 1, z.luz2);
    } else if (v === 1) {
      // Fuga: chorreado con escarcha (o aceite en la zona industrial)
      const chorro = n === 2 ? '#2a1c10' : '#16404c';
      for (let k = 0; k < 5; k++) L.rect(8 + k * 3 + (rnd() * 2 | 0), 30, 2, 18 + (rnd() * 14 | 0), chorro);
      L.trama(6, 28, 18, 4, n === 2 ? '#6b5a3a' : '#9fe8f5');
    } else {
      for (let i = 0; i < 5; i++) L.rect(10, 38 + i * 3, 18, 1, z.negro);
      L.linea(10, 38, 27, 51, z.luz2);
      franjas(L, 0, 58, 64, 6, '#6b5a1a', '#141319', 4);
      L.oscurecer(0, 58, 64, 6, 0.8);
    }
    L.trama(0, 60, 64, 4, z.negro);
    L.ruido(rnd, 0.06);
    return L;
  }

  // 1 (variante): panel liso con placa del sector
  function texLisa(z, n) {
    const rnd = azar(120 + n);
    const L = new Lienzo();
    panelBase(L, z);
    for (let i = 0; i < 5; i++) L.rect(38, 40 + i * 3, 20, 1, z.negro);
    L.rect(6, 40, 16, 9, z.negro); L.rect(7, 41, 14, 1, z.luz);
    L.texto(['C', 'I', 'N', 'H'][n - 1] + n, 8, 43, '#8d93ad');
    L.trama(0, 60, 64, 4, z.negro);
    L.ruido(rnd, 0.05);
    return L;
  }

  // 1 (variante): pantalla de pared con texto (2 cuadros: el cursor parpadea)
  const TEXTOS_PANTALLA = {
    1: [['CRIOGENIA', 'CAPSULAS:', 'FALLA 87%', 'TEMP -196', '> EVACUAR'], ['IA CENTRAL', 'ESTADO:', 'INESTABLE', 'PROTOCOLO', '> SELLAR']],
    2: [['EXTRACCION', 'ENERGIA:', 'HUMANA', 'RENDIM. 4%', '> DETENER'], ['SEGURIDAD', 'TRAMPAS:', 'ACTIVAS', 'SECTOR 2', '> CUIDADO']],
    3: [['NUCLEO IA', 'DEFENSAS:', 'EN LINEA', 'INTRUSOS 1', '> CAZAR'], ['MEMORIA', 'PATRON:', '3-1-4-1', 'ERROR 0x5', '> ...']],
    4: [['HANGAR', 'SALVAVIDAS', 'LISTA: 1', 'RUMBO:', '> TEMUKEITOR'], ['LANZAMIENTO', 'COMPUERTA', 'BLOQUEADA', 'LLAVE REQ.', '> BUSCAR']]
  };
  function texPantalla(z, n, v, cuadro) {
    const rnd = azar(150 + v + n * 3);
    const L = new Lienzo();
    panelBase(L, z);
    L.rect(3, 5, 58, 46, z.negro);
    L.rect(3, 5, 58, 1, z.luz2);
    L.grad(5, 7, 54, 42, '#03161c', '#020a0e', true, 1);
    for (let y = 7; y < 49; y += 2) for (let x = 5; x < 59; x++) L.pixC(x, y, color('#041d24'), 1);
    const lineas = TEXTOS_PANTALLA[n][v];
    L.rect(5, 7, 54, 8, PAL.cianOsc, 1);
    L.texto(lineas[0], 7, 9, PAL.cianClaro, 1);
    for (let k = 1; k < lineas.length; k++) {
      const col = k === lineas.length - 1 ? PAL.cian : (k === 3 ? z.neon : '#7fe9f7');
      L.texto(lineas[k], 7, 9 + k * 8, col, 1);
    }
    if (cuadro) L.rect(Math.min(56, 7 + W.fuente.ancho(lineas[lineas.length - 1], 1) + 2), 9 + (lineas.length - 1) * 8, 3, 5, PAL.cian, 1);
    L.linea(50, 9, 56, 15, '#0f3a44', 1);
    L.rect(8, 54, 6, 4, PAL.cianOsc); L.rect(16, 54, 6, 4, z.luz); L.rect(24, 54, 6, 4, z.luz);
    L.rect(44, 54, 12, 4, cuadro ? PAL.rojo : PAL.rojoOsc, cuadro);
    L.ruido(rnd, 0.03);
    return conLuz(L, PAL.cian, 1.0, 3.0);
  }

  // 1 (variante): alarma roja giratoria (4 cuadros, sincronizada con la luz roja)
  function texAlarma(z, cuadro) {
    const rnd = azar(160);
    const L = new Lienzo();
    panelBase(L, z);
    franjas(L, 6, 44, 52, 8, '#6b1010', '#141319', 4);
    L.rect(14, 45, 36, 6, '#0b0a12');
    L.texto('ALERTA', 20, 46, cuadro % 2 ? PAL.rojo : '#8a2020', cuadro % 2);
    L.rect(20, 32, 24, 8, z.m1); L.rect(20, 32, 24, 1, z.remache); L.rect(18, 38, 28, 3, z.sombra);
    const cx = 32, cy = 22, R = 12;
    for (let j = -R; j <= 10; j++) for (let i = -R; i <= R; i++) {
      const d = Math.hypot(i, j);
      if (d > R) continue;
      const lit = Math.cos(Math.atan2(j, i) - cuadro * Math.PI / 2) > 0.3;
      L.pix(cx + i, cy + j, lit ? (d < 5 ? '#ffd0d0' : PAL.rojo) : (d < 6 ? '#8a2020' : PAL.rojoOsc), lit);
    }
    L.anillo(cx, cy, 11, 12.5, z.luz);
    L.rect(cx - 12, cy - 1, 24, 1, z.luz2);
    L.rect(cx - 1, cy - 12, 2, 22, z.luz2);
    L.pix(cx - 4, cy - 6, '#ffffff', 1);
    L.ruido(rnd, 0.04);
    return L;
  }

  // 2: panel con tira de neón (color de la zona)
  function texNeon(z, n) {
    const rnd = azar(130 + n);
    const L = new Lienzo();
    panelBase(L, z);
    L.rect(0, 22, T, 14, z.negro);
    L.trama(0, 23, T, 2, z.neonOsc, 1);
    L.trama(0, 33, T, 2, z.neonOsc, 1);
    L.rect(0, 26, T, 6, z.neon, 1);
    L.rect(0, 28, T, 2, z.neonClaro, 1);
    L.rect(0, 22, T, 1, z.luz2);
    L.rect(0, 36, T, 1, z.sombra);
    for (let x = 6; x < T; x += 20) { L.rect(x, 24, 3, 10, z.luz); L.rect(x, 24, 3, 1, z.remache); }
    L.rect(8, 46, 4, 2, PAL.verde, 1); L.rect(14, 46, 4, 2, '#1d3a26');
    L.rect(20, 46, 4, 2, PAL.cian, 1);
    L.ruido(rnd, 0.05);
    return conLuz(L, z.neon, 1.6, 4.2);
  }

  // 3: tuberías
  function texTuberias(z, n) {
    const rnd = azar(140 + n);
    const L = new Lienzo();
    L.grad(0, 0, T, T, z.piso, z.negro, true);
    const base = n === 2 ? '#6b5a4a' : '#4a4f63';
    const tubos = [[3, 12, base], [20, 8, n === 3 ? '#5a4a73' : '#5a4f63'], [33, 16, base], [53, 8, '#3d3a50']];
    tubos.forEach(function (t) {
      const x = t[0], w = t[1];
      for (let i = 0; i < w; i++) {
        const k = 0.35 + 0.85 * Math.sin(Math.PI * (i + 0.5) / w);
        const v = color(t[2], k);
        for (let y = 0; y < T; y++) L.pixC(x + i, y, v);
      }
      L.rect(x + (w >> 2), 0, 1, T, '#8d93ad');
      for (let y = 5; y < T; y += 18) { L.rect(x - 1, y, w + 2, 4, z.m1); L.rect(x - 1, y, w + 2, 1, z.remache); }
    });
    L.anillo(41, 40, 3, 6, '#a01818'); L.rect(40, 34, 2, 12, PAL.rojo); L.rect(35, 39, 12, 2, PAL.rojo);
    L.trama(33, 48, 16, 16, n === 2 ? '#4a3a1a' : '#1d6b7a');
    L.pix(38, 52, PAL.cianClaro, 1); L.pix(42, 58, PAL.cianClaro, 1);
    L.ruido(rnd, 0.05);
    return L;
  }

  // 4: marco de holograma (la pista se dibuja encima con hologramaDesde)
  function texHologramaBase(z) {
    const L = new Lienzo();
    panelBase(L, z);
    L.rect(4, 4, 56, 56, z.negro);
    L.grad(6, 6, 52, 52, '#04161c', '#020b10', true);
    for (let y = 7; y < 57; y += 3) L.rect(6, y, 52, 1, '#05202a');
    L.rect(5, 5, 54, 1, PAL.cian, 1); L.rect(5, 58, 54, 1, PAL.cian, 1);
    L.rect(5, 5, 1, 54, PAL.cian, 1); L.rect(58, 5, 1, 54, PAL.cian, 1);
    [[5, 5], [56, 5], [5, 56], [56, 56]].forEach(function (p) { L.rect(p[0], p[1], 3, 3, PAL.cianClaro, 1); });
    L.rect(26, 60, 12, 2, PAL.cianOsc, 1);
    return conLuz(L, PAL.cian, 1.0, 3.2);
  }

  // 6: decoración de cada zona
  function texCapsula(z, rota) {
    const rnd = azar(170 + (rota ? 1 : 0));
    const L = new Lienzo();
    L.grad(0, 0, T, T, '#1c1b2b', '#121119', true);
    L.rect(8, 2, 48, 60, '#3a3d54');
    L.rect(8, 2, 48, 3, '#7a828d');
    L.rect(8, 59, 48, 3, '#16151f');
    L.grad(12, 7, 40, 46, '#0e3a44', '#0a2028', true);
    L.trama(12, 7, 40, 46, '#1d6b7a');
    if (!rota) {
      L.anillo(32, 15, 0, 4, '#0a1a24');
      L.rect(30, 19, 4, 3, '#0a1a24');
      L.rect(21, 22, 22, 5, '#0a1a24');
      L.rect(20, 27, 4, 15, '#0a1a24'); L.rect(40, 27, 4, 15, '#0a1a24');
      L.rect(25, 27, 14, 24, '#0a1a24');
      L.trama(12, 40, 40, 13, '#9fe8f5');
    } else {
      L.rect(12, 7, 40, 46, '#06141a');
      L.linea(20, 8, 30, 30, '#9fe8f5'); L.linea(30, 30, 44, 22, '#9fe8f5');
      L.linea(30, 30, 26, 52, '#9fe8f5'); L.linea(30, 30, 50, 46, '#c8fbff');
      L.trama(12, 46, 40, 7, '#3b7d8a');
    }
    L.rect(15, 9, 2, 40, '#5fd3e6');
    L.rect(18, 56, 5, 2, PAL.cian, 1);
    L.rect(29, 56, 5, 2, rota ? PAL.rojoOsc : PAL.cian, !rota);
    L.rect(40, 56, 5, 2, PAL.rojo, 1);
    L.ruido(rnd, 0.04);
    return conLuz(L, '#9fe8f5', 0.9, 2.8);
  }
  function texMaquinaria(z, cuadro) {
    const rnd = azar(67);
    const L = new Lienzo();
    panelBase(L, z);
    L.rect(6, 6, 52, 30, '#1a1411');
    const giro = cuadro * Math.PI / 8;
    L.anillo(22, 21, 6, 11, '#6b5a4a');
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4 + giro;
      L.rect(Math.round(22 + Math.cos(a) * 12) - 1, Math.round(21 + Math.sin(a) * 12) - 1, 3, 3, '#8a7a6a');
    }
    L.anillo(22, 21, 0, 3, '#a08060');
    L.rect(40, 8, 10, 26, '#4f3f36');
    L.rect(43, 8 + cuadro * 3, 4, 26 - cuadro * 3, '#8a7a6a');
    L.rect(8, 42, 48, 6, '#2b0d05');
    L.rect(10, 44, 44, 2, z.neon, 1);
    L.trama(10, 43, 44, 1, z.neonClaro, 1);
    franjas(L, 0, 54, 64, 6, '#e8b923', '#15151a', 4);
    L.ruido(rnd, 0.05);
    return conLuz(L, z.neon, 1.1, 3.0);
  }
  function texServidor(z, cuadro) {
    const L = new Lienzo();
    L.rect(0, 0, T, T, '#0f0a17');
    L.rect(4, 2, 56, 60, '#1c1528');
    L.rect(4, 2, 56, 2, '#36284a');
    const rnd = azar(68 + cuadro * 11);
    for (let fila = 0; fila < 9; fila++) {
      const y = 6 + fila * 6;
      L.rect(7, y, 50, 5, '#120d1c');
      L.rect(7, y, 50, 1, '#2a2040');
      for (let i = 0; i < 6; i++) {
        const r = rnd();
        const c = r < 0.35 ? PAL.verde : r < 0.6 ? PAL.cian : r < 0.75 ? z.neon : '#2a2040';
        L.rect(10 + i * 4, y + 2, 2, 1, c, c !== '#2a2040');
      }
      for (let i = 0; i < 4; i++) L.rect(38 + i * 4, y + 1, 2, 3, '#0a0710');
    }
    L.ruido(azar(69), 0.04);
    return conLuz(L, z.neon, 0.8, 2.6);
  }
  function texVentanal(z) {
    const L = new Lienzo();
    panelBase(L, z);
    L.rect(6, 8, 52, 40, '#020308');
    const rnd = azar(70);
    for (let k = 0; k < 40; k++) L.pix(7 + rnd() * 50, 9 + rnd() * 38, rnd() < 0.3 ? '#c8fbff' : '#6f8a94', 1);
    L.anillo(44, 22, 0, 7, '#1d6b7a', 1);
    L.trama(38, 16, 12, 12, '#4dd2ff', 1);
    L.anillo(44, 22, 7, 8, '#0f5a6b', 1);
    // Nave salvavidas a lo lejos
    L.rect(14, 34, 10, 3, '#8d93ad', 1); L.rect(16, 32, 5, 2, '#c8fbff', 1); L.pix(13, 35, PAL.magenta, 1);
    L.rect(6, 8, 52, 2, z.luz); L.rect(6, 46, 52, 2, z.sombra);
    L.rect(31, 8, 2, 40, z.m1);
    L.rect(10, 52, 44, 3, z.neon, 1);
    L.ruido(azar(71), 0.04);
    return conLuz(L, z.neon, 0.9, 3.0);
  }

  // Compuertas: base con franjas, hojas y cerradura de un color
  function puertaBase(colFranja, colLuz, colLuzClaro, semilla) {
    const rnd = azar(semilla);
    const L = new Lienzo();
    L.grad(0, 0, T, T, '#34364a', '#24253a', true);
    franjas(L, 0, 0, T, 9, colFranja, '#18101a', 5, true);
    franjas(L, 0, 55, T, 9, colFranja, '#18101a', 5, true);
    L.rect(0, 9, T, 1, '#0b0a12'); L.rect(0, 54, T, 1, '#0b0a12');
    L.rect(4, 12, 25, 40, '#2d2f42'); L.rect(35, 12, 25, 40, '#2d2f42');
    L.rect(4, 12, 25, 1, '#4a4f63'); L.rect(35, 12, 25, 1, '#4a4f63');
    L.rect(9, 16, 15, 10, '#0b0a12');
    L.grad(10, 17, 13, 8, escalarHex(colLuz, 0.45), escalarHex(colLuz, 0.2), true, 1);
    L.rect(10, 17, 13, 1, colLuzClaro, 1);
    L.rect(40, 26, 15, 14, '#0b0a12');
    L.rect(42, 28, 11, 4, colLuz, 1);
    L.rect(44, 29, 7, 2, colLuzClaro, 1);
    L.rect(42, 35, 3, 3, PAL.cian, 1); L.rect(47, 35, 3, 3, '#3a3a52'); L.rect(52, 35, 1, 3, '#3a3a52');
    L.rect(31, 12, 2, 40, '#0b0a12');
    L.rect(6, 46, 20, 2, '#4a4f63');
    L.ruido(rnd, 0.04);
    return L;
  }
  function texPuertaNormal() {
    const L = puertaBase('#4a4f63', PAL.cian, PAL.cianClaro, 54);
    L.rect(26, 0, 12, 3, PAL.cian, 1);
    // Ícono de cerradura cian (información: se resuelve con un puzzle)
    L.rect(13, 34, 8, 7, PAL.cian, 1); L.rect(14, 30, 6, 1, PAL.cian, 1); L.rect(14, 30, 1, 4, PAL.cian, 1); L.rect(19, 30, 1, 4, PAL.cian, 1);
    L.rect(16, 36, 2, 3, '#06141a');
    return conLuz(L, PAL.cian, 0.55, 2.0);
  }
  function texPuertaMagenta() {
    const L = puertaBase(PAL.magenta, PAL.magenta, PAL.magentaClaro, 55);
    for (let j = 0; j < 10; j++) L.rect(16 - (j >> 1), 32 + j, (j >> 1) * 2 + 1, 1, PAL.magenta, 1);
    L.rect(16, 34, 1, 5, '#18101a'); L.pix(16, 40, '#18101a');
    L.rect(26, 0, 12, 3, PAL.rojo, 1);
    return conLuz(L, PAL.magenta, 0.85, 2.4);
  }
  function texPuertaTarjeta() {
    const L = puertaBase('#e6e3ff', '#e6e3ff', '#ffffff', 56);
    L.rect(40, 26, 15, 14, '#0b0a12');
    L.rect(42, 28, 11, 10, '#e6e3ff', 1);
    L.rect(45, 29, 5, 8, '#0b0a12');
    L.rect(11, 32, 14, 9, '#e6e3ff', 1); L.rect(12, 33, 12, 2, PAL.cian, 1);
    L.rect(26, 0, 12, 3, '#e6e3ff', 1);
    return conLuz(L, '#e6e3ff', 0.55, 2.0);
  }
  // 15: puerta de doble palanca
  function texPuertaPalanca() {
    const L = puertaBase(PAL.verde, PAL.verde, '#c8ffd8', 57);
    for (let k = 0; k < 2; k++) {
      const x = 9 + k * 9;
      L.rect(x, 30, 6, 14, '#0b0a12');
      L.rect(x + 2, 32, 2, 8, PAL.cian, 1);
      L.rect(x + 1, 32, 4, 3, PAL.verde, 1);
    }
    L.texto('X2', 12, 46, PAL.cianClaro, 1);
    L.rect(26, 0, 12, 3, PAL.verde, 1);
    return conLuz(L, PAL.verde, 0.6, 2.2);
  }

  // 7: acceso a ducto (marco amarillo hacia una sala 2D)
  function texDucto() {
    const L = new Lienzo();
    L.rect(0, 0, T, T, '#1c1b2b');
    franjas(L, 2, 2, 60, 60, PAL.amarillo, '#15151a', 5, true);
    L.rect(9, 9, 46, 46, '#0b0a12');
    L.grad(10, 10, 44, 44, '#16151f', '#07060d', true);
    for (let y = 13; y < 52; y += 4) { L.rect(12, y, 40, 2, '#262838'); L.rect(12, y, 40, 1, '#33354a'); }
    for (let k = 0; k < 3; k++) for (let j = 0; j < 4; j++) {
      L.rect(20 + j, 18 + k * 10 + j, 2, 2, PAL.amarilloClaro, 1);
      L.rect(42 - j, 18 + k * 10 + j, 2, 2, PAL.amarilloClaro, 1);
    }
    return conLuz(L, PAL.amarillo, 1.0, 2.6);
  }

  // 8: estación de respaldo (apagada / activa)
  function texEstacion(z, activa) {
    const L = new Lienzo();
    panelBase(L, z);
    const c = activa ? PAL.verde : PAL.cian;
    L.rect(11, 7, 42, 52, z.negro);
    L.rect(13, 9, 38, 48, '#1d1f2e');
    L.grad(16, 12, 32, 24, '#04161c', '#020a0e', true, 1);
    L.texto(activa ? 'RESPALDO' : 'RESPALDO', 17, 14, c, 1);
    L.rect(17, 21, activa ? 30 : 12, 3, c, 1);
    L.rect(17, 21, 30, 1, '#0b2a30', 1);
    L.texto(activa ? 'OK' : '...', 17, 27, activa ? PAL.verde : PAL.cianOsc, 1);
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
      const centro = i === 1 && j === 1;
      L.rect(19 + i * 9, 39 + j * 5, 7, 3, centro ? c : '#3a3d54', centro);
    }
    L.rect(13, 55, 38, 2, c, 1);
    return conLuz(L, c, activa ? 1.2 : 0.7, 2.8);
  }

  // 11: compuerta de salida
  function texSalida() {
    const L = new Lienzo();
    L.rect(0, 0, T, T, '#0b1a12');
    franjas(L, 0, 0, T, 6, PAL.verde, '#0b1a12', 5, true);
    L.rect(4, 8, 56, 54, '#123020');
    L.rect(4, 8, 2, 54, PAL.verde, 1); L.rect(58, 8, 2, 54, PAL.verde, 1);
    L.texto('SALIDA', 21, 12, PAL.verde, 1);
    for (let j = 0; j < 8; j++) L.rect(32 - j, 24 + j, j * 2 + 1, 1, PAL.verde, 1);
    L.rect(29, 32, 7, 14, PAL.verde, 1);
    L.trama(8, 50, 48, 10, '#1d6b3a');
    return conLuz(L, PAL.verde, 1.3, 3.4);
  }

  // 12: aplastador (compuerta hidráulica)
  function texAplastador() {
    const L = new Lienzo();
    L.grad(0, 0, T, T, '#3a3d52', '#24263a', true);
    for (let y = 0; y < T; y += 8) { L.rect(0, y, T, 2, '#1a1c26'); L.rect(0, y + 2, T, 1, '#4a4f63'); }
    franjas(L, 0, 52, T, 12, PAL.rojo, '#15151a', 4, true);
    L.rect(26, 8, 12, 34, '#4a4f63');
    L.rect(29, 8, 6, 34, '#8a93a8');
    L.rect(29, 8, 2, 34, '#c8cbd6');
    return conLuz(L, PAL.rojo, 0.6, 1.8, 1);
  }

  // 13: núcleo de la IA (dos cuadros)
  function texNucleo(cuadro) {
    const L = new Lienzo();
    L.rect(0, 0, T, T, '#0d0814');
    L.anillo(32, 32, 26, 30, '#4a1a73', 1);
    L.anillo(32, 32, 20, 24, '#b44dff', 1);
    L.anillo(32, 32, 0, 14, '#2b0a3a');
    L.anillo(32, 32, 0, cuadro ? 9 : 7, PAL.rojo, 1);
    L.anillo(32, 32, 0, cuadro ? 4 : 3, '#ffd0d0', 1);
    for (let k = 0; k < 12; k++) {
      const a = k * Math.PI / 6 + (cuadro ? 0.26 : 0);
      L.rect(Math.round(32 + Math.cos(a) * 17), Math.round(32 + Math.sin(a) * 17), 2, 2, PAL.magenta, 1);
    }
    return conLuz(L, PAL.rojo, 2.4, 6.0, 1);
  }

  // 14: palanca (apagada / activa)
  function texPalanca(z, activa) {
    const L = new Lienzo();
    panelBase(L, z);
    L.rect(19, 8, 26, 48, z.negro);
    L.rect(21, 10, 22, 44, z.m1);
    franjas(L, 21, 48, 22, 6, PAL.cian, '#141319', 4, true);
    L.rect(30, 14, 4, 30, '#0b0a12');
    const y = activa ? 36 : 12;
    L.rect(31, activa ? 28 : 18, 2, 14, '#8d93ad');
    L.rect(26, y, 12, 7, activa ? PAL.verde : PAL.rojo, 1);
    L.rect(27, y + 1, 4, 1, '#ffffff', 1);
    L.rect(23, 12, 3, 3, activa ? PAL.verde : '#1d3a26', activa);
    L.rect(38, 12, 3, 3, PAL.cian, 1);
    return conLuz(L, activa ? PAL.verde : PAL.cian, 0.8, 2.4);
  }

  // =====================================================
  // PISOS Y TECHOS
  // =====================================================
  function texPiso(z, v, n) {
    const rnd = azar(200 + v + n * 7);
    const L = new Lienzo();
    L.rect(0, 0, T, T, z.piso);
    for (let py = 0; py < 2; py++) for (let px = 0; px < 2; px++) {
      const x = px * 32, y = py * 32;
      L.rect(x, y, 32, 1, z.pisoLinea); L.rect(x, y, 1, 32, z.pisoLinea);
      L.rect(x, y + 31, 32, 1, '#09080e'); L.rect(x + 31, y, 1, 32, '#09080e');
      for (let j = 3; j < 29; j += 4) for (let i = 3 + ((j >> 2) & 1) * 2; i < 29; i += 4) {
        L.pix(x + i, y + j, escalarHex(z.pisoLinea, 0.9)); L.pix(x + i + 1, y + j, '#0d0c13');
      }
      L.rect(x + 2, y + 2, 1, 1, z.remache); L.rect(x + 29, y + 29, 1, 1, z.remache);
    }
    if (v === 1) {
      L.rect(0, 28, T, 2, '#6b5a1a');
      for (let x = 0; x < T; x += 8) L.rect(x, 28, 4, 2, PAL.amarillo);
      L.oscurecer(0, 28, T, 2, 0.75);
    } else if (v === 2) {
      // Rejilla de ventilación con luz de neón de la zona debajo
      L.rect(18, 18, 28, 28, '#05040a');
      for (let k = 0; k < 6; k++) L.rect(19, 20 + k * 4, 26, 2, z.pisoLinea);
      L.trama(20, 22, 24, 20, z.neonOsc, 1);
    }
    for (let k = 0; k < 3; k++) L.mancha(rnd() * 64, rnd() * 64, 4 + rnd() * 6, 0.7, rnd);
    L.ruido(rnd, 0.07);
    return L;
  }
  // Piso eléctrico: 0 apagado, 1 aviso (chispas), 2 activo
  function texElectrico(z, estado) {
    const L = new Lienzo();
    L.rect(0, 0, T, T, '#0d1218');
    for (let i = 0; i < T; i += 8) { L.rect(i, 0, 1, T, '#1e2a36'); L.rect(0, i, T, 1, '#1e2a36'); }
    franjas(L, 0, 0, T, 4, PAL.amarillo, '#15151a', 4, false);
    franjas(L, 0, 60, T, 4, PAL.amarillo, '#15151a', 4, false);
    const rnd = azar(90 + estado);
    if (estado >= 1) {
      const n = estado === 1 ? 12 : 70;
      for (let k = 0; k < n; k++) {
        let x = rnd() * T, y = rnd() * T;
        for (let s = 0; s < (estado === 2 ? 7 : 3); s++) {
          L.pix(x, y, estado === 2 ? '#ffffff' : PAL.cian, 1);
          x += rnd() * 4 - 2; y += rnd() * 4 - 2;
        }
      }
      if (estado === 2) L.trama(0, 4, T, 56, PAL.cian, 1);
    }
    return L;
  }
  // Gas: 0 rejillas, 1 aviso (burbujas), 2 nube tóxica
  function texGas(z, estado, n) {
    const L = texPiso(z, 0, n);
    const rnd = azar(95 + estado);
    if (estado === 0) for (let k = 0; k < 4; k++) { L.rect(8 + k * 14, 28, 8, 6, '#06140a'); L.rect(9 + k * 14, 29, 6, 1, '#1d3a26'); L.rect(9 + k * 14, 32, 6, 1, '#1d3a26'); }
    if (estado === 1) for (let k = 0; k < 16; k++) L.anillo(rnd() * T, rnd() * T, 1, 2, PAL.verde, 1);
    if (estado === 2) { L.trama(0, 0, T, T, '#3bd16a', 1); for (let k = 0; k < 22; k++) L.anillo(rnd() * T, rnd() * T, 0, 3, '#a8ffbf', 1); }
    return L;
  }
  // Baldosa con símbolo: 0 cuadrado, 1 círculo, 2 triángulo
  function texBaldosa(z, simbolo) {
    const L = new Lienzo();
    L.rect(0, 0, T, T, '#0f0c1a');
    L.grad(2, 2, 60, 60, '#211b3a', '#15112a', true);
    L.rect(2, 2, 60, 1, '#3a3260');
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
  function texVentila(z, dir, n) {
    const L = texPiso(z, 0, n);
    L.rect(6, 6, 52, 52, '#07060d');
    for (let k = 0; k < 2; k++) for (let j = 0; j < 8; j++) {
      const a = 20 + k * 18 + j, b = 32 - 8 + j, b2 = 32 + 8 - j;
      [[a - j * 2 + 8, b], [a - j * 2 + 8, b2]].forEach(function (p) {
        let x = p[0], y = p[1];
        for (let r = 0; r < dir; r++) { const t = x; x = T - 1 - y; y = t; }
        L.rect(x, y, 2, 2, '#9fe8f5', 1);
      });
    }
    return L;
  }
  function texAvisoAplastador() {
    const L = new Lienzo();
    franjas(L, 0, 0, T, T, PAL.rojo, '#1a0a0a', 8, true);
    return L;
  }
  function texTecho(z, lampara, n) {
    const rnd = azar(300 + (lampara ? 1 : 0) + n);
    const L = new Lienzo();
    L.rect(0, 0, T, T, z.techo);
    L.rect(0, 0, T, 1, z.pisoLinea); L.rect(0, 0, 1, T, z.pisoLinea);
    L.rect(0, 32, T, 1, '#08070d'); L.rect(32, 0, 1, T, '#08070d');
    for (let k = 0; k < 4; k++) L.rect(6 + k * 14, 50, 8, 2, '#08070d');
    if (lampara) {
      L.rect(18, 26, 28, 12, z.m1);
      L.rect(18, 26, 28, 1, z.luz2);
      L.rect(20, 28, 24, 8, '#c8c4ee', 1);
      L.rect(22, 30, 20, 4, '#ffffff', 1);
    }
    L.ruido(rnd, 0.05);
    return L;
  }

  // =====================================================
  // JUEGOS DE TEXTURAS POR ZONA (con caché)
  // =====================================================
  const COMUNES = {
    puerta: texPuertaNormal(),
    puertaMagenta: texPuertaMagenta(),
    puertaTarjeta: texPuertaTarjeta(),
    puertaPalanca: texPuertaPalanca(),
    ducto: texDucto(),
    salida: texSalida(),
    aplastador: texAplastador(),
    nucleo: [texNucleo(0), texNucleo(1)],
    avisoAplastador: texAvisoAplastador()
  };

  const cacheZona = {};
  function zona(n) {
    if (cacheZona[n]) return cacheZona[n];
    const z = ZONAS[n] || ZONAS[1];
    const decor = n === 2 ? animada([texMaquinaria(z, 0), texMaquinaria(z, 1)], 3)
      : n === 3 ? animada([texServidor(z, 0), texServidor(z, 1)], 2)
      : n === 4 ? texVentanal(z) : texCapsula(z, false);
    const alarma = animada([0, 1, 2, 3].map(function (k) { return texAlarma(z, k); }), 6, { col: PAL.rojo, k: 2.6, radio: 5.5, canal: 1 });
    alarma.alarma = true;
    const pantallas = [0, 1].map(function (v) { return animada([texPantalla(z, n, v, 0), texPantalla(z, n, v, 1)], 2); });
    const panel = texDanada(z, 0, n);
    const juego = {
      // Textura principal de cada tipo de casilla (como en la versión 16 bits)
      paredes: {
        1: panel, 2: texNeon(z, n), 3: texTuberias(z, n), 4: texHologramaBase(z),
        5: COMUNES.puerta, 6: decor, 7: COMUNES.ducto, 8: texEstacion(z, false),
        9: COMUNES.puertaMagenta, 10: COMUNES.puertaTarjeta, 11: COMUNES.salida,
        12: COMUNES.aplastador, 13: COMUNES.nucleo[0], 14: texPalanca(z, false), 15: COMUNES.puertaPalanca
      },
      // Variantes por casilla (el motor elige una según la posición, siempre la misma)
      variantes: {
        1: [panel, texDanada(z, 1, n), texDanada(z, 2, n), texLisa(z, n), panel, texDanada(z, 1, n), pantallas[0], pantallas[1], alarma],
        6: n === 1 ? [decor, decor, decor, texCapsula(z, true)] : null
      },
      // Probabilidad de cada variante (los índices que no aparecen valen 1)
      pesoVariante: { 1: [6, 5, 5, 3, 0, 0, 1, 1, 0.45] },
      estacionActiva: texEstacion(z, true),
      palancaActiva: texPalanca(z, true),
      piso: texPiso(z, 0, n),
      pisos: [texPiso(z, 0, n), texPiso(z, 0, n + 10), texPiso(z, 1, n), texPiso(z, 2, n)],
      pesoPiso: [8, 6, 1, 1],
      techoA: texTecho(z, true, n),
      techoB: texTecho(z, false, n),
      electrico: [texElectrico(z, 0), texElectrico(z, 1), texElectrico(z, 2)],
      gas: [texGas(z, 0, n), texGas(z, 1, n), texGas(z, 2, n)],
      baldosas: [texBaldosa(z, 0), texBaldosa(z, 1), texBaldosa(z, 2)],
      ventila: [texVentila(z, 0, n), texVentila(z, 1, n), texVentila(z, 2, n), texVentila(z, 3, n)],
      avisoAplastador: COMUNES.avisoAplastador,
      // Color de ambiente de la zona (multiplica la luz mínima)
      tinte: z.tinte,
      colores: z
    };
    // Las tablas de variantes se expanden según su peso (enteros pequeños)
    juego.tablaVariantes = {};
    for (const k in juego.variantes) {
      const v = juego.variantes[k];
      if (!v) continue;
      const pesos = juego.pesoVariante[k] || v.map(function () { return 1; });
      const tabla = [];
      v.forEach(function (tex, i) { const p = Math.round((pesos[i] === undefined ? 1 : pesos[i]) * 4); for (let q = 0; q < p; q++) tabla.push(tex); });
      juego.tablaVariantes[k] = tabla;
    }
    juego.tablaPisos = [];
    juego.pisos.forEach(function (tex, i) { for (let q = 0; q < juego.pesoPiso[i] * 2; q++) juego.tablaPisos.push(tex); });
    cacheZona[n] = juego;
    return juego;
  }

  // ---------- Holograma: la pista dibujada con canvas sobre el marco de la zona ----------
  // dibujar(ctx, ancho, alto): dibuja la pista en un área de 50×50
  let lienzoTemporal = null;
  function hologramaDesde(n, dibujar) {
    const L = zona(n).paredes[4].copia();
    if (!lienzoTemporal) {
      lienzoTemporal = document.createElement('canvas');
      lienzoTemporal.width = 50; lienzoTemporal.height = 50;
    }
    const c = lienzoTemporal.getContext('2d', { willReadFrequently: true });
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
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

  // Holograma cifrado (cooperativo con pistas repartidas): lo ven quienes no pueden leerlo
  const cacheCifrado = {};
  function hologramaCifrado(n, puesto, nombre) {
    const clave = n + '|' + puesto + '|' + nombre;
    if (cacheCifrado[clave]) return cacheCifrado[clave];
    const col = COLORES_PUESTO[puesto % 4];
    const rnd = azar(4242 + puesto * 17 + n);
    const L = hologramaDesde(n, function (c) {
      c.fillStyle = col;
      for (let k = 0; k < 70; k++) c.fillRect(Math.floor(rnd() * 50), Math.floor(rnd() * 30) + 18, 1 + Math.floor(rnd() * 3), 1);
      c.fillStyle = '#0b0d16'; c.fillRect(2, 2, 46, 15);
      W.fuente.dibujarCrudo(c, 'CIFRADO', 11, 4, PAL.magenta, 1);
      W.fuente.dibujarCrudo(c, 'SOLO LEE', 9, 11, '#8d93ad', 1);
      c.fillStyle = '#0b0d16'; c.fillRect(1, 40, 48, 9);
      const s = String(nombre || '').slice(0, 12);
      W.fuente.dibujarCrudo(c, s, Math.max(1, Math.round(25 - (s.length * 4 - 1) / 2)), 42, col, 1);
    });
    cacheCifrado[clave] = L;
    return L;
  }

  // =====================================================
  // SPRITES 64×64
  // =====================================================
  // dibujar(r, e, c): r = rectángulo normal, e = rectángulo emisivo, c = contexto
  // (truco heredado: un píxel con alfa 254 queda marcado como EMISIVO)
  const lienzos = {};
  function spriteDesde(dibujar, tam) {
    const S = tam || 64;
    if (!lienzos[S]) { lienzos[S] = document.createElement('canvas'); lienzos[S].width = S; lienzos[S].height = S; }
    const c = lienzos[S].getContext('2d', { willReadFrequently: true });
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.clearRect(0, 0, S, S);
    const r = function (x, y, w, h, col) { c.globalAlpha = 1; c.fillStyle = col; c.fillRect(x, y, w, h); };
    const e = function (x, y, w, h, col) { c.clearRect(x, y, w, h); c.globalAlpha = 254 / 255; c.fillStyle = col; c.fillRect(x, y, w, h); c.globalAlpha = 1; };
    dibujar(r, e, c);
    const d = c.getImageData(0, 0, S, S).data;
    const L = new Lienzo(S);
    for (let i = 0; i < S * S; i++) {
      if (d[i * 4 + 3] < 128) continue;
      L.px[i] = empacar(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
      L.em[i] = d[i * 4 + 3] === 254 ? 1 : 0;
    }
    return L;
  }
  function rgbK(h, k) { const c = hexARgb(h); return 'rgb(' + lim(c[0] * k) + ',' + lim(c[1] * k) + ',' + lim(c[2] * k) + ')'; }

  // Dron patrullero (esfera con ojo; aturdido: ojo amarillo, inclinado y con chispas)
  function sprDron(aturdido) {
    return spriteDesde(function (r, e) {
      const cx = 32, cy = aturdido ? 34 : 30;
      const ojo = aturdido ? PAL.amarillo : PAL.rojo, ojoOsc = aturdido ? '#6b5a1a' : PAL.rojoOsc;
      r(8, cy - 12, 16, 3, '#3a3a52'); r(40, cy - 12 + (aturdido ? 3 : 0), 16, 3, '#3a3a52');
      r(8, cy - 12, 16, 1, '#7a828d'); r(40, cy - 12 + (aturdido ? 3 : 0), 16, 1, '#7a828d');
      for (let i = 0; i < 18; i++) if ((i & 1) === 0) { r(1 + i, cy - 15, 1, 1, '#8d93ad'); r(45 + i, cy - 15 + (aturdido ? 3 : 0), 1, 1, '#8d93ad'); }
      r(8, cy - 14, 4, 6, '#2a2a3c'); r(52, cy - 14 + (aturdido ? 3 : 0), 4, 6, '#2a2a3c');
      for (let j = -14; j <= 14; j++) for (let i = -14; i <= 14; i++) {
        const d = Math.hypot(i, j);
        if (d > 14) continue;
        const luz = Math.max(0, (-i * 0.5 - j * 0.7) / 14);
        const k = 0.35 + 0.55 * luz + (d > 12.5 ? -0.15 : 0);
        const v = Math.round(58 * k + 20);
        r(cx + i, cy + j, 1, 1, 'rgb(' + v + ',' + v + ',' + (v + 22) + ')');
      }
      r(cx - 14, cy + 3, 29, 2, '#16151f');
      r(cx - 13, cy + 3, 4, 1, '#6b1010'); r(cx + 10, cy + 3, 4, 1, '#6b1010');
      for (let j = -7; j <= 7; j++) for (let i = -7; i <= 7; i++) {
        const d = Math.hypot(i, j);
        if (d <= 7) r(cx + i, cy - 2 + j, 1, 1, d > 5.5 ? '#4a4f63' : '#07060d');
        if (d <= 3.6) e(cx + i, cy - 2 + j, 1, 1, d < 1.6 ? '#ffffff' : ojo);
        else if (d <= 4.6 && ((i + j) & 1)) e(cx + i, cy - 2 + j, 1, 1, ojoOsc);
      }
      r(cx - 3, cy + 13, 6, 5, '#2a2a3c'); e(cx - 1, cy + 17, 2, 2, aturdido ? '#6b5a1a' : PAL.rojo);
      r(cx + 6, cy - 19, 1, 6, '#4a4f63'); e(cx + 6, cy - 20, 1, 1, ojo);
      if (aturdido) [[6, 10], [56, 8], [12, 50], [52, 52], [30, 6]].forEach(function (p) { e(p[0], p[1], 3, 1, PAL.amarilloClaro); e(p[0] + 1, p[1] - 1, 1, 3, PAL.amarilloClaro); });
    });
  }
  // Perseguidor: robot araña bajo y rápido
  function sprPerseguidor(aturdido) {
    return spriteDesde(function (r, e) {
      const ojo = aturdido ? PAL.amarillo : PAL.rojo;
      // Patas (3 por lado)
      for (let k = 0; k < 3; k++) {
        const x0 = 22 - k * 6, x1 = 42 + k * 6;
        r(x0 - 8, 38 + k * 2, 10, 3, '#4a4f63'); r(x0 - 10, 41 + k * 2, 3, 20 - k * 4, '#3a3d52'); r(x0 - 10, 41 + k * 2, 1, 20 - k * 4, '#7a828d');
        r(x1 - 2, 38 + k * 2, 10, 3, '#4a4f63'); r(x1 + 7, 41 + k * 2, 3, 20 - k * 4, '#2f3245');
      }
      // Cuerpo (caparazón)
      for (let j = -9; j <= 9; j++) for (let i = -15; i <= 15; i++) {
        if ((i * i) / 225 + (j * j) / 81 > 1) continue;
        const k = 0.45 + 0.5 * Math.max(0, (-j * 0.8 - i * 0.2) / 9);
        r(32 + i, 38 + j, 1, 1, rgbK('#6b4040', k + 0.2));
      }
      r(18, 40, 28, 2, '#2a1414');
      // Ojos y mandíbulas
      e(25, 33, 4, 3, ojo); e(35, 33, 4, 3, ojo); e(31, 37, 2, 2, ojo);
      e(26, 33, 1, 1, '#ffffff'); e(36, 33, 1, 1, '#ffffff');
      r(27, 45, 3, 4, '#8d93ad'); r(34, 45, 3, 4, '#8d93ad');
      r(30, 25, 4, 5, '#2a2a3c'); e(31, 23, 2, 2, ojo);
      if (aturdido) [[10, 26], [52, 24], [32, 16]].forEach(function (p) { e(p[0], p[1], 3, 1, PAL.amarilloClaro); e(p[0] + 1, p[1] - 1, 1, 3, PAL.amarilloClaro); });
    });
  }
  // Guardián: torre blindada que bloquea el pasillo
  function sprGuardian(aturdido) {
    return spriteDesde(function (r, e) {
      const ojo = aturdido ? PAL.amarillo : PAL.rojo;
      // Cuerpo con sombreado cilíndrico
      for (let i = 0; i < 36; i++) {
        const k = 0.35 + 0.75 * Math.sin(Math.PI * (i + 0.5) / 36);
        r(14 + i, 6, 1, 56, rgbK('#3a3d54', k));
      }
      r(14, 6, 36, 3, '#7a828d');
      // Escudos laterales
      r(6, 20, 9, 30, '#2d3140'); r(6, 20, 9, 2, '#7a828d'); r(49, 20, 9, 30, '#22253a'); r(49, 20, 9, 2, '#565d67');
      // Visor
      r(19, 14, 26, 10, '#0b0c12');
      e(21, 17, 22, 4, ojo); e(21, 18, 22, 1, aturdido ? '#fff4c0' : '#ffd0d0');
      // Placas
      for (let y = 30; y < 58; y += 5) { r(18, y, 28, 1, '#1a1c26'); r(18, y + 1, 28, 1, '#4a4f63'); }
      for (let x = 14; x < 50; x++) { const on = ((x >> 2) & 1); if (on) e(x, 59, 1, 3, aturdido ? '#6b1010' : PAL.rojo); else r(x, 59, 1, 3, '#15151a'); }
      r(12, 62, 40, 2, '#16151f');
      if (aturdido) [[8, 10], [54, 8], [30, 2]].forEach(function (p) { e(p[0], p[1], 3, 1, PAL.amarilloClaro); e(p[0] + 1, p[1] - 1, 1, 3, PAL.amarilloClaro); });
    });
  }
  // Chatarra: enemigo sellado
  function sprChatarra() {
    return spriteDesde(function (r, e) {
      r(14, 52, 34, 10, '#3a3d54'); r(14, 52, 34, 2, '#565d67');
      r(20, 46, 14, 8, '#4a4f63'); r(36, 48, 9, 5, '#2a2a3c');
      r(10, 60, 46, 3, '#16151f');
      e(24, 55, 4, 2, PAL.cian); e(30, 42, 2, 2, PAL.cian); e(34, 38, 1, 2, PAL.cianClaro);
      r(40, 50, 6, 1, '#7a828d');
    });
  }
  // Botiquín
  function sprBotiquin() {
    return spriteDesde(function (r, e) {
      for (let j = 16; j < 64; j++) for (let i = 14; i < 50; i++) {
        const d = Math.hypot(i - 32, (j - 48) * 0.9);
        if (d < 16 && d > 13 && ((i * 3 + j) % 5 === 0)) e(i, j, 1, 1, '#1d6b3a');
      }
      r(16, 40, 32, 22, '#c8c4d8'); r(16, 40, 32, 2, '#ffffff'); r(44, 40, 4, 22, '#8d93ad');
      r(26, 36, 12, 4, '#4a4f63'); r(28, 36, 8, 1, '#8d93ad');
      e(29, 44, 6, 15, PAL.verde); e(24, 49, 16, 5, PAL.verde); e(30, 46, 2, 4, '#c8ffd8');
      r(16, 61, 32, 2, '#2a2a3c');
    });
  }
  // Láser: emisores a los lados y rayos (0 apagado, 1 aviso, 2 activo)
  function sprLaser(estado) {
    return spriteDesde(function (r, e) {
      r(0, 0, 4, 64, '#4a4f63'); r(60, 0, 4, 64, '#3a3d52');
      r(0, 0, 1, 64, '#7a828d');
      for (let y = 8; y < 64; y += 10) {
        r(0, y - 1, 5, 3, '#16151f'); r(59, y - 1, 5, 3, '#16151f');
        if (estado === 0) continue;
        if (estado === 2) { e(4, y, 56, 1, '#ffd0d0'); for (let x = 4; x < 60; x += 2) { e(x, y - 1, 1, 1, PAL.rojo); e(x + 1, y + 1, 1, 1, PAL.rojo); } }
        else for (let x = 4; x < 60; x += 3) e(x, y, 1, 1, PAL.rojoOsc);
        e(2, y, 2, 1, PAL.rojo); e(60, y, 2, 1, PAL.rojo);
      }
    });
  }
  function sprImpacto() {
    return spriteDesde(function (r, e) {
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4;
        for (let q = 5; q < 20; q++) e(Math.round(32 + Math.cos(a) * q), Math.round(32 + Math.sin(a) * q), 2, 2, k & 1 ? PAL.amarillo : '#ffffff');
      }
      e(28, 28, 8, 8, '#fff4c0');
    });
  }
  function sprEmp() {
    return spriteDesde(function (r, e) {
      for (let k = 0; k < 6; k++) {
        const a = k * Math.PI / 3;
        for (let q = 4; q < 18; q++) e(Math.round(32 + Math.cos(a + q * 0.08) * q), Math.round(32 + Math.sin(a + q * 0.08) * q), 2, 2, '#7ff3ff');
      }
      e(29, 29, 6, 6, '#ffffff');
    });
  }

  // ---------- Jugadores (multijugador) ----------
  // Peinado de cada personaje para el sprite y el retrato
  const PEINADO = { chispa: 'cresta', tuerca: 'casco', lata: 'moño', flaco: 'puas', varilla: 'gorra' };
  const COLORES_PUESTO = ['#22e4ff', '#ff2bd6', '#e8b923', '#4dff8a'];

  // Cuerpo del personaje de frente, 64×64. estado: '' | 'escudo' | 'aturdido'
  function dibujarPersona(r, e, id, puesto, estado) {
    const p = W.PERSONAJES[id] || W.PERSONAJES.chispa, c = p.colores;
    const ancho = id === 'tuerca' ? 2 : id === 'flaco' ? -2 : 0;
    // Piernas y botas
    r(24, 44, 7, 16, c.pantalon); r(33, 44, 7, 16, escalarHex(c.pantalon, 0.8));
    r(24, 44, 2, 16, escalarHex(c.pantalon, 1.3));
    r(23, 59, 9, 4, '#0b0c12'); r(33, 59, 9, 4, '#0b0c12');
    if (id === 'lata') { r(21, 40, 22, 9, c.ropa); r(21, 47, 22, 2, escalarHex(c.ropa, 0.7)); }
    // Torso
    r(21 - ancho, 24, 22 + ancho * 2, 21, c.ropa);
    r(35 + ancho, 24, 8, 21, escalarHex(c.ropa, 0.72));
    r(21 - ancho, 24, 22 + ancho * 2, 2, escalarHex(c.ropa, 1.3));
    r(26, 30, 12, 3, c.detalle); r(31, 26, 2, 17, escalarHex(c.ropa, 0.55));
    e(27, 31, 2, 1, c.detalle);
    // Brazos y manos
    r(16 - ancho, 25, 6, 15, c.ropa); r(42 + ancho, 25, 6, 15, escalarHex(c.ropa, 0.72));
    r(16 - ancho, 39, 6, 5, c.piel); r(42 + ancho, 39, 6, 5, escalarHex(c.piel, 0.8));
    // Arma en la mano derecha
    if (id === 'chispa') { r(46, 30, 2, 12, '#7a4a2a'); r(44, 27, 2, 5, '#7a4a2a'); r(48, 27, 2, 5, '#7a4a2a'); }
    else if (id === 'tuerca') { r(47, 22, 3, 22, '#8a93a8'); r(47, 22, 1, 22, '#c8cbd6'); }
    else if (id === 'lata') { r(46, 30, 2, 12, '#3a2a1a'); r(42, 20, 12, 11, '#16151f'); r(43, 21, 4, 2, '#4a4f63'); }
    else if (id === 'flaco') { for (let k = 0; k < 3; k++) r(45 + k * 2, 30, 1, 10, '#c8cbd8'); e(44, 29, 6, 1, PAL.magenta); }
    else { r(47, 8, 2, 40, '#8a5a32'); e(46, 24, 4, 2, PAL.verde); }
    // Cuello y cabeza
    r(28, 20, 8, 5, escalarHex(c.piel, 0.8));
    r(25, 7, 14, 14, c.piel); r(35, 7, 4, 14, escalarHex(c.piel, 0.8));
    r(28, 13, 2, 2, '#16151f'); r(34, 13, 2, 2, '#16151f');
    r(29, 17, 6, 1, '#3a1418');
    // Peinados
    const pe = PEINADO[id] || 'gorra', pc = c.pelo;
    if (pe === 'cresta') { r(29, 0, 6, 9, pc); r(30, 0, 2, 8, escalarHex(pc, 1.3)); r(25, 6, 14, 2, escalarHex(pc, 0.7)); }
    else if (pe === 'casco') { r(23, 4, 18, 7, pc); r(23, 10, 18, 2, escalarHex(pc, 0.6)); r(30, 5, 4, 3, c.detalle); r(25, 17, 14, 4, escalarHex(pc, 0.8)); }
    else if (pe === 'moño') { r(24, 5, 16, 5, pc); r(28, 0, 8, 6, pc); r(29, 1, 3, 1, '#ffffff'); }
    else if (pe === 'puas') { r(24, 5, 16, 4, pc); for (let k = 0; k < 5; k++) r(24 + k * 3, 1 + (k & 1) * 2, 2, 5, pc); e(27, 12, 10, 2, PAL.cian); }
    else { r(23, 5, 18, 5, pc); r(37, 8, 7, 2, escalarHex(pc, 0.7)); }
    // Marcador de color del jugador (emisivo: se ve de lejos)
    const mc = COLORES_PUESTO[puesto % 4];
    e(30, 0, 4, 1, mc); e(29, 1, 6, 1, mc); e(30, 2, 4, 1, mc);
    if (estado === 'escudo') {
      for (let k = 0; k < 44; k++) {
        const a = k * Math.PI * 2 / 44;
        e(Math.round(32 + Math.cos(a) * 27), Math.round(34 + Math.sin(a) * 29), 1, 1, '#7ff3ff');
      }
    } else if (estado === 'aturdido') {
      [[12, 10], [50, 8], [10, 28], [54, 30], [20, 2], [44, 2]].forEach(function (q) { e(q[0], q[1], 4, 1, PAL.amarilloClaro); e(q[0] + 1, q[1] - 1, 2, 3, PAL.amarilloClaro); });
    }
  }
  const cacheJugador = {};
  function spriteJugadorEstado(personaje, puesto, estado) {
    const clave = personaje + '|' + puesto + '|' + (estado || '');
    if (cacheJugador[clave]) return cacheJugador[clave];
    let L;
    if (estado === 'atrapado') {
      // Tendido en el suelo: el mismo dibujo girado 90° (queda pegado al piso)
      L = spriteDesde(function (r, e, c) {
        c.translate(64, 14); c.rotate(Math.PI / 2);
        dibujarPersona(r, e, personaje, puesto, '');
      });
    } else {
      L = spriteDesde(function (r, e) { dibujarPersona(r, e, personaje, puesto, estado); });
    }
    cacheJugador[clave] = L;
    return L;
  }
  function spriteJugador(personaje, puesto, atrapado) { return spriteJugadorEstado(personaje, puesto, atrapado ? 'atrapado' : ''); }

  // Mina (propia: con el color del puesto; ajena: solo la luz roja)
  const cacheMina = {};
  function spriteMina(puesto) {
    const clave = String(puesto);
    if (cacheMina[clave]) return cacheMina[clave];
    const L = spriteDesde(function (r, e) {
      for (let j = -6; j <= 6; j++) for (let i = -20; i <= 20; i++) {
        if ((i * i) / 400 + (j * j) / 36 > 1) continue;
        r(32 + i, 54 + j, 1, 1, j < -2 ? '#4a4f63' : '#2a2a3c');
      }
      r(28, 44, 8, 6, '#3a3d52');
      e(30, 42, 4, 3, PAL.rojo); e(31, 42, 1, 1, '#ffffff');
      if (puesto >= 0) { const c = COLORES_PUESTO[puesto % 4]; for (let i = -18; i <= 18; i += 3) e(32 + i, 58, 2, 1, c); }
    });
    cacheMina[clave] = L;
    return L;
  }

  W.texturas = {
    zona: zona,
    hologramaDesde: hologramaDesde,
    hologramaCifrado: hologramaCifrado,
    spriteDesde: spriteDesde,
    spriteJugador: spriteJugador,
    spriteJugadorEstado: spriteJugadorEstado,
    spriteMina: spriteMina,
    PEINADO: PEINADO,
    COLORES_PUESTO: COLORES_PUESTO,
    comunes: COMUNES,
    sprites: {
      dron: sprDron(false), dronAturdido: sprDron(true),
      perseguidor: sprPerseguidor(false), perseguidorAturdido: sprPerseguidor(true),
      guardian: sprGuardian(false), guardianAturdido: sprGuardian(true),
      chatarra: sprChatarra(), botiquin: sprBotiquin(),
      laser: [sprLaser(0), sprLaser(1), sprLaser(2)],
      impacto: sprImpacto(),
      emp: sprEmp()
    },
    actualizar: actualizar,
    Lienzo: Lienzo,
    // utilidades para otros módulos
    azar: azar,
    empacar: empacar,
    color: color,
    escalar: escalar,
    hexARgb: hexARgb
  };
})();

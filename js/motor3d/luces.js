// =====================================================
// Iluminación de neón (adaptada de js/motor3d/luces.js de DuMulti)
//
// Cada nivel tiene un "mapa de luz" de 4×4 celdas de luz por casilla.
// Al cargar el nivel se calcula cuánta luz llega a cada celda desde cada fuente
// (tiras de neón, hologramas, puertas, estaciones, pantallas, alarmas, núcleo,
// lámparas del techo), con caída por distancia y sombras (las paredes tapan la luz).
// Las fuentes salen de las propias texturas: una textura con "luz" ilumina.
//
// La luz se guarda separada en 4 CANALES para poder animarla sin recalcular:
//   0 fija | 1 alarma (pulsa en rojo) | 2 latido lento | 3 parpadeo
// En cada cuadro se mezclan con su intensidad actual → luzR/G/B (enteros: 64 = luz normal).
// El color de ambiente depende de la zona (tinte).
// =====================================================
(function () {
  'use strict';
  const LR = 4;                 // subdivisiones de luz por casilla
  const AMBIENTE = 0.5;         // luz mínima de la nave
  const MAXIMO = 2.1 * 64;      // tope de brillo
  const CEL = W.CELDA;

  function rgb(h, k) { const c = W.texturas.hexARgb(h); return [c[0] / 255 * k, c[1] / 255 * k, c[2] / 255 * k]; }
  function hash(x, y) { return ((x * 73856093) ^ (y * 19349663)) >>> 0; }

  // Textura de la pared de una casilla (la misma que dibuja el raycaster)
  function texPared(mapa, i, tipo) {
    const tc = mapa.texCelda[i];
    if (tc) return tc;
    const tz = mapa.tz;
    const tabla = tz.tablaVariantes[tipo];
    if (tabla) return tabla[hash(i % mapa.ancho, (i / mapa.ancho) | 0) % tabla.length];
    return tz.paredes[tipo] || tz.paredes[1];
  }
  function texPiso(mapa, i) {
    const t = mapa.tz.tablaPisos;
    return t[hash(i % mapa.ancho + 7, ((i / mapa.ancho) | 0) + 3) % t.length];
  }
  // Lámparas del techo: casillas libres elegidas de forma estable
  function esLampara(mapa, x, y) { return ((hash(x + 11, y + 5) % 9) === 0) || ((x * 5 + y * 3) % 11 === 0); }

  const fases = { alarma: 0, giroAlarma: 0, latido: 1, parpadeo: 1 };
  let datos = null;

  // ¿Esta casilla tapa la luz? (las puertas y las palancas dejan pasar un poco)
  function tapa(mapa, x, y) {
    const t = mapa.celda(x, y);
    return t > 0 && t !== CEL.PUERTA && t !== CEL.PUERTA_MAGENTA && t !== CEL.PUERTA_TARJETA && t !== CEL.PUERTA_PALANCA && t !== CEL.APLASTADOR;
  }
  function visible(mapa, x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.ceil(d / 0.2);
    for (let k = 1; k < n; k++) {
      const t = k / n;
      if (tapa(mapa, Math.floor(x0 + (x1 - x0) * t), Math.floor(y0 + (y1 - y0) * t))) return false;
    }
    return true;
  }

  function fuentesDe(mapa) {
    const lista = [];
    const vec = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let y = 0; y < mapa.alto; y++) for (let x = 0; x < mapa.ancho; x++) {
      const i = y * mapa.ancho + x;
      const t = mapa.celdas[i];
      if (t) {
        const tex = texPared(mapa, i, t);
        const l = tex && tex.luz;
        if (!l) continue;
        const e = { col: rgb(l.col, l.k), radio: l.radio, canal: l.canal || 0 };
        for (const v of vec) {
          if (mapa.celda(x + v[0], y + v[1]) !== 0) continue;
          lista.push({ x: x + 0.5 + v[0] * 0.56, y: y + 0.5 + v[1] * 0.56, e: e });
        }
      } else if (esLampara(mapa, x, y)) {
        lista.push({ x: x + 0.5, y: y + 0.5, e: { col: rgb('#e6e3ff', 1.25), radio: 4.6, canal: hash(x, y) % 7 === 0 ? 3 : 0 } });
      }
    }
    return lista;
  }

  // Calcula los canales de luz del mapa (una vez, al cargar el nivel)
  function preparar(mapa) {
    const LW = mapa.ancho * LR, LH = mapa.alto * LR, n = LW * LH;
    const canales = [0, 1, 2, 3].map(function () { return new Float32Array(n * 3); });
    const fuentes = fuentesDe(mapa);
    for (let sy = 0; sy < LH; sy++) for (let sx = 0; sx < LW; sx++) {
      const wx = (sx + 0.5) / LR, wy = (sy + 0.5) / LR;
      if (tapa(mapa, Math.floor(wx), Math.floor(wy))) continue;
      const i = (sy * LW + sx) * 3;
      for (const f of fuentes) {
        const d = Math.hypot(wx - f.x, wy - f.y);
        if (d >= f.e.radio) continue;
        if (!visible(mapa, f.x, f.y, wx, wy)) continue;
        const k = 1 - d / f.e.radio, a = k * k;
        const ch = canales[f.e.canal];
        ch[i] += f.e.col[0] * a; ch[i + 1] += f.e.col[1] * a; ch[i + 2] += f.e.col[2] * a;
      }
    }
    const tinte = mapa.tz.tinte || [1, 1, 1];
    datos = {
      mapa: mapa, LW: LW, LH: LH, canales: canales, tinte: tinte,
      luzR: new Uint16Array(n), luzG: new Uint16Array(n), luzB: new Uint16Array(n)
    };
    actualizar(0);
    return datos;
  }

  function ruido(k) { const s = Math.sin(k * 127.1) * 43758.5453; return s - Math.floor(s); }

  // Mezcla los canales con la intensidad de este instante
  function actualizar(t) {
    fases.giroAlarma = ((t * 0.85) % 1 + 1) % 1;
    const c = 0.5 + 0.5 * Math.cos(fases.giroAlarma * Math.PI * 2);
    fases.alarma = 0.15 + 0.85 * c * c;
    fases.latido = 0.72 + 0.28 * Math.sin(t * 2.3);
    const r = ruido(Math.floor(t * 9));
    fases.parpadeo = r > 0.22 ? (r > 0.9 ? 0.6 : 1) : 0.08;
    const d = datos;
    if (!d) return;
    const tr = d.tinte[0], tg = d.tinte[1], tb = d.tinte[2];
    const f1 = fases.alarma, f2 = fases.latido, f3 = fases.parpadeo;
    const c0 = d.canales[0], c1 = d.canales[1], c2 = d.canales[2], c3 = d.canales[3];
    const n = d.luzR.length;
    for (let k = 0, i = 0; k < n; k++, i += 3) {
      const R = (AMBIENTE * 0.95 * tr + c0[i] + c1[i] * f1 + c2[i] * f2 + c3[i] * f3) * 64;
      const G = (AMBIENTE * 0.82 * tg + c0[i + 1] + c1[i + 1] * f1 + c2[i + 1] * f2 + c3[i + 1] * f3) * 64;
      const B = (AMBIENTE * 1.3 * tb + c0[i + 2] + c1[i + 2] * f1 + c2[i + 2] * f2 + c3[i + 2] * f3) * 64;
      d.luzR[k] = R > MAXIMO ? MAXIMO : R;
      d.luzG[k] = G > MAXIMO ? MAXIMO : G;
      d.luzB[k] = B > MAXIMO ? MAXIMO : B;
    }
  }

  // Luz en un punto del mundo (para sprites): [r, g, b] en escala 64
  const salida = [64, 64, 64];
  function en(x, y) {
    const d = datos;
    if (!d) { salida[0] = salida[1] = salida[2] = 64; return salida; }
    let sx = Math.floor(x * LR), sy = Math.floor(y * LR);
    sx = sx < 0 ? 0 : sx >= d.LW ? d.LW - 1 : sx;
    sy = sy < 0 ? 0 : sy >= d.LH ? d.LH - 1 : sy;
    const i = sy * d.LW + sx;
    salida[0] = d.luzR[i]; salida[1] = d.luzG[i]; salida[2] = d.luzB[i];
    return salida;
  }

  W.luces = {
    LR: LR, fases: fases, preparar: preparar, actualizar: actualizar, en: en,
    texPared: texPared, texPiso: texPiso, esLampara: esLampara,
    get datos() { return datos; }
  };
})();

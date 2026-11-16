// =====================================================
// Raycaster: dibuja la vista en primera persona
// Técnica DDA (como Wolfenstein 3D) + piso y techo texturizados + sprites.
// Dibuja directamente en un búfer de píxeles (Uint32Array) por velocidad.
// =====================================================
(function () {
  'use strict';
  const C = W.config;
  const A = C.ANCHO, H = C.ALTO, T = C.TEX, TM = T - 1, S = C.SPR;
  const P = C.PROYECCION;

  // Color de la niebla (la oscuridad de la nave)
  const nf = parseInt(W.paleta.fondo.slice(1), 16);
  const NR = (nf >> 16) & 255, NG = (nf >> 8) & 255, NB = nf & 255;
  const FONDO = 0xff000000 | (NB << 16) | (NG << 8) | NR;

  let imagen = null, buf = null;
  const zbuf = new Float32Array(A);   // distancia de la pared por columna (para sprites)

  // Mezcla un color con la niebla. t = 0 (sin niebla) a 1 (todo oscuro)
  function sombrear(c, t) {
    const k = 1 - t;
    const r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255;
    return 0xff000000 | (((b * k + NB * t) | 0) << 16) | (((g * k + NG * t) | 0) << 8) | ((r * k + NR * t) | 0);
  }
  // Tiñe de rojo (cono de detección)
  function tenirRojo(c) {
    const r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255;
    return 0xff000000 | (((b * 0.45) | 0) << 16) | (((g * 0.45) | 0) << 8) | Math.min(255, (r * 0.5 + 120) | 0);
  }

  // Resultado compartido del rayo (evita crear objetos en cada columna)
  const golpe = { tipo: 0, dist: 0, lado: 0, mx: 0, my: 0 };

  // Lanza un rayo desde (px, py) en dirección (rdx, rdy) hasta chocar con una pared.
  // Si marcar = true, registra las casillas recorridas como vistas (mapa automático).
  function lanzar(px, py, rdx, rdy, mapa, marcar) {
    let mx = Math.floor(px), my = Math.floor(py);
    const ddx = Math.abs(1 / rdx), ddy = Math.abs(1 / rdy);
    let pasoX, pasoY, sdx, sdy;
    if (rdx < 0) { pasoX = -1; sdx = (px - mx) * ddx; } else { pasoX = 1; sdx = (mx + 1 - px) * ddx; }
    if (rdy < 0) { pasoY = -1; sdy = (py - my) * ddy; } else { pasoY = 1; sdy = (my + 1 - py) * ddy; }
    let lado = 0, tipo = 0, n = 0;
    const an = mapa.ancho, al = mapa.alto, visto = mapa.visto;
    while (n++ < 96) {
      if (sdx < sdy) { sdx += ddx; mx += pasoX; lado = 0; }
      else { sdy += ddy; my += pasoY; lado = 1; }
      if (marcar && mx >= 0 && my >= 0 && mx < an && my < al) visto[my * an + mx] = 1;
      tipo = mapa.celda(mx, my);
      if (tipo > 0) break;
    }
    golpe.tipo = tipo;
    golpe.lado = lado;
    golpe.mx = mx; golpe.my = my;
    golpe.dist = Math.max(0.0001, lado === 0 ? sdx - ddx : sdy - ddy);
    return golpe;
  }

  function iniciar(ctx) {
    imagen = ctx.createImageData(A, H);
    buf = new Uint32Array(imagen.data.buffer);
  }

  // sprites: [{ x, y, tex, escala, z }]  (z = altura sobre el piso, en fracción de pared)
  // conos:   [{ x, y, dx, dy, r, cos }] (conos de detección de drones)
  function render(ctx, jug, mapa, sprites, conos) {
    const tz = mapa.tz;   // texturas de la zona
    const dirX = Math.cos(jug.ang), dirY = Math.sin(jug.ang);
    const plX = -dirY * C.PLANO, plY = dirX * C.PLANO;
    const horizonte = Math.round(H / 2 + jug.pitch);
    const camZ = jug.camZ;
    const an = mapa.ancho, al = mapa.alto;
    const texSuelo = mapa.texSuelo, mascCono = mapa.cono;
    const hayConos = conos && conos.length > 0;

    // ---------- 1) Piso y techo (fila por fila) ----------
    const rx0 = dirX - plX, ry0 = dirY - plY;
    const rx1 = dirX + plX, ry1 = dirY + plY;
    for (let y = 0; y < H; y++) {
      const p = y - horizonte;
      const fila = y * A;
      if (p === 0) { buf.fill(FONDO, fila, fila + A); continue; }
      const esPiso = p > 0;
      const dist = esPiso ? (camZ * P) / p : ((1 - camZ) * P) / -p;
      const t = Math.min(1, dist / C.NIEBLA_DIST);
      if (t >= 1) { buf.fill(FONDO, fila, fila + A); continue; }
      const tem = t * 0.25;
      const sx = dist * (rx1 - rx0) / A, sy = dist * (ry1 - ry0) / A;
      let fx = jug.x + dist * rx0, fy = jug.y + dist * ry0;
      for (let x = 0; x < A; x++) {
        const cx = Math.floor(fx), cy = Math.floor(fy);
        const tx = ((fx - cx) * T) & TM, ty = ((fy - cy) * T) & TM;
        let tx2, ic = -1;
        if (esPiso) {
          tx2 = tz.piso;
          if (cx >= 0 && cy >= 0 && cx < an && cy < al) {
            ic = cy * an + cx;
            const ts = texSuelo[ic];
            if (ts) tx2 = ts;
          }
        } else {
          tx2 = ((cx + cy) & 1) ? tz.techoA : tz.techoB;
        }
        const i = ty * T + tx;
        let col = sombrear(tx2.px[i], tx2.em[i] ? tem : t);
        // Cono de detección: casilla marcada y punto dentro del cono
        if (hayConos && ic >= 0 && mascCono[ic] && ((x + y) & 1) === 0) {
          const c = conos[mascCono[ic] - 1];
          if (c) {
            const vx = fx - c.x, vy = fy - c.y, d2 = vx * vx + vy * vy;
            const pd = vx * c.dx + vy * c.dy;
            if (d2 < c.r * c.r && pd > 0 && pd * pd > c.cos * c.cos * d2) col = tenirRojo(col);
          }
        }
        buf[fila + x] = col;
        fx += sx; fy += sy;
      }
    }

    // ---------- 2) Paredes (columna por columna) ----------
    const texCelda = mapa.texCelda, apertura = mapa.apertura;
    for (let x = 0; x < A; x++) {
      const camX = 2 * x / A - 1;
      const rdx = dirX + plX * camX, rdy = dirY + plY * camX;
      const g = lanzar(jug.x, jug.y, rdx, rdy, mapa, true);
      const perp = g.dist;
      zbuf[x] = perp;

      // Punto exacto del impacto en la pared (0..1) → columna de la textura
      let paredX = g.lado === 0 ? jug.y + perp * rdy : jug.x + perp * rdx;
      paredX -= Math.floor(paredX);
      let tx = (paredX * T) | 0;
      if (g.lado === 0 && rdx < 0) tx = TM - tx;
      if (g.lado === 1 && rdy > 0) tx = TM - tx;

      const arriba = horizonte - (1 - camZ) * P / perp;
      const abajo = horizonte + camZ * P / perp;
      const y0 = Math.max(0, Math.ceil(arriba));
      const y1 = Math.min(H, Math.ceil(abajo));
      const t0 = Math.min(1, perp / C.NIEBLA_DIST);
      const t = g.lado === 1 ? t0 + (1 - t0) * 0.22 : t0;
      const tem = t0 * 0.25;
      const ic = (g.mx >= 0 && g.my >= 0 && g.mx < an && g.my < al) ? g.my * an + g.mx : -1;
      const tw = (ic >= 0 && texCelda[ic]) || tz.paredes[g.tipo] || tz.paredes[1];
      const abre = ic >= 0 ? apertura[ic] * T : 0;   // desplazamiento de la puerta que sube
      const paso = T / (abajo - arriba);
      let texPos = (y0 - arriba) * paso + abre;
      for (let y = y0; y < y1; y++) {
        if (texPos >= T) { buf[y * A + x] = FONDO; texPos += paso; continue; }
        const i = ((texPos | 0) & TM) * T + tx;
        texPos += paso;
        buf[y * A + x] = sombrear(tw.px[i], tw.em[i] ? tem : t);
      }
    }

    // ---------- 3) Sprites (de lejos a cerca) ----------
    if (sprites && sprites.length) {
      const invDet = 1 / (plX * dirY - dirX * plY);
      for (const s of sprites) {
        const dx = s.x - jug.x, dy = s.y - jug.y;
        s._d = dx * dx + dy * dy;
      }
      sprites.sort(function (a, b) { return b._d - a._d; });
      for (const s of sprites) {
        const sx = s.x - jug.x, sy = s.y - jug.y;
        const tX = invDet * (dirY * sx - dirX * sy);
        const tY = invDet * (-plY * sx + plX * sy);
        if (tY <= 0.15) continue;
        const escala = s.escala || 0.6;
        const tam = escala * P / tY;
        if (tam < 1) continue;
        const centroX = (A / 2) * (1 + tX / tY);
        const base = horizonte + (camZ - (s.z || 0)) * P / tY;
        const top = base - tam;
        const izq = centroX - tam / 2;
        const xa = Math.max(0, Math.ceil(izq)), xb = Math.min(A, Math.ceil(izq + tam));
        const ya = Math.max(0, Math.ceil(top)), yb = Math.min(H, Math.ceil(base));
        if (xa >= xb || ya >= yb) continue;
        const tf = Math.min(1, tY / C.NIEBLA_DIST), tfe = tf * 0.25;
        const tex = s.tex, k = S / tam;
        for (let x = xa; x < xb; x++) {
          if (tY >= zbuf[x]) continue;
          const tcol = ((x - izq) * k) | 0;
          if (tcol < 0 || tcol >= S) continue;
          for (let y = ya; y < yb; y++) {
            const tfil = ((y - top) * k) | 0;
            if (tfil < 0 || tfil >= S) continue;
            const i = tfil * S + tcol;
            const c = tex.px[i];
            if (c === 0) continue;
            buf[y * A + x] = sombrear(c, tex.em[i] ? tfe : tf);
          }
        }
      }
    }

    ctx.putImageData(imagen, 0, 0);
  }

  // Busca lo que el jugador tiene al frente.
  // Primero la pared del rayo central; si no hay nada cerca, prueba rayos algo desviados
  // (tolerancia de puntería, sobre todo en pantallas táctiles).
  function rayoCentral(jug, mapa, tolerancia) {
    let g = lanzar(jug.x, jug.y, Math.cos(jug.ang), Math.sin(jug.ang), mapa, false);
    let mejor = { tipo: g.tipo, dist: g.dist, mx: g.mx, my: g.my };
    if (tolerancia && (mejor.dist > C.DIST_INTERACCION || !W.TIPOS[mejor.tipo] || !W.TIPOS[mejor.tipo].aviso)) {
      const desvios = [-1, 1, -0.5, 0.5];
      for (const d of desvios) {
        const a = jug.ang + d * tolerancia;
        g = lanzar(jug.x, jug.y, Math.cos(a), Math.sin(a), mapa, false);
        const info = W.TIPOS[g.tipo];
        if (g.dist <= C.DIST_INTERACCION && info && info.aviso) {
          mejor = { tipo: g.tipo, dist: g.dist, mx: g.mx, my: g.my };
          break;
        }
      }
    }
    return mejor;
  }

  W.raycaster = {
    iniciar: iniciar,
    render: render,
    zbuf: zbuf,
    rayoCentral: rayoCentral
  };
})();

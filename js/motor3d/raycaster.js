// =====================================================
// Raycaster 32 bits (480×234 + barra del HUD), estilo DuMulti "Alarma neón"
//
// Base: el raycaster DDA de Worodorox 16 bits (paredes por columnas, piso y techo
// por filas, sprites con z-buffer, cono rojo de los drones, puertas que suben).
// Del motor de DuMulti:
//  - Mapa de luz de colores por casilla (luces.js) con tramado Bayer 4×4.
//  - Niebla de distancia; los píxeles de neón (emisivos) casi no la reciben.
//  - Caras norte/sur un poco más oscuras para dar volumen.
//  - Texturas variadas por casilla (pantallas, alarmas, paneles dañados) y animadas.
//  - Calidad media automática: piso y techo cada 2 píxeles si faltan cuadros.
//
// Todo se dibuja en un búfer de enteros (Uint32Array) y se copia de una vez.
// =====================================================
(function () {
  'use strict';
  const C = W.config, PA = C.PANT;
  const A = PA.ANCHO, VH = PA.VISTA_ALTO, T = C.TEX, TM = T - 1;
  const PLANO = PA.PLANO, P = A / (2 * PLANO);
  const NIEBLA = PA.NIEBLA, NEM = 0.3;
  const LR = W.luces.LR;
  const ESC_PITCH = VH / (C.ALTO - C.HUD_ALTO);   // el pitch del jugador está en píxeles de 16 bits

  const nf = W.texturas.hexARgb(W.paleta.fondo);
  const NR = nf[0], NG = nf[1], NB = nf[2];
  const FONDO = W.texturas.empacar(NR, NG, NB);

  const BAYER = new Int8Array(16);
  [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].forEach(function (v, i) { BAYER[i] = Math.round((v / 15 - 0.5) * 2 * 5); });

  let imagen = null, buf = null;
  const zbuf = new Float32Array(A);

  // Datos del mapa preparado (texturas de piso y techo por casilla)
  let preparado = null, suelos = null, techos = null;
  function preparar(mapa) {
    preparado = mapa;
    const n = mapa.ancho * mapa.alto;
    suelos = new Array(n); techos = new Array(n);
    for (let y = 0; y < mapa.alto; y++) for (let x = 0; x < mapa.ancho; x++) {
      const i = y * mapa.ancho + x;
      suelos[i] = W.luces.texPiso(mapa, i);
      techos[i] = W.luces.esLampara(mapa, x, y) ? mapa.tz.techoA : mapa.tz.techoB;
    }
    W.luces.preparar(mapa);
  }

  // Sombreado: luz de color (escala 64) + niebla (k, nr, ng, nb en escala 256)
  function tono(c, lr, lg, lb, k, nr, ng, nb) {
    let r = ((c & 255) * lr) >> 6, g = (((c >>> 8) & 255) * lg) >> 6, b = (((c >>> 16) & 255) * lb) >> 6;
    if (r > 255) r = 255;
    if (g > 255) g = 255;
    if (b > 255) b = 255;
    return 0xff000000 | (((b * k + nb) >> 8) << 16) | (((g * k + ng) >> 8) << 8) | ((r * k + nr) >> 8);
  }
  function tenirRojo(c) {
    const r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255;
    return 0xff000000 | (((b * 0.45) | 0) << 16) | (((g * 0.45) | 0) << 8) | Math.min(255, (r * 0.5 + 120) | 0);
  }

  // Resultado compartido del rayo (para rayoCentral)
  const golpe = { tipo: 0, dist: 0, lado: 0, mx: 0, my: 0 };
  function lanzar(px, py, rdx, rdy, mapa, marcar) {
    let mx = Math.floor(px), my = Math.floor(py);
    const ddx = Math.abs(1 / (rdx || 1e-9)), ddy = Math.abs(1 / (rdy || 1e-9));
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
    golpe.tipo = tipo; golpe.lado = lado; golpe.mx = mx; golpe.my = my;
    golpe.dist = Math.max(0.0001, lado === 0 ? sdx - ddx : sdy - ddy);
    return golpe;
  }

  function iniciar(ctx) {
    imagen = ctx.createImageData(A, VH);
    buf = new Uint32Array(imagen.data.buffer);
  }

  function actual(tex) { return tex && tex.anim ? tex.actual : tex; }

  // =====================================================
  // render(ctx, jug, mapa, sprites, conos)
  //   jug: { x, y, ang, pitch (píxeles 16 bits), camZ }
  //   sprites: [{ x, y, tex, escala, z }]   conos: [{ x, y, dx, dy, r, cos }]
  // =====================================================
  function render(ctx, jug, mapa, sprites, conos) {
    if (preparado !== mapa || !W.luces.datos || W.luces.datos.mapa !== mapa) preparar(mapa);
    const LZ = W.luces.datos;
    const an = mapa.ancho, al = mapa.alto;
    const texSuelo = mapa.texSuelo, mascCono = mapa.cono, texCelda = mapa.texCelda, apertura = mapa.apertura;
    const hayConos = conos && conos.length > 0;
    const dirX = Math.cos(jug.ang), dirY = Math.sin(jug.ang);
    const plX = -dirY * PLANO, plY = dirX * PLANO;
    const hor = Math.round(VH / 2 + jug.pitch * ESC_PITCH);
    const camZ = jug.camZ, cx = jug.x, cy = jug.y;
    const mitad = W.raycaster.calidad === 'media';
    const luzR = LZ.luzR, luzG = LZ.luzG, luzB = LZ.luzB, LW = LZ.LW;

    // ---------- 1) Piso y techo, fila por fila ----------
    const rx0 = dirX - plX, ry0 = dirY - plY;
    const rx1 = dirX + plX, ry1 = dirY + plY;
    for (let y = 0; y < VH; y++) {
      const p = y - hor;
      const fila = y * A;
      if (p === 0) { buf.fill(FONDO, fila, fila + A); continue; }
      const esPiso = p > 0;
      const dist = esPiso ? (camZ * P) / p : ((1 - camZ) * P) / -p;
      const t = dist / NIEBLA;
      if (t >= 1) { buf.fill(FONDO, fila, fila + A); continue; }
      const k = ((1 - t) * 256) | 0, nr = (NR * t * 256) | 0, ng = (NG * t * 256) | 0, nb = (NB * t * 256) | 0;
      const te = t * NEM;
      const ke = ((1 - te) * 256) | 0, nre = (NR * te * 256) | 0, nge = (NG * te * 256) | 0, nbe = (NB * te * 256) | 0;
      const sx = dist * (rx1 - rx0) / A, sy = dist * (ry1 - ry0) / A;
      let fx = cx + dist * rx0, fy = cy + dist * ry0;
      const bfila = (y & 3) << 2;
      for (let x = 0; x < A; x++, fx += sx, fy += sy) {
        if (mitad && (x & 1)) { buf[fila + x] = buf[fila + x - 1]; continue; }
        const mx = fx | 0, my = fy | 0;
        if (mx < 0 || my < 0 || mx >= an || my >= al || fx < 0 || fy < 0) { buf[fila + x] = FONDO; continue; }
        const ic = my * an + mx;
        const tex = esPiso ? (texSuelo[ic] || suelos[ic]) : techos[ic];
        const ti = ((((fy - my) * T) | 0) & TM) * T + ((((fx - mx) * T) | 0) & TM);
        let col;
        if (tex.em[ti]) col = tono(tex.px[ti], 64, 64, 64, ke, nre, nge, nbe);
        else {
          const li = ((fy * LR) | 0) * LW + ((fx * LR) | 0);
          const bay = BAYER[bfila | (x & 3)];
          col = tono(tex.px[ti], luzR[li] + bay, luzG[li] + bay, luzB[li] + bay, k, nr, ng, nb);
        }
        // Cono de detección de los drones: casilla marcada y punto dentro del cono
        if (hayConos && esPiso && mascCono[ic] && ((x + y) & 1) === 0) {
          const cn = conos[mascCono[ic] - 1];
          if (cn) {
            const vx = fx - cn.x, vy = fy - cn.y, d2 = vx * vx + vy * vy, pd = vx * cn.dx + vy * cn.dy;
            if (d2 < cn.r * cn.r && pd > 0 && pd * pd > cn.cos * cn.cos * d2) col = tenirRojo(col);
          }
        }
        buf[fila + x] = col;
      }
    }

    // ---------- 2) Paredes, columna por columna ----------
    for (let x = 0; x < A; x++) {
      const camX = 2 * x / A - 1;
      const rdx = dirX + plX * camX, rdy = dirY + plY * camX;
      const g = lanzar(cx, cy, rdx, rdy, mapa, true);
      const perp = g.dist;
      zbuf[x] = perp;
      if (g.mx < 0 || g.my < 0 || g.mx >= an || g.my >= al) continue;
      const ic = g.my * an + g.mx;
      const tw = actual(W.luces.texPared(mapa, ic, g.tipo));
      let paredX = g.lado === 0 ? cy + perp * rdy : cx + perp * rdx;
      paredX -= Math.floor(paredX);
      let tx = (paredX * T) | 0;
      if (g.lado === 0 && rdx < 0) tx = TM - tx;
      if (g.lado === 1 && rdy > 0) tx = TM - tx;
      // Luz justo delante de la pared (un poco hacia la cámara)
      const l = Math.hypot(rdx, rdy);
      let lsx = ((cx + rdx * perp - rdx / l * 0.08) * LR) | 0, lsy = ((cy + rdy * perp - rdy / l * 0.08) * LR) | 0;
      lsx = lsx < 0 ? 0 : lsx >= LW ? LW - 1 : lsx;
      lsy = lsy < 0 ? 0 : lsy >= LZ.LH ? LZ.LH - 1 : lsy;
      const li = lsy * LW + lsx;
      const ls = g.lado === 1 ? 52 : 64;
      const lr = (luzR[li] * ls) >> 6, lg = (luzG[li] * ls) >> 6, lb = (luzB[li] * ls) >> 6;

      const arriba = hor - (1 - camZ) * P / perp;
      const abajo = hor + camZ * P / perp;
      const y0 = Math.max(0, Math.ceil(arriba));
      const y1 = Math.min(VH, Math.ceil(abajo));
      if (y0 >= y1) continue;
      const t = Math.min(1, perp / NIEBLA);
      const k = ((1 - t) * 256) | 0, nr = (NR * t * 256) | 0, ng = (NG * t * 256) | 0, nb = (NB * t * 256) | 0;
      const te = t * NEM;
      const ke = ((1 - te) * 256) | 0, nre = (NR * te * 256) | 0, nge = (NG * te * 256) | 0, nbe = (NB * te * 256) | 0;
      const abre = apertura[ic] * T;                 // la puerta sube al abrirse
      const paso = T / (abajo - arriba);
      let texPos = (y0 - arriba) * paso + abre;
      const px = tw.px, em = tw.em, bcol = x & 3;
      for (let y = y0; y < y1; y++, texPos += paso) {
        if (texPos >= T) { buf[y * A + x] = FONDO; continue; }
        const i = ((texPos | 0) & TM) * T + tx;
        const c = px[i];
        if (c === 0) continue;
        if (em[i]) buf[y * A + x] = tono(c, 64, 64, 64, ke, nre, nge, nbe);
        else {
          const bay = BAYER[((y & 3) << 2) | bcol];
          buf[y * A + x] = tono(c, lr + bay, lg + bay, lb + bay, k, nr, ng, nb);
        }
      }
    }

    // ---------- 3) Sprites (de lejos a cerca) ----------
    if (sprites && sprites.length) {
      const invDet = 1 / (plX * dirY - dirX * plY);
      for (const s of sprites) { const dx = s.x - cx, dy = s.y - cy; s._d = dx * dx + dy * dy; }
      sprites.sort(function (a, b) { return b._d - a._d; });
      for (const s of sprites) {
        const tex = s.tex;
        if (!tex) continue;
        const S = tex.t || 32, SM = S - 1;
        const ssx = s.x - cx, ssy = s.y - cy;
        const tX = invDet * (dirY * ssx - dirX * ssy);
        const tY = invDet * (-plY * ssx + plX * ssy);
        if (tY <= 0.12) continue;
        const tam = (s.escala || 0.6) * P / tY;
        if (tam < 1) continue;
        const centroX = (A / 2) * (1 + tX / tY);
        const base = hor + (camZ - (s.z || 0)) * P / tY;
        const top = base - tam, izq = centroX - tam / 2;
        const xa = Math.max(0, Math.ceil(izq)), xb = Math.min(A, Math.ceil(izq + tam));
        const ya = Math.max(0, Math.ceil(top)), yb = Math.min(VH, Math.ceil(base));
        if (xa >= xb || ya >= yb) continue;
        const t = Math.min(1, tY / NIEBLA);
        if (t >= 1) continue;
        const k = ((1 - t) * 256) | 0, nr = (NR * t * 256) | 0, ng = (NG * t * 256) | 0, nb = (NB * t * 256) | 0;
        const te = t * NEM;
        const ke = ((1 - te) * 256) | 0, nre = (NR * te * 256) | 0, nge = (NG * te * 256) | 0, nbe = (NB * te * 256) | 0;
        const luz = W.luces.en(s.x, s.y);
        const lr = luz[0] + 6, lg = luz[1] + 6, lb = luz[2] + 6;   // los sprites resaltan un poco
        const kk = S / tam;
        for (let x = xa; x < xb; x++) {
          if (tY >= zbuf[x]) continue;
          const tcol = ((x - izq) * kk) | 0;
          if (tcol < 0 || tcol > SM) continue;
          for (let y = ya; y < yb; y++) {
            const tfil = ((y - top) * kk) | 0;
            if (tfil < 0 || tfil > SM) continue;
            const i = tfil * S + tcol;
            const c = tex.px[i];
            if (c === 0) continue;
            buf[y * A + x] = tex.em[i] ? tono(c, 64, 64, 64, ke, nre, nge, nbe) : tono(c, lr, lg, lb, k, nr, ng, nb);
          }
        }
      }
    }

    ctx.putImageData(imagen, 0, 0);
  }

  // Busca lo que el jugador tiene al frente (igual que en 16 bits)
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

  // Proyecta un punto del mapa a la pantalla con la cámara del jugador (para etiquetas).
  // Devuelve { x, y (pie), alto, prof, tapado } o null si queda detrás de la cámara.
  function proyectar(jug, x, y, escala) {
    const dirX = Math.cos(jug.ang), dirY = Math.sin(jug.ang);
    const plX = -dirY * PLANO, plY = dirX * PLANO;
    const invDet = 1 / (plX * dirY - dirX * plY);
    const ssx = x - jug.x, ssy = y - jug.y;
    const tX = invDet * (dirY * ssx - dirX * ssy);
    const tY = invDet * (-plY * ssx + plX * ssy);
    if (tY <= 0.05) return null;
    const hor = Math.round(VH / 2 + jug.pitch * ESC_PITCH);
    const sx = (A / 2) * (1 + tX / tY);
    const col = Math.max(0, Math.min(A - 1, Math.round(sx)));
    return {
      x: sx, y: hor + jug.camZ * P / tY, alto: (escala || 0.8) * P / tY, prof: tY,
      tapado: tY >= zbuf[col]
    };
  }

  W.raycaster = {
    proyectar: proyectar,
    calidad: 'alta',          // 'alta' | 'media' (main.js la baja sola si faltan cuadros)
    iniciar: iniciar,
    preparar: preparar,
    render: render,
    zbuf: zbuf,
    rayoCentral: rayoCentral
  };
})();

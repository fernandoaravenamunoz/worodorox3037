// =====================================================
// Interfaz del versus (amplía W.HUD sin tocar hud.js)
//   - Barra de poderes con su recarga (abajo a la izquierda, sobre la vista 3D de 32 bits)
//   - Escudo, aturdimiento por EMP y "derribado" (combate)
//   - Marcador del combate y pantalla de resultados
// =====================================================
(function () {
  'use strict';
  const C = W.config, PAL = W.paleta, HUD = W.HUD;
  const A = C.ANCHO, H = C.ALTO;
  const T = function (ctx, s, x, y, c, e, al) { HUD.texto(ctx, s, x, y, c, e, al); };
  const COL = function (p) { return W.texturas.COLORES_PUESTO[p % 4]; };

  const dibujarOriginal = HUD.dibujar;
  HUD.dibujar = function (ctx, nivel, partida, dt, tactil) {
    if (nivel.otros && Object.keys(nivel.otros).length) marcadores(ctx, nivel);
    dibujarOriginal(ctx, nivel, partida, dt, tactil);
    if (nivel.versus && nivel.vs) dibujarVs(ctx, nivel, tactil);
  };

  // Etiquetas sobre los demás jugadores (v2.2).
  //   Cooperativo: nombre y distancia siempre (atenuado tras paredes) y, si quedan fuera
  //   de la vista, una flecha en el borde que apunta hacia ellos.
  //   Versus: solo el nombre cuando el rival está a la vista (sin ver a través de paredes).
  function marcadores(ctx, nivel) {
    const jug = nivel.jug, coop = !nivel.versus;
    const A = C.PANT.ANCHO, alto = C.PANT.VISTA_ALTO;
    const parpadeo = Math.floor(HUD.t * 4) % 2 === 0;
    for (const k in nivel.otros) {
      const o = nivel.otros[k];
      const pj = W.PERSONAJES[o.personaje];
      const nombre = pj ? pj.nombre : 'JUGADOR ' + (+k + 1);
      const col = COL(+k);
      const dist = Math.hypot(o.x - jug.x, o.y - jug.y);
      const pr = W.raycaster.proyectar(jug, o.x, o.y, 0.8);
      const enPantalla = pr && pr.x > 8 && pr.x < A - 8;
      if (!coop && (!enPantalla || pr.tapado || pr.prof > C.PANT.NIEBLA * 0.9)) continue;
      if (enPantalla) {
        const y = Math.max(10, Math.min(alto - 20, Math.round(pr.y - pr.alto - 12)));
        const atenuado = pr.tapado;
        const txt = nombre + (coop ? ' ' + Math.round(dist) + 'M' : '');
        const w = W.fuente.ancho(txt, 1);
        ctx.globalAlpha = atenuado ? 0.55 : 1;
        ctx.fillStyle = 'rgba(7,6,13,0.8)';
        ctx.fillRect(Math.round(pr.x - w / 2) - 3, y - 2, w + 6, 10);
        ctx.fillStyle = col;
        ctx.fillRect(Math.round(pr.x - w / 2) - 3, y + 8, w + 6, 1);
        // triangulito que apunta al jugador
        ctx.fillRect(Math.round(pr.x) - 2, y + 9, 5, 1);
        ctx.fillRect(Math.round(pr.x) - 1, y + 10, 3, 1);
        ctx.fillRect(Math.round(pr.x), y + 11, 1, 1);
        T(ctx, txt, Math.round(pr.x), y, col, 1, 'centro');
        ctx.globalAlpha = 1;
      } else if (coop) {
        // Fuera de la vista: flecha en el borde izquierdo o derecho
        const rel = Math.atan2(o.y - jug.y, o.x - jug.x) - jug.ang;
        const a = Math.atan2(Math.sin(rel), Math.cos(rel));
        const der = a > 0;
        const y = Math.round(alto / 2 - 30 + (+k) * 14);
        const x = der ? A - 10 : 10;
        ctx.fillStyle = 'rgba(7,6,13,0.8)';
        ctx.fillRect(der ? x - 52 : x - 4, y - 4, 56, 13);
        ctx.fillStyle = parpadeo ? col : PAL.blanco;
        for (let i = 0; i < 4; i++) ctx.fillRect(der ? x - i : x + i - 3, y - i + 3, 1, 1 + i * 2);
        T(ctx, nombre, der ? x - 8 : x + 4, y, col, 1, der ? 'der' : 'izq');
      }
    }
  }

  // Se dibuja sobre la vista 3D de 32 bits (480×234)
  function dibujarVs(ctx, nivel, tactil) {
    const jug = nivel.jug, vs = nivel.vs, cfg = W.configRed.VS;
    const A = C.PANT.ANCHO, alto = C.PANT.VISTA_ALTO;
    const caja = HUD.textoConCaja32;

    // Escudo: marco cian
    if (jug.escudo > 0) {
      ctx.fillStyle = Math.floor(HUD.t * 8) % 2 || jug.escudo > 1 ? PAL.cian : PAL.cianOsc;
      ctx.fillRect(0, 0, A, 2); ctx.fillRect(0, alto - 2, A, 2);
      ctx.fillRect(0, 0, 2, alto); ctx.fillRect(A - 2, 0, 2, alto);
      T(ctx, 'ESCUDO ' + jug.escudo.toFixed(1) + ' S', A / 2, 40, PAL.cianClaro, 1, 'centro');
    }
    // Aturdido: estática amarilla
    if (jug.aturdido > 0) {
      ctx.fillStyle = 'rgba(232,185,35,0.25)';
      for (let k = 0; k < 18; k++) ctx.fillRect((k * 71 + Math.floor(HUD.t * 900)) % A, (k * 29 + Math.floor(HUD.t * 300)) % alto, 20, 1);
      caja(ctx, 'EMP: SISTEMAS REINICIANDO ' + jug.aturdido.toFixed(1) + ' S', A / 2, 80, PAL.amarillo, PAL.amarillo);
    }
    // Derribado (combate)
    if (vs.caido > 0) {
      ctx.fillStyle = 'rgba(40,4,8,0.7)'; ctx.fillRect(0, 0, A, alto);
      T(ctx, 'DERRIBADO', A / 2, 84, PAL.rojo, 3, 'centro');
      T(ctx, 'VUELVES A LA ARENA EN ' + Math.ceil(vs.caido), A / 2, 112, PAL.gris, 1, 'centro');
    }

    // Barra de poderes
    const lista = nivel.poderes().concat(['escudo']);
    let x = 6;
    const y = alto - 14;
    lista.forEach(function (nombre, i) {
      const listo = vs.cd[nombre] <= 0;
      const tecla = nombre === 'escudo' ? 'R' : String(i + 1);
      const etiqueta = (tactil ? '' : tecla + ' ') + cfg.NOMBRE_PODER[nombre];
      const w = W.fuente.ancho(etiqueta, 1) + 6;
      const sel = tactil && nombre !== 'escudo' && i === vs.sel;
      ctx.fillStyle = 'rgba(7,6,13,0.8)'; ctx.fillRect(x, y, w, 9);
      if (!listo) {
        const f = Math.max(0, Math.min(1, vs.cd[nombre] / cfg.RECARGA[nombre]));
        ctx.fillStyle = '#2a1030'; ctx.fillRect(x, y, Math.round(w * f), 9);
      }
      ctx.fillStyle = sel ? PAL.magenta : listo ? PAL.cian : PAL.grisOsc;
      ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + 8, w, 1);
      T(ctx, etiqueta, x + 3, y + 2, listo ? PAL.cianClaro : PAL.grisOsc);
      x += w + 3;
    });

    // Marcador
    if (nivel.modo === 'combate' && W.juego && W.juego.marcador) {
      const m = W.juego.marcador;
      const filas = Object.keys(m.victorias).map(Number).sort(function (a, b) { return m.victorias[b] - m.victorias[a] || a - b; });
      const partes = filas.map(function (p) { return { p: p, s: W.Red.nombreDe(p).split(' ')[0] + ' ' + m.victorias[p] }; });
      const total = partes.reduce(function (s, q) { return s + W.fuente.ancho(q.s, 1) + 8; }, 0) - 8;
      let xx = Math.round(A / 2 - total / 2);
      ctx.fillStyle = 'rgba(7,6,13,0.75)'; ctx.fillRect(xx - 4, 24, total + 8, 11);
      for (const q of partes) { T(ctx, q.s, xx, 27, COL(q.p)); xx += W.fuente.ancho(q.s, 1) + 8; }
      T(ctx, 'META: ' + cfg.VICTORIAS + ' VICTORIAS', A / 2, 38, PAL.grisOsc, 1, 'centro');
    } else if (nivel.modo === 'carrera' && nivel.tiempo < 8) {
      caja(ctx, 'CARRERA: GANA QUIEN LLEGUE PRIMERO A LA SALIDA', A / 2, 28, PAL.verde, PAL.verde);
    }
  }

  // ---------- Pantalla de resultados del versus ----------
  // res: { modo, ganador, motivo, filas: [{ puesto, nombre, personaje, victorias, derrotas }] }
  HUD.resultadosVs = function (ctx, res, t, tactil, miPuesto) {
    ctx.fillStyle = PAL.fondo; ctx.fillRect(0, 0, A, H);
    for (let k = 0; k < 40; k++) {
      ctx.fillStyle = k % 5 === 0 ? PAL.magentaOsc : '#141226';
      ctx.fillRect((k * 83 + t * 30 * (1 + k % 3)) % A, (k * 37) % H, 2, 1);
    }
    const gano = res.ganador === miPuesto;
    T(ctx, gano ? 'VICTORIA!' : 'FIN DE LA PARTIDA', A / 2, 12, gano ? PAL.verde : PAL.magenta, 2, 'centro');
    const nombre = res.ganador >= 0 ? W.Red.nombreDe(res.ganador) : 'NADIE';
    T(ctx, 'GANA ' + nombre + (res.motivo ? ' - ' + res.motivo : ''), A / 2, 30, PAL.cianClaro, 1, 'centro');
    if (res.ganador >= 0 && res.personaje) {
      const lado = W.Retrato.TAM * 2 / 1.5, x = A / 2 - lado / 2;
      ctx.fillStyle = PAL.cianOsc; ctx.fillRect(x - 1, 38, lado + 2, lado + 2);
      ctx.drawImage(W.Retrato.cuadros(res.personaje)[W.Retrato.elegir(t, false)], x, 39, lado, lado);
    }
    // Tabla
    let y = 90;
    T(ctx, 'JUGADOR', 70, y, PAL.gris); T(ctx, 'VICTORIAS', 190, y, PAL.gris, 1, 'centro'); T(ctx, 'CAIDAS', 250, y, PAL.gris, 1, 'centro');
    y += 10;
    for (const f of res.filas) {
      ctx.fillStyle = f.puesto === res.ganador ? 'rgba(77,255,138,0.12)' : 'rgba(255,255,255,0.03)';
      ctx.fillRect(60, y - 2, 210, 9);
      ctx.fillStyle = COL(f.puesto); ctx.fillRect(62, y, 3, 5);
      T(ctx, f.nombre + (f.puesto === miPuesto ? ' (TU)' : ''), 70, y, PAL.blanco);
      T(ctx, String(f.victorias), 190, y, PAL.cianClaro, 1, 'centro');
      T(ctx, String(f.derrotas), 250, y, PAL.rojo, 1, 'centro');
      y += 11;
    }
    if (t > 2 && Math.floor(t * 2) % 2 === 0) T(ctx, tactil ? 'TOCA PARA VOLVER A LA SALA' : 'CLIC PARA VOLVER A LA SALA', A / 2, 164, PAL.magenta, 1, 'centro');
  };
})();

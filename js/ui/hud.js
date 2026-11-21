// =====================================================
// Interfaz (HUD) del laberinto (32 bits, 480×270) y de las salas 2D + utilidades de texto
// Las pantallas que todavía usan el diseño de 320×180 (salas 2D, puzzles, menús)
// se dibujan en una capa aparte que main.js amplía a la pantalla.
// =====================================================
(function () {
  'use strict';
  const C = W.config, PAL = W.paleta, F = W.fuente;

  // Caché de textos ya dibujados (evita repintar píxel por píxel cada cuadro)
  const cache = new Map();
  function imagenTexto(str, color, esc, grande) {
    const clave = str + '|' + color + '|' + esc + (grande ? '|g' : '');
    let img = cache.get(clave);
    if (img) return img;
    if (cache.size > 400) cache.clear();
    const w = Math.max(1, grande ? F.anchoGrande(str, esc) : (str.length * 4 - 1) * esc), h = (grande ? 7 : 5) * esc;
    img = document.createElement('canvas');
    img.width = w; img.height = h;
    if (grande) F.dibujarGrande(img.getContext('2d'), str, 0, 0, color, esc);
    else F.dibujarCrudo(img.getContext('2d'), str, 0, 0, color, esc);
    cache.set(clave, img);
    return img;
  }

  // alinear: 'izq', 'centro', 'der'
  // grande = true: dígitos grandes 5×7 (números del HUD)
  function texto(ctx, str, x, y, color, esc, alinear, grande) {
    esc = esc || 1;
    const s = grande ? String(str) : F.normalizar(str);
    if (!s.length) return;
    const img = imagenTexto(s, color, esc, grande);
    let px = x;
    if (alinear === 'centro') px = x - (img.width >> 1);
    else if (alinear === 'der') px = x - img.width;
    ctx.drawImage(img, Math.round(px), Math.round(y));
  }

  // Texto en varias líneas que no excedan "ancho" píxeles. Devuelve la Y final.
  function parrafo(ctx, str, x, y, ancho, color, alinear, interlinea) {
    const palabras = F.normalizar(str).split(' ');
    const maxCar = Math.floor((ancho + 1) / 4);
    let linea = '';
    const lineas = [];
    for (const p of palabras) {
      if ((linea + ' ' + p).trim().length > maxCar) { lineas.push(linea.trim()); linea = p; }
      else linea += ' ' + p;
    }
    if (linea.trim()) lineas.push(linea.trim());
    for (const l of lineas) { texto(ctx, l, x, y, color, 1, alinear); y += interlinea || 8; }
    return y;
  }

  // Texto con caja oscura de fondo
  function textoConCaja(ctx, str, x, y, color, borde) {
    const w = F.ancho(str, 1);
    const bx = Math.round(x - w / 2) - 3;
    ctx.fillStyle = 'rgba(7,6,13,0.82)';
    ctx.fillRect(bx, y - 2, w + 6, 9);
    ctx.fillStyle = borde;
    ctx.fillRect(bx, y - 2, w + 6, 1);
    texto(ctx, str, x, y, color, 1, 'centro');
  }

  // ---------- Estado del HUD ----------
  const HUD = {
    mensaje: '',
    tiempoMsg: 0,
    aviso: '',
    zona: 'CRIOGENIA',
    t: 0
  };

  HUD.mostrar = function (msg, segundos) {
    HUD.mensaje = msg;
    HUD.tiempoMsg = segundos || 3;
  };

  // Barra inferior común (vida, arma, objetos)
  function barraInferior(ctx, jug, partida, centro, tactil, mostrarQE) {
    const A = C.ANCHO, H = C.ALTO, HB = C.HUD_ALTO;
    const yb = H - HB;
    ctx.fillStyle = '#06050b';
    ctx.fillRect(0, yb, A, HB);
    ctx.fillStyle = PAL.magenta;
    ctx.fillRect(0, yb, A, 1);

    texto(ctx, 'VIDA', 4, yb + 5, PAL.cian);
    const n = jug.vidaMax;
    const anchoSeg = n > 10 ? 4 : 5;
    for (let i = 0; i < n; i++) {
      const bajo = jug.vida <= 3 && Math.floor(HUD.t * 4) % 2;
      ctx.fillStyle = i < jug.vida ? (bajo ? PAL.rojo : PAL.cian) : '#123540';
      ctx.fillRect(22 + i * anchoSeg, yb + 4, anchoSeg - 1, 7);
    }
    let x = 24 + n * anchoSeg;
    // Arma
    texto(ctx, jug.p.arma, x, yb + 5, PAL.amarillo);
    x += F.ancho(jug.p.arma, 1) + 6;
    // Objetos (tarjetas)
    for (const o of partida.objetos) {
      ctx.fillStyle = PAL.blanco; ctx.fillRect(x, yb + 4, 8, 6);
      ctx.fillStyle = PAL.cian; ctx.fillRect(x, yb + 5, 8, 1);
      x += 10;
    }
    // Centro: zona / sala
    texto(ctx, centro, mostrarQE && !tactil ? 196 : A - 4, yb + 5, '#8d93ad', 1, mostrarQE && !tactil ? 'centro' : 'der');

    if (mostrarQE && !tactil) {
      const etiquetas = [['Q', 'MAPA', PAL.magenta], ['E', 'LIBRETA', PAL.cian]];
      let xx = A - 4;
      for (let k = etiquetas.length - 1; k >= 0; k--) {
        const et = etiquetas[k];
        xx -= F.ancho(et[1], 1);
        texto(ctx, et[1], xx, yb + 5, '#8d93ad');
        xx -= 11;
        ctx.fillStyle = '#1d1b2e';
        ctx.fillRect(xx, yb + 3, 9, 9);
        ctx.fillStyle = et[2];
        ctx.fillRect(xx, yb + 3, 9, 1);
        texto(ctx, et[0], xx + 3, yb + 5, PAL.blanco);
        xx -= 8;
      }
    }
  }

  // =====================================================
  // HUD del laberinto en 32 bits (480×270, como DuMulti)
  //   Barra inferior: VIDA | ARMA | RETRATO | OBJETOS | SECTOR
  //   Sobre la vista: arma en primera persona, mira, aviso, alertas, equipo y mensajes
  // =====================================================
  const PA = C.PANT;
  const PANELES = {
    vida: { x: 4, w: 92, et: 'VIDA', col: PAL.rojo },
    arma: { x: 100, w: 118, et: 'ARMA', col: PAL.amarillo },
    objetos: { x: 262, w: 92, et: 'OBJETOS', col: PAL.blanco },
    sector: { x: 358, w: 118, et: 'SECTOR', col: PAL.cian }
  };
  const RET_X = 222, RET_W = 36;
  let fondoBarra = null;
  function prepararFondo() {
    const A = PA.ANCHO, HB = PA.HUD_ALTO;
    const c = document.createElement('canvas');
    c.width = A; c.height = HB;
    const g = c.getContext('2d');
    const R = function (x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); };
    R(0, 0, A, HB, '#1c1b28');
    for (let x = 0; x < A; x += 4) R(x, 2 + ((x >> 2) & 1), 2, 1, '#22212f');
    for (let y = 4; y < HB; y += 4) for (let x = (y & 4) ? 0 : 2; x < A; x += 4) R(x, y, 1, 1, '#24233a');
    R(0, 0, A, 2, PAL.magenta);
    R(0, 2, A, 1, PAL.magentaOsc);
    R(0, 3, A, 1, '#3a3a52');
    R(0, HB - 1, A, 1, '#07060d');
    function hundido(x, w) {
      R(x, 6, w, HB - 9, '#0b0a12');
      R(x, 6, w, 1, '#07060d'); R(x, 6, 1, HB - 9, '#07060d');
      R(x, HB - 4, w, 1, '#3a3a52'); R(x + w - 1, 6, 1, HB - 9, '#2a2a3c');
    }
    for (const k in PANELES) hundido(PANELES[k].x, PANELES[k].w);
    R(RET_X - 2, 3, RET_W + 4, HB - 3, '#2a2a3c');
    R(RET_X - 1, 4, RET_W + 2, HB - 5, PAL.cianOsc);
    R(RET_X, 5, RET_W, HB - 7, '#06141a');
    [2, 98, 220, 260, 356, 478].forEach(function (x) { R(x - 1, 8, 2, 2, PAL.remache); R(x - 1, HB - 7, 2, 2, PAL.remache); });
    for (const k in PANELES) F.dibujarCrudo(g, PANELES[k].et, PANELES[k].x + 4, 9, PANELES[k].col, 1);
    fondoBarra = c;
  }

  // Barra inferior del laberinto
  function barra32(ctx, nivel, partida, tactil) {
    if (!fondoBarra) prepararFondo();
    const VH = PA.VISTA_ALTO, P = PANELES, jug = nivel.jug;
    ctx.drawImage(fondoBarra, 0, VH);
    // Vida: número grande + segmentos
    const bajo = jug.vida <= 3 && Math.floor(HUD.t * 4) % 2;
    texto(ctx, String(Math.max(0, Math.round(jug.vida))), P.vida.x + 40, VH + 17, bajo ? '#ffd0d0' : PAL.rojo, 2, 'der', true);
    texto(ctx, '/' + jug.vidaMax, P.vida.x + 44, VH + 24, PAL.rojoOsc);
    const n = jug.vidaMax, ancho = Math.max(2, Math.floor(36 / n));
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i < jug.vida ? (bajo ? PAL.rojo : '#ff6b6b') : '#2a1218';
      ctx.fillRect(P.vida.x + 54 + (i % 6) * 6, VH + 12 + Math.floor(i / 6) * 6, 5, 4);
    }
    // Arma
    texto(ctx, jug.p.arma, P.arma.x + 4, VH + 18, PAL.amarilloClaro);
    texto(ctx, jug.p.tipo, P.arma.x + 4, VH + 26, PAL.grisOsc);
    if (jug.escudo > 0) texto(ctx, 'ESCUDO ' + jug.escudo.toFixed(1), P.arma.x + P.arma.w - 4, VH + 9, PAL.cian, 1, 'der');
    // Retrato (cara de dolor al recibir daño o si estás atrapado)
    const herido = jug.flashDanio > 0 || jug.atrapado || jug.vida <= 0;
    const cuadros = W.Retrato.cuadros(jug.p.id);
    ctx.drawImage(cuadros[W.Retrato.elegir(HUD.t, herido)], RET_X + 1, VH + 1);
    // Objetos (tarjetas obtenidas en las salas 2D)
    if (!partida.objetos.length) texto(ctx, '--', P.objetos.x + 6, VH + 18, PAL.grisOsc, 2);
    let x = P.objetos.x + 5;
    for (const o of partida.objetos) {
      ctx.fillStyle = PAL.blanco; ctx.fillRect(x, VH + 17, 12, 9);
      ctx.fillStyle = PAL.cian; ctx.fillRect(x, VH + 19, 12, 2);
      ctx.fillStyle = '#0b0a12'; ctx.fillRect(x + 7, VH + 23, 3, 2);
      x += 15;
    }
    if (partida.objetos.length === 1) texto(ctx, partida.objetos[0].slice(0, 12), P.objetos.x + 22, VH + 19, PAL.gris);
    // Sector y teclas
    texto(ctx, HUD.zona, P.sector.x + 4, VH + 18, PAL.cianClaro);
    texto(ctx, tactil ? '' : 'Q MAPA   E LIBRETA', P.sector.x + 4, VH + 26, PAL.grisOsc);
  }

  HUD.dibujar = function (ctx, nivel, partida, dt, tactil) {
    const A = PA.ANCHO, H = PA.VISTA_ALTO;
    const jug = nivel.jug;
    HUD.t += dt;
    const cx = A / 2, cy = Math.round(H / 2);

    // Efectos de pantalla: gas, viento
    const ic = nivel.mapa.indice(Math.floor(jug.x), Math.floor(jug.y));
    const ts = nivel.mapa.texSuelo[ic];
    if (ts && ts === nivel.mapa.tz.gas[2]) { ctx.fillStyle = 'rgba(60,220,110,0.22)'; ctx.fillRect(0, 0, A, H); }
    if (nivel.viento > 0) {
      ctx.fillStyle = 'rgba(200,251,255,0.35)';
      for (let k = 0; k < 16; k++) ctx.fillRect((k * 79 + HUD.t * 600) % A, (k * 41) % (H - 20), 22, 1);
    }

    // Arma en primera persona
    W.ArmaFP.dibujar(ctx, jug.p.id, jug.ataque, jug.bob, HUD.t, nivel.andar === undefined ? 1 : nivel.andar);

    if (jug.flashDanio > 0) {
      ctx.fillStyle = 'rgba(255,40,40,' + (jug.flashDanio * 1.1).toFixed(2) + ')';
      ctx.fillRect(0, 0, A, H);
    }

    // Mira
    ctx.fillStyle = PAL.cian;
    ctx.fillRect(cx - 1, cy - 1, 2, 2);
    ctx.fillStyle = 'rgba(34,228,255,0.45)';
    ctx.fillRect(cx - 6, cy - 1, 3, 2); ctx.fillRect(cx + 3, cy - 1, 3, 2);
    ctx.fillRect(cx - 1, cy - 6, 2, 3); ctx.fillRect(cx - 1, cy + 3, 2, 3);

    // Aviso contextual (lo que tienes enfrente)
    if (HUD.aviso) textoConCaja32(ctx, (tactil ? 'USAR: ' : '[CLIC] ') + HUD.aviso, cx, cy + 22, PAL.cianClaro, PAL.cian);

    // Alerta de detección
    if (nivel.alerta && Math.floor(HUD.t * 5) % 2 === 0) {
      ctx.fillStyle = PAL.rojo;
      ctx.fillRect(0, 0, A, 2); ctx.fillRect(0, H - 2, A, 2);
      ctx.fillRect(0, 0, 2, H); ctx.fillRect(A - 2, 0, 2, H);
      textoConCaja32(ctx, '! DETECTADO !', cx, 44, PAL.rojo, PAL.rojo);
    }

    // Multijugador: equipo y estado de atrapado
    if (W.Red && W.Red.enJuego) dibujarEquipo(ctx, nivel, tactil);
    if (jug.atrapado) {
      ctx.fillStyle = 'rgba(255,40,40,0.18)'; ctx.fillRect(0, 0, A, H);
      textoConCaja32(ctx, 'ATRAPADO: UN COMPANERO PUEDE RESCATARTE', cx, 96, PAL.blanco, PAL.rojo);
      textoConCaja32(ctx, 'REAPARECES EN TU ESTACION EN ' + Math.ceil(jug.tAtrapado) + ' S', cx, 110, PAL.gris, PAL.rojo);
    }

    // Mensaje temporal superior
    if (HUD.tiempoMsg > 0) {
      HUD.tiempoMsg -= dt;
      textoConCaja32(ctx, HUD.mensaje, cx, 12, PAL.blanco, PAL.magenta);
    }

    barra32(ctx, nivel, partida, tactil);
  };

  // Caja de texto de 11 px de alto (como en DuMulti)
  function textoConCaja32(ctx, str, x, y, color, borde) {
    const w = F.ancho(str, 1);
    const bx = Math.round(x - w / 2) - 4;
    ctx.fillStyle = 'rgba(7,6,13,0.85)';
    ctx.fillRect(bx, y - 3, w + 8, 11);
    ctx.fillStyle = borde;
    ctx.fillRect(bx, y - 3, w + 8, 1);
    ctx.fillRect(bx, y + 7, w + 8, 1);
    texto(ctx, str, x, y, color, 1, 'centro');
  }

  // Cartel con el nombre del nivel al comenzar (sobre la vista 3D)
  HUD.cartel = function (ctx, def, t) {
    if (t > 4) return;
    const A = PA.ANCHO;
    const a = t < 3 ? 1 : 1 - (t - 3);
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = 'rgba(7,6,13,0.8)';
    ctx.fillRect(0, 74, A, 64);
    ctx.fillStyle = PAL.magenta; ctx.fillRect(0, 74, A, 2); ctx.fillRect(0, 136, A, 2);
    ctx.fillStyle = PAL.magentaOsc; ctx.fillRect(0, 76, A, 1); ctx.fillRect(0, 135, A, 1);
    texto(ctx, 'ZONA ' + def.zona + ': ' + W.ZONAS[def.zona] + ' - NIVEL ' + def.id, A / 2, 82, PAL.gris, 1, 'centro');
    texto(ctx, def.nombre, A / 2 + 1, 93, PAL.magentaOsc, 3, 'centro');
    texto(ctx, def.nombre, A / 2, 92, PAL.cianClaro, 3, 'centro');
    if (def.historia) parrafo(ctx, def.historia, A / 2, 114, 420, PAL.gris, 'centro');
    ctx.globalAlpha = 1;
  };

  // Lista del equipo (arriba a la izquierda; en táctil, bajo el botón de pausa)
  const ESTADO_TXT = { atrapado: 'ATRAPADO!', sala: 'EN DUCTO', ocupado: 'OCUPADO', caido: 'CAIDO' };
  function dibujarEquipo(ctx, nivel, tactil) {
    const COL = W.texturas.COLORES_PUESTO;
    const filas = [{ puesto: W.Red.puesto, nombre: nivel.jug.p.nombre, vida: nivel.jug.vida, vidaMax: nivel.jug.vidaMax, estado: nivel.jug.atrapado ? 'atrapado' : 'activo', yo: true }];
    for (const k in nivel.otros) {
      const o = nivel.otros[k];
      filas.push({ puesto: +k, nombre: (W.PERSONAJES[o.personaje] || {}).nombre || '?', vida: o.vida, vidaMax: o.vidaMax || 10, estado: o.estado });
    }
    filas.sort(function (a, b) { return a.puesto - b.puesto; });
    let y = tactil ? 46 : 26;
    for (const f of filas) {
      ctx.fillStyle = 'rgba(7,6,13,0.75)'; ctx.fillRect(4, y - 3, 96, 11);
      ctx.fillStyle = COL[f.puesto % 4]; ctx.fillRect(5, y - 2, 3, 9);
      texto(ctx, (f.yo ? '>' : '') + f.nombre.slice(0, 10), 11, y, f.estado === 'atrapado' ? PAL.rojo : PAL.blanco);
      if (ESTADO_TXT[f.estado] && !f.yo) texto(ctx, ESTADO_TXT[f.estado], 104, y, f.estado === 'atrapado' ? PAL.rojo : PAL.gris);
      const w = Math.round(28 * Math.max(0, f.vida) / Math.max(1, f.vidaMax));
      ctx.fillStyle = '#123540'; ctx.fillRect(68, y + 1, 28, 3);
      ctx.fillStyle = f.vida <= 3 ? PAL.rojo : COL[f.puesto % 4]; ctx.fillRect(68, y + 1, w, 3);
      y += 12;
    }
  }
  HUD.textoConCaja32 = textoConCaja32;
  HUD.barra = barra32;

  // ---------- HUD de las salas 2D ----------
  HUD.dibujar2d = function (ctx, sala, partida, dt, tactil) {
    const A = C.ANCHO;
    HUD.t += dt;
    const ayuda = sala.textoAyuda();
    if (ayuda) textoConCaja(ctx, ayuda, A / 2, 6, PAL.blanco, PAL.amarillo);
    barraInferior(ctx, sala.jugVida, partida, sala.def.nombre || 'DUCTO', tactil, false);
    if (!tactil && HUD.t < 999 && sala.tiempo < 6) {
      textoConCaja(ctx, 'A/D: MOVER - W/ESPACIO: SALTAR - CLIC/F: ARMA Y TERMINAL', A / 2, 18, PAL.gris, PAL.amarillo);
    }
  };

  HUD.texto = texto;
  HUD.parrafo = parrafo;
  HUD.textoConCaja = textoConCaja;
  W.HUD = HUD;
})();

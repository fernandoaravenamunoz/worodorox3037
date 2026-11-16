// =====================================================
// Interfaz (HUD) del laberinto y de las salas 2D + utilidades de texto
// =====================================================
(function () {
  'use strict';
  const C = W.config, PAL = W.paleta, F = W.fuente;

  // Caché de textos ya dibujados (evita repintar píxel por píxel cada cuadro)
  const cache = new Map();
  function imagenTexto(str, color, esc) {
    const clave = str + '|' + color + '|' + esc;
    let img = cache.get(clave);
    if (img) return img;
    if (cache.size > 400) cache.clear();
    const w = Math.max(1, str.length * 4 - 1) * esc, h = 5 * esc;
    img = document.createElement('canvas');
    img.width = w; img.height = h;
    F.dibujarCrudo(img.getContext('2d'), str, 0, 0, color, esc);
    cache.set(clave, img);
    return img;
  }

  // alinear: 'izq', 'centro', 'der'
  function texto(ctx, str, x, y, color, esc, alinear) {
    esc = esc || 1;
    const s = F.normalizar(str);
    if (!s.length) return;
    const img = imagenTexto(s, color, esc);
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

  // ---------- HUD del laberinto ----------
  HUD.dibujar = function (ctx, nivel, partida, dt, tactil) {
    const A = C.ANCHO, H = C.ALTO;
    const jug = nivel.jug;
    HUD.t += dt;

    // Efectos de pantalla: gas, viento, daño
    const ic = nivel.mapa.indice(Math.floor(jug.x), Math.floor(jug.y));
    const ts = nivel.mapa.texSuelo[ic];
    if (ts && ts === nivel.mapa.tz.gas[2]) { ctx.fillStyle = 'rgba(60,220,110,0.22)'; ctx.fillRect(0, 0, A, H); }
    if (nivel.viento > 0) {
      ctx.fillStyle = 'rgba(200,251,255,0.35)';
      for (let k = 0; k < 12; k++) ctx.fillRect((k * 53 + HUD.t * 400) % A, (k * 37) % (H - 20), 14, 1);
    }

    // Arma en primera persona
    W.Personajes.dibujarArmaFP(ctx, jug.p.id, jug.ataque, jug.bob, HUD.t);

    if (jug.flashDanio > 0) {
      ctx.fillStyle = 'rgba(255,40,40,' + (jug.flashDanio * 1.1).toFixed(2) + ')';
      ctx.fillRect(0, 0, A, H);
    }

    // Mira central
    ctx.fillStyle = PAL.cian;
    ctx.fillRect(A / 2 - 1, H / 2 - 1, 2, 2);
    ctx.fillStyle = 'rgba(34,228,255,0.35)';
    ctx.fillRect(A / 2 - 4, H / 2 - 1, 2, 2);
    ctx.fillRect(A / 2 + 2, H / 2 - 1, 2, 2);

    // Aviso contextual (lo que tienes enfrente)
    if (HUD.aviso) {
      textoConCaja(ctx, (tactil ? 'USAR: ' : 'CLIC: ') + HUD.aviso, A / 2, H / 2 + 12, PAL.cianClaro, PAL.cian);
    }

    // Alerta de detección
    if (nivel.alerta && Math.floor(HUD.t * 5) % 2 === 0) {
      ctx.fillStyle = PAL.rojo;
      ctx.fillRect(0, 0, A, 2); ctx.fillRect(0, H - C.HUD_ALTO - 2, A, 2);
      texto(ctx, '! DETECTADO !', A / 2, 20, PAL.rojo, 1, 'centro');
    }

    // Multijugador: equipo y estado de atrapado
    if (W.Red && W.Red.enJuego) dibujarEquipo(ctx, nivel, tactil);
    if (jug.atrapado) {
      ctx.fillStyle = 'rgba(255,40,40,0.18)'; ctx.fillRect(0, 0, A, H);
      textoConCaja(ctx, 'ATRAPADO: UN COMPANERO PUEDE RESCATARTE', A / 2, 70, PAL.blanco, PAL.rojo);
      textoConCaja(ctx, 'REAPARECES EN TU ESTACION EN ' + Math.ceil(jug.tAtrapado) + ' S', A / 2, 82, PAL.gris, PAL.rojo);
    }

    // Mensaje temporal superior
    if (HUD.tiempoMsg > 0) {
      HUD.tiempoMsg -= dt;
      textoConCaja(ctx, HUD.mensaje, A / 2, 6, PAL.blanco, PAL.magenta);
    }

    barraInferior(ctx, jug, partida, HUD.zona, tactil, true);
  };

  // Lista del equipo (arriba a la izquierda; en táctil, bajo el botón de pausa)
  const ESTADO_TXT = { atrapado: 'ATRAPADO!', sala: 'EN DUCTO', ocupado: 'OCUPADO' };
  function dibujarEquipo(ctx, nivel, tactil) {
    const COL = W.texturas.COLORES_PUESTO;
    const filas = [{ puesto: W.Red.puesto, nombre: nivel.jug.p.nombre, vida: nivel.jug.vida, vidaMax: nivel.jug.vidaMax, estado: nivel.jug.atrapado ? 'atrapado' : 'activo', yo: true }];
    for (const k in nivel.otros) {
      const o = nivel.otros[k];
      filas.push({ puesto: +k, nombre: (W.PERSONAJES[o.personaje] || {}).nombre || '?', vida: o.vida, vidaMax: o.vidaMax || 10, estado: o.estado });
    }
    filas.sort(function (a, b) { return a.puesto - b.puesto; });
    let y = tactil ? 32 : 18;
    for (const f of filas) {
      ctx.fillStyle = 'rgba(7,6,13,0.7)'; ctx.fillRect(2, y - 2, 74, 9);
      ctx.fillStyle = COL[f.puesto % 4]; ctx.fillRect(3, y, 3, 5);
      texto(ctx, (f.yo ? '>' : '') + f.nombre.slice(0, 10), 8, y, f.estado === 'atrapado' ? PAL.rojo : PAL.blanco);
      if (ESTADO_TXT[f.estado] && !f.yo) texto(ctx, ESTADO_TXT[f.estado], 78, y, f.estado === 'atrapado' ? PAL.rojo : PAL.gris);
      const w = Math.round(22 * Math.max(0, f.vida) / Math.max(1, f.vidaMax));
      ctx.fillStyle = '#123540'; ctx.fillRect(52, y + 1, 22, 3);
      ctx.fillStyle = f.vida <= 3 ? PAL.rojo : COL[f.puesto % 4]; ctx.fillRect(52, y + 1, w, 3);
      y += 10;
    }
  }

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

// =====================================================
// Progreso: niveles superados y estadísticas de la última partida
//   - Se guarda aparte del guardado de la partida (localStorage 'worodorox3073_progreso'),
//     así sigue disponible aunque la partida termine o se borre.
//   - Se actualiza cada vez que se guarda la partida (estaciones y fin de nivel) y al terminar el juego.
//   - La pantalla no revela los niveles por descubrir: solo los superados y el actual.
//   - Las partidas multijugador no cuentan (no tocan el guardado).
// =====================================================
(function () {
  'use strict';
  const C = W.config, PAL = W.paleta;
  const A = C.ANCHO, H = C.ALTO;
  const CLAVE = 'worodorox3073_progreso';
  const T = function (ctx, s, x, y, c, e, al) { W.HUD.texto(ctx, s, x, y, c, e, al); };

  function leer() {
    try { const s = localStorage.getItem(CLAVE); return s ? JSON.parse(s) : null; }
    catch (err) { return null; }
  }
  function escribir(p) { try { localStorage.setItem(CLAVE, JSON.stringify(p)); } catch (err) { /* nada */ } }

  function contar(mapa) {
    let n = 0;
    for (const k in mapa) n += Array.isArray(mapa[k]) ? mapa[k].length : (mapa[k] ? 1 : 0);
    return n;
  }

  // Registra el estado de una partida. terminada = se venció a la IA
  function registrar(partida, terminada) {
    if (!partida || partida.sinGuardar) return;
    const p = leer() || { maxNivel: 0, juegosTerminados: 0 };
    const superados = terminada ? 12 : Math.max(0, (partida.nivel || 1) - 1);
    p.maxNivel = Math.max(p.maxNivel || 0, superados);
    if (terminada && !(p.ultima && p.ultima.semilla === partida.semilla && p.ultima.terminada)) p.juegosTerminados = (p.juegosTerminados || 0) + 1;
    p.ultima = {
      semilla: partida.semilla,
      personaje: partida.personaje,
      nivel: partida.nivel,
      superados: superados,
      tiempo: Math.floor(partida.tiempo || 0),
      muertes: partida.muertes || 0,
      pistas: (partida.libreta || []).length,
      puertas: contar(partida.puertas || {}),
      sellados: contar(partida.sellados || {}),
      salas: contar(partida.salas || {}),
      terminada: !!terminada,
      fecha: new Date().toISOString().slice(0, 10)
    };
    escribir(p);
  }

  // Cada guardado de la partida actualiza el progreso
  const guardarOriginal = W.Partida.guardar;
  W.Partida.guardar = function (p) {
    const ok = guardarOriginal(p);
    if (ok) registrar(p, false);
    return ok;
  };

  // ---------- Pantalla ----------
  const botonVolver = { x: A / 2 - 30, y: 162, w: 60, h: 13 };
  function hay() { return !!leer(); }

  function formatoTiempo(s) {
    const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), seg = s % 60;
    return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (seg < 10 ? '0' : '') + seg;
  }

  function dibujar(ctx, t) {
    const p = leer() || { maxNivel: 0 };
    const u = p.ultima;
    ctx.fillStyle = PAL.fondo; ctx.fillRect(0, 0, A, H);
    ctx.fillStyle = PAL.magenta; ctx.fillRect(0, 15, A, 1);
    T(ctx, 'PROGRESO', A / 2, 5, PAL.magenta, 1, 'centro');

    // Columna izquierda: niveles superados y el actual
    T(ctx, 'SECTORES SUPERADOS', 10, 21, PAL.cian);
    const superados = Math.max(p.maxNivel || 0, u ? u.superados : 0);
    const actual = u && !u.terminada ? u.nivel : 0;
    let y = 31;
    for (let n = 1; n <= 12; n++) {
      const def = W.niveles[n];
      if (!def) continue;
      if (n <= superados) {
        ctx.fillStyle = PAL.verde; ctx.fillRect(10, y + 1, 3, 3);
        T(ctx, n + '. ' + def.nombre, 16, y, PAL.blanco);
        y += 8;
      } else if (n === actual) {
        if (Math.floor(t * 2) % 2) { ctx.fillStyle = PAL.cian; ctx.fillRect(10, y + 1, 3, 3); }
        T(ctx, n + '. ' + def.nombre + ' (EN CURSO)', 16, y, PAL.cianClaro);
        y += 8;
      }
    }
    const porDescubrir = 12 - Math.max(superados, actual);
    if (porDescubrir > 0) T(ctx, 'POR DESCUBRIR: ' + porDescubrir + (porDescubrir === 1 ? ' SECTOR' : ' SECTORES'), 10, y + 3, PAL.grisOsc);
    if (!superados && !actual) T(ctx, 'AUN NO HAS SUPERADO NINGUNO', 10, 31, PAL.grisOsc);

    // Columna derecha: última partida
    ctx.fillStyle = '#0b0a18'; ctx.fillRect(176, 19, 136, 138);
    ctx.fillStyle = PAL.cianOsc; ctx.fillRect(176, 19, 136, 1);
    T(ctx, 'ULTIMA PARTIDA', 244, 23, PAL.cian, 1, 'centro');
    if (!u) {
      T(ctx, 'SIN DATOS TODAVIA', 244, 80, PAL.grisOsc, 1, 'centro');
    } else {
      const per = W.PERSONAJES[u.personaje] || W.PERSONAJES.chispa;
      W.Personajes.dibujarCuerpo(ctx, per.id, 184, 34, 1, t * 5, 2, false);
      T(ctx, per.nombre, 206, 38, PAL.blanco);
      T(ctx, u.terminada ? 'ESCAPO A TEMUKEITOR' : 'EN EL SECTOR ' + u.nivel, 206, 47, u.terminada ? PAL.verde : PAL.cianClaro);
      const filas = [
        ['TIEMPO', formatoTiempo(u.tiempo)],
        ['SECTORES', u.superados + ' / 12'],
        ['REIMPRESIONES', String(u.muertes)],
        ['PISTAS', String(u.pistas)],
        ['PUERTAS ABIERTAS', String(u.puertas)],
        ['ENEMIGOS SELLADOS', String(u.sellados)],
        ['DUCTOS SUPERADOS', String(u.salas)]
      ];
      let yy = 66;
      for (const f of filas) {
        T(ctx, f[0], 182, yy, PAL.gris);
        T(ctx, f[1], 306, yy, PAL.cianClaro, 1, 'der');
        yy += 10;
      }
      T(ctx, 'GUARDADO EL ' + u.fecha, 244, 140, PAL.grisOsc, 1, 'centro');
      if (p.juegosTerminados) T(ctx, 'JUEGOS TERMINADOS: ' + p.juegosTerminados, 244, 149, PAL.verde, 1, 'centro');
    }
    W.Puzzles.util.boton(ctx, botonVolver, 'VOLVER', PAL.gris);
  }

  // Devuelve true si hay que cerrar la pantalla
  function clic(x, y) { return W.Puzzles.util.dentro({ x: x, y: y }, botonVolver) || y > 0; }

  W.Progreso = { leer: leer, registrar: registrar, hay: hay, dibujar: dibujar, clic: clic };
})();

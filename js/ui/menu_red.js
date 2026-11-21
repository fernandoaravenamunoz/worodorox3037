// =====================================================
// Pantallas del multijugador: teclado para el código y sala de espera
// En la sala, el anfitrión elige el modo (cooperativo, carrera o combate),
// el nivel (o el mapa de la arena) y si las pistas se reparten entre los jugadores.
// =====================================================
(function () {
  'use strict';
  const C = W.config, PAL = W.paleta;
  const A = C.ANCHO, H = C.ALTO;
  const U = function () { return W.Puzzles.util; };
  const T = function (ctx, s, x, y, c, e, al) { W.HUD.texto(ctx, s, x, y, c, e, al); };
  const COL = W.texturas.COLORES_PUESTO;

  // ---------- Ingreso del código (teclado numérico grande para el celular) ----------
  const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'BORRAR', '0', 'OK'];
  const Codigo = {
    digitos: '',
    volver: { x: 6, y: 4, w: 44, h: 12 },
    rect: function (i) { return { x: 100 + (i % 3) * 42, y: 58 + Math.floor(i / 3) * 27, w: 38, h: 23 }; },
    reiniciar: function () { Codigo.digitos = ''; },
    // Devuelve 'unirse', 'volver' o null
    clic: function (x, y) {
      if (U().dentro({ x: x, y: y }, Codigo.volver)) return 'volver';
      for (let i = 0; i < TECLAS.length; i++) if (U().dentro({ x: x, y: y }, Codigo.rect(i))) return Codigo.pulsar(TECLAS[i]);
      return null;
    },
    pulsar: function (k) {
      if (W.Audio) W.Audio.sfx('clic');
      if (k === 'BORRAR') Codigo.digitos = Codigo.digitos.slice(0, -1);
      else if (k === 'OK') return Codigo.digitos.length === 5 ? 'unirse' : null;
      else if (Codigo.digitos.length < 5) Codigo.digitos += k;
      return null;
    },
    tecla: function (k) {
      const m = /^(Digit|Numpad)(\d)$/.exec(k);
      if (m) return Codigo.pulsar(m[2]);
      if (k === 'Backspace') return Codigo.pulsar('BORRAR');
      if (k === 'Enter' || k === 'NumpadEnter') return Codigo.pulsar('OK');
      if (k === 'Escape') return 'volver';
      return null;
    },
    dibujar: function (ctx, t) {
      ctx.fillStyle = PAL.fondo; ctx.fillRect(0, 0, A, H);
      U().boton(ctx, Codigo.volver, 'VOLVER', PAL.gris);
      T(ctx, 'UNIRSE A UNA PARTIDA', A / 2, 8, PAL.magenta, 1, 'centro');
      T(ctx, 'ESCRIBE EL CODIGO DE 5 NUMEROS QUE TE DIO EL ANFITRION', A / 2, 22, PAL.gris, 1, 'centro');
      // Casillas del código
      for (let i = 0; i < 5; i++) {
        const r = { x: 105 + i * 23, y: 32, w: 19, h: 20 };
        U().boton(ctx, r, '', i === Codigo.digitos.length && Math.floor(t * 3) % 2 ? PAL.cianClaro : PAL.cianOsc, '#0b0d16');
        if (Codigo.digitos[i]) T(ctx, Codigo.digitos[i], r.x + r.w / 2, r.y + 5, PAL.blanco, 2, 'centro');
      }
      for (let i = 0; i < TECLAS.length; i++) {
        const k = TECLAS[i], r = Codigo.rect(i);
        const color = k === 'OK' ? (Codigo.digitos.length === 5 ? PAL.verde : PAL.grisOsc) : k === 'BORRAR' ? PAL.amarillo : PAL.cian;
        U().boton(ctx, r, '', color);
        T(ctx, k, r.x + r.w / 2, r.y + (k.length > 1 ? 9 : 6), color, k.length > 1 ? 1 : 2, 'centro');
      }
      const R = W.Red;
      if (R.error) T(ctx, R.error, A / 2, 168, PAL.rojo, 1, 'centro');
      else if (R.estado) T(ctx, R.estado, A / 2, 168, PAL.amarillo, 1, 'centro');
    }
  };

  // ---------- Sala de espera ----------
  const Sala = {
    iniciar: { x: A / 2 - 45, y: 154, w: 90, h: 13 },
    salir: { x: 6, y: 4, w: 40, h: 12 },
    modoMenos: { x: 10, y: 126, w: 13, h: 13 },
    modoMas: { x: 125, y: 126, w: 13, h: 13 },
    repartir: { x: 10, y: 142, w: 128, h: 9 },
    menos: { x: 214, y: 126, w: 14, h: 13 },
    mas: { x: 292, y: 126, w: 14, h: 13 },
    // Devuelve 'iniciar', 'salir' o null
    clic: function (x, y) {
      const p = { x: x, y: y }, R = W.Red;
      if (U().dentro(p, Sala.salir)) return 'salir';
      if (R.esAnfitrion()) {
        if (U().dentro(p, Sala.modoMenos)) { R.cambiarModo(-1); sonido(); return null; }
        if (U().dentro(p, Sala.modoMas)) { R.cambiarModo(1); sonido(); return null; }
        if (R.modo === 'coop' && U().dentro(p, Sala.repartir)) { R.alternarRepartidas(); sonido(); return null; }
        if (U().dentro(p, Sala.menos)) { R.cambiarNivel(-1); sonido(); return null; }
        if (U().dentro(p, Sala.mas)) { R.cambiarNivel(1); sonido(); return null; }
        if (U().dentro(p, Sala.iniciar) && R.puedeIniciar()) return 'iniciar';
      }
      return null;
    },
    tecla: function (k) {
      const R = W.Red;
      if (k === 'Escape') return 'salir';
      if (R.esAnfitrion()) {
        if (k === 'ArrowLeft') R.cambiarNivel(-1);
        if (k === 'ArrowRight') R.cambiarNivel(1);
        if (k === 'ArrowUp') R.cambiarModo(-1);
        if (k === 'ArrowDown') R.cambiarModo(1);
        if (k === 'KeyR' && R.modo === 'coop') R.alternarRepartidas();
        if (k === 'Enter' && R.puedeIniciar()) return 'iniciar';
      }
      return null;
    },
    dibujar: function (ctx, t) {
      const R = W.Red, CR = W.configRed;
      ctx.fillStyle = PAL.fondo; ctx.fillRect(0, 0, A, H);
      U().boton(ctx, Sala.salir, 'SALIR', PAL.gris);
      T(ctx, 'SALA DE ESPERA - ' + CR.NOMBRE_MODO[R.modo], A / 2, 8, R.modo === 'coop' ? PAL.cian : PAL.magenta, 1, 'centro');
      if (R.esAnfitrion()) {
        if (R.activo) {
          T(ctx, 'CODIGO DE LA PARTIDA', A / 2, 22, PAL.gris, 1, 'centro');
          T(ctx, R.codigo, A / 2 + 1, 31, PAL.cianOsc, 4, 'centro');
          T(ctx, R.codigo, A / 2, 30, PAL.cianClaro, 4, 'centro');
          T(ctx, 'DASELO A TUS AMIGOS PARA QUE SE UNAN', A / 2, 54, PAL.gris, 1, 'centro');
        }
      } else {
        T(ctx, 'PARTIDA ' + R.codigo, A / 2, 26, PAL.cianClaro, 2, 'centro');
      }
      // Jugadores
      for (let i = 0; i < CR.MAX_JUGADORES; i++) {
        const r = { x: 14 + i * 74, y: 64, w: 68, h: 52 };
        const j = R.jugadores.find(function (q) { return q.puesto === i; });
        U().boton(ctx, r, '', j ? COL[i] : '#1d1b2e', '#0b0a18');
        if (j) {
          const p = W.PERSONAJES[j.personaje];
          const lado = W.Retrato.TAM / 1.5;   // retrato del HUD a su tamaño real (34 píxeles)
          ctx.fillStyle = '#06141a'; ctx.fillRect(r.x + (r.w - lado) / 2 - 1, r.y + 6, lado + 2, lado + 2);
          ctx.drawImage(W.Retrato.cuadros(j.personaje)[W.Retrato.elegir(t + i * 1.3, false)], r.x + (r.w - lado) / 2, r.y + 7, lado, lado);
          T(ctx, p.nombre, r.x + r.w / 2, r.y + 35, PAL.blanco, 1, 'centro');
          T(ctx, i === 0 ? 'ANFITRION' : (j.puesto === R.puesto ? 'TU' : 'JUGADOR ' + (i + 1)), r.x + r.w / 2, r.y + 44, COL[i], 1, 'centro');
        } else {
          T(ctx, Math.floor(t * 2) % 2 ? 'LIBRE' : '...', r.x + r.w / 2, r.y + 23, PAL.grisOsc, 1, 'centro');
        }
      }
      // Modo de juego
      T(ctx, CR.DESCRIPCION_MODO[R.modo], 104, 119, PAL.gris, 1, 'centro');
      if (R.esAnfitrion()) {
        U().boton(ctx, Sala.modoMenos, '<', PAL.magenta);
        U().boton(ctx, Sala.modoMas, '>', PAL.magenta);
      }
      T(ctx, CR.NOMBRE_MODO[R.modo], 74, 130, R.modo === 'coop' ? PAL.cianClaro : PAL.magentaClaro, 1, 'centro');
      if (R.modo === 'coop') {
        const txt = 'PISTAS REPARTIDAS: ' + (R.repartidas ? 'SI' : 'NO');
        if (R.esAnfitrion()) U().boton(ctx, Sala.repartir, txt, R.repartidas ? PAL.cian : PAL.gris);
        else T(ctx, txt, 74, 145, R.repartidas ? PAL.cian : PAL.gris, 1, 'centro');
      } else {
        T(ctx, R.modo === 'carrera' ? '1 EMP 2 HACKEO 3 MINA 4 DRON R ESCUDO' : '1 EMP 2 MINA R ESCUDO', 74, 145, PAL.grisOsc, 1, 'centro');
      }
      // Nivel inicial / mapa de la arena
      T(ctx, R.modo === 'combate' ? 'ARENA' : R.modo === 'carrera' ? 'NIVEL' : 'NIVEL INICIAL', 260, 119, PAL.gris, 1, 'centro');
      if (R.esAnfitrion()) {
        U().boton(ctx, Sala.menos, '<', PAL.cian);
        U().boton(ctx, Sala.mas, '>', PAL.cian);
      }
      T(ctx, String(R.nivelElegido), 260, 127, PAL.cianClaro, 2, 'centro');
      T(ctx, (W.niveles[R.nivelElegido] || {}).nombre || '', 260, 140, PAL.grisOsc, 1, 'centro');
      // Botón / estado
      if (R.esAnfitrion()) {
        const etiqueta = R.esVersus() && R.jugadores.length < 2 ? 'FALTAN RIVALES' : R.jugadores.length > 1 ? 'INICIAR' : 'INICIAR SOLO';
        U().boton(ctx, Sala.iniciar, etiqueta, R.puedeIniciar() ? PAL.verde : PAL.grisOsc, '#0b1a12');
      } else {
        T(ctx, 'EL ANFITRION ELIGE Y COMIENZA', A / 2, 156, PAL.gris, 1, 'centro');
      }
      if (R.error) T(ctx, R.error, A / 2, 171, PAL.rojo, 1, 'centro');
      else if (R.estado && !R.activo) T(ctx, R.estado, A / 2, 171, PAL.amarillo, 1, 'centro');
      else if (CR.transporte === 'local') T(ctx, 'MODO DE PRUEBA LOCAL (MISMO COMPUTADOR)', A / 2, 171, PAL.amarillo, 1, 'centro');
    }
  };
  function sonido() { if (W.Audio) W.Audio.sfx('clic'); }

  W.MenuRed = { Codigo: Codigo, Sala: Sala };
})();

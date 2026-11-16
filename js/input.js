// =====================================================
// Entrada unificada: teclado, mouse y pantalla táctil
// Modos:
//   '3d' : laberinto (WASD + mouse con Pointer Lock / joystick + deslizar)
//   '2d' : salas de plataforma (A/D + salto / flechas y botones táctiles)
//   'ui' : puzzles y menús (el puntero queda libre; clics y toques con coordenadas)
// Cada cuadro produce: { avance, lateral, giro, pitch, correr, mover2d, saltoMantenido }
// Eventos: 'clic', 'tecla:KeyQ', 'boton:accion', 'toque', 'tap', ...
// Clics con posición (coordenadas internas 320×180): sacarClics()
// =====================================================
(function () {
  'use strict';
  const C = W.config;

  const E = {
    teclas: {},
    eventos: [],
    clics: [],
    giroAcum: 0,
    pitchAcum: 0,
    joy: { x: 0, y: 0 },
    mantenidos: {},         // botones táctiles mantenidos (izq, der, salto)
    modo: '3d',
    tactil: false,          // se activa con el primer toque
    bloqueado: false,       // Pointer Lock activo
    modoArrastre: false,    // si el navegador no permite Pointer Lock: mirar arrastrando
    mouseAbajo: false,
    distArrastre: 0
  };

  let canvas, contenedor, joyBase, joyPerilla;
  let joyId = null, joyOX = 0, joyOY = 0;
  let mirarId = null, mirarX = 0, mirarY = 0, mirarMov = 0, mirarT0 = 0;
  const botonPorToque = {};   // identificador de toque → nombre de botón mantenido
  const RADIO_JOY = 55;       // píxeles de pantalla

  // Convierte coordenadas de pantalla a coordenadas internas del juego
  function aInterno(cx, cy) {
    const r = canvas.getBoundingClientRect();
    return { x: (cx - r.left) * C.ANCHO / r.width, y: (cy - r.top) * C.ALTO / r.height };
  }

  function pedirBloqueo() {
    if (E.modo !== '3d' || E.modoArrastre || E.tactil || E.bloqueado || !canvas.requestPointerLock) return;
    try {
      const p = canvas.requestPointerLock();
      if (p && p.catch) p.catch(function () { E.modoArrastre = true; });
    } catch (err) { E.modoArrastre = true; }
  }

  function activarTactil() {
    if (E.tactil) return;
    E.tactil = true;
    document.body.classList.add('tactil');
    // Pantalla completa y orientación horizontal (si el navegador lo permite)
    const doc = document.documentElement;
    try {
      const p = doc.requestFullscreen ? doc.requestFullscreen({ navigationUI: 'hide' }) : null;
      if (p && p.then) p.then(function () {
        if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(function () {});
      }).catch(function () {});
    } catch (err) { /* sin pantalla completa */ }
  }

  function iniciar(cv, cont) {
    canvas = cv;
    contenedor = cont;
    joyBase = document.getElementById('joy-base');
    joyPerilla = document.getElementById('joy-perilla');

    // ---------- Teclado ----------
    window.addEventListener('keydown', function (e) {
      E.teclas[e.code] = true;
      if (!e.repeat) E.eventos.push('tecla:' + e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) >= 0) e.preventDefault();
    });
    window.addEventListener('keyup', function (e) { E.teclas[e.code] = false; });
    window.addEventListener('blur', function () { E.teclas = {}; });

    // ---------- Mouse ----------
    canvas.addEventListener('mousedown', function (e) {
      if (E.bloqueado) { E.eventos.push('clic'); return; }
      E.mouseAbajo = true;
      E.distArrastre = 0;
      if (E.modo !== '3d') {
        E.clics.push(aInterno(e.clientX, e.clientY));
        E.eventos.push('clic');
      }
    });
    window.addEventListener('mouseup', function () {
      if (E.mouseAbajo && E.distArrastre < 5 && E.modo === '3d') {
        pedirBloqueo();               // debe ocurrir dentro del evento del usuario
        E.eventos.push('clicLibre');
      }
      E.mouseAbajo = false;
    });
    window.addEventListener('mousemove', function (e) {
      const dx = e.movementX || 0, dy = e.movementY || 0;
      if (E.modo === '3d' && (E.bloqueado || (E.modoArrastre && E.mouseAbajo))) {
        E.giroAcum += dx * C.SENS_MOUSE;
        E.pitchAcum -= dy * C.SENS_PITCH;
      }
      if (E.mouseAbajo) E.distArrastre += Math.abs(dx) + Math.abs(dy);
    });
    document.addEventListener('pointerlockchange', function () {
      const antes = E.bloqueado;
      E.bloqueado = document.pointerLockElement === canvas;
      if (antes && !E.bloqueado) E.eventos.push('perdioBloqueo');
    });
    document.addEventListener('pointerlockerror', function () { E.modoArrastre = true; });

    // ---------- Táctil ----------
    const opciones = { passive: false };
    contenedor.addEventListener('touchstart', function (e) {
      e.preventDefault();
      activarTactil();
      const rect = contenedor.getBoundingClientRect();
      for (const t of e.changedTouches) {
        E.eventos.push('toque');
        const boton = t.target.closest && t.target.closest('[data-boton]');
        if (boton) {
          const nombre = boton.dataset.boton;
          E.eventos.push('boton:' + nombre);
          boton.classList.add('activo');
          if (boton.dataset.mantener) {
            botonPorToque[t.identifier] = { nombre: nombre, el: boton };
            E.mantenidos[nombre] = (E.mantenidos[nombre] || 0) + 1;
          } else {
            setTimeout(function () { boton.classList.remove('activo'); }, 120);
          }
          continue;
        }
        if (E.modo === 'ui') {
          E.clics.push(aInterno(t.clientX, t.clientY));
          continue;
        }
        if (E.modo === '2d') continue;   // en 2D solo cuentan los botones
        if (t.clientX < rect.left + rect.width * 0.45 && joyId === null) {
          joyId = t.identifier;
          joyOX = t.clientX; joyOY = t.clientY;
          joyBase.style.display = 'block';
          joyBase.style.left = (t.clientX - rect.left) + 'px';
          joyBase.style.top = (t.clientY - rect.top) + 'px';
          joyPerilla.style.transform = 'translate(0px, 0px)';
        } else if (mirarId === null) {
          mirarId = t.identifier;
          mirarX = t.clientX; mirarY = t.clientY;
          mirarMov = 0; mirarT0 = performance.now();
        }
      }
    }, opciones);

    contenedor.addEventListener('touchmove', function (e) {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) {
          let dx = t.clientX - joyOX, dy = t.clientY - joyOY;
          const d = Math.hypot(dx, dy);
          if (d > RADIO_JOY) { dx *= RADIO_JOY / d; dy *= RADIO_JOY / d; }
          joyPerilla.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';
          let jx = dx / RADIO_JOY, jy = dy / RADIO_JOY;
          if (Math.hypot(jx, jy) < 0.15) { jx = 0; jy = 0; }   // zona muerta
          E.joy.x = jx; E.joy.y = jy;
        } else if (t.identifier === mirarId) {
          const dx = t.clientX - mirarX, dy = t.clientY - mirarY;
          E.giroAcum += dx * C.SENS_TACTIL;
          E.pitchAcum -= dy * C.SENS_PITCH * 0.8;
          mirarMov += Math.abs(dx) + Math.abs(dy);
          mirarX = t.clientX; mirarY = t.clientY;
        }
      }
    }, opciones);

    function terminarToque(e) {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const b = botonPorToque[t.identifier];
        if (b) {
          E.mantenidos[b.nombre] = Math.max(0, (E.mantenidos[b.nombre] || 1) - 1);
          if (!E.mantenidos[b.nombre]) b.el.classList.remove('activo');
          delete botonPorToque[t.identifier];
        }
        if (t.identifier === joyId) {
          joyId = null;
          E.joy.x = 0; E.joy.y = 0;
          joyBase.style.display = 'none';
        } else if (t.identifier === mirarId) {
          if (mirarMov < 10 && performance.now() - mirarT0 < 250) E.eventos.push('tap');
          mirarId = null;
        }
      }
    }
    contenedor.addEventListener('touchend', terminarToque, opciones);
    contenedor.addEventListener('touchcancel', terminarToque, opciones);
  }

  // Cambia de modo (muestra/oculta controles táctiles y libera el puntero si hace falta)
  function fijarModo(m) {
    if (E.modo === m) return;
    E.modo = m;
    document.body.classList.remove('modo-3d', 'modo-2d', 'modo-ui');
    document.body.classList.add('modo-' + m);
    if (m !== '3d') {
      if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
      joyId = null; mirarId = null;
      E.joy.x = 0; E.joy.y = 0;
      if (joyBase) joyBase.style.display = 'none';
    }
    E.giroAcum = 0; E.pitchAcum = 0;
  }

  // Lee el estado de este cuadro y reinicia los acumuladores
  function leer(dt) {
    const k = E.teclas, m = E.mantenidos;
    const avance = ((k.KeyW || k.ArrowUp) ? 1 : 0) - ((k.KeyS || k.ArrowDown) ? 1 : 0) - E.joy.y;
    const lateral = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0) + E.joy.x;
    const giroTeclado = ((k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0)) * C.VEL_GIRO_TECLADO * dt;
    const r = {
      avance: avance,
      lateral: lateral,
      giro: E.giroAcum + giroTeclado,
      pitch: E.pitchAcum,
      correr: !!(k.ShiftLeft || k.ShiftRight),
      // Salas 2D
      mover2d: ((k.KeyD || k.ArrowRight || m.der) ? 1 : 0) - ((k.KeyA || k.ArrowLeft || m.izq) ? 1 : 0),
      saltoMantenido: !!(k.KeyW || k.ArrowUp || k.Space || m.salto)
    };
    E.giroAcum = 0;
    E.pitchAcum = 0;
    return r;
  }

  function sacarEventos() { const l = E.eventos; E.eventos = []; return l; }
  function sacarClics() { const l = E.clics; E.clics = []; return l; }

  // Vibración corta en teléfonos (si existe)
  function vibrar(ms) { if (E.tactil && navigator.vibrate) { try { navigator.vibrate(ms); } catch (err) { /* nada */ } } }

  E.iniciar = iniciar;
  E.leer = leer;
  E.sacarEventos = sacarEventos;
  E.sacarClics = sacarClics;
  E.fijarModo = fijarModo;
  E.pedirBloqueo = pedirBloqueo;
  E.vibrar = vibrar;
  W.Entrada = E;
})();

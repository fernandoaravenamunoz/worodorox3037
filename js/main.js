// =====================================================
// WORODOROX 3073 - Bucle principal y estados del juego
//
// Estados:
//   titulo → historia → seleccion → jugando ⇄ (puzzle | verPista | mapa | libreta | pausa | sala2d)
//   jugando → muerte → jugando        jugando → nivelCompleto → jugando (siguiente nivel)
//   nivel 12: núcleo de la IA → puzzle 'jefe' → final → titulo
//
// main.js solo coordina: la lógica del laberinto está en juego/nivel.js,
// la de las salas en motor2d/plataformas.js y la de los puzzles en puzzles/.
// =====================================================
(function () {
  'use strict';
  const C = W.config, PAL = W.paleta;

  const canvas = document.getElementById('pantalla');
  const ctx = canvas.getContext('2d');
  const contenedor = document.getElementById('contenedor');
  canvas.width = C.ANCHO;
  canvas.height = C.ALTO;
  ctx.imageSmoothingEnabled = false;

  W.raycaster.iniciar(ctx);
  W.Entrada.iniciar(canvas, contenedor);
  document.body.classList.add('modo-ui');
  W.Entrada.modo = 'ui';

  // ---------- Estado global ----------
  let estado = 'titulo';
  let tEstado = 0;
  let partida = null;
  let nivel = null;
  let sala = null;
  let puzzle = null, puzzleCtx = null;
  let pistaVista = null;
  let volverDe = 'jugando';       // a dónde volver al cerrar libreta/pausa
  let tCartel = 99;
  let tiempo = 0, ultimo = performance.now();
  let mostrarFps = false, fps = 0, acumFps = 0, cuadros = 0;
  let audioListo = false;
  let seleccionPara = 'solo';     // la selección de personaje es para 'solo' o 'red'
  let avisoTitulo = '';           // mensaje en el título (por ejemplo, desconexión)
  const RED = W.Red;

  // Nivel de fondo para la pantalla de título (no toca el guardado)
  const fondo = new W.Nivel(W.niveles[1], W.Partida.nueva('chispa'));

  function tactil() { return W.Entrada.tactil || matchMedia('(pointer: coarse)').matches; }

  // Escala el contenedor para llenar la ventana manteniendo 16:9
  function ajustar() {
    const esc = Math.min(window.innerWidth / C.ANCHO, window.innerHeight / C.ALTO);
    contenedor.style.width = Math.floor(C.ANCHO * esc) + 'px';
    contenedor.style.height = Math.floor(C.ALTO * esc) + 'px';
  }
  window.addEventListener('resize', ajustar);
  ajustar();

  // ---------- Cambio de estado ----------
  const MODOS = { jugando: '3d', sala2d: '2d' };
  function cambiar(nuevo) {
    estado = nuevo;
    tEstado = 0;
    W.Entrada.fijarModo(MODOS[nuevo] || 'ui');
    musicaSegunEstado();
  }
  function musicaSegunEstado() {
    if (!W.Audio) return;
    if (estado === 'titulo' || estado === 'historia' || estado === 'seleccion' || estado.indexOf('red') === 0) W.Audio.musica('titulo');
    else if (estado === 'sala2d') W.Audio.musica('sala');
    else if (estado === 'final') W.Audio.musica('final');
    else if (estado === 'jugando' && nivel) W.Audio.musica('z' + nivel.def.zona);
  }

  // ---------- Menús ----------
  const textoSonido = function () { return 'SONIDO: ' + (W.Audio && W.Audio.activo ? 'SI' : 'NO'); };
  const menuTitulo = new W.Menus.Menu([
    { texto: 'CONTINUAR', visible: function () { return W.Partida.hayGuardado(); }, accion: continuar },
    { texto: 'NUEVA PARTIDA', accion: function () { seleccionPara = 'solo'; cambiar('historia'); } },
    { texto: 'MULTIJUGADOR', accion: function () { seleccionPara = 'red'; avisoTitulo = ''; cambiar('seleccion'); } },
    { texto: textoSonido, accion: function () { W.Audio.alternar(); } }
  ], 80);
  const menuRed = new W.Menus.Menu([
    { texto: 'CREAR PARTIDA', accion: function () { RED.crear(RED.personaje); cambiar('redLobby'); } },
    { texto: 'UNIRSE CON UN CODIGO', accion: function () { W.MenuRed.Codigo.reiniciar(); RED.error = ''; RED.estado = ''; cambiar('redCodigo'); } },
    { texto: 'CAMBIAR PERSONAJE', accion: function () { cambiar('seleccion'); } },
    { texto: 'VOLVER', accion: function () { RED.salir(); cambiar('titulo'); } }
  ], 70, 140);
  const menuPausa = new W.Menus.Menu([
    { texto: 'CONTINUAR', accion: function () { cambiar(volverDe); } },
    { texto: 'LIBRETA', accion: function () { abrirLibreta(volverDe); } },
    { texto: textoSonido, accion: function () { W.Audio.alternar(); } },
    { texto: 'SALIR AL TITULO', accion: function () { sala = null; RED.salir(); cambiar('titulo'); } }
  ], 70);

  // ---------- Partida y niveles ----------
  function continuar() {
    partida = W.Partida.cargar();
    if (!partida) return;
    iniciarNivel(partida.nivel);
  }
  function nuevaPartida(personaje) {
    partida = W.Partida.nueva(personaje);
    W.Partida.guardar(partida);
    iniciarNivel(1);
  }
  function iniciarNivel(n) {
    const def = W.niveles[n];
    nivel = new W.Nivel(def, partida);
    sala = null;
    if (RED.enJuego) configurarRed(nivel);
    W.HUD.zona = 'NIVEL ' + def.id;
    tCartel = 0;
    cambiar('jugando');
  }

  function abrirLibreta(volver, idPreferido) {
    volverDe = volver;
    W.Libreta.abrir(partida, idPreferido);
    cambiar('libreta');
  }

  function abrirPuzzle(nombre, opciones, alTerminar, volverA) {
    puzzle = W.Puzzles.crear(nombre, opciones);
    puzzleCtx = { alTerminar: alTerminar, volverA: volverA || 'jugando' };
    cambiar('puzzle');
  }

  // Ejecuta una acción devuelta por el nivel
  function ejecutarAccion(acc) {
    if (!acc) return;
    if (acc.tipo === 'puzzle') abrirPuzzle(acc.puzzle, acc.opciones, acc.alTerminar, 'jugando');
    else if (acc.tipo === 'verPista') { pistaVista = acc.datos; cambiar('verPista'); }
    else if (acc.tipo === 'sala2d') entrarSala();
    else if (acc.tipo === 'salida') {
      if (RED.enJuego) nivel.emitir({ t: 'salida' });
      terminarNivel();
    } else if (acc.tipo === 'jefe') iniciarJefe();
  }

  function entrarSala() {
    const def = nivel.def.sala;
    if (!def) { W.HUD.mostrar('EL DUCTO ESTA BLOQUEADO'); return; }
    const objetoYa = def.objeto && partida.objetos.indexOf(def.objeto) >= 0;
    sala = new W.Sala2D(def, {
      jug: nivel.jug,
      personaje: partida.personaje,
      zona: nivel.def.zona,
      objetoYaObtenido: objetoYa,
      alTerminal: function (term, alFinal) {
        const datos = term.pista ? nivel.pistas[term.pista] : null;
        abrirPuzzle(term.puzzle || (datos ? datos.tipo : 'codigo'), {
          dificultad: term.dificultad || (datos ? datos.dificultad : 1),
          rnd: W.texturas.azar((Math.random() * 1e9) | 0),
          pista: datos,
          pistaConocida: datos ? W.Partida.conocePista(partida, datos.id) : false,
          tiempo: 75,
          alFallar: 'reiniciar',
          estilo: 'normal',
          titulo: 'TERMINAL DE MANTENIMIENTO'
        }, alFinal, 'sala2d');
      }
    });
    if (W.Audio) W.Audio.sfx('puerta');
    cambiar('sala2d');
  }

  function iniciarJefe() {
    const j = nivel.def.jefe || {};
    const pistas = { matriz: nivel.pistas[j.matriz], codigo: nivel.pistas[j.codigo] };
    const conocidas = {
      matriz: pistas.matriz && W.Partida.conocePista(partida, pistas.matriz.id),
      codigo: pistas.codigo && W.Partida.conocePista(partida, pistas.codigo.id)
    };
    if (W.Audio) W.Audio.musica('jefe');
    abrirPuzzle('jefe', {
      pistas: pistas, conocidas: conocidas,
      alDanio: function (n) { nivel.jug.danar(n, true); return nivel.jug.vida > 0; },
      vida: function () { return nivel.jug.vida; }
    }, function (res) {
      if (res === 'exito') { if (RED.enJuego) nivel.emitir({ t: 'final' }); cambiar('final'); }
    }, 'jugando');
  }

  function terminarNivel() {
    if (estado === 'nivelCompleto' || estado === 'final') return;
    if (W.Audio) W.Audio.sfx('nivel');
    if (!W.niveles[nivel.def.id + 1]) { cambiar('final'); return; }
    cambiar('nivelCompleto');
  }

  // ---------- Multijugador ----------
  function configurarRed(n) {
    n.red = { rol: RED.rol, puesto: RED.puesto };
    n.esCliente = RED.rol === 'cliente';
    n.alEvento = function (e) { e.n = n.def.id; RED.evento(e); };
    n.alDanioRemoto = function (puesto, d) { RED.danioA(puesto, d); };
  }
  function hayCompaneros() { return nivel && Object.keys(nivel.otros).length > 0; }
  function estadoLocal() {
    if (!nivel) return 'ocupado';
    if (nivel.jug.atrapado) return 'atrapado';
    if (estado === 'jugando') return 'activo';
    if (estado === 'sala2d' || (estado === 'puzzle' && puzzleCtx && puzzleCtx.volverA === 'sala2d')) return 'sala';
    return 'ocupado';
  }
  // Sin vida: con compañeros quedas atrapado esperando rescate; si no, mueres
  function vidaAgotada() {
    const jug = nivel.jug;
    if (RED.enJuego && hayCompaneros() && estado !== 'sala2d') {
      if (!jug.atrapado) {
        jug.atrapado = true;
        jug.tAtrapado = W.configRed.TIEMPO_RESCATE;
        jug.vida = 0;
        if (estado !== 'jugando') cambiar('jugando');
        if (W.Audio) W.Audio.sfx('muerte');
        W.Entrada.vibrar(300);
      }
      return;
    }
    morir();
  }

  RED.al.iniciar = function (n, semilla) {
    partida = W.Partida.nueva(RED.personaje);
    partida.semilla = semilla;
    partida.nivel = n;
    partida.sinGuardar = true;
    iniciarNivel(n);
  };
  RED.al.estado = function (m) { if (nivel && nivel.esCliente) nivel.aplicarEstado(m, RED.puesto); };
  RED.al.yo = function (puesto, m) { if (nivel && m.n === nivel.def.id) nivel.actualizarOtro(puesto, m); };
  RED.al.salio = function (puesto) {
    if (nivel) nivel.quitarOtro(puesto);
    if (RED.enJuego) W.HUD.mostrar('UN JUGADOR SE DESCONECTO', 3);
  };
  RED.al.danio = function (d) {
    if (!nivel || estado !== 'jugando') return;
    nivel.danarObjetivo(null, d.n, d.motivo, d.gx, d.gy);
  };
  RED.al.evento = function (e) {
    if (!nivel || (e.n && e.n !== nivel.def.id)) return;
    if (e.t === 'salida') terminarNivel();
    else if (e.t === 'final') { puzzle = null; puzzleCtx = null; cambiar('final'); }
    else if (e.t === 'rescatar') { if (e.s === RED.puesto) nivel.rescatado(); }
    else nivel.aplicarEvento(e);
  };
  RED.al.desconectado = function (motivo, enJuego) {
    if (enJuego || estado.indexOf('red') !== 0) {
      avisoTitulo = motivo;
      puzzle = null; puzzleCtx = null; sala = null; nivel = null; partida = null;
      cambiar('titulo');
    }
  };

  // ---------- Eventos por estado ----------
  function esAccion(ev) { return ev === 'clic' || ev === 'tap' || ev === 'boton:accion' || ev === 'tecla:KeyF' || ev === 'tecla:Enter'; }

  function procesar(eventos, clics) {
    const teclas = eventos.filter(function (e) { return e.indexOf('tecla:') === 0; }).map(function (e) { return e.slice(6); });

    // Audio: se inicia con la primera interacción del usuario
    if (!audioListo && eventos.some(function (e) { return e === 'clic' || e === 'toque' || e === 'clicLibre' || e.indexOf('tecla:') === 0; })) {
      audioListo = true;
      if (W.Audio) { W.Audio.iniciar(); musicaSegunEstado(); }
    }
    if (teclas.indexOf('KeyM') >= 0 && W.Audio) W.Audio.alternar();
    if (teclas.indexOf('KeyP') >= 0) mostrarFps = !mostrarFps;

    switch (estado) {
      case 'titulo':
        if (clics.length || teclas.length) avisoTitulo = '';
        for (const c of clics) menuTitulo.clic(c.x, c.y);
        for (const k of teclas) menuTitulo.tecla(k);
        break;

      case 'historia':
        if (tEstado > 0.6 && (clics.length || teclas.indexOf('Enter') >= 0 || teclas.indexOf('Space') >= 0)) {
          if (tEstado < W.Menus.LINEAS_HISTORIA * 1.6) tEstado = W.Menus.LINEAS_HISTORIA * 1.6;   // muestra todo
          else cambiar('seleccion');
        }
        break;

      case 'seleccion': {
        let elegido = null;
        for (const c of clics) elegido = elegido || W.Menus.Seleccion.clic(c.x, c.y);
        for (const k of teclas) elegido = elegido || W.Menus.Seleccion.tecla(k);
        if (elegido) {
          if (seleccionPara === 'red') { RED.personaje = elegido; cambiar('redMenu'); }
          else nuevaPartida(elegido);
        }
        break;
      }

      case 'redMenu':
        for (const c of clics) menuRed.clic(c.x, c.y);
        for (const k of teclas) { if (k === 'Escape') { cambiar('titulo'); return; } menuRed.tecla(k); }
        break;

      case 'redCodigo': {
        let r = null;
        for (const c of clics) r = r || W.MenuRed.Codigo.clic(c.x, c.y);
        for (const k of teclas) r = r || W.MenuRed.Codigo.tecla(k);
        if (r === 'volver') { RED.salir(); cambiar('redMenu'); }
        else if (r === 'unirse') RED.unirse(W.MenuRed.Codigo.digitos, RED.personaje);
        if (RED.activo && RED.rol === 'cliente') cambiar('redLobby');
        break;
      }

      case 'redLobby': {
        let r = null;
        for (const c of clics) r = r || W.MenuRed.Sala.clic(c.x, c.y);
        for (const k of teclas) r = r || W.MenuRed.Sala.tecla(k);
        if (r === 'salir') { RED.salir(); cambiar('redMenu'); }
        else if (r === 'iniciar') RED.iniciar();
        break;
      }

      case 'jugando':
        for (const ev of eventos) {
          if (ev === 'perdioBloqueo' || ev === 'tecla:Escape' || ev === 'boton:pausa') { volverDe = 'jugando'; cambiar('pausa'); return; }
          if (esAccion(ev) || (ev === 'clicLibre' && W.Entrada.modoArrastre)) {
            ejecutarAccion(nivel.accion(W.Entrada.tactil ? C.ANGULO_APUNTAR_TACTIL : C.ANGULO_APUNTAR));
            if (estado !== 'jugando') return;
          }
          if (ev === 'tecla:KeyQ' || ev === 'boton:q') { cambiar('mapa'); return; }
          if (ev === 'tecla:KeyE' || ev === 'boton:e') { abrirLibreta('jugando'); return; }
        }
        break;

      case 'puzzle':
        puzzle.actualizar(0, { clics: clics, teclas: teclas });
        break;

      case 'verPista':
        if (tEstado > 0.25 && (clics.length || teclas.length)) cambiar('jugando');
        break;

      case 'mapa':
        if (tEstado > 0.15 && (clics.length || teclas.indexOf('KeyQ') >= 0 || teclas.indexOf('Escape') >= 0 || eventos.indexOf('boton:q') >= 0)) cambiar('jugando');
        break;

      case 'libreta':
        for (const c of clics) if (W.Libreta.clic(partida, c.x, c.y)) { cambiar(volverDe); return; }
        for (const k of teclas) {
          if (k === 'KeyE' || k === 'Escape' || k === 'KeyQ') { cambiar(volverDe); return; }
          W.Libreta.tecla(partida, k);
        }
        if (eventos.indexOf('boton:e') >= 0 && tEstado > 0.15) cambiar(volverDe);
        break;

      case 'pausa':
        for (const c of clics) menuPausa.clic(c.x, c.y);
        for (const k of teclas) { if (k === 'Escape' && tEstado > 0.2) { cambiar(volverDe); return; } menuPausa.tecla(k); }
        break;

      case 'sala2d': {
        const ev2 = { salto: false, accion: false };
        for (const ev of eventos) {
          if (ev === 'tecla:Space' || ev === 'tecla:KeyW' || ev === 'tecla:ArrowUp' || ev === 'boton:salto') ev2.salto = true;
          if (ev === 'clic' || ev === 'tecla:KeyF' || ev === 'tecla:Enter' || ev === 'boton:accion') ev2.accion = true;
          if (ev === 'tecla:KeyE' || ev === 'boton:e') { abrirLibreta('sala2d'); return; }
          if (ev === 'tecla:Escape' || ev === 'boton:pausa') { volverDe = 'sala2d'; cambiar('pausa'); return; }
        }
        sala._eventos = ev2;
        break;
      }

      case 'muerte':
        if (tEstado > 2.2 && (clics.length || teclas.length)) {
          sala = null;
          nivel.reaparecer();
          cambiar('jugando');
          W.HUD.mostrar('REIMPRESION COMPLETA', 2);
        }
        break;

      case 'nivelCompleto':
        if (tEstado > 1 && (clics.length || teclas.length)) {
          W.Partida.siguienteNivel(partida);
          iniciarNivel(partida.nivel);
        }
        break;

      case 'final':
        if (tEstado > 9 && (clics.length || teclas.length)) {
          W.Partida.borrar();
          partida = null; nivel = null;
          cambiar('titulo');
        }
        break;
    }
  }

  // ---------- Actualización por estado ----------
  function actualizar(dt, entrada) {
    if (partida && (estado === 'jugando' || estado === 'sala2d' || estado === 'puzzle')) partida.tiempo += dt;

    // Multijugador: el mundo sigue aunque estés en un puzzle, menú o sala 2D
    if (RED.enJuego && nivel && estado !== 'jugando' && ['puzzle', 'verPista', 'mapa', 'libreta', 'pausa', 'sala2d', 'muerte'].indexOf(estado) >= 0) {
      nivel.jugOcupado = true;
      nivel.actualizarMundo(dt);
    }
    if (RED.enJuego && nivel) {
      RED.actualizar(dt,
        function () { return nivel.armarEstado(RED.puesto, estadoLocal()); },
        function () { const j = nivel.jug; return { n: nivel.def.id, x: j.x, y: j.y, a: j.ang, pe: j.p.id, v: j.vida, vm: j.vidaMax, e: estadoLocal() }; });
    }

    if (estado === 'jugando') {
      nivel.actualizar(dt, entrada);
      W.HUD.aviso = nivel.aviso(W.Entrada.tactil ? C.ANGULO_APUNTAR_TACTIL : C.ANGULO_APUNTAR);
      tCartel += dt;
      const jug = nivel.jug;
      if (jug.atrapado) {
        jug.tAtrapado -= dt;
        if (jug.tAtrapado <= 0 || !hayCompaneros()) { jug.atrapado = false; morir(); }
      } else if (jug.vida <= 0) vidaAgotada();
    } else if (estado === 'puzzle') {
      puzzle.actualizar(dt, { clics: [], teclas: [] });
      if (puzzle.terminado) {
        const pc = puzzleCtx, res = puzzle.resultado;
        puzzle = null; puzzleCtx = null;
        cambiar(pc.volverA);
        if (pc.alTerminar) pc.alTerminar(res);
        if (estado !== 'final' && nivel && nivel.jug.vida <= 0 && !nivel.jug.atrapado) vidaAgotada();
      }
    } else if (estado === 'sala2d') {
      sala.actualizar(dt, entrada, sala._eventos || { salto: false, accion: false });
      sala._eventos = null;
      if (sala.resultado === 'salida') {
        nivel.salaSuperada(sala.objetoTomado ? sala.def.objeto : null);
        W.HUD.mostrar(sala.objetoTomado && sala.def.objeto ? 'SALA SUPERADA. TIENES: ' + sala.def.objeto : 'SALA SUPERADA. EL DUCTO QUEDA ABIERTO', 3);
        sala = null;
        cambiar('jugando');
      } else if (sala.resultado === 'muerte') morir();
    } else if (estado === 'titulo') {
      fondo.jug.ang += dt * 0.12;
    }
  }

  function morir() {
    if (W.Audio) W.Audio.sfx('muerte');
    W.Entrada.vibrar(300);
    cambiar('muerte');
  }

  // ---------- Dibujo por estado ----------
  function dibujarMundo() {
    W.raycaster.render(ctx, nivel.jug, nivel.mapa, nivel.sprites(), nivel.conos);
  }

  function dibujar(dt) {
    const t = tactil();
    switch (estado) {
      case 'titulo':
        W.raycaster.render(ctx, fondo.jug, fondo.mapa, fondo.sprites(), null);
        W.Menus.titulo(ctx, tiempo, menuTitulo);
        if (avisoTitulo) W.HUD.textoConCaja(ctx, avisoTitulo, C.ANCHO / 2, 158, PAL.rojo, PAL.rojo);
        break;
      case 'historia': W.Menus.historia(ctx, tEstado, t); break;
      case 'seleccion': W.Menus.Seleccion.dibujar(ctx, tiempo); break;
      case 'redMenu':
        W.raycaster.render(ctx, fondo.jug, fondo.mapa, fondo.sprites(), null);
        ctx.fillStyle = 'rgba(7,6,13,0.7)'; ctx.fillRect(0, 0, C.ANCHO, C.ALTO);
        W.HUD.texto(ctx, 'MULTIJUGADOR - COOPERATIVO', C.ANCHO / 2, 30, PAL.magenta, 2, 'centro');
        W.HUD.texto(ctx, 'JUEGAS CON ' + W.PERSONAJES[RED.personaje].nombre + '. HASTA 4 JUGADORES POR INTERNET', C.ANCHO / 2, 50, PAL.gris, 1, 'centro');
        menuRed.dibujar(ctx);
        if (RED.error) W.HUD.texto(ctx, RED.error, C.ANCHO / 2, 160, PAL.rojo, 1, 'centro');
        break;
      case 'redCodigo': W.MenuRed.Codigo.dibujar(ctx, tiempo); break;
      case 'redLobby': W.MenuRed.Sala.dibujar(ctx, tiempo); break;
      case 'jugando':
        dibujarMundo();
        W.HUD.dibujar(ctx, nivel, partida, dt, t);
        W.Menus.cartelNivel(ctx, nivel.def, tCartel);
        if (!t && !W.Entrada.bloqueado && !W.Entrada.modoArrastre && tCartel > 0.5) {
          W.HUD.textoConCaja(ctx, 'CLIC PARA CAPTURAR EL MOUSE', C.ANCHO / 2, 124, PAL.amarillo, PAL.amarillo);
        }
        break;
      case 'puzzle':
        if (puzzleCtx && puzzleCtx.volverA === 'sala2d' && sala) sala.dibujar(ctx); else if (nivel) dibujarMundo();
        puzzle.dibujar(ctx);
        break;
      case 'verPista': dibujarMundo(); W.Menus.verPista(ctx, pistaVista, t); break;
      case 'mapa': W.MapaUI.dibujar(ctx, nivel, tiempo); break;
      case 'libreta': W.Libreta.dibujar(ctx, partida); break;
      case 'pausa':
        if (volverDe === 'sala2d' && sala) sala.dibujar(ctx); else dibujarMundo();
        W.Menus.pausa(ctx, menuPausa);
        break;
      case 'sala2d':
        sala.dibujar(ctx);
        W.HUD.dibujar2d(ctx, sala, partida, dt, t);
        break;
      case 'muerte':
        if (sala) sala.dibujar(ctx); else dibujarMundo();
        W.Menus.muerte(ctx, tEstado, t);
        break;
      case 'nivelCompleto': dibujarMundo(); W.Menus.nivelCompleto(ctx, tEstado, nivel.def, partida, t); break;
      case 'final': W.Menus.final(ctx, tEstado, partida ? partida.personaje : 'chispa', partida || W.Partida.nueva('chispa'), t); break;
    }
  }

  // ---------- Bucle ----------
  function bucle(ahora) {
    let dt = (ahora - ultimo) / 1000;
    ultimo = ahora;
    if (dt > 0.05) dt = 0.05;
    tiempo += dt;
    tEstado += dt;

    procesar(W.Entrada.sacarEventos(), W.Entrada.sacarClics());
    const entrada = W.Entrada.leer(dt);
    actualizar(dt, entrada);
    dibujar(dt);

    // Contador de cuadros por segundo (tecla P)
    cuadros++; acumFps += dt;
    if (acumFps >= 0.5) { fps = Math.round(cuadros / acumFps); cuadros = 0; acumFps = 0; }
    if (mostrarFps) W.HUD.texto(ctx, fps + ' FPS', 4, 4, '#7ff3ff');

    requestAnimationFrame(bucle);
  }

  // Multijugador: si la pestaña queda oculta (por ejemplo, el anfitrión cambia a otra
  // ventana), el navegador detiene requestAnimationFrame. Este latido mantiene vivos
  // la simulación y la red para los demás jugadores.
  setInterval(function () {
    if (!document.hidden || !RED.rol) return;   // también en la sala de espera
    const ahora = performance.now();
    let dt = (ahora - ultimo) / 1000;
    ultimo = ahora;
    if (dt > 0.1) dt = 0.1;
    tiempo += dt; tEstado += dt;
    procesar(W.Entrada.sacarEventos(), W.Entrada.sacarClics());
    actualizar(dt, { avance: 0, lateral: 0, giro: 0, pitch: 0, correr: false, mover2d: 0, saltoMantenido: false });
  }, 50);

  // Acceso para depurar desde la consola
  W.juego = {
    get nivel() { return nivel; }, get partida() { return partida; }, get estado() { return estado; },
    get sala() { return sala; }, get puzzle() { return puzzle; }, red: RED,
    irANivel: function (n, personaje) { partida = partida || W.Partida.nueva(personaje || 'chispa'); partida.nivel = n; partida.punto = null; iniciarNivel(n); },
    entrarSala: function () { entrarSala(); },
    // Prueba cualquier puzzle desde la consola: W.juego.probarPuzzle('luces', 3)
    probarPuzzle: function (nombre, dif) {
      if (!nivel) this.irANivel(1);
      abrirPuzzle(nombre, { dificultad: dif || 1, rnd: W.texturas.azar((Math.random() * 1e9) | 0), tiempo: 90, alFallar: 'reiniciar' }, null, 'jugando');
    }
  };

  requestAnimationFrame(bucle);
})();

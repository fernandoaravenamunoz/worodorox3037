// =====================================================
// WORODOROX 3073 - Bucle principal y estados del juego
//
// Estados:
//   titulo → historia → seleccion → jugando ⇄ (puzzle | verPista | mapa | libreta | pausa | sala2d)
//   jugando → muerte → jugando        jugando → nivelCompleto → jugando (siguiente nivel)
//   nivel 12: núcleo de la IA → puzzle 'jefe' → final → titulo
//   multijugador: titulo → seleccion → redMenu → (redCodigo) → redLobby → jugando
//   versus: jugando → vsFin (resultados) → redLobby
//   titulo → progreso → titulo        pausa → (volver al último respaldo) → jugando
//
// main.js solo coordina: la lógica del laberinto está en juego/nivel.js y
// juego/multijugador.js, la de las salas en motor2d/plataformas.js y la de los puzzles en puzzles/.
// =====================================================
(function () {
  'use strict';
  const C = W.config, PAL = W.paleta;

  const canvas = document.getElementById('pantalla');
  const ctx = canvas.getContext('2d');
  const contenedor = document.getElementById('contenedor');
  // Pantalla real de 32 bits (480×270): vista 3D y HUD
  const PA = C.PANT;
  canvas.width = PA.ANCHO;
  canvas.height = PA.ALTO;
  ctx.imageSmoothingEnabled = false;
  // Capa de interfaz de 320×180 (puzzles, menús, libreta, mapa, salas 2D): se dibuja aparte
  // y se amplía a la pantalla. Los clics siguen llegando en coordenadas de 320×180.
  const lienzoUI = document.createElement('canvas');
  lienzoUI.width = C.ANCHO; lienzoUI.height = C.ALTO;
  const ui = lienzoUI.getContext('2d');
  ui.imageSmoothingEnabled = false;
  function capa(dibujarEn) {
    ui.setTransform(1, 0, 0, 1, 0, 0);
    ui.globalAlpha = 1;
    ui.clearRect(0, 0, C.ANCHO, C.ALTO);
    dibujarEn(ui);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(lienzoUI, 0, 0, PA.ANCHO, PA.ALTO);
  }

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
  // Versus
  let marcador = { victorias: {}, derrotas: {} };
  let vsCerrado = false;          // anfitrión: ya se decidió el ganador
  let hackeosResueltos = {};      // anfitrión: hackeos ya arbitrados
  let vsResultado = null;
  let confirmarRespaldo = false;  // el botón de volver al respaldo pide confirmación
  let volverProgreso = 'titulo';

  // Nivel de fondo para la pantalla de título (no toca el guardado)
  const fondo = new W.Nivel(W.niveles[1], W.Partida.nueva('chispa'));

  function tactil() { return W.Entrada.tactil || matchMedia('(pointer: coarse)').matches; }
  function tolerancia() { return W.Entrada.tactil ? C.ANGULO_APUNTAR_TACTIL : C.ANGULO_APUNTAR; }

  // Escala el contenedor para llenar la ventana manteniendo 16:9
  function ajustar() {
    const esc = Math.min(window.innerWidth / PA.ANCHO, window.innerHeight / PA.ALTO);
    contenedor.style.width = Math.floor(PA.ANCHO * esc) + 'px';
    contenedor.style.height = Math.floor(PA.ALTO * esc) + 'px';
  }
  window.addEventListener('resize', ajustar);
  ajustar();

  // ---------- Cambio de estado ----------
  const MODOS = { jugando: '3d', sala2d: '2d' };
  function cambiar(nuevo) {
    if (nuevo === 'pausa') confirmarRespaldo = false;
    // Al vencer a la IA queda registrado en el progreso (antes de que se borre el guardado)
    if (nuevo === 'final' && partida) W.Progreso.registrar(partida, true);
    estado = nuevo;
    tEstado = 0;
    W.Entrada.fijarModo(MODOS[nuevo] || 'ui');
    // Los botones táctiles del versus solo aparecen en una partida versus
    document.body.classList.toggle('versus', !!(nivel && nivel.versus && RED.enJuego));
    musicaSegunEstado();
  }
  function musicaSegunEstado() {
    if (!W.Audio) return;
    if (estado === 'titulo' || estado === 'historia' || estado === 'progreso' || estado === 'seleccion' || estado.indexOf('red') === 0) W.Audio.musica('titulo');
    else if (estado === 'sala2d') W.Audio.musica('sala');
    else if (estado === 'final' || estado === 'vsFin') W.Audio.musica('final');
    else if (estado === 'jugando' && nivel) W.Audio.musica(nivel.versus ? 'jefe' : 'z' + nivel.def.zona);
  }

  // ---------- Menús ----------
  const textoSonido = function () { return 'SONIDO: ' + (W.Audio && W.Audio.activo ? 'SI' : 'NO'); };
  const menuTitulo = new W.Menus.Menu([
    { texto: 'CONTINUAR', visible: function () { return W.Partida.hayGuardado(); }, accion: continuar },
    { texto: 'NUEVA PARTIDA', accion: function () { seleccionPara = 'solo'; cambiar('historia'); } },
    { texto: 'MULTIJUGADOR', accion: function () { seleccionPara = 'red'; avisoTitulo = ''; cambiar('seleccion'); } },
    { texto: 'PROGRESO', visible: function () { return W.Progreso.hay(); }, accion: function () { volverProgreso = 'titulo'; cambiar('progreso'); } },
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
    // Volver al último punto de control (pide confirmar; no está en el combate)
    {
      texto: function () { return confirmarRespaldo ? 'CONFIRMAR: VOLVER AL RESPALDO' : 'VOLVER AL ULTIMO RESPALDO'; },
      visible: function () { return !!nivel && nivel.modo !== 'combate'; },
      accion: function () {
        if (!confirmarRespaldo) { confirmarRespaldo = true; return; }
        volverAlRespaldo();
      }
    },
    { texto: 'LIBRETA', accion: function () { abrirLibreta(volverDe); } },
    { texto: textoSonido, accion: function () { W.Audio.alternar(); } },
    { texto: 'SALIR AL TITULO', accion: function () { sala = null; RED.salir(); nivel = null; cambiar('titulo'); } }
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
    W.HUD.zona = nivel.modo === 'combate' ? 'ARENA ' + def.nombre : (nivel.modo === 'carrera' ? 'CARRERA - NIVEL ' : 'NIVEL ') + def.id;
    tCartel = 0;
    cambiar('jugando');
    if (nivel.modo === 'carrera') W.HUD.mostrar('CARRERA! PODERES: 1 A 4 - ESCUDO: R', 5);
    else if (nivel.modo === 'combate') W.HUD.mostrar('COMBATE! GANA QUIEN LOGRE ' + W.configRed.VS.VICTORIAS + ' VICTORIAS', 5);
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
  // Cierra el puzzle abierto sin resolverlo (hackeo decidido por el árbitro, apoyo remoto...)
  function cerrarPuzzle() {
    if (!puzzle || !puzzleCtx) return null;
    const pc = puzzleCtx;
    puzzle = null; puzzleCtx = null;
    cambiar(pc.volverA);
    return pc;
  }

  // Ejecuta una acción devuelta por el nivel
  function ejecutarAccion(acc) {
    if (!acc) return;
    if (acc.tipo === 'puzzle') {
      abrirPuzzle(acc.puzzle, acc.opciones, acc.alTerminar, 'jugando');
      if (acc.hackeo) puzzleCtx.hackeo = acc.hackeo;
    } else if (acc.tipo === 'verPista') { pistaVista = acc.datos; cambiar('verPista'); }
    else if (acc.tipo === 'sala2d') entrarSala();
    else if (acc.tipo === 'salida') {
      if (nivel.versus) {
        alArbitro({ t: 'meta' });
        W.HUD.mostrar('LLEGASTE A LA SALIDA...', 2);
        return;
      }
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
        const conocida = datos ? W.Partida.conocePista(partida, datos.id) : false;
        const quien = datos && !conocida ? nivel.quienLee(term.pista) : '';
        abrirPuzzle(term.puzzle || (datos ? datos.tipo : 'codigo'), {
          dificultad: term.dificultad || (datos ? datos.dificultad : 1),
          rnd: W.texturas.azar((Math.random() * 1e9) | 0),
          pista: datos,
          pistaConocida: conocida,
          tiempo: 75,
          alFallar: 'reiniciar',
          estilo: 'normal',
          titulo: quien ? 'TERMINAL - LA PISTA LA LEE ' + quien : 'TERMINAL DE MANTENIMIENTO'
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
    n.prepararRed({ modo: RED.modo, rol: RED.rol, puesto: RED.puesto, jugadores: RED.jugadores, repartidas: RED.repartidas });
    n.alEvento = function (e) { e.n = n.def.id; RED.evento(e); };
    n.alArbitro = alArbitro;
    n.alDanioRemoto = function (puesto, d) { RED.danioA(puesto, d); };
  }
  function enviar(e) { if (nivel) e.n = nivel.def.id; RED.evento(e); }
  // Se envía a todos y se aplica también aquí (el anfitrión no recibe sus propios eventos)
  function difundirYAplicar(e) { enviar(e); e.de = RED.puesto; manejarEvento(e); }
  // Lo decide el anfitrión: se envía y, si este equipo es el anfitrión, se arbitra aquí mismo
  function alArbitro(e) { enviar(e); e.de = RED.puesto; if (RED.esAnfitrion()) arbitrar(e); }

  function hayCompaneros() { return nivel && Object.keys(nivel.otros).length > 0; }
  function estadoLocal() {
    if (!nivel) return 'ocupado';
    if (nivel.jug.atrapado) return 'atrapado';
    if (nivel.caidoVs()) return 'caido';
    if (estado === 'jugando') return 'activo';
    if (estado === 'sala2d' || (estado === 'puzzle' && puzzleCtx && puzzleCtx.volverA === 'sala2d')) return 'sala';
    return 'ocupado';
  }
  // Sin vida. Cooperativo: con compañeros quedas atrapado esperando rescate.
  // Carrera: mueres y vuelves a tu estación. Combate: caes unos segundos y vuelves a la arena.
  function vidaAgotada() {
    const jug = nivel.jug;
    if (RED.enJuego && nivel.versus) {
      if (nivel.caidoVs()) return;
      difundirYAplicar({ t: 'derrota', s: RED.puesto, por: nivel.autorDerrota() });
      if (nivel.modo === 'combate') {
        nivel.caerEnCombate();
        if (estado !== 'jugando') { puzzle = null; puzzleCtx = null; cambiar('jugando'); }
        if (W.Audio) W.Audio.sfx('muerte');
        W.Entrada.vibrar(300);
        return;
      }
      if (estado !== 'vsFin') morir();
      return;
    }
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

  // ----- Arbitraje (solo el anfitrión) -----
  function arbitrar(e) {
    if (!RED.esAnfitrion() || !nivel) return;
    if (e.t === 'meta' && nivel.modo === 'carrera' && !vsCerrado) {
      vsCerrado = true;
      difundirYAplicar({ t: 'ganador', s: e.de, motivo: 'LLEGO PRIMERO A LA SALIDA' });
    } else if (e.t === 'hackeoFin' && !hackeosResueltos[e.id]) {
      hackeosResueltos[e.id] = true;
      difundirYAplicar({ t: 'hackeoRes', id: e.id, gana: e.gana, a: e.a, s: e.s });
    }
  }
  function revisarGanadorCombate() {
    if (!RED.esAnfitrion() || !nivel || nivel.modo !== 'combate' || vsCerrado) return;
    for (const p in marcador.victorias) {
      if (marcador.victorias[p] >= W.configRed.VS.VICTORIAS) {
        vsCerrado = true;
        difundirYAplicar({ t: 'ganador', s: +p, motivo: W.configRed.VS.VICTORIAS + ' VICTORIAS' });
        return;
      }
    }
  }

  // ----- Eventos de la partida -----
  function manejarEvento(e) {
    if (!nivel || (e.n && e.n !== nivel.def.id)) return;
    const yo = RED.puesto;
    switch (e.t) {
      case 'salida': terminarNivel(); break;
      case 'final': puzzle = null; puzzleCtx = null; cambiar('final'); break;
      case 'rescatar': if (e.s === yo) nivel.rescatado(); break;
      case 'apoyo': if (e.s && e.s.indexOf(yo) >= 0) aplicarApoyo(e.de); break;
      case 'ganador': mostrarResultados(e); break;
      case 'derrota': registrarDerrota(e); break;
      case 'hackeo': if (e.s === yo) defenderHackeo(e); break;
      case 'hackeoRes': resolverHackeo(e); break;
      case 'meta': case 'hackeoFin': break;   // los decide el árbitro
      default: nivel.aplicarEvento(e);
    }
  }

  // Apoyo desde el laberinto: el terminal del ducto queda resuelto y recuperas vida
  function aplicarApoyo(de) {
    if (puzzle && puzzleCtx && puzzleCtx.volverA === 'sala2d') {
      const pc = cerrarPuzzle();
      if (pc && pc.alTerminar) pc.alTerminar('exito');
    }
    if (!sala) return;
    sala.terminalResuelto = true;
    if (sala.persecucion) sala.persecucion.x -= 80;
    sala.jugVida.curar(3);
    sala.mensaje = 'APOYO DE ' + RED.nombreDe(de) + ': TERMINAL ABIERTO Y +3 VIDA';
    sala.tMensaje = 3;
    if (W.Audio) W.Audio.sfx('estacion');
  }

  function registrarDerrota(e) {
    const yo = RED.puesto, s = e.s, por = e.por;
    marcador.derrotas[s] = (marcador.derrotas[s] || 0) + 1;
    if (por >= 0 && por !== s) marcador.victorias[por] = (marcador.victorias[por] || 0) + 1;
    if (por === yo && s !== yo) {
      nivel.recompensa();
      W.HUD.mostrar('DERRIBASTE A ' + RED.nombreDe(s) + ': +' + W.configRed.VS.RECOMPENSA_VIDA + ' VIDA', 2.5);
      if (W.Audio) W.Audio.sfx('sellado');
    } else if (s !== yo) {
      W.HUD.mostrar(por >= 0 ? RED.nombreDe(por) + ' DERRIBO A ' + RED.nombreDe(s) : RED.nombreDe(s) + ' CAYO', 2);
    }
    revisarGanadorCombate();
  }

  function defenderHackeo(e) {
    W.HUD.mostrar(RED.nombreDe(e.de) + ' TE ESTA HACKEANDO!', 2.5);
    if (W.Audio) W.Audio.sfx('alarma');
    // Solo se puede defender quien está en el laberinto (no en un puzzle, menú o ducto)
    if (estado !== 'jugando' || nivel.caidoVs() || nivel.jug.atrapado) return;
    const yo = RED.puesto;
    abrirPuzzle(e.tipo, nivel.opcionesHackeo(e.tipo, e.semilla, 'BLOQUEA EL HACKEO DE ' + RED.nombreDe(e.de), false), function (res) {
      if (res === 'exito') alArbitro({ t: 'hackeoFin', id: e.id, gana: 's', a: e.de, s: yo });
    }, 'jugando');
    puzzleCtx.hackeo = e.id;
  }

  function resolverHackeo(e) {
    const yo = RED.puesto;
    if (puzzle && puzzleCtx && puzzleCtx.hackeo === e.id) cerrarPuzzle();
    if (e.s === yo) {
      if (e.gana === 'a') {
        nivel.volverAPunto();
        W.HUD.mostrar('HACKEADO POR ' + RED.nombreDe(e.a) + ': VUELVES A TU PUNTO DE CONTROL', 3);
        if (W.Audio) W.Audio.sfx('error');
      } else {
        W.HUD.mostrar('BLOQUEASTE EL HACKEO DE ' + RED.nombreDe(e.a), 2.5);
        if (W.Audio) W.Audio.sfx('acierto');
      }
    } else if (e.a === yo) {
      W.HUD.mostrar(e.gana === 'a' ? 'HACKEO EXITOSO: ' + RED.nombreDe(e.s) + ' VUELVE A SU PUNTO DE CONTROL' : RED.nombreDe(e.s) + ' BLOQUEO TU HACKEO', 3);
      if (W.Audio) W.Audio.sfx(e.gana === 'a' ? 'acierto' : 'error');
    }
  }

  function reiniciarMarcador() {
    marcador = { victorias: {}, derrotas: {} };
    for (const j of RED.jugadores) { marcador.victorias[j.puesto] = 0; marcador.derrotas[j.puesto] = 0; }
    vsCerrado = false; hackeosResueltos = {}; vsResultado = null;
  }

  function mostrarResultados(e) {
    if (estado === 'vsFin') return;
    const filas = RED.jugadores.map(function (j) {
      return { puesto: j.puesto, nombre: W.PERSONAJES[j.personaje].nombre, victorias: marcador.victorias[j.puesto] || 0, derrotas: marcador.derrotas[j.puesto] || 0 };
    }).sort(function (a, b) { return (b.puesto === e.s) - (a.puesto === e.s) || b.victorias - a.victorias || a.derrotas - b.derrotas; });
    const ganador = RED.jugadores.find(function (j) { return j.puesto === e.s; });
    vsResultado = { modo: nivel ? nivel.modo : RED.modo, ganador: e.s, motivo: e.motivo || '', personaje: ganador ? ganador.personaje : null, filas: filas };
    puzzle = null; puzzleCtx = null; sala = null;
    vsCerrado = true;
    if (W.Audio) W.Audio.sfx(e.s === RED.puesto ? 'nivel' : 'muerte');
    cambiar('vsFin');
  }

  // Usa un poder del versus (teclas 1-4, R o botones táctiles)
  function usarPoder(nombre) {
    if (!nombre || !nivel || !nivel.versus) return;
    ejecutarAccion(nivel.usarPoder(nombre, tolerancia()));
  }

  RED.al.iniciar = function (n, semilla) {
    partida = W.Partida.nueva(RED.personaje);
    partida.semilla = semilla;
    partida.nivel = n;
    partida.sinGuardar = true;
    reiniciarMarcador();
    puzzle = null; puzzleCtx = null;
    iniciarNivel(n);
  };
  RED.al.estado = function (m) { if (nivel && RED.enJuego) nivel.aplicarEstado(m, RED.puesto); };
  RED.al.yo = function (puesto, m) { if (nivel && m.n === nivel.def.id) nivel.actualizarOtro(puesto, m); };
  RED.al.lobby = function () {
    // Alguien salió durante la partida: las pistas repartidas se reasignan entre los que quedan
    if (nivel && RED.enJuego && nivel.modo === 'coop') nivel.repartirPistas(RED.jugadores.map(function (j) { return j.puesto; }));
  };
  RED.al.salio = function (puesto) {
    if (!nivel || !RED.enJuego) return;
    nivel.quitarOtro(puesto);
    W.HUD.mostrar('UN JUGADOR SE DESCONECTO', 3);
    // Versus: si no queda ningún rival, gana el anfitrión
    if (nivel.versus && !vsCerrado && estado !== 'vsFin' && !hayCompaneros()) {
      vsCerrado = true;
      difundirYAplicar({ t: 'ganador', s: RED.puesto, motivo: 'LOS RIVALES SE DESCONECTARON' });
    }
  };
  RED.al.danio = function (d) {
    if (!nivel || estado !== 'jugando') return;
    nivel.danarObjetivo(null, d.n, d.motivo, d.gx, d.gy);
  };
  RED.al.evento = function (e) {
    if (!nivel || !e) return;
    if (RED.esAnfitrion()) arbitrar(e);
    manejarEvento(e);
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
    if (teclas.indexOf('KeyC') >= 0) fijarCalidad(W.raycaster.calidad === 'alta' ? 'media' : 'alta', true);

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
            ejecutarAccion(nivel.accion(tolerancia()));
            if (estado !== 'jugando') return;
          }
          if (ev === 'tecla:KeyQ' || ev === 'boton:q') { cambiar('mapa'); return; }
          if (ev === 'tecla:KeyE' || ev === 'boton:e') { abrirLibreta('jugando'); return; }
          // Versus: poderes (1-4), escudo (R) y botones táctiles PODER / CAMBIAR / ESCUDO
          if (nivel.versus) {
            const m = /^tecla:(?:Digit|Numpad)([1-4])$/.exec(ev);
            if (m) { usarPoder(nivel.poderes()[+m[1] - 1]); if (estado !== 'jugando') return; }
            if (ev === 'tecla:KeyR' || ev === 'boton:escudo') usarPoder('escudo');
            if (ev === 'boton:poder') { usarPoder(nivel.poderes()[nivel.vs.sel]); if (estado !== 'jugando') return; }
            if (ev === 'boton:cambiar') {
              nivel.vs.sel = (nivel.vs.sel + 1) % nivel.poderes().length;
              W.HUD.mostrar('PODER: ' + W.configRed.VS.NOMBRE_PODER[nivel.poderes()[nivel.vs.sel]], 1);
              if (W.Audio) W.Audio.sfx('clic');
            }
          }
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

      case 'progreso':
        if (tEstado > 0.3 && (clics.some(function (c) { return W.Progreso.clic(c.x, c.y); }) || teclas.length)) cambiar(volverProgreso);
        break;

      case 'vsFin':
        if (tEstado > 2 && (clics.length || teclas.length)) {
          RED.volverASala();
          nivel = null; partida = null; sala = null;
          cambiar(RED.activo ? 'redLobby' : 'titulo');
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
    if (RED.enJuego && nivel && estado !== 'vsFin') {
      RED.actualizar(dt,
        function () { return nivel.armarEstado(RED.puesto, estadoLocal()); },
        function () { const j = nivel.jug; return { n: nivel.def.id, x: j.x, y: j.y, a: j.ang, pe: j.p.id, v: j.vida, vm: j.vidaMax, e: estadoLocal(), f: nivel.flagsLocal() }; });
    }
    if (!nivel && estado !== 'titulo') return;

    if (estado === 'jugando') {
      nivel.actualizar(dt, entrada);
      W.HUD.aviso = nivel.aviso(tolerancia());
      tCartel += dt;
      const jug = nivel.jug;
      if (jug.atrapado) {
        jug.tAtrapado -= dt;
        if (jug.tAtrapado <= 0 || !hayCompaneros()) { jug.atrapado = false; morir(); }
      } else if (jug.vida <= 0 && !nivel.caidoVs()) vidaAgotada();
    } else if (estado === 'puzzle') {
      puzzle.actualizar(dt, { clics: [], teclas: [] });
      if (puzzle && puzzle.terminado) {
        const pc = puzzleCtx, res = puzzle.resultado;
        puzzle = null; puzzleCtx = null;
        cambiar(pc.volverA);
        if (pc.alTerminar) pc.alTerminar(res);
        if (estado !== 'final' && estado !== 'vsFin' && nivel && nivel.jug.vida <= 0 && !nivel.jug.atrapado && !nivel.caidoVs()) vidaAgotada();
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

  // Botón de reinicio: vuelve a la última estación de respaldo (como una reimpresión:
  // se conservan puertas y pistas; se pierden los objetos tomados desde ese respaldo)
  function volverAlRespaldo() {
    if (!nivel) return;
    puzzle = null; puzzleCtx = null; sala = null;
    nivel.reaparecer();
    cambiar('jugando');
    W.HUD.mostrar('DE VUELTA EN TU ULTIMO RESPALDO', 2.5);
    if (W.Audio) W.Audio.sfx('estacion');
  }

  function morir() {
    if (W.Audio) W.Audio.sfx('muerte');
    W.Entrada.vibrar(300);
    cambiar('muerte');
  }

  // ---------- Dibujo por estado ----------
  // La vista 3D y el HUD del laberinto se dibujan en 32 bits directo en la pantalla.
  // Las demás pantallas todavía usan el diseño de 320×180 y van en la capa de interfaz.
  function animar(t) {
    W.luces.actualizar(t);
    W.texturas.actualizar(t, W.luces.fases);
  }
  function dibujarMundo(conBarra) {
    animar(nivel.tiempo);
    W.raycaster.render(ctx, nivel.jug, nivel.mapa, nivel.sprites(), nivel.conos);
    if (conBarra !== false) W.HUD.barra(ctx, nivel, partida, tactil());
  }
  function dibujarFondo() {
    animar(tiempo);
    W.raycaster.render(ctx, fondo.jug, fondo.mapa, fondo.sprites(), null);
    ctx.fillStyle = PAL.fondo; ctx.fillRect(0, PA.VISTA_ALTO, PA.ANCHO, PA.HUD_ALTO);
  }
  function pantallaNegra() { ctx.fillStyle = PAL.fondo; ctx.fillRect(0, 0, PA.ANCHO, PA.ALTO); }

  function dibujar(dt) {
    const t = tactil();
    switch (estado) {
      case 'titulo':
        dibujarFondo();
        capa(function (g) {
          W.Menus.titulo(g, tiempo, menuTitulo);
          if (avisoTitulo) W.HUD.textoConCaja(g, avisoTitulo, C.ANCHO / 2, 158, PAL.rojo, PAL.rojo);
        });
        break;
      case 'historia': pantallaNegra(); capa(function (g) { W.Menus.historia(g, tEstado, t); }); break;
      case 'seleccion': pantallaNegra(); capa(function (g) { W.Menus.Seleccion.dibujar(g, tiempo); }); break;
      case 'redMenu':
        dibujarFondo();
        capa(function (g) {
          g.fillStyle = 'rgba(7,6,13,0.7)'; g.fillRect(0, 0, C.ANCHO, C.ALTO);
          W.HUD.texto(g, 'MULTIJUGADOR', C.ANCHO / 2, 30, PAL.magenta, 2, 'centro');
          W.HUD.texto(g, 'JUEGAS CON ' + W.PERSONAJES[RED.personaje].nombre + '. COOPERATIVO O VERSUS, HASTA 4 POR INTERNET', C.ANCHO / 2, 50, PAL.gris, 1, 'centro');
          menuRed.dibujar(g);
          if (RED.error) W.HUD.texto(g, RED.error, C.ANCHO / 2, 160, PAL.rojo, 1, 'centro');
        });
        break;
      case 'redCodigo': pantallaNegra(); capa(function (g) { W.MenuRed.Codigo.dibujar(g, tiempo); }); break;
      case 'redLobby': pantallaNegra(); capa(function (g) { W.MenuRed.Sala.dibujar(g, tiempo); }); break;
      case 'jugando':
        dibujarMundo(false);
        W.HUD.dibujar(ctx, nivel, partida, dt, t);
        W.HUD.cartel(ctx, nivel.def, tCartel);
        if (!t && !W.Entrada.bloqueado && !W.Entrada.modoArrastre && tCartel > 0.5) {
          W.HUD.textoConCaja32(ctx, 'CLIC PARA CAPTURAR EL MOUSE', PA.ANCHO / 2, 168, PAL.amarilloClaro, PAL.amarillo);
        }
        break;
      case 'puzzle':
        if (puzzleCtx && puzzleCtx.volverA === 'sala2d' && sala) { pantallaNegra(); capa(function (g) { sala.dibujar(g); if (puzzle) puzzle.dibujar(g); }); }
        else { if (nivel) dibujarMundo(); else pantallaNegra(); capa(function (g) { if (puzzle) puzzle.dibujar(g); }); }
        break;
      case 'verPista': dibujarMundo(); capa(function (g) { W.Menus.verPista(g, pistaVista, t); }); break;
      case 'mapa': pantallaNegra(); capa(function (g) { W.MapaUI.dibujar(g, nivel, tiempo); }); break;
      case 'libreta': pantallaNegra(); capa(function (g) { W.Libreta.dibujar(g, partida); }); break;
      case 'pausa':
        if (volverDe === 'sala2d' && sala) { pantallaNegra(); capa(function (g) { sala.dibujar(g); W.Menus.pausa(g, menuPausa); }); }
        else { dibujarMundo(); capa(function (g) { W.Menus.pausa(g, menuPausa); }); }
        break;
      case 'sala2d':
        pantallaNegra();
        capa(function (g) { sala.dibujar(g); W.HUD.dibujar2d(g, sala, partida, dt, t); });
        break;
      case 'muerte':
        if (sala) { pantallaNegra(); capa(function (g) { sala.dibujar(g); W.Menus.muerte(g, tEstado, t); }); }
        else { dibujarMundo(); capa(function (g) { W.Menus.muerte(g, tEstado, t); }); }
        break;
      case 'nivelCompleto': dibujarMundo(); capa(function (g) { W.Menus.nivelCompleto(g, tEstado, nivel.def, partida, t); }); break;
      case 'final': pantallaNegra(); capa(function (g) { W.Menus.final(g, tEstado, partida ? partida.personaje : 'chispa', partida || W.Partida.nueva('chispa'), t); }); break;
      case 'progreso': pantallaNegra(); capa(function (g) { W.Progreso.dibujar(g, tiempo); }); break;
      case 'vsFin': pantallaNegra(); capa(function (g) { W.HUD.resultadosVs(g, vsResultado, tEstado, t, RED.puesto); }); break;
    }
  }

  // ---------- Calidad automática (de DuMulti) ----------
  // Si durante 3 segundos de juego el promedio baja de ~45 cuadros por segundo,
  // el piso y el techo pasan a calcularse cada 2 píxeles. Tecla C: cambiar a mano.
  let medidaT = 0, medidaN = 0, calidadManual = false;
  function fijarCalidad(c, manual) {
    W.raycaster.calidad = c;
    if (manual) calidadManual = true;
    W.HUD.mostrar('CALIDAD ' + (c === 'alta' ? 'ALTA' : 'MEDIA (MAS RAPIDO)'), 2);
  }
  function vigilarRendimiento(dt) {
    if (estado !== 'jugando' || calidadManual || W.raycaster.calidad !== 'alta') return;
    medidaT += dt; medidaN++;
    if (medidaT >= 3) {
      if (medidaN / medidaT < 45) fijarCalidad('media', false);
      medidaT = 0; medidaN = 0;
    }
  }

  // ---------- Bucle ----------
  function bucle(ahora) {
    // (el primer cuadro puede traer una marca de tiempo anterior: nunca negativo)
    let dt = Math.max(0, (ahora - ultimo) / 1000);
    ultimo = ahora;
    if (dt > 0.05) dt = 0.05;
    tiempo += dt;
    tEstado += dt;

    procesar(W.Entrada.sacarEventos(), W.Entrada.sacarClics());
    const entrada = W.Entrada.leer(dt);
    actualizar(dt, entrada);
    dibujar(dt);
    vigilarRendimiento(dt);

    // Contador de cuadros por segundo (tecla P)
    cuadros++; acumFps += dt;
    if (acumFps >= 0.5) { fps = Math.round(cuadros / acumFps); cuadros = 0; acumFps = 0; }
    if (mostrarFps) W.HUD.texto(ctx, fps + ' FPS ' + (W.raycaster.calidad === 'alta' ? '' : '(MEDIA)'), 4, 4, '#7ff3ff');

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
    get sala() { return sala; }, get puzzle() { return puzzle; }, get marcador() { return marcador; }, red: RED,
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

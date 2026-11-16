// =====================================================
// Sesión multijugador (cooperativo, fase 10a)
//
// Modelo: el ANFITRIÓN (quien crea la partida) simula los enemigos y reparte el
// estado ~15 veces por segundo. Cada jugador mueve a su propio personaje y avisa
// sus acciones como "eventos" (abrir puerta, aturdir, sellar, sala 2D, rescate...).
//
// Mensajes:
//   cliente → anfitrión : hola, yo (posición), evento
//   anfitrión → cliente : bienvenido, lobby, rechazo, iniciar, estado, evento, danio
//
// main.js se conecta con W.Red.al = { iniciar, estado, evento, danio, desconectado, lobby }
// =====================================================
(function () {
  'use strict';
  const CR = W.configRed;

  const R = {
    activo: false,        // hay una sesión abierta
    rol: null,            // 'anfitrion' | 'cliente'
    codigo: '',
    puesto: 0,            // 0 = anfitrión, 1..3 = clientes
    personaje: 'chispa',
    jugadores: [],        // [{ puesto, personaje }]
    nivelElegido: 1,
    enJuego: false,
    estado: '',           // texto para la sala de espera
    error: '',
    al: {}
  };

  let tr = null;           // transporte en uso
  let clientes = {};       // anfitrión: idConexion → puesto
  let ultimoDe = {};       // anfitrión: idConexion → momento del último mensaje
  let ultimoAnfitrion = 0; // cliente: momento del último mensaje del anfitrión
  const SILENCIO = 6000;   // ms sin mensajes = jugador desconectado (pestaña cerrada, sin señal...)
  let acum = 0;
  let temporizador = null;

  function transporte() {
    const t = W.Transporte[CR.transporte] || W.Transporte.peer;
    return t;
  }
  function codigoAzar() { return String(10000 + Math.floor(Math.random() * 90000)); }
  function textoError(tipo) {
    switch (tipo) {
      case 'peer-unavailable': return 'NO HAY UNA PARTIDA CON ESE CODIGO';
      case 'network': case 'server-error': case 'socket-error': case 'socket-closed': return 'SIN CONEXION CON EL SERVIDOR. REVISA TU INTERNET';
      case 'browser-incompatible': return 'ESTE NAVEGADOR NO PERMITE JUEGO EN RED';
      case 'webrtc': return 'NO SE PUDO CONECTAR DIRECTO (PUEDE HACER FALTA UN SERVIDOR TURN)';
      case 'tiempo': return 'TIEMPO AGOTADO AL CONECTAR (REVISA EL CODIGO O LA RED)';
      default: return 'ERROR DE RED: ' + String(tipo).toUpperCase();
    }
  }
  function reiniciar() {
    R.activo = false; R.rol = null; R.codigo = ''; R.puesto = 0;
    R.jugadores = []; R.enJuego = false; R.estado = ''; R.error = '';
    clientes = {}; ultimoDe = {}; acum = 0;
    if (temporizador) { clearTimeout(temporizador); temporizador = null; }
  }

  // ===================== ANFITRIÓN =====================
  R.crear = function (personaje) {
    R.salir();
    if (!transporte().disponible()) { R.error = textoError('browser-incompatible'); return; }
    R.rol = 'anfitrion'; R.personaje = personaje; R.puesto = 0;
    R.jugadores = [{ puesto: 0, personaje: personaje }];
    R.estado = 'CONECTANDO CON EL SERVIDOR...';
    let intentos = 0;
    (function intentar() {
      R.codigo = codigoAzar();
      const propio = tr = transporte().anfitrion(CR.PREFIJO + R.codigo, {
        listo: function () { if (tr !== propio) return; R.activo = true; R.estado = 'ESPERANDO JUGADORES'; R.error = ''; },
        conexion: function () { /* espera el "hola" */ },
        mensaje: function (id, m) { if (tr === propio) recibirAnfitrion(id, m); },
        desconexion: function (id) { if (tr === propio) quitarCliente(id); },
        error: function (tipo) {
          if (tr !== propio) return;
          if (tipo === 'unavailable-id' && intentos++ < 5) { propio.cerrar(); intentar(); return; }
          if (tipo === 'peer-unavailable') return;   // un cliente que ya no existe: se ignora
          R.error = textoError(tipo);
        }
      });
    })();
  };

  function recibirAnfitrion(id, m) {
    if (!m || !m.t) return;
    ultimoDe[id] = performance.now();
    if (m.t === 'hola') {
      if (R.enJuego) { tr.enviar(id, { t: 'rechazo', motivo: 'LA PARTIDA YA COMENZO' }); return; }
      let puesto = -1;
      for (let p = 1; p < CR.MAX_JUGADORES; p++) if (!R.jugadores.some(function (j) { return j.puesto === p; })) { puesto = p; break; }
      if (puesto < 0) { tr.enviar(id, { t: 'rechazo', motivo: 'LA SALA ESTA LLENA' }); return; }
      clientes[id] = puesto;
      R.jugadores.push({ puesto: puesto, personaje: m.personaje });
      tr.enviar(id, { t: 'bienvenido', puesto: puesto });
      difundirLobby();
      if (W.Audio) W.Audio.sfx('pista');
      return;
    }
    const puesto = clientes[id];
    if (puesto === undefined) return;
    if (m.t === 'yo') { if (R.al.yo) R.al.yo(puesto, m); return; }
    if (m.t === 'evento') {
      tr.difundir({ t: 'evento', e: m.e }, id);    // reenvía a los demás clientes
      if (R.al.evento) R.al.evento(m.e, puesto);
    }
  }

  function quitarCliente(id) {
    const puesto = clientes[id];
    if (puesto === undefined) return;
    delete clientes[id];
    delete ultimoDe[id];
    R.jugadores = R.jugadores.filter(function (j) { return j.puesto !== puesto; });
    difundirLobby();
    if (R.al.salio) R.al.salio(puesto);
  }

  function difundirLobby() {
    if (tr && R.rol === 'anfitrion') tr.difundir({ t: 'lobby', jugadores: R.jugadores, nivel: R.nivelElegido });
    if (R.al.lobby) R.al.lobby();
  }
  R.cambiarNivel = function (d) {
    R.nivelElegido = Math.max(1, Math.min(12, R.nivelElegido + d));
    difundirLobby();
  };

  // El anfitrión comienza la partida
  R.iniciar = function () {
    if (R.rol !== 'anfitrion' || !R.activo) return;
    R.enJuego = true;
    const semilla = (Math.random() * 1e9) | 0;
    tr.difundir({ t: 'iniciar', nivel: R.nivelElegido, semilla: semilla, jugadores: R.jugadores });
    if (R.al.iniciar) R.al.iniciar(R.nivelElegido, semilla);
  };

  // Daño a un cliente concreto (lo calcula el anfitrión)
  R.danioA = function (puesto, d) {
    if (R.rol !== 'anfitrion') return;
    for (const id in clientes) if (clientes[id] === puesto) tr.enviar(id, { t: 'danio', d: d });
  };

  // ===================== CLIENTE =====================
  R.unirse = function (codigo, personaje) {
    R.salir();
    if (!transporte().disponible()) { R.error = textoError('browser-incompatible'); return; }
    R.rol = 'cliente'; R.personaje = personaje; R.codigo = codigo;
    R.estado = 'BUSCANDO LA PARTIDA ' + codigo + '...';
    const propio = tr = transporte().cliente(CR.PREFIJO + codigo, {
      listo: function () {
        if (tr !== propio) return;
        R.activo = true; R.estado = 'CONECTADO. ESPERANDO AL ANFITRION...';
        if (temporizador) { clearTimeout(temporizador); temporizador = null; }
        ultimoAnfitrion = performance.now();
        tr.enviar({ t: 'hola', personaje: personaje });
      },
      mensaje: function (m) { if (tr === propio) recibirCliente(m); },
      desconexion: function () {
        if (tr !== propio) return;
        const enJuego = R.enJuego;
        R.salir();
        R.error = 'EL ANFITRION SE DESCONECTO';
        if (R.al.desconectado) R.al.desconectado(R.error, enJuego);
      },
      error: function (tipo) { if (tr === propio) { R.error = textoError(tipo); R.estado = ''; } }
    });
    temporizador = setTimeout(function () {
      if (tr === propio && !R.activo) { R.error = textoError('tiempo'); R.estado = ''; propio.cerrar(); tr = null; }
    }, CR.TIEMPO_CONEXION * 1000);
  };

  function recibirCliente(m) {
    if (!m || !m.t) return;
    ultimoAnfitrion = performance.now();
    switch (m.t) {
      case 'bienvenido': R.puesto = m.puesto; break;
      case 'lobby': R.jugadores = m.jugadores; R.nivelElegido = m.nivel; if (R.al.lobby) R.al.lobby(); break;
      case 'rechazo': R.salir(); R.error = m.motivo; break;
      case 'iniciar':
        R.enJuego = true; R.jugadores = m.jugadores;
        if (R.al.iniciar) R.al.iniciar(m.nivel, m.semilla);
        break;
      case 'estado': if (R.al.estado) R.al.estado(m); break;
      case 'evento': if (R.al.evento) R.al.evento(m.e); break;
      case 'danio': if (R.al.danio) R.al.danio(m.d); break;
    }
  }

  // ===================== COMÚN =====================
  // Un cambio hecho por el jugador local (puerta, aturdir, sellar...)
  R.evento = function (e) {
    if (!tr || !R.activo) return;
    if (R.rol === 'anfitrion') tr.difundir({ t: 'evento', e: e });
    else tr.enviar({ t: 'evento', e: e });
  };

  // Llamar en cada cuadro durante la partida.
  //   armarEstado(): (anfitrión) mensaje 'estado' con todo
  //   miPosicion():  (cliente) { x, y, a, pe, v, vm, e }
  R.actualizar = function (dt, armarEstado, miPosicion) {
    if (!R.activo || !R.enJuego || !tr) return;
    // Detección de silencio (conexiones que se cortan sin avisar)
    const ahora = performance.now();
    if (R.rol === 'anfitrion') {
      for (const id in clientes) if (ahora - (ultimoDe[id] || ahora) > SILENCIO) { quitarCliente(id); }
    } else if (ahora - ultimoAnfitrion > SILENCIO) {
      R.salir();
      R.error = 'SE PERDIO LA CONEXION CON EL ANFITRION';
      if (R.al.desconectado) R.al.desconectado(R.error, true);
      return;
    }
    acum += dt;
    if (acum < 1 / CR.HZ) return;
    acum = 0;
    if (R.rol === 'anfitrion') { const m = armarEstado(); if (m) tr.difundir(m); }
    else { const m = miPosicion(); if (m) { m.t = 'yo'; tr.enviar(m); } }
  };

  R.salir = function () {
    if (tr) { try { tr.cerrar(); } catch (err) { /* nada */ } }
    tr = null;
    reiniciar();
  };
  window.addEventListener('beforeunload', function () { R.salir(); });

  R.esAnfitrion = function () { return R.rol === 'anfitrion'; };
  R.textoError = textoError;
  W.Red = R;
})();

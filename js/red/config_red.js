// =====================================================
// Configuración del multijugador
// =====================================================
W.configRed = {
  // Prefijo de los identificadores en el servidor de PeerJS (evita choques con otros juegos).
  // Cambia con cada versión del protocolo: jugadores con versiones distintas no se encuentran.
  PREFIJO: 'worodorox3073-v2-',
  // Mensajes de estado por segundo (anfitrión → clientes y clientes → anfitrión)
  HZ: 15,
  MAX_JUGADORES: 4,
  // Segundos que un jugador atrapado espera el rescate antes de reaparecer en su estación
  TIEMPO_RESCATE: 45,
  // Segundos de espera al unirse antes de dar error
  TIEMPO_CONEXION: 15,

  // Modos de juego que elige el anfitrión en la sala de espera
  MODOS: ['coop', 'carrera', 'combate'],
  NOMBRE_MODO: { coop: 'COOPERATIVO', carrera: 'VERSUS: CARRERA', combate: 'VERSUS: COMBATE' },
  DESCRIPCION_MODO: {
    coop: 'JUNTOS: PUERTAS, ENEMIGOS Y DUCTOS COMPARTIDOS',
    carrera: 'GANA QUIEN LLEGUE PRIMERO A LA SALIDA',
    combate: 'TODOS CONTRA TODOS: GANA QUIEN LOGRE 5 VICTORIAS'
  },

  // ---------- Versus ----------
  VS: {
    // Daño del arma básica contra un rival, según el personaje
    DANIO: { chispa: 1, tuerca: 3, lata: 2, flaco: 1, varilla: 2 },
    // Poderes de cada modo (teclas 1, 2, 3, 4 en ese orden). El escudo va aparte (tecla R).
    PODERES: { carrera: ['emp', 'hackeo', 'mina', 'dron'], combate: ['emp', 'mina'] },
    NOMBRE_PODER: { emp: 'EMP', hackeo: 'HACKEO', mina: 'MINA', dron: 'DRON', escudo: 'ESCUDO' },
    // Segundos de recarga entre usos
    RECARGA: { emp: 14, hackeo: 25, mina: 6, dron: 30, escudo: 15 },
    ESCUDO_SEG: 4,        // duración del escudo
    EMP_RADIO: 4.5,       // casillas
    EMP_SEG: 2.5,         // segundos que el rival queda aturdido
    HACKEO_DIST: 8,       // distancia máxima al rival para hackearlo
    HACKEO_TIEMPO: 25,    // segundos del minijuego de hackeo
    MINA_DANIO: 0.2,      // fracción de la vida total del personaje (daño fijo)
    MINAS_MAX: 3,         // minas activas por jugador
    MINA_VISIBLE: 2.5,    // distancia a la que un rival alcanza a ver una mina ajena
    DRON_SEG: 14,         // vida del dron cazador liberado contra un rival
    VICTORIAS: 5,         // combate: victorias para ganar
    REAPARECER_SEG: 3,    // combate: segundos antes de volver a la arena
    INVULNERABLE_REAPARECER: 2,
    RECOMPENSA_VIDA: 3,   // vida que gana quien derrota a un rival
    BOTIQUIN_REAPARECE: 25 // combate: segundos para que vuelva un botiquín usado
  },

  // 'peer' = por internet con PeerJS | 'local' = entre pestañas del mismo computador (para probar).
  // También se puede elegir con la dirección: index.html?red=local
  transporte: /[?&]red=local/.test(location.search) ? 'local' : 'peer',

  // Servidores ICE para atravesar routers.
  // STUN sirve en la mayoría de las casas. Si alguien no logra conectarse (datos móviles,
  // algunas redes de empresas o colegios), agrega aquí un servidor TURN con sus credenciales:
  //   { urls: 'turn:servidor.ejemplo.com:3478', username: 'usuario', credential: 'clave' }
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

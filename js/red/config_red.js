// =====================================================
// Configuración del multijugador
// =====================================================
W.configRed = {
  // Prefijo de los identificadores en el servidor de PeerJS (evita choques con otros juegos)
  PREFIJO: 'worodorox3073-v1-',
  // Mensajes de estado por segundo (anfitrión → clientes y clientes → anfitrión)
  HZ: 15,
  MAX_JUGADORES: 4,
  // Segundos que un jugador atrapado espera el rescate antes de reaparecer en su estación
  TIEMPO_RESCATE: 45,
  // Segundos de espera al unirse antes de dar error
  TIEMPO_CONEXION: 15,

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

// =====================================================
// NIVEL 1 - DESPERTAR (Zona 1: Criogenia)
// Enseña: puertas con puzzle, holograma → puerta magenta, sellar un enemigo,
// estación de respaldo y ducto amarillo (sala 2D) → tarjeta.
//
// Leyenda de los mapas del laberinto:
//   # panel   N neón   T tuberías   C decoración de la zona   Y ducto 2D
//   S estación de respaldo   X salida   B núcleo de la IA   @ inicio
//   1-9 puertas (definidas en "leyenda")   a b c f i j m n hologramas con pista
//   d dron horizontal   D dron vertical   p perseguidor   u guardián
//   e piso eléctrico   l láser   k aplastador   g gas   < > ^ v descompresión
//   Q O A baldosas (cuadrado, círculo, triángulo)   h botiquín
// Leyenda de las salas 2D: ver js/motor2d/plataformas.js
// =====================================================
W.niveles = W.niveles || {};

W.niveles[1] = {
  id: 1,
  zona: 1,
  nombre: 'DESPERTAR',
  historia: 'LAS CAPSULAS SE ABREN SOLAS. LA NAVE CRUJE. HAY QUE SALIR DE AQUI.',
  mapa: [
    '####################',
    '#C.C#........d.....#',
    '#...1.###.########.#',
    '#.@.#.#....#######.#',
    '#C.C#.#....a######3#',
    '###N#.#....#######.#',
    '#.....##S#########.#',
    '#.###.......u......#',
    '#.#h#.##Y#########.#',
    '#.#.#.############2#',
    '#...#.########.....#',
    '#####.########.....#',
    '#.....######.4.....#',
    '############X#######'
  ],
  inicio: { ang: 0 },
  leyenda: {
    a: { pista: 'p1' },
    1: { puzzle: 'serie', dificultad: 1 },
    2: { puzzle: 'matriz', pista: 'p1', riesgo: true, dificultad: 1 },
    3: { puzzle: 'asociacion', dificultad: 1 },
    4: { objeto: 'TARJETA AZUL' }
  },
  pistas: {
    p1: { tipo: 'matriz', dificultad: 1 }
  },
  sala: {
    nombre: 'DUCTO DE VENTILACION',
    texto: 'SALTA ENTRE LAS PLATAFORMAS Y TOMA LA TARJETA AZUL',
    objeto: 'TARJETA AZUL',
    mapa: [
      '########################################',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#..........................K...........#',
      '#.......................------.........#',
      '#......................................#',
      '#...................---................#',
      '#......................................#',
      '#...............---...................E#',
      '#P.........h................F....x....E#',
      '#####...#######...######...#############',
      '#####^^^#######^^^######^^^#############',
      '########################################'
    ]
  }
};

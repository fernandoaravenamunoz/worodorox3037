// =====================================================
// NIVEL 9 - NUCLEO EXTERIOR (Zona 3: Nucleo de la IA)
// Plano: laberinto del nucleo exterior
// Leyenda de los mapas: ver nivel01.js. Validar con: node scripts/validar-niveles.js
// =====================================================
W.niveles = W.niveles || {};

W.niveles[9] = {
  id: 9,
  zona: 3,
  nombre: 'NUCLEO EXTERIOR',
  historia: 'LAS ULTIMAS DEFENSAS ANTES DEL HANGAR. LA IA YA SABE TU NOMBRE.',
  mapa: [
    '#############X##########',
    '#@#.f.......#.....l.5.##',
    '#.#.#.#S#1#.###.#####.##',
    '#.#.....a.#...#...#.#k##',
    '#.#######.###e###.#.#.##',
    '#.........#.c.#...#.#e##',
    '###.C.#####.#2#.###.#.##',
    '#.........#...#...#.#.##',
    '#.#######.#.C.###.#.#.##',
    '#...#.....#p..#.#...#.##',
    '###.#.#######.#.#.###.##',
    '#.S...#.b..d..#...#.4.##',
    '#.#####.#.#########D#.##',
    '#....h....3........k#.Y#',
    '########################'
  ],
  inicio: { ang: Math.PI / 2 },
  leyenda: {
    a: { pista: 'p1', parte: 1 },
    f: { pista: 'p1', parte: 2 },
    b: { pista: 'p2' },
    c: { pista: 'p3' },
    '1': { puzzle: 'asociacion', dificultad: 3 },
    '2': { puzzle: 'codigo', dificultad: 3, pista: 'p1', riesgo: true },
    '3': { puzzle: 'matriz', dificultad: 3, pista: 'p2' },
    '4': { puzzle: 'deslizante', dificultad: 3 },
    '5': { objeto: 'CODIGO MAESTRO' }
  },
  pistas: {
    p1: { tipo: 'codigo', dificultad: 3, partes: 2 },   // pista compuesta: hologramas a y f
    p2: { tipo: 'matriz', dificultad: 3 },
    p3: { tipo: 'simon', dificultad: 3 }
  },
  sala: {
    nombre: 'CAMARA DE PRUEBAS',
    texto: 'CAJAS, PLACAS E INTERRUPTORES: LA IA TE PONE A PRUEBA',
    objeto: 'CODIGO MAESTRO',
    terminal: { pista: 'p3' },
    mapa: [
      '################################################',
      '#...............#........................#.....#',
      '#...............#........................#.....#',
      '#...............#........................#.....#',
      '#...............#........................#.....#',
      '#...............#........................#.....#',
      '#...............#........................#.....#',
      '#...............#........................#.....#',
      '#...............#........................#.....#',
      '#...............#...................K....#.....#',
      '#...............g.................####...G.....#',
      '#...............g....s............####...G....E#',
      '#P....C.....o...g..F..........C.T.####...G..x.E#',
      '#######################bbbbb####################',
      '#######################^^^^^####################',
      '################################################'
    ]
  }
};

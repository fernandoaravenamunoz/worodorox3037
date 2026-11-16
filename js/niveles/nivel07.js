// =====================================================
// NIVEL 7 - SERVIDORES (Zona 3: Nucleo de la IA)
// Plano: laberinto de servidores
// Leyenda de los mapas: ver nivel01.js. Validar con: node scripts/validar-niveles.js
// =====================================================
W.niveles = W.niveles || {};

W.niveles[7] = {
  id: 7,
  zona: 3,
  nombre: 'SERVIDORES',
  historia: 'EL ZUMBIDO DE LA IA VIENE DE TODAS PARTES. LOS SERVIDORES TE OBSERVAN.',
  mapa: [
    '#########X##############',
    '#@..#.....#...d...#...##',
    '###.###.###5###.#.###.##',
    '#.b...#.l...#...#.....##',
    '#.###.#.#####.#######.##',
    '#.#...#.....#...4...#.##',
    '#.#.#####.C.#######.#.##',
    '#.#.....#.....S.....#.Y#',
    '#.#####1#####.#.C.######',
    '#....h#.#.....c..ll...##',
    '#.#.#.#.#############2##',
    '#.#.#.S...#...#...d.#.##',
    '#.#.#####.#.#.#.###.#.##',
    '#.f........l#.3.a.....##',
    '########################'
  ],
  inicio: { ang: 0 },
  leyenda: {
    a: { pista: 'p1' },
    b: { pista: 'p2', parte: 1 },
    f: { pista: 'p2', parte: 2 },
    c: { pista: 'p3' },
    '1': { puzzle: 'serie', dificultad: 3 },
    '2': { puzzle: 'matriz', dificultad: 3, pista: 'p1', riesgo: true },
    '3': { puzzle: 'codigo', dificultad: 2, pista: 'p2' },
    '4': { puzzle: 'deslizante', dificultad: 3 },
    '5': { objeto: 'CHIP DE MEMORIA' }
  },
  pistas: {
    p1: { tipo: 'matriz', dificultad: 3 },
    p2: { tipo: 'codigo', dificultad: 2, partes: 2 },   // pista compuesta: hologramas b y f
    p3: { tipo: 'simon', dificultad: 2 }
  },
  sala: {
    nombre: 'RACK DE MEMORIA',
    texto: 'ROMPE CAJAS, DERRIBA BICHOS Y GOLPEA EL INTERRUPTOR',
    objeto: 'CHIP DE MEMORIA',
    terminal: { pista: 'p3' },
    mapa: [
      '############################################',
      '#.....................................#....#',
      '#.....................................#....#',
      '#.....................................#....#',
      '#.....................................#....#',
      '#.....................................#....#',
      '#.....................................#....#',
      '#.....................................#....#',
      '#.....................a...............#....#',
      '#................s....a...........K...#....#',
      '#.......B......----...a.........----..G....#',
      '#.......B.............a.......R.......G...E#',
      '#P......B...x.........a.F..x..Rh.T....G...E#',
      '############################################',
      '############################################',
      '############################################'
    ]
  }
};

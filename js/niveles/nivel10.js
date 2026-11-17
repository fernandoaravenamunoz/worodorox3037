// =====================================================
// NIVEL 10 - HANGAR (Zona 4: Hangar)
// Plano: gran hangar con bahias de lanzamiento
// Leyenda de los mapas: ver nivel01.js. Validar con: node scripts/validar-niveles.js
// La puerta 3 es de doble palanca: sus palancas P estan en la bahia sureste.
// =====================================================
W.niveles = W.niveles || {};

W.niveles[10] = {
  id: 10,
  zona: 4,
  nombre: 'HANGAR',
  historia: 'POR EL VENTANAL SE VEN LAS NAVES SALVAVIDAS. TAN CERCA.',
  mapa: [
    '########################',
    '#....1............#....#',
    '#.@..##a#######.###....X',
    '#....#............#....#',
    '#....#......d.....#....#',
    '######..N..N..N...##4###',
    '#....#............#.l..#',
    '#....#............#.l..S',
    'S....#..b..N..N...#....#',
    '#.................##3###',
    '#....#..........^^P....#',
    'Y....#..N..f..N...2u.<.#',
    '#....#..........vv#>...P',
    '#h...##C##C##C##C##....#',
    '########################'
  ],
  inicio: { ang: 0 },
  leyenda: {
    a: { pista: 'p1', parte: 1 },
    f: { pista: 'p1', parte: 2 },
    b: { pista: 'p2' },
    '1': { puzzle: 'serie', dificultad: 3 },
    '2': { puzzle: 'simon', dificultad: 3, pista: 'p1', riesgo: true },
    '3': { palancas: true },                 // puerta de doble palanca
    '4': { objeto: 'LLAVE DE HANGAR' }
  },
  pistas: {
    p1: { tipo: 'simon', dificultad: 3, partes: 2 },   // pista compuesta: hologramas a y f
    p2: { tipo: 'codigo', dificultad: 3 }
  },
  sala: {
    nombre: 'RIELES DEL HANGAR',
    texto: 'PLATAFORMAS SOBRE EL VACIO. NO MIRES ABAJO',
    objeto: 'LLAVE DE HANGAR',
    terminal: { pista: 'p2' },
    mapa: [
      '################################################',
      '#..........................................#...#',
      '#..........................................#...#',
      '#.............................##...K.......#...#',
      '#................................####......#...#',
      '#..........................................#...#',
      '#..........................................#...#',
      '#....................................--....#...#',
      '#..........................................#...#',
      '#..........................................#...#',
      '#..........................................G...#',
      '#..........................................G..E#',
      '#P..............F.............v..........T.G..E#',
      '######...m......##....m.....##.........#########',
      '######^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^#########',
      '################################################'
    ]
  }
};

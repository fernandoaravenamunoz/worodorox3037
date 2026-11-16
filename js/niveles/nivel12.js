// =====================================================
// NIVEL 12 - NUCLEO DE LA IA (Zona 4: Hangar)
// Plano: hangar invertido hacia el nucleo
// Leyenda de los mapas: ver nivel01.js. Validar con: node scripts/validar-niveles.js
// =====================================================
W.niveles = W.niveles || {};

W.niveles[12] = {
  id: 12,
  zona: 4,
  nombre: 'NUCLEO DE LA IA',
  historia: 'LA NAVE SALVAVIDAS ESTA LISTA. SOLO FALTA APAGAR A QUIEN LA CONTROLA.',
  mapa: [
    '########################',
    '#h...##C##C##C##C##....#',
    '#....a............#....#',
    'Y....#..N..N..N...2u...#',
    '#....#............#ggg.#',
    '#.................##3#f#',
    'S....#..b..N..N...#....#',
    '#....#............#.l..S',
    '#....#............#....#',
    '######..N..N..N...##4###',
    '#....#......d.....#....#',
    '#....#............#....#',
    '#.@..##c#######.###....B',
    '#....1............#....#',
    '########################'
  ],
  inicio: { ang: 0 },
  leyenda: {
    a: { pista: 'p1' },
    b: { pista: 'p2', parte: 1 },
    f: { pista: 'p2', parte: 2 },
    c: { pista: 'p3' },
    '1': { puzzle: 'luces', dificultad: 3 },
    '2': { puzzle: 'simon', dificultad: 2, pista: 'p3', riesgo: true },
    '3': { puzzle: 'asociacion', dificultad: 3 },
    '4': { objeto: 'NUCLEO DE ENERGIA' }
  },
  pistas: {
    p1: { tipo: 'matriz', dificultad: 3 },
    p2: { tipo: 'codigo', dificultad: 3, partes: 2 },   // pista compuesta (jefe final): hologramas b y f
    p3: { tipo: 'simon', dificultad: 2 }
  },
  jefe: {
    matriz: 'p1',
    codigo: 'p2'
  },
  sala: {
    nombre: 'SALA DE CONTROL',
    texto: 'LA ULTIMA SALA DE MANTENIMIENTO. TODO LO APRENDIDO SIRVE AQUI',
    objeto: 'NUCLEO DE ENERGIA',
    terminal: { pista: 'p3' },
    mapa: [
      '####################################################',
      '#....................#.........................#...#',
      '#....................#.........................#...#',
      '#....................#.........................#...#',
      '#....................#.........................#...#',
      '#....................#.........................#...#',
      '#....................#.........................#...#',
      '#....................#....................K....#...#',
      '#....................#...................---...#...#',
      '#........a...........#.........................#...#',
      '#........a...........g................---......G...#',
      '#....s...a...........g.........................G..E#',
      '#P.......a..C....o...g.F............x.......T..G..E#',
      '#########################bb.m......#################',
      '#########################^^^^^^^^^^#################',
      '####################################################'
    ]
  }
};

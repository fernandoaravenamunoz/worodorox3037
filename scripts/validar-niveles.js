// =====================================================
// Validador de niveles de Worodorox 3073 (se ejecuta con Node.js)
//   node scripts/validar-niveles.js          → revisa los 12 niveles
//   node scripts/validar-niveles.js 3 -v     → revisa el nivel 3 y muestra el recorrido
//
// Comprueba:
//  - leyenda completa (cada puerta y holograma definidos, cada pista existe)
//  - pistas compuestas ({ partes: 2 }): cada parte tiene su holograma y el tipo se puede dividir
//  - que el nivel se pueda terminar: simula el avance abriendo puertas solo
//    cuando su pista ya se vio COMPLETA (todas sus partes) y su objeto ya se obtuvo en la sala 2D
//  - que cada pista se use LEJOS de donde aparece (y que las partes estén lejos entre sí)
//  - cantidades sugeridas: 3-5 puertas con puzzle, 1 sala 2D, 1-2 enemigos, 1-2 estaciones
//  - la sala 2D: inicio, salida, objeto, terminal y alcanzabilidad aproximada
// =====================================================
'use strict';
const fs = require('fs');
const path = require('path');

// Simula el objeto global W lo suficiente para cargar los archivos de nivel
global.W = { niveles: {} };
global.window = global;
const dirNiveles = path.join(__dirname, '..', 'js', 'niveles');
for (let n = 1; n <= 12; n++) {
  const f = path.join(dirNiveles, 'nivel' + String(n).padStart(2, '0') + '.js');
  if (fs.existsSync(f)) eval(fs.readFileSync(f, 'utf8'));
}

const PARED = '#NTCYSXB';
const ENT = 'dDpuelkg<>^vQOAh@';
const HOLO = 'abcfijmn';
const DIVISIBLES = ['codigo', 'simon'];
const args = process.argv.slice(2);
const soloNivel = args.find(a => /^\d+$/.test(a));
const verbose = args.includes('-v');
let errores = 0, avisos = 0;

function error(n, msg) { errores++; console.log('  [ERROR] N' + n + ': ' + msg); }
function aviso(n, msg) { avisos++; console.log('  [aviso] N' + n + ': ' + msg); }

function validarNivel(def) {
  const n = def.id;
  const M = def.mapa, alto = M.length, ancho = M[0].length;
  const ley = def.leyenda || {}, pistas = def.pistas || {};
  M.forEach((f, y) => { if (f.length !== ancho) error(n, 'fila ' + y + ' mide ' + f.length + ' (se esperaba ' + ancho + ')'); });
  const ch = (x, y) => (x < 0 || y < 0 || x >= ancho || y >= alto) ? '#' : M[y][x];
  // Bordes cerrados
  for (let x = 0; x < ancho; x++) { if (!PARED.includes(ch(x, 0)) || !PARED.includes(ch(x, alto - 1))) error(n, 'borde abierto en columna ' + x); }
  for (let y = 0; y < alto; y++) { if (!PARED.includes(ch(0, y)) || !PARED.includes(ch(ancho - 1, y))) error(n, 'borde abierto en fila ' + y); }

  const puertas = [], hologramas = [], cuenta = { Y: 0, S: 0, X: 0, B: 0, enemigos: 0, inicio: null };
  for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) {
    const c = ch(x, y);
    if (c >= '1' && c <= '9') { if (!ley[c]) error(n, 'puerta ' + c + ' sin leyenda'); puertas.push({ c, x, y, d: ley[c] || {} }); }
    else if (HOLO.includes(c)) { if (!ley[c] || !ley[c].pista) error(n, 'holograma ' + c + ' sin pista en la leyenda'); hologramas.push({ c, x, y, d: ley[c] || {} }); }
    else if (c === '@') cuenta.inicio = { x, y };
    else if ('dDpu'.includes(c)) cuenta.enemigos++;
    else if (cuenta[c] !== undefined) cuenta[c]++;
    else if (!PARED.includes(c) && !ENT.includes(c) && c !== '.') error(n, 'carácter desconocido "' + c + '" en (' + x + ',' + y + ')');
  }
  if (!cuenta.inicio) { error(n, 'falta el inicio @'); return; }
  puertas.forEach(p => { if (p.d.pista && !pistas[p.d.pista]) error(n, 'la puerta ' + p.c + ' usa la pista inexistente ' + p.d.pista); });
  hologramas.forEach(h => { if (h.d.pista && !pistas[h.d.pista]) error(n, 'el holograma ' + h.c + ' usa la pista inexistente ' + h.d.pista); });
  if (def.baldosas && !pistas[def.baldosas.pista]) error(n, 'baldosas sin pista válida');

  // Pistas compuestas: cada parte con su holograma
  const partesDe = k => (pistas[k] && pistas[k].partes) || 1;
  for (const k in pistas) {
    const np = partesDe(k);
    const holos = hologramas.filter(h => h.d.pista === k);
    if (np > 1) {
      if (!DIVISIBLES.includes(pistas[k].tipo)) error(n, 'la pista ' + k + ' (' + pistas[k].tipo + ') no se puede dividir en partes');
      for (let j = 1; j <= np; j++) if (!holos.some(h => h.d.parte === j)) error(n, 'falta el holograma de la parte ' + j + ' de la pista ' + k);
      holos.forEach(h => { if (!h.d.parte || h.d.parte > np) error(n, 'el holograma ' + h.c + ' debe indicar parte 1..' + np); });
      for (let i = 0; i < holos.length; i++) for (let j = i + 1; j < holos.length; j++) {
        if (Math.abs(holos[i].x - holos[j].x) + Math.abs(holos[i].y - holos[j].y) < 6) aviso(n, 'las partes de la pista ' + k + ' están muy juntas');
      }
    } else {
      holos.forEach(h => { if (h.d.parte) error(n, 'el holograma ' + h.c + ' indica parte, pero la pista ' + k + ' no es compuesta'); });
    }
    if (!holos.length) aviso(n, 'la pista ' + k + ' no aparece en ningún holograma');
  }

  const conPuzzle = puertas.filter(p => p.d.puzzle).length;
  if (conPuzzle < 3 || conPuzzle > 5) aviso(n, conPuzzle + ' puertas con puzzle (se sugieren 3 a 5)');
  if (cuenta.Y !== 1) aviso(n, cuenta.Y + ' ductos 2D (se sugiere 1)');
  if (cuenta.S < 1 || cuenta.S > 2) aviso(n, cuenta.S + ' estaciones (se sugieren 1 o 2)');
  if (cuenta.enemigos < 1 || cuenta.enemigos > 3) aviso(n, cuenta.enemigos + ' enemigos (se sugieren 1 o 2)');
  if (!cuenta.X && !cuenta.B) error(n, 'no hay salida X ni núcleo B');

  // Puertas: deben estar entre dos casillas libres opuestas
  const esLibre3d = (x, y) => { const c = ch(x, y); return c === '.' || ENT.includes(c); };
  puertas.forEach(p => {
    if (!((esLibre3d(p.x - 1, p.y) && esLibre3d(p.x + 1, p.y)) || (esLibre3d(p.x, p.y - 1) && esLibre3d(p.x, p.y + 1)))) aviso(n, 'la puerta ' + p.c + ' no queda entre dos pasillos opuestos');
  });

  // Pista lejos de su puerta
  puertas.forEach(p => {
    if (!p.d.pista) return;
    hologramas.filter(h => h.d.pista === p.d.pista).forEach(h => {
      if (Math.abs(h.x - p.x) + Math.abs(h.y - p.y) < 4) aviso(n, 'la pista ' + p.d.pista + ' está muy cerca de su puerta ' + p.c);
    });
  });

  // ---------- Simulación del avance ----------
  const abiertas = new Set(), partesVistas = {}, objetos = new Set();
  const vista = k => !!partesVistas[k] && partesVistas[k].size >= partesDe(k);
  let salaHecha = false, alcanzaFin = false;
  const orden = [];
  let ultimaVis = new Set();
  const pasable = (x, y) => {
    const c = ch(x, y);
    if (c === '.' || ENT.includes(c)) return true;
    if (c >= '1' && c <= '9') return abiertas.has(c);
    if (c === 'Y') return salaHecha;
    return false;
  };
  for (let vuelta = 0; vuelta < 60; vuelta++) {
    const vis = new Set(), cola = [[cuenta.inicio.x, cuenta.inicio.y]];
    vis.add(cuenta.inicio.x + ',' + cuenta.inicio.y);
    while (cola.length) {
      const [x, y] = cola.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = (x + dx) + ',' + (y + dy);
        if (!vis.has(k) && pasable(x + dx, y + dy)) { vis.add(k); cola.push([x + dx, y + dy]); }
      }
    }
    ultimaVis = vis;
    const junto = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => vis.has((x + dx) + ',' + (y + dy)));
    let cambio = false;
    hologramas.forEach(h => {
      if (!junto(h.x, h.y) || !h.d.pista) return;
      const k = h.d.pista, parte = h.d.parte || 1;
      partesVistas[k] = partesVistas[k] || new Set();
      if (partesVistas[k].has(parte)) return;
      partesVistas[k].add(parte); cambio = true;
      orden.push('ve pista ' + k + (partesDe(k) > 1 ? ' parte ' + parte + '/' + partesDe(k) : '') + ' (' + h.c + ')');
    });
    for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) {
      if (ch(x, y) === 'Y' && !salaHecha && junto(x, y)) {
        const t = def.sala && def.sala.terminal;
        if (!t || !t.pista || vista(t.pista)) {
          salaHecha = true; cambio = true;
          if (def.sala && def.sala.objeto) objetos.add(def.sala.objeto);
          orden.push('supera la sala 2D' + (def.sala && def.sala.objeto ? ' y obtiene ' + def.sala.objeto : ''));
        }
      }
      if ((ch(x, y) === 'X' || ch(x, y) === 'B') && junto(x, y)) {
        if (ch(x, y) === 'B') {
          const j = def.jefe || {};
          if ((!j.matriz || vista(j.matriz)) && (!j.codigo || vista(j.codigo))) alcanzaFin = true;
        } else alcanzaFin = true;
      }
    }
    puertas.forEach(p => {
      if (abiertas.has(p.c) || !junto(p.x, p.y)) return;
      if (p.d.pista && !vista(p.d.pista)) return;
      if (p.d.objeto && !objetos.has(p.d.objeto)) return;
      abiertas.add(p.c); cambio = true;
      orden.push('abre puerta ' + p.c + ' (' + (p.d.puzzle || 'tarjeta') + (p.d.riesgo ? ', magenta' : '') + ')');
    });
    if (!cambio) break;
  }
  if (!alcanzaFin) error(n, 'no se puede llegar a la salida/núcleo');

  // Cada puerta debe ser un paso obligado: con todo lo demás abierto,
  // si se llega a ambos lados de la puerta sin cruzarla, se puede rodear.
  puertas.forEach(p => {
    const vis = new Set([cuenta.inicio.x + ',' + cuenta.inicio.y]), cola = [[cuenta.inicio.x, cuenta.inicio.y]];
    while (cola.length) {
      const [x, y] = cola.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny, c = ch(nx, ny);
        if (vis.has(k) || (nx === p.x && ny === p.y)) continue;
        if (c === '.' || ENT.includes(c) || (c >= '1' && c <= '9') || c === 'Y') { vis.add(k); cola.push([nx, ny]); }
      }
    }
    const lados = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => esLibre3d(p.x + dx, p.y + dy)).map(([dx, dy]) => vis.has((p.x + dx) + ',' + (p.y + dy)));
    if (lados.length >= 2 && lados.every(Boolean)) aviso(n, 'la puerta ' + p.c + ' se puede rodear por otro camino');
  });
  puertas.forEach(p => { if (!abiertas.has(p.c)) aviso(n, 'la puerta ' + p.c + ' nunca se puede abrir'); });
  if (cuenta.Y && !salaHecha) aviso(n, 'el ducto 2D nunca se alcanza (o falta su pista)');
  // Entidades encerradas (enemigos, trampas o botiquines a los que nunca se llega)
  for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) {
    if (ENT.includes(ch(x, y)) && !ultimaVis.has(x + ',' + y)) aviso(n, '"' + ch(x, y) + '" en (' + x + ',' + y + ') queda encerrado');
  }
  if (verbose) {
    console.log('  Recorrido N' + n + ':'); orden.forEach(o => console.log('    - ' + o));
    console.log('  Mapa (+ = alcanzable al final):');
    for (let y = 0; y < alto; y++) {
      let f = '';
      for (let x = 0; x < ancho; x++) f += ultimaVis.has(x + ',' + y) && M[y][x] === '.' ? '+' : M[y][x];
      console.log('    ' + f);
    }
  }

  if (def.sala) validarSala(n, def);
}

// ---------- Sala 2D: comprobación aproximada ----------
function validarSala(n, def) {
  const s = def.sala, M = s.mapa, alto = M.length, ancho = M[0].length;
  M.forEach((f, y) => { if (f.length !== ancho) error(n, 'sala: fila ' + y + ' mide ' + f.length + ' (se esperaba ' + ancho + ')'); });
  const ch = (x, y) => (x < 0 || x >= ancho || y < 0) ? '#' : y >= alto ? '.' : M[y][x];
  let P = null; const E = [], K = [], T = [];
  for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) {
    const c = ch(x, y);
    if (c === 'P') P = { x, y }; if (c === 'E') E.push({ x, y }); if (c === 'K') K.push({ x, y }); if (c === 'T') T.push({ x, y });
    if (!'#-^BRCmvsabogGTKhxFPE.'.includes(c)) error(n, 'sala: carácter desconocido "' + c + '"');
  }
  if (!P) error(n, 'sala: falta P');
  if (!E.length) error(n, 'sala: falta E');
  if (s.objeto && !K.length) error(n, 'sala: define objeto pero no hay K');
  if (s.terminal && !T.length) error(n, 'sala: define terminal pero no hay T');
  if (T.length && !s.terminal) error(n, 'sala: hay T pero no hay terminal en la definición');
  if (!P) return;
  // Apoyos: baldosas sólidas, plataformas, cajas y el recorrido de plataformas móviles
  const soporte = new Set();
  const solido = c => '#BRabgGC-'.includes(c);
  for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) {
    const c = ch(x, y);
    if (solido(c)) soporte.add(x + ',' + y);
    if (c === 'm') { let a = x, b = x; while (a > 0 && !solido(ch(a - 1, y))) a--; while (b < ancho - 1 && !solido(ch(b + 1, y))) b++; for (let i = a; i <= b; i++) soporte.add(i + ',' + y); }
    if (c === 'v') { let a = y, b = y; while (a > 0 && !solido(ch(x, a - 1))) a--; while (b < alto - 1 && !solido(ch(x, b + 1))) b++; for (let i = a; i <= b; i++) { soporte.add(x + ',' + i); soporte.add((x + 1) + ',' + i); soporte.add((x - 1) + ',' + i); } }
  }
  // De pie en (x, y): la casilla está libre y la de abajo sirve de apoyo
  const libre = (x, y) => !'#BR^C'.includes(ch(x, y));
  const dePie = (x, y) => libre(x, y) && soporte.has(x + ',' + (y + 1));
  const salto = s.saltoMax || 3;
  const vis = new Set([P.x + ',' + P.y]), cola = [[P.x, P.y]];
  while (cola.length) {
    const [x, y] = cola.shift();
    for (let dy = -salto; dy <= alto; dy++) for (let dx = -6; dx <= 6; dx++) {
      const nx = x + dx, ny = y + dy;
      if (ny < 0 || ny >= alto || nx < 0 || nx >= ancho) continue;
      if (Math.abs(dx) > 4 && dy < 4) continue;
      const k = nx + ',' + ny;
      if (vis.has(k) || !dePie(nx, ny)) continue;
      vis.add(k); cola.push([nx, ny]);
    }
  }
  const alcanza = (o) => [-1, 0, 1, 2].some(d => vis.has(o.x + ',' + (o.y + d)) || vis.has((o.x - 1) + ',' + (o.y + d)) || vis.has((o.x + 1) + ',' + (o.y + d)));
  if (E.length && !E.some(alcanza)) aviso(n, 'sala: la salida E podría no alcanzarse');
  K.forEach(k => { if (!alcanza(k)) aviso(n, 'sala: el objeto K podría no alcanzarse'); });
  T.forEach(t => { if (!alcanza(t)) aviso(n, 'sala: el terminal T podría no alcanzarse'); });
}

// ---------- Variedad: avisa si dos niveles usan el mismo plano ----------
function plano(def) {
  // Solo la geometría: paredes (#, N, T y decoración) frente a todo lo demás
  return def.mapa.map(f => f.replace(/[^#NTC]/g, '.').replace(/[NTC]/g, '#')).join('\n');
}
function validarVariedad(lista) {
  for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) {
    const a = plano(lista[i]), b = plano(lista[j]);
    if (a.length !== b.length) continue;
    let dif = 0;
    for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) dif++;
    if (dif / a.length < 0.12) aviso(lista[j].id, 'su plano es casi igual al del nivel ' + lista[i].id + ' (' + Math.round(100 * dif / a.length) + '% distinto)');
  }
}

const lista = Object.values(W.niveles).filter(d => !soloNivel || d.id === +soloNivel).sort((a, b) => a.id - b.id);
if (!lista.length) { console.log('No se encontraron niveles.'); process.exit(1); }
for (const def of lista) { console.log('Nivel ' + def.id + ' - ' + def.nombre); validarNivel(def); }
if (!soloNivel) { console.log('Variedad de planos'); validarVariedad(lista); }
console.log('\n' + errores + ' errores, ' + avisos + ' avisos.');
process.exit(errores ? 1 : 0);

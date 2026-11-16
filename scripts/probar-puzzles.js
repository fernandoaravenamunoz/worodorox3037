// =====================================================
// Pruebas automáticas de los puzzles (se ejecuta con Node.js)
//   node scripts/probar-puzzles.js
//
// Genera miles de puzzles de cada tipo y dificultad y comprueba que:
//  - la respuesta correcta está entre las opciones y las opciones no se repiten
//  - la analogía numérica no es ambigua (una sola regla sencilla calza con la tabla)
//  - en "cuál no pertenece" hay un único intruso
//  - el tablero de luces se puede resolver dentro del máximo de movimientos
//  - las pistas compuestas se reparten bien entre sus partes
//  - el bloqueo por error descuenta tiempo y no lo recupera
// =====================================================
'use strict';
const fs = require('fs');
const path = require('path');

// ---------- Entorno mínimo (sin navegador) ----------
global.window = global;
const nada = function () {};
global.W = {};
eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'config.js'), 'utf8'));
W.fuente = { dibujarCrudo: nada, ancho: function () { return 0; } };
W.HUD = { texto: nada, parrafo: nada };
W.texturas = {
  azar: function (s) { let a = s >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
};
['pistas', 'base', 'serie', 'asociacion', 'matriz', 'luces', 'simon'].forEach(function (f) {
  eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'puzzles', f + '.js'), 'utf8'));
});

let errores = 0;
function falla(msg) { errores++; if (errores <= 30) console.log('  [ERROR] ' + msg); }
const N = 3000;
const rndDe = function (i) { return W.texturas.azar(1234567 + i * 7919); };
const distintos = function (arr, igual) { for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) if (igual(arr[i], arr[j])) return false; return true; };

// ---------- Serie ----------
console.log('Serie...');
for (let d = 1; d <= 3; d++) for (let i = 0; i < N; i++) {
  const p = W.Puzzles.crear('serie', { dificultad: d, rnd: rndDe(i) });
  if (p.opciones.indexOf(p.correcto) < 0) falla('serie sin respuesta correcta');
  if (!distintos(p.opciones, function (a, b) { return a === b; })) falla('serie con opciones repetidas');
  if (p.opciones.some(function (o) { return o <= 0; })) falla('serie con opción no positiva');
}

// ---------- Asociación ----------
console.log('Asociacion...');
const Asoc = W.Puzzles.crear('asociacion', { dificultad: 1 }).constructor;
const iguales = { n: 0 };
for (let d = 1; d <= 3; d++) {
  let ambiguas = 0, total = 0;
  for (let i = 0; i < N; i++) {
    const p = W.Puzzles.crear('asociacion', { dificultad: d, rnd: rndDe(i), modo: 'numerica' });
    total++;
    const correcto = p.opciones[p.correcta];
    const pred = Asoc.predicciones(p.pares, p.nc);
    if (pred.length !== 1 || pred[0] !== correcto) ambiguas++;
    if (!distintos(p.opciones, function (a, b) { return a === b; })) falla('numerica con opciones repetidas');
    if (p.correcta < 0) falla('numerica sin respuesta correcta');
  }
  console.log('  numerica dif ' + d + ': ' + ambiguas + ' ambiguas de ' + total);
  if (ambiguas) falla('hay analogías numéricas ambiguas en dificultad ' + d);
  for (let i = 0; i < N; i++) {
    const p = W.Puzzles.crear('asociacion', { dificultad: d, rnd: rndDe(i), modo: 'intruso' });
    // Intrusos posibles: figuras cuyo valor en algún atributo es único
    const solos = new Set();
    ['f', 'c', 'n'].forEach(function (a) {
      p.items.forEach(function (it, k) {
        if (p.items.filter(function (o) { return o[a] === it[a]; }).length === 1) solos.add(k);
      });
    });
    if (solos.size !== 1 || !solos.has(p.correcta)) falla('intruso ambiguo (dif ' + d + '): ' + JSON.stringify(p.items));
  }
  for (let i = 0; i < N; i++) {
    const p = W.Puzzles.crear('asociacion', { dificultad: d, rnd: rndDe(i), modo: 'analogia' });
    if (p.correcta < 0) falla('analogía sin respuesta correcta');
  }
}

// ---------- Matriz ----------
console.log('Matriz...');
const igualFig = W.Pistas.util.igualFig;
const cuentaReglas = {};
for (let d = 1; d <= 3; d++) for (let i = 0; i < N; i++) {
  const datos = W.Pistas.generar({ tipo: 'matriz', dificultad: d }, rndDe(i));
  if (datos.opciones.length < 6) falla('matriz con menos de 6 opciones');
  if (!distintos(datos.opciones, igualFig)) falla('matriz con opciones repetidas');
  const correcta = datos.celdas[datos.falta.r][datos.falta.c];
  if (!igualFig(datos.opciones[datos.correcta], correcta)) falla('matriz: el índice correcto no apunta a la figura que falta');
  const k = d + ':' + datos.reglas.f + '/' + datos.reglas.c + '/' + datos.reglas.n;
  cuentaReglas[k] = (cuentaReglas[k] || 0) + 1;
  // Cada atributo de la figura que falta debe poder deducirse de su fila (o columna)
  const fila = datos.celdas[datos.falta.r];
  ['f', 'c', 'n'].forEach(function (a) {
    const otros = fila.filter(function (_, c) { return c !== datos.falta.c; }).map(function (x) { return x[a]; });
    const regla = datos.reglas[a];
    let esperado;
    if (regla === 'fila' || regla === 'fijo') esperado = otros[0];
    else if (regla === 'latino') esperado = (a === 'n' ? 6 : 3) - otros[0] - otros[1];
    else if (regla === 'columna' || regla === 'progresion') esperado = datos.celdas[(datos.falta.r + 1) % 3][datos.falta.c][a];
    else if (regla === 'suma') esperado = datos.falta.c === 2 ? otros[0] + otros[1] : fila[2][a] - otros[0];
    else if (regla === 'resta') esperado = datos.falta.c === 2 ? otros[0] - otros[1] : datos.falta.c === 0 ? fila[1][a] + fila[2][a] : fila[0][a] - fila[2][a];
    if (esperado !== correcta[a]) falla('matriz: atributo ' + a + ' no deducible con regla ' + regla);
  });
  // Con pista: al reiniciar cambia el orden de las opciones pero no la respuesta
  const p = W.Puzzles.crear('matriz', { dificultad: d, rnd: rndDe(i + 1), pista: datos });
  p.reiniciar();
  if (!igualFig(p.opciones[p.correcta], correcta)) falla('matriz: al rebarajar se perdió la respuesta');
}
Object.keys(cuentaReglas).sort().forEach(function (k) { console.log('  ' + k + ': ' + cuentaReglas[k]); });

// ---------- Luces: solución mínima por eliminación en GF(2) ----------
console.log('Luces...');
function minimoLuces(n, tablero) {
  const m = n * n, filas = [];
  for (let i = 0; i < m; i++) {
    const f = new Uint8Array(m + 1);
    const x = i % n, y = Math.floor(i / n);
    [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
      const xx = x + d[0], yy = y + d[1];
      if (xx >= 0 && yy >= 0 && xx < n && yy < n) f[yy * n + xx] = 1;
    });
    f[m] = tablero[i];
    filas.push(f);
  }
  const piv = [];
  let r = 0;
  for (let c = 0; c < m && r < m; c++) {
    let k = r; while (k < m && !filas[k][c]) k++;
    if (k === m) continue;
    const t = filas[k]; filas[k] = filas[r]; filas[r] = t;
    for (let j = 0; j < m; j++) if (j !== r && filas[j][c]) for (let q = 0; q <= m; q++) filas[j][q] ^= filas[r][q];
    piv.push(c); r++;
  }
  const libres = []; for (let c = 0; c < m; c++) if (piv.indexOf(c) < 0) libres.push(c);
  let mejor = Infinity;
  for (let mask = 0; mask < (1 << libres.length); mask++) {
    const x = new Uint8Array(m);
    libres.forEach(function (c, b) { x[c] = (mask >> b) & 1; });
    for (let j = piv.length - 1; j >= 0; j--) {
      let v = filas[j][m];
      for (let c = 0; c < m; c++) if (c !== piv[j] && filas[j][c]) v ^= x[c];
      x[piv[j]] = v;
    }
    mejor = Math.min(mejor, x.reduce(function (a, b) { return a + b; }, 0));
  }
  return mejor;
}
for (let d = 1; d <= 4; d++) {
  let suma = 0, encendidas = 0;
  for (let i = 0; i < 400; i++) {
    const p = W.Puzzles.crear('luces', { dificultad: d, rnd: rndDe(i) });
    const min = minimoLuces(p.n, p.inicial);
    if (min > p.maxMov) falla('luces dif ' + d + ' sin solución dentro del máximo');
    suma += min; encendidas += p.inicial.reduce(function (a, b) { return a + b; }, 0);
  }
  const ej = W.Puzzles.crear('luces', { dificultad: d, rnd: rndDe(0) });
  console.log('  dif ' + d + ': ' + ej.n + 'x' + ej.n + ', solución mínima promedio ' + (suma / 400).toFixed(1) +
    ' de ' + ej.maxMov + ' movimientos, luces encendidas promedio ' + (encendidas / 400).toFixed(1));
}

// ---------- Simón: el reloj se detiene mientras muestra ----------
console.log('Simon...');
{
  const p = W.Puzzles.crear('simon', { dificultad: 3, rnd: rndDe(3), tiempo: 10 });
  for (let k = 0; k < 6; k++) if (p.secuencia[k] === p.secuencia[k - 1]) falla('simon con color repetido seguido');
  for (let k = 0; k < 120; k++) p.actualizar(1 / 30, {});   // 4 s mostrando
  if (p.tiempo < 9.99 && p.estado === 'mostrar') falla('simon: el reloj corrió mientras mostraba');
}

// ---------- Bloqueo por error ----------
console.log('Bloqueo por error...');
{
  const p = W.Puzzles.crear('serie', { dificultad: 1, rnd: rndDe(9), tiempo: 60, alFallar: 'reiniciar' });
  const mala = p.opciones.findIndex(function (o) { return o !== p.correcto; });
  for (let k = 0; k < 30; k++) p.actualizar(1 / 30, {});      // 1 s pensando
  p.actualizar(1 / 30, { teclas: ['Digit' + (mala + 1)] });   // responde mal
  if (!p.bloqueo) falla('no se activó el bloqueo');
  for (let k = 0; k < 30 * 3; k++) p.actualizar(1 / 30, { teclas: ['Digit1'] });   // intenta responder bloqueado
  if (p.fase !== 'aviso') falla('se pudo responder durante el bloqueo');
  for (let k = 0; k < 30 * 4; k++) p.actualizar(1 / 30, {});
  if (p.fase !== 'jugando') falla('el bloqueo no terminó');
  if (p.tiempo > 53.5 || p.tiempo < 51) falla('el reloj no descontó el bloqueo (quedan ' + p.tiempo.toFixed(1) + ' s)');
  console.log('  tras 1 s + error + bloqueo quedan ' + p.tiempo.toFixed(1) + ' s de 60');
}

// ---------- Pistas compuestas ----------
console.log('Pistas compuestas...');
for (let i = 0; i < 500; i++) {
  ['codigo', 'simon'].forEach(function (tipo) {
    const d = W.Pistas.generar({ tipo: tipo, dificultad: 3 }, rndDe(i));
    d.id = 'n9_p1';
    const a = W.Pistas.parte(d, 1, 2), b = W.Pistas.parte(d, 2, 2);
    const lista = tipo === 'codigo' ? 'lineas' : 'secuencia';
    if (a[lista].length + b[lista].length !== d[lista].length) falla('parte mal repartida (' + tipo + ')');
    if (!a[lista].length || !b[lista].length) falla('parte vacía (' + tipo + ')');
    if (a.id !== 'n9_p1#1' || b.id !== 'n9_p1#2') falla('id de parte incorrecto');
  });
}

console.log('\n' + (errores ? errores + ' errores.' : 'Todo bien: 0 errores.'));
process.exit(errores ? 1 : 0);

// =====================================================
// Puzzle: series lógicas numéricas (qué número sigue)
// Tipos de regla según dificultad:
//   1: aritmética (+d), geométrica (x2, x3)
//   2: alternada (+a, +b), diferencias crecientes (+1, +2, +3...), cuadrados
//   3: tipo Fibonacci, x2+1, cubos (desde distintos inicios), alternada con
//      multiplicación, diferencias que se duplican (+1, +2, +4...), números primos
// Cada dificultad tiene reglas propias: la 3 no repite las de la 2.
// =====================================================
(function () {
  'use strict';
  const U = W.Puzzles.util, PAL = W.paleta;
  const E = W.Pistas.util.entero, B = W.Pistas.util.barajar;
  const PRIMOS = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37];

  // Cada generador devuelve 6 términos (se muestran 5, el 6.º es la respuesta)
  const REGLAS = {
    aritmetica: function (r) { const a = E(r, 1, 20), d = E(r, 2, 9); return [0, 1, 2, 3, 4, 5].map(function (i) { return a + d * i; }); },
    geometrica: function (r) { const a = E(r, 1, 3), q = E(r, 2, 3); let v = a; return [0, 1, 2, 3, 4, 5].map(function () { const x = v; v *= q; return x; }); },
    alternada: function (r) { const a = E(r, 1, 10), p = E(r, 2, 6), q = E(r, 1, 5) + 6; const t = [a]; for (let i = 1; i < 6; i++) t.push(t[i - 1] + (i % 2 ? p : q)); return t; },
    crecientes: function (r) { const a = E(r, 1, 10), d0 = E(r, 1, 3); const t = [a]; for (let i = 1; i < 6; i++) t.push(t[i - 1] + d0 + i - 1); return t; },
    cuadrados: function (r) { const k = E(r, 1, 4); return [0, 1, 2, 3, 4, 5].map(function (i) { return (i + k) * (i + k); }); },
    fibonacci: function (r) { const t = [E(r, 1, 4), E(r, 2, 6)]; for (let i = 2; i < 6; i++) t.push(t[i - 1] + t[i - 2]); return t; },
    dobleMasUno: function (r) { const t = [E(r, 1, 4)]; for (let i = 1; i < 6; i++) t.push(t[i - 1] * 2 + 1); return t; },
    cubos: function (r) { const k = E(r, 1, 3); return [0, 1, 2, 3, 4, 5].map(function (i) { return (i + k) * (i + k) * (i + k); }); },
    multAlterna: function (r) { const t = [E(r, 1, 5)]; const s = E(r, 1, 4); for (let i = 1; i < 6; i++) t.push(i % 2 ? t[i - 1] * 2 : t[i - 1] + s); return t; },
    difDobles: function (r) { const a = E(r, 1, 9), d0 = E(r, 1, 2); const t = [a]; let d = d0; for (let i = 1; i < 6; i++) { t.push(t[i - 1] + d); d *= 2; } return t; },
    primos: function (r) { const k = E(r, 0, PRIMOS.length - 6); return PRIMOS.slice(k, k + 6); }
  };
  const POR_DIF = {
    1: ['aritmetica', 'geometrica', 'aritmetica'],
    2: ['alternada', 'crecientes', 'cuadrados', 'geometrica'],
    3: ['fibonacci', 'dobleMasUno', 'cubos', 'multAlterna', 'difDobles', 'primos']
  };

  const Serie = W.Puzzles.heredar(function Serie(op) {
    W.Puzzles.Puzzle.call(this, op);
    this.titulo = op.titulo || 'CERRADURA: SERIE LOGICA';
    this.instruccion = 'QUE NUMERO SIGUE EN LA SERIE?';
  });

  Serie.prototype.generar = function () {
    const lista = POR_DIF[this.dif] || POR_DIF[Math.min(3, this.dif)] || POR_DIF[1];
    const regla = this.op.regla || lista[E(this.rnd, 0, lista.length - 1)];
    this.regla = regla;
    const t = REGLAS[regla](this.rnd);
    this.visibles = t.slice(0, 5);
    this.correcto = t[5];
    // Distractores: errores típicos (repetir la última diferencia, +/- 1, duplicar...)
    const ultimaDif = t[4] - t[3];
    const cand = [t[4] + ultimaDif, this.correcto + 1, this.correcto - 1, this.correcto + 2, t[4] * 2, this.correcto + ultimaDif, this.correcto - 2];
    if (regla === 'primos') cand.push(t[4] + 2, this.correcto + 2, this.correcto - 1);
    const opciones = [this.correcto];
    for (const c of B(this.rnd, cand)) {
      if (opciones.length >= 4) break;
      if (c > 0 && opciones.indexOf(c) < 0) opciones.push(c);
    }
    let extra = 3;
    while (opciones.length < 4) { if (opciones.indexOf(this.correcto + extra) < 0) opciones.push(this.correcto + extra); extra++; }
    this.opciones = B(this.rnd, opciones);
    this.rects = U.rejilla(4, 4, 30, 110, 260, 34, 8);
  };

  Serie.prototype.elegir = function (i) {
    if (i < 0 || i >= 4) return;
    this.elegida = i;
    if (this.opciones[i] === this.correcto) this.acertar(); else this.fallar('NUMERO INCORRECTO');
  };
  Serie.prototype.alClic = function (x, y) {
    for (let i = 0; i < 4; i++) if (U.dentro({ x: x, y: y }, this.rects[i])) return this.elegir(i);
  };
  Serie.prototype.alTecla = function (k) { this.elegir(U.indiceTecla(k)); };

  Serie.prototype.dibujarContenido = function (ctx) {
    const items = this.visibles.concat(['?']);
    const w = 44, sep = 6, total = items.length * w + (items.length - 1) * sep;
    let x = 160 - total / 2;
    for (let i = 0; i < items.length; i++) {
      const r = { x: Math.round(x), y: 50, w: w, h: 34 };
      U.boton(ctx, r, '', i === 5 ? PAL.magenta : PAL.cianOsc, '#0b0d16');
      const txt = String(items[i]);
      const esc = txt.length > 3 ? 1 : 2;
      W.HUD.texto(ctx, txt, r.x + w / 2, r.y + 17 - 2.5 * esc, i === 5 ? PAL.magenta : PAL.cianClaro, esc, 'centro');
      x += w + sep;
    }
    for (let i = 0; i < 4; i++) {
      const r = this.rects[i];
      const sel = this.fase === 'aviso' && this.elegida === i;
      U.boton(ctx, r, '', sel ? this.colorAviso : this.colorBorde);
      W.HUD.texto(ctx, String(this.opciones[i]), r.x + r.w / 2, r.y + 12, PAL.blanco, 2, 'centro');
      W.HUD.texto(ctx, String(i + 1), r.x + 3, r.y + 3, PAL.grisOsc);
    }
  };

  // Expuesto para las pruebas automáticas
  Serie.REGLAS = REGLAS;
  Serie.POR_DIF = POR_DIF;

  W.Puzzles.registrar('serie', Serie);
})();

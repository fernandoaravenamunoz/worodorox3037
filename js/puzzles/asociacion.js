// =====================================================
// Puzzle: asociaciones
//   intruso   : ¿cuál no pertenece? (4 o 5 figuras, todas menos una comparten un atributo)
//   analogia  : A es a B como C es a ? (con figuras)
//   numerica  : "máquina de funciones": una tabla ENTRA → SALE con 2 o 3 ejemplos
//               y hay que aplicar la misma regla a un número nuevo.
//
// Por qué la numérica muestra varios ejemplos: con un solo par (3 → 6) caben
// varias reglas (×2 o +3) y el jugador podía razonar bien y perder igual.
// El generador comprueba que TODAS las reglas sencillas que calzan con los
// ejemplos (lineales y cuadráticas) den el mismo resultado; si no, genera otra vez.
// =====================================================
(function () {
  'use strict';
  const U = W.Puzzles.util, PAL = W.paleta;
  const E = W.Pistas.util.entero, B = W.Pistas.util.barajar, igual = W.Pistas.util.igualFig;
  const ATR = ['f', 'c', 'n'];

  function valor(atr, v) { return atr === 'n' ? 1 + ((v - 1 + 3) % 3) : (v + 3) % 3; }
  function aplicar(fig, delta) {
    return { f: (fig.f + delta.f) % 3, c: (fig.c + delta.c) % 3, n: 1 + ((fig.n - 1 + delta.n) % 3) };
  }
  function figAzar(r) { return { f: E(r, 0, 2), c: E(r, 0, 2), n: E(r, 1, 3) }; }

  // ---------- Reglas de la máquina de funciones ----------
  // cuad: true → regla no lineal, necesita 3 ejemplos para quedar determinada
  const REGLAS_NUM = {
    1: [
      { f: function (x, k) { return x + k; } },
      { f: function (x) { return x * 2; } },
      { f: function (x, k) { return x * k; } }
    ],
    2: [
      { f: function (x, k) { return 2 * x + k; } },
      { f: function (x, k) { return x * k - 1; } },
      { f: function (x, k) { return x * k + k; } },
      { f: function (x) { return x * x; }, cuad: true }
    ],
    3: [
      { f: function (x) { return x * x + 1; }, cuad: true },
      { f: function (x) { return x * x - x; }, cuad: true },
      { f: function (x, k) { return 3 * x - k; } },
      { f: function (x, k) { return x * (k + 1) - k; } }
    ]
  };

  // Predicciones de las "reglas sencillas" que calzan con todos los ejemplos.
  // Si hay más de una predicción distinta, el ejercicio es ambiguo.
  function predicciones(pares, x) {
    const res = [];
    const ok = function (g) { return pares.every(function (p) { return Math.abs(g(p[0]) - p[1]) < 1e-9; }); };
    const agregar = function (v) { if (Number.isInteger(v) && res.indexOf(v) < 0) res.push(v); };
    // Lineal: y = m·x + c
    const a0 = pares[0][0], b0 = pares[0][1], a1 = pares[1][0], b1 = pares[1][1];
    const m = (b1 - b0) / (a1 - a0), c = b0 - m * a0;
    if (ok(function (t) { return m * t + c; })) agregar(m * x + c);
    // y = x² + c
    const c2 = b0 - a0 * a0;
    if (ok(function (t) { return t * t + c2; })) agregar(x * x + c2);
    // y = k·x²
    const k2 = b0 / (a0 * a0);
    if (ok(function (t) { return k2 * t * t; })) agregar(k2 * x * x);
    // Cuadrática general por los 3 primeros puntos (Lagrange)
    if (pares.length >= 3) {
      const p = pares;
      const L = function (t) {
        let s = 0;
        for (let i = 0; i < 3; i++) {
          let term = p[i][1];
          for (let j = 0; j < 3; j++) if (j !== i) term *= (t - p[j][0]) / (p[i][0] - p[j][0]);
          s += term;
        }
        return s;
      };
      if (ok(L)) agregar(Math.round(L(x) * 1e6) / 1e6);
    }
    return res;
  }

  const Asociacion = W.Puzzles.heredar(function Asociacion(op) {
    W.Puzzles.Puzzle.call(this, op);
    this.titulo = op.titulo || 'CERRADURA: ASOCIACION';
  });

  Asociacion.prototype.generar = function () {
    const r = this.rnd;
    const modos = this.dif === 1 ? ['intruso', 'numerica'] : this.dif === 2 ? ['intruso', 'analogia', 'numerica'] : ['analogia', 'numerica', 'intruso'];
    this.modo = this.op.modo || modos[E(r, 0, modos.length - 1)];
    if (this.modo === 'intruso') this.genIntruso(); else if (this.modo === 'analogia') this.genAnalogia(); else this.genNumerica();
  };

  // Intruso:
  //  dif 1: 4 figuras; otro atributo se reparte 2-2 y el tercero es igual en todas
  //  dif 2: 4 figuras; los otros dos atributos se reparten 2-2 (distraen)
  //  dif 3: 5 figuras; los otros dos atributos se reparten 3-2
  // Ningún reparto deja a otra figura "sola" en un atributo, así el intruso es único.
  Asociacion.prototype.genIntruso = function () {
    const r = this.rnd;
    const total = this.dif >= 3 ? 5 : 4;
    const a = ATR[E(r, 0, 2)];
    const v = a === 'n' ? E(r, 1, 3) : E(r, 0, 2);
    const items = [];
    for (let i = 0; i < total; i++) items.push({});
    for (let i = 0; i < total; i++) items[i][a] = i < total - 1 ? v : valor(a, v + E(r, 1, 2));
    const otros = B(r, ATR.filter(function (b) { return b !== a; }));
    otros.forEach(function (b, idx) {
      const base = b === 'n' ? E(r, 1, 3) : E(r, 0, 2);
      const otro = valor(b, base + E(r, 1, 2));
      let reparto;
      if (this.dif === 1 && idx === 1) reparto = [base, base, base, base];
      else if (total === 5) reparto = B(r, [base, base, base, otro, otro]);
      else reparto = B(r, [base, base, otro, otro]);
      for (let i = 0; i < total; i++) items[i][b] = reparto[i];
    }, this);
    const orden = B(r, items.map(function (_, i) { return i; }));
    this.items = orden.map(function (i) { return items[i]; });
    this.correcta = orden.indexOf(total - 1);
    this.rects = total === 5 ? U.rejilla(5, 5, 14, 62, 292, 64, 6) : U.rejilla(4, 4, 24, 60, 272, 70, 8);
    this.instruccion = 'CUAL NO PERTENECE AL GRUPO?';
  };

  Asociacion.prototype.genAnalogia = function () {
    const r = this.rnd;
    const delta = { f: 0, c: 0, n: 0 };
    const cambian = B(r, ATR.slice()).slice(0, this.dif >= 3 ? 2 : 1);
    cambian.forEach(function (k) { delta[k] = E(r, 1, 2); });
    this.a = figAzar(r);
    this.b = aplicar(this.a, delta);
    do { this.c = figAzar(r); } while (igual(this.c, this.a));
    const correcta = aplicar(this.c, delta);
    const ops = [correcta];
    let n = 0;
    while (ops.length < 4 && n++ < 100) {
      const d2 = { f: E(r, 0, 2), c: E(r, 0, 2), n: E(r, 0, 2) };
      const o = aplicar(this.c, d2);
      if (!ops.some(function (x) { return igual(x, o); })) ops.push(o);
    }
    this.opciones = B(r, ops);
    this.correcta = this.opciones.findIndex(function (x) { return igual(x, correcta); });
    this.rects = U.rejilla(this.opciones.length, 4, 40, 112, 240, 40, 8);
    this.instruccion = 'A ES A B COMO C ES A ...';
  };

  // Máquina de funciones: 2 ejemplos (reglas lineales) o 3 (cuadráticas)
  Asociacion.prototype.genNumerica = function () {
    const r = this.rnd;
    const lista = REGLAS_NUM[this.dif] || REGLAS_NUM[1];
    let regla, k, pares, nc, correcto, intentos = 0;
    do {
      regla = lista[E(r, 0, lista.length - 1)];
      k = E(r, 2, 4);
      const nEj = regla.cuad ? 3 : 2;
      const xs = B(r, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const ejemplos = xs.slice(0, nEj).sort(function (p, q) { return p - q; });
      nc = xs[nEj];
      pares = ejemplos.map(function (x) { return [x, regla.f(x, k)]; });
      correcto = regla.f(nc, k);
      intentos++;
      const pred = predicciones(pares, nc);
      if (pred.length === 1 && pred[0] === correcto && correcto > 0 && correcto < 1000 &&
          pares.every(function (p) { return p[1] > 0; })) break;
    } while (intentos < 80);
    this.pares = pares;
    this.nc = nc;
    // Distractores: errores típicos (usar solo el primer par, sumar en vez de multiplicar, ±1...)
    const p0 = pares[0];
    const cand = [nc + (p0[1] - p0[0]), p0[0] ? Math.round(nc * p0[1] / p0[0]) : 0, correcto + 1, correcto - 1,
      correcto + 2, nc * 2, correcto + (pares[1][1] - pares[0][1]), correcto - 2];
    const ops = [correcto];
    for (const c of B(r, cand)) {
      if (ops.length >= 4) break;
      if (Number.isInteger(c) && c > 0 && ops.indexOf(c) < 0) ops.push(c);
    }
    let e = 3; while (ops.length < 4) { if (ops.indexOf(correcto + e) < 0) ops.push(correcto + e); e++; }
    this.opciones = B(r, ops);
    this.correcta = this.opciones.indexOf(correcto);
    this.rects = U.rejilla(4, 4, 40, 116, 240, 34, 8);
    this.instruccion = 'LA MISMA REGLA VALE PARA TODA LA TABLA';
  };

  Asociacion.prototype.elegir = function (i) {
    const n = this.rects.length;
    if (i < 0 || i >= n) return;
    this.elegida = i;
    if (i === this.correcta) this.acertar(); else this.fallar('RELACION INCORRECTA');
  };
  Asociacion.prototype.alClic = function (x, y) {
    for (let i = 0; i < this.rects.length; i++) if (U.dentro({ x: x, y: y }, this.rects[i])) return this.elegir(i);
  };
  Asociacion.prototype.alTecla = function (k) { this.elegir(U.indiceTecla(k)); };

  function caja(ctx, x, y, w, h, color) { U.boton(ctx, { x: x, y: y, w: w, h: h }, '', color, '#0b0d16'); }
  function flecha(ctx, x, y, color) {
    ctx.fillStyle = color || PAL.gris;
    ctx.fillRect(x, y, 10, 1);
    ctx.fillRect(x + 7, y - 2, 1, 5); ctx.fillRect(x + 8, y - 1, 1, 3);
  }

  Asociacion.prototype.dibujarContenido = function (ctx) {
    const self = this;
    function colorOp(i) { return self.fase === 'aviso' && self.elegida === i ? self.colorAviso : self.colorBorde; }
    if (this.modo === 'intruso') {
      for (let i = 0; i < this.items.length; i++) {
        const r = this.rects[i];
        U.boton(ctx, r, '', colorOp(i));
        W.Pistas.dibujarFigura(ctx, this.items[i], r.x + r.w / 2, r.y + r.h / 2, Math.min(r.w, r.h) - 14);
        W.HUD.texto(ctx, String(i + 1), r.x + 3, r.y + 3, PAL.grisOsc);
      }
      return;
    }
    if (this.modo === 'numerica') {
      // Tabla ENTRA → SALE
      const n = this.pares.length;
      const x0 = 26, y0 = 28, w = 132, fila = 22;
      caja(ctx, x0, y0, w, 14 + n * fila, PAL.cianOsc);
      W.HUD.texto(ctx, 'ENTRA', x0 + 38, y0 + 4, PAL.gris, 1, 'centro');
      W.HUD.texto(ctx, 'SALE', x0 + 98, y0 + 4, PAL.gris, 1, 'centro');
      for (let i = 0; i < n; i++) {
        const y = y0 + 14 + i * fila;
        W.HUD.texto(ctx, String(this.pares[i][0]), x0 + 38, y + 5, PAL.cianClaro, 2, 'centro');
        flecha(ctx, x0 + 62, y + 10);
        W.HUD.texto(ctx, String(this.pares[i][1]), x0 + 98, y + 5, PAL.cianClaro, 2, 'centro');
      }
      // Número nuevo
      const yc = y0 + 8 + Math.floor(n * fila / 2) - 8;
      caja(ctx, 184, yc, 40, 34, PAL.cianOsc);
      W.HUD.texto(ctx, String(this.nc), 204, yc + 12, PAL.cianClaro, 2, 'centro');
      flecha(ctx, 230, yc + 17, PAL.magenta);
      caja(ctx, 246, yc, 40, 34, PAL.magenta);
      W.HUD.texto(ctx, '?', 266, yc + 12, PAL.magenta, 2, 'centro');
    } else {
      // Fila superior: A → B   C → ?
      const y = 36, s = 50;
      caja(ctx, 30, y, s, s, PAL.cianOsc); flecha(ctx, 86, y + s / 2);
      caja(ctx, 102, y, s, s, PAL.cianOsc);
      caja(ctx, 168, y, s, s, PAL.cianOsc); flecha(ctx, 224, y + s / 2);
      caja(ctx, 240, y, s, s, PAL.magenta);
      W.HUD.texto(ctx, 'A', 33, y + 3, PAL.grisOsc); W.HUD.texto(ctx, 'B', 105, y + 3, PAL.grisOsc);
      W.HUD.texto(ctx, 'C', 171, y + 3, PAL.grisOsc);
      W.HUD.texto(ctx, '?', 265, y + s / 2 - 5, PAL.magenta, 2, 'centro');
      ctx.fillStyle = PAL.grisOsc; ctx.fillRect(159, y + 6, 1, s - 12);
      W.Pistas.dibujarFigura(ctx, this.a, 55, y + s / 2, s - 12);
      W.Pistas.dibujarFigura(ctx, this.b, 127, y + s / 2, s - 12);
      W.Pistas.dibujarFigura(ctx, this.c, 193, y + s / 2, s - 12);
    }
    for (let i = 0; i < this.rects.length; i++) {
      const r = this.rects[i];
      U.boton(ctx, r, '', colorOp(i));
      if (this.modo === 'analogia') W.Pistas.dibujarFigura(ctx, this.opciones[i], r.x + r.w / 2, r.y + r.h / 2, Math.min(r.w, r.h) - 8);
      else W.HUD.texto(ctx, String(this.opciones[i]), r.x + r.w / 2, r.y + r.h / 2 - 5, PAL.blanco, 2, 'centro');
      W.HUD.texto(ctx, String(i + 1), r.x + 3, r.y + 3, PAL.grisOsc);
    }
  };

  // Expuesto para las pruebas automáticas (scripts/probar-puzzles.js)
  Asociacion.predicciones = predicciones;

  W.Puzzles.registrar('asociacion', Asociacion);
})();

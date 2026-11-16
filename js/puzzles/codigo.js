// =====================================================
// Puzzle: cerradura de combinación deducida de pistas
// La puerta muestra símbolos; el valor de cada símbolo está en un holograma
// (tabla directa o cadena de ecuaciones). Se gira cada rueda y se presiona ABRIR.
// Sin pista: la tabla aparece en la misma pantalla (para enemigos o terminales).
// =====================================================
(function () {
  'use strict';
  const U = W.Puzzles.util, PAL = W.paleta;

  const Codigo = W.Puzzles.heredar(function Codigo(op) {
    W.Puzzles.Puzzle.call(this, op);
    this.titulo = op.titulo || 'CERRADURA: COMBINACION';
  });

  Codigo.prototype.generar = function () {
    this.conPista = !!(this.pista && this.pista.tipo === 'codigo');
    this.datos = this.conPista ? this.pista : W.Pistas.generar({ tipo: 'codigo', dificultad: this.dif }, this.rnd);
    const n = this.datos.codigo.length;
    this.ruedas = new Array(n).fill(0);
    this.sel = 0;
    const ancho = 36, sep = 10, total = n * ancho + (n - 1) * sep;
    const x0 = (this.conPista ? 160 : 210) - total / 2;
    this.rectsRueda = [];
    for (let i = 0; i < n; i++) {
      const x = Math.round(x0 + i * (ancho + sep));
      this.rectsRueda.push({
        x: x, w: ancho,
        arriba: { x: x, y: 58, w: ancho, h: 16 },
        valor: { x: x, y: 76, w: ancho, h: 28 },
        abajo: { x: x, y: 106, w: ancho, h: 16 }
      });
    }
    this.botonAbrir = { x: (this.conPista ? 160 : 210) - 34, y: 132, w: 68, h: 18 };
    this.instruccion = this.conPista ? 'EL VALOR DE CADA SIMBOLO ESTA EN UN HOLOGRAMA' : 'USA LA TABLA PARA ABRIR';
  };
  Codigo.prototype.reiniciar = function () {
    if (this.conPista) { this.ruedas.fill(0); this.sel = 0; } else this.generar();
  };

  Codigo.prototype.girar = function (i, d) {
    this.ruedas[i] = (this.ruedas[i] + d + 10) % 10;
    this.sel = i;
    if (W.Audio) W.Audio.sfx('clic');
  };
  Codigo.prototype.abrir = function () {
    const ok = this.ruedas.every(function (v, i) { return v === this.datos.codigo[i]; }, this);
    if (ok) this.acertar(); else this.fallar('CODIGO INCORRECTO');
  };

  Codigo.prototype.alClic = function (x, y) {
    const p = { x: x, y: y };
    for (let i = 0; i < this.rectsRueda.length; i++) {
      const r = this.rectsRueda[i];
      if (U.dentro(p, r.arriba)) return this.girar(i, 1);
      if (U.dentro(p, r.abajo)) return this.girar(i, -1);
      if (U.dentro(p, r.valor)) { this.sel = i; return this.girar(i, 1); }
    }
    if (U.dentro(p, this.botonAbrir)) this.abrir();
  };
  Codigo.prototype.alTecla = function (k) {
    const n = this.ruedas.length;
    const m = /^(Digit|Numpad)(\d)$/.exec(k);
    if (m) { this.ruedas[this.sel] = parseInt(m[2], 10); this.sel = Math.min(n - 1, this.sel + 1); return; }
    if (k === 'ArrowLeft') this.sel = (this.sel + n - 1) % n;
    if (k === 'ArrowRight') this.sel = (this.sel + 1) % n;
    if (k === 'ArrowUp') this.girar(this.sel, 1);
    if (k === 'ArrowDown') this.girar(this.sel, -1);
    if (k === 'Enter') this.abrir();
  };

  function triangulo(ctx, r, haciaArriba, color) {
    ctx.fillStyle = color;
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    for (let j = 0; j < 5; j++) {
      const w = haciaArriba ? j : 4 - j;
      ctx.fillRect(Math.round(cx - w), Math.round(cy - 2 + j), w * 2 + 1, 1);
    }
  }

  Codigo.prototype.dibujarContenido = function (ctx) {
    if (!this.conPista) {
      ctx.fillStyle = '#0b0d16'; ctx.fillRect(10, 30, 110, 128);
      ctx.fillStyle = PAL.cianOsc; ctx.fillRect(10, 30, 110, 1);
      W.HUD.texto(ctx, this.datos.titulo, 65, 34, PAL.cian, 1, 'centro');
      W.Pistas.dibujar(ctx, this.datos, 14, 44, 102, 110);
    }
    for (let i = 0; i < this.rectsRueda.length; i++) {
      const r = this.rectsRueda[i];
      const sel = i === this.sel;
      // Símbolo que corresponde a esta rueda
      W.Pistas.dibujarSimbolo(ctx, this.datos.ordenPuerta[i], r.x + r.w / 2 - 7, 36, 2, PAL.cianClaro);
      U.boton(ctx, r.arriba, '', this.colorBorde);
      triangulo(ctx, r.arriba, true, this.colorBorde);
      U.boton(ctx, r.valor, '', sel ? PAL.blanco : this.colorBorde, '#0b0d16');
      W.HUD.texto(ctx, String(this.ruedas[i]), r.x + r.w / 2, r.valor.y + 7, PAL.blanco, 3, 'centro');
      U.boton(ctx, r.abajo, '', this.colorBorde);
      triangulo(ctx, r.abajo, false, this.colorBorde);
    }
    U.boton(ctx, this.botonAbrir, 'ABRIR', PAL.verde);
  };

  W.Puzzles.registrar('codigo', Codigo);
})();

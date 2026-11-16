// =====================================================
// Puzzle: matriz 3×3 tipo test de CI (qué figura falta)
// Con pista: la matriz NO se muestra (está en un holograma en otro lugar del mapa).
// Sin pista (sellar enemigos): se muestra la matriz completa.
// Tras un error, las opciones cambian de lugar: no sirve "descartar por posición".
// =====================================================
(function () {
  'use strict';
  const U = W.Puzzles.util, PAL = W.paleta;
  const B = W.Pistas.util.barajar, igual = W.Pistas.util.igualFig;

  const Matriz = W.Puzzles.heredar(function Matriz(op) {
    W.Puzzles.Puzzle.call(this, op);
    this.titulo = op.titulo || 'CERRADURA: MATRIZ 3X3';
  });

  Matriz.prototype.generar = function () {
    this.datos = (this.pista && this.pista.tipo === 'matriz')
      ? this.pista
      : W.Pistas.generar({ tipo: 'matriz', dificultad: this.dif }, this.rnd);
    this.barajarOpciones(false);
    const n = this.opciones.length;
    const conMatriz = !this.pista;
    this.rects = conMatriz
      ? U.rejilla(n, 3, 168, 40, 140, 110, 6)
      : U.rejilla(n, 3, 70, 62, 180, 90, 6);
    this.instruccion = conMatriz ? 'ELIGE LA FIGURA QUE FALTA' : 'ELIGE LA FIGURA QUE FALTABA EN EL HOLOGRAMA';
  };

  // Copia local de las opciones (la pista original no se modifica)
  Matriz.prototype.barajarOpciones = function (mezclar) {
    const d = this.datos;
    const correcta = d.opciones[d.correcta];
    this.opciones = d.opciones.slice();
    if (mezclar) B(this.rnd, this.opciones);
    this.correcta = this.opciones.findIndex(function (x) { return igual(x, correcta); });
  };

  // Con pista la respuesta no cambia al reiniciar, pero sí el orden; sin pista se genera otra matriz
  Matriz.prototype.reiniciar = function () {
    if (this.pista) this.barajarOpciones(true); else this.generar();
  };

  Matriz.prototype.elegir = function (i) {
    if (i < 0 || i >= this.opciones.length) return;
    this.elegida = i;
    if (i === this.correcta) this.acertar(); else this.fallar('FIGURA INCORRECTA');
  };

  Matriz.prototype.alClic = function (x, y) {
    for (let i = 0; i < this.rects.length; i++) if (U.dentro({ x: x, y: y }, this.rects[i])) return this.elegir(i);
  };
  Matriz.prototype.alTecla = function (k) { this.elegir(U.indiceTecla(k)); };

  Matriz.prototype.dibujarContenido = function (ctx) {
    const d = this.datos;
    if (!this.pista) {
      ctx.fillStyle = '#0b0d16';
      ctx.fillRect(14, 34, 126, 126);
      ctx.fillStyle = PAL.cianOsc;
      ctx.fillRect(14, 34, 126, 1); ctx.fillRect(14, 159, 126, 1);
      W.Pistas.dibujar(ctx, d, 17, 37, 120, 120);
    } else {
      W.HUD.texto(ctx, 'LA MATRIZ ESTA EN UN HOLOGRAMA DEL NIVEL', 160, 34, PAL.cianClaro, 1, 'centro');
      W.HUD.texto(ctx, '(REVISALO EN TU LIBRETA CON E)', 160, 44, PAL.gris, 1, 'centro');
    }
    for (let i = 0; i < this.rects.length; i++) {
      const r = this.rects[i];
      const sel = this.fase === 'aviso' && this.elegida === i;
      U.boton(ctx, r, '', sel ? this.colorAviso : this.colorBorde);
      W.Pistas.dibujarFigura(ctx, this.opciones[i], r.x + r.w / 2, r.y + r.h / 2 + 2, Math.min(r.w, r.h) - 8);
      W.HUD.texto(ctx, String(i + 1), r.x + 3, r.y + 3, PAL.grisOsc);
    }
  };

  W.Puzzles.registrar('matriz', Matriz);
})();

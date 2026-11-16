// =====================================================
// Puzzle: tablero de luces (apagar todas)
// Tocar una casilla invierte esa casilla y sus 4 vecinas.
// El tablero se genera "presionando" casillas al azar desde todo apagado,
// así siempre tiene solución. Hay un máximo de movimientos.
// Dificultad:  1 → 3×3   2 → 4×4   3 → 4×4 con más presiones   4 → 5×5 (solo el jefe final)
// =====================================================
(function () {
  'use strict';
  const U = W.Puzzles.util, PAL = W.paleta;
  const E = W.Pistas.util.entero;

  const TAMANO = [0, 3, 4, 4, 5];
  const PRESIONES = [0, 3, 4, 5, 5];
  const MOV_EXTRA = [0, 4, 4, 5, 6];

  const Luces = W.Puzzles.heredar(function Luces(op) {
    W.Puzzles.Puzzle.call(this, op);
    this.titulo = op.titulo || 'CERRADURA: TABLERO DE LUCES';
    this.instruccion = 'APAGA TODAS LAS LUCES';
    this.botonReinicio = { x: 236, y: 120, w: 64, h: 14 };
  });

  Luces.prototype.generar = function () {
    const d = Math.max(1, Math.min(4, this.dif));
    this.n = TAMANO[d];
    const presiones = PRESIONES[d];
    const n = this.n;
    this.inicial = new Uint8Array(n * n);
    const usadas = {};
    let k = 0;
    while (k < presiones) {
      const i = E(this.rnd, 0, n * n - 1);
      if (usadas[i]) continue;
      usadas[i] = true; k++;
      this.invertir(this.inicial, i);
    }
    if (this.inicial.every(function (v) { return v === 0; })) return this.generar();
    this.maxMov = presiones + MOV_EXTRA[d];
    this.tamCelda = Math.floor(126 / n);
    this.ox = 70 + Math.floor((126 - this.tamCelda * n) / 2);
    this.oy = 32;
    this.restaurar();
  };

  Luces.prototype.restaurar = function () {
    this.luces = new Uint8Array(this.inicial);
    this.movimientos = 0;
  };

  Luces.prototype.invertir = function (t, i) {
    const n = this.n, x = i % n, y = Math.floor(i / n);
    t[i] ^= 1;
    if (x > 0) t[i - 1] ^= 1;
    if (x < n - 1) t[i + 1] ^= 1;
    if (y > 0) t[i - n] ^= 1;
    if (y < n - 1) t[i + n] ^= 1;
  };

  Luces.prototype.alClic = function (x, y) {
    if (U.dentro({ x: x, y: y }, this.botonReinicio)) { this.restaurar(); return; }
    const cx = Math.floor((x - this.ox) / this.tamCelda), cy = Math.floor((y - this.oy) / this.tamCelda);
    if (cx < 0 || cy < 0 || cx >= this.n || cy >= this.n) return;
    this.invertir(this.luces, cy * this.n + cx);
    this.movimientos++;
    if (W.Audio) W.Audio.sfx('clic');
    if (this.luces.every(function (v) { return v === 0; })) return this.acertar();
    if (this.movimientos >= this.maxMov) this.fallar('SIN MOVIMIENTOS');
  };

  Luces.prototype.dibujarContenido = function (ctx) {
    const t = this.tamCelda;
    for (let i = 0; i < this.n * this.n; i++) {
      const x = this.ox + (i % this.n) * t, y = this.oy + Math.floor(i / this.n) * t;
      const on = this.luces[i];
      ctx.fillStyle = on ? PAL.cian : '#0e1a24';
      ctx.fillRect(x + 1, y + 1, t - 2, t - 2);
      if (on) { ctx.fillStyle = PAL.cianClaro; ctx.fillRect(x + 3, y + 3, t - 6, 2); }
      else { ctx.fillStyle = '#16303d'; ctx.fillRect(x + 1, y + 1, t - 2, 1); }
    }
    const restantes = this.maxMov - this.movimientos;
    W.HUD.texto(ctx, 'MOVIMIENTOS', 268, 60, PAL.gris, 1, 'centro');
    W.HUD.texto(ctx, String(restantes), 268, 72, restantes <= 2 ? PAL.rojo : PAL.cianClaro, 2, 'centro');
    U.boton(ctx, this.botonReinicio, 'REINICIAR', PAL.amarillo);
    // Ayuda visual del patrón (una cruz)
    W.HUD.texto(ctx, 'PATRON', 30, 60, PAL.gris, 1, 'centro');
    ctx.fillStyle = PAL.cianOsc;
    [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]].forEach(function (p) { ctx.fillRect(26 + p[0] * 6, 78 + p[1] * 6, 5, 5); });
  };

  W.Puzzles.registrar('luces', Luces);
})();

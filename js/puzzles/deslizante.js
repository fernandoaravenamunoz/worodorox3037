// =====================================================
// Puzzle: rompecabezas deslizante 3×3 (fragmentos de imagen)
// La imagen se genera por código. Se desordena con movimientos válidos,
// así siempre tiene solución. Dificultad = cantidad de movimientos.
// =====================================================
(function () {
  'use strict';
  const U = W.Puzzles.util, PAL = W.paleta;
  const E = W.Pistas.util.entero;
  const N = 3, TAM = 40, IMG = N * TAM;
  const OX = 60, OY = 32;

  // Dibuja una de varias imágenes cyberpunk en un canvas de 120×120
  function crearImagen(rnd) {
    const c = document.createElement('canvas');
    c.width = IMG; c.height = IMG;
    const g = c.getContext('2d');
    const tema = E(rnd, 0, 2);
    // Cielo con bandas (estilo 16 bits)
    const bandas = ['#07060d', '#120f1f', '#1d1236', '#2b1048', '#3d0f52'];
    for (let i = 0; i < bandas.length; i++) { g.fillStyle = bandas[i]; g.fillRect(0, i * 24, IMG, 24); }
    for (let k = 0; k < 40; k++) { g.fillStyle = rnd() < 0.3 ? '#c8fbff' : '#6f8a94'; g.fillRect(E(rnd, 0, IMG), E(rnd, 0, 70), 1, 1); }
    if (tema === 0) {
      // Planeta Temukeitor con anillo
      g.fillStyle = '#0f5a6b'; g.beginPath(); g.arc(60, 55, 30, 0, 7); g.fill();
      g.fillStyle = '#22e4ff'; g.beginPath(); g.arc(52, 47, 20, 0, 7); g.fill();
      g.fillStyle = '#c8fbff'; g.fillRect(44, 40, 8, 4);
      g.fillStyle = '#ff2bd6'; g.fillRect(16, 60, 88, 3);
    } else if (tema === 1) {
      // Nave salvavidas
      g.fillStyle = '#4a4f63'; g.fillRect(30, 50, 60, 18);
      g.fillStyle = '#8d93ad'; g.fillRect(40, 42, 36, 10);
      g.fillStyle = '#22e4ff'; g.fillRect(70, 45, 8, 4);
      g.fillStyle = '#ff2bd6'; g.fillRect(18, 54, 12, 4); g.fillRect(10, 55, 8, 2);
      g.fillStyle = '#e8b923'; g.fillRect(36, 68, 6, 6); g.fillRect(78, 68, 6, 6);
    } else {
      // Logo del juego
      g.fillStyle = '#ff2bd6';
      W.fuente.dibujarCrudo(g, 'W', 42, 22, '#ff2bd6', 9);
      W.fuente.dibujarCrudo(g, '3073', 28, 74, '#22e4ff', 4);
    }
    // Ciudad / piso en la parte inferior
    for (let x = 0; x < IMG; x += 8) {
      const h = E(rnd, 10, 30);
      g.fillStyle = '#16151f'; g.fillRect(x, IMG - h, 7, h);
      g.fillStyle = rnd() < 0.5 ? '#e8b923' : '#22e4ff'; g.fillRect(x + 2, IMG - h + 4, 1, 1);
    }
    return c;
  }

  const Deslizante = W.Puzzles.heredar(function Deslizante(op) {
    W.Puzzles.Puzzle.call(this, op);
    this.titulo = op.titulo || 'CERRADURA: FRAGMENTOS';
    this.instruccion = 'TOCA UNA PIEZA JUNTO AL HUECO PARA MOVERLA';
  });

  Deslizante.prototype.generar = function () {
    this.imagen = crearImagen(this.rnd);
    // piezas[i] = número de pieza en la posición i (8 = hueco)
    this.piezas = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    let hueco = 8, anterior = -1;
    const movs = [0, 18, 32, 56][this.dif] || 18;
    for (let k = 0; k < movs; k++) {
      const v = this.vecinos(hueco).filter(function (p) { return p !== anterior; });
      const p = v[Math.floor(this.rnd() * v.length)];
      this.piezas[hueco] = this.piezas[p]; this.piezas[p] = 8;
      anterior = hueco; hueco = p;
    }
    if (this.resuelto()) this.generar();   // por si quedó ordenado
    this.movimientos = 0;
  };

  Deslizante.prototype.vecinos = function (i) {
    const x = i % N, y = Math.floor(i / N), v = [];
    if (x > 0) v.push(i - 1); if (x < N - 1) v.push(i + 1);
    if (y > 0) v.push(i - N); if (y < N - 1) v.push(i + N);
    return v;
  };
  Deslizante.prototype.resuelto = function () {
    for (let i = 0; i < 9; i++) if (this.piezas[i] !== i) return false;
    return true;
  };
  Deslizante.prototype.mover = function (i) {
    const hueco = this.piezas.indexOf(8);
    if (this.vecinos(hueco).indexOf(i) < 0) return;
    this.piezas[hueco] = this.piezas[i]; this.piezas[i] = 8;
    this.movimientos++;
    if (W.Audio) W.Audio.sfx('clic');
    if (this.resuelto()) this.acertar();
  };

  Deslizante.prototype.alClic = function (x, y) {
    const cx = Math.floor((x - OX) / TAM), cy = Math.floor((y - OY) / TAM);
    if (cx < 0 || cy < 0 || cx >= N || cy >= N) return;
    this.mover(cy * N + cx);
  };
  // Flechas: mueve la pieza que está al lado del hueco en esa dirección
  Deslizante.prototype.alTecla = function (k) {
    const h = this.piezas.indexOf(8), x = h % N, y = Math.floor(h / N);
    if (k === 'ArrowLeft' && x < N - 1) this.mover(h + 1);
    if (k === 'ArrowRight' && x > 0) this.mover(h - 1);
    if (k === 'ArrowUp' && y < N - 1) this.mover(h + N);
    if (k === 'ArrowDown' && y > 0) this.mover(h - N);
  };

  Deslizante.prototype.dibujarContenido = function (ctx) {
    ctx.fillStyle = '#0b0d16';
    ctx.fillRect(OX - 2, OY - 2, IMG + 4, IMG + 4);
    for (let i = 0; i < 9; i++) {
      const p = this.piezas[i];
      if (p === 8 && this.fase !== 'aviso') continue;
      const dx = OX + (i % N) * TAM, dy = OY + Math.floor(i / N) * TAM;
      const sx = (p % N) * TAM, sy = Math.floor(p / N) * TAM;
      ctx.drawImage(this.imagen, sx, sy, TAM, TAM, dx, dy, TAM, TAM);
      ctx.fillStyle = this.colorBorde;
      ctx.fillRect(dx, dy, TAM, 1); ctx.fillRect(dx, dy, 1, TAM);
    }
    // Referencia
    W.HUD.texto(ctx, 'OBJETIVO', 236, 34, PAL.gris);
    ctx.drawImage(this.imagen, 0, 0, IMG, IMG, 220, 42, 64, 64);
    ctx.fillStyle = PAL.cianOsc; ctx.fillRect(220, 42, 64, 1); ctx.fillRect(220, 105, 64, 1);
    W.HUD.texto(ctx, 'MOVIMIENTOS: ' + this.movimientos, 214, 116, PAL.gris);
  };

  W.Puzzles.registrar('deslizante', Deslizante);
})();

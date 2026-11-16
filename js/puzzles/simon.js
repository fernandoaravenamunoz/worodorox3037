// =====================================================
// Puzzle: memoria tipo Simón (4 paneles de color)
// Sin pista: la máquina muestra la secuencia y crece cada ronda.
// Con pista: no hay reproducción; se ingresa la secuencia vista en un holograma.
// El reloj se detiene mientras la máquina muestra la secuencia (solo cuenta tu turno).
// =====================================================
(function () {
  'use strict';
  const U = W.Puzzles.util, PAL = W.paleta;
  const E = W.Pistas.util.entero;
  const COL = W.Pistas.COLORES_SIMON;

  // Tiempos de la reproducción (segundos)
  const T_ENCENDIDO = 0.45, T_PAUSA = 0.28, T_INICIO = 0.6, T_ENTRE_RONDAS = 0.8;

  const PANELES = [
    { x: 100, y: 32, w: 58, h: 58 }, { x: 162, y: 32, w: 58, h: 58 },
    { x: 100, y: 94, w: 58, h: 58 }, { x: 162, y: 94, w: 58, h: 58 }
  ];

  function oscuro(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = ((n >> 16) & 255) * 0.25, g = ((n >> 8) & 255) * 0.25, b = (n & 255) * 0.25;
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }

  const Simon = W.Puzzles.heredar(function Simon(op) {
    W.Puzzles.Puzzle.call(this, op);
    this.titulo = op.titulo || 'CERRADURA: MEMORIA';
  });

  Simon.prototype.generar = function () {
    this.conPista = !!(this.pista && this.pista.tipo === 'simon');
    if (this.conPista) {
      this.secuencia = this.pista.secuencia.slice();
      this.largoObjetivo = this.secuencia.length;
      this.largoActual = this.secuencia.length;
      this.rondas = 1;
      this.estado = 'entrada';
      this.instruccion = 'INGRESA LA SECUENCIA DEL HOLOGRAMA';
    } else {
      const largos = { 1: [3, 4], 2: [4, 5], 3: [5, 6] }[Math.min(3, this.dif)] || [3, 4];
      this.largoActual = largos[0];
      this.largoObjetivo = largos[1];
      this.rondas = largos[1] - largos[0] + 1;
      // Sin colores repetidos seguidos: un mismo panel dos veces seguidas casi no se distingue
      this.secuencia = [];
      for (let i = 0; i < this.largoObjetivo; i++) {
        let c;
        do { c = E(this.rnd, 0, 3); } while (i > 0 && c === this.secuencia[i - 1]);
        this.secuencia.push(c);
      }
      this.estado = 'mostrar';
      this.instruccion = 'MEMORIZA Y REPITE LA SECUENCIA';
    }
    this.paso = 0;
    this.reloj = T_INICIO;
    this.encendido = -1;
    this.entrada = [];
  };

  // Mientras la máquina muestra la secuencia, el tiempo límite no corre
  Simon.prototype.relojPausado = function () { return this.estado === 'mostrar'; };

  Simon.prototype.actualizarContenido = function (dt) {
    this.reloj -= dt;
    if (this.estado === 'mostrar') {
      if (this.reloj <= 0) {
        if (this.encendido >= 0) { this.encendido = -1; this.reloj = T_PAUSA; this.paso++; }
        else if (this.paso < this.largoActual) {
          this.encendido = this.secuencia[this.paso]; this.reloj = T_ENCENDIDO;
          if (W.Audio) W.Audio.sfx('simon' + this.encendido);
        } else { this.estado = 'entrada'; this.entrada = []; }
      }
    } else if (this.encendido >= 0 && this.reloj <= 0) this.encendido = -1;
  };

  Simon.prototype.pulsar = function (i) {
    if (this.estado !== 'entrada' || i < 0 || i > 3) return;
    this.encendido = i; this.reloj = 0.2;
    if (W.Audio) W.Audio.sfx('simon' + i);
    const k = this.entrada.length;
    if (this.secuencia[k] !== i) return this.fallar('SECUENCIA INCORRECTA');
    this.entrada.push(i);
    if (this.entrada.length === this.largoActual) {
      if (this.largoActual >= this.largoObjetivo) return this.acertar();
      this.largoActual++;
      this.estado = 'mostrar'; this.paso = 0; this.reloj = T_ENTRE_RONDAS; this.encendido = -1;
    }
  };

  Simon.prototype.alClic = function (x, y) {
    for (let i = 0; i < 4; i++) if (U.dentro({ x: x, y: y }, PANELES[i])) return this.pulsar(i);
  };
  Simon.prototype.alTecla = function (k) { this.pulsar(U.indiceTecla(k)); };

  Simon.prototype.dibujarContenido = function (ctx) {
    for (let i = 0; i < 4; i++) {
      const p = PANELES[i];
      ctx.fillStyle = this.encendido === i ? COL[i] : oscuro(COL[i]);
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = COL[i];
      ctx.fillRect(p.x, p.y, p.w, 1); ctx.fillRect(p.x, p.y + p.h - 1, p.w, 1);
      ctx.fillRect(p.x, p.y, 1, p.h); ctx.fillRect(p.x + p.w - 1, p.y, 1, p.h);
      W.HUD.texto(ctx, String(i + 1), p.x + 4, p.y + 4, this.encendido === i ? '#07060d' : COL[i]);
    }
    // Progreso
    const estadoTxt = this.estado === 'mostrar' ? 'OBSERVA...' : 'TU TURNO';
    W.HUD.texto(ctx, estadoTxt, 50, 60, this.estado === 'mostrar' ? PAL.amarillo : PAL.verde, 1, 'centro');
    W.HUD.texto(ctx, this.entrada.length + '/' + this.largoActual, 50, 72, PAL.gris, 1, 'centro');
    if (!this.conPista) {
      const ronda = this.largoActual - (this.largoObjetivo - this.rondas);
      W.HUD.texto(ctx, 'RONDA ' + ronda + '/' + this.rondas, 270, 60, PAL.gris, 1, 'centro');
    }
  };

  W.Puzzles.registrar('simon', Simon);
})();

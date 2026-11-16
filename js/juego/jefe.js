// =====================================================
// Jefe final: la IA de la nave, enfrentada como un gran puzzle por etapas
// que combina las mecánicas aprendidas. Usa la misma interfaz de puzzles,
// así main.js lo trata igual que cualquier cerradura.
//
// La etapa final usa el tablero de luces 5×5 (dificultad 4), que solo aparece aquí:
// es el clímax del juego, no un muro en medio de un nivel.
//
// opciones: { pistas: { matriz, codigo }, conocidas: { matriz, codigo },
//             alDanio: function(n) → true si el jugador sigue vivo,
//             vida: function() → vida actual (para mostrarla) }
// =====================================================
(function () {
  'use strict';
  const PAL = W.paleta, A = W.config.ANCHO, H = W.config.ALTO;

  const ETAPAS = [
    { puzzle: 'matriz', pista: 'matriz', dif: 3, tiempo: 55, frase: 'CREES QUE RECUERDAS MIS PATRONES, HUMANO?' },
    { puzzle: 'simon', dif: 3, tiempo: 40, frase: 'TU MEMORIA ES TAN FRAGIL COMO TU CAPSULA.' },
    { puzzle: 'codigo', pista: 'codigo', dif: 3, tiempo: 60, frase: 'MIS CLAVES SON ECUACIONES. TU ERES UN ERROR DE CALCULO.' },
    { puzzle: 'luces', dif: 4, tiempo: 100, frase: 'APAGA MIS LUCES... SI PUEDES.' }
  ];
  const BURLAS = ['JA. JA. JA. REINTENTA, ENERGIA AMBULANTE.', 'ERROR HUMANO DETECTADO. COMO SIEMPRE.', 'TU PULSO SE ACELERA. QUE INEFICIENTE.'];

  function Jefe(op) {
    this.op = op || {};
    this.resultado = null;
    this.terminado = false;
    this.etapa = 0;
    this.t = 0;
    this.sub = null;
    this.interludio = 2.6;
    this.frase = 'SOY WORODOROX. TU ERES COMBUSTIBLE. NO SALDRAS DE AQUI.';
    this.tFrase = 0;   // para el efecto de "tecleo" de la frase
  }

  Jefe.prototype.generar = function () { if (W.Audio) W.Audio.sfx('ia'); };

  Jefe.prototype.crearEtapa = function () {
    const e = ETAPAS[this.etapa];
    const pista = e.pista ? this.op.pistas[e.pista] : null;
    this.sub = W.Puzzles.crear(e.puzzle, {
      dificultad: e.dif || 3,
      rnd: W.texturas.azar((Math.random() * 1e9) | 0),
      pista: pista,
      pistaConocida: pista ? !!this.op.conocidas[e.pista] : false,
      tiempo: e.tiempo,
      alFallar: 'terminar',
      estilo: 'riesgo',
      cancelable: false,
      titulo: 'IA - ETAPA ' + (this.etapa + 1) + '/4'
    });
  };

  Jefe.prototype.actualizar = function (dt, entrada) {
    this.t += dt;
    this.tFrase += dt;
    if (this.terminado) return;
    if (this.interludio > 0) {
      this.interludio -= dt;
      const salta = entrada && entrada.clics && entrada.clics.length && this.interludio < 1.8;
      if (this.interludio <= 0 || salta) {
        this.interludio = 0;
        if (this.etapa >= ETAPAS.length) { this.resultado = 'exito'; this.terminado = true; return; }
        this.crearEtapa();
      }
      return;
    }
    this.sub.actualizar(dt, entrada);
    if (!this.sub.terminado) return;
    if (this.sub.resultado === 'exito') {
      this.etapa++;
      this.sub = null;
      if (this.etapa >= ETAPAS.length) {
        this.frase = 'NO... MIS SISTEMAS... SELLANDO NUCLEO... TEMUKEITOR... NO...';
        this.interludio = 3.2; this.tFrase = 0;
      } else {
        this.frase = ETAPAS[this.etapa].frase;
        this.interludio = 2.6; this.tFrase = 0;
      }
      if (W.Audio) W.Audio.sfx('ia');
    } else {
      // Falló: recibe daño y repite la etapa (si sigue vivo)
      const vivo = this.op.alDanio ? this.op.alDanio(3) : true;
      this.sub = null;
      if (!vivo) { this.resultado = 'fallo'; this.terminado = true; return; }
      this.frase = BURLAS[Math.floor(Math.random() * BURLAS.length)];
      this.interludio = 2.2; this.tFrase = 0;
    }
  };

  Jefe.prototype.dibujar = function (ctx) {
    if (this.sub) {
      this.sub.dibujar(ctx);
      this.dibujarVidaIA(ctx, 90, 7);
      this.dibujarVidaJugador(ctx, A / 2, H - 20);
      return;
    }
    // Interludio: el ojo de la IA habla
    ctx.fillStyle = '#05030a'; ctx.fillRect(0, 0, A, H);
    for (let y = 0; y < H; y += 2) { ctx.fillStyle = 'rgba(180,77,255,' + (0.03 + 0.02 * Math.sin(y * 0.3 + this.t * 6)).toFixed(3) + ')'; ctx.fillRect(0, y, A, 1); }
    const cx = A / 2, cy = 66, pulso = 1 + Math.sin(this.t * 5) * 0.08;
    const anillos = [[46, '#4a1a73'], [38, '#b44dff'], [28, '#2b0a3a'], [18 * pulso, '#ff3b3b'], [8 * pulso, '#ffd0d0']];
    for (const a of anillos) { ctx.fillStyle = a[1]; ctx.beginPath(); ctx.arc(cx, cy, a[0], 0, Math.PI * 2); ctx.fill(); }
    for (let k = 0; k < 12; k++) {
      const ang = k * Math.PI / 6 + this.t;
      ctx.fillStyle = PAL.magenta;
      ctx.fillRect(Math.round(cx + Math.cos(ang) * 42), Math.round(cy + Math.sin(ang) * 42), 2, 2);
    }
    W.HUD.texto(ctx, 'IA WORODOROX', A / 2, 6, PAL.magenta, 1, 'centro');
    this.dibujarVidaIA(ctx, A / 2 - 40, 16);
    const visibles = Math.floor(this.tFrase * 30);
    W.HUD.parrafo(ctx, this.frase.slice(0, visibles), A / 2, 124, 290, PAL.cianClaro, 'centro');
    if (this.etapa < ETAPAS.length) W.HUD.texto(ctx, 'SIGUIENTE: ETAPA ' + (this.etapa + 1) + ' DE 4', A / 2, 160, PAL.gris, 1, 'centro');
    this.dibujarVidaJugador(ctx, A / 2, 170);
  };

  Jefe.prototype.dibujarVidaJugador = function (ctx, x, y) {
    if (!this.op.vida) return;
    W.HUD.texto(ctx, 'TU VIDA: ' + this.op.vida(), x, y, this.op.vida() <= 3 ? PAL.rojo : PAL.cian, 1, 'centro');
  };

  Jefe.prototype.dibujarVidaIA = function (ctx, x, y) {
    const restante = ETAPAS.length - this.etapa;
    for (let k = 0; k < ETAPAS.length; k++) {
      ctx.fillStyle = k < restante ? PAL.magenta : '#3a1030';
      ctx.fillRect(x + k * 21, y, 19, 4);
    }
  };

  W.Puzzles.registrar('jefe', Jefe);
})();

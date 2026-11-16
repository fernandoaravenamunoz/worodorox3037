// =====================================================
// Puzzles: interfaz común + registro
//
// Todos los puzzles comparten esta interfaz, así puertas, enemigos,
// terminales de salas 2D, el jefe y (más adelante) los duelos versus
// usan los mismos módulos:
//
//   const p = W.Puzzles.crear('matriz', opciones);
//   p.actualizar(dt, entrada);   // entrada: { clics: [{x,y}], teclas: ['Digit1', ...] }
//   p.dibujar(ctx);
//   p.terminado  → true cuando acabó (después de la animación final)
//   p.resultado  → 'exito' | 'fallo' | 'cancelado'
//
// opciones: {
//   dificultad: 1..4, rnd: función aleatoria, pista: datos de pista (o null),
//   pistaConocida: bool (el jugador ya la vio completa),
//   pistaParcial: [datos de partes vistas] (pistas compuestas a medio encontrar),
//   tiempo: segundos (0 = sin límite),
//   alFallar: 'reiniciar' (puertas normales) | 'terminar' (magenta, enemigos),
//   estilo: 'normal' | 'riesgo' | 'enemigo', titulo: texto opcional,
//   cancelable: bool
// }
//
// Error en una puerta normal (alFallar: 'reiniciar'):
//   la cerradura se bloquea unos segundos (config.BLOQUEO_ERROR) y el reloj
//   NO se recupera. Así, probar opciones al azar deja de ser la estrategia más rápida.
//   Si se agota el tiempo, tras el bloqueo el reloj vuelve a empezar completo.
//
// Cada puzzle concreto define:
//   generar()                → arma un desafío nuevo (con variación)
//   reiniciar()              → vuelve a empezar (por defecto llama a generar)
//   alClic(x, y)             → responde a un clic/toque en coordenadas internas
//   alTecla(codigo)          → opcional
//   actualizarContenido(dt)  → opcional
//   relojPausado()           → opcional: true mientras el reloj no debe correr
//                              (por ejemplo, mientras Simón muestra la secuencia)
//   dibujarContenido(ctx)    → dibuja el puzzle en el área (0, 26) a (320, 168)
//   y llama a this.acertar() o this.fallar() cuando corresponde.
// =====================================================
(function () {
  'use strict';
  const PAL = W.paleta;
  const A = W.config.ANCHO, H = W.config.ALTO;

  const registro = {};

  function Puzzle(op) {
    this.op = op || {};
    this.dif = this.op.dificultad || 1;
    this.rnd = this.op.rnd || Math.random;
    this.pista = this.op.pista || null;
    this.tiempoMax = this.op.tiempo || 0;
    this.tiempo = this.tiempoMax;
    this.resultado = null;
    this.terminado = false;
    this.fase = 'jugando';     // 'jugando' | 'aviso' (animación de acierto/error o bloqueo)
    this.tAviso = 0;
    this.textoAviso = '';
    this.colorAviso = PAL.verde;
    this.verPista = false;
    this.t = 0;
    this.errores = 0;
    this.titulo = this.op.titulo || 'PROTOCOLO';
    this.instruccion = '';
    const est = this.op.estilo || 'normal';
    this.colorBorde = est === 'riesgo' ? PAL.magenta : est === 'enemigo' ? PAL.rojo : PAL.cian;
    this.botonSalir = { x: A - 44, y: 3, w: 40, h: 11 };
    this.botonPista = { x: A - 92, y: 3, w: 44, h: 11 };
  }

  Puzzle.prototype.generar = function () {};
  Puzzle.prototype.reiniciar = function () { this.generar(); };
  Puzzle.prototype.alClic = function () {};
  Puzzle.prototype.alTecla = function () {};
  Puzzle.prototype.actualizarContenido = function () {};
  Puzzle.prototype.dibujarContenido = function () {};
  Puzzle.prototype.relojPausado = function () { return false; };

  Puzzle.prototype.acertar = function () {
    if (this.fase !== 'jugando') return;
    this.fase = 'aviso'; this.tAviso = 0.9;
    this.textoAviso = 'ACCESO CONCEDIDO'; this.colorAviso = PAL.verde;
    this._final = 'exito';
    if (W.Audio) W.Audio.sfx('acierto');
  };

  Puzzle.prototype.fallar = function (motivo) {
    if (this.fase !== 'jugando') return;
    this.fase = 'aviso';
    this.errores++;
    if (this.op.alFallar === 'reiniciar') {
      // Bloqueo: cuesta tiempo real equivocarse
      this.tAviso = W.config.BLOQUEO_ERROR || 6;
      this.bloqueo = true;
      this.porTiempo = motivo === 'TIEMPO AGOTADO';
      this.textoAviso = (motivo || 'ERROR') + ' - CERRADURA BLOQUEADA';
      this.colorAviso = PAL.amarillo;
      this._final = 'reinicio';
    } else {
      this.tAviso = 1.0;
      this.bloqueo = false;
      this.textoAviso = motivo || 'ERROR';
      this.colorAviso = PAL.rojo;
      this._final = 'fallo';
    }
    if (W.Audio) W.Audio.sfx('error');
  };

  function dentro(p, r) { return p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h; }

  Puzzle.prototype.actualizar = function (dt, entrada) {
    this.t += dt;
    if (this.terminado) return;
    const clics = (entrada && entrada.clics) || [];
    const teclas = (entrada && entrada.teclas) || [];
    if (this.fase === 'aviso') {
      // Durante el bloqueo se puede salir de la cerradura (si es cancelable)
      if (this.bloqueo && this.op.cancelable !== false) {
        for (const c of clics) if (dentro(c, this.botonSalir)) { this.resultado = 'cancelado'; this.terminado = true; return; }
        if (teclas.indexOf('Escape') >= 0) { this.resultado = 'cancelado'; this.terminado = true; return; }
      }
      // El reloj sigue corriendo durante el bloqueo (salvo que se haya agotado)
      if (this.bloqueo && this.tiempoMax > 0 && !this.porTiempo) this.tiempo = Math.max(0, this.tiempo - dt);
      this.tAviso -= dt;
      if (this.tAviso <= 0) {
        if (this._final === 'reinicio') {
          this.fase = 'jugando';
          this.bloqueo = false;
          // El reloj solo se recupera si se había agotado
          if (this.porTiempo || this.tiempo <= 0) this.tiempo = this.tiempoMax;
          this.reiniciar();
        } else {
          this.resultado = this._final;
          this.terminado = true;
        }
      }
      return;
    }
    // Tiempo límite
    if (this.tiempoMax > 0 && !this.relojPausado()) {
      this.tiempo -= dt;
      if (this.tiempo <= 0) { this.tiempo = 0; this.fallar('TIEMPO AGOTADO'); return; }
    }
    // Clics y toques
    for (const c of clics) {
      if (this.verPista) { this.verPista = false; continue; }
      if (this.op.cancelable !== false && dentro(c, this.botonSalir)) {
        this.resultado = 'cancelado'; this.terminado = true;
        return;
      }
      if (this.pista && dentro(c, this.botonPista)) { this.verPista = true; continue; }
      this.alClic(c.x, c.y);
      if (this.fase !== 'jugando') return;
    }
    for (const k of teclas) {
      if (k === 'Escape' && this.op.cancelable !== false) { this.resultado = 'cancelado'; this.terminado = true; return; }
      if (k === 'KeyE' && this.pista) { this.verPista = !this.verPista; continue; }
      this.alTecla(k);
      if (this.fase !== 'jugando') return;
    }
    this.actualizarContenido(dt);
  };

  // ---------- Dibujo común ----------
  Puzzle.prototype.dibujar = function (ctx) {
    const HUD = W.HUD;
    // Fondo con líneas de barrido
    ctx.fillStyle = 'rgba(5,4,10,0.94)';
    ctx.fillRect(0, 0, A, H);
    ctx.fillStyle = 'rgba(34,228,255,0.04)';
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, A, 1);
    // Marco
    ctx.fillStyle = this.colorBorde;
    ctx.fillRect(0, 0, A, 1); ctx.fillRect(0, H - 1, A, 1);
    ctx.fillRect(0, 0, 1, H); ctx.fillRect(A - 1, 0, 1, H);
    ctx.fillRect(0, 17, A, 1);
    // Título
    HUD.texto(ctx, this.titulo, 5, 6, this.colorBorde);
    // Botones superiores
    if (this.op.cancelable !== false) boton(ctx, this.botonSalir, 'SALIR', PAL.gris);
    if (this.pista) boton(ctx, this.botonPista, 'VER PISTA', PAL.cian);
    // Barra de tiempo
    if (this.tiempoMax > 0) {
      const f = this.tiempo / this.tiempoMax;
      const pausado = this.fase === 'jugando' && this.relojPausado();
      ctx.fillStyle = '#1a1830';
      ctx.fillRect(4, 20, A - 8, 3);
      ctx.fillStyle = pausado ? PAL.grisOsc : f < 0.25 ? (Math.floor(this.t * 6) % 2 ? PAL.rojo : PAL.magenta) : this.colorBorde;
      ctx.fillRect(4, 20, Math.round((A - 8) * f), 3);
      HUD.texto(ctx, pausado ? 'PAUSA' : Math.ceil(this.tiempo) + 'S', A - 98, 6, f < 0.25 ? PAL.rojo : PAL.gris, 1, 'der');
    }
    // Contenido del puzzle
    this.dibujarContenido(ctx);
    // Instrucción inferior
    if (this.instruccion) HUD.texto(ctx, this.instruccion, A / 2, H - 9, PAL.gris, 1, 'centro');

    // Pista superpuesta
    if (this.verPista) {
      ctx.fillStyle = 'rgba(5,4,10,0.96)';
      ctx.fillRect(40, 24, A - 80, H - 36);
      ctx.fillStyle = PAL.cian;
      ctx.fillRect(40, 24, A - 80, 1); ctx.fillRect(40, H - 13, A - 80, 1);
      const parcial = this.op.pistaParcial || [];
      if (this.op.pistaConocida) {
        HUD.texto(ctx, this.pista.titulo, A / 2, 28, PAL.cian, 1, 'centro');
        W.Pistas.dibujar(ctx, this.pista, 70, 38, A - 140, H - 58);
      } else if (parcial.length) {
        // Pista compuesta: se muestran solo las partes encontradas
        const total = parcial[0].partes || 2;
        HUD.texto(ctx, 'TIENES ' + parcial.length + ' DE ' + total + ' PARTES', A / 2, 28, PAL.amarillo, 1, 'centro');
        const w = Math.floor((A - 100) / total);
        for (let j = 1; j <= total; j++) {
          const d = parcial.find(function (p) { return p.parte === j; });
          const x = 50 + (j - 1) * w;
          if (d) { W.Pistas.dibujar(ctx, d, x, 40, w - 6, H - 78); continue; }
          // Parte que falta: recuadro punteado con "?"
          ctx.fillStyle = PAL.magentaOsc;
          for (let k = 0; k < w - 6; k += 4) { ctx.fillRect(x + k, 42, 2, 1); ctx.fillRect(x + k, H - 40, 2, 1); }
          for (let k = 0; k < H - 82; k += 4) { ctx.fillRect(x, 42 + k, 1, 2); ctx.fillRect(x + w - 7, 42 + k, 1, 2); }
          HUD.texto(ctx, '?', x + (w - 6) / 2, 66, PAL.magenta, 3, 'centro');
          HUD.texto(ctx, 'PARTE ' + j, x + (w - 6) / 2, 88, PAL.magentaOsc, 1, 'centro');
        }
        HUD.texto(ctx, 'BUSCA EL OTRO HOLOGRAMA DE ESTA PISTA', A / 2, H - 34, PAL.magenta, 1, 'centro');
      } else {
        HUD.texto(ctx, 'AUN NO ENCUENTRAS ESTA PISTA', A / 2, 70, PAL.magenta, 1, 'centro');
        HUD.texto(ctx, 'BUSCA UN HOLOGRAMA EN EL NIVEL', A / 2, 82, PAL.gris, 1, 'centro');
      }
      HUD.texto(ctx, 'TOCA PARA VOLVER', A / 2, H - 22, PAL.gris, 1, 'centro');
    }

    // Aviso de acierto / error / bloqueo
    if (this.fase === 'aviso') {
      const alto = this.bloqueo ? 32 : 22;
      ctx.fillStyle = 'rgba(5,4,10,0.85)';
      ctx.fillRect(0, 78, A, alto);
      ctx.fillStyle = this.colorAviso;
      ctx.fillRect(0, 78, A, 1); ctx.fillRect(0, 78 + alto - 1, A, 1);
      HUD.texto(ctx, this.textoAviso, A / 2, 86, this.colorAviso, 1, 'centro');
      if (this.bloqueo) {
        const total = W.config.BLOQUEO_ERROR || 6;
        HUD.texto(ctx, 'NUEVO INTENTO EN ' + Math.ceil(this.tAviso) + 'S', A / 2, 97, PAL.gris, 1, 'centro');
        ctx.fillStyle = '#1a1830'; ctx.fillRect(110, 106, 100, 2);
        ctx.fillStyle = PAL.amarillo; ctx.fillRect(110, 106, Math.round(100 * this.tAviso / total), 2);
      }
    }
  };

  // Botón rectangular con texto
  function boton(ctx, r, etiqueta, color, relleno) {
    ctx.fillStyle = relleno || '#14122a';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = color;
    ctx.fillRect(r.x, r.y, r.w, 1);
    ctx.fillRect(r.x, r.y + r.h - 1, r.w, 1);
    ctx.fillRect(r.x, r.y, 1, r.h);
    ctx.fillRect(r.x + r.w - 1, r.y, 1, r.h);
    if (etiqueta) W.HUD.texto(ctx, etiqueta, r.x + r.w / 2, r.y + Math.floor((r.h - 5) / 2), color, 1, 'centro');
  }

  // Rejilla de botones de opciones: devuelve rectángulos
  function rejilla(n, cols, x, y, w, h, sep) {
    const filas = Math.ceil(n / cols);
    const bw = Math.floor((w - (cols - 1) * sep) / cols), bh = Math.floor((h - (filas - 1) * sep) / filas);
    const r = [];
    for (let i = 0; i < n; i++) {
      r.push({ x: x + (i % cols) * (bw + sep), y: y + Math.floor(i / cols) * (bh + sep), w: bw, h: bh });
    }
    return r;
  }

  // Tecla numérica → índice (Digit1 → 0)
  function indiceTecla(k) {
    const m = /^(Digit|Numpad)(\d)$/.exec(k);
    return m ? parseInt(m[2], 10) - 1 : -1;
  }

  W.Puzzles = {
    Puzzle: Puzzle,
    registrar: function (nombre, Clase) { registro[nombre] = Clase; },
    crear: function (nombre, op) {
      const Clase = registro[nombre];
      if (!Clase) throw new Error('Puzzle desconocido: ' + nombre);
      const p = new Clase(op || {});
      p.nombre = nombre;
      p.generar();
      return p;
    },
    existe: function (nombre) { return !!registro[nombre]; },
    // Puzzles que no necesitan pista (sirven para sellar enemigos y rescatar).
    // El tablero de luces quedó fuera: no se puede resolver en pocos segundos.
    rapidos: ['serie', 'asociacion', 'matriz', 'simon'],
    // Utilidades para los módulos de puzzle
    util: { dentro: dentro, boton: boton, rejilla: rejilla, indiceTecla: indiceTecla },
    // Hereda de Puzzle
    heredar: function (Clase) {
      Clase.prototype = Object.create(Puzzle.prototype);
      Clase.prototype.constructor = Clase;
      return Clase;
    }
  };
})();

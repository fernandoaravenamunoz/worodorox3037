// =====================================================
// Jugador en el laberinto: posición, mirada, movimiento, colisiones,
// vida, invulnerabilidad y empujes externos (descompresión, golpes)
// =====================================================
(function () {
  'use strict';
  const C = W.config;

  function Jugador(inicio, personaje) {
    this.p = W.PERSONAJES[personaje] || W.PERSONAJES.chispa;
    this.x = inicio.x;
    this.y = inicio.y;
    this.ang = inicio.ang || 0;   // dirección horizontal (radianes)
    this.pitch = 0;               // inclinación vertical (píxeles de desplazamiento del horizonte)
    this.camZ = 0.5;              // altura de la cámara (0,5 = mitad de la pared)
    this.bob = 0;                 // fase del balanceo al caminar
    this.vidaMax = this.p.vida;
    this.vida = this.vidaMax;
    this.invulnerable = 0;
    this.empujeX = 0;             // empuje externo de este cuadro (casillas/segundo)
    this.empujeY = 0;
    this.golpeX = 0;              // retroceso por golpe (decae)
    this.golpeY = 0;
    this.ataque = 0;              // animación del arma (0 = reposo)
    this.recarga = 0;
    this.seguroX = this.x;        // última posición segura (fuera de trampas)
    this.seguroY = this.y;
    this.flashDanio = 0;
  }

  // Intenta mover con colisión por ejes separados (permite deslizarse por paredes)
  Jugador.prototype.mover = function (mx, my, mapa) {
    const r = C.RADIO_JUGADOR;
    const nx = this.x + mx;
    const bx = nx + Math.sign(mx) * r;
    if (mx !== 0 && !mapa.solida(bx, this.y - r) && !mapa.solida(bx, this.y + r)) this.x = nx;
    const ny = this.y + my;
    const by = ny + Math.sign(my) * r;
    if (my !== 0 && !mapa.solida(this.x - r, by) && !mapa.solida(this.x + r, by)) this.y = ny;
  };

  // entrada: { avance, lateral, giro, pitch, correr }
  Jugador.prototype.actualizar = function (dt, entrada, mapa) {
    // Mirada
    this.ang += entrada.giro;
    this.pitch = Math.max(-C.PITCH_MAX, Math.min(C.PITCH_MAX, this.pitch + entrada.pitch));

    // Dirección deseada (se normaliza para no ir más rápido en diagonal)
    let f = entrada.avance, s = entrada.lateral;
    const largo = Math.hypot(f, s);
    if (largo > 1) { f /= largo; s /= largo; }

    const vel = (entrada.correr ? C.VEL_CORRER : C.VEL_CAMINAR) * this.p.velocidad * dt;
    const dx = Math.cos(this.ang), dy = Math.sin(this.ang);
    // Adelante = (dx, dy); derecha = (-dy, dx)
    let mx = (dx * f - dy * s) * vel;
    let my = (dy * f + dx * s) * vel;
    // Empujes externos
    mx += (this.empujeX + this.golpeX) * dt;
    my += (this.empujeY + this.golpeY) * dt;
    this.empujeX = 0; this.empujeY = 0;
    const decae = Math.max(0, 1 - dt * 6);
    this.golpeX *= decae; this.golpeY *= decae;

    this.mover(mx, my, mapa);

    // Balanceo de cabeza al caminar
    const intensidad = Math.min(1, Math.hypot(f, s));
    if (intensidad > 0.05) {
      this.bob += dt * (entrada.correr ? 13 : 9) * intensidad;
      this.camZ = 0.5 + Math.sin(this.bob) * 0.012 * intensidad;
    } else {
      this.camZ += (0.5 - this.camZ) * Math.min(1, dt * 8);
    }

    // Temporizadores
    if (this.invulnerable > 0) this.invulnerable -= dt;
    if (this.flashDanio > 0) this.flashDanio -= dt;
    if (this.recarga > 0) this.recarga -= dt;
    if (this.ataque > 0) { this.ataque += dt * 3.2; if (this.ataque >= 1) this.ataque = 0; }
  };

  // Recibe daño. Devuelve true si el daño se aplicó.
  Jugador.prototype.danar = function (n, ignorarInvulnerable) {
    if (n <= 0) return false;
    if (this.invulnerable > 0 && !ignorarInvulnerable) return false;
    this.vida = Math.max(0, this.vida - n);
    this.invulnerable = C.INVULNERABLE;
    this.flashDanio = 0.35;
    if (W.Audio) W.Audio.sfx('dano');
    W.Entrada.vibrar(80);
    return true;
  };

  Jugador.prototype.curar = function (n) { this.vida = Math.min(this.vidaMax, this.vida + n); };

  // Vuelve a la última posición segura (al pisar una baldosa equivocada, aplastador...)
  Jugador.prototype.volverASeguro = function () { this.x = this.seguroX; this.y = this.seguroY; };

  Jugador.prototype.atacar = function () {
    if (this.recarga > 0) return false;
    this.recarga = this.p.recarga;
    this.ataque = 0.01;
    if (W.Audio) W.Audio.sfx(this.p.proyectil ? 'lanzar' : 'golpe');
    return true;
  };

  W.Jugador = Jugador;
})();

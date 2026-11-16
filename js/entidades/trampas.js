// =====================================================
// Trampas del laberinto. Todas avisan antes de activarse (chispas, zumbido, luz).
//   e  piso electrificado  : ciclo apagado → aviso (chispas) → activo
//   l  láser               : ciclo apagado → aviso (rayos tenues) → activo
//   k  aplastador          : la casilla se cierra de golpe (franjas rojas antes)
//   g  gas                 : nube tóxica intermitente (burbujas y siseo antes)
//   < > ^ v descompresión  : empuja constantemente en esa dirección
//   Q O A baldosas         : solo es seguro pisar el símbolo indicado por una pista
// La leyenda del nivel puede fijar { desfase, periodo } para un carácter.
// =====================================================
(function () {
  'use strict';
  const CEL = W.CELDA;

  // Duraciones de cada fase [apagado, aviso, activo] en segundos
  const CICLOS = { e: [1.8, 0.8, 1.4], l: [1.2, 0.6, 1.2], k: [2.2, 0.8, 1.0], g: [2.0, 1.0, 2.0] };
  const DIRS = { '>': [1, 0, 0], 'v': [0, 1, 1], '<': [-1, 0, 2], '^': [0, -1, 3] };

  function Trampa(car, x, y, def, mapa) {
    this.car = car;
    this.x = x; this.y = y;
    this.i = mapa.indice(x, y);
    this.def = def || {};
    this.fase = -1;
    const ciclo = CICLOS[car];
    if (ciclo) {
      this.ciclo = ciclo;
      this.periodo = ciclo[0] + ciclo[1] + ciclo[2];
      this.desfase = this.def.desfase !== undefined ? this.def.desfase : ((x + y) * 0.45) % this.periodo;
    }
    this.tDanio = 0;
  }

  // Fase actual: 0 apagado, 1 aviso, 2 activo
  Trampa.prototype.calcularFase = function (t) {
    const c = this.ciclo;
    const u = (t + this.desfase) % this.periodo;
    return u < c[0] ? 0 : u < c[0] + c[1] ? 1 : 2;
  };

  function enCelda(jug, x, y) { return Math.floor(jug.x) === x && Math.floor(jug.y) === y; }

  Trampa.prototype.actualizar = function (dt, nivel) {
    const jug = nivel.jug, mapa = nivel.mapa, tz = mapa.tz;
    const dentro = enCelda(jug, this.x, this.y);
    const dist = Math.hypot(jug.x - this.x - 0.5, jug.y - this.y - 0.5);
    const vol = Math.max(0, 1 - dist / 7);
    this.tDanio -= dt;

    if (this.ciclo) {
      const f = this.calcularFase(nivel.tiempo);
      const cambio = f !== this.fase;
      this.fase = f;
      if (cambio && f === 1 && vol > 0 && W.Audio) W.Audio.sfx(this.car === 'g' ? 'siseo' : this.car === 'k' ? 'hidraulica' : 'zumbido', vol);
      if (this.car === 'e') {
        mapa.texSuelo[this.i] = tz.electrico[f];
        if (f === 2 && dentro) nivel.danarJugador(2, 'DESCARGA ELECTRICA');
      } else if (this.car === 'g') {
        mapa.texSuelo[this.i] = tz.gas[f];
        if (f === 2 && dentro && this.tDanio <= 0) { this.tDanio = 0.7; nivel.danarJugador(1, 'GAS TOXICO', true); }
      } else if (this.car === 'l') {
        if (f === 2 && dentro) nivel.danarJugador(2, 'LASER');
      } else if (this.car === 'k') {
        if (f === 2) {
          if (cambio) {
            mapa.fijar(this.x, this.y, CEL.APLASTADOR);
            mapa.texSuelo[this.i] = null;
            if (vol > 0 && W.Audio) W.Audio.sfx('golpeMetal', vol);
            if (dentro) { nivel.danarJugador(3, 'APLASTADO', true); jug.volverASeguro(); }
          }
        } else {
          if (mapa.celda(this.x, this.y) === CEL.APLASTADOR) mapa.fijar(this.x, this.y, 0);
          mapa.texSuelo[this.i] = f === 1 ? tz.avisoAplastador : null;
        }
      }
      return;
    }

    if (DIRS[this.car]) {
      const d = DIRS[this.car];
      mapa.texSuelo[this.i] = tz.ventila[d[2]];
      if (dentro) { jug.empujeX += d[0] * 1.5; jug.empujeY += d[1] * 1.5; nivel.viento = Math.max(nivel.viento, 1); }
      return;
    }

    if (this.car === 'Q' || this.car === 'O' || this.car === 'A') {
      const simbolo = this.car === 'Q' ? 0 : this.car === 'O' ? 1 : 2;
      mapa.texSuelo[this.i] = tz.baldosas[simbolo];
      if (dentro && simbolo !== nivel.baldosaSegura()) {
        if (nivel.danarJugador(2, 'BALDOSA ELECTRIFICADA')) {
          if (W.Audio) W.Audio.sfx('chispazo');
        }
        jug.volverASeguro();
      }
    }
  };

  Trampa.prototype.sprite = function () {
    if (this.car !== 'l') return null;
    return { x: this.x + 0.5, y: this.y + 0.5, tex: W.texturas.sprites.laser[this.fase < 0 ? 0 : this.fase], escala: 1.0, z: 0 };
  };

  W.Trampas = {
    crear: function (car, x, y, def, mapa) { return new Trampa(car, x, y, def, mapa); },
    esTrampa: function (car) { return 'elkg<>^vQOA'.indexOf(car) >= 0; }
  };
})();

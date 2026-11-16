// =====================================================
// Mapa del nivel: cuadrícula de casillas + capas auxiliares
//  celdas     : código de cada casilla (ver W.CELDA en config.js)
//  meta       : datos extra por casilla (puertas, hologramas) tomados de la leyenda del nivel
//  entidades  : lo que va sobre el piso (enemigos, trampas, botiquines) para que el nivel lo cree
//  texCelda   : textura propia de una pared (hologramas, estación activa, núcleo)
//  texSuelo   : textura propia del piso (trampas)
//  visto      : casillas que el jugador ya vio (mapa automático)
//  bloqueo    : casillas ocupadas por algo sólido que no es pared (guardianes)
//  apertura   : animación de puertas que se abren (0 a 1)
//  cono       : casillas iluminadas por el cono de un dron (índice del dron + 1)
// =====================================================
(function () {
  'use strict';
  const CEL = W.CELDA;

  function Mapa(def) {
    this.alto = def.mapa.length;
    this.ancho = def.mapa[0].length;
    const n = this.ancho * this.alto;
    this.celdas = new Uint8Array(n);
    this.meta = {};
    this.entidades = [];
    this.texCelda = new Array(n).fill(null);
    this.texSuelo = new Array(n).fill(null);
    this.visto = new Uint8Array(n);
    this.bloqueo = new Uint8Array(n);
    this.apertura = new Float32Array(n);
    this.cono = new Uint8Array(n);
    const leyenda = def.leyenda || {};

    for (let y = 0; y < this.alto; y++) {
      const fila = def.mapa[y];
      for (let x = 0; x < this.ancho; x++) {
        const ch = fila[x] || '#';
        const i = y * this.ancho + x;
        let codigo = 0;
        if (W.CARACTERES[ch] !== undefined) {
          codigo = W.CARACTERES[ch];
        } else if (ch >= '1' && ch <= '9') {
          // Puerta definida en la leyenda
          const d = leyenda[ch] || {};
          codigo = d.objeto && !d.puzzle ? CEL.PUERTA_TARJETA : d.riesgo ? CEL.PUERTA_MAGENTA : CEL.PUERTA;
          this.meta[i] = { car: ch, def: d };
        } else if (W.HOLOGRAMAS.indexOf(ch) >= 0) {
          // Holograma con pista
          codigo = CEL.HOLOGRAMA;
          this.meta[i] = { car: ch, def: leyenda[ch] || {} };
        } else if (W.ENTIDADES_MAPA.indexOf(ch) >= 0) {
          codigo = 0;
          this.entidades.push({ car: ch, x: x, y: y, def: leyenda[ch] || null });
        } else {
          codigo = CEL.PANEL;   // carácter desconocido: pared
        }
        this.celdas[i] = codigo;
      }
    }
  }

  Mapa.prototype.indice = function (x, y) { return y * this.ancho + x; };

  // Tipo de la casilla (fuera del mapa se considera pared)
  Mapa.prototype.celda = function (x, y) {
    if (x < 0 || y < 0 || x >= this.ancho || y >= this.alto) return 1;
    return this.celdas[y * this.ancho + x];
  };

  // ¿Es sólido el punto (x, y) en coordenadas del mundo? (paredes y bloqueos)
  Mapa.prototype.solida = function (x, y) {
    const cx = Math.floor(x), cy = Math.floor(y);
    if (cx < 0 || cy < 0 || cx >= this.ancho || cy >= this.alto) return true;
    const i = cy * this.ancho + cx;
    return this.celdas[i] > 0 || this.bloqueo[i] > 0;
  };

  // ¿Hay línea de visión entre dos puntos? (muestreo simple a lo largo del segmento)
  Mapa.prototype.lineaVision = function (x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const pasos = Math.ceil(d * 4);
    for (let k = 1; k < pasos; k++) {
      const t = k / pasos;
      if (this.celda(Math.floor(x0 + (x1 - x0) * t), Math.floor(y0 + (y1 - y0) * t)) > 0) return false;
    }
    return true;
  };

  // Cambiar una casilla (abrir puertas, aplastadores)
  Mapa.prototype.fijar = function (x, y, tipo) {
    if (x < 0 || y < 0 || x >= this.ancho || y >= this.alto) return;
    this.celdas[y * this.ancho + x] = tipo;
  };

  W.Mapa = Mapa;
})();

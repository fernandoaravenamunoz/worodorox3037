// =====================================================
// Motor de salas 2D (capa 2): ductos y compartimentos vistos en corte.
// Se entra por las puertas de marco amarillo del laberinto.
//
// Baldosas del mapa de una sala (10×10 píxeles cada una):
//   #  pared sólida            -  plataforma de un sentido (se atraviesa desde abajo)
//   ^  pinchos                 B  caja rompible (cualquier arma)
//   R  rejilla reforzada (solo la rompe Tuerca)
//   C  caja empujable          m  plataforma móvil horizontal   v  plataforma móvil vertical
//   s  interruptor (se activa golpeándolo o con proyectil; alterna bloques a / b)
//   a  bloque sólido con el interruptor apagado   b  bloque sólido con el interruptor encendido
//   o  placa de presión (abre las compuertas g mientras algo la pisa)
//   g  compuerta de placa      G  compuerta de terminal (se abre al resolver el terminal T)
//   T  terminal: se resuelve con una PISTA vista en el laberinto
//   K  objeto de la sala (llave, tarjeta, fragmento) que se necesita en el laberinto
//   h  botiquín                x  bicho de mantenimiento (se derriba con el arma)
//   F  punto de reaparición dentro de la sala
//   P  inicio del jugador      E  salida (vuelve al laberinto con la puerta abierta)
// =====================================================
(function () {
  'use strict';
  const C = W.config, PAL = W.paleta;
  const TS = C.T2D;
  const A = C.ANCHO, H = C.ALTO, HB = C.HUD_ALTO;

  // ---------- Imágenes de baldosas (se generan una vez por zona) ----------
  const COLORES_ZONA = {
    1: { base: '#2a2a3c', luz: '#3a3a52', sombra: '#16151f', fondo: ['#07060d', '#0d0b18', '#120f1f'], acento: '#22e4ff' },
    2: { base: '#382d29', luz: '#4f3f36', sombra: '#191210', fondo: ['#0a0706', '#140e0b', '#1d1410'], acento: '#ff8a2b' },
    3: { base: '#241a33', luz: '#36284a', sombra: '#0f0a17', fondo: ['#06040a', '#0d0814', '#160d22'], acento: '#b44dff' },
    4: { base: '#1d2a30', luz: '#2c3e47', sombra: '#0b1215', fondo: ['#020308', '#070d12', '#0b1418'], acento: '#22e4ff' }
  };
  const cacheTiles = {};
  function lienzo(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  function crearTiles(zona) {
    if (cacheTiles[zona]) return cacheTiles[zona];
    const z = COLORES_ZONA[zona] || COLORES_ZONA[1];
    const t = {};
    function nueva(dibujar) { const c = lienzo(TS, TS); dibujar(c.getContext('2d')); return c; }
    t['#'] = nueva(function (g) {
      g.fillStyle = z.base; g.fillRect(0, 0, TS, TS);
      g.fillStyle = z.luz; g.fillRect(0, 0, TS, 1); g.fillRect(0, 0, 1, TS);
      g.fillStyle = z.sombra; g.fillRect(0, TS - 1, TS, 1); g.fillRect(TS - 1, 0, 1, TS);
      g.fillStyle = '#7a828d'; g.fillRect(2, 2, 1, 1); g.fillRect(7, 7, 1, 1);
    });
    t['-'] = nueva(function (g) {
      g.fillStyle = '#4a4f63'; g.fillRect(0, 0, TS, 3);
      g.fillStyle = PAL.amarillo; g.fillRect(0, 0, TS, 1);
      g.fillStyle = '#2a2a3c'; g.fillRect(1, 3, 1, 3); g.fillRect(8, 3, 1, 3);
    });
    t['^'] = nueva(function (g) {
      // Tres pinchos triangulares
      for (let k = 0; k < 3; k++) {
        for (let j = 0; j < 4; j++) {
          g.fillStyle = j === 0 ? '#e6e3ff' : '#8d93ad';
          g.fillRect(k * 3 + 1 - (j >> 1), 5 + j, 1 + (j >> 1) * 2, 1);
        }
      }
      g.fillStyle = PAL.rojo; g.fillRect(0, TS - 1, TS, 1);
    });
    t.B = nueva(function (g) {
      g.fillStyle = '#7a4a2a'; g.fillRect(0, 0, TS, TS);
      g.fillStyle = '#9a6a3a'; g.fillRect(0, 0, TS, 1); g.fillRect(0, 0, 1, TS);
      g.fillStyle = '#4a2a1a'; g.fillRect(1, 4, 8, 1); g.fillRect(4, 1, 1, 8);
    });
    t.R = nueva(function (g) {
      g.fillStyle = '#16151f'; g.fillRect(0, 0, TS, TS);
      g.fillStyle = '#6b6f80';
      for (let k = 1; k < TS; k += 3) { g.fillRect(k, 0, 1, TS); g.fillRect(0, k, TS, 1); }
      g.fillStyle = PAL.amarillo; g.fillRect(0, 0, 2, 2); g.fillRect(8, 8, 2, 2);
    });
    t.a = nueva(function (g) { g.fillStyle = '#0f5a6b'; g.fillRect(0, 0, TS, TS); g.fillStyle = PAL.cian; g.fillRect(1, 1, 8, 1); g.fillRect(1, 8, 8, 1); g.fillRect(1, 1, 1, 8); g.fillRect(8, 1, 1, 8); });
    t.aOff = nueva(function (g) { g.fillStyle = 'rgba(34,228,255,0.25)'; g.fillRect(1, 1, 8, 1); g.fillRect(1, 8, 8, 1); g.fillRect(1, 1, 1, 8); g.fillRect(8, 1, 1, 8); });
    t.b = nueva(function (g) { g.fillStyle = '#7a1466'; g.fillRect(0, 0, TS, TS); g.fillStyle = PAL.magenta; g.fillRect(1, 1, 8, 1); g.fillRect(1, 8, 8, 1); g.fillRect(1, 1, 1, 8); g.fillRect(8, 1, 1, 8); });
    t.bOff = nueva(function (g) { g.fillStyle = 'rgba(255,43,214,0.25)'; g.fillRect(1, 1, 8, 1); g.fillRect(1, 8, 8, 1); g.fillRect(1, 1, 1, 8); g.fillRect(8, 1, 1, 8); });
    t.g = nueva(function (g) { g.fillStyle = '#2d3140'; g.fillRect(2, 0, 6, TS); g.fillStyle = PAL.amarillo; g.fillRect(2, 0, 6, 1); g.fillRect(4, 2, 2, 6); });
    t.G = nueva(function (g) { g.fillStyle = '#2d3140'; g.fillRect(1, 0, 8, TS); g.fillStyle = PAL.cian; g.fillRect(1, 0, 8, 1); g.fillRect(3, 3, 4, 1); g.fillRect(3, 6, 4, 1); });
    t.C = nueva(function (g) {
      g.fillStyle = '#4a4f63'; g.fillRect(0, 0, TS, TS);
      g.fillStyle = '#6b6f80'; g.fillRect(0, 0, TS, 1); g.fillRect(0, 0, 1, TS);
      g.fillStyle = '#2a2a3c'; g.fillRect(2, 2, 6, 6);
      g.fillStyle = PAL.amarillo; g.fillRect(3, 4, 4, 2);
    });
    cacheTiles[zona] = t;
    t.zona = z;
    return t;
  }

  // ===================== SALA =====================
  // def: datos de la sala (ver niveles). op: { jug (jugador del laberinto, comparte vida),
  //   personaje, zona, objetoYaObtenido, alTerminal(callback) }
  function Sala(def, op) {
    this.def = def;
    this.op = op;
    this.p = W.PERSONAJES[op.personaje] || W.PERSONAJES.chispa;
    this.jugVida = op.jug;      // el mismo objeto jugador del laberinto (vida compartida)
    this.tiles = crearTiles(op.zona);
    this.alto = def.mapa.length;
    this.ancho = def.mapa[0].length;
    this.mapa = def.mapa.map(function (f) { return f.split(''); });
    this.plataformas = [];
    this.cajas = [];
    this.bichos = [];
    this.proyectiles = [];
    this.particulas = [];
    this.interruptor = false;
    this.terminalResuelto = false;
    this.placaPresionada = false;
    this.resultado = null;
    this.tiempo = 0;
    this.objetoTomado = !!op.objetoYaObtenido;
    this.mensaje = def.texto || '';
    this.tMensaje = 4;
    let inicio = { x: 20, y: 20 };
    for (let ty = 0; ty < this.alto; ty++) {
      for (let tx = 0; tx < this.ancho; tx++) {
        const ch = this.mapa[ty][tx];
        const x = tx * TS, y = ty * TS;
        if (ch === 'P') { inicio = { x: x + 2, y: y - 3 }; this.mapa[ty][tx] = '.'; }
        else if (ch === 'm' || ch === 'v') {
          this.plataformas.push({ x: x - 5, y: y, w: 20, h: 4, tipo: ch, vel: ch === 'm' ? 32 : 26, dir: 1, dx: 0, dy: 0 });
          this.mapa[ty][tx] = '.';
        } else if (ch === 'C') { this.cajas.push({ x: x, y: y, w: TS, h: TS, vy: 0, x0: x, y0: y }); this.mapa[ty][tx] = '.'; }
        else if (ch === 'x') { this.bichos.push({ x: x + 1, y: y + 3, w: 8, h: 7, vx: 22, vivo: true, x0: x + 1, y0: y + 3 }); this.mapa[ty][tx] = '.'; }
        else if (ch === 'K' && this.objetoTomado) this.mapa[ty][tx] = '.';
      }
    }
    this.inicio = inicio;
    this.reaparicion = { x: inicio.x, y: inicio.y };
    this.j = { x: inicio.x, y: inicio.y, w: 6, h: 13, vx: 0, vy: 0, suelo: false, coyote: 0, buffer: 0, dir: 1, paso: 0, ataque: 0, recarga: 0, sobre: null, cortado: false };
    this.persecucion = def.persecucion ? { x: inicio.x - 70, vel: def.persecucion } : null;
    this.camX = 0; this.camY = 0;
    this.altoVisible = H - HB;
  }

  // ---------- Consultas de baldosas ----------
  Sala.prototype.tile = function (tx, ty) {
    if (tx < 0 || tx >= this.ancho) return '#';
    if (ty < 0) return '#';
    if (ty >= this.alto) return '.';
    return this.mapa[ty][tx];
  };
  Sala.prototype.esSolida = function (ch) {
    switch (ch) {
      case '#': case 'B': case 'R': return true;
      case 'a': return !this.interruptor;
      case 'b': return this.interruptor;
      case 'g': return !this.placaPresionada;
      case 'G': return !this.terminalResuelto;
      default: return false;
    }
  };
  Sala.prototype.solidaEn = function (px, py) {
    return this.esSolida(this.tile(Math.floor(px / TS), Math.floor(py / TS)));
  };
  // ¿Choca un rectángulo con baldosas sólidas?
  Sala.prototype.chocaRect = function (x, y, w, h) {
    const x0 = Math.floor(x / TS), x1 = Math.floor((x + w - 0.01) / TS);
    const y0 = Math.floor(y / TS), y1 = Math.floor((y + h - 0.01) / TS);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.esSolida(this.tile(tx, ty))) return true;
    return false;
  };
  function solapa(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

  // Superficie de un sentido bajo un rectángulo que cae (devuelve la Y del borde superior o null)
  Sala.prototype.unSentido = function (x, yAntes, yDespues, w, h) {
    const piesAntes = yAntes + h, piesDespues = yDespues + h;
    const x0 = Math.floor(x / TS), x1 = Math.floor((x + w - 0.01) / TS);
    const ty = Math.floor(piesDespues / TS);
    const borde = ty * TS;
    if (piesAntes <= borde + 0.01 && piesDespues >= borde) {
      for (let tx = x0; tx <= x1; tx++) if (this.tile(tx, ty) === '-') return borde;
    }
    return null;
  };

  // ===================== ACTUALIZACIÓN =====================
  // entrada: { mover2d, saltoMantenido }  eventos: { salto, accion }
  Sala.prototype.actualizar = function (dt, entrada, eventos) {
    if (this.resultado) return;
    this.tiempo += dt;
    if (this.tMensaje > 0) this.tMensaje -= dt;
    const j = this.j, p = this.p;

    this.moverPlataformas(dt);

    // --- Entrada horizontal y salto (coyote time + jump buffer) ---
    const objetivo = entrada.mover2d * C.VEL_2D * p.velocidad;
    j.vx += (objetivo - j.vx) * Math.min(1, dt * 18);
    if (entrada.mover2d !== 0) j.dir = entrada.mover2d;
    if (eventos.salto) j.buffer = C.BUFFER_SALTO;
    j.buffer -= dt;
    j.coyote = j.suelo ? C.COYOTE : j.coyote - dt;
    if (j.buffer > 0 && j.coyote > 0) {
      j.vy = -C.SALTO_2D * p.salto;
      j.buffer = 0; j.coyote = 0; j.suelo = false; j.sobre = null; j.cortado = false;
      if (W.Audio) W.Audio.sfx('salto');
    }
    // Salto variable: soltar el botón corta la subida
    if (!entrada.saltoMantenido && j.vy < -60 && !j.cortado) { j.vy = -60; j.cortado = true; }
    j.vy = Math.min(420, j.vy + C.GRAVEDAD * dt);

    // --- Arrastre por plataforma móvil ---
    if (j.sobre) { j.x += j.sobre.dx; j.y += j.sobre.dy; }

    // --- Movimiento horizontal (con empuje de cajas) ---
    this.moverX(j, j.vx * dt, true);
    // --- Movimiento vertical ---
    this.moverY(j, j.vy * dt);
    if (Math.abs(j.vx) > 8 && j.suelo) j.paso += dt * 14;

    // --- Cajas, bichos, proyectiles ---
    this.actualizarCajas(dt);
    this.actualizarBichos(dt);
    this.actualizarProyectiles(dt);
    this.actualizarPlaca();

    // --- Ataque / terminal ---
    if (j.recarga > 0) j.recarga -= dt;
    if (j.ataque > 0) { j.ataque -= dt; }
    if (eventos.accion) this.accion();

    // --- Peligros y objetos ---
    this.revisarContacto(dt);

    // --- Persecución ---
    if (this.persecucion) {
      const pe = this.persecucion;
      pe.x += pe.vel * dt;
      if (j.x < pe.x + 6) this.herir(3, true);
    }
    // Partículas
    for (let k = this.particulas.length - 1; k >= 0; k--) {
      const q = this.particulas[k];
      q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 300 * dt; q.t -= dt;
      if (q.t <= 0) this.particulas.splice(k, 1);
    }
    this.actualizarCamara();
  };

  Sala.prototype.moverPlataformas = function (dt) {
    for (const pl of this.plataformas) {
      const ox = pl.x, oy = pl.y;
      if (pl.tipo === 'm') {
        const nx = pl.x + pl.vel * pl.dir * dt;
        const borde = pl.dir > 0 ? nx + pl.w : nx;
        if (this.solidaEn(borde, pl.y + 2)) pl.dir = -pl.dir; else pl.x = nx;
      } else {
        const ny = pl.y + pl.vel * pl.dir * dt;
        const borde = pl.dir > 0 ? ny + pl.h : ny;
        if (this.solidaEn(pl.x + 2, borde) || this.solidaEn(pl.x + pl.w - 2, borde) || ny < 0 || ny > this.alto * TS) pl.dir = -pl.dir; else pl.y = ny;
      }
      pl.dx = pl.x - ox; pl.dy = pl.y - oy;
    }
  };

  // Movimiento horizontal con colisión; si "empuja", intenta mover cajas
  Sala.prototype.moverX = function (e, dx, empuja) {
    if (dx === 0) return;
    const nx = e.x + dx;
    if (this.chocaRect(nx, e.y, e.w, e.h)) {
      // Se pega a la pared
      if (dx > 0) e.x = Math.floor((nx + e.w) / TS) * TS - e.w - 0.01; else e.x = Math.floor(nx / TS) * TS + TS + 0.01;
      e.vx = 0;
      return;
    }
    // Cajas
    for (const c of this.cajas) {
      if (c === e) continue;
      const r = { x: nx, y: e.y, w: e.w, h: e.h };
      if (!solapa(r, c)) continue;
      if (empuja && Math.abs(e.y + e.h - (c.y + c.h)) < 6) {
        const paso = dx * 0.6;
        const antes = c.x;
        this.moverX(c, paso, false);
        if (c.x !== antes && !solapa({ x: e.x + (c.x - antes), y: e.y, w: e.w, h: e.h }, c)) { e.x += c.x - antes; return; }
      }
      e.x = dx > 0 ? c.x - e.w - 0.01 : c.x + c.w + 0.01;
      return;
    }
    e.x = nx;
  };

  // Movimiento vertical con colisión (baldosas, un sentido, cajas, plataformas)
  Sala.prototype.moverY = function (e, dy) {
    const antes = e.y;
    const ny = e.y + dy;
    e.suelo = false;
    const eraSobre = e.sobre; e.sobre = null;
    if (this.chocaRect(e.x, ny, e.w, e.h)) {
      if (dy > 0) { e.y = Math.floor((ny + e.h) / TS) * TS - e.h; e.suelo = true; }
      else e.y = Math.floor(ny / TS) * TS + TS;
      e.vy = 0;
    } else e.y = ny;
    if (dy >= 0) {
      const borde = this.unSentido(e.x, antes, e.y, e.w, e.h);
      if (borde !== null) { e.y = borde - e.h; e.vy = 0; e.suelo = true; }
      // Cajas como suelo
      for (const c of this.cajas) {
        if (c === e) continue;
        if (e.x + e.w > c.x + 0.5 && e.x < c.x + c.w - 0.5 && antes + e.h <= c.y + 0.5 && e.y + e.h >= c.y) {
          e.y = c.y - e.h; e.vy = 0; e.suelo = true;
        }
      }
      // Plataformas móviles (se suben por arriba)
      for (const pl of this.plataformas) {
        const margen = eraSobre === pl ? 3 : 0.5;
        if (e.x + e.w > pl.x && e.x < pl.x + pl.w && antes + e.h <= pl.y + margen && e.y + e.h >= pl.y) {
          e.y = pl.y - e.h; e.vy = 0; e.suelo = true; e.sobre = pl;
        }
      }
    } else {
      // Golpe de cabeza contra cajas
      for (const c of this.cajas) {
        if (c === e) continue;
        if (solapa(e, c)) { e.y = c.y + c.h; e.vy = 0; }
      }
    }
  };

  Sala.prototype.actualizarCajas = function (dt) {
    for (const c of this.cajas) {
      c.vy = Math.min(420, (c.vy || 0) + C.GRAVEDAD * dt);
      if (c.sobre) { this.moverX(c, c.sobre.dx, false); c.y += c.sobre.dy; }
      this.moverY(c, c.vy * dt);
      if (c.y > this.alto * TS + 40) { c.x = c.x0; c.y = c.y0; c.vy = 0; }   // cayó al vacío: reaparece
    }
  };

  Sala.prototype.actualizarBichos = function (dt) {
    for (const b of this.bichos) {
      if (!b.vivo) continue;
      const nx = b.x + b.vx * dt;
      const frente = b.vx > 0 ? nx + b.w : nx;
      const sinSuelo = !this.solidaEn(frente, b.y + b.h + 2) && this.tile(Math.floor(frente / TS), Math.floor((b.y + b.h + 2) / TS)) !== '-';
      if (this.solidaEn(frente, b.y + 3) || sinSuelo) b.vx = -b.vx; else b.x = nx;
    }
  };

  Sala.prototype.actualizarPlaca = function () {
    let presion = false;
    const ents = [this.j].concat(this.cajas);
    for (const e of ents) {
      const tx0 = Math.floor((e.x + 1) / TS), tx1 = Math.floor((e.x + e.w - 1) / TS);
      const ty = Math.floor((e.y + e.h - 2) / TS);
      for (let tx = tx0; tx <= tx1; tx++) if (this.tile(tx, ty) === 'o') presion = true;
    }
    if (presion !== this.placaPresionada) {
      // No cerrar una compuerta encima de alguien
      if (!presion && this.algoEnCompuerta('g')) return;
      this.placaPresionada = presion;
      if (W.Audio) W.Audio.sfx(presion ? 'puerta' : 'clic');
    }
  };
  Sala.prototype.algoEnCompuerta = function (ch) {
    const ents = [this.j].concat(this.cajas);
    for (const e of ents) {
      const x0 = Math.floor(e.x / TS), x1 = Math.floor((e.x + e.w - 0.01) / TS);
      const y0 = Math.floor(e.y / TS), y1 = Math.floor((e.y + e.h - 0.01) / TS);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.tile(tx, ty) === ch) return true;
    }
    return false;
  };

  // ---------- Ataque, interruptores y terminal ----------
  Sala.prototype.accion = function () {
    const j = this.j;
    // Terminal cercano
    const cx = j.x + j.w / 2, cy = j.y + j.h / 2;
    const tx = Math.floor(cx / TS), ty = Math.floor(cy / TS);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (this.tile(tx + dx, ty + dy) === 'T' && !this.terminalResuelto) { this.abrirTerminal(); return; }
    }
    if (j.recarga > 0) return;
    j.recarga = this.p.recarga;
    j.ataque = 0.18;
    if (this.p.proyectil) {
      this.proyectiles.push({ x: cx + j.dir * 4, y: j.y + 5, vx: j.dir * this.p.velProyectil, recorrido: 0, max: this.p.alcance2d });
      if (W.Audio) W.Audio.sfx('lanzar');
    } else {
      if (W.Audio) W.Audio.sfx('golpe');
      const alc = this.p.alcance2d;
      const hit = { x: j.dir > 0 ? j.x + j.w : j.x - alc, y: j.y + 1, w: alc, h: j.h - 3 };
      this.golpearZona(hit, true);
    }
  };

  // Aplica un golpe a baldosas y bichos dentro de un rectángulo. Devuelve true si golpeó algo.
  Sala.prototype.golpearZona = function (r, cuerpo) {
    let golpe = false;
    const x0 = Math.floor(r.x / TS), x1 = Math.floor((r.x + r.w) / TS);
    const y0 = Math.floor(r.y / TS), y1 = Math.floor((r.y + r.h) / TS);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const ch = this.tile(tx, ty);
      if (ch === 'B' || (ch === 'R' && cuerpo && this.p.fuerza)) {
        this.mapa[ty][tx] = '.'; golpe = true;
        this.chispas(tx * TS + 5, ty * TS + 5, ch === 'B' ? '#9a6a3a' : '#8d93ad');
        if (W.Audio) W.Audio.sfx('romper');
      } else if (ch === 'R' && cuerpo) {
        if (!this.avisoRejilla) { this.mensaje = 'REJILLA REFORZADA: SOLO TUERCA PUEDE FORZARLA'; this.tMensaje = 2.5; this.avisoRejilla = true; }
      } else if (ch === 's') { this.alternar(); golpe = true; }
    }
    for (const b of this.bichos) {
      if (b.vivo && solapa(r, b)) { b.vivo = false; golpe = true; this.chispas(b.x + 4, b.y + 3, PAL.rojo); if (W.Audio) W.Audio.sfx('aturdir'); }
    }
    return golpe;
  };

  Sala.prototype.alternar = function () {
    this.interruptor = !this.interruptor;
    if (W.Audio) W.Audio.sfx('interruptor');
    // Si un bloque aparece encima del jugador, lo empuja hacia arriba
    let n = 0;
    while (this.chocaRect(this.j.x, this.j.y, this.j.w, this.j.h) && n++ < 30) this.j.y -= 1;
  };

  Sala.prototype.actualizarProyectiles = function (dt) {
    for (let k = this.proyectiles.length - 1; k >= 0; k--) {
      const q = this.proyectiles[k];
      const paso = q.vx * dt;
      q.x += paso; q.recorrido += Math.abs(paso);
      const r = { x: q.x - 2, y: q.y - 1, w: 4, h: 3 };
      const ch = this.tile(Math.floor(q.x / TS), Math.floor(q.y / TS));
      let fin = q.recorrido > q.max;
      if (ch === 's' || ch === 'B') { this.golpearZona(r, false); fin = true; }
      else if (this.esSolida(ch)) { fin = true; this.chispas(q.x, q.y, '#8d93ad'); }
      else if (this.golpearZona(r, false)) fin = true;
      if (fin) this.proyectiles.splice(k, 1);
    }
  };

  Sala.prototype.abrirTerminal = function () {
    const self = this;
    if (!this.op.alTerminal) return;
    this.op.alTerminal(this.def.terminal || {}, function (res) {
      if (res === 'exito') {
        self.terminalResuelto = true;
        self.mensaje = 'TERMINAL DESBLOQUEADO: COMPUERTA ABIERTA'; self.tMensaje = 3;
      }
    });
  };

  // ---------- Daño, objetos, salida ----------
  Sala.prototype.herir = function (n, reaparecer) {
    const jug = this.jugVida;
    if (!jug.danar(n, reaparecer)) { if (!reaparecer) return; }
    if (jug.vida <= 0) { this.resultado = 'muerte'; return; }
    if (reaparecer) {
      this.j.x = this.reaparicion.x; this.j.y = this.reaparicion.y;
      this.j.vx = 0; this.j.vy = 0; this.j.sobre = null;
      if (this.persecucion) this.persecucion.x = this.reaparicion.x - 70;
    }
  };

  Sala.prototype.revisarContacto = function (dt) {
    const j = this.j, jug = this.jugVida;
    if (jug.invulnerable > 0) jug.invulnerable -= dt;
    if (jug.flashDanio > 0) jug.flashDanio -= dt;
    // Caída al vacío
    if (j.y > this.alto * TS + 20) { this.herir(2, true); return; }
    // Baldosas que toca
    const x0 = Math.floor((j.x + 1) / TS), x1 = Math.floor((j.x + j.w - 1) / TS);
    const y0 = Math.floor((j.y + 1) / TS), y1 = Math.floor((j.y + j.h - 1) / TS);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const ch = this.tile(tx, ty);
      if (ch === '^' && j.y + j.h > ty * TS + 5) { this.herir(2, true); return; }
      if (ch === 'K') {
        this.mapa[ty][tx] = '.';
        this.objetoTomado = true;
        this.mensaje = 'OBTUVISTE: ' + (this.def.objeto || 'OBJETO'); this.tMensaje = 3;
        if (W.Audio) W.Audio.sfx('objeto');
      }
      if (ch === 'h' && jug.vida < jug.vidaMax) {
        this.mapa[ty][tx] = '.'; jug.curar(4);
        this.mensaje = 'BOTIQUIN: +4 VIDA'; this.tMensaje = 2;
        if (W.Audio) W.Audio.sfx('objeto');
      }
      if (ch === 'F') {
        if (this.reaparicion.x !== tx * TS + 2 || this.reaparicion.y !== ty * TS - 3) {
          this.reaparicion = { x: tx * TS + 2, y: ty * TS - 3 };
          if (W.Audio) W.Audio.sfx('pista');
        }
      }
      if (ch === 'E') {
        if (this.def.objeto && !this.objetoTomado) {
          if (!this.avisoSalida) { this.mensaje = 'TE FALTA ' + this.def.objeto + '. ESTA EN ESTA SALA'; this.tMensaje = 2.5; this.avisoSalida = true; }
        } else { this.resultado = 'salida'; if (W.Audio) W.Audio.sfx('puerta'); return; }
      }
    }
    // Bichos
    for (const b of this.bichos) {
      if (b.vivo && solapa(j, b)) {
        if (jug.danar(1)) { j.vy = -140; j.vx = (j.x < b.x ? -1 : 1) * 120; }
        if (jug.vida <= 0) { this.resultado = 'muerte'; return; }
      }
    }
  };

  Sala.prototype.chispas = function (x, y, color) {
    for (let k = 0; k < 8; k++) this.particulas.push({ x: x, y: y, vx: (Math.random() - 0.5) * 120, vy: -Math.random() * 120, t: 0.4 + Math.random() * 0.3, c: color });
  };

  Sala.prototype.actualizarCamara = function () {
    const j = this.j;
    const anchoPx = this.ancho * TS, altoPx = this.alto * TS;
    const objX = j.x + j.w / 2 - A / 2 + j.dir * 20;
    this.camX += (objX - this.camX) * 0.12;
    this.camX = Math.max(0, Math.min(Math.max(0, anchoPx - A), this.camX));
    if (altoPx <= this.altoVisible) this.camY = -Math.floor((this.altoVisible - altoPx) / 2);
    else {
      const objY = j.y - this.altoVisible / 2;
      this.camY += (objY - this.camY) * 0.15;
      this.camY = Math.max(0, Math.min(altoPx - this.altoVisible, this.camY));
    }
  };

  // ===================== DIBUJO =====================
  Sala.prototype.dibujar = function (ctx) {
    const z = this.tiles.zona, t = this.tiles;
    const cx = Math.round(this.camX), cy = Math.round(this.camY);
    // Fondo con bandas y tuberías en paralaje
    for (let i = 0; i < 3; i++) { ctx.fillStyle = z.fondo[i]; ctx.fillRect(0, i * 56, A, 60); }
    ctx.fillStyle = '#ffffff08';
    const off = -(cx * 0.35) % 48;
    for (let x = off; x < A; x += 48) { ctx.fillRect(x, 0, 6, H); ctx.fillRect(x + 14, 20, 2, H); }
    ctx.fillStyle = z.acento + '22';
    for (let x = -(cx * 0.2) % 90; x < A; x += 90) ctx.fillRect(x, 40, 30, 2);

    // Baldosas visibles
    const tx0 = Math.max(0, Math.floor(cx / TS)), tx1 = Math.min(this.ancho - 1, Math.floor((cx + A) / TS));
    const ty0 = Math.max(0, Math.floor(cy / TS)), ty1 = Math.min(this.alto - 1, Math.floor((cy + H) / TS));
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const ch = this.mapa[ty][tx];
      const x = tx * TS - cx, y = ty * TS - cy;
      let img = null;
      switch (ch) {
        case '#': case '-': case '^': case 'B': case 'R': img = t[ch]; break;
        case 'a': img = this.interruptor ? t.aOff : t.a; break;
        case 'b': img = this.interruptor ? t.b : t.bOff; break;
        case 'g': if (!this.placaPresionada) img = t.g; else { ctx.fillStyle = '#e8b92333'; ctx.fillRect(x + 2, y, 6, 1); } break;
        case 'G': if (!this.terminalResuelto) img = t.G; break;
        case 'o':
          ctx.fillStyle = this.placaPresionada ? PAL.verde : PAL.amarillo; ctx.fillRect(x + 1, y + 8, 8, 2);
          ctx.fillStyle = '#4a4f63'; ctx.fillRect(x, y + 9, 10, 1);
          break;
        case 's':
          ctx.fillStyle = '#2a2a3c'; ctx.fillRect(x + 2, y + 2, 6, 7);
          ctx.fillStyle = this.interruptor ? PAL.magenta : PAL.cian; ctx.fillRect(x + 3, y + 3, 4, 2);
          ctx.fillRect(this.interruptor ? x + 6 : x + 3, y + 5, 1, 4);
          break;
        case 'T': {
          ctx.fillStyle = '#1d1f2e'; ctx.fillRect(x, y - 6, 10, 16);
          const ok = this.terminalResuelto;
          ctx.fillStyle = ok ? '#0b2a1a' : '#06141a'; ctx.fillRect(x + 1, y - 5, 8, 6);
          ctx.fillStyle = ok ? PAL.verde : (Math.floor(this.tiempo * 3) % 2 ? PAL.cian : PAL.cianOsc);
          ctx.fillRect(x + 2, y - 4, 6, 1); ctx.fillRect(x + 2, y - 2, 4, 1);
          break;
        }
        case 'K': {
          const fy = y + Math.sin(this.tiempo * 4) * 1.5;
          ctx.fillStyle = PAL.blanco; ctx.fillRect(x + 1, fy + 2, 8, 6);
          ctx.fillStyle = PAL.cian; ctx.fillRect(x + 1, fy + 3, 8, 1);
          ctx.fillStyle = PAL.amarillo; ctx.fillRect(x + 2, fy + 5, 2, 2);
          if (Math.floor(this.tiempo * 4) % 2) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 8, fy, 1, 1); }
          break;
        }
        case 'h':
          ctx.fillStyle = PAL.blanco; ctx.fillRect(x + 2, y + 3, 6, 6);
          ctx.fillStyle = PAL.verde; ctx.fillRect(x + 4, y + 4, 2, 4); ctx.fillRect(x + 3, y + 5, 4, 2);
          break;
        case 'F': {
          const activo = this.reaparicion.x === tx * TS + 2 && this.reaparicion.y === ty * TS - 3;
          ctx.fillStyle = '#2a2a3c'; ctx.fillRect(x + 4, y + 2, 2, 8);
          ctx.fillStyle = activo ? PAL.verde : PAL.cianOsc; ctx.fillRect(x + 3, y, 4, 3);
          break;
        }
        case 'E':
          ctx.fillStyle = '#0b1a12'; ctx.fillRect(x, y, 10, 10);
          ctx.fillStyle = PAL.verde; ctx.fillRect(x, y, 10, 1); ctx.fillRect(x, y, 1, 10); ctx.fillRect(x + 9, y, 1, 10);
          if (this.tile(tx, ty - 1) !== 'E') { ctx.fillRect(x + 3, y + 3, 4, 1); ctx.fillRect(x + 4, y + 2, 2, 1); }
          break;
      }
      if (img) ctx.drawImage(img, x, y);
    }
    // Plataformas móviles
    for (const pl of this.plataformas) {
      const x = Math.round(pl.x - cx), y = Math.round(pl.y - cy);
      ctx.fillStyle = '#4a4f63'; ctx.fillRect(x, y, pl.w, pl.h);
      ctx.fillStyle = PAL.amarillo; ctx.fillRect(x, y, pl.w, 1);
      ctx.fillStyle = PAL.cian; ctx.fillRect(x + pl.w / 2 - 1, y + 2, 2, 1);
    }
    // Cajas
    for (const c of this.cajas) ctx.drawImage(t.C, Math.round(c.x - cx), Math.round(c.y - cy));
    // Bichos
    for (const b of this.bichos) {
      if (!b.vivo) continue;
      const x = Math.round(b.x - cx), y = Math.round(b.y - cy);
      ctx.fillStyle = '#3d2a2a'; ctx.fillRect(x, y + 1, 8, 4);
      ctx.fillStyle = '#6b4040'; ctx.fillRect(x + 1, y, 6, 1);
      ctx.fillStyle = PAL.rojo; ctx.fillRect(b.vx > 0 ? x + 6 : x + 1, y + 2, 1, 1);
      ctx.fillStyle = '#565d67';
      const pata = Math.floor(this.tiempo * 10) % 2;
      ctx.fillRect(x + pata, y + 5, 1, 2); ctx.fillRect(x + 3 + pata, y + 5, 1, 2); ctx.fillRect(x + 6 + pata, y + 5, 1, 2);
    }
    // Proyectiles
    ctx.fillStyle = this.p.id === 'flaco' ? '#c8cbd8' : PAL.amarillo;
    for (const q of this.proyectiles) ctx.fillRect(Math.round(q.x - cx - 2), Math.round(q.y - cy), this.p.id === 'flaco' ? 5 : 2, 2);
    // Jugador (parpadea si es invulnerable)
    const j = this.j;
    if (!(this.jugVida.invulnerable > 0 && Math.floor(this.tiempo * 16) % 2)) {
      W.Personajes.dibujarCuerpo(ctx, this.p.id, Math.round(j.x - 1 - cx), Math.round(j.y - cy), j.dir, j.paso, 1, j.ataque > 0);
      if (j.ataque > 0 && !this.p.proyectil) {
        ctx.fillStyle = PAL.cianClaro;
        const ax = j.dir > 0 ? j.x + j.w - cx : j.x - this.p.alcance2d - cx;
        ctx.fillRect(Math.round(ax), Math.round(j.y + 6 - cy), this.p.alcance2d, 1);
      }
    }
    // Partículas
    for (const q of this.particulas) { ctx.fillStyle = q.c; ctx.fillRect(Math.round(q.x - cx), Math.round(q.y - cy), 1, 1); }
    // Muro de persecución (gas/láser que avanza)
    if (this.persecucion) {
      const x = Math.round(this.persecucion.x - cx);
      if (x > -40) {
        ctx.fillStyle = 'rgba(255,59,59,0.25)'; ctx.fillRect(0, 0, Math.max(0, x), H);
        ctx.fillStyle = PAL.rojo; ctx.fillRect(x, 0, 2, H);
        for (let y = 0; y < H; y += 6) { ctx.fillStyle = (Math.floor(this.tiempo * 20 + y) % 3) ? '#ff8080' : PAL.magenta; ctx.fillRect(x - 3 + ((y * 7 + Math.floor(this.tiempo * 30)) % 5), y, 2, 2); }
      }
    }
    // Flash de daño
    if (this.jugVida.flashDanio > 0) { ctx.fillStyle = 'rgba(255,59,59,' + (this.jugVida.flashDanio * 0.9).toFixed(2) + ')'; ctx.fillRect(0, 0, A, H); }
  };

  // Texto de ayuda para el HUD
  Sala.prototype.textoAyuda = function () {
    if (this.tMensaje > 0) return this.mensaje;
    const j = this.j;
    const tx = Math.floor((j.x + 3) / TS), ty = Math.floor((j.y + 6) / TS);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (this.tile(tx + dx, ty + dy) === 'T' && !this.terminalResuelto) return 'USAR: TERMINAL (NECESITA UNA PISTA)';
    }
    return '';
  };

  W.Sala2D = Sala;
})();

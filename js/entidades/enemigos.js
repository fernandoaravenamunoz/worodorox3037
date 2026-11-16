// =====================================================
// Enemigos: sistemas de defensa de la nave que siguen activos.
// No se destruyen con armas: las armas los ATURDEN y luego se SELLAN con un puzzle.
//   dron       : patrulla una ruta fija (ida y vuelta) y muestra un cono rojo de detección
//   perseguidor: reacciona al ver al jugador y lo persigue
//   guardian   : bloquea un pasillo y golpea si te acercas
// =====================================================
(function () {
  'use strict';
  const SPR = W.texturas.sprites;

  function Enemigo(tipo, x, y, id, def) {
    this.tipo = tipo;
    this.id = id;
    this.x = x + 0.5; this.y = y + 0.5;
    this.x0 = this.x; this.y0 = this.y;
    this.estado = 'activo';      // 'activo' | 'aturdido' | 'sellado'
    this.tAturdido = 0;
    this.reloj = 0;
    this.ang = 0;
    this.def = def || {};
    this.detecta = false;
    this.tAlerta = 0;
    if (tipo === 'dron') {
      this.vel = this.def.vel || 1.1;
      this.dx = def && def.vertical ? 0 : 1;
      this.dy = def && def.vertical ? 1 : 0;
      this.ang = Math.atan2(this.dy, this.dx);
    }
    if (tipo === 'perseguidor') { this.vel = this.def.vel || 1.6; this.visto = 0; this.ux = this.x; this.uy = this.y; }
  }

  Enemigo.prototype.reiniciar = function () {
    if (this.estado === 'sellado') return;
    this.x = this.x0; this.y = this.y0;
    this.estado = 'activo'; this.tAturdido = 0; this.tAlerta = 0; this.detecta = false;
  };

  Enemigo.prototype.aturdir = function (seg) {
    if (this.estado === 'sellado') return;
    this.estado = 'aturdido';
    this.tAturdido = Math.max(this.tAturdido, seg);
    this.detecta = false;
    if (W.Audio) W.Audio.sfx('aturdir');
  };

  Enemigo.prototype.sellar = function (mapa) {
    this.estado = 'sellado';
    if (this.tipo === 'guardian') mapa.bloqueo[Math.floor(this.y) * mapa.ancho + Math.floor(this.x)] = 0;
  };

  // Movimiento con colisión (círculo contra la cuadrícula)
  function moverCon(e, mx, my, mapa, r) {
    if (!mapa.solida(e.x + mx + Math.sign(mx) * r, e.y)) e.x += mx;
    if (!mapa.solida(e.x, e.y + my + Math.sign(my) * r)) e.y += my;
  }

  // nivel.objetivos() entrega los jugadores que pueden ser atacados:
  // [{ x, y, ang, p, local, puesto }]. En un jugador es solo uno.
  function masCercano(e, objs, mapa, conVision, maxDist) {
    let mejor = null, mejorD = 1e9;
    for (const o of objs) {
      const d = Math.hypot(o.x - e.x, o.y - e.y);
      if (d > maxDist || d >= mejorD) continue;
      if (conVision && !mapa.lineaVision(e.x, e.y, o.x, o.y)) continue;
      mejor = o; mejorD = d;
    }
    return mejor;
  }

  Enemigo.prototype.actualizar = function (dt, nivel) {
    const mapa = nivel.mapa;
    if (this.estado === 'sellado') return;
    this.reloj += dt;
    if (this.estado === 'aturdido') {
      this.tAturdido -= dt;
      if (this.tAturdido <= 0) { this.estado = 'activo'; this.tAturdido = 0; }
      return;
    }
    const objs = nivel.objetivos();

    if (this.tipo === 'dron') {
      // Patrulla: avanza hasta topar una pared y se devuelve
      const nx = this.x + this.dx * this.vel * dt, ny = this.y + this.dy * this.vel * dt;
      if (mapa.solida(nx + this.dx * 0.45, ny + this.dy * 0.45)) { this.dx = -this.dx; this.dy = -this.dy; }
      else { this.x = nx; this.y = ny; }
      this.ang = Math.atan2(this.dy, this.dx);
      // Detección: algún jugador dentro del cono y con línea de visión
      const c = this.cono();
      let blanco = null;
      for (const o of objs) {
        const djx = o.x - this.x, djy = o.y - this.y, dist = Math.hypot(djx, djy);
        if (dist >= c.r) continue;
        const pd = (djx * c.dx + djy * c.dy) / (dist || 1);
        if (pd > c.cos && mapa.lineaVision(this.x, this.y, o.x, o.y)) { blanco = o; break; }
      }
      this.detecta = !!blanco;
      if (blanco) {
        if (this.tAlerta === 0 && W.Audio && blanco.local) W.Audio.sfx('alarma');
        this.tAlerta += dt;
        if (this.tAlerta > 0.5) {
          this.tAlerta = -0.7;   // siguiente disparo en 1,2 s
          nivel.disparoAlJugador(this, blanco);
        }
      } else this.tAlerta = 0;
    } else if (this.tipo === 'perseguidor') {
      const visto = masCercano(this, objs, mapa, true, 6.5);
      if (visto) {
        if (this.visto <= 0 && W.Audio && visto.local) W.Audio.sfx('alerta');
        this.visto = 3; this.ux = visto.x; this.uy = visto.y;
      } else this.visto -= dt;
      this.detecta = !!visto;
      let tx = null, ty = null;
      if (this.visto > 0) { tx = this.ux; ty = this.uy; }
      else if (Math.hypot(this.x0 - this.x, this.y0 - this.y) > 0.2) { tx = this.x0; ty = this.y0; }
      if (tx !== null) {
        const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy);
        if (d > 0.05) {
          const v = (this.visto > 0 ? this.vel : this.vel * 0.6) * dt;
          moverCon(this, dx / d * v, dy / d * v, mapa, 0.28);
          this.ang = Math.atan2(dy, dx);
        }
      }
      this.tAlerta -= dt;
      const cerca = masCercano(this, objs, mapa, false, 0.62);
      if (cerca && this.tAlerta <= 0) {
        this.tAlerta = 1.2;
        nivel.golpeAlJugador(this, 2, cerca);
      }
    } else if (this.tipo === 'guardian') {
      const cerca = masCercano(this, objs, mapa, false, 1.6);
      this.detecta = !!cerca;
      this.tAlerta -= dt;
      if (cerca && this.tAlerta <= 0) {
        this.tAlerta = 1.6;
        nivel.golpeAlJugador(this, 1, cerca);
      }
    }
  };

  // Cono de detección del dron
  Enemigo.prototype.cono = function () {
    return { x: this.x, y: this.y, dx: Math.cos(this.ang), dy: Math.sin(this.ang), r: 4.5, cos: Math.cos(0.5) };
  };

  Enemigo.prototype.sprite = function () {
    const at = this.estado === 'aturdido';
    if (this.estado === 'sellado') return { x: this.x, y: this.y, tex: SPR.chatarra, escala: 0.55, z: 0 };
    if (this.tipo === 'dron') {
      return { x: this.x, y: this.y, tex: at ? SPR.dronAturdido : SPR.dron, escala: 0.5, z: at ? 0.05 : 0.38 + Math.sin(this.reloj * 3) * 0.03 };
    }
    if (this.tipo === 'perseguidor') return { x: this.x, y: this.y, tex: at ? SPR.perseguidorAturdido : SPR.perseguidor, escala: 0.55, z: 0 };
    return { x: this.x, y: this.y, tex: at ? SPR.guardianAturdido : SPR.guardian, escala: 0.95, z: 0 };
  };

  const TIPOS = { d: 'dron', D: 'dron', p: 'perseguidor', u: 'guardian' };

  W.Enemigos = {
    // car: carácter del mapa (d, D, p, u)
    crear: function (car, x, y, id, def) {
      const tipo = TIPOS[car];
      const d = Object.assign({}, def || {});
      if (car === 'D') d.vertical = true;
      return new Enemigo(tipo, x, y, id, d);
    },
    esEnemigo: function (car) { return !!TIPOS[car]; },
    NOMBRES: { dron: 'DRON PATRULLERO', perseguidor: 'PERSEGUIDOR', guardian: 'GUARDIAN' }
  };
})();

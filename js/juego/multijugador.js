// =====================================================
// Multijugador sobre el laberinto (amplía W.Nivel.prototype)
//
// COOPERATIVO AVANZADO (fase 10b)
//   - Puertas de doble palanca: todas las palancas de la puerta deben estar activas a la vez.
//     Cada palanca 'P' del mapa se une a la puerta de doble palanca más cercana.
//   - Pistas repartidas: cada holograma lo puede leer un solo jugador; los demás lo ven cifrado.
//     Las dos partes de una pista compuesta quedan siempre en manos de jugadores distintos.
//   - Apoyo al ducto: si un compañero está en una sala 2D, otro puede apoyarlo desde el
//     marco amarillo del laberinto con un puzzle rápido (abre el terminal y le da vida).
//
// VERSUS (fase 10c): carrera y combate (todos contra todos)
//   - Cada jugador simula su propio mundo. Se comparten las posiciones y los ataques.
//   - Arma básica contra rivales, pulso EMP, hackeo, minas, dron cazador y escudo.
//   - Combate: la arena es el mapa del nivel con todas las puertas abiertas y sin enemigos.
// =====================================================
(function () {
  'use strict';
  const CEL = W.CELDA, C = W.config;
  const P = W.Nivel.prototype;
  const VS = function () { return W.configRed.VS; };

  function angDif(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }

  // ===================== PREPARACIÓN DE LA PARTIDA EN RED =====================
  // op: { modo, rol, puesto, jugadores: [{ puesto, personaje }], repartidas }
  P.prepararRed = function (op) {
    this.modo = op.modo || 'coop';
    this.versus = this.modo === 'carrera' || this.modo === 'combate';
    this.red = { rol: op.rol, puesto: op.puesto };
    this.miPuesto = op.puesto;
    this.jugadoresRed = op.jugadores || [];
    this.esCliente = op.rol === 'cliente' && this.modo === 'coop';
    this.repartidas = this.modo === 'coop' && op.repartidas !== false;
    if (this.versus) {
      this.vs = {
        cd: { emp: 0, hackeo: 0, mina: 0, dron: 0, escudo: 0 },
        sel: 0,                  // poder elegido (botón PODER en táctil)
        minas: [],               // { id, x, y, de }
        ultimoAtacante: -1, tUltimo: 0,
        caido: 0,                // combate: segundos para volver a la arena
        retirados: [],           // combate: botiquines que reaparecen
        drones: 0
      };
      if (this.modo === 'combate') this.prepararCombate();
    }
    if (this.modo !== 'combate') this.separarInicio();
    this.repartirPistas(this.jugadoresRed.map(function (j) { return j.puesto; }));
  };

  // v2.2: al empezar un nivel cada jugador aparece en una casilla distinta junto al
  // inicio (antes todos aparecían uno dentro del otro y no se veían hasta separarse).
  P.separarInicio = function () {
    const jug = this.jug, ini = this.inicio;
    if (Math.hypot(jug.x - ini.x, jug.y - ini.y) > 0.01) return;      // viene de un punto de control
    const puestos = this.jugadoresRed.map(function (j) { return j.puesto; }).sort(function (a, b) { return a - b; });
    const orden = puestos.indexOf(this.miPuesto);
    if (orden <= 0) return;
    const mapa = this.mapa, an = mapa.ancho, self = this;
    const libre = function (i) { return mapa.celdas[i] === 0 && !mapa.bloqueo[i] && !(self.esTrampa && self.esTrampa[i]); };
    const i0 = mapa.indice(Math.floor(ini.x), Math.floor(ini.y));
    const visto = new Uint8Array(mapa.celdas.length);
    const cola = [i0], lista = [];
    visto[i0] = 1;
    while (cola.length && lista.length <= orden) {
      const i = cola.shift();
      if (i !== i0) lista.push(i);
      const x = i % an, y = Math.floor(i / an);
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        const nx = x + d[0], ny = y + d[1];
        if (nx < 0 || ny < 0 || nx >= an || ny >= mapa.alto) return;
        const j = ny * an + nx;
        if (visto[j] || !libre(j)) return;
        visto[j] = 1; cola.push(j);
      });
    }
    const c = lista[orden - 1];
    if (c === undefined) return;
    jug.x = c % an + 0.5; jug.y = Math.floor(c / an) + 0.5;
  };

  P.nombrePuesto = function (puesto) {
    if (W.Red && W.Red.nombreDe) return W.Red.nombreDe(puesto);
    return 'JUGADOR ' + (puesto + 1);
  };

  // Flags que viajan con la posición: 1 escudo, 2 aturdido por EMP, 4 caído (combate)
  P.flagsLocal = function () {
    const j = this.jug;
    return (j.escudo > 0 ? 1 : 0) | (j.aturdido > 0 ? 2 : 0) | (this.caidoVs() ? 4 : 0);
  };
  P.estadoVisual = function (o) {
    if (o.estado === 'atrapado' || (o.f & 4)) return 'atrapado';
    if (o.f & 1) return 'escudo';
    if (o.f & 2) return 'aturdido';
    return '';
  };
  P.caidoVs = function () { return !!(this.vs && this.vs.caido > 0); };

  // ===================== PALANCAS =====================
  P.prepararPalancas = function () {
    const mapa = this.mapa;
    this.palancas = [];
    const puertas = [];
    for (const i in mapa.meta) if (mapa.meta[i].def && mapa.meta[i].def.palancas) puertas.push(+i);
    for (let i = 0; i < mapa.celdas.length; i++) {
      if (mapa.celdas[i] !== CEL.PALANCA) continue;
      // La puerta de doble palanca más cercana (distancia en casillas)
      const x = i % mapa.ancho, y = Math.floor(i / mapa.ancho);
      let mejor = -1, mejorD = 1e9;
      for (const p of puertas) {
        const d = Math.abs(p % mapa.ancho - x) + Math.abs(Math.floor(p / mapa.ancho) - y);
        if (d < mejorD) { mejor = p; mejorD = d; }
      }
      this.palancas.push({ i: i, puerta: mejor, t: 0 });
    }
    const abiertas = W.Partida.lista(this.partida, 'puertas', this.def.id);
    for (const pa of this.palancas) this.texturaPalanca(pa, abiertas.indexOf(pa.puerta) >= 0);
  };
  P.palancaEn = function (i) {
    for (const p of this.palancas) if (p.i === i) return p;
    return null;
  };
  P.texturaPalanca = function (pa, activa) {
    this.mapa.texCelda[pa.i] = activa ? this.mapa.tz.palancaActiva : null;
  };
  P.puertaAbiertaYa = function (puerta) {
    return W.Partida.lista(this.partida, 'puertas', this.def.id).indexOf(puerta) >= 0;
  };
  // Segundos que una palanca queda activa
  P.ventanaPalanca = function () {
    const conEquipo = this.modo === 'coop' && Object.keys(this.otros).length > 0;
    return conEquipo ? C.VENTANA_PALANCA : C.VENTANA_PALANCA_SOLO;
  };
  P.textoPalanca = function (i) {
    const pa = this.palancaEn(i);
    if (!pa) return 'PALANCA';
    if (this.puertaAbiertaYa(pa.puerta)) return 'PALANCA (PUERTA ABIERTA)';
    if (pa.t > 0) return 'PALANCA ACTIVA ' + pa.t.toFixed(1) + ' S';
    return 'TIRAR DE LA PALANCA';
  };
  P.tirarPalanca = function (i, remoto) {
    const pa = this.palancaEn(i);
    if (!pa) return;
    if (this.puertaAbiertaYa(pa.puerta)) { if (!remoto) W.HUD.mostrar('ESA PUERTA YA ESTA ABIERTA', 1.5); return; }
    pa.t = this.ventanaPalanca();
    this.texturaPalanca(pa, true);
    if (W.Audio) {
      const x = i % this.mapa.ancho + 0.5, y = Math.floor(i / this.mapa.ancho) + 0.5;
      W.Audio.sfx('interruptor', remoto ? Math.max(0.2, 1 - Math.hypot(x - this.jug.x, y - this.jug.y) / 10) : 1);
    }
    if (!remoto) this.emitir({ t: 'palanca', i: i });
    // ¿Están activas todas las palancas de esa puerta?
    const grupo = this.palancas.filter(function (q) { return q.puerta === pa.puerta; });
    const faltan = grupo.filter(function (q) { return q.t <= 0; }).length;
    if (!faltan) {
      if (this.mapa.celdas[pa.puerta] === CEL.PUERTA_PALANCA) this.abrirPuerta(pa.puerta, remoto);
      W.HUD.mostrar('PALANCAS SINCRONIZADAS: PUERTA ABIERTA', 2.5);
    } else if (!remoto) {
      W.HUD.mostrar(grupo.length > 1 ? 'PALANCA ACTIVA. FALTA ' + faltan + ' MAS A LA VEZ' : 'PALANCA ACTIVA', 2);
    }
  };
  P.actualizarPalancas = function (dt) {
    for (const pa of this.palancas) {
      if (pa.t <= 0) continue;
      pa.t -= dt;
      if (pa.t <= 0) { pa.t = 0; if (!this.puertaAbiertaYa(pa.puerta)) this.texturaPalanca(pa, false); }
    }
  };
  // Al abrirse una puerta: sus palancas quedan encendidas
  P.puertaAbierta = function (i) {
    if (!this.palancas) return;
    for (const pa of this.palancas) if (pa.puerta === i) this.texturaPalanca(pa, true);
  };

  // ===================== PISTAS REPARTIDAS =====================
  // Asigna cada holograma a un jugador. Se recalcula si alguien se desconecta.
  P.repartirPistas = function (puestos) {
    this.duenoHolo = null;
    this.lectoresClave = {};
    const lista = (puestos || []).slice().sort(function (a, b) { return a - b; });
    if (this.repartidas && lista.length >= 2) {
      const mapa = this.mapa, unidades = [], indice = {};
      const holos = [];
      for (const i in mapa.meta) {
        const m = mapa.meta[i];
        if (W.HOLOGRAMAS.indexOf(m.car) >= 0 && m.def && m.def.pista) holos.push(+i);
      }
      holos.sort(function (a, b) { return a - b; });
      // Unidad = pista simple o parte de una pista compuesta. Las partes de una misma pista
      // van seguidas en la lista, así quedan siempre en manos de jugadores distintos.
      const claves = [];
      for (const i of holos) { const k = mapa.meta[i].def.pista; if (claves.indexOf(k) < 0) claves.push(k); }
      for (const k of claves) {
        const partes = [];
        for (const i of holos) {
          const d = mapa.meta[i].def;
          if (d.pista === k && partes.indexOf(d.parte || 0) < 0) partes.push(d.parte || 0);
        }
        partes.sort(function (a, b) { return a - b; });
        for (const p of partes) { const u = k + '#' + p; indice[u] = unidades.length; unidades.push(u); }
      }
      const desfase = this.def.id % lista.length;
      this.duenoHolo = {};
      for (const i of holos) {
        const d = mapa.meta[i].def;
        const dueno = lista[(indice[d.pista + '#' + (d.parte || 0)] + desfase) % lista.length];
        this.duenoHolo[i] = dueno;
        (this.lectoresClave[d.pista] = this.lectoresClave[d.pista] || []);
        if (this.lectoresClave[d.pista].indexOf(dueno) < 0) this.lectoresClave[d.pista].push(dueno);
      }
    }
    this.texturasHologramas();
  };
  P.puedeLeerHolo = function (i) {
    return !this.duenoHolo || this.duenoHolo[i] === undefined || this.duenoHolo[i] === this.miPuesto;
  };
  // Nombres de quienes leen una pista (si el jugador local no es uno de ellos)
  P.quienLee = function (clave) {
    const l = this.lectoresClave && this.lectoresClave[clave];
    if (!l || !l.length || l.indexOf(this.miPuesto) >= 0 && l.length === 1) return '';
    const self = this;
    return l.filter(function (p) { return p !== self.miPuesto; }).map(function (p) { return self.nombrePuesto(p); }).join(' Y ');
  };

  // ===================== APOYO AL DUCTO =====================
  P.companerosEnDucto = function () {
    if (this.modo !== 'coop') return [];
    const l = [];
    for (const k in this.otros) if (this.otros[k].estado === 'sala') l.push(+k);
    if (!l.length) this.apoyoDado = false;   // se puede volver a apoyar en el próximo ducto
    return l;
  };
  P.accionApoyo = function () {
    const self = this, lista = W.Puzzles.rapidos;
    return {
      tipo: 'puzzle',
      puzzle: lista[Math.floor(Math.random() * lista.length)],
      opciones: {
        dificultad: Math.min(3, this.def.zona),
        rnd: W.texturas.azar((Math.random() * 1e9) | 0),
        tiempo: 30,
        alFallar: 'reiniciar',
        estilo: 'normal',
        titulo: 'APOYO REMOTO AL DUCTO'
      },
      alTerminar: function (res) {
        if (res !== 'exito') return;
        const en = self.companerosEnDucto();
        if (!en.length) { W.HUD.mostrar('TU COMPANERO YA SALIO DEL DUCTO', 2); return; }
        self.apoyoDado = true;
        self.emitir({ t: 'apoyo', s: en });
        W.HUD.mostrar('APOYO ENVIADO: TERMINAL ABIERTO Y +3 VIDA', 2.5);
        if (W.Audio) W.Audio.sfx('estacion');
      }
    };
  };

  // ===================== VERSUS: RIVALES =====================
  // Rival al frente (solo rivales activos: no se golpea a quien está en un puzzle o un ducto)
  P.rivalAlFrente = function (alcance, tolerancia) {
    const jug = this.jug;
    let mejor = null;
    for (const k in this.otros) {
      const o = this.otros[k];
      if (o.estado !== 'activo' || (o.f & 4)) continue;
      const dx = o.x - jug.x, dy = o.y - jug.y, d = Math.hypot(dx, dy);
      if (d > alcance) continue;
      const a = angDif(Math.atan2(dy, dx) - jug.ang);
      if (Math.abs(a) > tolerancia + Math.atan2(0.35, d)) continue;
      if (!this.mapa.lineaVision(jug.x, jug.y, o.x, o.y)) continue;
      if (!mejor || d < mejor.d) mejor = { puesto: +k, o: o, d: d };
    }
    return mejor;
  };
  P.rivalMasCercano = function () {
    let mejor = null;
    for (const k in this.otros) {
      const o = this.otros[k];
      if (o.estado !== 'activo' || (o.f & 4)) continue;
      const d = Math.hypot(o.x - this.jug.x, o.y - this.jug.y);
      if (!mejor || d < mejor.d) mejor = { puesto: +k, o: o, d: d };
    }
    return mejor;
  };

  // Golpe con el arma básica. Devuelve true si había un rival al alcance.
  P.golpearRival = function (tolerancia) {
    const jug = this.jug;
    const rv = this.rivalAlFrente(jug.p.alcance, tolerancia);
    if (!rv) return false;
    if (jug.atacar()) {
      const d = VS().DANIO[jug.p.id] || 1;
      this.emitir({ t: 'golpe', s: rv.puesto, d: d, r: jug.p.proyectil ? 1 : 0 });
      this.efectos.push({ x: rv.o.x, y: rv.o.y, t: 0.25, z: 0.35 });
    }
    return true;
  };

  // El jugador local recibe un golpe de un rival
  P.recibirGolpe = function (de, d, aDistancia) {
    const jug = this.jug, o = this.otros[de];
    if (this.jugOcupado || this.caidoVs() || jug.vida <= 0) return;
    if (jug.escudo > 0) { W.HUD.mostrar('TU ESCUDO BLOQUEO EL GOLPE', 1.2); if (W.Audio) W.Audio.sfx('bloqueo'); return; }
    if (o && jug.p.bloquea && aDistancia) {
      const a = angDif(Math.atan2(o.y - jug.y, o.x - jug.x) - jug.ang);
      if (Math.abs(a) < 1.2) { W.HUD.mostrar('BLOQUEADO CON LA SARTEN', 1.2); if (W.Audio) W.Audio.sfx('bloqueo'); return; }
    }
    if (jug.danar(d)) {
      this.marcarAtacante(de);
      W.HUD.mostrar('GOLPE DE ' + this.nombrePuesto(de) + ': -' + d, 1.5);
      if (o) {
        const dx = jug.x - o.x, dy = jug.y - o.y, dd = Math.hypot(dx, dy) || 1;
        jug.golpeX = dx / dd * 4; jug.golpeY = dy / dd * 4;
      }
    }
  };
  P.marcarAtacante = function (de) {
    if (!this.vs || de === undefined || de === this.miPuesto) return;
    this.vs.ultimoAtacante = de;
    this.vs.tUltimo = 6;
  };
  // Quién se lleva la victoria si el jugador local cae ahora (-1: nadie)
  P.autorDerrota = function () {
    return this.vs && this.vs.tUltimo > 0 ? this.vs.ultimoAtacante : -1;
  };

  // ===================== VERSUS: PODERES =====================
  P.poderes = function () { return (VS().PODERES[this.modo] || []).slice(); };
  P.listoPoder = function (nombre) { return this.vs && this.vs.cd[nombre] <= 0; };

  // Usa un poder. Devuelve una acción para main.js (el hackeo abre un puzzle) o null.
  P.usarPoder = function (nombre, tolerancia) {
    const jug = this.jug, vs = this.vs, cfg = VS();
    if (!vs || this.caidoVs() || jug.atrapado) return null;
    if (nombre !== 'escudo' && this.poderes().indexOf(nombre) < 0) return null;
    if (jug.aturdido > 0) { W.HUD.mostrar('ATURDIDO: NO PUEDES USAR PODERES', 1); return null; }
    if (vs.cd[nombre] > 0) { W.HUD.mostrar(cfg.NOMBRE_PODER[nombre] + ' RECARGANDO: ' + Math.ceil(vs.cd[nombre]) + ' S', 1); if (W.Audio) W.Audio.sfx('error'); return null; }
    const self = this;
    switch (nombre) {
      case 'escudo':
        jug.escudo = cfg.ESCUDO_SEG;
        vs.cd.escudo = cfg.RECARGA.escudo;
        W.HUD.mostrar('ESCUDO ACTIVO ' + cfg.ESCUDO_SEG + ' S', 1.5);
        if (W.Audio) W.Audio.sfx('bloqueo');
        return null;

      case 'emp': {
        vs.cd.emp = cfg.RECARGA.emp;
        this.emitir({ t: 'emp', x: Math.round(jug.x * 100) / 100, y: Math.round(jug.y * 100) / 100 });
        this.efectoEmp(jug.x, jug.y);
        // También aturde a los enemigos propios cercanos
        for (const e of this.enemigos) {
          if (e.estado === 'activo' && Math.hypot(e.x - jug.x, e.y - jug.y) <= cfg.EMP_RADIO && this.mapa.lineaVision(jug.x, jug.y, e.x, e.y)) e.aturdir(cfg.EMP_SEG + 1);
        }
        W.HUD.mostrar('PULSO EMP LANZADO', 1.5);
        return null;
      }

      case 'mina': {
        const mias = vs.minas.filter(function (m) { return m.de === self.miPuesto; });
        if (mias.length >= cfg.MINAS_MAX) {
          // La más antigua se desactiva para dejar la nueva
          this.quitarMina(mias[0].id);
          this.emitir({ t: 'minaBoom', id: mias[0].id, quieto: 1 });
        }
        const id = this.miPuesto + '_' + Math.floor(this.tiempo * 1000) + '_' + Math.floor(Math.random() * 1000);
        const m = { id: id, x: Math.round(jug.x * 100) / 100, y: Math.round(jug.y * 100) / 100, de: this.miPuesto };
        vs.minas.push(m);
        this.emitir({ t: 'mina', id: id, x: m.x, y: m.y });
        vs.cd.mina = cfg.RECARGA.mina;
        W.HUD.mostrar('MINA COLOCADA (' + Math.min(cfg.MINAS_MAX, mias.length + 1) + '/' + cfg.MINAS_MAX + ')', 1.5);
        if (W.Audio) W.Audio.sfx('interruptor');
        return null;
      }

      case 'dron': {
        const rv = this.rivalMasCercano();
        if (!rv) { W.HUD.mostrar('NO HAY RIVALES ACTIVOS PARA EL DRON', 1.5); return null; }
        vs.cd.dron = cfg.RECARGA.dron;
        this.emitir({ t: 'dron', s: rv.puesto });
        W.HUD.mostrar('DRON CAZADOR LIBERADO CONTRA ' + this.nombrePuesto(rv.puesto), 2);
        if (W.Audio) W.Audio.sfx('alerta');
        return null;
      }

      case 'hackeo': {
        const rv = this.rivalAlFrente(cfg.HACKEO_DIST, tolerancia * 1.5);
        if (!rv) { W.HUD.mostrar('APUNTA A UN RIVAL A MENOS DE ' + cfg.HACKEO_DIST + ' CASILLAS', 1.5); return null; }
        vs.cd.hackeo = cfg.RECARGA.hackeo;
        const lista = W.Puzzles.rapidos;
        const tipo = lista[Math.floor(Math.random() * lista.length)];
        const semilla = (Math.random() * 1e9) | 0;
        const id = 'h' + this.miPuesto + '_' + semilla;
        this.emitir({ t: 'hackeo', id: id, s: rv.puesto, tipo: tipo, semilla: semilla });
        return {
          tipo: 'puzzle', puzzle: tipo, hackeo: id,
          opciones: this.opcionesHackeo(tipo, semilla, 'HACKEO A ' + this.nombrePuesto(rv.puesto), true),
          alTerminar: function (res) {
            // Lo decide el anfitrión (árbitro): gana quien termine primero
            if (self.alArbitro) self.alArbitro({ t: 'hackeoFin', id: id, gana: res === 'exito' ? 'a' : 's', a: self.miPuesto, s: rv.puesto });
          }
        };
      }
    }
    return null;
  };

  // Mismas opciones para el atacante y el defensor: el mismo minijuego (misma semilla)
  P.opcionesHackeo = function (tipo, semilla, titulo, cancelable) {
    return {
      dificultad: 2,
      rnd: W.texturas.azar(semilla),
      tiempo: VS().HACKEO_TIEMPO,
      alFallar: 'reiniciar',
      estilo: 'enemigo',
      cancelable: cancelable,
      titulo: titulo
    };
  };

  // Hackeado: vuelve al último punto de control (sin contar una muerte)
  P.volverAPunto = function () {
    const p = this.partida, jug = this.jug;
    const pos = p.punto && p.punto.nivel === this.def.id ? p.punto : this.inicio;
    jug.x = pos.x; jug.y = pos.y; jug.ang = pos.ang || 0;
    jug.golpeX = jug.golpeY = 0;
    jug.invulnerable = VS().INVULNERABLE_REAPARECER;
  };

  // ===================== VERSUS: EVENTOS =====================
  P.aplicarEventoVs = function (m) {
    const jug = this.jug, cfg = VS();
    switch (m.t) {
      case 'golpe':
        if (m.s === this.miPuesto) this.recibirGolpe(m.de, m.d, !!m.r);
        else if (this.otros[m.s]) this.efectos.push({ x: this.otros[m.s].x, y: this.otros[m.s].y, t: 0.2, z: 0.35 });
        break;
      case 'emp': {
        this.efectoEmp(m.x, m.y);
        const d = Math.hypot(jug.x - m.x, jug.y - m.y);
        if (d > cfg.EMP_RADIO || this.jugOcupado || this.caidoVs() || !this.mapa.lineaVision(m.x, m.y, jug.x, jug.y)) break;
        if (jug.escudo > 0) { W.HUD.mostrar('TU ESCUDO RESISTIO EL EMP', 1.5); break; }
        jug.aturdido = cfg.EMP_SEG;
        this.marcarAtacante(m.de);
        W.HUD.mostrar('EMP DE ' + this.nombrePuesto(m.de) + ': ATURDIDO', 2);
        if (W.Audio) W.Audio.sfx('aturdir');
        W.Entrada.vibrar(200);
        break;
      }
      case 'mina':
        if (!this.vs.minas.some(function (q) { return q.id === m.id; })) this.vs.minas.push({ id: m.id, x: m.x, y: m.y, de: m.de });
        break;
      case 'minaBoom': {
        const mina = this.quitarMina(m.id);
        if (mina && !m.quieto) {
          this.efectos.push({ x: mina.x, y: mina.y, t: 0.5, z: 0.1, escala: 0.9 });
          if (W.Audio) W.Audio.sfx('golpeMetal', Math.max(0.15, 1 - Math.hypot(mina.x - jug.x, mina.y - jug.y) / 10));
        }
        break;
      }
      case 'dron':
        if (m.s === this.miPuesto) this.crearDronCazador(m.de);
        break;
      case 'botiquin':
        this.quitarBotiquin(m.i);
        break;
    }
  };

  P.efectoEmp = function (x, y) {
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4;
      this.efectos.push({ x: x + Math.cos(a) * 1.2, y: y + Math.sin(a) * 1.2, t: 0.35, z: 0.3, tex: W.texturas.sprites.emp, escala: 0.5 });
    }
    if (W.Audio) W.Audio.sfx('chispazo', Math.max(0.2, 1 - Math.hypot(x - this.jug.x, y - this.jug.y) / 12));
  };

  P.quitarMina = function (id) {
    const l = this.vs.minas;
    for (let k = 0; k < l.length; k++) if (l[k].id === id) return l.splice(k, 1)[0];
    return null;
  };

  // Dron cazador: un perseguidor temporal que aparece cerca del jugador local
  P.crearDronCazador = function (de) {
    const mapa = this.mapa, jug = this.jug;
    const jx = Math.floor(jug.x), jy = Math.floor(jug.y);
    let lugar = null;
    for (let r = 3; r >= 2 && !lugar; r--) {
      for (let dy = -r; dy <= r && !lugar; dy++) for (let dx = -r; dx <= r && !lugar; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = jx + dx, y = jy + dy;
        if (mapa.celda(x, y) !== 0 || mapa.bloqueo[mapa.indice(x, y)]) continue;
        if (!mapa.lineaVision(jug.x, jug.y, x + 0.5, y + 0.5)) continue;
        lugar = { x: x, y: y };
      }
    }
    if (!lugar) lugar = { x: jx, y: jy };
    const e = W.Enemigos.crear('p', lugar.x, lugar.y, 'vsd' + (this.vs.drones++), { vel: 2.0 });
    e.temporal = VS().DRON_SEG;
    e.visto = 3; e.ux = jug.x; e.uy = jug.y;
    this.enemigos.push(e);
    W.HUD.mostrar(this.nombrePuesto(de) + ' TE LANZO UN DRON CAZADOR!', 2.5);
    if (W.Audio) W.Audio.sfx('alarma');
  };

  // ===================== VERSUS: CADA CUADRO =====================
  P.actualizarVs = function (dt) {
    const vs = this.vs, jug = this.jug, cfg = VS();
    for (const k in vs.cd) if (vs.cd[k] > 0) vs.cd[k] -= dt;
    if (vs.tUltimo > 0) vs.tUltimo -= dt;

    // Drones cazadores temporales
    for (let k = this.enemigos.length - 1; k >= 0; k--) {
      const e = this.enemigos[k];
      if (e.temporal === undefined) continue;
      e.temporal -= dt;
      if (e.temporal <= 0 || e.estado === 'sellado') {
        this.efectos.push({ x: e.x, y: e.y, t: 0.4, z: 0.2 });
        this.enemigos.splice(k, 1);
      }
    }

    // Minas ajenas bajo los pies
    if (!this.jugOcupado && !this.caidoVs() && jug.vida > 0) {
      for (let k = vs.minas.length - 1; k >= 0; k--) {
        const m = vs.minas[k];
        if (m.de === this.miPuesto || Math.hypot(m.x - jug.x, m.y - jug.y) > 0.45) continue;
        vs.minas.splice(k, 1);
        this.emitir({ t: 'minaBoom', id: m.id });
        this.efectos.push({ x: m.x, y: m.y, t: 0.5, z: 0.1, escala: 0.9 });
        if (W.Audio) W.Audio.sfx('golpeMetal');
        if (jug.escudo > 0) { W.HUD.mostrar('TU ESCUDO ABSORBIO LA MINA', 1.5); continue; }
        const d = Math.max(1, Math.ceil(jug.vidaMax * cfg.MINA_DANIO));
        jug.danar(d, true);
        this.marcarAtacante(m.de);
        W.HUD.mostrar('MINA DE ' + this.nombrePuesto(m.de) + ': -' + d, 2);
      }
    }

    // Combate: botiquines que reaparecen y regreso a la arena
    if (this.modo === 'combate') {
      for (let k = vs.retirados.length - 1; k >= 0; k--) {
        vs.retirados[k].t -= dt;
        if (vs.retirados[k].t <= 0) {
          const b = vs.retirados.splice(k, 1)[0].b;
          if (!this.botiquines.some(function (q) { return q.i === b.i; })) this.botiquines.push(b);
        }
      }
      if (vs.caido > 0) {
        vs.caido -= dt;
        if (vs.caido <= 0) { vs.caido = 0; this.reaparecerCombate(); }
      }
    }
  };

  // Minas visibles: las propias siempre; las ajenas solo de cerca (y parpadeando)
  P.spritesVs = function (lista) {
    const jug = this.jug, cfg = VS(), parpadeo = Math.floor(this.tiempo * 4) % 2 === 0;
    for (const m of this.vs.minas) {
      const propia = m.de === this.miPuesto;
      if (!propia && (Math.hypot(m.x - jug.x, m.y - jug.y) > cfg.MINA_VISIBLE || !parpadeo)) continue;
      lista.push({ x: m.x, y: m.y, tex: W.texturas.spriteMina(propia ? m.de : -1), escala: 0.35, z: 0 });
    }
  };

  // ===================== COMBATE =====================
  P.prepararCombate = function () {
    const mapa = this.mapa;
    // Arena: todas las puertas abiertas; ductos cerrados; sin enemigos
    for (let i = 0; i < mapa.celdas.length; i++) {
      const c = mapa.celdas[i];
      if (c === CEL.PUERTA || c === CEL.PUERTA_MAGENTA || c === CEL.PUERTA_TARJETA || c === CEL.PUERTA_PALANCA) mapa.celdas[i] = 0;
      else if (c === CEL.DUCTO) mapa.celdas[i] = CEL.PANEL;
    }
    this.ductos = [];
    for (const e of this.enemigos) if (e.tipo === 'guardian') mapa.bloqueo[mapa.indice(Math.floor(e.x0), Math.floor(e.y0))] = 0;
    this.enemigos = [];
    this.spawns = this.puntosDeAparicion(8);
    const s = this.spawns[this.miPuesto % this.spawns.length];
    const jug = this.jug;
    jug.x = s.x; jug.y = s.y; jug.ang = s.ang;
    jug.invulnerable = VS().INVULNERABLE_REAPARECER;
  };

  // Puntos de aparición repartidos por la arena (lo más lejos posible unos de otros)
  P.puntosDeAparicion = function (n) {
    const mapa = this.mapa, an = mapa.ancho;
    const libre = function (i) { return mapa.celdas[i] === 0 && !mapa.bloqueo[i]; };
    const ini = mapa.indice(Math.floor(this.inicio.x), Math.floor(this.inicio.y));
    const dist = new Int32Array(mapa.celdas.length).fill(-1);
    const alcanzables = [];
    const cola = [ini];
    dist[ini] = 0;
    while (cola.length) {
      const i = cola.shift();
      alcanzables.push(i);
      const x = i % an, y = Math.floor(i / an);
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        const nx = x + d[0], ny = y + d[1];
        if (nx < 0 || ny < 0 || nx >= an || ny >= mapa.alto) return;
        const j = ny * an + nx;
        if (dist[j] >= 0 || !libre(j)) return;
        dist[j] = dist[i] + 1;
        cola.push(j);
      });
    }
    const self = this;
    const candidatos = alcanzables.filter(function (i) { return !self.esTrampa || !self.esTrampa[i]; });
    if (!candidatos.length) candidatos.push(ini);
    // Muestreo del punto más lejano (determinista: todos calculan lo mismo)
    const elegidos = [ini];
    while (elegidos.length < n && elegidos.length < candidatos.length) {
      let mejor = -1, mejorD = -1;
      for (const c of candidatos) {
        const cx = c % an, cy = Math.floor(c / an);
        let dmin = 1e9;
        for (const e of elegidos) dmin = Math.min(dmin, Math.abs(e % an - cx) + Math.abs(Math.floor(e / an) - cy));
        if (dmin > mejorD) { mejorD = dmin; mejor = c; }
      }
      if (mejorD <= 1) break;
      elegidos.push(mejor);
    }
    return elegidos.map(function (i) {
      const x = i % an + 0.5, y = Math.floor(i / an) + 0.5;
      // Mirando hacia el pasillo más largo
      let ang = 0, largo = -1;
      [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach(function (a) {
        let k = 0;
        while (k < 12 && mapa.celda(Math.floor(x + Math.cos(a) * (k + 1)), Math.floor(y + Math.sin(a) * (k + 1))) === 0) k++;
        if (k > largo) { largo = k; ang = a; }
      });
      return { x: x, y: y, ang: ang };
    });
  };

  // Caer en combate: unos segundos fuera y de vuelta en el punto más alejado de los rivales
  P.caerEnCombate = function () {
    this.vs.caido = VS().REAPARECER_SEG;
    this.jug.vida = 0;
    this.jug.escudo = 0; this.jug.aturdido = 0;
  };
  P.reaparecerCombate = function () {
    const jug = this.jug, self = this;
    let mejor = this.spawns[0], mejorD = -1;
    for (const s of this.spawns) {
      let dmin = 1e9;
      for (const k in self.otros) dmin = Math.min(dmin, Math.hypot(self.otros[k].x - s.x, self.otros[k].y - s.y));
      if (dmin > mejorD) { mejorD = dmin; mejor = s; }
    }
    jug.x = mejor.x; jug.y = mejor.y; jug.ang = mejor.ang; jug.pitch = 0;
    jug.vida = jug.vidaMax;
    jug.invulnerable = VS().INVULNERABLE_REAPARECER;
    jug.golpeX = jug.golpeY = 0;
    this.vs.tUltimo = 0;
    W.HUD.mostrar('DE VUELTA EN LA ARENA', 1.5);
    if (W.Audio) W.Audio.sfx('estacion');
  };

  // Recompensa por derrotar a un rival: vida y recargas a la mitad
  P.recompensa = function () {
    const vs = this.vs;
    this.jug.curar(VS().RECOMPENSA_VIDA);
    for (const k in vs.cd) vs.cd[k] = Math.max(0, vs.cd[k] / 2);
  };
})();

// =====================================================
// Nivel en ejecución (capa 1: laberinto)
// Toma los DATOS de un nivel (js/niveles/nivelXX.js) y la PARTIDA,
// y arma el mapa, las pistas, enemigos, trampas y botiquines.
// No dibuja ni lee la entrada directamente: main.js le pasa la entrada
// y él devuelve "acciones" (abrir un puzzle, entrar a una sala 2D...).
//
// Pistas compuestas: en la definición del nivel, una pista con { partes: 2 }
// se reparte en dos hologramas: { pista: 'p1', parte: 1 } y { pista: 'p1', parte: 2 }.
// Cada parte se anota por separado en la libreta; la cerradura se resuelve con ambas.
//
// Multijugador: las palancas, las pistas repartidas, el apoyo al ducto y todo el
// versus están en juego/multijugador.js (amplía este mismo prototipo).
// Modos: this.modo = 'solo' | 'coop' | 'carrera' | 'combate'
// =====================================================
(function () {
  'use strict';
  const C = W.config, CEL = W.CELDA;

  // Hash simple de texto → entero (para semillas)
  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function Nivel(def, partida) {
    this.def = def;
    this.partida = partida;
    this.clave = W.Partida.clave(partida, def.id);
    this.mapa = new W.Mapa(def);
    this.mapa.tz = W.texturas.zona(def.zona);
    this.tiempo = 0;
    this.viento = 0;
    this.efectos = [];        // destellos de impacto
    this.alerta = false;
    this.otros = {};          // multijugador: los demás jugadores { puesto: {x, y, ang, personaje, vida, estado, f} }
    this.red = null;          // multijugador: { rol, puesto }
    this.modo = 'solo';       // 'solo' | 'coop' | 'carrera' | 'combate'
    this.versus = false;      // carrera o combate
    this.vs = null;           // estado del versus (poderes, minas, marcador...)
    this.esCliente = false;   // multijugador: true si los enemigos los controla el anfitrión
    this.jugOcupado = false;  // el jugador local está en un puzzle, menú o sala 2D
    this.duenoHolo = null;    // cooperativo: casilla de holograma → puesto que la puede leer

    // ---------- Pistas (con variación según la semilla de la partida) ----------
    // this.pistas[k]        → pista completa (la usan las cerraduras)
    // this.pistas[k + '#j'] → parte j de una pista compuesta (la muestran los hologramas)
    this.pistas = {};
    const defPistas = def.pistas || {};
    for (const k in defPistas) {
      const rnd = W.texturas.azar(partida.semilla ^ hash(def.id + ':' + k));
      const datos = W.Pistas.generar(defPistas[k], rnd);
      datos.id = 'n' + def.id + '_' + k;
      const partes = defPistas[k].partes || 0;
      if (partes > 1 && W.Pistas.divisible(datos.tipo)) {
        datos.partes = partes;
        for (let j = 1; j <= partes; j++) this.pistas[k + '#' + j] = W.Pistas.parte(datos, j, partes);
      }
      this.pistas[k] = datos;
    }

    // ---------- Casillas especiales ----------
    const mapa = this.mapa;
    const puertas = W.Partida.lista(partida, 'puertas', def.id);
    const estaciones = W.Partida.lista(partida, 'estaciones', def.id);
    this.texturasHologramas();
    puertas.forEach(function (i) { mapa.celdas[i] = 0; });
    estaciones.forEach(function (i) { mapa.texCelda[i] = mapa.tz.estacionActiva; });
    this.ductos = [];
    for (let i = 0; i < mapa.celdas.length; i++) if (mapa.celdas[i] === CEL.DUCTO) this.ductos.push(i);
    this.actualizarDuctos();
    this.prepararPalancas();

    // ---------- Entidades sobre el piso ----------
    this.enemigos = [];
    this.trampas = [];
    this.botiquines = [];
    let inicio = def.inicio || { x: 1.5, y: 1.5, ang: 0 };
    const sellados = W.Partida.lista(partida, 'sellados', def.id);
    const usados = W.Partida.lista(partida, 'botiquines', def.id);
    const self = this;
    mapa.entidades.forEach(function (e, n) {
      if (e.car === '@') { inicio = { x: e.x + 0.5, y: e.y + 0.5, ang: (def.inicio && def.inicio.ang) || 0 }; return; }
      if (W.Enemigos.esEnemigo(e.car)) {
        const en = W.Enemigos.crear(e.car, e.x, e.y, 'e' + n, e.def);
        if (sellados.indexOf(en.id) >= 0) en.estado = 'sellado';
        else if (en.tipo === 'guardian') mapa.bloqueo[mapa.indice(e.x, e.y)] = 1;
        self.enemigos.push(en);
      } else if (W.Trampas.esTrampa(e.car)) {
        self.trampas.push(W.Trampas.crear(e.car, e.x, e.y, e.def, mapa));
      } else if (e.car === 'h') {
        const i = mapa.indice(e.x, e.y);
        if (usados.indexOf(i) < 0) self.botiquines.push({ x: e.x + 0.5, y: e.y + 0.5, i: i });
      }
    });
    // Casillas con trampa (para saber cuál es la "última posición segura")
    this.esTrampa = new Uint8Array(mapa.ancho * mapa.alto);
    this.trampas.forEach(function (t) { self.esTrampa[t.i] = 1; });
    this.inicio = inicio;

    // ---------- Jugador ----------
    const pos = partida.punto && partida.punto.nivel === def.id ? partida.punto : inicio;
    this.jug = new W.Jugador({ x: pos.x, y: pos.y, ang: pos.ang }, partida.personaje);
  }

  // Datos que muestra un holograma: la pista completa o, si es compuesta, su parte
  Nivel.prototype.pistaDeHolograma = function (defHolo) {
    if (!defHolo || !defHolo.pista) return null;
    if (defHolo.parte && this.pistas[defHolo.pista + '#' + defHolo.parte]) return this.pistas[defHolo.pista + '#' + defHolo.parte];
    return this.pistas[defHolo.pista] || null;
  };

  // Texturas de los hologramas: la pista o, si la lee otro jugador, el holograma cifrado
  Nivel.prototype.texturasHologramas = function () {
    const mapa = this.mapa;
    for (const i in this.mapa.meta) {
      if (mapa.celdas[i] !== CEL.HOLOGRAMA) continue;
      const m = this.mapa.meta[i];
      const datos = this.pistaDeHolograma(m.def);
      if (!datos) continue;
      if (!this.puedeLeerHolo(+i)) mapa.texCelda[i] = W.texturas.hologramaCifrado(this.def.zona, this.duenoHolo[i], this.nombrePuesto(this.duenoHolo[i]));
      else mapa.texCelda[i] = W.Pistas.textura(this.def.zona, datos);
    }
  };

  // ===================== ACTUALIZACIÓN =====================
  // En un jugador: se llama solo mientras se juega. En multijugador el "mundo"
  // sigue avanzando aunque el jugador local esté en un puzzle, la libreta o la pausa.
  Nivel.prototype.actualizar = function (dt, entrada) {
    this.jugOcupado = false;
    this.actualizarJugador(dt, entrada);
    this.actualizarMundo(dt);
  };

  Nivel.prototype.actualizarJugador = function (dt, entrada) {
    const jug = this.jug, mapa = this.mapa;
    // Atrapado (cooperativo) o derribado (combate): no se puede mover
    if (jug.atrapado || this.caidoVs()) entrada = { avance: 0, lateral: 0, giro: entrada.giro, pitch: entrada.pitch, correr: false };
    jug.actualizar(dt, entrada, mapa, this.cuerpos());

    // Última posición segura
    const ic = mapa.indice(Math.floor(jug.x), Math.floor(jug.y));
    if (!this.esTrampa[ic]) { jug.seguroX = jug.x; jug.seguroY = jug.y; }

    // Botiquines
    for (let k = this.botiquines.length - 1; k >= 0; k--) {
      const b = this.botiquines[k];
      if (!jug.atrapado && !this.caidoVs() && Math.hypot(b.x - jug.x, b.y - jug.y) < 0.5 && jug.vida < jug.vidaMax) {
        jug.curar(4);
        this.quitarBotiquin(b.i);
        this.emitir({ t: 'botiquin', i: b.i });
        W.HUD.mostrar('BOTIQUIN: +4 VIDA');
        if (W.Audio) W.Audio.sfx('objeto');
      }
    }
  };

  // Cuerpos sólidos para el jugador local: enemigos (no sellados) y los demás jugadores.
  // Radios en casillas. Los jugadores caídos o tendidos también ocupan su lugar.
  Nivel.RADIO_CUERPO = { dron: 0.26, perseguidor: 0.3, guardian: 0.36, jugador: 0.22 };
  Nivel.prototype.cuerpos = function () {
    const l = [], R = Nivel.RADIO_CUERPO;
    for (const e of this.enemigos) if (e.estado !== 'sellado') l.push({ x: e.x, y: e.y, r: R[e.tipo] || 0.3 });
    for (const k in this.otros) { const o = this.otros[k]; l.push({ x: o.x, y: o.y, r: R.jugador }); }
    return l;
  };

  // Jugadores que bloquean a los enemigos: el local y los demás (también si están ocupados)
  Nivel.prototype.cuerposJugadores = function () {
    const l = [{ x: this.jug.x, y: this.jug.y }];
    for (const k in this.otros) l.push({ x: this.otros[k].x, y: this.otros[k].y });
    return l;
  };

  Nivel.prototype.quitarBotiquin = function (i) {
    const k = this.botiquines.findIndex(function (b) { return b.i === i; });
    if (k >= 0) {
      const b = this.botiquines.splice(k, 1)[0];
      // En combate los botiquines vuelven a aparecer después de un rato
      if (this.modo === 'combate' && this.vs) this.vs.retirados.push({ b: b, t: W.configRed.VS.BOTIQUIN_REAPARECE });
    }
    if (this.modo === 'combate') return;
    const usados = W.Partida.lista(this.partida, 'botiquines', this.def.id);
    if (usados.indexOf(i) < 0) usados.push(i);
  };

  Nivel.prototype.actualizarMundo = function (dt) {
    const jug = this.jug, mapa = this.mapa;
    this.tiempo += dt;
    this.viento = Math.max(0, this.viento - dt * 2);

    for (const t of this.trampas) t.actualizar(dt, this);
    if (this.jugOcupado) { jug.empujeX = 0; jug.empujeY = 0; }

    this.alerta = false;
    const suave = Math.min(1, dt * 10);
    for (const e of this.enemigos) {
      if (this.esCliente) {
        // En el cliente los enemigos los mueve el anfitrión: solo se suavizan
        if (e.tx !== undefined) { e.x += (e.tx - e.x) * suave; e.y += (e.ty - e.y) * suave; }
        e.reloj += dt;
      } else e.actualizar(dt, this);
      if (e.detecta && e.estado === 'activo') this.alerta = true;
    }
    for (const k in this.otros) {
      const o = this.otros[k];
      o.x += (o.tx - o.x) * suave; o.y += (o.ty - o.y) * suave;
    }
    this.actualizarConos();
    this.actualizarPalancas(dt);
    if (this.versus) this.actualizarVs(dt);

    // Puertas abriéndose
    for (let i = 0; i < mapa.apertura.length; i++) {
      if (mapa.apertura[i] > 0) {
        mapa.apertura[i] += dt * 1.8;
        if (mapa.apertura[i] >= 1) { mapa.apertura[i] = 0; mapa.celdas[i] = 0; }
      }
    }
    // Animación del núcleo de la IA
    if (this.indiceNucleo === undefined) {
      this.indiceNucleo = -1;
      for (let i = 0; i < mapa.celdas.length; i++) if (mapa.celdas[i] === CEL.NUCLEO) this.indiceNucleo = i;
    }
    if (this.indiceNucleo >= 0) mapa.texCelda[this.indiceNucleo] = W.texturas.comunes.nucleo[Math.floor(this.tiempo * 3) % 2];

    // Efectos
    for (let k = this.efectos.length - 1; k >= 0; k--) {
      this.efectos[k].t -= dt;
      if (this.efectos[k].t <= 0) this.efectos.splice(k, 1);
    }
  };

  // Marca en el mapa las casillas que ilumina cada dron (con línea de visión)
  Nivel.prototype.actualizarConos = function () {
    const mapa = this.mapa;
    if (this.conosPrevios) for (const i of this.conosPrevios) mapa.cono[i] = 0;
    this.conosPrevios = [];
    this.conos = [];
    for (const e of this.enemigos) {
      if (e.tipo !== 'dron' || e.estado !== 'activo') continue;
      const c = e.cono();
      this.conos.push(c);
      const marca = this.conos.length;
      const r = Math.ceil(c.r);
      const ex = Math.floor(e.x), ey = Math.floor(e.y);
      for (let cy = ey - r; cy <= ey + r; cy++) for (let cx = ex - r; cx <= ex + r; cx++) {
        if (cx < 0 || cy < 0 || cx >= mapa.ancho || cy >= mapa.alto) continue;
        const i = cy * mapa.ancho + cx;
        if (mapa.celdas[i] > 0) continue;
        const vx = cx + 0.5 - c.x, vy = cy + 0.5 - c.y, d = Math.hypot(vx, vy);
        if (d > c.r + 0.7) continue;
        if (d > 0.7 && (vx * c.dx + vy * c.dy) / d < c.cos - 0.25) continue;
        if (!mapa.lineaVision(c.x, c.y, cx + 0.5, cy + 0.5)) continue;
        mapa.cono[i] = marca;
        this.conosPrevios.push(i);
      }
    }
  };

  // Sprites para el raycaster
  Nivel.prototype.sprites = function () {
    const lista = [];
    for (const e of this.enemigos) lista.push(e.sprite());
    for (const t of this.trampas) { const s = t.sprite(); if (s) lista.push(s); }
    for (const b of this.botiquines) lista.push({ x: b.x, y: b.y, tex: W.texturas.sprites.botiquin, escala: 0.5, z: 0 });
    for (const f of this.efectos) lista.push({ x: f.x, y: f.y, tex: f.tex || W.texturas.sprites.impacto, escala: f.escala || 0.4, z: f.z || 0.3 });
    for (const k in this.otros) {
      const o = this.otros[k];
      lista.push({ x: o.x, y: o.y, tex: W.texturas.spriteJugadorEstado(o.personaje, +k, this.estadoVisual(o)), escala: 0.8, z: 0 });
    }
    if (this.versus) this.spritesVs(lista);
    return lista;
  };

  // ===================== DAÑO =====================
  // Jugadores que los enemigos pueden atacar (el local y, en el cooperativo, los demás).
  // En versus cada jugador simula sus propios enemigos: solo atacan al jugador local.
  Nivel.prototype.objetivos = function () {
    const l = [], j = this.jug;
    if (!this.jugOcupado && !j.atrapado && !this.caidoVs() && j.vida > 0) l.push({ x: j.x, y: j.y, ang: j.ang, p: j.p, local: true });
    if (this.versus) return l;
    for (const k in this.otros) {
      const o = this.otros[k];
      if (o.estado === 'activo') l.push({ x: o.x, y: o.y, ang: o.ang, p: W.PERSONAJES[o.personaje] || W.PERSONAJES.chispa, local: false, puesto: +k });
    }
    return l;
  };

  Nivel.prototype.danarJugador = function (n, motivo, ignorarInv) {
    if (this.jugOcupado || this.jug.atrapado || this.caidoVs()) return false;
    const ok = this.jug.danar(n, ignorarInv);
    if (ok && motivo) W.HUD.mostrar(motivo + ': -' + n, 1.5);
    return ok;
  };
  // Daño a un jugador: si es el local se aplica aquí; si es otro, se le avisa por la red
  Nivel.prototype.danarObjetivo = function (obj, n, motivo, gx, gy) {
    if (!obj || obj.local) {
      if (this.danarJugador(n, motivo)) { this.jug.golpeX = gx || 0; this.jug.golpeY = gy || 0; return true; }
      return false;
    }
    if (this.alDanioRemoto) this.alDanioRemoto(obj.puesto, { n: n, motivo: motivo, gx: gx || 0, gy: gy || 0 });
    return true;
  };
  // Disparo de un dron: Doña Lata lo bloquea con la sartén si mira hacia el dron
  Nivel.prototype.disparoAlJugador = function (dron, obj) {
    obj = obj || { x: this.jug.x, y: this.jug.y, ang: this.jug.ang, p: this.jug.p, local: true };
    if (obj.p.bloquea) {
      const a = Math.atan2(dron.y - obj.y, dron.x - obj.x);
      let d = a - obj.ang;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) < 1.2) {
        if (obj.local) { W.HUD.mostrar('DISPARO BLOQUEADO CON LA SARTEN', 1.2); if (W.Audio) W.Audio.sfx('bloqueo'); }
        return;
      }
    }
    if (obj.local && W.Audio) W.Audio.sfx('disparo');
    this.danarObjetivo(obj, 1, 'DISPARO DEL DRON', 0, 0);
  };
  // Golpe cuerpo a cuerpo: daño + retroceso
  Nivel.prototype.golpeAlJugador = function (e, n, obj) {
    obj = obj || { x: this.jug.x, y: this.jug.y, local: true };
    const dx = obj.x - e.x, dy = obj.y - e.y, d = Math.hypot(dx, dy) || 1;
    this.danarObjetivo(obj, n, W.Enemigos.NOMBRES[e.tipo], dx / d * 5, dy / d * 5);
  };

  Nivel.prototype.baldosaSegura = function () {
    const b = this.def.baldosas;
    return b && this.pistas[b.pista] ? this.pistas[b.pista].seguro : 0;
  };

  // ===================== OBJETIVOS AL FRENTE =====================
  // Enemigo al frente (dentro de un ángulo y una distancia, con línea de visión)
  Nivel.prototype.enemigoAlFrente = function (alcance, tolerancia) {
    const jug = this.jug;
    let mejor = null, mejorD = 1e9;
    for (const e of this.enemigos) {
      if (e.estado === 'sellado') continue;
      const dx = e.x - jug.x, dy = e.y - jug.y, d = Math.hypot(dx, dy);
      if (d > alcance) continue;
      let a = Math.atan2(dy, dx) - jug.ang;
      a = Math.atan2(Math.sin(a), Math.cos(a));
      const margen = tolerancia + Math.atan2(0.3, d);   // objetivos cercanos son más "anchos"
      if (Math.abs(a) > margen) continue;
      if (!this.mapa.lineaVision(jug.x, jug.y, e.x, e.y)) continue;
      if (d < mejorD) { mejor = e; mejorD = d; }
    }
    return mejor;
  };

  // Aviso contextual de lo que hay al frente (y registro automático de pistas)
  Nivel.prototype.aviso = function (tolerancia) {
    const jug = this.jug;
    if (jug.atrapado || this.caidoVs()) return '';
    if (jug.aturdido > 0) return 'ATURDIDO POR UN EMP';
    if (this.versus) {
      const rv = this.rivalAlFrente(Math.max(jug.p.alcance, 1.8), tolerancia);
      if (rv && rv.d <= jug.p.alcance) return 'ATACAR A ' + this.nombrePuesto(rv.puesto);
    }
    const comp = this.companeroAlFrente(tolerancia);
    if (comp) return 'RESCATAR A ' + (W.PERSONAJES[comp.o.personaje] || {}).nombre;
    const e = this.enemigoAlFrente(Math.max(jug.p.alcance, 1.8), tolerancia);
    if (e) {
      if (e.estado === 'aturdido' && Math.hypot(e.x - jug.x, e.y - jug.y) < 2.2) return 'SELLAR ' + W.Enemigos.NOMBRES[e.tipo];
      if (Math.hypot(e.x - jug.x, e.y - jug.y) <= jug.p.alcance) return 'ATACAR ' + W.Enemigos.NOMBRES[e.tipo];
    }
    const r = W.raycaster.rayoCentral(jug, this.mapa, tolerancia);
    const info = W.TIPOS[r.tipo];
    const lejos = r.tipo === CEL.HOLOGRAMA ? jug.p.distHolograma : C.DIST_INTERACCION;
    if (r.tipo === CEL.HOLOGRAMA && r.dist <= lejos) this.registrarPista(r);
    if (r.dist > lejos || !info || !info.aviso) return '';
    const i = this.mapa.indice(r.mx, r.my);
    if (this.modo === 'combate' && (r.tipo === CEL.ESTACION || r.tipo === CEL.SALIDA || r.tipo === CEL.NUCLEO)) return '';
    if (r.tipo === CEL.HOLOGRAMA && !this.puedeLeerHolo(i)) return 'CIFRADO: SOLO LO LEE ' + this.nombrePuesto(this.duenoHolo[i]);
    if (r.tipo === CEL.DUCTO && this.companerosEnDucto().length && !this.apoyoDado) return 'APOYAR AL EQUIPO EN EL DUCTO';
    if (r.tipo === CEL.PALANCA) return this.textoPalanca(i);
    if (r.tipo === CEL.ESTACION && this.estacionActiva(i)) return 'ESTACION ACTIVA';
    if (r.tipo === CEL.PUERTA_TARJETA) {
      const m = this.mapa.meta[i];
      return 'NECESITA ' + ((m && m.def.objeto) || 'TARJETA');
    }
    return info.aviso;
  };

  Nivel.prototype.estacionActiva = function (i) {
    return W.Partida.lista(this.partida, 'estaciones', this.def.id).indexOf(i) >= 0;
  };

  Nivel.prototype.registrarPista = function (r) {
    const i = this.mapa.indice(r.mx, r.my);
    const m = this.mapa.meta[i];
    if (!m || !m.def.pista || !this.puedeLeerHolo(i)) return;
    const datos = this.pistaDeHolograma(m.def);
    if (datos && W.Partida.anotarPista(this.partida, datos.id, this.def.id, datos)) {
      if (datos.partes) {
        const vistas = W.Partida.partesConocidas(this.partida, this.pistas[m.def.pista].id).length;
        W.HUD.mostrar(vistas < datos.partes
          ? 'PARTE ' + datos.parte + ' DE ' + datos.partes + ' REGISTRADA. BUSCA LA OTRA'
          : 'PISTA COMPLETA EN LA LIBRETA (E)', 3);
      } else W.HUD.mostrar('PISTA REGISTRADA EN LA LIBRETA (E)', 2.5);
      if (W.Audio) W.Audio.sfx('pista');
    }
  };

  // ===================== ACCIÓN (clic / botón USAR) =====================
  // Devuelve una acción para main.js o null.
  Nivel.prototype.accion = function (tolerancia) {
    const jug = this.jug, mapa = this.mapa, partida = this.partida;
    if (jug.atrapado || this.caidoVs()) return null;
    if (jug.aturdido > 0) { W.HUD.mostrar('ATURDIDO: TUS SISTEMAS SE REINICIAN', 1); return null; }

    // Versus: golpear a un rival al frente
    if (this.versus && this.golpearRival(tolerancia)) return null;

    // 0) Compañero atrapado al frente (cooperativo): rescatarlo con un puzzle
    const comp = this.companeroAlFrente(tolerancia);
    if (comp) return this.accionRescatar(comp.puesto, comp.o);

    // 1) Enemigo al frente: sellar si está aturdido, atacar si no
    const e = this.enemigoAlFrente(Math.max(jug.p.alcance, 2.2), tolerancia);
    if (e) {
      const d = Math.hypot(e.x - jug.x, e.y - jug.y);
      if (e.estado === 'aturdido' && d < 2.2) return this.accionSellar(e);
      if (d <= jug.p.alcance) {
        if (jug.atacar()) {
          e.aturdir(jug.p.aturdir);
          this.emitir({ t: 'aturdir', id: e.id, seg: jug.p.aturdir });
          this.efectos.push({ x: e.x, y: e.y, t: 0.25, z: e.tipo === 'dron' ? 0.45 : 0.25 });
          W.HUD.mostrar(W.Enemigos.NOMBRES[e.tipo] + ' ATURDIDO: SELLALO!', 2);
        }
        return null;
      }
    }

    // 2) Pared interactiva al frente
    const r = W.raycaster.rayoCentral(jug, mapa, tolerancia);
    const lejos = r.tipo === CEL.HOLOGRAMA ? jug.p.distHolograma : C.DIST_INTERACCION;
    if (r.dist > lejos) { jug.atacar(); return null; }   // golpe al aire
    const i = mapa.indice(r.mx, r.my);
    const meta = mapa.meta[i];

    // Combate: la arena no tiene salida, estaciones ni ductos
    if (this.modo === 'combate' && (r.tipo === CEL.SALIDA || r.tipo === CEL.NUCLEO || r.tipo === CEL.ESTACION)) {
      W.HUD.mostrar('EN COMBATE SOLO IMPORTA DERRIBAR RIVALES', 2);
      return null;
    }

    switch (r.tipo) {
      case CEL.HOLOGRAMA: {
        if (!this.puedeLeerHolo(i)) {
          W.HUD.mostrar('HOLOGRAMA CIFRADO. SOLO LO LEE ' + this.nombrePuesto(this.duenoHolo[i]) + ': PIDELE QUE TE LO DICTE', 3);
          if (W.Audio) W.Audio.sfx('error');
          return null;
        }
        this.registrarPista(r);
        const datos = meta && this.pistaDeHolograma(meta.def);
        return datos ? { tipo: 'verPista', datos: datos } : null;
      }
      case CEL.PUERTA:
      case CEL.PUERTA_MAGENTA:
        return this.accionPuerta(i, meta ? meta.def : {}, r.tipo === CEL.PUERTA_MAGENTA);
      case CEL.PUERTA_TARJETA: {
        const obj = meta && meta.def.objeto;
        if (obj && partida.objetos.indexOf(obj) >= 0) {
          this.abrirPuerta(i);
          W.HUD.mostrar(obj + ' ACEPTADA');
        } else {
          W.HUD.mostrar('NECESITAS: ' + (obj || 'UNA TARJETA') + '. BUSCALA EN UN DUCTO AMARILLO', 3);
          if (W.Audio) W.Audio.sfx('error');
        }
        return null;
      }
      case CEL.PALANCA:
        this.tirarPalanca(i);
        return null;
      case CEL.PUERTA_PALANCA:
        W.HUD.mostrar(this.ventanaPalanca() < 3
          ? 'SE ABRE CON SUS DOS PALANCAS A LA VEZ: COORDINEN LA CUENTA'
          : 'SE ABRE CON SUS DOS PALANCAS: TIENES ' + this.ventanaPalanca() + ' S ENTRE UNA Y OTRA', 3);
        return null;
      case CEL.DUCTO:
        if (this.companerosEnDucto().length && !this.apoyoDado) return this.accionApoyo();
        return { tipo: 'sala2d', indice: i };
      case CEL.ESTACION:
        this.activarEstacion(i);
        return null;
      case CEL.SALIDA:
        return { tipo: 'salida' };
      case CEL.NUCLEO:
        return this.modo === 'carrera' ? { tipo: 'salida' } : { tipo: 'jefe' };
      case CEL.DECOR:
        W.HUD.mostrar(this.def.zona === 1 ? 'SUJETO EN CRIOGENIA. NO RESPONDE' : this.def.zona === 2 ? 'MAQUINARIA DE EXTRACCION. MEJOR NO TOCAR' :
          this.def.zona === 3 ? 'SERVIDOR DE LA IA. ZUMBA COMO SI PENSARA' : 'AL OTRO LADO: EL ESPACIO. Y TEMUKEITOR', 2.5);
        return null;
    }
    return null;
  };

  Nivel.prototype.accionPuerta = function (i, d, riesgo) {
    const partida = this.partida;
    if (d.objeto && partida.objetos.indexOf(d.objeto) < 0) {
      W.HUD.mostrar('PRIMERO NECESITAS: ' + d.objeto, 3);
      return null;
    }
    const dif = d.dificultad || 1;
    const datos = d.pista ? this.pistas[d.pista] : null;
    const conocida = datos ? W.Partida.conocePista(partida, datos.id) : false;
    // Pistas repartidas: el título de la cerradura dice quién tiene la información que falta
    const quien = datos && !conocida ? this.quienLee(d.pista) : '';
    const self = this;
    return {
      tipo: 'puzzle',
      puzzle: d.puzzle || 'serie',
      opciones: {
        dificultad: dif,
        rnd: W.texturas.azar((Math.random() * 1e9) | 0),
        pista: datos,
        pistaConocida: conocida,
        pistaParcial: datos && datos.partes && !conocida ? W.Partida.partesConocidas(partida, datos.id) : null,
        tiempo: d.tiempo || C.TIEMPO_PUERTA[Math.min(3, dif) - 1],
        alFallar: riesgo ? 'terminar' : 'reiniciar',
        estilo: riesgo ? 'riesgo' : 'normal',
        titulo: quien ? 'PISTA: PREGUNTALE A ' + quien : riesgo ? 'CERRADURA DE RIESGO' : undefined
      },
      alTerminar: function (res) {
        if (res === 'exito') self.abrirPuerta(i);
        else if (res === 'fallo' && riesgo) {
          self.danarJugador(C.DANIO_PUERTA_MAGENTA, 'DESCARGA DE LA CERRADURA', true);
        }
      }
    };
  };

  // Sellar: puzzle rápido al azar. El tiempo depende del tipo de puzzle y de la
  // dificultad (una serie se lee en segundos; una matriz necesita más).
  Nivel.prototype.accionSellar = function (e) {
    const jug = this.jug, self = this;
    const lista = W.Puzzles.rapidos;
    const tipo = lista[Math.floor(Math.random() * lista.length)];
    const dif = this.def.dificultadEnemigos || Math.min(3, this.def.zona);
    return {
      tipo: 'puzzle',
      puzzle: tipo,
      opciones: {
        dificultad: dif,
        rnd: W.texturas.azar((Math.random() * 1e9) | 0),
        tiempo: C.tiempoSellado(tipo, dif) + C.BONO_ATURDIDO + jug.p.bonoPuzzle,
        alFallar: 'terminar',
        estilo: 'enemigo',
        cancelable: false,
        titulo: 'SELLAR ' + W.Enemigos.NOMBRES[e.tipo]
      },
      alTerminar: function (res) {
        if (res === 'exito') {
          e.sellar(self.mapa);
          W.Partida.lista(self.partida, 'sellados', self.def.id).push(e.id);
          self.emitir({ t: 'sellar', id: e.id });
          W.HUD.mostrar(W.Enemigos.NOMBRES[e.tipo] + ' SELLADO', 2);
          if (W.Audio) W.Audio.sfx('sellado');
        } else {
          e.estado = 'activo'; e.tAturdido = 0;
          self.emitir({ t: 'activar', id: e.id });
          self.danarJugador(C.DANIO_SELLADO, 'SELLADO FALLIDO', true);
        }
      }
    };
  };

  Nivel.prototype.abrirPuerta = function (i, remoto) {
    const lista = W.Partida.lista(this.partida, 'puertas', this.def.id);
    if (lista.indexOf(i) >= 0) return;          // ya abierta
    this.mapa.apertura[i] = 0.01;
    lista.push(i);
    if (W.Audio) {
      const x = i % this.mapa.ancho + 0.5, y = Math.floor(i / this.mapa.ancho) + 0.5;
      W.Audio.sfx('puerta', remoto ? Math.max(0.15, 1 - Math.hypot(x - this.jug.x, y - this.jug.y) / 10) : 1);
    }
    if (remoto) W.HUD.mostrar('UN COMPANERO ABRIO UNA PUERTA', 2);
    else this.emitir({ t: 'puerta', i: i });
    this.puertaAbierta(i);
  };

  // El ducto queda abierto (pasillo) si la sala se superó y tienes su objeto.
  // Si al morir pierdes el objeto, el ducto vuelve a ser una entrada para recuperarlo.
  Nivel.prototype.actualizarDuctos = function () {
    const sala = this.def.sala;
    const objeto = sala && sala.objeto;
    const abierto = !!this.partida.salas[this.clave] && (!objeto || this.partida.objetos.indexOf(objeto) >= 0);
    for (const i of this.ductos) this.mapa.celdas[i] = abierto ? 0 : CEL.DUCTO;
  };

  Nivel.prototype.activarEstacion = function (i) {
    const jug = this.jug;
    if (!this.estacionActiva(i)) {
      W.Partida.lista(this.partida, 'estaciones', this.def.id).push(i);
      this.mapa.texCelda[i] = this.mapa.tz.estacionActiva;
    }
    jug.vida = jug.vidaMax;
    W.Partida.marcarPunto(this.partida, jug.x, jug.y, jug.ang);
    W.HUD.mostrar('RESPALDO GUARDADO. LA IA TE REIMPRIMIRA AQUI', 3);
    if (W.Audio) W.Audio.sfx('estacion');
  };

  // Al terminar una sala 2D con éxito
  Nivel.prototype.salaSuperada = function (objeto, remoto) {
    this.partida.salas[this.clave] = true;
    if (objeto && this.partida.objetos.indexOf(objeto) < 0) this.partida.objetos.push(objeto);
    this.actualizarDuctos();
    if (remoto) W.HUD.mostrar('UN COMPANERO SUPERO EL DUCTO' + (objeto ? ': TIENEN ' + objeto : ''), 3);
    else this.emitir({ t: 'sala', objeto: objeto || null });
  };

  // Reaparecer en la última estación tras morir
  Nivel.prototype.reaparecer = function () {
    const p = this.partida;
    const pos = p.punto && p.punto.nivel === this.def.id ? p.punto : this.inicio;
    const jug = this.jug;
    jug.x = pos.x; jug.y = pos.y; jug.ang = pos.ang || 0; jug.pitch = 0;
    jug.vida = jug.vidaMax;
    jug.invulnerable = 2.0;     // invulnerabilidad breve al reaparecer
    jug.golpeX = jug.golpeY = 0;
    jug.atrapado = false;
    jug.aturdido = 0;
    p.muertes++;
    // En el cooperativo los objetos son del equipo y los enemigos los maneja el anfitrión
    if (this.modo === 'coop') return;
    W.Partida.restaurarObjetos(p);
    this.actualizarDuctos();
    for (const e of this.enemigos) e.reiniciar();
    // Los guardianes no sellados vuelven a bloquear su casilla
    for (const e of this.enemigos) if (e.tipo === 'guardian' && e.estado !== 'sellado') this.mapa.bloqueo[this.mapa.indice(Math.floor(e.x0), Math.floor(e.y0))] = 1;
  };

  // ===================== MULTIJUGADOR (base) =====================
  // Los cambios compartidos se "emiten"; red.js los envía a los demás, que los aplican
  // con aplicarEvento(). En versus solo viajan los eventos entre rivales.
  Nivel.prototype.emitir = function (msg) {
    if (!this.alEvento) return;
    if (this.versus && !Nivel.EVENTOS_VS[msg.t] && !(msg.t === 'botiquin' && this.modo === 'combate')) return;
    this.alEvento(msg);
  };

  Nivel.prototype.enemigoPorId = function (id) {
    for (const e of this.enemigos) if (e.id === id) return e;
    return null;
  };

  Nivel.prototype.aplicarEvento = function (m) {
    if (this.versus) { this.aplicarEventoVs(m); return; }
    const e = m.id ? this.enemigoPorId(m.id) : null;
    switch (m.t) {
      case 'puerta': this.abrirPuerta(m.i, true); break;
      case 'aturdir': if (e) e.aturdir(m.seg); break;
      case 'sellar':
        if (e && e.estado !== 'sellado') {
          e.sellar(this.mapa);
          W.Partida.lista(this.partida, 'sellados', this.def.id).push(e.id);
        }
        break;
      case 'activar': if (e && e.estado !== 'sellado') { e.estado = 'activo'; e.tAturdido = 0; } break;
      case 'sala': this.salaSuperada(m.objeto, true); break;
      case 'botiquin': this.quitarBotiquin(m.i); break;
      case 'palanca': this.tirarPalanca(m.i, true); break;
    }
  };

  // Compañero atrapado al frente
  Nivel.prototype.companeroAlFrente = function (tolerancia) {
    if (this.versus) return null;
    const jug = this.jug;
    for (const k in this.otros) {
      const o = this.otros[k];
      if (o.estado !== 'atrapado') continue;
      const dx = o.x - jug.x, dy = o.y - jug.y, d = Math.hypot(dx, dy);
      if (d > 1.9) continue;
      let a = Math.atan2(dy, dx) - jug.ang;
      a = Math.atan2(Math.sin(a), Math.cos(a));
      if (Math.abs(a) > tolerancia + Math.atan2(0.4, d)) continue;
      if (!this.mapa.lineaVision(jug.x, jug.y, o.x, o.y)) continue;
      return { puesto: +k, o: o };
    }
    return null;
  };

  // Rescatar: un puzzle rápido; si se resuelve, el compañero vuelve con media vida
  Nivel.prototype.accionRescatar = function (puesto, o) {
    const self = this;
    const lista = W.Puzzles.rapidos;
    return {
      tipo: 'puzzle',
      puzzle: lista[Math.floor(Math.random() * lista.length)],
      opciones: {
        dificultad: Math.min(3, this.def.zona),
        rnd: W.texturas.azar((Math.random() * 1e9) | 0),
        tiempo: 30,
        alFallar: 'reiniciar',
        estilo: 'normal',
        titulo: 'RESCATAR A ' + (W.PERSONAJES[o.personaje] || {}).nombre
      },
      alTerminar: function (res) {
        if (res !== 'exito') return;
        self.emitir({ t: 'rescatar', s: puesto });
        W.HUD.mostrar('COMPANERO RESCATADO', 2);
        if (W.Audio) W.Audio.sfx('estacion');
      }
    };
  };

  // El jugador local fue rescatado
  Nivel.prototype.rescatado = function () {
    const jug = this.jug;
    if (!jug.atrapado) return;
    jug.atrapado = false;
    jug.vida = Math.ceil(jug.vidaMax / 2);
    jug.invulnerable = 2;
    W.HUD.mostrar('TE RESCATARON!', 2.5);
    if (W.Audio) W.Audio.sfx('estacion');
  };

  // Posición informada por otro jugador
  Nivel.prototype.actualizarOtro = function (puesto, m) {
    let o = this.otros[puesto];
    if (!o) o = this.otros[puesto] = { x: m.x, y: m.y };
    o.tx = m.x; o.ty = m.y; o.ang = m.a;
    o.personaje = m.pe; o.vida = m.v; o.vidaMax = m.vm; o.estado = m.e; o.f = m.f || 0;
    if (Math.hypot(o.x - m.x, o.y - m.y) > 3) { o.x = m.x; o.y = m.y; }   // teletransporte (reaparición)
  };
  Nivel.prototype.quitarOtro = function (puesto) { delete this.otros[puesto]; };

  // Anfitrión: arma el estado que se envía a todos (unas 15 veces por segundo)
  const ESTADOS = { activo: 0, aturdido: 1, sellado: 2 };
  Nivel.prototype.armarEstado = function (miPuesto, miEstado) {
    const jug = this.jug, r = function (v) { return Math.round(v * 100) / 100; };
    const jugadores = [{ s: miPuesto, x: r(jug.x), y: r(jug.y), a: r(jug.ang), pe: jug.p.id, v: jug.vida, vm: jug.vidaMax, e: miEstado, f: this.flagsLocal() }];
    for (const k in this.otros) {
      const o = this.otros[k];
      jugadores.push({ s: +k, x: r(o.tx), y: r(o.ty), a: r(o.ang || 0), pe: o.personaje, v: o.vida, vm: o.vidaMax, e: o.estado, f: o.f || 0 });
    }
    return {
      t: 'estado', n: this.def.id, tiempo: r(this.tiempo),
      // En versus cada uno simula sus enemigos: no se envían
      en: this.versus ? [] : this.enemigos.map(function (e) { return [r(e.x), r(e.y), r(e.ang), ESTADOS[e.estado], e.detecta ? 1 : 0]; }),
      jug: jugadores
    };
  };

  // Cliente: aplica el estado recibido del anfitrión
  const ESTADOS_INV = ['activo', 'aturdido', 'sellado'];
  Nivel.prototype.aplicarEstado = function (m, miPuesto) {
    if (m.n !== this.def.id) return;
    if (Math.abs(m.tiempo - this.tiempo) > 0.3) this.tiempo = m.tiempo;
    if (!this.versus) {
      for (let k = 0; k < this.enemigos.length && k < m.en.length; k++) {
        const e = this.enemigos[k], d = m.en[k];
        if (e.tx === undefined) { e.x = d[0]; e.y = d[1]; }
        e.tx = d[0]; e.ty = d[1]; e.ang = d[2];
        const est = ESTADOS_INV[d[3]];
        if (est === 'sellado' && e.estado !== 'sellado') this.aplicarEvento({ t: 'sellar', id: e.id });
        else if (est !== 'sellado') e.estado = est;
        e.detecta = !!d[4];
      }
    }
    const vistos = {};
    for (const j of m.jug) {
      if (j.s === miPuesto) continue;
      vistos[j.s] = true;
      this.actualizarOtro(j.s, { x: j.x, y: j.y, a: j.a, pe: j.pe, v: j.v, vm: j.vm, e: j.e, f: j.f });
    }
    for (const k in this.otros) if (!vistos[k]) delete this.otros[k];
  };

  // Eventos que viajan entre rivales en versus (el resto del mundo es de cada jugador)
  Nivel.EVENTOS_VS = { golpe: 1, emp: 1, mina: 1, minaBoom: 1, dron: 1, hackeo: 1, hackeoFin: 1, hackeoRes: 1, derrota: 1, meta: 1, ganador: 1 };

  W.Nivel = Nivel;
})();

// =====================================================
// Menús y pantallas: título, historia, selección de personaje, pausa,
// muerte, nivel completado y final.
// Cada pantalla dibuja botones con rectángulos para clic/toque y acepta teclado.
// =====================================================
(function () {
  'use strict';
  const C = W.config, PAL = W.paleta;
  const A = C.ANCHO, H = C.ALTO;
  const U = function () { return W.Puzzles.util; };
  const T = function (ctx, s, x, y, c, e, al) { W.HUD.texto(ctx, s, x, y, c, e, al); };

  // ---------- Menú vertical genérico ----------
  function Menu(opciones, y0, ancho) {
    this.opciones = opciones;   // [{ texto, accion, visible? }]
    this.y0 = y0;
    this.ancho = ancho || 130;
    this.sel = 0;
  }
  Menu.prototype.visibles = function () { return this.opciones.filter(function (o) { return o.visible === undefined || o.visible(); }); };
  Menu.prototype.rects = function () {
    const v = this.visibles(), self = this;
    return v.map(function (o, i) { return { x: (A - self.ancho) / 2, y: self.y0 + i * 18, w: self.ancho, h: 14, o: o }; });
  };
  Menu.prototype.clic = function (x, y) {
    const r = this.rects();
    for (let i = 0; i < r.length; i++) if (U().dentro({ x: x, y: y }, r[i])) { this.sel = i; r[i].o.accion(); return true; }
    return false;
  };
  Menu.prototype.tecla = function (k) {
    const n = this.visibles().length;
    if (k === 'ArrowUp' || k === 'KeyW') this.sel = (this.sel + n - 1) % n;
    if (k === 'ArrowDown' || k === 'KeyS') this.sel = (this.sel + 1) % n;
    if (k === 'Enter' || k === 'Space') { const o = this.visibles()[this.sel]; if (o) o.accion(); }
  };
  Menu.prototype.dibujar = function (ctx) {
    const r = this.rects();
    for (let i = 0; i < r.length; i++) {
      const sel = i === this.sel;
      U().boton(ctx, r[i], typeof r[i].o.texto === 'function' ? r[i].o.texto() : r[i].o.texto, sel ? PAL.cianClaro : PAL.cian, sel ? '#123540' : '#0b0a18');
    }
  };

  // ---------- Pantallas ----------
  function velo(ctx, a) { ctx.fillStyle = 'rgba(7,6,13,' + a + ')'; ctx.fillRect(0, 0, A, H); }

  function titulo(ctx, t, menu) {
    velo(ctx, 0.62);
    T(ctx, 'WORODOROX', A / 2 + 1, 25, PAL.cian, 3, 'centro');
    T(ctx, 'WORODOROX', A / 2, 24, PAL.blanco, 3, 'centro');
    T(ctx, '3073', A / 2 + 1, 45, PAL.cianOsc, 3, 'centro');
    T(ctx, '3073', A / 2, 44, PAL.magenta, 3, 'centro');
    T(ctx, 'ESCAPA DE LA NAVE CRIADERO', A / 2, 66, '#8d93ad', 1, 'centro');
    menu.dibujar(ctx);
    T(ctx, 'VERSION 0.9 - UN JUGADOR - M: SONIDO', A / 2, 170, '#4a4f63', 1, 'centro');
  }

  const HISTORIA = [
    'ANO 3073. LOS HUMANOS SON LA NUEVA FUENTE DE ENERGIA.',
    'WORODOROX ERA UNA NAVE CRIADERO: MILES DE PERSONAS DORMIAN EN CAPSULAS CRIOGENICAS.',
    'LA NAVE ESTALLO. SU IA CENTRAL QUEDO INESTABLE Y SUS DEFENSAS SIGUEN ACTIVAS.',
    'TU DESPERTASTE. LA TRIPULACION DEJO PROTOCOLOS DE SEGURIDAD EN LAS PAREDES.',
    'ENCUENTRA UNA NAVE SALVAVIDAS Y HUYE A TEMUKEITOR, DONDE LOS HUMANOS VIVEN EN PAZ.'
  ];
  function historia(ctx, t, tactil) {
    ctx.fillStyle = PAL.fondo; ctx.fillRect(0, 0, A, H);
    const visibles = Math.min(HISTORIA.length, Math.floor(t / 1.6) + 1);
    let y = 34;
    for (let i = 0; i < visibles; i++) y = W.HUD.parrafo(ctx, HISTORIA[i], A / 2, y, 280, i === visibles - 1 ? PAL.cianClaro : PAL.gris, 'centro') + 8;
    if (Math.floor(t * 2) % 2 === 0) T(ctx, tactil ? 'TOCA PARA CONTINUAR' : 'CLIC PARA CONTINUAR', A / 2, 164, PAL.magenta, 1, 'centro');
  }

  // Selección de personaje
  const Seleccion = {
    sel: 0,
    tarjeta: function (i) { return { x: 8 + i * 62, y: 22, w: 58, h: 88 }; },
    boton: { x: A / 2 - 40, y: 156, w: 80, h: 16 },
    // Devuelve el id elegido o null
    clic: function (x, y) {
      for (let i = 0; i < 5; i++) {
        if (U().dentro({ x: x, y: y }, Seleccion.tarjeta(i))) {
          if (Seleccion.sel === i) return W.ORDEN_PERSONAJES[i];
          Seleccion.sel = i;
          if (W.Audio) W.Audio.sfx('clic');
          return null;
        }
      }
      if (U().dentro({ x: x, y: y }, Seleccion.boton)) return W.ORDEN_PERSONAJES[Seleccion.sel];
      return null;
    },
    tecla: function (k) {
      if (k === 'ArrowLeft' || k === 'KeyA') Seleccion.sel = (Seleccion.sel + 4) % 5;
      if (k === 'ArrowRight' || k === 'KeyD') Seleccion.sel = (Seleccion.sel + 1) % 5;
      if (k === 'Enter' || k === 'Space') return W.ORDEN_PERSONAJES[Seleccion.sel];
      return null;
    },
    dibujar: function (ctx, t) {
      ctx.fillStyle = PAL.fondo; ctx.fillRect(0, 0, A, H);
      T(ctx, 'ELIGE A TU SOBREVIVIENTE', A / 2, 8, PAL.magenta, 1, 'centro');
      for (let i = 0; i < 5; i++) {
        const p = W.PERSONAJES[W.ORDEN_PERSONAJES[i]];
        const r = Seleccion.tarjeta(i), sel = i === Seleccion.sel;
        U().boton(ctx, r, '', sel ? PAL.cianClaro : PAL.cianOsc, sel ? '#10202a' : '#0b0a18');
        const bote = sel ? Math.round(Math.sin(t * 6) * 1) : 0;
        W.Personajes.dibujarCuerpo(ctx, p.id, r.x + 17, r.y + 8 + bote, 1, sel ? t * 8 : 0, 3, false);
        T(ctx, p.nombre, r.x + r.w / 2, r.y + 58, sel ? PAL.blanco : PAL.gris, 1, 'centro');
        T(ctx, p.arma, r.x + r.w / 2, r.y + 68, PAL.amarillo, 1, 'centro');
        T(ctx, 'VIDA ' + p.vida, r.x + r.w / 2, r.y + 78, PAL.grisOsc, 1, 'centro');
      }
      const p = W.PERSONAJES[W.ORDEN_PERSONAJES[Seleccion.sel]];
      T(ctx, p.tipo, A / 2, 118, PAL.cian, 1, 'centro');
      W.HUD.parrafo(ctx, 'VENTAJA: ' + p.ventaja, A / 2, 130, 290, PAL.cianClaro, 'centro');
      U().boton(ctx, Seleccion.boton, 'ELEGIR', PAL.verde, '#0b1a12');
    }
  };

  function pausa(ctx, menu) {
    velo(ctx, 0.75);
    T(ctx, 'PAUSA', A / 2, 40, PAL.magenta, 3, 'centro');
    menu.dibujar(ctx);
  }

  function muerte(ctx, t, tactil) {
    velo(ctx, Math.min(0.92, t * 1.2));
    ctx.fillStyle = 'rgba(255,59,59,' + Math.max(0, 0.4 - t * 0.3).toFixed(2) + ')'; ctx.fillRect(0, 0, A, H);
    T(ctx, 'SENAL VITAL PERDIDA', A / 2, 60, PAL.rojo, 2, 'centro');
    if (t > 0.8) T(ctx, 'REIMPRIMIENDO EN LA ULTIMA ESTACION DE RESPALDO...', A / 2, 86, PAL.gris, 1, 'centro');
    if (t > 1.6) {
      T(ctx, 'CONSERVAS: PUERTAS ABIERTAS Y PISTAS', A / 2, 104, PAL.cian, 1, 'centro');
      T(ctx, 'PIERDES: OBJETOS DESDE EL ULTIMO RESPALDO', A / 2, 114, PAL.magenta, 1, 'centro');
    }
    if (t > 2.2 && Math.floor(t * 2) % 2 === 0) T(ctx, tactil ? 'TOCA PARA CONTINUAR' : 'CLIC PARA CONTINUAR', A / 2, 144, PAL.cianClaro, 1, 'centro');
  }

  function nivelCompleto(ctx, t, def, partida, tactil) {
    velo(ctx, Math.min(0.9, t * 1.5));
    T(ctx, 'SECTOR SUPERADO', A / 2, 44, PAL.verde, 2, 'centro');
    T(ctx, def.nombre, A / 2, 66, PAL.cianClaro, 1, 'centro');
    const min = Math.floor(partida.tiempo / 60), seg = Math.floor(partida.tiempo % 60);
    T(ctx, 'TIEMPO TOTAL: ' + min + ':' + (seg < 10 ? '0' : '') + seg, A / 2, 86, PAL.gris, 1, 'centro');
    T(ctx, 'REIMPRESIONES: ' + partida.muertes, A / 2, 96, PAL.gris, 1, 'centro');
    T(ctx, 'PISTAS EN LA LIBRETA: ' + partida.libreta.length, A / 2, 106, PAL.gris, 1, 'centro');
    if (t > 1 && Math.floor(t * 2) % 2 === 0) T(ctx, tactil ? 'TOCA PARA CONTINUAR' : 'CLIC PARA CONTINUAR', A / 2, 140, PAL.cianClaro, 1, 'centro');
  }

  const FINAL = [
    'LA IA DE WORODOROX QUEDA SELLADA EN SU PROPIO NUCLEO.',
    'LA NAVE SALVAVIDAS SE DESPRENDE DEL HANGAR ENTRE CHISPAS Y SILENCIO.',
    'ATRAS QUEDAN MILES DE CAPSULAS. LA IA YA NO PUEDE TOCARLAS: ALGUIEN VOLVERA POR ELLAS.',
    'RUMBO A TEMUKEITOR. POR FIN, PAZ.'
  ];
  function final(ctx, t, personaje, partida, tactil) {
    ctx.fillStyle = PAL.fondo; ctx.fillRect(0, 0, A, H);
    // Estrellas que pasan
    for (let k = 0; k < 60; k++) {
      const x = (k * 97 - t * (20 + (k % 5) * 25)) % A;
      ctx.fillStyle = k % 7 === 0 ? PAL.cianClaro : '#4a4f63';
      ctx.fillRect((x + A) % A, (k * 41) % H, k % 5 === 0 ? 2 : 1, 1);
    }
    // Nave salvavidas
    const nx = 40 + Math.sin(t) * 4, ny = 30 + Math.cos(t * 1.3) * 2;
    ctx.fillStyle = '#4a4f63'; ctx.fillRect(nx, ny, 30, 9);
    ctx.fillStyle = '#8d93ad'; ctx.fillRect(nx + 6, ny - 4, 16, 5);
    ctx.fillStyle = PAL.cian; ctx.fillRect(nx + 22, ny - 2, 4, 2);
    ctx.fillStyle = Math.floor(t * 10) % 2 ? PAL.magenta : PAL.amarillo; ctx.fillRect(nx - 6, ny + 2, 6, 4);
    W.Personajes.dibujarCuerpo(ctx, personaje, 260, 26, -1, 0, 2, false);
    let y = 64;
    const n = Math.min(FINAL.length, Math.floor(t / 2) + 1);
    for (let i = 0; i < n; i++) y = W.HUD.parrafo(ctx, FINAL[i], A / 2, y, 280, i === n - 1 ? PAL.cianClaro : PAL.gris, 'centro') + 6;
    if (t > 9) {
      const min = Math.floor(partida.tiempo / 60);
      T(ctx, 'FIN - TIEMPO ' + min + ' MIN - REIMPRESIONES ' + partida.muertes, A / 2, 152, PAL.verde, 1, 'centro');
      if (Math.floor(t * 2) % 2 === 0) T(ctx, tactil ? 'TOCA PARA VOLVER AL TITULO' : 'CLIC PARA VOLVER AL TITULO', A / 2, 164, PAL.magenta, 1, 'centro');
    }
  }

  // Cartel con el nombre del nivel al comenzar
  function cartelNivel(ctx, def, t) {
    if (t > 4) return;
    const a = t < 3 ? 1 : 1 - (t - 3);
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = 'rgba(7,6,13,0.78)';
    ctx.fillRect(0, 50, A, 44);
    ctx.fillStyle = PAL.magenta; ctx.fillRect(0, 50, A, 1); ctx.fillRect(0, 93, A, 1);
    T(ctx, 'ZONA ' + def.zona + ': ' + W.ZONAS[def.zona] + ' - NIVEL ' + def.id, A / 2, 55, PAL.gris, 1, 'centro');
    T(ctx, def.nombre, A / 2, 65, PAL.cianClaro, 2, 'centro');
    if (def.historia) W.HUD.parrafo(ctx, def.historia, A / 2, 80, 290, PAL.gris, 'centro');
    ctx.globalAlpha = 1;
  }

  // Vista de una pista a pantalla completa (al hacer clic en un holograma)
  function verPista(ctx, datos, tactil) {
    velo(ctx, 0.9);
    ctx.fillStyle = PAL.cian; ctx.fillRect(60, 14, 200, 1); ctx.fillRect(60, 160, 200, 1);
    T(ctx, datos.titulo, A / 2, 20, PAL.cian, 1, 'centro');
    ctx.fillStyle = '#0b0d16'; ctx.fillRect(100, 30, 120, 112);
    W.Pistas.dibujar(ctx, datos, 104, 34, 112, 104);
    T(ctx, 'REGISTRADA EN LA LIBRETA - ' + (tactil ? 'TOCA' : 'CLIC') + ' PARA VOLVER', A / 2, 150, PAL.gris, 1, 'centro');
  }

  W.Menus = {
    Menu: Menu, titulo: titulo, historia: historia, Seleccion: Seleccion, pausa: pausa,
    muerte: muerte, nivelCompleto: nivelCompleto, final: final, cartelNivel: cartelNivel, verPista: verPista,
    LINEAS_HISTORIA: HISTORIA.length
  };
})();

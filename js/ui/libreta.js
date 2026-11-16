// =====================================================
// Libreta (tecla E): registra automáticamente cada pista encontrada.
// Lista a la izquierda, pista seleccionada a la derecha.
// =====================================================
(function () {
  'use strict';
  const C = W.config, PAL = W.paleta;
  const A = C.ANCHO, H = C.ALTO;
  const FILA = 11, MAX_FILAS = 12;

  const Libreta = {
    sel: -1,
    desde: 0,
    botonCerrar: { x: A - 46, y: 3, w: 42, h: 11 },

    abrir: function (partida, idPreferido) {
      const n = partida.libreta.length;
      Libreta.sel = n - 1;
      if (idPreferido) {
        const k = partida.libreta.findIndex(function (e) { return e.id === idPreferido; });
        if (k >= 0) Libreta.sel = k;
      }
      Libreta.desde = Math.max(0, Libreta.sel - MAX_FILAS + 1);
    },

    // Devuelve true si se debe cerrar
    clic: function (partida, x, y) {
      if (W.Puzzles.util.dentro({ x: x, y: y }, Libreta.botonCerrar)) return true;
      if (x < 120 && y >= 20) {
        const k = Libreta.desde + Math.floor((y - 20) / FILA);
        if (k < partida.libreta.length) Libreta.sel = k;
        return false;
      }
      return false;
    },
    tecla: function (partida, k) {
      const n = partida.libreta.length;
      if (k === 'ArrowUp' || k === 'KeyW') Libreta.sel = Math.max(0, Libreta.sel - 1);
      if (k === 'ArrowDown' || k === 'KeyS') Libreta.sel = Math.min(n - 1, Libreta.sel + 1);
      if (Libreta.sel < Libreta.desde) Libreta.desde = Libreta.sel;
      if (Libreta.sel >= Libreta.desde + MAX_FILAS) Libreta.desde = Libreta.sel - MAX_FILAS + 1;
    },

    dibujar: function (ctx, partida) {
      ctx.fillStyle = 'rgba(5,4,10,0.96)';
      ctx.fillRect(0, 0, A, H);
      ctx.fillStyle = PAL.cian;
      ctx.fillRect(0, 0, A, 1); ctx.fillRect(0, 16, A, 1); ctx.fillRect(122, 16, 1, H - 16);
      W.HUD.texto(ctx, 'LIBRETA DE PISTAS', 5, 6, PAL.cian);
      W.Puzzles.util.boton(ctx, Libreta.botonCerrar, 'CERRAR', PAL.gris);

      const lista = partida.libreta;
      if (!lista.length) {
        W.HUD.texto(ctx, 'AUN NO HAS REGISTRADO PISTAS', 220, 70, PAL.gris, 1, 'centro');
        W.HUD.parrafo(ctx, 'ACERCATE A LOS HOLOGRAMAS CIAN DE LAS PAREDES. LO QUE VES EN UN LUGAR SE USA EN OTRO.', 220, 86, 180, PAL.grisOsc, 'centro');
      }
      for (let k = Libreta.desde; k < Math.min(lista.length, Libreta.desde + MAX_FILAS); k++) {
        const e = lista[k];
        const y = 20 + (k - Libreta.desde) * FILA;
        const sel = k === Libreta.sel;
        if (sel) { ctx.fillStyle = '#123540'; ctx.fillRect(2, y - 2, 118, FILA - 1); }
        const actual = e.nivel === partida.nivel;
        W.HUD.texto(ctx, 'N' + e.nivel, 5, y, actual ? PAL.verde : PAL.grisOsc);
        W.HUD.texto(ctx, e.datos.titulo.slice(0, 22), 22, y, sel ? PAL.cianClaro : PAL.gris);
      }
      if (lista.length > MAX_FILAS) W.HUD.texto(ctx, (Libreta.sel + 1) + '/' + lista.length, 60, H - 10, PAL.grisOsc, 1, 'centro');

      const e = lista[Libreta.sel];
      if (e) {
        W.HUD.texto(ctx, e.datos.titulo, 221, 22, PAL.cian, 1, 'centro');
        ctx.fillStyle = '#0b0d16'; ctx.fillRect(160, 32, 122, 112);
        ctx.fillStyle = PAL.cianOsc; ctx.fillRect(160, 32, 122, 1); ctx.fillRect(160, 143, 122, 1);
        W.Pistas.dibujar(ctx, e.datos, 164, 36, 114, 104);
        W.HUD.texto(ctx, W.Pistas.resumen(e.datos), 221, 150, PAL.gris, 1, 'centro');
        W.HUD.texto(ctx, e.nivel === partida.nivel ? 'DE ESTE SECTOR' : 'DE UN SECTOR ANTERIOR', 221, 162, e.nivel === partida.nivel ? PAL.verde : PAL.grisOsc, 1, 'centro');
      }
    }
  };

  W.Libreta = Libreta;
})();

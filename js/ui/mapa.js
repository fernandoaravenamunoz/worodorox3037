// =====================================================
// Mapa automático (tecla Q): se dibuja a medida que se explora.
// Solo muestra las casillas que el jugador ya vio.
// =====================================================
(function () {
  'use strict';
  const C = W.config, PAL = W.paleta, CEL = W.CELDA;

  const COLOR = {};
  COLOR[CEL.PANEL] = '#3a3a52'; COLOR[CEL.NEON] = '#4a3a62'; COLOR[CEL.TUBOS] = '#3a3a52'; COLOR[CEL.DECOR] = '#2f3a52';
  COLOR[CEL.HOLOGRAMA] = PAL.cian; COLOR[CEL.PUERTA] = '#7ff3ff'; COLOR[CEL.PUERTA_MAGENTA] = PAL.magenta;
  COLOR[CEL.PUERTA_TARJETA] = PAL.blanco; COLOR[CEL.DUCTO] = PAL.amarillo; COLOR[CEL.ESTACION] = PAL.verde;
  COLOR[CEL.SALIDA] = PAL.verde; COLOR[CEL.APLASTADOR] = PAL.rojo; COLOR[CEL.NUCLEO] = PAL.magenta;

  const LEYENDA = [
    [PAL.cian, 'PISTA'], ['#7ff3ff', 'PUERTA'], [PAL.magenta, 'RIESGO'], [PAL.blanco, 'TARJETA'],
    [PAL.amarillo, 'DUCTO 2D'], [PAL.verde, 'ESTACION/SALIDA'], [PAL.rojo, 'PELIGRO']
  ];

  function dibujar(ctx, nivel, t) {
    const A = C.ANCHO, H = C.ALTO;
    const mapa = nivel.mapa, jug = nivel.jug;
    ctx.fillStyle = 'rgba(5,4,10,0.95)';
    ctx.fillRect(0, 0, A, H);
    ctx.fillStyle = PAL.magenta;
    ctx.fillRect(0, 0, A, 1); ctx.fillRect(0, 13, A, 1);
    W.HUD.texto(ctx, 'MAPA DEL SECTOR - ' + nivel.def.nombre, 5, 5, PAL.magenta);
    W.HUD.texto(ctx, 'Q O TOCA PARA CERRAR', A - 5, 5, PAL.gris, 1, 'der');

    const s = Math.max(2, Math.min(9, Math.floor(296 / mapa.ancho), Math.floor(138 / mapa.alto)));
    const ox = Math.floor((A - mapa.ancho * s) / 2), oy = 18 + Math.floor((140 - mapa.alto * s) / 2);
    for (let y = 0; y < mapa.alto; y++) {
      for (let x = 0; x < mapa.ancho; x++) {
        const i = y * mapa.ancho + x;
        if (!mapa.visto[i]) continue;
        const c = mapa.celdas[i];
        const px = ox + x * s, py = oy + y * s;
        if (c === 0) {
          ctx.fillStyle = '#16142a';
          ctx.fillRect(px, py, s, s);
          if (nivel.esTrampa[i]) { ctx.fillStyle = PAL.rojo; ctx.fillRect(px + (s >> 1) - 1, py + (s >> 1) - 1, 2, 2); }
        } else {
          ctx.fillStyle = COLOR[c] || '#3a3a52';
          ctx.fillRect(px, py, s, s);
        }
      }
    }
    // Enemigos vistos
    for (const e of nivel.enemigos) {
      const i = mapa.indice(Math.floor(e.x), Math.floor(e.y));
      if (!mapa.visto[i] || e.estado === 'sellado') continue;
      ctx.fillStyle = e.estado === 'aturdido' ? PAL.amarillo : PAL.rojo;
      ctx.fillRect(Math.round(ox + e.x * s) - 1, Math.round(oy + e.y * s) - 1, 3, 3);
    }
    // Compañeros (multijugador), con el color de su puesto
    for (const k in nivel.otros) {
      const o = nivel.otros[k];
      ctx.fillStyle = W.texturas.COLORES_PUESTO[+k % 4];
      ctx.fillRect(Math.round(ox + o.x * s) - 1, Math.round(oy + o.y * s) - 1, 3, 3);
    }
    // Jugador: punto con dirección (parpadea)
    const jx = ox + jug.x * s, jy = oy + jug.y * s;
    if (Math.floor(t * 4) % 2 === 0) {
      ctx.fillStyle = PAL.cianClaro;
      ctx.fillRect(Math.round(jx) - 1, Math.round(jy) - 1, 3, 3);
    }
    ctx.fillStyle = PAL.cian;
    for (let k = 2; k < 7; k++) ctx.fillRect(Math.round(jx + Math.cos(jug.ang) * k), Math.round(jy + Math.sin(jug.ang) * k), 1, 1);

    // Leyenda
    let x = 6;
    for (const l of LEYENDA) {
      ctx.fillStyle = l[0];
      ctx.fillRect(x, H - 9, 5, 5);
      W.HUD.texto(ctx, l[1], x + 7, H - 9, PAL.gris);
      x += 12 + W.fuente.ancho(l[1], 1);
    }
  }

  W.MapaUI = { dibujar: dibujar };
})();

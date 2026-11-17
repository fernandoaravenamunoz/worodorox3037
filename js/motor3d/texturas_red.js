// =====================================================
// Texturas del multijugador y de las puertas de doble palanca
// (amplía W.texturas sin tocar texturas.js)
//   - Palanca apagada / activa y puerta de doble palanca (por zona)
//   - Holograma cifrado: lo que ven quienes no pueden leer una pista repartida
//   - Sprites de jugadores con escudo o aturdidos, minas y chispas del EMP
// =====================================================
(function () {
  'use strict';
  const T = W.config.TEX;
  const TX = W.texturas;

  // Convierte un dibujo en canvas a textura de pared, sobre una textura base.
  // Píxeles con alfa 254 (globalAlpha = 254/255) quedan emisivos (neón).
  let lienzo = null;
  function sobreBase(base, dibujar) {
    if (!lienzo) { lienzo = document.createElement('canvas'); lienzo.width = T; lienzo.height = T; }
    const c = lienzo.getContext('2d', { willReadFrequently: true });
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.clearRect(0, 0, T, T);
    dibujar(c);
    const d = c.getImageData(0, 0, T, T).data;
    const L = { t: T, px: new Uint32Array(base.px), em: new Uint8Array(base.em) };
    for (let i = 0; i < T * T; i++) {
      if (d[i * 4 + 3] < 128) continue;
      L.px[i] = TX.empacar(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
      L.em[i] = d[i * 4 + 3] === 254 ? 1 : 0;
    }
    return L;
  }
  function neon(c) { c.globalAlpha = 254 / 255; }
  function opaco(c) { c.globalAlpha = 1; }
  function texto(c, s, x, y, color) { c.fillStyle = color; W.fuente.dibujarCrudo(c, s, x, y, color, 1); }

  // ---------- Palanca (14) ----------
  function palanca(z, activa) {
    return sobreBase(z.paredes[1], function (c) {
      opaco(c);
      c.fillStyle = '#0b0c12'; c.fillRect(20, 10, 24, 44);       // placa
      c.fillStyle = '#3a3d54'; c.fillRect(22, 12, 20, 40);
      c.fillStyle = '#0b0c12'; c.fillRect(30, 16, 4, 30);         // ranura
      // Mango: arriba (apagada) o abajo (activa)
      const y = activa ? 38 : 14;
      c.fillStyle = '#8d93ad'; c.fillRect(31, activa ? 31 : 18, 2, 12);
      c.fillStyle = activa ? '#4dff8a' : '#ff3b3b';
      neon(c); c.fillRect(27, y, 10, 6); opaco(c);
      c.fillStyle = '#ffffff'; c.fillRect(28, y + 1, 3, 1);
      // Luces de estado
      neon(c);
      c.fillStyle = activa ? '#4dff8a' : '#0f5a6b'; c.fillRect(24, 48, 4, 2);
      c.fillStyle = '#22e4ff'; c.fillRect(36, 48, 4, 2);
      c.fillRect(20, 10, 24, 1); c.fillRect(20, 53, 24, 1);
      opaco(c);
    });
  }

  // ---------- Puerta de doble palanca (15) ----------
  let puertaDoble = null;
  function puertaPalanca() {
    if (puertaDoble) return puertaDoble;
    puertaDoble = sobreBase(TX.comunes.puerta, function (c) {
      // Dos palancas dibujadas en la hoja izquierda
      for (let k = 0; k < 2; k++) {
        const x = 10 + k * 10;
        opaco(c);
        c.fillStyle = '#0b0c12'; c.fillRect(x, 20, 6, 18);
        neon(c);
        c.fillStyle = '#22e4ff'; c.fillRect(x + 2, 22, 2, 8);
        c.fillStyle = '#4dff8a'; c.fillRect(x + 1, 22, 4, 3);
      }
      neon(c);
      texto(c, 'X2', 13, 42, '#c8fbff');
      c.fillStyle = '#4dff8a'; c.fillRect(26, 1, 12, 3);
      opaco(c);
    });
    return puertaDoble;
  }

  // La textura de cada zona gana las paredes 14 y 15
  const zonaOriginal = TX.zona;
  TX.zona = function (n) {
    const z = zonaOriginal(n);
    if (!z.paredes[14]) {
      z.paredes[14] = palanca(z, false);
      z.palancaActiva = palanca(z, true);
      z.paredes[15] = puertaPalanca();
    }
    return z;
  };

  // ---------- Holograma cifrado ----------
  const cacheCifrado = {};
  TX.hologramaCifrado = function (zona, puesto, nombre) {
    const clave = zona + '|' + puesto + '|' + nombre;
    if (cacheCifrado[clave]) return cacheCifrado[clave];
    const color = TX.COLORES_PUESTO[puesto % 4];
    const rnd = TX.azar(4242 + puesto * 17 + zona);
    const L = TX.hologramaDesde(zona, function (c) {
      // Estática del color del jugador que sí lo puede leer
      c.fillStyle = color;
      for (let k = 0; k < 70; k++) c.fillRect(Math.floor(rnd() * 50), Math.floor(rnd() * 30) + 18, 1 + Math.floor(rnd() * 3), 1);
      c.fillStyle = '#0b0d16'; c.fillRect(2, 2, 46, 15);
      W.fuente.dibujarCrudo(c, 'CIFRADO', 11, 4, '#ff2bd6', 1);
      W.fuente.dibujarCrudo(c, 'SOLO LEE', 9, 11, '#8d93ad', 1);
      c.fillStyle = '#0b0d16'; c.fillRect(1, 40, 48, 9);
      const n = String(nombre || '').slice(0, 12);
      W.fuente.dibujarCrudo(c, n, Math.max(1, Math.round(25 - (n.length * 4 - 1) / 2)), 42, color, 1);
    });
    cacheCifrado[clave] = L;
    return L;
  };

  // ---------- Jugadores con estado visible ----------
  // estado: '' | 'atrapado' (tendido) | 'escudo' (burbuja cian) | 'aturdido' (chispas del EMP)
  const cacheEstado = {};
  TX.spriteJugadorEstado = function (personaje, puesto, estado) {
    if (!estado || estado === 'atrapado') return TX.spriteJugador(personaje, puesto, estado === 'atrapado');
    const clave = personaje + '|' + puesto + '|' + estado;
    if (cacheEstado[clave]) return cacheEstado[clave];
    const L = TX.spriteDesde(function (c) {
      W.Personajes.dibujarCuerpo(c, personaje, 8, 4, 1, 0, 2, false);
      c.globalAlpha = 254 / 255;
      c.fillStyle = TX.COLORES_PUESTO[puesto % 4];
      c.fillRect(15, 0, 2, 1); c.fillRect(14, 1, 4, 1); c.fillRect(15, 2, 2, 1);
      if (estado === 'escudo') {
        c.fillStyle = '#7ff3ff';
        for (let k = 0; k < 28; k++) {
          const a = k * Math.PI * 2 / 28;
          c.fillRect(Math.round(16 + Math.cos(a) * 13), Math.round(17 + Math.sin(a) * 14), 1, 1);
        }
      } else {
        c.fillStyle = '#e8b923';
        [[6, 6], [25, 5], [4, 14], [27, 15], [10, 2], [22, 1]].forEach(function (p) { c.fillRect(p[0], p[1], 2, 1); c.fillRect(p[0] + 1, p[1] - 1, 1, 3); });
      }
      c.globalAlpha = 1;
    });
    cacheEstado[clave] = L;
    return L;
  };

  // ---------- Mina (propia: con el color del puesto; ajena: solo la luz roja) ----------
  const cacheMina = {};
  TX.spriteMina = function (puesto) {
    const clave = String(puesto);
    if (cacheMina[clave]) return cacheMina[clave];
    const L = TX.spriteDesde(function (c) {
      c.fillStyle = '#2a2a3c'; c.fillRect(6, 24, 20, 6);
      c.fillStyle = '#4a4f63'; c.fillRect(8, 22, 16, 3);
      c.globalAlpha = 254 / 255;
      c.fillStyle = '#ff3b3b'; c.fillRect(14, 19, 4, 3);
      if (puesto >= 0) { c.fillStyle = TX.COLORES_PUESTO[puesto % 4]; c.fillRect(6, 29, 20, 1); }
      c.globalAlpha = 1;
    });
    cacheMina[clave] = L;
    return L;
  };

  // ---------- Chispa del pulso EMP ----------
  TX.sprites.emp = TX.spriteDesde(function (c) {
    c.globalAlpha = 254 / 255;
    c.fillStyle = '#7ff3ff';
    for (let k = 0; k < 6; k++) {
      const a = k * Math.PI / 3;
      for (let r = 2; r < 9; r++) c.fillRect(Math.round(16 + Math.cos(a) * r), Math.round(16 + Math.sin(a) * r), 1, 1);
    }
    c.fillStyle = '#ffffff'; c.fillRect(15, 15, 2, 2);
    c.globalAlpha = 1;
  });
})();

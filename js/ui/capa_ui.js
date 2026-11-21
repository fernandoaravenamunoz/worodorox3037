// =====================================================
// Capa de interfaz en 32 bits
//
// Las pantallas de interfaz (puzzles, libreta, mapa, menús, sala de espera, resultados
// y salas 2D) están diseñadas con coordenadas de 320×180. Esta capa las dibuja DIRECTO
// en la pantalla de 480×270, sin ampliar una imagen:
//   - Cada rectángulo se ajusta a píxeles enteros (bordes nítidos, sin borrosidad).
//   - Las líneas de 1 píxel siguen midiendo 1 píxel (bordes finos como en DuMulti).
//   - El texto se dibuja con la fuente a su tamaño real de 480×270 (ver HUD.texto),
//     así se ve igual de nítido que el HUD.
// Los módulos reciben esta capa como si fuera un contexto de canvas normal.
// =====================================================
(function () {
  'use strict';

  function CapaUI(real, k) {
    this.real = real;     // contexto de la pantalla de 480×270
    this.k = k;           // factor (1,5)
    this.esUI = true;
  }
  const P = CapaUI.prototype;

  Object.defineProperty(P, 'fillStyle', { get: function () { return this.real.fillStyle; }, set: function (v) { this.real.fillStyle = v; } });
  Object.defineProperty(P, 'globalAlpha', { get: function () { return this.real.globalAlpha; }, set: function (v) { this.real.globalAlpha = v; } });
  Object.defineProperty(P, 'imageSmoothingEnabled', { get: function () { return false; }, set: function () { /* siempre nítido */ } });

  P.X = function (x) { return Math.round(x * this.k); };

  // Rectángulo ajustado a la cuadrícula de 480×270
  P.fillRect = function (x, y, w, h) {
    const k = this.k;
    const x0 = Math.round(x * k), y0 = Math.round(y * k);
    // Las líneas finas (1 × largo) quedan de 1 píxel; los puntos sueltos se escalan normal
    const x1 = w === 1 && h > 1 ? x0 + 1 : Math.round((x + w) * k);
    const y1 = h === 1 && w > 1 ? y0 + 1 : Math.round((y + h) * k);
    if (x1 > x0 && y1 > y0) this.real.fillRect(x0, y0, x1 - x0, y1 - y0);
  };
  P.clearRect = function (x, y, w, h) {
    const k = this.k;
    this.real.clearRect(Math.round(x * k), Math.round(y * k), Math.round(w * k), Math.round(h * k));
  };
  P.drawImage = function (img, a, b, c, d, e, f, g, h) {
    const k = this.k;
    this.real.imageSmoothingEnabled = false;
    if (e !== undefined) {   // forma de 9 argumentos (recorte)
      this.real.drawImage(img, a, b, c, d, Math.round(e * k), Math.round(f * k), Math.round(g * k), Math.round(h * k));
    } else {
      const w = c === undefined ? img.width : c, hh = d === undefined ? img.height : d;
      const x0 = Math.round(a * k), y0 = Math.round(b * k);
      this.real.drawImage(img, x0, y0, Math.round((a + w) * k) - x0, Math.round((b + hh) * k) - y0);
    }
  };
  P.beginPath = function () { this.real.beginPath(); };
  P.arc = function (x, y, r, a0, a1, ccw) { this.real.arc(x * this.k, y * this.k, r * this.k, a0, a1, ccw); };
  P.fill = function () { this.real.fill(); };
  P.save = function () { this.real.save(); };
  P.restore = function () { this.real.restore(); };

  W.CapaUI = CapaUI;
})();

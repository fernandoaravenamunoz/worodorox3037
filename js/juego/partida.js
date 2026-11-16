// =====================================================
// Partida: estado persistente del jugador y guardado en localStorage
//
// Al morir:
//   SE CONSERVAN: puertas abiertas, salas 2D superadas, enemigos sellados y la libreta.
//   SE PIERDEN: objetos recogidos desde el último punto de control.
// El guardado ocurre al activar cada estación de respaldo y al terminar un nivel.
// =====================================================
(function () {
  'use strict';
  const CLAVE = W.config.CLAVE_GUARDADO;

  function nueva(personaje) {
    return {
      version: 2,
      personaje: personaje,
      nivel: 1,
      semilla: (Math.random() * 1e9) | 0,
      libreta: [],            // [{ id, nivel, datos }]  (las partes de pistas compuestas usan id 'pista#n')
      puertas: {},            // { 'n1': [índices de casilla] }
      salas: {},              // { 'n1': true }
      sellados: {},           // { 'n1': [ids de enemigos] }
      estaciones: {},         // { 'n1': [índices] }
      botiquines: {},         // { 'n1': [índices usados] }
      objetos: [],            // inventario actual
      punto: null,            // { nivel, x, y, ang, objetos }
      muertes: 0,
      tiempo: 0
    };
  }

  function clave(p, nivel) { return 'n' + (nivel || p.nivel); }
  function lista(p, campo, nivel) {
    const k = clave(p, nivel);
    if (!p[campo][k]) p[campo][k] = [];
    return p[campo][k];
  }

  // Copia profunda simple (todo es JSON)
  function copiar(o) { return JSON.parse(JSON.stringify(o)); }

  const Partida = {
    nueva: nueva,
    lista: lista,
    clave: clave,

    guardar: function (p) {
      if (p.sinGuardar) return false;   // las partidas multijugador no tocan el guardado
      try { localStorage.setItem(CLAVE, JSON.stringify(p)); return true; }
      catch (err) { return false; }
    },
    cargar: function () {
      try {
        const s = localStorage.getItem(CLAVE);
        if (!s) return null;
        const p = JSON.parse(s);
        return p && p.version === 2 ? p : null;
      } catch (err) { return null; }
    },
    borrar: function () { try { localStorage.removeItem(CLAVE); } catch (err) { /* nada */ } },
    hayGuardado: function () { return !!Partida.cargar(); },

    // Registra una pista (o una parte de pista) en la libreta (si no estaba)
    anotarPista: function (p, id, nivel, datos) {
      if (p.libreta.some(function (e) { return e.id === id; })) return false;
      p.libreta.push({ id: id, nivel: nivel, datos: copiar(datos) });
      return true;
    },
    // Partes vistas de una pista compuesta (ordenadas), como datos dibujables
    partesConocidas: function (p, id) {
      return p.libreta
        .filter(function (e) { return e.id.indexOf(id + '#') === 0; })
        .map(function (e) { return e.datos; })
        .sort(function (a, b) { return a.parte - b.parte; });
    },
    // Una pista se conoce si está en la libreta o si se vieron TODAS sus partes
    conocePista: function (p, id) {
      if (p.libreta.some(function (e) { return e.id === id; })) return true;
      const partes = Partida.partesConocidas(p, id);
      return partes.length > 0 && partes.length >= (partes[0].partes || 2);
    },

    // Punto de control: guarda posición y objetos actuales
    marcarPunto: function (p, x, y, ang) {
      p.punto = { nivel: p.nivel, x: x, y: y, ang: ang, objetos: p.objetos.slice() };
      Partida.guardar(p);
    },

    // Al morir: se recuperan los objetos que había en el punto de control
    restaurarObjetos: function (p) {
      p.objetos = p.punto && p.punto.nivel === p.nivel ? p.punto.objetos.slice() : [];
    },

    // Al pasar de nivel: el inventario es por nivel (las tarjetas no sirven en otro sector)
    siguienteNivel: function (p) {
      p.nivel++;
      p.objetos = [];
      p.punto = null;
      Partida.guardar(p);
    }
  };

  W.Partida = Partida;
})();

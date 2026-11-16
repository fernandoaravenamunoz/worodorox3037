// =====================================================
// Transporte de red: dos implementaciones con la misma interfaz
//   W.Transporte.peer   : por internet (PeerJS / WebRTC)
//   W.Transporte.local  : entre pestañas del mismo navegador (BroadcastChannel), para probar
//
// anfitrion(id, h) → { enviar(idCliente, msg), difundir(msg, exceptoId), cerrar() }
//   h: { listo(), conexion(id), mensaje(id, msg), desconexion(id), error(tipo) }
// cliente(id, h)   → { enviar(msg), cerrar() }
//   h: { listo(), mensaje(msg), desconexion(), error(tipo) }
// Si mañana se cambia a un servidor con WebSocket, basta con agregar otra implementación.
// =====================================================
(function () {
  'use strict';
  const CR = W.configRed;

  // ---------- PeerJS ----------
  const peer = {
    disponible: function () { return typeof window.Peer === 'function'; },

    anfitrion: function (id, h) {
      const conns = {};
      const p = new window.Peer(id, { debug: 0, config: { iceServers: CR.iceServers } });
      p.on('open', function () { h.listo(); });
      p.on('connection', function (c) {
        c.on('open', function () { conns[c.peer] = c; h.conexion(c.peer); });
        c.on('data', function (d) { h.mensaje(c.peer, d); });
        c.on('close', function () { if (conns[c.peer]) { delete conns[c.peer]; h.desconexion(c.peer); } });
        c.on('error', function () { /* el cierre se informa en 'close' */ });
      });
      p.on('error', function (e) { h.error(e.type); });
      // Si se pierde el servidor de señalización, las conexiones ya hechas siguen funcionando
      p.on('disconnected', function () { if (!p.destroyed) { try { p.reconnect(); } catch (err) { /* nada */ } } });
      return {
        enviar: function (cid, msg) { const c = conns[cid]; if (c && c.open) c.send(msg); },
        difundir: function (msg, excepto) { for (const k in conns) if (k !== excepto && conns[k].open) conns[k].send(msg); },
        cerrar: function () { try { p.destroy(); } catch (err) { /* nada */ } }
      };
    },

    cliente: function (id, h) {
      let c = null, abierta = false;
      const p = new window.Peer({ debug: 0, config: { iceServers: CR.iceServers } });
      p.on('open', function () {
        c = p.connect(id, { reliable: true, serialization: 'json' });
        c.on('open', function () { abierta = true; h.listo(); });
        c.on('data', function (d) { h.mensaje(d); });
        c.on('close', function () { if (abierta) { abierta = false; h.desconexion(); } });
        c.on('error', function () { /* se informa en 'close' */ });
      });
      p.on('error', function (e) { h.error(e.type); });
      return {
        enviar: function (msg) { if (c && abierta) c.send(msg); },
        cerrar: function () { abierta = false; try { p.destroy(); } catch (err) { /* nada */ } }
      };
    }
  };

  // ---------- Local (BroadcastChannel) ----------
  function idAzar() { return 'l' + Math.random().toString(36).slice(2, 10); }
  const local = {
    disponible: function () { return typeof BroadcastChannel === 'function'; },

    anfitrion: function (id, h) {
      const canal = new BroadcastChannel(id), clientes = {};
      canal.onmessage = function (ev) {
        const m = ev.data;
        if (!m || m.para) return;
        if (m.tipo === 'conectar') { clientes[m.de] = true; canal.postMessage({ para: m.de, tipo: 'aceptado' }); h.conexion(m.de); }
        else if (m.tipo === 'datos' && clientes[m.de]) h.mensaje(m.de, m.d);
        else if (m.tipo === 'cerrar' && clientes[m.de]) { delete clientes[m.de]; h.desconexion(m.de); }
      };
      setTimeout(function () { h.listo(); }, 30);
      return {
        enviar: function (cid, msg) { canal.postMessage({ para: cid, tipo: 'datos', d: msg }); },
        difundir: function (msg, excepto) { for (const k in clientes) if (k !== excepto) canal.postMessage({ para: k, tipo: 'datos', d: msg }); },
        cerrar: function () { for (const k in clientes) canal.postMessage({ para: k, tipo: 'cerrar' }); canal.close(); }
      };
    },

    cliente: function (id, h) {
      const canal = new BroadcastChannel(id), yo = idAzar();
      let abierta = false;
      canal.onmessage = function (ev) {
        const m = ev.data;
        if (!m || m.para !== yo) return;
        if (m.tipo === 'aceptado') { abierta = true; h.listo(); }
        else if (m.tipo === 'datos') h.mensaje(m.d);
        else if (m.tipo === 'cerrar') { abierta = false; h.desconexion(); }
      };
      canal.postMessage({ de: yo, tipo: 'conectar' });
      setTimeout(function () { if (!abierta) h.error('peer-unavailable'); }, 2500);
      return {
        enviar: function (msg) { if (abierta) canal.postMessage({ de: yo, tipo: 'datos', d: msg }); },
        cerrar: function () { if (abierta) canal.postMessage({ de: yo, tipo: 'cerrar' }); abierta = false; canal.close(); }
      };
    }
  };

  W.Transporte = { peer: peer, local: local };
})();

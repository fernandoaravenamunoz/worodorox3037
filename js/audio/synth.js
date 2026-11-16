// =====================================================
// Audio: música synthwave y efectos, todo generado con Web Audio API
// (sin archivos externos).
//
// Música: secuenciador de 16 pasos por compás con bajo, arpegio con eco,
// colchón (pad) y batería sintetizada. Cada zona tiene su propia pista.
// Uso:
//   W.Audio.iniciar()          (debe llamarse dentro de un clic/toque)
//   W.Audio.musica('z1')       ('titulo', 'z1'..'z4', 'sala', 'jefe', 'final', null)
//   W.Audio.sfx('puerta', vol)
//   W.Audio.alternar()         (silencio sí/no)
// =====================================================
(function () {
  'use strict';

  let ctx = null, maestro = null, busMusica = null, busSfx = null, eco = null, ruido = null;
  let activo = true;
  try { activo = localStorage.getItem('worodorox3073_sonido') !== 'no'; } catch (err) { /* nada */ }

  // Progresiones (grados en semitonos desde la tónica) y pistas
  const MENOR = { i: [0, 3, 7], VI: [8, 12, 15], III: [3, 7, 10], VII: [10, 14, 17], iv: [5, 8, 12], v: [7, 10, 14], bII: [1, 5, 8] };
  const MAYOR = { I: [0, 4, 7], V: [7, 11, 14], vi: [9, 12, 16], IV: [5, 9, 12] };
  const PISTAS = {
    titulo: { bpm: 88, raiz: 45, acordes: [MENOR.i, MENOR.VI, MENOR.III, MENOR.VII], bajo: 'lento', bombo: [0, 8], caja: [], hat: [], arp: 'lento', pad: 0.12 },
    z1: { bpm: 96, raiz: 45, acordes: [MENOR.i, MENOR.VI, MENOR.III, MENOR.VII], bajo: 'octavas', bombo: [0, 8, 10], caja: [4, 12], hat: [2, 6, 10, 14], arp: 'sube', pad: 0.08 },
    z2: { bpm: 112, raiz: 40, acordes: [MENOR.i, MENOR.i, MENOR.VII, MENOR.VI], bajo: 'galope', bombo: [0, 4, 8, 12], caja: [4, 12], hat: [2, 6, 10, 14, 15], arp: 'pulso', pad: 0.05 },
    z3: { bpm: 104, raiz: 42, acordes: [MENOR.i, MENOR.iv, MENOR.VI, MENOR.v], bajo: 'octavas', bombo: [0, 6, 8], caja: [4, 12], hat: [1, 3, 5, 7, 9, 11, 13, 15], arp: 'rapido', pad: 0.09 },
    z4: { bpm: 118, raiz: 38, acordes: [MENOR.i, MENOR.VI, MENOR.VII, MENOR.III], bajo: 'galope', bombo: [0, 4, 8, 12], caja: [4, 12], hat: [2, 6, 10, 14], arp: 'sube', pad: 0.08 },
    sala: { bpm: 124, raiz: 43, acordes: [MENOR.i, MENOR.VII, MENOR.VI, MENOR.VII], bajo: 'galope', bombo: [0, 4, 8, 12], caja: [4, 12], hat: [2, 6, 10, 14], arp: 'pulso', pad: 0.04 },
    jefe: { bpm: 132, raiz: 36, acordes: [MENOR.i, MENOR.bII, MENOR.i, MENOR.VII], bajo: 'galope', bombo: [0, 3, 4, 8, 11, 12], caja: [4, 12], hat: [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15], arp: 'rapido', pad: 0.07 },
    final: { bpm: 90, raiz: 48, acordes: [MAYOR.I, MAYOR.V, MAYOR.vi, MAYOR.IV], bajo: 'lento', bombo: [0, 8], caja: [12], hat: [4, 12], arp: 'lento', pad: 0.12 }
  };

  let pista = null, nombrePista = null, paso = 0, compas = 0, siguienteTiempo = 0, temporizador = null;

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function iniciar() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    maestro = ctx.createGain();
    maestro.gain.value = activo ? 0.8 : 0;
    maestro.connect(comp); comp.connect(ctx.destination);
    busMusica = ctx.createGain(); busMusica.gain.value = 0.45; busMusica.connect(maestro);
    busSfx = ctx.createGain(); busSfx.gain.value = 0.7; busSfx.connect(maestro);
    // Eco (delay con realimentación) típico del synthwave
    eco = ctx.createDelay(1.0);
    const fb = ctx.createGain(); fb.gain.value = 0.35;
    const filtroEco = ctx.createBiquadFilter(); filtroEco.type = 'lowpass'; filtroEco.frequency.value = 2400;
    eco.connect(filtroEco); filtroEco.connect(fb); fb.connect(eco);
    const salidaEco = ctx.createGain(); salidaEco.gain.value = 0.5;
    filtroEco.connect(salidaEco); salidaEco.connect(busMusica);
    // Búfer de ruido blanco (batería y efectos)
    ruido = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = ruido.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    temporizador = setInterval(programar, 25);
    if (nombrePista) musica(nombrePista, true);
  }

  // ---------- Instrumentos ----------
  function env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  function osc(tipo, f, t, dur, vol, destino, filtro) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo; o.frequency.setValueAtTime(f, t);
    let ult = o;
    if (filtro) {
      const fl = ctx.createBiquadFilter(); fl.type = 'lowpass';
      fl.frequency.setValueAtTime(filtro[0], t); fl.frequency.exponentialRampToValueAtTime(filtro[1], t + dur);
      fl.Q.value = 6; o.connect(fl); ult = fl;
    }
    ult.connect(g); g.connect(destino || busMusica);
    env(g, t, 0.005, vol, dur);
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  function golpeRuido(t, dur, vol, tipoFiltro, frec, destino) {
    const s = ctx.createBufferSource(); s.buffer = ruido;
    const f = ctx.createBiquadFilter(); f.type = tipoFiltro; f.frequency.value = frec;
    const g = ctx.createGain();
    s.connect(f); f.connect(g); g.connect(destino || busMusica);
    env(g, t, 0.002, vol, dur);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  function bombo(t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    o.connect(g); g.connect(busMusica);
    env(g, t, 0.002, 0.9, 0.22);
    o.start(t); o.stop(t + 0.3);
  }
  function caja(t) { golpeRuido(t, 0.16, 0.35, 'bandpass', 1800); osc('triangle', 190, t, 0.08, 0.2); }
  function hat(t) { golpeRuido(t, 0.04, 0.12, 'highpass', 7500); }
  function pad(acorde, raiz, t, dur, vol) {
    for (const n of acorde) {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.value = mtof(raiz + 24 + n); o.detune.value = det;
        f.type = 'lowpass'; f.frequency.value = 1100;
        o.connect(f); f.connect(g); g.connect(busMusica);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol / 3, t + dur * 0.3);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        o.start(t); o.stop(t + dur + 0.05);
      }
    }
  }

  // ---------- Secuenciador ----------
  function programar() {
    if (!ctx || !pista) return;
    const dur16 = 60 / pista.bpm / 4;
    while (siguienteTiempo < ctx.currentTime + 0.12) {
      tocarPaso(siguienteTiempo, dur16);
      siguienteTiempo += dur16;
      paso = (paso + 1) % 16;
      if (paso === 0) compas++;
    }
  }

  function tocarPaso(t, d16) {
    const p = pista;
    const acorde = p.acordes[compas % p.acordes.length];
    const r = p.raiz;
    if (paso === 0 && p.pad) pad(acorde, r, t, d16 * 16, p.pad);
    // Bajo
    let nb = null;
    if (p.bajo === 'octavas') nb = paso % 2 === 0 ? (paso % 4 === 2 ? 12 : 0) : null;
    else if (p.bajo === 'galope') nb = [0, null, 0, 0, 12, null, 0, 0, 0, null, 0, 0, 12, null, 7, 0][paso];
    else if (p.bajo === 'lento') nb = paso === 0 || paso === 8 ? 0 : null;
    if (nb !== null) osc('sawtooth', mtof(r + acorde[0] + nb), t, p.bajo === 'lento' ? d16 * 7 : d16 * 1.6, 0.32, busMusica, [1400, 180]);
    // Arpegio (con eco)
    let toca = false, nota = 0;
    if (p.arp === 'sube') { toca = paso % 2 === 0; nota = acorde[(paso / 2) % 3] + 24 + (paso >= 8 ? 12 : 0); }
    else if (p.arp === 'rapido') { toca = true; nota = acorde[paso % 3] + 24 + (Math.floor(paso / 3) % 2) * 12; }
    else if (p.arp === 'pulso') { toca = paso % 2 === 1; nota = acorde[0] + 24 + (paso % 4 === 3 ? 12 : 0); }
    else if (p.arp === 'lento') { toca = paso % 4 === 0; nota = acorde[(paso / 4) % 3] + 36; }
    if (toca) {
      const o = osc('square', mtof(r + nota), t, d16 * 0.9, 0.07, busMusica);
      const envio = ctx.createGain(); envio.gain.value = 0.6;
      o.connect(envio); envio.connect(eco);
      eco.delayTime.setValueAtTime(d16 * 3, t);
    }
    // Batería
    if (p.bombo.indexOf(paso) >= 0) bombo(t);
    if (p.caja.indexOf(paso) >= 0) caja(t);
    if (p.hat.indexOf(paso) >= 0) hat(t);
  }

  function musica(nombre, forzar) {
    if (nombre === nombrePista && !forzar) return;
    nombrePista = nombre;
    pista = nombre ? PISTAS[nombre] : null;
    if (!ctx) return;
    paso = 0; compas = 0;
    siguienteTiempo = ctx.currentTime + 0.1;
  }

  // ---------- Efectos de sonido ----------
  function barrido(tipo, f0, f1, dur, vol, t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    o.connect(g); g.connect(busSfx);
    env(g, t, 0.004, vol, dur);
    o.start(t); o.stop(t + dur + 0.05);
  }
  const SIMON = [330, 415, 494, 587];
  function sfx(nombre, vol) {
    if (!ctx || !activo) return;
    const v = vol === undefined ? 1 : vol;
    if (v <= 0.01) return;
    const t = ctx.currentTime;
    switch (nombre) {
      case 'acierto': [523, 659, 784, 1046].forEach(function (f, i) { osc('square', f, t + i * 0.07, 0.12, 0.12 * v, busSfx); }); break;
      case 'error': barrido('sawtooth', 220, 70, 0.35, 0.25 * v, t); break;
      case 'clic': osc('square', 1200, t, 0.03, 0.08 * v, busSfx); break;
      case 'simon0': case 'simon1': case 'simon2': case 'simon3': osc('triangle', SIMON[+nombre.slice(-1)], t, 0.3, 0.25 * v, busSfx); break;
      case 'dano': barrido('square', 300, 60, 0.25, 0.3 * v, t); golpeRuido(t, 0.15, 0.3 * v, 'lowpass', 900, busSfx); break;
      case 'golpe': golpeRuido(t, 0.12, 0.35 * v, 'bandpass', 600, busSfx); barrido('triangle', 160, 60, 0.1, 0.3 * v, t); break;
      case 'lanzar': barrido('triangle', 900, 300, 0.12, 0.15 * v, t); break;
      case 'aturdir': barrido('square', 1400, 200, 0.3, 0.15 * v, t); golpeRuido(t, 0.2, 0.2 * v, 'highpass', 3000, busSfx); break;
      case 'sellado': [784, 587, 392, 196].forEach(function (f, i) { osc('square', f, t + i * 0.06, 0.1, 0.12 * v, busSfx); }); break;
      case 'alarma': osc('square', 880, t, 0.12, 0.15 * v, busSfx); osc('square', 660, t + 0.14, 0.12, 0.15 * v, busSfx); break;
      case 'alerta': barrido('sawtooth', 200, 900, 0.2, 0.15 * v, t); break;
      case 'disparo': barrido('sawtooth', 1600, 120, 0.18, 0.18 * v, t); break;
      case 'bloqueo': osc('triangle', 1800, t, 0.25, 0.2 * v, busSfx); osc('triangle', 2400, t, 0.2, 0.1 * v, busSfx); break;
      case 'objeto': [660, 880, 1320].forEach(function (f, i) { osc('square', f, t + i * 0.05, 0.1, 0.12 * v, busSfx); }); break;
      case 'pista': osc('sine', 1046, t, 0.15, 0.15 * v, busSfx); osc('sine', 1568, t + 0.08, 0.2, 0.12 * v, busSfx); break;
      case 'puerta': golpeRuido(t, 0.5, 0.25 * v, 'lowpass', 500, busSfx); barrido('sawtooth', 80, 160, 0.45, 0.12 * v, t); break;
      case 'estacion': [392, 523, 659, 784, 1046].forEach(function (f, i) { osc('sine', f, t + i * 0.09, 0.3, 0.12 * v, busSfx); }); break;
      case 'salto': barrido('square', 260, 520, 0.12, 0.1 * v, t); break;
      case 'romper': golpeRuido(t, 0.25, 0.35 * v, 'lowpass', 1200, busSfx); break;
      case 'interruptor': osc('square', 600, t, 0.05, 0.12 * v, busSfx); osc('square', 900, t + 0.06, 0.06, 0.12 * v, busSfx); break;
      case 'zumbido': osc('sawtooth', 110, t, 0.5, 0.12 * v, busSfx); osc('sawtooth', 113, t, 0.5, 0.12 * v, busSfx); break;
      case 'siseo': golpeRuido(t, 0.8, 0.18 * v, 'highpass', 4000, busSfx); break;
      case 'hidraulica': barrido('sawtooth', 70, 140, 0.6, 0.15 * v, t); break;
      case 'golpeMetal': golpeRuido(t, 0.3, 0.45 * v, 'lowpass', 400, busSfx); osc('triangle', 90, t, 0.3, 0.3 * v, busSfx); break;
      case 'chispazo': golpeRuido(t, 0.2, 0.3 * v, 'highpass', 2500, busSfx); break;
      case 'muerte': barrido('sawtooth', 440, 40, 1.2, 0.3 * v, t); break;
      case 'nivel': [523, 659, 784, 1046, 1318].forEach(function (f, i) { osc('square', f, t + i * 0.1, 0.25, 0.1 * v, busSfx); }); break;
      case 'ia': barrido('square', 90, 60, 0.5, 0.2 * v, t); osc('sawtooth', 45, t, 0.6, 0.2 * v, busSfx); break;
    }
  }

  function alternar() {
    activo = !activo;
    try { localStorage.setItem('worodorox3073_sonido', activo ? 'si' : 'no'); } catch (err) { /* nada */ }
    if (maestro) maestro.gain.setTargetAtTime(activo ? 0.8 : 0, ctx.currentTime, 0.05);
    return activo;
  }

  W.Audio = {
    iniciar: iniciar,
    musica: musica,
    sfx: sfx,
    alternar: alternar,
    get activo() { return activo; }
  };
})();

// =====================================================
// Pistas: se generan con variación (semilla de la partida) y se dibujan
// igual en el holograma de la pared, en la libreta y dentro de los puzzles.
//
// Tipos de pista:
//   matriz  : matriz 3×3 tipo test de CI a la que le falta una figura
//   simon   : secuencia de colores numerada
//   codigo  : tabla de símbolos → dígitos (o ecuaciones en dificultad alta)
//   baldosa : qué símbolo del piso es seguro pisar
//
// Pistas compuestas (zonas 3 y 4): una pista de tipo 'codigo' o 'simon' puede
// repartirse en 2 hologramas (W.Pistas.parte). Cada parte se registra por
// separado en la libreta y la cerradura solo se puede deducir con ambas.
// =====================================================
(function () {
  'use strict';
  const F = W.fuente;

  // Colores de figuras (atributo "color" de la matriz) y de Simón
  const COLORES_FIG = ['#22e4ff', '#ff2bd6', '#e8b923'];
  const COLORES_SIMON = ['#22e4ff', '#ff2bd6', '#e8b923', '#4dff8a'];
  const NOMBRES_SIMON = ['CIAN', 'MAGENTA', 'AMARILLO', 'VERDE'];
  const NOMBRES_FIG = ['CUADRADO', 'CIRCULO', 'TRIANGULO'];

  // ---------- Bitmaps de figuras (9×9) ----------
  const FIG = [
    ['#########', '#.......#', '#.......#', '#.......#', '#.......#', '#.......#', '#.......#', '#.......#', '#########'],
    ['...###...', '.##...##.', '.#.....#.', '#.......#', '#.......#', '#.......#', '.#.....#.', '.##...##.', '...###...'],
    ['....#....', '....#....', '...#.#...', '...#.#...', '..#...#..', '..#...#..', '.#.....#.', '.#.....#.', '#########']
  ];
  // Figuras pequeñas (5×5) para cuando hay varias en una celda
  const FIG_CH = [
    ['#####', '#...#', '#...#', '#...#', '#####'],
    ['.###.', '#...#', '#...#', '#...#', '.###.'],
    ['..#..', '.#.#.', '.#.#.', '#...#', '#####']
  ];
  // ---------- Símbolos para cerraduras (7×7) ----------
  const SIMBOLOS = [
    ['...#...', '..#.#..', '.#...#.', '#.....#', '.#...#.', '..#.#..', '...#...'],   // rombo
    ['..###..', '..#.#..', '###.###', '#.....#', '###.###', '..#.#..', '..###..'],   // cruz
    ['....##.', '...##..', '..##...', '.#####.', '...##..', '..##...', '.##....'],   // rayo
    ['..###..', '.##....', '##.....', '##.....', '##.....', '.##....', '..###..'],   // luna
    ['.......', '..###..', '.#...#.', '#..#..#', '.#...#.', '..###..', '.......'],   // ojo
    ['...#...', '...#...', '#######', '.#####.', '..###..', '.##.##.', '.#...#.']    // estrella
  ];

  function bitmap(ctx, bm, x, y, esc, color) {
    ctx.fillStyle = color;
    for (let j = 0; j < bm.length; j++) for (let i = 0; i < bm[j].length; i++) {
      if (bm[j][i] === '#') ctx.fillRect(x + i * esc, y + j * esc, esc, esc);
    }
  }

  // Dibuja una figura (forma f, color c, cantidad n) centrada en (cx, cy) dentro de un tamaño "tam"
  function dibujarFigura(ctx, fig, cx, cy, tam) {
    const color = COLORES_FIG[fig.c] || '#ffffff';
    const n = fig.n || 1;
    if (n === 1) {
      const esc = Math.max(1, Math.floor(tam / 10));
      bitmap(ctx, FIG[fig.f], Math.round(cx - 4.5 * esc), Math.round(cy - 4.5 * esc), esc, color);
    } else {
      const esc = Math.max(1, Math.floor(tam / (6 * n)));
      const w = 5 * esc, sep = esc;
      const total = n * w + (n - 1) * sep;
      for (let k = 0; k < n; k++) {
        bitmap(ctx, FIG_CH[fig.f], Math.round(cx - total / 2 + k * (w + sep)), Math.round(cy - w / 2), esc, color);
      }
    }
  }
  function dibujarSimbolo(ctx, s, x, y, esc, color) { bitmap(ctx, SIMBOLOS[s], x, y, esc, color || '#7ff3ff'); }

  // ---------- Utilidades aleatorias ----------
  function entero(rnd, a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
  function barajar(rnd, arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  }
  function elegir(rnd, arr) { return arr[entero(rnd, 0, arr.length - 1)]; }
  // Cuadrado latino 3×3 aleatorio (cada fila y columna tiene 0, 1 y 2 una vez)
  function latino(rnd) {
    const base = barajar(rnd, [0, 1, 2]);
    const d = rnd() < 0.5 ? 1 : 2;
    const filas = barajar(rnd, [0, 1, 2]);
    return filas.map(function (r) { return [0, 1, 2].map(function (c) { return base[(c + r * d) % 3]; }); });
  }
  function igualFig(a, b) { return a.f === b.f && a.c === b.c && a.n === b.n; }

  // ---------- Reglas de la matriz ----------
  // Cada atributo (forma, color, cantidad) sigue una regla que se lee por filas:
  //   latino   : en cada fila y columna aparece cada valor una vez
  //   fila     : toda la fila tiene el mismo valor (cambia de fila en fila)
  //   columna  : cada columna tiene un valor fijo
  //   fijo     : el mismo valor en toda la matriz
  //   progresion (cantidad): 1, 2, 3 (o 3, 2, 1) de izquierda a derecha
  //   suma  (cantidad): columna 1 + columna 2 = columna 3
  //   resta (cantidad): columna 1 - columna 2 = columna 3
  function reglaAtributo(tipo, rnd, esCantidad) {
    const vals = esCantidad ? [1, 2, 3] : [0, 1, 2];
    const p = barajar(rnd, vals.slice());
    switch (tipo) {
      case 'latino': return latino(rnd).map(function (f) { return f.map(function (v) { return vals[v]; }); });
      case 'fila': return [0, 1, 2].map(function (r) { return [p[r], p[r], p[r]]; });
      case 'columna': return [0, 1, 2].map(function () { return p.slice(); });
      case 'fijo': { const v = esCantidad ? 1 : p[0]; return [0, 1, 2].map(function () { return [v, v, v]; }); }
      case 'progresion': { const s = rnd() < 0.5 ? [1, 2, 3] : [3, 2, 1]; return [0, 1, 2].map(function () { return s.slice(); }); }
      case 'suma': return barajar(rnd, [[1, 1, 2], [1, 2, 3], [2, 1, 3]]);
      case 'resta': return barajar(rnd, [[2, 1, 1], [3, 1, 2], [3, 2, 1]]);
    }
    throw new Error('Regla desconocida: ' + tipo);
  }

  // Reglas disponibles por dificultad (forma, color, cantidad)
  const REGLAS_MATRIZ = {
    1: { f: ['latino'], c: ['fijo'], n: ['fijo'] },
    2: { f: ['latino'], c: ['latino', 'columna', 'fila'], n: ['fijo', 'progresion'] },
    3: { f: ['latino', 'fila'], c: ['latino', 'columna'], n: ['suma', 'resta'] }
  };

  // ===================== GENERADORES =====================
  const GEN = {};

  // Matriz 3×3: con la dificultad aparecen reglas nuevas, no solo más atributos
  GEN.matriz = function (rnd, dif) {
    const R = REGLAS_MATRIZ[Math.min(3, dif)] || REGLAS_MATRIZ[1];
    const reglas = { f: elegir(rnd, R.f), c: elegir(rnd, R.c), n: elegir(rnd, R.n) };
    // Forma y color no pueden tener ambas "fila": la fila entera sería idéntica
    if (reglas.f === 'fila' && reglas.c === 'fila') reglas.c = 'latino';
    const g = {
      f: reglaAtributo(reglas.f, rnd, false),
      c: reglaAtributo(reglas.c, rnd, false),
      n: reglaAtributo(reglas.n, rnd, true)
    };
    const celdas = [];
    for (let r = 0; r < 3; r++) {
      celdas.push([]);
      for (let c = 0; c < 3; c++) celdas[r].push({ f: g.f[r][c], c: g.c[r][c], n: g.n[r][c] });
    }
    const falta = { r: entero(rnd, 0, 2), c: entero(rnd, 0, 2) };
    if (dif === 1) { falta.r = 2; falta.c = 2; }
    const correcta = celdas[falta.r][falta.c];
    // Opciones: la correcta + distractores que cambian uno o dos atributos.
    // Se prefiere cambiar los atributos que sí tienen regla (los fijos se descartan solos).
    const varian = ['f', 'c', 'n'].filter(function (a) { return reglas[a] !== 'fijo'; });
    const opciones = [correcta];
    let intentos = 0;
    while (opciones.length < 6 && intentos++ < 300) {
      const o = { f: correcta.f, c: correcta.c, n: correcta.n };
      const cuantos = dif >= 3 ? entero(rnd, 1, 2) : 1;
      const cambiar = barajar(rnd, (intentos > 150 ? ['f', 'c', 'n'] : varian).slice()).slice(0, cuantos);
      cambiar.forEach(function (a) {
        if (a === 'n') o.n = 1 + (o.n - 1 + entero(rnd, 1, 2)) % 3;
        else o[a] = (o[a] + entero(rnd, 1, 2)) % 3;
      });
      if (!opciones.some(function (x) { return igualFig(x, o); })) opciones.push(o);
    }
    barajar(rnd, opciones);
    return {
      tipo: 'matriz', titulo: 'MATRIZ HOLOGRAFICA',
      celdas: celdas, falta: falta, opciones: opciones, reglas: reglas,
      correcta: opciones.findIndex(function (x) { return igualFig(x, correcta); })
    };
  };

  // Secuencia de colores para Simón (puerta sin reproducción: se ingresa de memoria/libreta)
  GEN.simon = function (rnd, dif) {
    const largo = [0, 4, 5, 6][dif] || 4;
    const sec = [];
    for (let i = 0; i < largo; i++) {
      let c;
      do { c = entero(rnd, 0, 3); } while (i > 0 && c === sec[i - 1]);
      sec.push(c);
    }
    return { tipo: 'simon', titulo: 'SECUENCIA DE ENERGIA', secuencia: sec };
  };

  // Código: tabla directa (dif 1) o cadena de ecuaciones (dif 2 y 3)
  GEN.codigo = function (rnd, dif) {
    const n = dif >= 3 ? 4 : 3;
    const simbolos = barajar(rnd, [0, 1, 2, 3, 4, 5]).slice(0, n);
    const digitos = [], lineas = [];
    if (dif === 1) {
      for (let i = 0; i < n; i++) {
        digitos.push(entero(rnd, 1, 9));
        lineas.push({ s: simbolos[i], texto: '=' + digitos[i] });
      }
    } else {
      digitos.push(entero(rnd, 1, 4));
      lineas.push({ s: simbolos[0], texto: '=' + digitos[0] });
      for (let i = 1; i < n; i++) {
        const prev = digitos[i - 1];
        const ops = [];
        // Los dígitos van de 1 a 9: así nunca coinciden con la posición inicial (0) de las ruedas
        for (let k = 1; k <= 4; k++) { if (prev + k <= 9) ops.push(['+' + k, prev + k]); if (prev - k >= 1) ops.push(['-' + k, prev - k]); }
        if (prev * 2 <= 9) ops.push(['X2', prev * 2]);
        if (prev * 3 <= 9 && dif >= 3) ops.push(['X3', prev * 3]);
        const op = ops[entero(rnd, 0, ops.length - 1)];
        digitos.push(op[1]);
        lineas.push({ s: simbolos[i], ref: simbolos[i - 1], texto: op[0] });
      }
    }
    // En la puerta los símbolos aparecen en otro orden
    const orden = barajar(rnd, simbolos.map(function (_, i) { return i; }));
    return {
      tipo: 'codigo', titulo: dif === 1 ? 'TABLA DE CLAVES' : 'ECUACIONES DE CLAVE',
      simbolos: simbolos, digitos: digitos, lineas: lineas,
      ordenPuerta: orden.map(function (i) { return simbolos[i]; }),
      codigo: orden.map(function (i) { return digitos[i]; })
    };
  };

  // Baldosa segura
  GEN.baldosa = function (rnd) {
    const s = entero(rnd, 0, 2);
    return { tipo: 'baldosa', titulo: 'PROTOCOLO DE PISO', seguro: s };
  };

  // def: { tipo, dificultad }  rnd: función aleatoria con semilla
  function generar(def, rnd) {
    const g = GEN[def.tipo];
    if (!g) throw new Error('Tipo de pista desconocido: ' + def.tipo);
    const d = g(rnd, def.dificultad || 1);
    d.dificultad = def.dificultad || 1;
    return d;
  }

  // ===================== PISTAS COMPUESTAS =====================
  const DIVISIBLES = ['codigo', 'simon'];
  function divisible(tipo) { return DIVISIBLES.indexOf(tipo) >= 0; }

  // Parte j (1..n) de una pista completa. La parte conserva tipo y dificultad,
  // así se dibuja con las mismas funciones (holograma, libreta, cerradura).
  function parte(d, j, n) {
    if (!divisible(d.tipo)) throw new Error('La pista ' + d.tipo + ' no se puede dividir en partes');
    // Título corto (la libreta muestra 22 caracteres): 'ECUACIONES 1/2', 'SECUENCIA 2/2'
    const p = { tipo: d.tipo, dificultad: d.dificultad, parte: j, partes: n, titulo: d.titulo.split(' ')[0] + ' ' + j + '/' + n };
    const lista = d.tipo === 'codigo' ? d.lineas : d.secuencia;
    const tam = Math.ceil(lista.length / n);
    const desde = (j - 1) * tam;
    if (d.tipo === 'codigo') p.lineas = lista.slice(desde, desde + tam);
    else { p.secuencia = lista.slice(desde, desde + tam); p.desde = desde; }
    if (d.id) p.id = d.id + '#' + j;
    return p;
  }

  // ===================== DIBUJO =====================
  // Dibuja la pista dentro del rectángulo (x, y, w, h).
  function dibujar(ctx, d, x, y, w, h) {
    if (d.tipo === 'matriz') {
      const tam = Math.floor(Math.min(w, h) / 3);
      const ox = x + Math.floor((w - tam * 3) / 2), oy = y + Math.floor((h - tam * 3) / 2);
      ctx.fillStyle = '#0f5a6b';
      for (let k = 1; k < 3; k++) {
        ctx.fillRect(ox + k * tam, oy + 1, 1, tam * 3 - 2);
        ctx.fillRect(ox + 1, oy + k * tam, tam * 3 - 2, 1);
      }
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        const cx = ox + c * tam + tam / 2, cy = oy + r * tam + tam / 2;
        if (r === d.falta.r && c === d.falta.c) {
          const esc = Math.max(1, Math.floor(tam / 9));
          F.dibujarCrudo(ctx, '?', Math.round(cx - 1.5 * esc), Math.round(cy - 2.5 * esc), '#ff2bd6', esc);
        } else dibujarFigura(ctx, d.celdas[r][c], cx, cy, tam - 2);
      }
    } else if (d.tipo === 'simon') {
      const n = d.secuencia.length;
      const porFila = n > 3 ? Math.ceil(n / 2) : n;
      const filas = Math.ceil(n / porFila);
      const tam = Math.floor(Math.min(w / porFila, h / filas));
      const esc = Math.max(1, Math.floor(tam / 14));
      const desde = d.desde || 0;
      for (let i = 0; i < n; i++) {
        const fx = i % porFila, fy = Math.floor(i / porFila);
        const bx = x + Math.floor((w - porFila * tam) / 2) + fx * tam;
        const by = y + Math.floor((h - filas * tam) / 2) + fy * tam;
        ctx.fillStyle = COLORES_SIMON[d.secuencia[i]];
        ctx.fillRect(bx + 2, by + 7 * esc, tam - 4, tam - 7 * esc - 2);
        F.dibujarCrudo(ctx, String(desde + i + 1), bx + Math.floor(tam / 2) - esc, by + esc, '#c8fbff', esc);
      }
    } else if (d.tipo === 'codigo') {
      const n = d.lineas.length;
      const alto = Math.floor(h / Math.max(n, 2));
      const esc = Math.max(1, Math.floor(Math.min(alto / 9, w / 34)));
      for (let i = 0; i < n; i++) {
        const l = d.lineas[i];
        let px = x + 2;
        const py = y + i * alto + Math.floor((alto - 7 * esc) / 2);
        dibujarSimbolo(ctx, l.s, px, py, esc, '#7ff3ff');
        px += 9 * esc;
        if (l.ref !== undefined) {
          F.dibujarCrudo(ctx, '=', px, py + esc, '#c8fbff', esc); px += 5 * esc;
          dibujarSimbolo(ctx, l.ref, px, py, esc, '#ff2bd6'); px += 9 * esc;
          F.dibujarCrudo(ctx, l.texto, px, py + esc, '#c8fbff', esc);
        } else {
          F.dibujarCrudo(ctx, l.texto, px, py + esc, '#c8fbff', esc);
        }
      }
    } else if (d.tipo === 'baldosa') {
      const esc = Math.max(1, Math.floor(Math.min(w, h) / 30));
      F.dibujarCrudo(ctx, 'PISA SOLO', x + Math.floor(w / 2 - F.ancho('PISA SOLO', esc) / 2), y + 2 * esc, '#c8fbff', esc);
      const tam = Math.min(w, h) * 0.55;
      dibujarFigura(ctx, { f: d.seguro, c: 0, n: 1 }, x + w / 2, y + h * 0.6, tam);
    }
  }

  // Textura de holograma para una pista
  function textura(zona, d) {
    return W.texturas.hologramaDesde(zona, function (ctx, w, h) { dibujar(ctx, d, 2, 2, w - 4, h - 4); });
  }

  // Descripción corta para la libreta
  function resumen(d) {
    const sufijo = d.partes ? ' (PARTE ' + d.parte + ')' : '';
    if (d.tipo === 'matriz') return 'CADA FILA SIGUE UNA REGLA';
    if (d.tipo === 'simon') return 'ORDEN' + sufijo + ': ' + d.secuencia.map(function (c) { return NOMBRES_SIMON[c][0]; }).join(' ');
    if (d.tipo === 'codigo') return d.partes ? 'MITAD ' + d.parte + ' DE LA CADENA' : d.dificultad === 1 ? 'SIMBOLO = DIGITO' : 'RESUELVE LA CADENA';
    if (d.tipo === 'baldosa') return 'SEGURO: ' + NOMBRES_FIG[d.seguro];
    return '';
  }

  W.Pistas = {
    generar: generar,
    parte: parte,
    divisible: divisible,
    dibujar: dibujar,
    textura: textura,
    resumen: resumen,
    dibujarFigura: dibujarFigura,
    dibujarSimbolo: dibujarSimbolo,
    bitmap: bitmap,
    COLORES_FIG: COLORES_FIG,
    COLORES_SIMON: COLORES_SIMON,
    NOMBRES_SIMON: NOMBRES_SIMON,
    NOMBRES_FIG: NOMBRES_FIG,
    REGLAS_MATRIZ: REGLAS_MATRIZ,
    util: { entero: entero, barajar: barajar, latino: latino, igualFig: igualFig }
  };
})();

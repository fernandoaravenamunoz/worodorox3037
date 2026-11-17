// =====================================================
// WORODOROX 3073 - Configuración general
// Todas las constantes del juego en un solo lugar.
// =====================================================
window.W = window.W || {};

W.config = {
  // Resolución interna (se escala a la ventana)
  ANCHO: 320,
  ALTO: 180,

  // Cámara: PLANO define el campo de visión (0,72 ≈ 72°)
  PLANO: 0.72,

  // Tamaño de las texturas de pared (64×64) y de los sprites (32×32)
  TEX: 64,
  SPR: 32,

  // Distancia (en casillas) a la que todo se pierde en la oscuridad
  NIEBLA_DIST: 9,

  // Movimiento del jugador en el laberinto (casillas por segundo)
  VEL_CAMINAR: 2.6,
  VEL_CORRER: 4.0,
  VEL_GIRO_TECLADO: 2.6,   // radianes por segundo (flechas)

  // Sensibilidad de la mirada
  SENS_MOUSE: 0.0025,      // radianes por píxel
  SENS_TACTIL: 0.006,
  SENS_PITCH: 0.35,        // píxeles de inclinación por píxel de mouse
  PITCH_MAX: 45,

  // Colisiones e interacción
  RADIO_JUGADOR: 0.22,
  DIST_INTERACCION: 1.6,
  // Tolerancia de puntería: en táctil se interactúa con lo que está "más o menos" al frente
  ANGULO_APUNTAR: 0.30,          // radianes (PC)
  ANGULO_APUNTAR_TACTIL: 0.55,   // radianes (táctil)

  // Vida y daño
  VIDA_BASE: 10,
  DANIO_PUERTA_MAGENTA: 4,  // fallar una puerta magenta
  DANIO_SELLADO: 2,         // fallar el puzzle para sellar un enemigo
  INVULNERABLE: 1.0,        // segundos de invulnerabilidad tras recibir daño

  // Puzzles
  TIEMPO_PUERTA: [60, 75, 90],   // segundos según dificultad 1, 2, 3 (puertas)
  BLOQUEO_ERROR: 6,              // segundos que una puerta normal queda bloqueada tras un error
                                 // (el reloj sigue corriendo: adivinar cuesta tiempo)
  // Segundos base para sellar un enemigo, según el puzzle que toque.
  // Se suman BONO_ATURDIDO y el bono del personaje (Varilla).
  // En Simón el reloj se detiene mientras se muestra la secuencia.
  TIEMPO_SELLADO: 14,            // valor general (otros usos)
  TIEMPO_SELLADO_TIPO: { serie: 12, asociacion: 14, matriz: 16, simon: 10 },
  TIEMPO_SELLADO_EXTRA_DIF: 3,   // segundos extra por cada nivel de dificultad sobre 1
  BONO_ATURDIDO: 8,              // segundos extra si el enemigo está aturdido

  // Puertas de doble palanca: segundos que una palanca queda activa después de tirarla.
  // Con compañeros en la partida la ventana es corta (hay que tirarlas a la vez);
  // jugando solo hay tiempo para correr de una palanca a la otra.
  VENTANA_PALANCA: 1.2,
  VENTANA_PALANCA_SOLO: 8,

  // Salas 2D (en píxeles internos)
  T2D: 10,                // tamaño de cada baldosa
  GRAVEDAD: 820,
  VEL_2D: 78,
  SALTO_2D: 245,
  COYOTE: 0.10,           // margen para saltar después de dejar el borde
  BUFFER_SALTO: 0.13,     // margen para presionar salto antes de tocar el suelo

  // Interfaz
  HUD_ALTO: 14,

  // Clave de guardado en localStorage
  CLAVE_GUARDADO: 'worodorox3073_partida'
};

// Tiempo para sellar con un puzzle dado (sin bonos)
W.config.tiempoSellado = function (tipo, dif) {
  const C = W.config;
  const base = C.TIEMPO_SELLADO_TIPO[tipo] || C.TIEMPO_SELLADO;
  return base + Math.max(0, (dif || 1) - 1) * C.TIEMPO_SELLADO_EXTRA_DIF;
};

// Proyección: escala vertical de las paredes según el campo de visión
W.config.PROYECCION = W.config.ANCHO / (2 * W.config.PLANO);

// Paleta con significado (ver documento de diseño)
W.paleta = {
  fondo: '#07060d',
  cian: '#22e4ff', cianOsc: '#0f5a6b', cianClaro: '#c8fbff',   // información, ayuda
  magenta: '#ff2bd6', magentaOsc: '#7a1466', magentaClaro: '#ffd0f5', // peligro, cerraduras
  rojo: '#ff3b3b', rojoOsc: '#6b1010',                         // enemigos, alarmas
  amarillo: '#e8b923', amarilloClaro: '#ffd34a',               // puertas a salas 2D
  verde: '#4dff8a',                                            // éxito, salida
  metal1: '#16151f', metal2: '#2a2a3c', metal3: '#3a3a52',      // estructura
  remache: '#7a828d', morado: '#120f1f', blanco: '#e6e3ff', gris: '#8d93ad', grisOsc: '#4a4f63'
};

// ---------- Códigos internos de casilla (Uint8 en el mapa) ----------
W.CELDA = {
  VACIO: 0,
  PANEL: 1,
  NEON: 2,
  TUBOS: 3,
  HOLOGRAMA: 4,     // pista en la pared (textura propia por casilla)
  PUERTA: 5,        // puerta con puzzle normal (si fallas, se bloquea unos segundos y se reinicia)
  DECOR: 6,         // decoración de la zona (cápsula, maquinaria, servidor, ventanal)
  DUCTO: 7,         // marco amarillo: entrada a sala 2D
  ESTACION: 8,      // estación de respaldo (punto de control)
  PUERTA_MAGENTA: 9,// puerta con riesgo (fallar cuesta vida)
  PUERTA_TARJETA: 10,// necesita un objeto obtenido en una sala 2D
  SALIDA: 11,       // compuerta de salida del nivel
  APLASTADOR: 12,   // compuerta que aplasta (trampa, alterna sólida/vacía)
  NUCLEO: 13,       // núcleo de la IA (jefe final)
  PALANCA: 14,      // palanca en la pared (abre la puerta de doble palanca más cercana)
  PUERTA_PALANCA: 15// puerta que se abre con todas sus palancas activas a la vez
};

// Caracteres de los mapas de nivel → código de casilla.
// Los dígitos (puertas) y las letras de W.HOLOGRAMAS se definen en la "leyenda" de cada nivel.
// Una puerta de doble palanca es un dígito con { palancas: true } en la leyenda.
W.CARACTERES = {
  '.': 0, ' ': 0,
  '#': 1, 'N': 2, 'T': 3, 'C': 6,
  'Y': 7, 'S': 8, 'X': 11, 'B': 13, 'P': 14
};

// Letras que representan hologramas con pista (se definen en la leyenda del nivel)
W.HOLOGRAMAS = 'abcfijmn';

// Caracteres que representan algo SOBRE el piso (la casilla queda vacía)
//  d dron horizontal | D dron vertical | p perseguidor | u guardián
//  e piso eléctrico | l láser | k aplastador | g gas
//  < > ^ v descompresión (empuja en esa dirección)
//  Q O A baldosas con símbolo (cuadrado, círculo, triángulo)
//  h botiquín | @ inicio del jugador
W.ENTIDADES_MAPA = 'dDpuelkg<>^vQOAh@';

// Textos de interacción por tipo de casilla
W.TIPOS = {
  1: { nombre: 'PANEL' },
  2: { nombre: 'PANEL NEON' },
  3: { nombre: 'TUBERIAS' },
  4: { nombre: 'HOLOGRAMA', aviso: 'EXAMINAR HOLOGRAMA' },
  5: { nombre: 'PUERTA', aviso: 'PUERTA CON CERRADURA' },
  6: { nombre: 'DECORADO' },
  7: { nombre: 'DUCTO', aviso: 'ENTRAR AL DUCTO' },
  8: { nombre: 'ESTACION', aviso: 'ACTIVAR ESTACION DE RESPALDO' },
  9: { nombre: 'PUERTA MAGENTA', aviso: 'CERRADURA DE RIESGO' },
  10: { nombre: 'PUERTA DE TARJETA', aviso: 'LECTOR DE TARJETA' },
  11: { nombre: 'SALIDA', aviso: 'COMPUERTA DE SALIDA' },
  12: { nombre: 'APLASTADOR' },
  13: { nombre: 'NUCLEO', aviso: 'NUCLEO DE LA IA' },
  14: { nombre: 'PALANCA', aviso: 'TIRAR DE LA PALANCA' },
  15: { nombre: 'PUERTA DE DOBLE PALANCA', aviso: 'PUERTA DE DOBLE PALANCA' }
};

// Nombres de las zonas (1 a 4)
W.ZONAS = ['', 'CRIOGENIA', 'INDUSTRIAL', 'NUCLEO DE LA IA', 'HANGAR'];

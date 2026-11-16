# Worodorox 3073 — Fases 1 a 9 + 10a (cooperativo en red)

Laberinto en primera persona con puzzles, salas de plataforma 2D, enemigos que se sellan con puzzles,
12 niveles en 4 zonas, jefe final, música synthwave generada por código y versión táctil lista para Android.
JavaScript puro, sin dependencias, sin imágenes ni audios externos.

## Jugar en línea
**[https://fernandoaravenamunoz.github.io/worodorox3073/](https://fernandoaravenamunoz.github.io/worodorox3073/)**

Funciona en el PC y en el navegador del celular (en horizontal), sin instalar nada.

## Cómo ejecutarlo
Abre `index.html` en Chrome, Edge o Firefox. No necesita instalar nada.
Si el navegador bloquea algo al abrirlo como archivo, usa un servidor local dentro de la carpeta:
`python -m http.server` y entra a `http://localhost:8000`.

## Controles
| Acción | PC | Táctil |
|---|---|---|
| Moverse (laberinto) | WASD | Joystick (mitad izquierda) |
| Mirar | Mouse (clic para capturarlo; Esc lo suelta y pausa) | Deslizar en la mitad derecha |
| Usar / atacar / sellar | Clic o F | Botón USAR |
| Mapa automático | Q | Botón MAPA |
| Libreta de pistas | E | Botón LIBRETA |
| Correr | Shift | — |
| Moverse (sala 2D) | A / D o flechas | Flechas ◀ ▶ |
| Saltar (sala 2D) | W, espacio o flecha arriba (mantener = salto más alto) | Botón SALTO |
| Puzzles | Mouse o teclas 1-9, flechas, Enter | Toque directo |
| Pausa | Esc | Botón II |
| Sonido sí/no · FPS | M · P | (en el menú de pausa) |

## Cómo se juega
- **Pistas**: los hologramas cian de las paredes son protocolos de la tripulación. Al acercarte quedan
  registrados en la **libreta** (E). Una pista vista en un lugar se usa en otro: en una puerta, en el piso
  o en el terminal de una sala 2D. Los datos de cada pista cambian en cada partida.
- **Pistas compuestas** (zonas 3 y 4): algunas pistas vienen partidas en **dos hologramas** lejanos entre sí
  (por ejemplo, la primera mitad de una cadena de ecuaciones o de una secuencia de colores).
  La libreta guarda cada parte por separado y la cerradura solo se puede deducir con las dos.
- **Puertas**: cian = si fallas, la cerradura **se bloquea 6 segundos** y el reloj sigue corriendo
  (adivinar sale caro); luego el puzzle se reinicia. **Magenta** = fallar cuesta 4 de vida.
  Blanca = necesita un objeto que se obtiene en una sala 2D.
- **Salas 2D**: se entra por los marcos amarillos. Al superarlas el ducto queda abierto y te llevas su objeto.
- **Enemigos**: el arma los **aturde**; aturdidos, se **sellan** con un puzzle rápido (USAR otra vez).
  El tiempo depende del puzzle que toque (una serie se lee rápido; una matriz necesita más) y de la zona.
  En Simón el reloj se detiene mientras la máquina muestra la secuencia.
  Dron (cono rojo), perseguidor y guardián (bloquea el pasillo).
- **Trampas**: piso eléctrico, láser, aplastador, gas y descompresión siempre avisan antes
  (chispas, rayos tenues, franjas rojas, burbujas, flechas). Las baldosas con símbolos se cruzan
  pisando solo el que indica una pista.
- **Estaciones de respaldo**: guardan la partida (localStorage) y recargan la vida. Al morir conservas
  puertas abiertas, salas superadas, enemigos sellados y pistas; pierdes los objetos tomados desde la
  última estación (si pierdes una tarjeta, el ducto vuelve a abrirse para recuperarla).

## Las zonas y sus planos
| Zona | Niveles | Plano |
|---|---|---|
| 1. Criogenia | 1 a 3 | Pabellones de cápsulas unidos por pasillos (el 3 es el espejo del 2, con piso de baldosas) |
| 2. Industrial | 4 a 6 | Anillo con bóveda central (4), anillo doble con pasillo central (5), galerías en zigzag (6) |
| 3. Núcleo de la IA | 7 a 9 | Laberintos de verdad, generados por código, con salas de servidores |
| 4. Hangar | 10 a 12 | Gran hangar con pilares y bahías de lanzamiento (11: espejo con entrada por el ala oeste; 12: invertido) |

## Personajes
| Personaje | Arma | Ventaja en el juego |
|---|---|---|
| Chispa | Resortera (a distancia) | Lee hologramas desde lejos; sus piedras activan interruptores lejanos en 2D |
| Tuerca | Fierro | Aturde 9 s; rompe rejillas reforzadas en 2D |
| Doña Lata | Sartén | 12 de vida; bloquea los disparos de drones si los mira de frente |
| Flaco Neón | Tenedores | 20 % más rápido; salta más alto en 2D |
| Varilla | Palo (alcance medio) | +8 s en los puzzles de sellado |

## Estructura
```
index.html, css/estilo.css
js/config.js               constantes, paleta, códigos de casilla, caracteres de los mapas
js/fuente.js               fuente de píxeles 3×5 (HUD, hologramas, libreta)
js/input.js                teclado, mouse y táctil; modos 3d / 2d / ui
js/main.js                 bucle y máquina de estados (título, juego, puzzle, sala 2D, muerte...)
js/motor3d/                raycaster (paredes, piso por casilla, sprites, cono del dron), mapa, texturas por zona
js/motor2d/plataformas.js  salas 2D: plataformas, cajas, placas, interruptores, terminal, persecución
js/puzzles/                pistas.js + base.js (interfaz común) + 7 puzzles
js/entidades/              personajes y armas, jugador, enemigos, trampas
js/juego/                  partida (guardado), nivel (lógica del laberinto), jefe (IA)
js/ui/                     HUD, mapa automático, libreta, menús
js/audio/synth.js          música synthwave y efectos con Web Audio API
js/niveles/nivel01..12.js  los niveles, solo datos
scripts/validar-niveles.js comprueba que cada nivel se pueda terminar
scripts/probar-puzzles.js  genera miles de puzzles y comprueba que sean justos y resolubles
scripts/preparar-www.js    copia el juego a www/ para Capacitor
```
Se usan scripts clásicos (sin módulos ES) para que funcione abriendo el archivo directamente. Todo cuelga del objeto global `W`.

## Puzzles (interfaz común)
| Puzzle | Dificultad 1 | Dificultad 2 | Dificultad 3 |
|---|---|---|---|
| `serie` | +d, ×2, ×3 | alternada, diferencias crecientes, cuadrados | Fibonacci, ×2+1, cubos, ×2/+s, diferencias que se duplican, primos |
| `matriz` | forma (cuadrado latino) | + color (latino, fila o columna) y cantidad (fija o 1-2-3) | forma por fila o latina; cantidad que **suma o resta** (col. 1 ± col. 2 = col. 3) |
| `asociacion` | intruso fácil; máquina de funciones (+k, ×2, ×k) | intruso con distractores; analogía de figuras; funciones 2x+k, x·k−1, x² | intruso entre 5; analogía de 2 cambios; funciones x²+1, x²−x, 3x−k |
| `luces` | 3×3 | 4×4 | 4×4 con más luces (el 5×5 queda solo para el jefe) |
| `simon` | 3 → 4 colores | 4 → 5 | 5 → 6 |
| `codigo` | tabla símbolo = dígito | cadena de 3 ecuaciones | cadena de 4 ecuaciones (×3 incluido) |
| `deslizante` | 18 movimientos de desorden | 32 | 56 |

La **máquina de funciones** muestra una tabla ENTRA → SALE con 2 ejemplos (reglas lineales) o 3 (cuadráticas).
El generador comprueba que todas las reglas sencillas que calzan con la tabla den el mismo resultado,
así ninguna respuesta bien razonada queda marcada como error.

Todos usan la misma interfaz, así puertas, enemigos, terminales 2D y el jefe reutilizan los mismos módulos:
```js
const p = W.Puzzles.crear('luces', { dificultad: 2, tiempo: 60, alFallar: 'reiniciar' });
p.actualizar(dt, { clics: [{x, y}], teclas: ['Digit1'] });
p.dibujar(ctx);
if (p.terminado) console.log(p.resultado);   // 'exito' | 'fallo' | 'cancelado'
```
Para crear uno nuevo: copia un archivo de `js/puzzles/`, define `generar`, `alClic` y `dibujarContenido`,
llama a `this.acertar()` o `this.fallar()` y regístralo con `W.Puzzles.registrar('nombre', Clase)`.
Si el reloj no debe correr en algún momento (como en Simón), define `relojPausado()`.

Para comprobar los generadores después de cambiarlos:
```
node scripts/probar-puzzles.js
```

## Crear o editar niveles
Cada nivel es un objeto de datos en `js/niveles/nivelXX.js` (la leyenda completa está al inicio de `nivel01.js`):
- `mapa`: filas de texto. Dígitos = puertas, letras `a b c f i j m n` = hologramas, `@` = inicio.
- `leyenda`: qué es cada puerta (`puzzle`, `dificultad`, `pista`, `riesgo`, `objeto`) y cada holograma (`pista`, y `parte` si es compuesta).
- `pistas`: `{ tipo: 'matriz' | 'simon' | 'codigo' | 'baldosa', dificultad }`.
  Para una pista compuesta agrega `partes: 2` (solo `codigo` y `simon`) y pon dos hologramas:
  `b: { pista: 'p2', parte: 1 }` y `f: { pista: 'p2', parte: 2 }`.
- `sala`: la sala 2D del ducto (`mapa`, `objeto`, `terminal: { pista }`, `persecucion`).
- `jefe` (nivel 12): qué pistas usa la IA.

Después de editar, comprueba que el nivel se pueda terminar:
```
node scripts/validar-niveles.js        (todos)
node scripts/validar-niveles.js 3 -v   (nivel 3, con el recorrido y el mapa alcanzable)
```
El validador también avisa si una puerta se puede rodear por otro camino, si las dos partes de una
pista quedaron muy juntas y si dos niveles tienen casi el mismo plano.

## Probar desde la consola del navegador (F12)
```js
W.juego.irANivel(7, 'tuerca')    // salta a un nivel con un personaje
W.juego.probarPuzzle('codigo', 3) // abre cualquier puzzle
W.juego.entrarSala()             // entra a la sala 2D del nivel actual
```

## Empaquetar el APK (Android) con Capacitor
Requisitos: Node.js 22 o superior y Android Studio (trae el SDK y el JDK).
1. En la carpeta del juego: `npm install`
2. Crear el proyecto Android (solo la primera vez): `npm run android:agregar`
3. Fijar la orientación horizontal: en `android/app/src/main/AndroidManifest.xml`, dentro de la etiqueta
   `<activity ...>`, agrega `android:screenOrientation="sensorLandscape"`.
4. Cada vez que cambies el juego: `npm run android:sync`
5. Abrir en Android Studio: `npm run android:abrir` → menú **Build > Build App Bundle(s) / APK(s) > Build APK(s)**.
   Para instalarlo directo en un teléfono conectado por USB (con depuración USB activada): botón ▶ Run.

El juego detecta solo la pantalla táctil, muestra los controles según el modo y pide pantalla completa al primer toque.

## Multijugador cooperativo (fase 10a)
En el título: **MULTIJUGADOR** → elige personaje → **CREAR PARTIDA** o **UNIRSE CON UN CODIGO**.
- Quien crea la partida es el **anfitrión**: recibe un código de 5 números, elige el nivel inicial y presiona INICIAR.
- Los demás (hasta 4 jugadores en total, PC o celular) escriben ese código.
- Puertas abiertas, enemigos aturdidos o sellados, botiquines y salas 2D son **compartidos**.
  El objeto de una sala 2D sirve para todo el equipo.
- Si te quedas sin vida quedas **ATRAPADO**: un compañero se acerca, presiona USAR y te rescata
  resolviendo un puzzle. Si nadie llega en 45 s, reapareces en tu última estación.
- La partida en red no toca tu guardado de un jugador.
- Si el anfitrión se va, la partida termina para todos. Si un jugador pierde la señal 6 s, sale de la partida.

**Probar en un solo computador:**
- Por internet (lo real): abre el juego en dos ventanas del navegador (o en Chrome y en Edge),
  crea en una y únete desde la otra.
- Sin internet (modo de prueba): con un servidor local (`python -m http.server`), abre dos pestañas
  en `http://localhost:8000/index.html?red=local`.

**Si alguien no logra conectarse** (pasa con algunos datos móviles o routers): hace falta un servidor TURN.
Crea una cuenta en un proveedor de TURN con plan gratuito y pega sus datos en `js/red/config_red.js`,
dentro de `iceServers`. Todos los jugadores deben usar la misma versión del juego.

Archivos nuevos de la red: `js/red/peerjs.min.js` (PeerJS 1.5.5, MIT), `js/red/config_red.js`,
`js/red/transporte.js` (PeerJS o local, intercambiables), `js/red/red.js` (sesión), `js/ui/menu_red.js`.

## Pendiente
- **10b**: información repartida (una pista legible solo por un jugador), puertas de doble palanca,
  ayuda entre el laberinto y las salas 2D. Las pistas compuestas ya dejan lista la base: cada parte
  podría quedar a la vista de un jugador distinto.
- **10c**: versus (carrera, ataques, EMP, hackeo, trampas remotas, escudo).

## Licencia
Código bajo licencia MIT (ver `LICENSE`): puedes usarlo, modificarlo y compartirlo citando al autor.
PeerJS conserva su propia licencia MIT (ver `LICENCIAS-TERCEROS.md`).

Creado por Fernando Aravena.

# Guía de montaje

*[Read in English](BUILD.md)*

Del kit (.zip) del [generador web](https://bay2rack.pages.dev/) a un rack en el frontal de tu caja. El `README.txt`
del kit trae los tornillos, insertos y keystones exactos de tu montaje; esta guía explica qué hacer con ellos.

## 1. Lo que necesitas

**Herramientas**
- Un soldador con punta para insertos térmicos (una para M3 y otra para los insertos del rack, M6 por defecto).
  ¿Sin soldador? Activa **No tengo soldador** en el paso **Tornillos**: tornillos M5 con tuerca cuadrada en el rack y
  tuerca hexagonal en la bahía, todo con un destornillador. (La tuerca de M6 es demasiado ancha: no dejaría plástico
  entre el poste y el lateral de la bahía.) La bahía NanoKVM y el soporte de la botonera retro siguen llevando
  insertos térmicos M3.
- Llaves allen o destornilladores para tus tornillos (M6 de cabeza botón: allen de 4 mm; M3: allen de 2 mm o
  Phillips para las cabezas alomadas).
- Alicates de corte y un desbarbador o una lima pequeña.

**Filamento y ajustes de impresión**
- PETG, o ASA / ABS: dentro de una caja de PC hace calor. El PLA vale para una caja fresca o una primera prueba.
- Boquilla de 0,4 mm, capas de 0,2 mm, **4 perímetros** (los postes y torretas llevan insertos), relleno del 20–30 %.
- **Sin soportes**: todos los STL ya vienen orientados con la cara delantera hacia abajo.
- Cama: un adaptador de 3 bahías ocupa 148 × 128 mm en la cama y mide unos 70 mm de alto.

**Tornillería** (las cantidades están en la lista del kit)
- Tornillos e insertos del rack: por defecto *M6 × 12 de cabeza botón (ISO 7380)* e *insertos térmicos M6 de
  8 mm de agujero y 12,7 mm de largo*. Marcas como Ruthex o CNC Kitchen tienen las dos medidas.
- Tornillos de la bahía: *M3 × 5 de cabeza alomada* con *insertos térmicos M3 (agujero de 4,2 mm, 5,7 mm de largo)*.
  Los tornillos del lector de DVD viejo suelen ser M3 × 5 y valen.
- Keystones: las **celdas metálicas** del patch panel llevan keystones RJ45 metálicos / apantallados, que entran por
  detrás. El **hueco estándar** (`ks_style = standard`) lleva keystones de plástico a presión (HDMI, USB, RJ45 de
  plástico). El `filler-keystone6.stl` ya generado tiene celdas metálicas.
- Bridas de 2,5–3,6 mm para sujetar los aparatos en sus bandejas.
- Los aparatos (switch, KVM, Raspberry Pi…), su alimentación y los cables: la lista dice cuáles lleva tu montaje, en
  *Aparatos (no incluidos)*.

## 2. Imprime primero las piezas de prueba

Están en la carpeta `tests/` del kit (`test_bay`, `test_rack`, `test_keystone` y `test_button` si hay botonera). En
[`stl/tests`](../stl/README.md#tests) se llaman `bay-plate` / `bay-bezel`, `rack-M6-heatset`, `keystone-metal` /
`keystone-standard` y `button-mx` / `button-metal-16` / `button-retro`.

| Pieza de prueba | Qué miras | Si no va bien |
|---|---|---|
| Esquina de bahía (`test_bay`) | entra en una bahía y sus agujeros coinciden con los laterales de la caja | justa: sube *Guías en la bahía*; agujeros desplazados: `bay_hole_y1`, `bay_hole_z1`, `bay_hole_offset` |
| Agujeros del rack (`test_rack`) | los tornillos coinciden a 134,925 mm; mete sus dos insertos y métela en una bahía | el inserto gira: baja *Agujero del inserto del rack*; entra torcido: súbelo; justa en la bahía tras los insertos: mira el paso 4 |
| Puerto keystone (`test_keystone`) | el keystone se engancha y no se sale | justo: sube *Huecos de keystone* (+0,1 a +0,2); holgado: bájalo |
| Un botón (`test_button`) | la tecla, el pulsador o el botón impreso encajan | MX: *Hueco de la tecla MX* |

Cambia lo que haga falta en el paso **Holguras de impresión** del generador web, vuelve a descargar el kit e imprime
el resto.

## 3. Imprime el resto

Primero el adaptador (la impresión más larga), luego el panel de la franja y los módulos del rack, y al final las
piezas pequeñas: tapones de keystone, chapas PCI, botones impresos, la tapa del NanoKVM. Con una impresora
multimaterial, cada panel con letras trae un `-labels.stl`: impórtalos a la vez y responde *Sí* a «cargar como un
solo objeto con varias partes»; luego da a las letras el segundo filamento.

## 4. Insertos térmicos

- Usa la temperatura que indique el fabricante de tus insertos para tu filamento (normalmente 200–250 °C).
- Pon el inserto sobre el agujero, empuja recto y despacio con la punta que le corresponde y para cuando quede
  enrasado. Déjalo enfriar antes de atornillar.
- **Insertos del rack (delante de los postes del adaptador):** con M6 solo quedan 1,4 mm de plástico entre el
  inserto y el lateral de la bahía (el modelo lo avisa en una nota). Mételos despacio para que esa pared no se abombe
  y comprueba después que el adaptador sigue entrando en las bahías. Con M5 o M4 quedan 2 mm o más.
- **Insertos de la bahía:** dentro de las guías, en las torretas que quedan detrás de los agujeros laterales.
- Módulos: los postes de la tapa y las torretas del cajón del NanoKVM (M3), los postes del soporte de la botonera
  retro (M3).

## 5. Montaje

1. **Prepara la caja.** Quita las tapas de las bahías de 5,25": las de plástico del frontal y las chapas metálicas de
   detrás. Quita los raíles o clips sin herramientas que tapen los agujeros laterales. Las pestañas metálicas entre
   bahías se pueden quedar: el adaptador tiene ranuras para ellas.
2. **Los aparatos en sus bandejas.** El switch entra por detrás en su túnel y lo sujeta una brida; las cajas KVM van
   en sus huecos con bridas; las Raspberry Pi se atornillan a sus separadores (M2,5 × 6).
3. **Keystones.** Los metálicos entran en sus celdas por detrás hasta que enganchan los labios. Los de plástico
   entran a presión por delante. Los tapones y pasacables se meten por delante.
4. **El adaptador en las bahías.** Mételo por delante hasta que el marco apoye en el frontal de la caja y atornilla
   los tornillos de la bahía por los agujeros laterales de la caja, por los dos lados.
5. **Panel de la franja y módulos.** Atorníllalos a los postes del rack del adaptador, de arriba abajo. Sus tornillos
   van a los insertos del adaptador: los módulos no necesitan insertos propios para esto.
6. **Detrás de la caja.** Atornilla las chapas PCI en dos ranuras libres: una para los cables de red y otra para el
   de corriente.

## 6. Cables y alimentación

- **Red:** latiguillos cortos por delante, del switch a los keystones. Detrás de los keystones llegan los cables de
  los otros equipos, que entran por la chapa PCI de red.
- **KVM por IP:** HDMI desde la salida de vídeo del ordenador y USB al ordenador (teclado y ratón). Para encender y
  apagar el ordenador desde el KVM, JetKVM y NanoKVM venden una placa ATX que se conecta al panel frontal de la placa
  base; sigue sus instrucciones.
- **Alimentación:** lo más sencillo y seguro es la fuente de cada aparato. Su cable sale de la caja por la chapa PCI
  de corriente hasta una regleta. Una Raspberry Pi 5 necesita una fuente USB-C de 5 V 5 A (o un HAT PoE en un switch
  PoE). No te enganches a la fuente del PC si no sabes exactamente lo que haces.
- **Botonera:** los pulsadores y LEDs van al panel frontal de la placa base (POWER SW, RESET SW, POWER LED, HDD LED);
  mira el orden de los pines en el manual de la placa. Las placas modernas no tienen pin TURBO: ese botón hace lo que
  tú le conectes, o nada.

## 7. Si algo no encaja

| Problema | Qué cambiar (web: Holguras de impresión / Avanzado) |
|---|---|
| El adaptador entra justo en las bahías | sube *Guías en la bahía* (`sleeve_clearance`) |
| No cabe en la altura de las bahías | sube *Altura en las bahías* (`height_clearance`) |
| Keystones justos u holgados | *Huecos de keystone* (`ks_fit`) |
| Un aparato entra justo en su bandeja | sube *Dispositivos en sus bandejas* (`mount_clear`) |
| Los insertos del rack giran | baja *Agujero del inserto del rack* (`rack_insert_d`) |
| Los agujeros de la bahía no coinciden | `bay_hole_y1`, `bay_hole_z1`, `bay_hole_offset` (mide los tuyos) |
| La puerta de la caja no cierra | un montaje que sobresale o la bahía NanoKVM en montañita: usa «Dentro de las bahías», o desactiva «Montañita» |

Y luego cuéntanos qué tal: [informe de caja](https://github.com/abarriuso/bay2rack/issues/new?template=case-report.yml).
Cada informe entra en la [lista de compatibilidad](CASES.md).

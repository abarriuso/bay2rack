# bay2rack — caja de PC antigua → rack de 6" para tu homelab

*[Read in English](README.md)* · [![Model tests](https://github.com/abarriuso/bay2rack/actions/workflows/models.yml/badge.svg)](https://github.com/abarriuso/bay2rack/actions/workflows/models.yml)

Las torres traían bahías de 5,25" para los lectores de CD. Las cajas nuevas ya no, pero el ATX no ha cambiado: esa caja
antigua sigue admitiendo una placa base moderna. **bay2rack** es un adaptador paramétrico en OpenSCAD que se atornilla
a esas bahías y las convierte en un **mini rack de 6"**, para que una torre antigua sea el corazón de un homelab barato:
un router con VLANs, switches, KVM por IP, blades de Raspberry Pi y un patch panel, en el frontal de la caja.

![Un sleeper beige de los 90 se despliega: dentro, un servidor moderno; sus bahías de 5,25" se convierten en un rack](docs/video/assemble.gif)

> **[Abre el generador web](https://bay2rack.pages.dev/)** ([copia](https://abarriuso.github.io/bay2rack/) si esa
> dirección no carga): di qué quieres en las bahías (un ventilador o botones, enchufes o un rack para aparatos), elige
> qué va en cada U del rack y en cada puerto del patch panel, míralo montado en una caja de PC real (o en un sleeper de
> los 90) y descarga un **kit (.zip)** con todos los STL, la lista de materiales y los ajustes de impresión. Todo se
> ejecuta en tu navegador.
>
> **¿Solo quieres imprimir?** Las variantes ya generadas están en [`stl/`](stl/README.md), con los tornillos e insertos
> que necesita cada una. Imprime primero las [piezas de prueba](stl/README.md#tests) y [ajusta las holguras](#impresión).
>
> **¿Vas a montarlo?** La [guía de montaje](docs/BUILD.es.md) explica qué comprar, el orden de impresión, los
> insertos, el montaje y los cables y la alimentación.

> **En desarrollo.** ¿Has encontrado un defecto, una pieza que no encaja en tu caja o un problema al imprimir?
> [Abre un issue](https://github.com/abarriuso/bay2rack/issues) con fotos y el modelo de tu caja. Se agradecen pull requests con medidas de otras cajas
> y accesorios de rack, módulos nuevos y correcciones. Cajas reportadas: [lista de compatibilidad](docs/CASES.es.md) · cambios: [CHANGELOG](CHANGELOG.md).

Evolución del post original
[6" mini rack switch + patch panel in a 5.25" bay](https://www.reddit.com/r/minilab/comments/1vr8vc1/6_mini_rack_switch_patch_panel_in_525_bay/).

---

## Qué puedes montar

| | |
|---|---|
| ![Router + VLANs](docs/gallery/router.webp) **Router + VLANs**: el PC corre OPNsense / pfSense con una tarjeta de red de 4 puertos; un switch UniFi gestionable lleva las VLANs, un segundo switch los servidores, JetKVM + NanoKVM, patch panel | ![Rack de red](docs/gallery/network.webp) **Rack de red**: 5 bahías, dos switches, un UniFi Express y un patch panel completo |
| ![Clúster de Raspberry Pi](docs/gallery/pi.webp) **Clúster de Raspberry Pi**: un switch UniFi y cuatro Raspberry Pi 5 de pie en blades de 2U | ![Estación KVM](docs/gallery/kvm.webp) **Estación KVM**: dos bandejas, dos JetKVM y dos NanoKVM, keystones HDMI y USB |
| ![Audio](docs/gallery/audio.webp) **Audio**: un streamer con Raspberry Pi 4, tres ventiladores de 40 mm, keystones RCA, jack de 3,5 mm y Toslink | ![Caja Proxmox / TrueNAS](docs/gallery/client.webp) **Caja Proxmox / TrueNAS**: sin rack, solo un panel frontal con un ventilador de 80 mm y una botonera de encendido / reset |
| ![UniFi](docs/gallery/unifi.webp) **UniFi**: switch Flex Mini y UniFi Express | ![Bisel enrasado](docs/gallery/bezel.webp) **Bisel enrasado**: un bisel de 5,25" exacto, enrasado con el frontal de la caja |

## Un homelab con PCs antiguos

El router lleva su rack en las bahías: los switches, los KVM por IP y el patch panel. Los cables de red de las demás
máquinas (un nodo Proxmox, una caja TrueNAS y un punto de acceso) entran por **soportes impresos en dos ranuras PCI**
de la parte trasera y terminan en los keystones de detrás del patch panel; unos latiguillos cortos por delante los
conectan a los switches. Los colores de los cables son VLANs: clientes, servidores, el troncal al punto de acceso y la
WAN, de la tarjeta de red del router a la caja de fibra.

![El rack con la bahía NanoKVM, el switch y el patch panel](docs/img/homelab.png)

## El problema de la altura

Una bahía de 5,25" mide 41,53 mm de alto y las bahías apiladas se repiten cada ~43,18 mm. Una U de rack mide 44,45 mm.
Por eso **N bahías nunca alojan N U dentro del hueco**, y el déficit crece 1,27 mm por cada bahía:

| Bahías | Alto del hueco | Dentro (`flush`) | Franja libre | Sobresale (`overhang`, N U) | Los paneles sobresalen |
|------:|------:|------:|------:|------:|------:|
| 1 | 41,1 mm | 0U | 41,1 mm | 1U | +3,3 mm |
| 2 | 84,3 mm | 1U | 39,9 mm | 2U | +4,6 mm |
| 3 | 127,5 mm | 2U | 38,6 mm | 3U | +5,9 mm |
| 4 | 170,7 mm | 3U | 37,3 mm | 4U | +7,1 mm |
| 5 | 213,9 mm | 4U | 36,1 mm | 5U | +8,4 mm |
| 6 | 257,0 mm | 5U | 34,8 mm | 6U | +9,7 mm |

El diseño lo resuelve con **un único modelo paramétrico** en vez de un modelo distinto para cada número de bahías.

## Variantes

Dos elecciones independientes dan cuatro familias. Los archivos ya generados cubren 1–3 bahías (1–4 en `plate-flush`); el modelo llega hasta 6:

| | **Dentro** (`flush`): N−1 U + franja libre, no sobresale nada | **Sobresale** (`overhang`): N bahías = N U |
|---|---|---|
| **Frontal plano**: marco plano detrás de los paneles | `plate-flush`: la franja libre lleva un **relleno intercambiable** (patch de 6 puertos, rejilla o tapa ciega) | `plate-overhang`: el marco es unos mm más alto que el hueco |
| **Frontal bisel**: el contorno exacto de biseles de unidades de 5,25" apiladas | `bezel-flush`: enrasado con el frontal de la caja como una unidad original, con el patch panel cortado en el bisel | `bezel-overhang`: el bisel sigue enrasado y solo los paneles sobresalen sobre el frontal |

![Las cuatro familias](docs/img/variants.png)

![Montado en una torre](docs/img/mounted.png)

Usa el frontal plano cuando el frontal de tu caja sea plano a la altura de las bahías. Si la caja tiene un
frontal de plástico que sobresale de la chapa, usa el bisel y ajusta `bezel_depth` a lo que sobresale ese frontal.

Otros ajustes: `units_override`, `overhang_align` (center/top/bottom), `spare_pos` (top/bottom/split)
y el relleno de la franja libre (`keystone`, `buttons`, `vent`, `cable`, `label`, `fan40`, `fan80` o `blank`).
El relleno puede ser `separate` (panel atornillado en el mismo plano que los accesorios) o `integral` (cortado en el marco).

## Módulos de rack

`rack_modules` indica qué va en cada U del rack, de arriba abajo. Cada módulo es una pieza aparte (de 1U; los blades
de 2U) que se atornilla a los agujeros del rack:

| Módulo | |
|---|---|
| `ms105g` | Switch de 5 puertos con la medida del **Mercusys MS105G** (105 × 24,9 × 70 mm, ancho × alto × fondo; pon la de tu switch): entra por detrás en un túnel, la ventana frontal deja libres los 5 puertos y la clavija, una brida por detrás lo sujeta |
| `uswflex`, `ux` | **UniFi USW-Flex-Mini** (gestionable, VLANs) y **UniFi Express** en el mismo tipo de túnel |
| `kvm:jet+nano` | **Bandeja de KVM por IP**: de 1 a 3 cajas a elegir una al lado de otra (`jet` JetKVM, `nano` NanoKVM, `custom`), p. ej. `kvm:nano+nano`; avisa si no caben |
| `pi:pi5` | **Bandeja de Raspberry Pi**: Pi 5 / 4 / 3 o Zero en plano sobre separadores M2,5, USB y Ethernet por delante; dos placas una al lado de otra con HAT PoE |
| `piblade:pi5+pi5+pi5+pi5` | **Blades de Raspberry Pi de 2U**: hasta cuatro placas de canto, cada una en su aleta, con separadores que se imprimen sin soportes |
| `nkvm:side` / `nkvm:front` / `nkvm:ks` | **Bahía NanoKVM Lite** en tres piezas (`ks`: dos), con tapa sobre insertos térmicos M3 y el disipador al aire. `side`: de pie, fuera de la caja en una montañita, con los puertos abiertos a los lados para enchufar desde fuera; los cables van por fuera o hacia dentro por las ranuras de los extremos (`nkvm_raised`; desactivado = metido en el frontal). `front`: un cajón con el puerto de red en su frontal que sale por delante con el NanoKVM (dos tornillos), con hasta dos keystones al lado. `ks`: la red llega al keystone 1 y el NanoKVM va tumbado justo detrás, con un latiguillo recto de 10 cm (`nkvm_patch`). `nkvm_split = false` imprime el frontal y la bahía en una sola pieza |
| `dev1`, `dev2` | Bandeja a medida para cualquier dispositivo: indica su ancho, alto y fondo |
| `fan40` | Panel de 1U con hasta tres **ventiladores de 40 mm** tras aberturas redondas o una rejilla hexagonal (`fan_guard`) |
| `shelf` | Estante con ranuras para bridas para dispositivos pequeños |
| `patch` | Patch panel de 1U con los puertos que elijas: `patch` a secas usa `ks_ports_list` / `ks_names`, `patch:rj45m=NAS+hdmi+cover` lleva los suyos (tipo de puerto, `=` su nombre, `_` para un espacio) |
| `buttons` | Botonera de 1U (ver abajo) |
| `vent`, `blank`, `cable`, `label` | Paneles de ventilación (ranuras, lamas, panal o agujeros), paneles ciegos, pasacables y de etiqueta (`label` pone `label_text`, `label:MI_LAB` su propio texto) |

Un módulo puede ocupar más de una U (los blades ocupan 2U): el rack se llena desde arriba y un módulo que ya no cabe
se convierte en un panel ciego.

![Soporte del switch, bandeja y tapa pasacables](docs/img/modules.png)

## Keystones

El patch panel admite hasta 6 puertos en una fila de 1U y más filas si es más alto (12 en un panel de 2U), con números
grabados o nombres propios (`ks_names`).
`ks_ports_list` define **cada puerto**: `rj45m` (RJ45 metálico / apantallado), `rj45`, `hdmi`, `usb`, `rca`, `jack`
(3,5 mm), `toslink` (keystones estándar), `cover` (tapón liso impreso para un puerto sin usar), `pass` (tapón pasacables
partido que abraza un cable, p. ej. el de alimentación del switch) o `none`. Los dos tapones se meten desde delante y
hacen clic tras la boca.

- **Celda metálica** (por defecto, `ks_style = metal`), replicada del adaptador original: boca frontal de 15 × 16,5 mm,
  rampa para la patilla, cavidad de 24,3 mm y labios traseros que retienen el conector, que entra por detrás. Mide 9,5 mm
  de fondo, con paredes de 2 mm y paso de 20 mm; todas las cotas son parámetros (`ksm_*`).
- **Hueco estándar**: 14,9 × 16,4 mm en una placa de 2 mm para keystones de plástico (los HDMI, USB y RJ45 de plástico lo usan).

![Alojamiento de keystone metálico](docs/img/keystone.png)

## Botonera

Un relleno o un módulo de 1U con **botones de encendido y reset** y **LEDs de encendido y de actividad de disco**
(3 o 5 mm), conectados al panel frontal de la placa base. Tres tipos de botón (`btn_type`):

- `mx`: interruptores de teclado normales (compatibles Cherry MX: hueco de 14 mm en placa de 1,5 mm, cualquier tecla 1u).
- `metal`: los pulsadores metálicos que se venden para cajas de PC, de 12 a 22 mm (`btn_metal_d`), con su anillo LED.
- `retro`: botones impresos sobre micropulsadores de 12 × 12 mm en un soporte impreso, un POWER grande, RESET y un
  TURBO opcional (`btn_turbo`) como los PCs beige de los 90, con los LEDs rotulados y líneas decorativas.

Tres diseños de LED, todos imprimibles con la cara frontal sobre la cama:

- `ring`: agujero avellanado con un aro grabado; la cúpula del LED asoma `led_protrude` mm.
- `halo`: un aro fino de luz alrededor de cada tecla.
- `glow`: invisible apagado; el LED atraviesa una piel de 0,6 mm y se ilumina el icono grabado (imprímelo en blanco o natural).

![Botonera: anillo, halo y brillo oculto](docs/img/buttons.png)

## Entra como una unidad

| Adaptador v2, por detrás | Por delante |
|---|---|
| ![Adaptador v2 por detrás: ranuras para las pestañas por fuera, nervios, labios e insertos para los tornillos de bahía por dentro](docs/img/adapter-v2-back.webp) | ![Adaptador v2 por delante: marco y postes del rack](docs/img/adapter-v2-front.webp) |

- **Ranuras para las pestañas metálicas entre bahías.** Muchas cajas tienen unos salientes troquelados en el hueco
  entre dos bahías sobre los que se apoyan las unidades. El adaptador tiene una ranura para ellos a lo largo de toda la
  guía (con un nervio por dentro para que la pared no pierda rigidez), así que no hace falta doblarlos.
- **Paredes laterales rígidas**: un labio interior en sus bordes superior e inferior y un redondeo hacia cada poste
  del rack, todo fuera de la abertura del rack.
- Tornillos de bahía con inserto térmico o tuerca; las aberturas de ventilador de 80 y 40 mm son agujeros redondos o
  una rejilla hexagonal (`fan_guard`).

## Estándar de rack

No existe un estándar oficial de 6", así que el proyecto aplica **las reglas del mini rack de 10" a un ancho de 6"**:

- Paneles de 152,4 mm (6")
- **134,925 mm entre agujeros**: el mismo margen de 8,74 mm del borde al agujero que el estándar de 10" (panel de 254 mm, agujeros a 236,525 mm)
- Patrón vertical EIA-310 (6,35 / 22,225 / 38,1 mm en cada U) y 1U = 44,45 mm
- Tornillos M6, 10-32 o 12-24, o M5 (por defecto: deja más plástico hacia el lateral de la bahía y pasa igual por agujeros M6)

Si tus accesorios son distintos, usa `rack_std = custom`.

## Tornillería

| | Opciones |
|---|---|
| Tornillo de rack | M3, M4, M5, M6, 10-32, 12-24 |
| Cabeza | botón (ISO 7380), allen (ISO 4762), avellanada (ISO 10642, añade avellanado a los paneles), alomada (ISO 7045) |
| Fijación de rack | inserto térmico, autorroscante, tuerca hexagonal, tuerca cuadrada lateral, canal continuo de tuercas cuadradas (tornillos a cualquier altura). Las tuercas piden M5 o menos (la hexagonal, M4): la de M6 no deja plástico entre el poste y el lateral de la bahía, y el modelo lo avisa |
| Tornillo de bahía | M3 o 6-32, con inserto térmico, autorroscante, tuerca hexagonal o agujero pasante + tuerca suelta |
| Ajustes finos | `rack_insert_d/l`, `bay_insert_d/l` para tus insertos; `rack_screw_len`, `bay_screw_len` (0 = automático) |

El modelo **elige la longitud de tornillo estándar adecuada**, métrica o imperial. Para ello usa el
grosor de las orejas del accesorio, el grosor de la chapa de la caja y el tipo de fijación, y avisa si no
cabe ninguna. Cada render muestra la lista de materiales:

```
BOM | rack accessories: 12 x M5 x 10 button head  +  12 x M5 heat-set insert (hole 6.4 x 9.5 mm)
BOM | filler panels: 2 x M5 x 10 button head  +  2 x M5 heat-set insert (hole 6.4 x 9.5 mm)
BOM | drive bay: 6 x M3 x 5 pan head  +  6 x M3 heat-set insert (hole 4.2 x 5.7 mm)
```

La previsualización dibuja los tornillos, insertos y tuercas en su sitio (`show_hardware`). `explode` separa las piezas
y `section` corta el modelo para ver cada fijación dentro del plástico.

![Tornillería](docs/img/hardware.png)

## Estándar de bahía

Por defecto se sigue SFF-8551 / EIA-741 (dispositivos de 5,25"): 146,05 mm de ancho, 41,53 mm de alto,
bisel de 148 × 42,3 mm y agujeros laterales M3 a 10 mm sobre la base de cada bahía y a 47,4 mm del frente.
El agujero trasero a 126,65 mm y la segunda fila a 21,84 mm son opcionales. **Cada caja es distinta, así que comprueba
estas cotas** con la pieza `test_bay`. Puedes ajustarlas con `bay_hole_offset` / `bay_hole_slot` o usar `bay_std = custom`.

## Impresión

> [!IMPORTANT]
> **Imprime primero las piezas de prueba** (vienen en todos los kits y en [`stl/tests`](stl/README.md#tests)).
> Cada impresora y cada filamento imprimen un poco justo o un poco holgado, así que comprueba cada ajuste y cambia
> su holgura antes de imprimir las piezas grandes:
>
> | Pieza de prueba | Qué comprueba | Si queda justa | Si queda holgada / desplazada |
> |---|---|---|---|
> | `test_keystone` | que el keystone entre y se enganche | sube `ks_fit` (+0,1 a +0,2) | baja `ks_fit` (negativo) |
> | `test_bay` | que las guías entren en la bahía y cuadren los agujeros laterales | sube `sleeve_clearance` | agujeros desplazados: `bay_hole_y1`, `bay_hole_z1`, `bay_hole_offset` |
> | `test_rack` | la separación de los agujeros del rack y sus insertos; con los insertos puestos tiene que seguir entrando en una bahía | no cuadran los agujeros: `rack_hole_slot` | el inserto gira: baja `rack_insert_d`; entra torcido: súbelo |
> | `test_button` | que entre la tecla MX, el pulsador metálico o el botón impreso | MX: sube `mx_cut` | MX: baja `mx_cut` |
>
> En un kit se llaman `tests/test_*.stl`; en [`stl/tests`](stl/README.md#tests), `bay-plate` / `bay-bezel`,
> `rack-M5-heatset`, `keystone-metal` / `keystone-standard` y `button-mx` / `button-metal-16` / `button-retro`.
> El resto funciona igual: `cover_clear` para los tapones de keystone, `mount_clear` para los dispositivos de los
> módulos del rack, `nkvm_insert_d` y `bay_insert_d` para los insertos pequeños. En el generador web están en el paso
> **Ajustar tras imprimir las pruebas**.

- Los STL ya vienen orientados **con la cara frontal sobre la cama**. Las paredes y los postes crecen en vertical, y los
  techos de las ventanas y los refuerzos de los tornillos tienen forma de gota a 45°, así que **no hacen falta soportes**.
- Se recomienda PETG o ABS/ASA dentro de una caja caliente; el PLA sirve si la caja está fresca.
- 3–4 perímetros y 20–30 % de relleno.
- La versión de 3 bahías ocupa 148 × 128 mm en la cama y mide unos 66–70 mm de alto.
- Insertos, montaje, cables y alimentación: mira la [guía de montaje](docs/BUILD.es.md).

<p align="center"><img src="docs/img/print.png" width="420" alt="Orientación de impresión"></p>

## Personalizar

- **Generador web:** [bay2rack.pages.dev](https://bay2rack.pages.dev/) (copia en
  [GitHub Pages](https://abarriuso.github.io/bay2rack/), generada desde el mismo `main`) ejecuta OpenSCAD compilado a
  WebAssembly en el navegador: un modo sencillo paso a paso con ayuda al pasar el ratón, el formulario «Todos los
  parámetros» para el resto, enlaces para compartir, la lista de materiales, descarga de cada pieza en STL o 3MF con colores y un kit
  .zip con todos los STL. El código está en `web/` (Vite + pnpm); `corepack pnpm --dir web dev` lo arranca en local y
  `pnpm --dir web test:e2e` prueba la web compilada en un navegador (Playwright). Se instala como app y funciona sin conexión
  tras la primera visita.
- **Customizer de OpenSCAD:** abre `src/bay2rack.scad` y ve a *Window → Customizer*. Cada variante es un preset del
  desplegable. F5 previsualiza (el adaptador aparece montado en una torre, `case_view`) y F6 renderiza.
- **Línea de comandos:**
  ```bash
  openscad -o adapter.stl -D 'part="adapter"' -D bays=3 -D 'front_style="bezel"' src/bay2rack.scad
  ```
- **Regenerarlo todo:** `python scripts/build.py` rehace los presets, todos los STL y `stl/README.md`.
  `python scripts/render_docs.py` rehace las imágenes.

Cada render muestra una línea resumen, la lista de materiales y un `WARNING`/`NOTE` cuando los tornillos, insertos o
rellenos no caben. `python scripts/test_models.py` genera los casos límite (1–6 bahías, cada frontal, relleno, tornillo,
fijación y módulo) y todos los montajes del configurador, y comprueba sus avisos y su lista de materiales; se ejecuta
en cada push.

### El vídeo

Blender 5.2, Cycles (HIP), 1600×900, 60 fps (30 fps más los fotogramas intermedios, `--between`), 17 s.
`scripts/blender/hero.py` monta la escena a partir de exportaciones GLB del visor web; `scripts/blender/encode.py` hace
el etalonaje y genera MP4 (H.264), WebM (VP9) y el GIF.

| | | |
|---|---|---|
| ![El sleeper se despliega](docs/img/film/unfold.webp) | ![Un servidor moderno dentro](docs/img/film/server.webp) | ![El frontal del rack](docs/img/film/front.webp) |
| ![Cables por las ranuras PCI](docs/img/film/cables.webp) | ![Blades de Raspberry Pi en el nodo Proxmox](docs/img/film/pi-cluster.webp) | ![El homelab](docs/img/film/hero.webp) |

## Estructura del repositorio

```
src/bay2rack.scad        todos los parámetros (abre este)
src/bay2rack.json        presets del Customizer (generados)
src/lib/
  standards.scad         tablas de tornillos, insertos y tuercas, longitudes estándar
  config.scad            medidas derivadas, comprobaciones, lista de materiales
  util.scad              utilidades de geometría
  fills.scad             keystones (metálico / estándar), ventilación, pasacables, etiqueta, botonera, ventiladores
  adapter.scad           fijaciones de rack, guía de bahía, marco frontal
  panels.scad            rellenos, paneles de rack, piezas de prueba
  preview.scad           tornillería, cortes y torre de PC (solo previsualización)
scripts/build.py         tabla de variantes -> presets + stl/ + stl/README.md
scripts/render_docs.py   imágenes del README
scripts/test_models.py   tests del modelo (CI)
scripts/check_assemblies.py  todos los ejemplos y combinaciones bahías x encaje x frontal, sin avisos (CI)
scripts/makerworld.py    kit para subir a MakerWorld (scripts/makerworld/: las descripciones)
scripts/blender/         vídeo: hero.py (escena, materiales, animación), encode.py (etalonaje + MP4 / WebM / GIF);
                         product.py (las fotos del adaptador de docs/img)
web/                     visor y generador web (Cloudflare Pages, Vite + pnpm)
stl/<familia>/<variante>/  STL listos para imprimir, ver stl/README.md
docs/BUILD.es.md         guía de montaje: qué comprar, orden de impresión, insertos, montaje, cables y alimentación
docs/CASES.es.md         lista de compatibilidad y comprobaciones de la caja
docs/img/, docs/gallery/ imágenes del README y de la web
```

## Licencia

[CC BY-NC-SA 4.0](LICENSE): puedes compartirlo y modificarlo citando al autor y con la misma
licencia, pero **no para uso comercial** sin permiso. Para licencias comerciales, contacta con el autor.

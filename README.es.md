# bay2rack — bahía de 5,25" → mini rack de 6"

*[Read in English](README.md)*

Adaptador paramétrico en OpenSCAD que se atornilla a los agujeros laterales estándar de una o
varias bahías de 5,25" y las convierte en un **mini rack de 6"**. Así los accesorios de 6"
(switches, patch panels, bandejas…) se montan directamente en la caja del PC.

El espacio que sobra en la pila de bahías se puede convertir en un **patch panel de 6 keystones integrado**.

![Resumen](docs/img/overview.png)

Evolución del post original
[6" mini rack switch + patch panel in a 5.25" bay](https://www.reddit.com/r/minilab/comments/1vr8vc1/6_mini_rack_switch_patch_panel_in_525_bay/).

---

## El problema de la altura

Una bahía de 5,25" mide 41,53 mm de alto y las bahías apiladas se repiten cada ~43,18 mm.
Una U de rack mide 44,45 mm. Por eso **N bahías nunca alojan N U dentro del hueco**, y el déficit crece 1,27 mm por cada bahía:

| Bahías | Alto del hueco | Flush (dentro) | Zona libre | Overhang (N U) | Los paneles sobresalen |
|------:|------:|------:|------:|------:|------:|
| 1 | 41,1 mm | 0U | 41,1 mm | 1U | +3,3 mm |
| 2 | 84,3 mm | 1U | 39,9 mm | 2U | +4,6 mm |
| 3 | 127,5 mm | 2U | 38,6 mm | 3U | +5,9 mm |
| 4 | 170,7 mm | 3U | 37,3 mm | 4U | +7,1 mm |
| 5 | 213,9 mm | 4U | 36,1 mm | 5U | +8,4 mm |
| 6 | 257,0 mm | 5U | 34,8 mm | 6U | +9,7 mm |

El diseño lo resuelve con **un único archivo paramétrico** en vez de un modelo distinto para cada número de bahías.

## Modos de encaje (`fit`)

| `fit` | Resultado | Contrapartida |
|---|---|---|
| `flush` (por defecto) | N−1 U más una **zona libre** de 35–41 mm. No sobresale nada del hueco. | Se pierde casi una U, pero se recupera como patch panel, rejilla o etiqueta. |
| `overhang` | N U. Los paneles de rack son unos mm más altos que el hueco y quedan sobre el frontal de la caja. | El cuerpo de los equipos tiene que pasar igualmente por el hueco. |

`units_override` fuerza cualquier número de U. `overhang_align` (center/top/bottom) y
`spare_pos` (top/bottom/split) deciden dónde va la altura sobrante.

## Estilo del frontal (`front_style`)

| `front_style` | Descripción |
|---|---|
| `plate` (por defecto) | Marco plano de 148 mm detrás de los paneles de rack. |
| `bezel` | **El contorno exacto de los biseles de unidades de 5,25" apiladas.** Mide 148 × 42,3 mm por bahía, lleva ranuras decorativas entre bahías y tiene la profundidad de un bisel de unidad (`bezel_depth`). Entra en el hueco del frontal de la caja y queda **enrasado, como una unidad original**. Con `filler_mode = integral` el frontal queda totalmente plano. |

El modo bisel funciona con los dos modos de encaje. En `overhang` el marco mantiene el tamaño del bisel
y solo los paneles de rack sobresalen sobre el frontal de la caja.

## Rellenos de la zona libre

`spare_fill` / `spare_fill_2` (modo split) / `panel_fill`:

- `keystone`: N puertos keystone (6 por defecto, de 1 a 12, con filas automáticas) y números grabados opcionales
- `vent`: ranuras de ventilación
- `cable`: pasacables
- `led`: ranura difusora con canal para tira LED detrás
- `label`: texto grabado
- `blank`: tapa ciega

Con `filler_mode = separate` (por defecto, modular) el relleno es un panel atornillado en el mismo
plano que los accesorios del rack, así que se puede cambiar más adelante. Con `integral` el relleno se corta en el propio marco (una sola impresión).

## Estándar de rack

No existe un estándar oficial de 6", así que el proyecto aplica **las reglas del mini rack de 10" a un ancho de 6"**:

- Paneles de 152,4 mm (6")
- **134,925 mm entre agujeros**: el mismo margen de 8,74 mm del borde al agujero que el estándar de 10" (panel de 254 mm, agujeros a 236,525 mm)
- Patrón vertical EIA-310 (6,35 / 22,225 / 38,1 mm en cada U) y 1U = 44,45 mm
- Tornillos M6, 10-32 o 12-24, con M6 por defecto

Si tus accesorios son distintos, usa `rack_std = custom`.

## Tornillería

Toda la tornillería es seleccionable:

| | Opciones |
|---|---|
| Tornillo de rack | M3, M4, M5, M6, 10-32, 12-24 |
| Cabeza | botón (ISO 7380), allen cilíndrica (ISO 4762), avellanada (ISO 10642, añade avellanado a los paneles), alomada (ISO 7045) |
| Fijación de rack | inserto térmico, autorroscante, tuerca hexagonal, tuerca cuadrada lateral, canal continuo de tuercas cuadradas (tornillos a cualquier altura) |
| Tornillo de bahía | M3 o 6-32, con inserto térmico, autorroscante, tuerca hexagonal o agujero pasante + tuerca suelta |
| Ajustes finos | `rack_insert_d/l`, `bay_insert_d/l` para tus insertos; `rack_screw_len`, `bay_screw_len` (0 = automático) |

El modelo **elige la longitud de tornillo estándar adecuada**, métrica o imperial. Para ello usa el
grosor de las orejas del accesorio, el grosor de la chapa de la caja y el tipo de fijación, y avisa si no
cabe ninguna. Cada render muestra la **lista de materiales**, por ejemplo:

```
BOM | rack accessories: 12 x M6 x 12 button head  +  12 x M6 heat-set insert (hole 8 x 12.7 mm)
BOM | filler panels: 2 x M6 x 12 button head  +  2 x M6 heat-set insert (hole 8 x 12.7 mm)
BOM | drive bay: 6 x M3 x 5 pan head  +  6 x M3 heat-set insert (hole 4.2 x 5.7 mm)
```

### Previsualizar la tornillería

En la vista de conjunto se dibujan los tornillos, insertos y tuercas en su sitio (`show_hardware`).
`explode` separa todas las piezas, y `section` corta el modelo por una fila de agujeros de rack, una columna de
agujeros o los tornillos de bahía para ver cada fijación dentro del plástico.

![Tornillería](docs/img/hardware.png)

## Estándar de bahía

Por defecto se sigue SFF-8551 / EIA-741 (dispositivos de 5,25"): 146,05 mm de ancho, 41,53 mm de alto,
bisel de 148 × 42,3 mm y agujeros laterales M3 a 10 mm sobre la base de cada bahía y a 47,4 mm del frente.
El agujero trasero a 126,65 mm y la segunda fila a 21,84 mm son opcionales. **Cada caja es distinta, así que comprueba estas cotas.**
Puedes ajustarlas con `bay_hole_offset` / `bay_hole_slot` o usar `bay_std = custom`.

## Antes de imprimir el adaptador completo

Los STL de prueba ya generados (valores por defecto) están en `stl/tests/`.

1. `test_bay`: una esquina con los agujeros de bahía y el frontal o bisel. Comprueba que se atornilla y queda enrasado.
2. `test_rack`: una barra fina con dos fijaciones de rack. Pruébala con un accesorio de 6" real.
3. `test_keystone`: un hueco de keystone. Comprueba que el conector encaja con firmeza.

## Impresión

- Imprime todas las piezas **con la cara frontal sobre la cama**. Las paredes y los postes crecen en vertical, y los techos de las
  ventanas y los refuerzos de los tornillos tienen forma de gota a 45°, así que **no hacen falta soportes**.
- Se recomienda PETG o ABS/ASA dentro de una caja caliente; el PLA sirve si la caja está fresca.
- 3–4 perímetros y 20–30 % de relleno.
- La versión de 3 bahías ocupa 148 × 128 mm en la cama. La altura de la pieza es de unos 66–70 mm.

## Uso

- **Customizer de OpenSCAD:** abre `src/bay2rack.scad` y ve a *Window → Customizer*. Los presets de
  `src/bay2rack.json` aparecen en el desplegable. F5 previsualiza y F6 renderiza.
- **Línea de comandos:**
  ```bash
  openscad -o adapter.stl -D 'part="adapter"' -D bays=3 -D 'front_style="bezel"' src/bay2rack.scad
  ```
- **Todos los presets:** `scripts/build.sh` exporta cada preset a `stl/<preset>/`.

Cada render muestra una línea resumen, la lista de materiales y un `WARNING`/`NOTE` cuando los tornillos,
insertos o rellenos no caben.

## Licencia

[CC BY-NC-SA 4.0](LICENSE): puedes compartirlo y modificarlo citando al autor y con la misma
licencia, pero **no para uso comercial** sin permiso. Para licencias comerciales, contacta con el autor.

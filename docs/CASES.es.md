# Lista de compatibilidad

*[Read in English](CASES.md)*

Cómo encaja Bay2Rack en cajas de PC reales. Cada caja es un poco distinta (los agujeros de las bahías, las pestañas
metálicas entre bahías, cuánto sobresale el frontal de plástico), así que esta lista crece con los informes de quien
lo imprime.

**Añade la tuya:** [abre un informe de caja](https://github.com/abarriuso/bay2rack/issues/new?template=case-report.yml),
son dos minutos. Si puedes, imprime antes la pieza de prueba de la bahía (`test_bay` en el kit;
`stl/tests/bay-plate.stl` con frontal plano, `stl/tests/bay-bezel.stl` con bisel).

## Revisa tu caja en cinco minutos

1. **¿Cuántas bahías de 5,25"?** Cuenta las tapas anchas (unos 15 cm) donde iba el lector de CD. Las estrechas de la
   disquetera (3,5") no cuentan.
2. **Agujeros laterales.** Quita una tapa y mira el lateral de la jaula: una fila de agujeros pequeños a unos 10 mm
   del fondo de cada bahía y a unos 47 mm del frente. Si están en otro sitio, la pieza de prueba te dice cuánto.
3. **Raíles o clips sin herramientas.** Muchas cajas sujetan las unidades con clips o raíles de plástico en vez de
   tornillos. Quítalos si tapan los agujeros laterales; si no se pueden quitar, puede que las guías no entren.
4. **Pestañas metálicas entre bahías.** Los salientes troquelados entre dos bahías no molestan: el adaptador tiene
   ranuras para ellos.
5. **El frontal.** Plano a la altura de las bahías (o que sobresale menos de unos 4 mm): frontal *plano*. Un frontal
   de plástico que sobresale de la chapa: *bisel*, y mide cuánto sobresale (`bezel_depth`). Con frontal plano en una
   caja de frontal hondo, los paneles de rack de 152,4 mm chocan con el hueco de 148 mm.
6. **¿Tiene puerta?** Los montajes que sobresalen salen unos mm y la bahía NanoKVM en montañita unos 19 mm: comprueba
   que la puerta cierra, o usa un montaje dentro de las bahías.
7. **Fondo.** Las guías entran 62 mm en las bahías y las bandejas tanto como sus aparatos (el switch unos 70 mm, el
   estante 100 mm): comprueba que detrás de las bahías no estorba nada (cables, un radiador, el borde de la placa).

## Cajas reportadas

| Caja | Bahías de 5,25" | Adaptador | Versión | Resultado | Notas |
|---|---|---|---|---|---|
| Torre ATX plateada y cromada (modelo aún sin saber) | 2 usadas | 2 bahías: switch de 1U + patch panel como panel aparte | v1 | ✅ Encaja tal cual | Insertos térmicos M6, switch MS105G y patch panel de 6 puertos montados |

**Resultado:** ✅ encaja tal cual · 🔧 encaja cambiando parámetros (en Notas) · ❌ no encaja

Las cajas de la vista 3D del configurador (Fractal Define R5, Corsair Obsidian 750D, Antec Three Hundred, Phanteks
Enthoo Pro, Define XL R2, Cooler Master HAF 932 y Stacker 830) son medidas exteriores aproximadas para el dibujo, no
encajes probados.

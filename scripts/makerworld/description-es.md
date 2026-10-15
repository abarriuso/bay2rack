# bay2rack: convierte las bahías de 5,25" de una caja de PC antigua en un mini rack de 6"

Las torres antiguas traían bahías de 5,25" para los lectores de CD. El ATX no ha cambiado, así que esa caja sigue
admitiendo una placa moderna, y con este adaptador sus bahías se convierten en un **mini rack de 6"**: un router con
VLANs, switches, KVM por IP, blades de Raspberry Pi y un patch panel, en el frontal de la caja.

Se atornilla a las bahías como una unidad. Los accesorios de rack se atornillan al adaptador.

**Sobre las fotos:** las fotos reales son de la primera versión del adaptador, de 2 bahías: 1U para el switch más el patch panel como panel aparte. Los archivos son la versión actual, que añade ranuras para las pestañas metálicas entre bahías y paredes laterales más rígidas (mira los renders).

**Configúralo en el navegador, con vista 3D de la caja:** https://abarriuso.github.io/bay2rack/
(elige las bahías, cada U del rack y cada puerto keystone, y descarga un kit con todos los STL y la lista de materiales).
Código y documentación: https://github.com/abarriuso/bay2rack

## Qué incluye

- **Adaptadores**: 2, 3 y 4 bahías (1U, 2U y 3U dentro de las bahías más una franja para un relleno), y una versión
  de 3 bahías con bisel de 5,25" exacto y patch panel de 6 puertos.
- **Rellenos** para la franja: 6 keystones, rejilla, ciego.
- **Módulos de rack** (1U): switch Mercusys MS105G, UniFi Flex Mini, UniFi Express, JetKVM + NanoKVM, Raspberry Pi 5,
  tres ventiladores de 40 mm, patch panel de 6 puertos, botonera de encendido / reset con interruptores MX.
  **2U**: cuatro blades de Raspberry Pi.
- **Bisel sin rack**: ventilador de 80 mm + botonera, para los demás PCs del homelab.
- **Tapas de keystone** (lisa y pasacables) y **soportes para ranuras PCI** para meter los cables por detrás.
- **Piezas de prueba**: imprímelas primero y compruébalas con tu caja.

Todo lo demás (otro número de bahías, otros switches, las medidas de tus dispositivos, tornillos M4/M5/10-32/12-24,
tuercas en vez de insertos...) está en el modelo paramétrico: usa **Personalizar** aquí o el configurador web.

## Impresión

- Ya vienen orientadas con la cara frontal sobre la cama: **sin soportes**.
- PETG o ASA dentro de una caja caliente; PLA si la caja está fresca. 3-4 perímetros, 20-30 % de relleno, capas de 0,2 mm.
- 3 bahías: 148 x 128 mm en la cama, unos 70 mm de alto.

## Tornillería (adaptador de 3 bahías, valores por defecto)

- Rack: tornillos M6 x 12 de cabeza de botón + insertos térmicos M6 (agujero de 8 mm). Los módulos usan lo mismo.
- Bahía: 6 tornillos M3 x 5 + insertos térmicos M3.
- Keystones: estándar de 14,9 x 16,4 mm o RJ45 metálicos / apantallados (la celda los sujeta por detrás).

## Comprueba antes tu caja

Cada caja es distinta. Los agujeros de las bahías siguen SFF-8551 (a 10 mm de altura y 47,4 mm del frente). Imprime
la **pieza de prueba de bahía** antes que el adaptador. Unas ranuras a lo largo de la guía dejan sitio a las pestañas
metálicas entre bahías, así que no hace falta doblarlas.

El rack de 6" no tiene estándar oficial: los agujeros están a 134,925 mm, con las mismas reglas que los mini racks de
10" (patrón vertical EIA-310). Imprime la **pieza de prueba de rack** para comprobar tus accesorios.

Licencia: CC BY-NC-SA 4.0, no para uso comercial sin permiso.

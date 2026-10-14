// Help texts for the tooltips. Simple-mode steps are hand written (EN + ES);
// advanced parameters fall back to the description in bay2rack.scad when there is no entry.
import { lang } from './i18n.js';
import { humanize } from './customizer.js';

const STEP_HELP = {
  bays: {
    en: 'How many stacked 5.25" bays the adapter fills.\nA bay is 41.5 mm tall and bays repeat every 43.2 mm, but one rack unit is 44.45 mm: N bays give N−1 U inside the bays, or N U if the panels may stick out a little.',
    es: 'Cuántas bahías de 5,25" seguidas ocupa el adaptador.\nUna bahía mide 41,5 mm y se repiten cada 43,2 mm, pero una U de rack mide 44,45 mm: N bahías dan N−1 U dentro del hueco, o N U si dejas que los paneles sobresalgan un poco.',
  },
  front: {
    en: 'Plate: a 4 mm frame behind the rack panels. Best when the front of your case is flat at the bays.\n5.25" bezel: the exact outline of stacked drive bezels. It fills the opening of the plastic case front and sits flush, like an original drive.',
    es: 'Plano: un marco de 4 mm detrás de los paneles de rack. Ideal si el frontal de tu caja es plano a la altura de las bahías.\nBisel 5,25": el contorno exacto de los biseles de unidades apiladas. Rellena el hueco del frontal de plástico y queda enrasado, como una unidad original.',
  },
  fit: {
    en: 'Inside: everything stays within the bays and a 35–41 mm strip is left over for a patch panel, vents…\nStick out: N bays = N U. The rack panels are a few mm taller than the bays and overlap the case front.',
    es: 'Dentro: todo queda dentro de las bahías y sobra una franja de 35–41 mm para un patch panel, rejilla…\nSobresale: N bahías = N U. Los paneles de rack son unos mm más altos que las bahías y montan sobre el frontal de la caja.',
  },
  fill: {
    en: 'What goes in the leftover strip. With the plate front it is a small screw-on panel you can swap later; with the bezel it is cut into the bezel.',
    es: 'Qué va en la franja que sobra. Con el frontal plano es un panelito atornillado que puedes cambiar después; con el bisel va cortado en el propio bisel.',
  },
  keystone: {
    en: 'Number of keystone ports (6 fit in one row).\nMetal: holder cells for metal / shielded keystones, the shape of the original design. Standard: a plain cut-out for plastic snap-in keystones.',
    es: 'Número de puertos keystone (caben 6 en una fila).\nMetálico: celdas que sujetan keystones metálicos / apantallados, la forma del diseño original. Estándar: un hueco simple para keystones de plástico.',
  },
  screw: {
    en: 'The screws your rack accessories use. The 10" mini rack convention is M6, 10-32 or 12-24; many printed accessories use M3–M5.\nThe screw length is worked out for you and listed in "What you need".',
    es: 'Los tornillos que usan tus accesorios de rack. La norma del mini rack de 10" usa M6, 10-32 o 12-24; muchos accesorios impresos usan M3–M5.\nLa longitud se calcula sola y aparece en "Lo que necesitas".',
  },
  preview: {
    en: 'Only changes the 3D view: the real PC case it is shown in (approximate outer size from the makers), example devices, hardware and an exploded view.',
    es: 'Solo cambia la vista 3D: la caja de PC real en la que se muestra (medidas exteriores aproximadas de los fabricantes), los dispositivos de ejemplo, la tornillería y la vista explosionada.',
  },
  panel: {
    en: 'A standalone 6" rack panel for any 6" rack: height in U and what it holds.',
    es: 'Un panel de rack de 6" suelto, para cualquier rack de 6": altura en U y qué lleva.',
  },
  test: {
    en: 'Small, quick prints to check the critical sizes before printing a whole adapter.',
    es: 'Piezas pequeñas y rápidas para comprobar las medidas críticas antes de imprimir el adaptador entero.',
  },
  contents: {
    en: 'Choose a printed module for every rack unit, top first: a mount for the Mercusys MS105G switch, a shelf for small devices (NanoKVM, Raspberry Pi…), a patch panel, a button panel, vents…\nEvery module goes into the kit download.',
    es: 'Elige un módulo impreso para cada U del rack, de arriba abajo: soporte para el switch Mercusys MS105G, bandeja para dispositivos pequeños (NanoKVM, Raspberry Pi…), patch panel, botonera, rejilla…\nTodos los módulos van en la descarga del kit.',
  },
  ports: {
    en: 'Every port of the patch panel: metal or plastic RJ45, HDMI, USB keystones, a plain printed cover for an unused port, a split pass-through cover for a cable that comes from the front (e.g. the switch power cable), or no hole.',
    es: 'Cada puerto del patch panel: keystone RJ45 metálico o de plástico, HDMI, USB, una tapa lisa impresa para un puerto sin usar, una tapa pasacables partida para un cable que entra por delante (p. ej. el de alimentación del switch), o sin hueco.',
  },
  buttons: {
    en: 'Power and reset with normal keyboard switches (Cherry MX compatible, any 1u keycap) plus power and disk-activity LEDs, wired to the motherboard front-panel header.\nRing: the LED dome sticks out of a countersunk ring. Halo: a ring of light around each key. Hidden glow: the light shines through a 0.6 mm skin and the engraved icon lights up (print it in a light colour).',
    es: 'Encendido y reset con interruptores de teclado normales (compatibles Cherry MX, cualquier tecla 1u) y LEDs de encendido y de disco, conectados al cabezal del panel frontal de la placa.\nAnillo: el LED asoma por un avellanado con aro. Halo: un aro de luz alrededor de cada tecla. Brillo oculto: la luz atraviesa una piel de 0,6 mm y se ilumina el icono grabado (imprímelo en un color claro).',
  },
  scene: {
    en: 'Homelab: two old client PCs and an access point next to the server, with the network cables from the back of the case to the patch panel.',
    es: 'Homelab: dos PCs cliente antiguos y un punto de acceso junto al servidor, con los cables de red saliendo por detrás de la caja hasta el patch panel.',
  },
};

const OPTION_HELP = {
  'fixing:heatset': { en: 'Brass heat-set inserts: the strongest, the screw can go in and out many times.', es: 'Insertos térmicos de latón: lo más resistente; puedes atornillar y desatornillar muchas veces.' },
  'fixing:tap': { en: 'The screw cuts its own thread in the plastic. No extra parts, but it wears out.', es: 'El tornillo hace su propia rosca en el plástico. Sin piezas extra, pero se desgasta.' },
  'fixing:nut_trap': { en: 'A hex nut sits in a pocket at the back of each post.', es: 'Una tuerca hexagonal va en un alojamiento detrás de cada poste.' },
  'fixing:square_nut': { en: 'A square nut slides in from the side of the post.', es: 'Una tuerca cuadrada entra por el lateral del poste.' },
  'fixing:channel': { en: 'A continuous slot where square nuts slide: screws fit at any height, whatever the hole pattern.', es: 'Un canal continuo donde deslizan tuercas cuadradas: atornillas a cualquier altura, sea cual sea el patrón de agujeros.' },
  'part:assembly': { en: 'The whole thing mounted in a PC case, with hardware. Preview only: it downloads as a coloured 3MF.', es: 'El conjunto montado en una caja, con tornillería. Solo para ver: se descarga como 3MF con colores.' },
  'part:adapter': { en: 'The main part: front frame + rails that screw into the bays. Already oriented to print without supports.', es: 'La pieza principal: marco frontal + guías que se atornillan a las bahías. Ya viene orientada para imprimir sin soportes.' },
  'part:filler': { en: 'The swappable screw-on panel for the leftover strip.', es: 'El panel atornillable e intercambiable de la franja libre.' },
  'part:rack_panel': { en: 'A standalone 6" rack panel.', es: 'Un panel de rack de 6" suelto.' },
  'part:tests': { en: 'Test pieces to check sizes before the big print.', es: 'Piezas de prueba para comprobar medidas antes de la impresión grande.' },
  'test:test_bay': { en: 'One corner with the bay screw holes and the front. Screw it into your case: do the holes line up, is the front flush?', es: 'Una esquina con los agujeros de la bahía y el frontal. Atorníllala en tu caja: ¿coinciden los agujeros?, ¿queda enrasado?' },
  'test:test_rack': { en: 'A bar with two rack fixings at the rack hole spacing. Hold it against a real 6" accessory.', es: 'Una barra con dos fijaciones a la distancia de los agujeros del rack. Compárala con un accesorio de 6" real.' },
  'test:test_keystone': { en: 'One keystone port: the jack should click in firmly.', es: 'Un puerto keystone: el conector debe entrar con un clic y quedar firme.' },
  'part:keystone_cover': { en: 'Printed covers for unused ports, pushed in from the front.', es: 'Tapas impresas para los puertos sin usar, se meten desde delante.' },
  'part:rack_module': { en: 'The printed modules that go in the rack units.', es: 'Los módulos impresos que van en las U del rack.' },
  'mod:ms105g': { en: 'Mercusys MS105G 5-port switch (105 x 70 x 24.9 mm): it slides into a tunnel from the back, the front window leaves the 5 ports and the power jack free, a zip tie holds it.', es: 'Switch Mercusys MS105G de 5 puertos (105 x 70 x 24,9 mm): entra por detrás en un túnel, la ventana frontal deja libres los 5 puertos y la clavija, una brida lo sujeta.' },
  'mod:shelf': { en: 'A shelf with zip-tie slots for small devices: NanoKVM, Raspberry Pi, a mini router…', es: 'Una bandeja con ranuras para bridas para dispositivos pequeños: NanoKVM, Raspberry Pi, un mini router…' },
  'mod:patch': { en: '1U patch panel with the ports you choose below.', es: 'Patch panel de 1U con los puertos que elijas abajo.' },
  'mod:buttons': { en: '1U button panel: keyboard-switch power / reset and LEDs.', es: 'Botonera de 1U: encendido / reset con interruptores de teclado y LEDs.' },
  'mod:kvm2': { en: 'Two KVM-over-IP boxes side by side: JetKVM (43 x 31 x 60 mm, touch screen in front) and Sipeed NanoKVM (40 x 36 x 36 mm). Sizes are editable.', es: 'Dos KVM por IP lado a lado: JetKVM (43 x 31 x 60 mm, pantalla táctil delante) y Sipeed NanoKVM (40 x 36 x 36 mm). Las medidas se pueden cambiar.' },
  'mod:uswflex': { en: 'UniFi USW-Flex-Mini (107.2 x 21.2 x 70.2 mm): the ports face the front.', es: 'UniFi USW-Flex-Mini (107,2 x 21,2 x 70,2 mm): los puertos quedan delante.' },
  'mod:ux': { en: 'UniFi Express (98 x 30 x 98 mm) gateway / access point, its display in the window.', es: 'UniFi Express (98 x 30 x 98 mm), gateway / punto de acceso, con su pantalla en la ventana.' },
  'mod:dev1': { en: 'A tray made to measure for any device: set its width, height and depth.', es: 'Una bandeja a medida para cualquier dispositivo: pon su ancho, alto y fondo.' },
  'mod:dev2': { en: 'A second made-to-measure tray.', es: 'Una segunda bandeja a medida.' },
  'port:rj45m': { en: 'Metal / shielded RJ45 keystone (goes in from the back of the holder cell).', es: 'Keystone RJ45 metálico / apantallado (entra por detrás de la celda).' },
  'port:rj45': { en: 'Plastic RJ45 keystone.', es: 'Keystone RJ45 de plástico.' },
  'port:hdmi': { en: 'HDMI keystone coupler.', es: 'Acoplador keystone HDMI.' },
  'port:usb': { en: 'USB keystone coupler.', es: 'Acoplador keystone USB.' },
  'port:cover': { en: 'Plain printed cover, pushed in from the front.', es: 'Tapa lisa impresa, se mete desde delante.' },
  'port:pass': { en: 'Split pass-through cover: clip it around a cable and push it in from the front.', es: 'Tapa pasacables partida: se abraza al cable y se mete desde delante.' },
  'port:none': { en: 'No hole at all.', es: 'Sin hueco.' },
  'led:ring': { en: 'Countersunk hole with an engraved ring; the LED dome sticks out of the front.', es: 'Agujero avellanado con un aro grabado; la cúpula del LED asoma por delante.' },
  'led:halo': { en: 'A thin ring of light around each key, lit from behind.', es: 'Un aro fino de luz alrededor de cada tecla, iluminado por detrás.' },
  'led:glow': { en: 'Invisible when off: the LED shines through a 0.6 mm skin and the engraved icon glows. Print in white or natural filament.', es: 'Invisible apagado: el LED atraviesa una piel de 0,6 mm y el icono grabado brilla. Imprime en blanco o natural.' },
};

// Spanish labels + help for the advanced parameters: name -> [label, help]
const PARAM_ES = {
  part: ['Pieza', 'Qué se genera. "assembly" es solo una vista previa: no se imprime.'],
  print_orientation: ['Orientación de impresión', 'Tumba las piezas imprimibles con la cara frontal sobre la cama.'],
  bays: ['Bahías', 'Número de bahías de 5,25" apiladas que ocupa el adaptador.'],
  bay_std: ['Estándar de bahía', 'SFF-8551 / EIA-741 o medidas propias.'],
  custom_bay_w: ['Ancho de bahía', 'Solo con estándar propio.'],
  custom_bay_h: ['Alto de bahía', 'Solo con estándar propio.'],
  custom_bay_pitch: ['Paso entre bahías', 'Distancia vertical entre bahías apiladas (COMPROBAR).'],
  custom_bezel_w: ['Ancho de bisel', 'Ancho de un bisel de unidad de 5,25".'],
  sleeve_clearance: ['Holgura de anchura', 'Se resta del ancho total de las guías.'],
  height_clearance: ['Holgura de altura', 'Se resta de la altura de la pila de bahías.'],
  bay_hole_y1: ['Agujero lateral: fondo', 'Distancia del agujero lateral al frontal de la caja (COMPROBAR).'],
  bay_hole_y2: ['Agujero trasero: fondo', 'Agujero lateral trasero opcional (COMPROBAR).'],
  use_hole_y2: ['Usar agujero trasero', ''],
  bay_hole_z1: ['Agujero lateral: altura', 'Altura del agujero sobre la base de cada bahía (COMPROBAR).'],
  bay_hole_z2: ['Segunda fila: altura', ''],
  use_hole_z2: ['Usar segunda fila', ''],
  bay_hole_offset: ['Desplazar agujeros', 'Mueve todos los agujeros laterales en profundidad.'],
  bay_hole_slot: ['Alargar agujeros', 'Convierte los agujeros laterales en ranuras (no con insertos).'],
  front_style: ['Frontal', 'plate = marco plano detrás de los paneles. bezel = bisel exacto de 5,25" enrasado con el frontal de la caja.'],
  bezel_h1: ['Alto de bisel (1 bahía)', 'SFF-8551 (COMPROBAR).'],
  bezel_depth: ['Profundidad del bisel', 'Cuánto sobresale el frontal de plástico de tu caja respecto a la chapa (COMPROBAR).'],
  bezel_clearance: ['Holgura del bisel', 'Se resta de ancho y alto para que entre en el hueco.'],
  bezel_grooves: ['Ranuras entre bahías', 'Ranuras decorativas donde se juntarían los biseles.'],
  fit: ['Encaje', 'flush = N−1 U + zona libre, no sobresale nada. overhang = N bahías = N U, los paneles sobresalen.'],
  units_override: ['Forzar U', 'Unidades de rack (0 = automático).'],
  overhang_align: ['Alineación', 'Dónde va la altura extra cuando no hay zona libre.'],
  spare_pos: ['Posición de la zona libre', 'Arriba, abajo o partida.'],
  min_spare: ['Zona libre mínima', 'Por debajo de esto la zona libre se queda como borde del marco.'],
  rack_std: ['Estándar de rack', '6" con las reglas del mini rack de 10" (EIA-310, 1U = 44,45 mm, mismo margen al agujero).'],
  custom_panel_w: ['Ancho de panel', 'Solo con estándar propio.'],
  custom_hole_spacing: ['Distancia entre agujeros', 'Entre centros de los agujeros izquierdo y derecho.'],
  rack_u_h: ['Altura de 1U', ''],
  hole_pattern: ['Patrón de agujeros', 'EIA-310 (3 por U), 2 por U o 1 centrado.'],
  rack_screw: ['Tornillo de rack', 'Norma del mini rack de 10": M6, 10-32 o 12-24.'],
  rack_screw_head: ['Cabeza', 'Botón, allen, avellanada (añade avellanado) o alomada.'],
  rack_screw_len: ['Largo del tornillo', 'En mm (0 = el largo estándar adecuado, automático).'],
  rack_fixing: ['Fijación', 'Cómo se rosca el tornillo en el plástico.'],
  rack_insert_d: ['Agujero del inserto', 'Diámetro para tus insertos (0 = tabla).'],
  rack_insert_l: ['Largo del inserto', '0 = tabla.'],
  accessory_panel_t: ['Grosor de las orejas', 'Grosor de las orejas de tus accesorios (para el largo del tornillo).'],
  rack_hole_slot: ['Alargar agujeros', 'Ranura horizontal para absorber diferencias de distancia entre marcas.'],
  bay_screw: ['Tornillo de bahía', 'M3 (unidades ópticas) o 6-32.'],
  bay_screw_head: ['Cabeza', ''],
  bay_screw_len: ['Largo del tornillo', 'En mm (0 = automático).'],
  bay_fixing: ['Fijación', 'Inserto térmico, autorroscante, tuerca por dentro o agujero pasante.'],
  bay_insert_d: ['Agujero del inserto', '0 = tabla.'],
  bay_insert_l: ['Largo del inserto', '0 = tabla.'],
  case_wall_t: ['Grosor de la chapa', 'Chapa de la jaula de bahías (para el largo del tornillo).'],
  frame_w_override: ['Ancho del marco', '0 = ancho de bisel (148 mm).'],
  frame_t: ['Grosor del marco', 'Frontal plano (el bisel usa su profundidad).'],
  frame_chamfer: ['Chaflán', ''],
  frame_rim: ['Borde', 'Borde que se mantiene encima y debajo de cada hueco.'],
  post_d: ['Fondo de los postes', 'Profundidad de los postes de los tornillos de rack.'],
  wall_t: ['Grosor de pared', ''],
  sleeve_depth: ['Fondo de las guías', 'Cuánto entra el adaptador en la bahía.'],
  sleeve_style: ['Tipo de guía', 'Solo laterales, o laterales + placas arriba y abajo.'],
  lighten: ['Aligerar', 'Ventanas imprimibles sin soporte en paredes y placas.'],
  filler_mode: ['Tipo de relleno', 'separate = panel atornillado intercambiable. integral = cortado en el marco.'],
  spare_fill: ['Relleno', 'Qué va en la zona libre.'],
  spare_fill_2: ['Relleno 2', 'Relleno de la zona de arriba si la zona libre está partida.'],
  filler_t: ['Grosor del relleno', ''],
  label_text: ['Texto', 'Texto grabado del relleno "label".'],
  ks_style: ['Tipo de keystone', 'metal = celdas para keystones metálicos. standard = hueco para keystones de plástico.'],
  ks_ports: ['Puertos', ''],
  ks_labels: ['Numerar puertos', 'Números grabados encima de cada puerto.'],
  ks_label_start: ['Primer número', ''],
  ksm_w: ['Ancho de cavidad', ''],
  ksm_face_h: ['Alto de la boca', ''],
  ksm_chamfer: ['Chaflán inferior', 'Chaflán a 45° bajo la boca.'],
  ksm_cav_h: ['Alto de cavidad', ''],
  ksm_ramp_d: ['Fondo de la rampa', 'Profundidad a la que la rampa de la patilla llega arriba.'],
  ksm_lip_d: ['Fondo de los labios', 'Profundidad a la que empiezan los labios traseros.'],
  ksm_lip_top: ['Labio superior', 'Los labios retienen el conector.'],
  ksm_lip_bot: ['Labio inferior', ''],
  ksm_depth: ['Fondo de la celda', ''],
  ksm_wall: ['Pared de la celda', ''],
  ksm_pitch: ['Paso entre celdas', ''],
  ks_w: ['Ancho del hueco', 'Keystone estándar ~14,5 × 16,0.'],
  ks_h: ['Alto del hueco', ''],
  ks_pitch: ['Paso', ''],
  ks_plate_t: ['Grosor de enganche', 'Grosor de la placa donde engancha el conector.'],
  panel_u: ['Altura del panel', 'En U.'],
  panel_fill: ['Contenido del panel', ''],
  panel_t: ['Grosor del panel', ''],
  panel_hole_slot: ['Alargar agujeros', 'Ranura horizontal en los agujeros del panel.'],
  explode: ['Explosionar', 'Separa las piezas en la vista.'],
  case_view: ['Caja', 'Sin caja, solo chapas o torre real.'],
  case_model: ['Modelo de caja', 'Caja real (medidas aproximadas). auto = la más pequeña con bahías suficientes.'],
  case_window: ['Ventana lateral', ''],
  show_devices: ['Mostrar dispositivos', ''],
  demo_devices: ['Dispositivos de ejemplo', 'Switch de 5 puertos + NanoKVM + keystones metálicos, o paneles genéricos.'],
  show_hardware: ['Mostrar tornillería', ''],
  section: ['Corte', 'Corta la vista para ver la tornillería por dentro.'],
  scene: ['Escena', 'Homelab: dos PCs cliente + punto de acceso + cables. O solo este PC.'],
  ks_ports_list: ['Tipo de cada puerto', 'Lista separada por comas: rj45m, rj45, hdmi, usb, cover (tapa), pass (pasacables), none.'],
  cover_type: ['Tipo de tapa', 'Lisa o pasacables partida (para la pieza keystone_cover).'],
  cover_clear: ['Holgura de la tapa', 'Por cada lado dentro del puerto.'],
  cover_cable_d: ['Diámetro del cable', 'Para la tapa pasacables.'],
  rack_modules: ['Módulos por U', 'De arriba abajo, separados por comas: ms105g, shelf, patch, buttons, vent, blank, cable, led, label.'],
  module_type: ['Módulo a generar', 'Para la pieza rack_module.'],
  ms_w: ['Switch: ancho', 'Mercusys MS105G (COMPROBAR).'],
  ms_h: ['Switch: alto', ''],
  ms_d: ['Switch: fondo', ''],
  mount_clear: ['Holgura del soporte', 'Alrededor del dispositivo.'],
  mount_lip: ['Pestaña de la ventana', 'Lo que la ventana es más pequeña que el frontal del dispositivo.'],
  mount_wall: ['Pared del soporte', ''],
  shelf_depth: ['Fondo de la bandeja', 'Para NanoKVM, Raspberry Pi…'],
  btn_count: ['Botones', 'Solo encendido, o encendido + reset.'],
  mx_cut: ['Hueco MX', 'Hueco cuadrado para interruptores compatibles Cherry MX (14 mm).'],
  mx_plate_t: ['Placa MX', 'Grosor donde enganchan los clips del interruptor (1,5 mm).'],
  led_d: ['Tamaño del LED', '3 o 5 mm.'],
  led_style: ['Estilo de LED', 'Anillo (asoma), halo alrededor de la tecla o brillo oculto a través del plástico.'],
  led_protrude: ['LED asoma', 'Cuánto sobresale la cúpula del LED (estilo anillo).'],
};

export function stepHelp(key) {
  return STEP_HELP[key]?.[lang] ?? STEP_HELP[key]?.en ?? '';
}

export function optionHelp(key) {
  return OPTION_HELP[key]?.[lang] ?? OPTION_HELP[key]?.en ?? '';
}

export function paramLabel(p) {
  return (lang === 'es' && PARAM_ES[p.name]?.[0]) || humanize(p.name);
}

export function paramHelp(p) {
  return (lang === 'es' && PARAM_ES[p.name]?.[1]) || p.desc || '';
}

// bill-of-materials lines come from OpenSCAD in English
const BOM_ES = [
  [/^rack accessories:/, 'Accesorios del rack:'], [/^filler panels:/, 'Relleno:'], [/^drive bay:/, 'Bahía:'],
  [/^keystones:/, 'Keystones:'], [/^zip ties:/, 'Bridas:'], [/^buttons:/, 'Botonera:'],
  [/button head/g, 'cabeza botón'], [/socket head/g, 'allen'], [/countersunk/g, 'avellanado'], [/pan head/g, 'cabeza alomada'],
  [/heat-set insert/g, 'inserto térmico'], [/hex nut/g, 'tuerca hexagonal'], [/square nut/g, 'tuerca cuadrada'], [/\(hole /g, '(agujero '],
  [/metal \/ shielded RJ45 keystone/g, 'keystone RJ45 metálico / apantallado'], [/RJ45 keystone/g, 'keystone RJ45'],
  [/HDMI keystone/g, 'keystone HDMI'], [/USB keystone/g, 'keystone USB'],
  [/printed keystone cover/g, 'tapa de keystone impresa'], [/printed cable pass-through cover/g, 'tapa pasacables impresa'],
  [/cable tie \(holds the device\)/g, 'brida (sujeta el dispositivo)'],
  [/Cherry MX compatible keyboard switch \+ 1u keycap/g, 'interruptor de teclado compatible Cherry MX + tecla 1u'],
  [/\(power, reset\)/g, '(encendido, reset)'], [/\(power\)/g, '(encendido)'],
  [/dome LED \(power, disk activity\) \+ front-panel header wires/g, 'LED (encendido, actividad de disco) + cables al panel frontal de la placa'],
  [/^rear slots:/, 'Ranuras traseras:'], [/^fan:/, 'Ventilador:'], [/^fans:/, 'Ventiladores:'],
  [/printed PCI-slot bracket/g, 'chapa de ranura PCI impresa'], [/\(network cables, power cable\)/g, '(cables de red, cable de corriente)'],
  [/\(network cables\)/g, '(cables de red)'], [/\(power cable\)/g, '(cable de corriente)'],
  [/\+ the case's slot screws/g, '+ los tornillos de las ranuras de la caja'],
  [/80 mm fan \(80 x 80 x 25\) \+ 4 x fan screws/g, 'ventilador de 80 mm (80 x 80 x 25) + 4 tornillos de ventilador'],
  [/40 mm fan \(40 x 40 x 10\) \+ 4 x M3 x 12 screws/g, 'ventilador de 40 mm (40 x 40 x 10) + 4 tornillos M3 x 12'],
];

const WARN_ES = [
  [/^preview case (.+) - approx\. (.+) mm, (\d+) x 5\.25in bays$/, 'Caja de la vista: $1 (aprox. $2 mm, $3 bahías de 5,25")'],
  [/^rack panels overlap the case front by (.+)mm above and below the bezel$/, 'Los paneles montan $1 mm sobre el frontal por encima y por debajo del bisel'],
  [/^part is taller than 250 mm - check your print bed$/, 'La pieza mide más de 250 mm de alto: comprueba que cabe en tu cama'],
  [/^units do not fit in the frame - lower units_override or use overhang$/, 'Las U no caben en el marco: baja units_override o usa «Sobresale»'],
  [/^bay screw holes are deeper than the sleeve - raise sleeve_depth$/, 'Los agujeros de la bahía quedan más hondos que la funda: sube sleeve_depth'],
  [/^the adapter needs (\d+) bays but the (.+) has (\d+)$/, 'El adaptador necesita $1 bahías y la $2 solo tiene $3'],
];

export function warnText(line) {
  return lang === 'es' ? WARN_ES.reduce((acc, [re, to]) => acc.replace(re, to), line) : line;
}

export function bomText(line) {
  const s = line.replace(/ {2}\+ {2}/g, ' + ');
  return lang === 'es' ? BOM_ES.reduce((acc, [re, to]) => acc.replace(re, to), s) : s;
}

// bay2rack - Spare-zone fills: keystone, vent, cable, label, buttons, fans
// Part of bay2rack.scad (included after the parameters). License: CC BY-NC-SA 4.0

// ---------------------------------------------------------------------
//  Fills (local zone: x centred, z in [0,h], plate y in [-t,0])
//  fill_add = material added behind the plate (keystone holder cells)
//  fill_cut = everything cut out of the plate
// ---------------------------------------------------------------------
// types / names: the ports of this patch panel (a patch module has its own), text: what this label says
module fill_add(type, w, h, t, types = ks_types) {
    if (type == "keystone") keystone_add(min(w, 2 * x_in - 1), h, t, types);
    else if (type == "buttons") buttons_add(w, h, t);
}

module fill_cut(type, w, h, t, types = ks_types, names = PORT_NAMES, text = label_text) {
    if (type == "keystone") keystone_cut(min(w, 2 * x_in - 1), h, t, types, names);
    else if (type == "vent")  vent_cut(w, h, t);
    else if (type == "cable") cable_cut(w, h, t);
    else if (type == "label") label_cut(w, h, t, text);
    else if (type == "buttons") buttons_cut(w, h, t);
    else if (type == "fan80") fan80_cut(w, h, t);
    else if (type == "fan40") fan40_cut(w, h, t);
}

// ---------------------------------------------------------------------
//  Keystones
//  metal    = holder cell for metal / shielded keystones, replicated from
//             the original bay adapter: 15 x 16.5 front opening, latch
//             ramp, 24.3 mm cavity and rear lips that catch the jack
//             (the jack goes in from the back).
//  standard = plain cut-out for plastic snap-in keystones.
//  Port types (ks_types): rj45m -> metal cell; rj45 / hdmi / usb ->
//  standard cut-out; cover / pass -> the panel's ks_style; none -> no hole.
// ---------------------------------------------------------------------
function ks_metal_port(tp) = tp == "rj45m" || ((tp == "cover" || tp == "pass") && ks_style == "metal");
// a panel with any metal port lays all its ports out in the bigger metal cells (m = that, per panel)
function ks_metal_of(types) = len([for (tp = types) if (ks_metal_port(tp)) 1]) > 0;
ksm_vc   = ksm_chamfer + ksm_face_h / 2;            // opening centre above the cavity floor
function ks_cw_of(m) = m ? ksm_w + 2 * ks_fit + 2 * ksm_wall : ks_w + 2 * ks_fit + 3;   // cell width
function ks_lo_of(m) = m ? -ksm_vc - ks_fit - ksm_wall : -(ks_h + 2 * ks_fit + 7) / 2;  // cell bottom from opening centre
function ks_hi_of(m) = m ? ksm_cav_h + ks_fit + ksm_wall - ksm_vc : (ks_h + 2 * ks_fit + 7) / 2;
function ks_px_of(m) = m ? ksm_pitch : ks_pitch;
function ks_label_dz_of(m) = (m ? ksm_face_h : ks_h) / 2 + 3.0;
// the ports of the strip's patch panel (ks_ports_list)
ks_metal = ks_metal_of(ks_types);
ks_cw    = ks_cw_of(ks_metal);
ks_lo    = ks_lo_of(ks_metal);
ks_hi    = ks_hi_of(ks_metal);
ks_px    = ks_px_of(ks_metal);

// port positions [x, z of the opening centre, number, index] or [] if they do not fit
function ks_layout(w, h, ports, m = ks_metal) =
    let(cw = ks_cw_of(m), px = ks_px_of(m), lo = ks_lo_of(m), hi = ks_hi_of(m),
        per_row = max(1, floor((w - cw) / px) + 1),
        rows = ceil(ports / per_row),
        cell_v = hi - lo + 1,
        need = rows * cell_v + 1)
    (ports < 1 || need > h || cw > w) ? [] :
    [for (r = [0 : rows - 1])
        let(n = min(per_row, ports - r * per_row),
            zb = h / 2 + ((rows - 1) / 2 - r) * cell_v,
            zc = zb - (hi + lo) / 2)
        for (i = [0 : n - 1]) [(i - (n - 1) / 2) * px, zc, ks_label_start + r * per_row + i, r * per_row + i]];
function ks_layout_of(w, h, types) = ks_layout(w, h, len(types), ks_metal_of(types));

module ks_check(w, h, types)
    if (len(types) > 0 && len(ks_layout_of(w, h, types)) == 0)
        echo(str("WARNING: ", len(types), " keystones do not fit in ", round(w * 10) / 10, " x ", round(h * 10) / 10, " mm - skipped"));

module keystone_add(w, h, t, types = ks_types)
    if (ksm_depth > t) let(m = ks_metal_of(types), cw = ks_cw_of(m), lo = ks_lo_of(m), hi = ks_hi_of(m))
        for (p = ks_layout_of(w, h, types)) if (ks_metal_port(types[p[3]]))
            translate([p[0] - cw / 2, -eps, p[1] + lo]) cube([cw, ksm_depth - t + eps, hi - lo]);

// void of one metal holder cell: profile (cavity height v, depth d from the front face)
module ksm_void(t) {
    v = [[ksm_chamfer, -1], [ksm_chamfer + ksm_face_h, -1], [ksm_chamfer + ksm_face_h, 0],
         [ksm_cav_h, ksm_ramp_d], [ksm_cav_h, ksm_lip_d],
         [ksm_cav_h - ksm_lip_top, ksm_lip_d], [ksm_cav_h - ksm_lip_top, ksm_depth + 1],
         [ksm_lip_bot, ksm_depth + 1], [ksm_lip_bot, ksm_lip_d],
         [0, ksm_lip_d], [0, ksm_chamfer], [ksm_chamfer, 0]];
    // 2D (y, z) -> 3D, extruded along X
    // ks_fit grows the whole cavity (opening, latch room, lips) by the same amount on every side
    translate([-ksm_w / 2 - ks_fit, 0, 0]) multmatrix([[0, 0, 1, 0], [1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0, 1]])
        linear_extrude(ksm_w + 2 * ks_fit) offset(delta = ks_fit) polygon([for (p = v) [p[1] - t, p[0] - ksm_vc]]);
}

// what is written over each port: its name (ks_names, or the patch module's own), else HDMI / USB / RCA / AUDIO /
// OPTICAL for those jacks, else the number of its place (covers, pass-throughs and empty places show nothing)
function ks_type_name(tp) = tp == "hdmi" ? "HDMI" : tp == "usb" ? "USB" : tp == "rca" ? "RCA"
                          : tp == "jack" ? "AUDIO" : tp == "toslink" ? "OPTICAL" : "";
PORT_NAMES = split_keep(ks_names);
function ks_name(i, names = PORT_NAMES) = i < len(names) ? names[i] : "";
function ks_jack(tp) = tp != "cover" && tp != "pass" && tp != "none";
function ks_label(types, i, names = PORT_NAMES) =
    ks_name(i, names) != "" ? ks_name(i, names)
  : ks_type_name(types[i]) != "" ? ks_type_name(types[i])
  : ks_jack(types[i]) ? str(ks_label_start + len([for (j = [0 : 1 : i - 1]) if (ks_jack(types[j])) 1]))
  : "";
// letters shrink so a long name still fits over its port
function ks_label_size(s, m = ks_metal) = min(3.2, (ks_px_of(m) - 3) / (0.7 * max(1, len(s))));
ks_label_d = 0.6;
module ks_labels2d(w, h, types = ks_types, names = PORT_NAMES) let(m = ks_metal_of(types))
    for (p = ks_layout_of(w, h, types)) let(s = ks_label(types, p[3], names)) if (s != "")
        translate([p[0], p[1] + ks_label_dz_of(m)]) legend2d(s, ks_label_size(s, m));
// small engraved letters, a little bolder so their strokes do not close up with a 0.4 mm nozzle (face-down print)
module legend2d(s, size) offset(r = 0.1) text(s, size = size, font = "Liberation Sans:style=Bold", halign = "center", valign = "center");

module keystone_cut(w, h, t, types = ks_types, names = PORT_NAMES) {
    ks_check(w, h, types);
    for (p = ks_layout_of(w, h, types)) if (types[p[3]] != "none") translate([p[0], 0, p[1]]) {
        if (ks_metal_port(types[p[3]])) ksm_void(t);
        else {
            xz_extrude(-t - eps, t + 2 * eps) square([ks_w + 2 * ks_fit, ks_h + 2 * ks_fit], center = true);
            if (t > ks_plate_t + 0.2)
                xz_extrude(-t + ks_plate_t, t - ks_plate_t + 2 * eps) square([ks_w + 2 * ks_fit + 3, ks_h + 2 * ks_fit + 7], center = true);
        }
    }
    if (ks_labels) xz_extrude(-t - eps, ks_label_d + eps) ks_labels2d(w, h, types, names);
}

// ---------------------------------------------------------------------
//  Other fills
// ---------------------------------------------------------------------
// Vents, every style printable face-down without supports, inside a rounded field with a solid rim:
//   slots   = vertical rounded slots (the look of the NanoKVM bay)
//   louvres = horizontal slots cut at 45 deg through the plate: air passes, you don't see inside
//   hex     = honeycomb
//   dots    = staggered round holes
module vent_cut(w, h, t) {
    fw = w - 2 * vent_margin;                      // the vented field
    fh = h - 2 * max(3, vent_margin * 0.6);
    if (fw > 8 && fh > 6) {
        if (vent_style == "louvres") {
            n = floor((fh - 2) / 5);
            for (i = [0 : 1 : n - 1]) let(z = h / 2 + (i - (n - 1) / 2) * 5)
                hull() for (k = [0, 1]) translate([0, -t - eps + k * (t + 2 * eps), z - t / 2 + k * t])
                    rotate([90, 0, 0]) mirror([0, 0, 1]) linear_extrude(0.01) rslot2d(fw, 2.4);
        } else xz_extrude(-t - eps, t + 2 * eps) translate([0, h / 2]) intersection() {
            offset(r = 3) offset(delta = -3) square([fw, fh], center = true);
            if (vent_style == "hex" || vent_style == "dots") {
                // only whole holes: rows and columns that fit, centred, every other row shifted half a pitch
                hex = vent_style == "hex";
                p = hex ? 7.2 : 6;                      // hex: 6 mm across flats, 1.2 mm webs.  dots: 4 mm holes
                r0 = hex ? 6 / 2 / cos(30) : 2;         // hole radius (hex: to its corners)
                rows = max(1, floor((fh - 2 * r0) / (p * 0.866)) + 1);
                cols = max(1, floor((fw - 2 * r0 - p / 2) / p) + 1);
                for (r = [0 : rows - 1], c = [0 : cols - 1])
                    translate([(c - (cols - 1) / 2) * p + (r % 2 == 0 ? -p / 4 : p / 4), (r - (rows - 1) / 2) * p * 0.866])
                        if (hex) rotate(30) circle(r = r0, $fn = 6); else circle(r = r0, $fn = 20);
            } else {
                n = floor((fw - 3) / 6) + 1;
                for (i = [0 : 1 : n - 1]) translate([(i - (n - 1) / 2) * 6, 0])
                    hull() for (z = [-fh / 2 + 1.5, fh / 2 - 1.5]) translate([0, z]) circle(d = 3, $fn = 16);
            }
        }
    }
}

module cable_cut(w, h, t)
    xz_extrude(-t - eps, t + 2 * eps) translate([0, h / 2]) rslot2d(min(w - 12, 110), min(h - 8, 14));


// engraved = the letters cut into the panel; raised = a band round the text is cut away and the letters
// stay at the panel face (raised relief that still prints face-down, flat, without supports)
module label_text2d(w, h, text = label_text) {
    sz = label_size > 0 ? label_size : min(h * 0.4, 9);
    x = (label_align == "left" ? -w / 2 + 4 : label_align == "right" ? w / 2 - 4 : 0) + label_dx;
    translate([x, h / 2 + label_dz])
        text(text, size = sz, font = str("Liberation Sans", label_bold ? ":style=Bold" : ""),
             halign = label_align, valign = "center");
}
label_d = min(label_depth, max(filler_t, panel_t) - 0.8);
module label_cut(w, h, t, text = label_text) {
    sz = label_size > 0 ? label_size : min(h * 0.4, 9);
    xz_extrude(-t - eps, label_d + eps) intersection() {
        translate([-w / 2 + 1, 1]) square([w - 2, h - 2]);         // never past the zone
        // raised: the band round the text is cut; in multicolour the letters go too (the label piece fills them)
        if (label_relief == "raised") difference() {
            offset(r = sz * 0.35) hull() label_text2d(w, h, text);
            if (!labels_multicolour || (t == ft && filler_mode != "separate")) label_text2d(w, h, text);
        }
        else label_text2d(w, h, text);
    }
}

// ---------------------------------------------------------------------
//  Multicolour labels: the letters as a separate body, exactly where they are cut out of the panel, so a
//  multi-material printer prints them in another filament (load both STLs as one object)
// ---------------------------------------------------------------------
module fill_labels(type, w, h, t, types = ks_types, names = PORT_NAMES, text = label_text) {
    if (type == "keystone" && ks_labels) xz_extrude(-t, ks_label_d) ks_labels2d(min(w, 2 * x_in - 1), h, types, names);
    else if (type == "label") xz_extrude(-t, label_d) intersection() {
        translate([-w / 2 + 1, 1]) square([w - 2, h - 2]);
        label_text2d(w, h, text);
    }
    else if (type == "buttons") xz_extrude(-t, 0.6) btn_legends2d(w, h);
}

// ---------------------------------------------------------------------
//  Button panel: keyboard switches for power / reset + power and HDD LEDs
//  Everything is cut into the front or added behind it, so the panel still
//  prints front face down without supports.
// ---------------------------------------------------------------------
led_body = led_d >= 5 ? 8.6 : 5.3;                  // dome LED: flange to tip
led_flange = led_d + 0.9;
halo_gap = 2.6;                                     // key cut-out to the light ring
halo_w = 1.2;

// [keys [[x, z, kind]], leds [[x, z, kind]]] in a w x h zone
function btn_layout(w, h) =
    let(zc = h / 2 + 3, two = btn_count >= 2)
    [two ? [[-36, zc, "power"], [36, zc, "reset"]] : [[-16, zc, "power"]],
     led_style == "halo" ? (two ? [[-36, zc, "power"], [36, zc, "hdd"]] : [[-16, zc, "power"]])
                         : (two ? [[-12, zc, "power"], [12, zc, "hdd"]] : [[8, zc, "power"], [26, zc, "hdd"]])];

module icon2d(kind, s) {
    if (kind == "power") {
        difference() { circle(d = s); circle(d = s * 0.72); translate([-s * 0.16, 0]) square([s * 0.32, s]); }
        translate([-s * 0.08, -s * 0.05]) square([s * 0.16, s * 0.6]);
    } else if (kind == "reset") {
        difference() { circle(d = s); circle(d = s * 0.72); polygon([[0, 0], [s, s * 0.2], [s, s]]); }
        translate([s * 0.42, s * 0.12]) polygon([[-s * 0.2, 0], [s * 0.2, 0], [0, s * 0.32]]);
    } else {   // hdd: a disk drum
        difference() { offset(r = s * 0.12) square([s * 0.75, s * 0.85], center = true);
                       offset(r = s * 0.06) square([s * 0.55, s * 0.65], center = true); }
        translate([0, -s * 0.18]) circle(d = s * 0.22);
    }
}

// ---- what goes where, for each button type -----------------------------------------------------
//   mx    = keyboard switches (Cherry MX) + keycaps, power and HDD LEDs
//   metal = the round metal PC push buttons you buy (anti-vandal, nut behind; the power one has its own LED ring)
//   retro = a 90s PC front: printed POWER / RESET (/ TURBO) buttons on 12 x 12 tactile switches held by a
//           printed carrier behind the panel, POWER / HDD (/ TURBO) LEDs, engraved labels and pinstripes
// keys [x, z, kind, w, h] (w, h: retro cap size), leds [x, z, kind]
rt_zc = 2;                                          // retro row above the zone centre (labels go under it)
RT_CAPS = [["power", 24, 14], ["reset", 12, 8], ["turbo", 12, 8]];
function rt_cap(kind) = [for (c = RT_CAPS) if (c[0] == kind) c][0];
// right to left: the big POWER, RESET, TURBO; then the LEDs POWER - TURBO - HDD (left to right) and pinstripes
function rt_keys(h) = let(zc = h / 2 + rt_zc)
    concat([[37, zc, "power", 24, 14]], btn_count >= 2 ? [[11, zc, "reset", 12, 8]] : [],
           btn_turbo ? [[btn_count >= 2 ? -7 : 11, zc, "turbo", 12, 8]] : []);
function rt_left(h) = min([for (k = rt_keys(h)) k[0] - k[3] / 2]) - 2.4;       // left edge of the buttons + collar
rt_post_d = 8.2;                                     // carrier posts: 2 mm of wall round the M3 insert
function rt_posts(h) = [[rt_left(h) - 4.7, h / 2 + rt_zc], [37 + 12 + 2.4 + 4.7, h / 2 + rt_zc]];   // carrier screws
function rt_leds(h) = let(n = btn_turbo ? 3 : 2, x1 = rt_posts(h)[0][0] - 3.5 - 7.5, zc = h / 2 + rt_zc)
    [for (i = [0 : n - 1]) [x1 - (n - 1 - i) * 12, zc + 1, btn_turbo ? ["power", "turbo", "hdd"][i] : ["power", "hdd"][i]]];
function btn_keys(w, h) =
    btn_type == "retro" ? rt_keys(h)
  : btn_type == "metal" ? let(zc = h / 2 + 2) (btn_count >= 2 ? [[-30, zc, "power"], [30, zc, "reset"]] : [[-16, zc, "power"]])
  : btn_layout(w, h)[0];
function btn_leds(w, h) =
    btn_type == "retro" ? rt_leds(h)
  : btn_type == "metal" ? [[btn_count >= 2 ? 0 : 16, h / 2 + 2, "hdd"]]
  : [for (k = btn_layout(w, h)[1]) [k[0], led_style == "halo" ? k[1] - mx_cut / 2 - halo_gap - halo_w / 2 : k[1], k[2]]];
// the halo needs a keyboard switch; the other buttons take a plain LED ring instead
btn_led_style = btn_type != "mx" && led_style == "halo" ? "ring" : led_style;

// the room a button panel needs, w x h
function btn_need() = btn_type == "retro" ? [118, 30] : btn_type == "metal" ? [btn_count >= 2 ? 90 : 60, btn_metal_d + 12]
                    : [btn_count >= 2 ? 100 : 60, mx_cut + 13];
function btn_fits(w, h) = h >= btn_need()[1] && w >= btn_need()[0];
module buttons_check(w, h) {
    need = btn_need();
    if (!btn_fits(w, h))
        echo(str("WARNING: the button panel needs about ", need[0], " x ", need[1], " mm, this zone is ", round(w * 10) / 10, " x ", round(h * 10) / 10, " mm"));
}

// LED holder tube behind the plate
module led_tube(k) translate([k[0], -eps, k[1]]) rotate([-90, 0, 0]) cylinder(d = led_d + 3.4, h = 8);

// one LED hole (style: ring / halo / glow) with its icon
module led_cut(k, t, style, icon = true) {
    stop = style == "ring" ? led_body - led_protrude : t - 0.6;    // where the LED flange stops, from the front face
    translate([k[0], 0, k[1]]) {
        if (style == "glow") {
            slot_y(led_d + 0.4, 0, -t + 0.6, t + 9);                                     // blind hole, 0.6 mm skin
            xz_extrude(-t - eps, 0.3 + eps) icon2d(k[2] == "hdd" ? "hdd" : "power", 4.4);    // the icon lights up
        } else if (style == "halo") {
            slot_y(led_d + 0.2, 0, -t + 0.4, t + 9);                                     // shines into the ring
        } else {
            slot_y(led_d + 0.25, 0, -t - eps, t + 9);
            translate([0, -t - eps, 0]) rotate([-90, 0, 0]) cylinder(d1 = led_d + 3.2, d2 = led_d + 0.25, h = 1.5);
            xz_extrude(-t - eps, 0.5 + eps) difference() { circle(d = led_d + 6.4); circle(d = led_d + 5.4); }
            if (icon) xz_extrude(-t - eps, 0.6 + eps) translate([0, -led_d / 2 - 6]) icon2d(k[2] == "hdd" ? "hdd" : "power", 4.2);
        }
        slot_y(led_flange + 0.3, 0, -t + max(stop, 0.4), 12);     // wider bore for the LED flange
    }
}

module buttons_add(w, h, t) {
    for (k = btn_leds(w, h)) led_tube(k);
    // retro: two posts with heat-set inserts for the switch carrier
    if (btn_type == "retro") for (p = rt_posts(h)) translate([p[0], -eps, p[1]]) rotate([-90, 0, 0])
        cylinder(d = rt_post_d, h = rt_carrier_y + eps, $fn = 32);
}

module buttons_cut(w, h, t) {
    buttons_check(w, h);
    if (btn_type == "retro") retro_cut(w, h, t);
    else for (k = btn_keys(w, h)) {
        if (btn_type == "metal") {
            translate([k[0], 0, k[1]]) slot_y(btn_metal_d + 0.3, 0, -t - eps, t + 2 * eps);
        } else {
            // MX cut-out through, plate thinned to 1.5 mm from behind so the clips catch
            xz_extrude(-t - eps, t + 2 * eps) translate([k[0], k[1]]) square(mx_cut, center = true);
            if (t > mx_plate_t + 0.1)
                xz_extrude(-t + mx_plate_t, t - mx_plate_t + 2 * eps) translate([k[0], k[1]]) square(mx_cut + 1.6, center = true);
            if (led_style == "halo") {   // light ring with four corner bridges
                xz_extrude(-t - eps, t + 2 * eps) translate([k[0], k[1]]) difference() {
                    square(mx_cut + 2 * (halo_gap + halo_w), center = true);
                    square(mx_cut + 2 * halo_gap, center = true);
                    for (sx = [-1, 1], sz = [-1, 1]) translate([sx * (mx_cut / 2 + halo_gap), sz * (mx_cut / 2 + halo_gap)])
                        square(2 * halo_w + 1.2, center = true);
                }
            }
        }
    }
    for (k = btn_leds(w, h)) led_cut(k, t, btn_led_style, false);
    xz_extrude(-t - eps, 0.6 + eps) btn_legends2d(w, h);
    if (btn_type == "retro") for (p = rt_posts(h)) translate([p[0], rt_carrier_y + eps, p[1]]) rotate([90, 0, 0])
        cylinder(d = hw("M3")[2], h = hw("M3")[3] + 0.3, $fn = 24);     // heat-set inserts for the carrier screws
}

// the engraved icons and names of a button panel (0.6 mm deep): under each key, and under the ring LEDs
module btn_legends2d(w, h) {
    if (btn_type == "retro") {
        for (k = rt_keys(h)) translate([k[0], k[1] - k[4] / 2 - 4.2]) legend2d(upper(k[2]), 2.6);
        for (k = btn_leds(w, h)) translate([k[0], k[1] - led_d / 2 - 5.5]) legend2d(upper(k[2]), 2.1);   // named, not drawn (12 mm apart: no bigger)
    } else {
        for (k = btn_keys(w, h))
            translate([k[0], k[1] - (btn_type == "metal" ? btn_metal_d / 2 + 5.5 : mx_cut / 2 + (led_style == "halo" ? 7.5 : 5.2))])
                icon2d(k[2], 4.6);
        if (btn_led_style == "ring") for (k = btn_leds(w, h))
            translate([k[0], k[1] - led_d / 2 - 6]) icon2d(k[2] == "hdd" ? "hdd" : "power", 4.2);
    }
}

// ---- retro ---------------------------------------------------------------------------------------
// y along the press: cap front 1.5 mm proud of the panel, a 45 deg collar seats it in the back of the
// opening (it centres the cap and keeps it in), the stem reaches the tactile switch in the carrier
rt_collar = 2.4;                                     // 45 deg collar, ends at the back face of the panel
rt_flange = 0.6;
rt_stem = 1.5;
rt_tact = [12, 7.3, 3.6];                            // 12 x 12 tactile switch: size, height to the actuator top, body
rt_carrier_y = rt_flange + rt_stem + 0.2 + rt_tact[1] - rt_tact[2];   // front of the carrier (body of the switch)
rt_switch_y = rt_carrier_y + rt_tact[2];             // switch base
rt_carrier_t = rt_switch_y + 2 - rt_carrier_y;
function upper(s) = chr([for (c = s) let(o = ord(c)) o >= 97 && o <= 122 ? o - 32 : o]);

module rt_opening2d(cw, ch, grow = 0) offset(r = 1.5 + grow) square([cw - 3 + 0.6, ch - 3 + 0.6], center = true);

module retro_cut(w, h, t) {
    zc = h / 2 + rt_zc;
    for (k = rt_keys(h)) translate([k[0], 0, k[1]]) {
        xz_extrude(-t - eps, t + 2 * eps) rt_opening2d(k[3], k[4]);
        // the seat of the collar, widening 45 deg to the back face
        hull() for (g = [0, 1]) translate([0, -min(rt_collar, t - 0.6) + g * (min(rt_collar, t - 0.6) + eps), 0])
            rotate([90, 0, 0]) mirror([0, 0, 1]) linear_extrude(0.01) rt_opening2d(k[3], k[4], g * min(rt_collar, t - 0.6));
    }
    // pinstripes like the beige cases: two across the top, and a block on the left where there is room
    for (z = [h - 3.6, h - 6]) if (z > zc + 9)
        xz_extrude(-t - eps, 0.5 + eps) translate([0, z]) rslot2d(w - 8, 1);
    x1 = min([for (k = rt_leds(h)) k[0]]) - 9;
    if (x1 > -w / 2 + 14) for (i = [0 : 3])
        xz_extrude(-t - eps, 0.6 + eps) translate([(-w / 2 + 5 + x1) / 2, zc + 6 - i * 4]) rslot2d(x1 - (-w / 2 + 5), 1.2);
}

// a printed button: in its own coordinates, front face at z = 0 (prints face-down), the press along +z
module button_cap(kind = btn_cap, t = filler_t) {
    c = rt_cap(kind);
    body = t + 1.5 - min(rt_collar, t - 0.6);
    cl = min(rt_collar, t - 0.6);
    linear_extrude(body) rt_opening2d(c[1] - 0.6, c[2] - 0.6);
    translate([0, 0, body - eps]) hull() {
        linear_extrude(0.01) rt_opening2d(c[1] - 0.6, c[2] - 0.6);
        translate([0, 0, cl]) linear_extrude(0.01) rt_opening2d(c[1] - 0.6, c[2] - 0.6, cl);
    }
    translate([0, 0, body + cl - eps]) linear_extrude(rt_flange + eps) rt_opening2d(c[1] - 0.6, c[2] - 0.6, cl);
    translate([0, 0, body + cl + rt_flange - eps]) cylinder(d = 5, h = rt_stem + eps, $fn = 28);
}

// the carrier with the tactile switches, screwed onto the two posts behind the panel; panel coordinates
// (x across, z up from the zone bottom, y back from the panel back face). Prints back face down.
module button_carrier(h = U - 0.79) {
    P = rt_posts(h);
    x0 = P[0][0] - 4; x1 = P[1][0] + 4;
    zc = h / 2 + rt_zc;
    difference() {
        translate([x0, rt_carrier_y, zc - 8]) cube([x1 - x0, rt_carrier_t, 16]);
        for (k = rt_keys(h)) translate([k[0], 0, zc]) {
            translate([-6.2, rt_carrier_y - eps, -6.2]) cube([12.4, rt_tact[2] + eps, 12.4]);          // the switch body
            for (sx = [-1, 1], sz = [-1, 1]) translate([sx * 6.25, rt_switch_y - 1, sz * 2.5])         // its four legs
                rotate([-90, 0, 0]) cylinder(d = 1.6, h = 4, $fn = 12);
        }
        for (p = P) translate([p[0], rt_carrier_y - 1, p[1]]) rotate([-90, 0, 0]) {
            cylinder(d = 3.4, h = rt_carrier_t + 2, $fn = 20);
            translate([0, 0, rt_carrier_t - 1]) cylinder(d = 6.4, h = 3, $fn = 24);      // screw head
        }
    }
}

// ---------------------------------------------------------------------
//  80 mm fan: round opening (or hex grille) + the four fan screw holes (71.5 mm apart).
//  The fan sits behind the plate; needs a zone at least 82 mm tall (2 bays).
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
//  40 mm fans (fan40_count, 1 to 3) side by side: round openings (or grilles) and the
//  32 mm screw squares. The fans sit behind the plate, between the rack posts.
// ---------------------------------------------------------------------
function fan40_pitch(w) = fan40_count < 2 ? 0 : min(46, (min(w, 2 * x_in - 1) - 40) / (fan40_count - 1));
function fan40_xs(w) = [for (i = [0 : fan40_count - 1]) (i - (fan40_count - 1) / 2) * fan40_pitch(w)];
function fan40_fits(w, h) = h >= 41 && (fan40_count < 2 || fan40_pitch(w) >= 40.3);
module fan40_cut(w, h, t) {
    if (h < 41) echo(str("WARNING: 40 mm fans need a zone at least 41 mm tall, this one is ", round(h * 10) / 10, " mm"));
    else if (fan40_count > 1 && fan40_pitch(w) < 40.3)
        echo(str("WARNING: ", fan40_count, " fans of 40 mm do not fit side by side here - use fewer fans"));
    else for (x = fan40_xs(w)) translate([x, 0, h / 2]) {
        xz_extrude(-t - eps, t + 2 * eps) if (fan_guard == "open") circle(d = 38, $fn = 96);
            else intersection() {
                circle(d = 37, $fn = 72);
                union() for (r = [-4 : 4], c = [-4 : 4]) translate([c * 6 + (abs(r) % 2) * 3, r * 5.2]) circle(d = 4.9, $fn = 6);
            }
        for (sx = [-1, 1], sz = [-1, 1]) translate([sx * 16, 0, sz * 16]) slot_y(3.4, 0, -t - eps, t + 2 * eps);
    }
}

module fan80_cut(w, h, t) {
    if (h < 82 || w < 82) echo(str("WARNING: an 80 mm fan needs an 82 x 82 mm zone, this one is ", round(w * 10) / 10, " x ", round(h * 10) / 10, " mm - use more bays or give this zone more of the height"));
    else translate([0, 0, h / 2]) {
        xz_extrude(-t - eps, t + 2 * eps) if (fan_guard == "open") circle(d = 77, $fn = 144);
            else intersection() {
                circle(d = 76, $fn = 96);
                union() for (r = [-6 : 6], c = [-6 : 6])
                    translate([c * 7 + (abs(r) % 2) * 3.5, r * 6.06]) circle(d = 5.6, $fn = 6);
            }
        for (sx = [-1, 1], sz = [-1, 1]) translate([sx * 35.75, 0, sz * 35.75]) slot_y(4.4, 0, -t - eps, t + 2 * eps);
    }
}

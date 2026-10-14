// bay2rack - Spare-zone fills: keystone, vent, cable, LED, label
// Part of bay2rack.scad (included after the parameters). License: CC BY-NC-SA 4.0

// ---------------------------------------------------------------------
//  Fills (local zone: x centred, z in [0,h], plate y in [-t,0])
//  fill_add = material added behind the plate (keystone holder cells)
//  fill_cut = everything cut out of the plate
// ---------------------------------------------------------------------
module fill_add(type, w, h, t) {
    if (type == "keystone") keystone_add(w, h, t);
    else if (type == "buttons") buttons_add(w, h, t);
}

module fill_cut(type, w, h, t) {
    if (type == "keystone") keystone_cut(w, h, t);
    else if (type == "vent")  vent_cut(w, h, t);
    else if (type == "cable") cable_cut(w, h, t);
    else if (type == "led")   led_cut(w, h, t);
    else if (type == "label") label_cut(w, h, t);
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
ks_metal = len([for (tp = ks_types) if (ks_metal_port(tp)) 1]) > 0;   // layout uses the bigger metal cells
ksm_vc   = ksm_chamfer + ksm_face_h / 2;            // opening centre above the cavity floor
ks_cw    = ks_metal ? ksm_w + 2 * ksm_wall : ks_w + 3;          // cell width
ks_lo    = ks_metal ? -ksm_vc - ksm_wall : -(ks_h + 7) / 2;      // cell bottom from opening centre
ks_hi    = ks_metal ? ksm_cav_h + ksm_wall - ksm_vc : (ks_h + 7) / 2;
ks_px    = ks_metal ? ksm_pitch : ks_pitch;
ks_label_dz = (ks_metal ? ksm_face_h : ks_h) / 2 + 3.0;

// port positions [x, z of the opening centre, number, index] or [] if they do not fit
function ks_layout(w, h, ports) =
    let(per_row = max(1, floor((w - ks_cw) / ks_px) + 1),
        rows = ceil(ports / per_row),
        cell_v = ks_hi - ks_lo + 1,
        need = rows * cell_v + 1)
    (ports < 1 || need > h || ks_cw > w) ? [] :
    [for (r = [0 : rows - 1])
        let(n = min(per_row, ports - r * per_row),
            zb = h / 2 + ((rows - 1) / 2 - r) * cell_v,
            zc = zb - (ks_hi + ks_lo) / 2)
        for (i = [0 : n - 1]) [(i - (n - 1) / 2) * ks_px, zc, ks_label_start + r * per_row + i, r * per_row + i]];

module ks_check(w, h, types)
    if (len(types) > 0 && len(ks_layout(w, h, len(types))) == 0)
        echo(str("WARNING: ", len(types), " keystones do not fit in ", w, " x ", h, " mm - skipped"));

module keystone_add(w, h, t, types = ks_types)
    if (ksm_depth > t)
        for (p = ks_layout(w, h, len(types))) if (ks_metal_port(types[p[3]]))
            translate([p[0] - ks_cw / 2, -eps, p[1] + ks_lo]) cube([ks_cw, ksm_depth - t + eps, ks_hi - ks_lo]);

// void of one metal holder cell: profile (cavity height v, depth d from the front face)
module ksm_void(t) {
    v = [[ksm_chamfer, -1], [ksm_chamfer + ksm_face_h, -1], [ksm_chamfer + ksm_face_h, 0],
         [ksm_cav_h, ksm_ramp_d], [ksm_cav_h, ksm_lip_d],
         [ksm_cav_h - ksm_lip_top, ksm_lip_d], [ksm_cav_h - ksm_lip_top, ksm_depth + 1],
         [ksm_lip_bot, ksm_depth + 1], [ksm_lip_bot, ksm_lip_d],
         [0, ksm_lip_d], [0, ksm_chamfer], [ksm_chamfer, 0]];
    // 2D (y, z) -> 3D, extruded along X
    translate([-ksm_w / 2, 0, 0]) multmatrix([[0, 0, 1, 0], [1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0, 1]])
        linear_extrude(ksm_w) polygon([for (p = v) [p[1] - t, p[0] - ksm_vc]]);
}

module keystone_cut(w, h, t, types = ks_types) {
    ks_check(w, h, types);
    for (p = ks_layout(w, h, len(types))) if (types[p[3]] != "none") translate([p[0], 0, p[1]]) {
        if (ks_metal_port(types[p[3]])) ksm_void(t);
        else {
            xz_extrude(-t - eps, t + 2 * eps) square([ks_w, ks_h], center = true);
            if (t > ks_plate_t + 0.2)
                xz_extrude(-t + ks_plate_t, t - ks_plate_t + 2 * eps) square([ks_w + 3, ks_h + 7], center = true);
        }
        if (ks_labels)
            xz_extrude(-t - eps, 0.6 + eps) translate([0, ks_label_dz])
                text(str(p[2]), size = 3.2, font = "Liberation Sans:style=Bold", halign = "center", valign = "center");
    }
}

// ---------------------------------------------------------------------
//  Other fills
// ---------------------------------------------------------------------
module vent_cut(w, h, t) {
    n = floor((h - 6) / 5);
    if (n > 0) for (i = [0 : n - 1])
        xz_extrude(-t - eps, t + 2 * eps)
            translate([0, h / 2 + (i - (n - 1) / 2) * 5]) rslot2d(w - 12, 2.4);
}

module cable_cut(w, h, t)
    xz_extrude(-t - eps, t + 2 * eps) translate([0, h / 2]) rslot2d(min(w - 12, 110), min(h - 8, 14));

module led_cut(w, h, t) {
    xz_extrude(-t - eps, t + 2 * eps) translate([0, h / 2]) rslot2d(w - 16, 3.2);
    if (t > 1.6)
        xz_extrude(-t + 1.2, t + eps) translate([0, h / 2]) square([w - 12, min(11, h - 4)], center = true);
}

module label_cut(w, h, t)
    xz_extrude(-t - eps, 0.8 + eps) translate([0, h / 2])
        text(label_text, size = min(h * 0.4, 9), font = "Liberation Sans:style=Bold",
             halign = "center", valign = "center");

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

module buttons_check(w, h)
    if (h < mx_cut + 13 || w < (btn_count >= 2 ? 100 : 60))
        echo(str("WARNING: the button panel needs about ", btn_count >= 2 ? 100 : 60, " x ", mx_cut + 13, " mm"));

module buttons_add(w, h, t) {
    L = btn_layout(w, h);
    for (k = L[1]) {
        lz = led_style == "halo" ? k[1] - mx_cut / 2 - halo_gap - halo_w / 2 : k[1];
        // LED holder tube behind the plate
        translate([k[0], -eps, lz]) rotate([-90, 0, 0]) cylinder(d = led_d + 3.4, h = 8);
    }
}

module buttons_cut(w, h, t) {
    buttons_check(w, h);
    L = btn_layout(w, h);
    for (k = L[0]) {
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
        // engraved icon under the key
        xz_extrude(-t - eps, 0.6 + eps) translate([k[0], k[1] - mx_cut / 2 - (led_style == "halo" ? 7.5 : 5.2)])
            icon2d(k[2], 4.6);
    }
    for (k = L[1]) {
        lz = led_style == "halo" ? k[1] - mx_cut / 2 - halo_gap - halo_w / 2 : k[1];
        // where the LED flange stops, measured from the front face
        stop = led_style == "ring" ? led_body - led_protrude : t - 0.6;
        translate([k[0], 0, lz]) {
            if (led_style == "glow") {
                slot_y(led_d + 0.4, 0, -t + 0.6, t + 9);                                   // blind hole, 0.6 mm skin
                xz_extrude(-t - eps, 0.3 + eps) icon2d(k[2] == "hdd" ? "hdd" : "power", 4.4);  // the icon lights up
            } else if (led_style == "halo") {
                slot_y(led_d + 0.2, 0, -t + 0.4, t + 9);                                   // shines into the ring
            } else {
                slot_y(led_d + 0.25, 0, -t - eps, t + 9);
                translate([0, -t - eps, 0]) rotate([-90, 0, 0]) cylinder(d1 = led_d + 3.2, d2 = led_d + 0.25, h = 1.5);
                xz_extrude(-t - eps, 0.5 + eps) difference() { circle(d = led_d + 6.4); circle(d = led_d + 5.4); }
                xz_extrude(-t - eps, 0.6 + eps) translate([0, -led_d / 2 - 6]) icon2d(k[2] == "hdd" ? "hdd" : "power", 4.2);
            }
            // wider bore for the LED flange from the stop to the back of the tube
            slot_y(led_flange + 0.3, 0, -t + max(stop, 0.4), 12);
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
module fan40_cut(w, h, t) {
    if (h < 41) echo(str("WARNING: 40 mm fans need a zone at least 41 mm tall, this one is ", h, " mm"));
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
    if (h < 82 || w < 82) echo(str("WARNING: an 80 mm fan needs an 82 x 82 mm zone, this one is ", w, " x ", h, " mm - use 2 bays"));
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

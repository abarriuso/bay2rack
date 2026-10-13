// bay2rack - Spare-zone fills: keystone, vent, cable, LED, label
// Part of bay2rack.scad (included after the parameters). License: CC BY-NC-SA 4.0

// ---------------------------------------------------------------------
//  Fills (local zone: x centred, z in [0,h], plate y in [-t,0])
//  fill_add = material added behind the plate (keystone holder cells)
//  fill_cut = everything cut out of the plate
// ---------------------------------------------------------------------
module fill_add(type, w, h, t) {
    if (type == "keystone") keystone_add(w, h, t);
}

module fill_cut(type, w, h, t) {
    if (type == "keystone") keystone_cut(w, h, t);
    else if (type == "vent")  vent_cut(w, h, t);
    else if (type == "cable") cable_cut(w, h, t);
    else if (type == "led")   led_cut(w, h, t);
    else if (type == "label") label_cut(w, h, t);
}

// ---------------------------------------------------------------------
//  Keystones
//  metal    = holder cell for metal / shielded keystones, replicated from
//             the original bay adapter: 15 x 16.5 front opening, latch
//             ramp, 24.3 mm cavity and rear lips that catch the jack.
//  standard = plain cut-out for plastic snap-in keystones.
// ---------------------------------------------------------------------
ks_metal = ks_style == "metal";
ksm_vc   = ksm_chamfer + ksm_face_h / 2;            // opening centre above the cavity floor
ks_cw    = ks_metal ? ksm_w + 2 * ksm_wall : ks_w + 3;          // cell width
ks_lo    = ks_metal ? -ksm_vc - ksm_wall : -(ks_h + 7) / 2;      // cell bottom from opening centre
ks_hi    = ks_metal ? ksm_cav_h + ksm_wall - ksm_vc : (ks_h + 7) / 2;
ks_px    = ks_metal ? ksm_pitch : ks_pitch;
ks_label_dz = (ks_metal ? ksm_face_h : ks_h) / 2 + 3.0;

// port positions [x, z of the opening centre, number] or [] if they do not fit
function ks_layout(w, h, ports) =
    let(per_row = max(1, floor((w - ks_cw) / ks_px) + 1),
        rows = ceil(ports / per_row),
        cell_v = ks_hi - ks_lo + 1,
        need = rows * cell_v + 1)
    (need > h || ks_cw > w) ? [] :
    [for (r = [0 : rows - 1])
        let(n = min(per_row, ports - r * per_row),
            zb = h / 2 + ((rows - 1) / 2 - r) * cell_v,
            zc = zb - (ks_hi + ks_lo) / 2)
        for (i = [0 : n - 1]) [(i - (n - 1) / 2) * ks_px, zc, ks_label_start + r * per_row + i]];

module ks_check(w, h, ports)
    if (len(ks_layout(w, h, ports)) == 0)
        echo(str("WARNING: ", ports, " ", ks_style, " keystones do not fit in ", w, " x ", h, " mm - skipped"));

module keystone_add(w, h, t, ports = ks_ports)
    if (ks_metal && ksm_depth > t)
        for (p = ks_layout(w, h, ports))
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

module keystone_cut(w, h, t, ports = ks_ports) {
    ks_check(w, h, ports);
    for (p = ks_layout(w, h, ports)) translate([p[0], 0, p[1]]) {
        if (ks_metal) ksm_void(t);
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

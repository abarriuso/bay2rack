// bay2rack - Spare-zone fills: keystone, vent, cable, LED, label
// Part of bay2rack.scad (included after the parameters). License: CC BY-NC-SA 4.0

// ---------------------------------------------------------------------
//  Fills (local zone: x centred, z in [0,h], plate y in [-t,0])
// ---------------------------------------------------------------------
module fill_cut(type, w, h, t) {
    if (type == "keystone") keystone_cut(w, h, t);
    else if (type == "vent")  vent_cut(w, h, t);
    else if (type == "cable") cable_cut(w, h, t);
    else if (type == "led")   led_cut(w, h, t);
    else if (type == "label") label_cut(w, h, t);
}

module keystone_cut(w, h, t, ports = ks_ports) {
    pw = ks_w + 3;
    ph = ks_h + 7;
    cell = ph + 1;
    per_row = max(1, floor((w - 2) / ks_pitch));
    rows = ceil(ports / per_row);
    need = rows * cell + (ks_labels ? 2 : 0);
    if (need > h || pw > w)
        echo(str("WARNING: ", ports, " keystones need ", need, "mm of height, zone has ", h, "mm - skipped"));
    else for (r = [0 : rows - 1]) {
        n = min(per_row, ports - r * per_row);
        zc = h / 2 + ((rows - 1) / 2 - r) * cell - (ks_labels ? 1 : 0);
        for (i = [0 : n - 1]) {
            x = (i - (n - 1) / 2) * ks_pitch;
            xz_extrude(-t - eps, t + 2 * eps) translate([x, zc]) square([ks_w, ks_h], center = true);
            if (t > ks_plate_t + 0.2)
                xz_extrude(-t + ks_plate_t, t - ks_plate_t + 2 * eps)
                    translate([x, zc]) square([pw, ph], center = true);
            if (ks_labels)
                xz_extrude(-t - eps, 0.6 + eps)
                    translate([x, zc + ks_h / 2 + 3.2])
                        text(str(ks_label_start + r * per_row + i), size = 3.2,
                             font = "Liberation Sans:style=Bold", halign = "center", valign = "center");
        }
    }
}

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

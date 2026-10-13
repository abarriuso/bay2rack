// bay2rack - Filler panels, standalone rack panels and test pieces
// Part of bay2rack.scad (included after the parameters). License: CC BY-NC-SA 4.0

// ---------------------------------------------------------------------
//  Panels (fillers and standalone rack panels), front at y=-t
// ---------------------------------------------------------------------
module panel_holes(zs, t, slot) {
    cs = head_dims("countersunk", R[8]);
    for (s = [-1, 1], z = zs) translate([s * hole_s / 2, 0, z]) {
        slot_y(R[0], slot, -t - eps, t + 2 * eps);
        if (rack_screw_head == "countersunk")
            hull() for (k = [-1, 1]) translate([k * slot / 2, -t - eps, 0]) rotate([-90, 0, 0])
                cylinder(d1 = cs[0] + 0.4, d2 = R[0], h = (cs[0] + 0.4 - R[0]) / 2 + eps);
    }
}

module filler_panel(zn) {
    h = zn[1] - 0.8;
    difference() {
        plate(panel_w, h, filler_t, 0.6);
        panel_holes([h / 2], filler_t, panel_hole_slot);
        fill_cut(zn[2], hole_s - R[0] - 6, h, filler_t);
    }
}

module rack_panel() {
    h = panel_u * U - 0.79;
    zs = [for (u = [0 : panel_u - 1]) for (o = pat(hole_pattern)) u * U + o - 0.395];
    difference() {
        plate(panel_w, h, panel_t, 0.6);
        panel_holes(zs, panel_t, panel_hole_slot);
        fill_cut(panel_fill, hole_s - R[0] - 6, h, panel_t);
    }
}

// ---------------------------------------------------------------------
//  Test pieces
// ---------------------------------------------------------------------
module test_rack() {
    h = 22;
    difference() {
        union() {
            plate(fw, h, ft, frame_chamfer);
            for (s = [-1, 1]) translate([s > 0 ? x_in : -fw / 2, 0, 0]) cube([fw / 2 - x_in, post_d, h]);
        }
        translate([-x_in + 6, -ft - eps, 4]) cube([2 * x_in - 12, ft + 2 * eps, h - 8]);
        for (s = [-1, 1]) {
            if (rack_fixing == "channel") rack_cut_test_channel(s * hole_s / 2, h);
            else rack_cut(s * hole_s / 2, h / 2, s);
        }
    }
}
module rack_cut_test_channel(x, h) {
    sq = R[6] + 0.6;
    translate([x - R[0] / 2 - r_slot / 2, -ft - eps, 2]) cube([R[0] + r_slot, ft + R[7] + 4.5, h]);
    translate([x - sq / 2 - r_slot / 2, 0, 2]) cube([sq + r_slot, R[7] + 0.5, h]);
}

module test_bay() {
    // one right-hand corner: frame strip + wall with the bay holes of one bay
    intersection() {
        adapter();
        translate([x_in - eps, -ft - 1, min(frame_z0, 0) - 1]) cube([fw / 2 - x_in + 1, sleeve_depth + ft + 2, bay_h + 2]);
    }
}

module test_keystone()
    difference() {
        plate(ks_w + 10, ks_h + 14, filler_t, 0.6);
        keystone_cut(ks_w + 10, ks_h + 14, filler_t, 1);
    }

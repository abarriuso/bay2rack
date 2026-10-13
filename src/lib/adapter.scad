// bay2rack - Rack fixings, bay sleeve and front frame = the adapter
// Part of bay2rack.scad (included after the parameters). License: CC BY-NC-SA 4.0

// ---------------------------------------------------------------------
//  Rack fixings
// ---------------------------------------------------------------------
module rack_cut(x, z, sgn) {
    translate([x, 0, z]) {
        if (rack_fixing == "heatset")
            slot_y(R[2], 0, -ft - eps, R[3] + 0.8);
        else if (rack_fixing == "tap")
            slot_y(R[1], 0, -ft - eps, T_post - 1.2);
        else if (rack_fixing == "nut_trap") {
            slot_y(R[0], r_slot, -ft - eps, T_post + 2 * eps);
            hull() for (s = [-1, 1]) translate([s * r_slot / 2, post_d - R[5] - 0.4, 0])
                rotate([-90, 0, 0]) rotate([0, 0, 30]) cylinder(d = (R[4] + 0.3) / cos(30), h = R[5] + 0.4 + 2 * eps, $fn = 6);
        } else if (rack_fixing == "square_nut") {
            sq = R[6] + 0.5;
            slot_y(R[0], r_slot, -ft - eps, T_post - 1.5);
            translate([sgn > 0 ? -(post_in + 1) : -(sq / 2 + r_slot / 2), 1.2, -sq / 2])
                cube([post_in + 1 + sq / 2 + r_slot / 2, R[7] + 0.4, sq]);
        }
    }
}

// continuous T-slot: square nuts slide in from the top, screws at any height
module channel_cut(x) {
    sq = R[6] + 0.6;
    sqt = R[7] + 0.5;
    translate([x - R[0] / 2 - r_slot / 2, -ft - eps, pz0 + 2])
        cube([R[0] + r_slot, ft + sqt + 4, frame_z1 - pz0 - 2 + eps]);
    translate([x - sq / 2 - r_slot / 2, 0, pz0 + 2])
        cube([sq + r_slot, sqt, frame_z1 - pz0 - 2 + eps]);
}

// ---------------------------------------------------------------------
//  Sleeve (the part that goes into the bays)
// ---------------------------------------------------------------------
// window with a 45 deg roof pointing to +Y (= up when printed front-down)
module roof_window2d(a0, a1, y0, y1) {   // a = across, y = depth
    span = a1 - a0;
    yr = y1 - span / 2;
    if (yr > y0 + 2)
        polygon([[a0, y0], [a1, y0], [a1, yr], [(a0 + a1) / 2, y1], [a0, yr]]);
}

module wall_windows() {
    rib = boss_d + 6;
    cuts = concat([post_d + 5], [for (y = bay_ys) each [y - rib / 2, y + rib / 2]], [sleeve_depth - 6]);
    for (k = [0 : bays - 1]) {
        za = k == 0 ? 6 : k * bay_pitch + 3;
        zb = k == bays - 1 ? stack_h - 6 : (k + 1) * bay_pitch - 3;
        for (j = [0 : 2 : len(cuts) - 2])
            if (cuts[j + 1] - cuts[j] > 10 && zb - za > 10)
                for (s = [-1, 1])
                    translate([s > 0 ? sw - wall_t - eps : -sw - eps, 0, 0])
                        // 2D (height, depth) -> 3D (z, y), extruded along X
                        multmatrix([[0, 0, 1, 0], [0, 1, 0, 0], [1, 0, 0, 0], [0, 0, 0, 1]])
                            linear_extrude(wall_t + 2 * eps)
                                roof_window2d(za, zb, cuts[j], cuts[j + 1]);
    }
}

module plate_windows(zz) {
    a0 = -sw + 12; a1 = sw - 12;
    n = max(1, ceil((a1 - a0) / 40));
    wdt = (a1 - a0 - (n - 1) * 6) / n;
    for (i = [0 : n - 1])
        translate([0, 0, zz - eps]) linear_extrude(wall_t + 2 * eps)
            roof_window2d(a0 + i * (wdt + 6), a0 + i * (wdt + 6) + wdt, post_d + 5, sleeve_depth - 6);
}

module bosses() if (bay_fixing != "none" && boss_l > 0)
    for (s = [-1, 1], y = bay_ys, z = bay_zs)
        translate([s * (sw - wall_t) + s * eps, y, z])
            rotate([0, s > 0 ? -90 : 90, 0])
                hull() {
                    for (dy = [-1, 1]) translate([0, dy * b_slot / 2, 0]) cylinder(d = boss_d, h = boss_l);
                    // teardrop towards -Y so it prints without support
                    translate([0, -b_slot / 2 - boss_d * 0.75, 0]) cylinder(d = 0.2, h = boss_l);
                }

module bay_hole_cuts() if (bay_fixing != "none")
    for (s = [-1, 1], y = bay_ys, z = bay_zs)
        translate([s * (sw + eps), y, z]) rotate([0, s > 0 ? -90 : 90, 0]) {
            L = b_len + 2 * eps;
            if (bay_fixing == "heatset")
                cylinder(d = B[2], h = min(B[3] + 0.6, L));
            else {
                d = bay_fixing == "tap" ? B[1] : B[0];
                hull() for (dy = [-1, 1]) translate([0, dy * b_slot / 2, 0]) cylinder(d = d, h = L);
                if (bay_fixing == "nut")
                    hull() for (dy = [-1, 1]) translate([0, dy * b_slot / 2, L - B[5] - 0.4])
                        rotate([0, 0, 30]) cylinder(d = (B[4] + 0.3) / cos(30), h = B[5] + 0.4 + eps, $fn = 6);
            }
        }

module sleeve() {
    difference() {
        for (s = [-1, 1]) translate([s > 0 ? sw - wall_t : -sw, 0, 0]) cube([wall_t, sleeve_depth, stack_h]);
        if (lighten) wall_windows();
    }
    bosses();
    if (sleeve_style == "box")
        for (zz = [0, stack_h - wall_t]) difference() {
            translate([-sw, 0, zz]) cube([2 * sw, sleeve_depth, wall_t]);
            if (lighten) plate_windows(zz);
        }
}

// ---------------------------------------------------------------------
//  Front frame
// ---------------------------------------------------------------------
module posts()
    for (s = [-1, 1])
        translate([s > 0 ? x_in : -sw, 0, pz0]) cube([sw - x_in, post_d, pz1 - pz0]);

// opening between the posts, clipped so the frame keeps a rim
module opening(z0, h) {
    lo = max(z0, frame_z0) + frame_rim;
    hi = min(z0 + h, frame_z1) - frame_rim;
    if (hi - lo > 2)
        translate([-x_in, -ft - eps, lo]) cube([2 * x_in, ft + 2 * eps, hi - lo]);
}

module bezel_groove_cuts() if (bezel_mode && bezel_grooves && bays > 1) {
    gw = max(0.6, bay_pitch - bezel_h1);
    for (k = [1 : bays - 1])
        translate([-fw / 2 - 1, -ft - eps, k * bay_pitch - (bay_pitch - bay_h) / 2 - gw / 2])
            cube([fw + 2, 0.6 + eps, gw]);
}

module adapter() {
    difference() {
        union() {
            translate([0, 0, frame_z0]) plate(fw, frame_h, ft, frame_chamfer);
            posts();
            sleeve();
        }
        if (units > 0) opening(units_z0, units * U);
        for (zn = zones) {
            if (filler_mode == "separate") {
                opening(zn[0], zn[1]);
                if (rack_fixing != "channel")
                    for (s = [-1, 1]) rack_cut(s * hole_s / 2, zn[0] + zn[1] / 2, s);
            } else {
                translate([0, 0, zn[0]]) fill_cut(zn[2], 2 * x_in - 2, zn[1], ft);
            }
        }
        if (rack_fixing == "channel") for (s = [-1, 1]) channel_cut(s * hole_s / 2);
        else for (s = [-1, 1], z = rack_zs) rack_cut(s * hole_s / 2, z, s);
        bay_hole_cuts();
        bezel_groove_cuts();
    }
}

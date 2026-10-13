// bay2rack - Preview only: hardware models, sections, dummy devices, PC tower
// Part of bay2rack.scad (included after the parameters). License: CC BY-NC-SA 4.0

// ---------------------------------------------------------------------
//  Hardware models (preview only).  Built along +Z, z = 0 is the
//  surface the head bears on, the shank goes towards +Z.
// ---------------------------------------------------------------------
STEEL = [0.74, 0.76, 0.79];
BRASS = [0.86, 0.68, 0.26];
NUTC  = [0.58, 0.6, 0.64];

module v_screw(d, L, head) {
    hd = head_dims(head, d);
    color(STEEL) difference() {
        union() {
            if (head == "countersunk") cylinder(d1 = hd[0], d2 = d, h = hd[1]);
            else translate([0, 0, -hd[1]])
                cylinder(d1 = head == "socket" ? hd[0] : hd[0] * 0.78, d2 = hd[0], h = hd[1]);
            cylinder(d = d * 0.96, h = L);
        }
        translate([0, 0, (head == "countersunk" ? 0 : -hd[1]) - eps])
            cylinder(d = d * 0.55, h = min(hd[1], d) * 0.6, $fn = 6);
    }
}

module v_insert(dh, l, d) color(BRASS) difference() {
    union() {
        cylinder(d = dh, h = l);
        for (f = [0.12, 0.55]) translate([0, 0, l * f]) cylinder(d = dh + 0.5, h = l * 0.3);
    }
    translate([0, 0, -eps]) cylinder(d = d, h = l + 2 * eps);
}

module v_hexnut(af, t, d) color(NUTC) difference() {
    rotate([0, 0, 30]) cylinder(d = af / cos(30), h = t, $fn = 6);
    translate([0, 0, -eps]) cylinder(d = d, h = t + 2 * eps);
}

module v_sqnut(w, t, d) color(NUTC) difference() {
    translate([-w / 2, -w / 2, 0]) cube([w, w, t]);
    translate([0, 0, -eps]) cylinder(d = d, h = t + 2 * eps);
}

// one rack fixing: yb = Y of the surface the head bears on
module rack_hw(x, z, yb, L, screw = true)
    translate([x, 0, z]) rotate([-90, 0, 0]) {     // local +Z = global +Y
        if (screw) translate([0, 0, yb - 0.8 * explode]) v_screw(R[8], L, rack_screw_head);
        if (rack_fixing == "heatset")
            translate([0, 0, -ft - 0.4 * explode]) v_insert(R[2], R[3], R[8]);
        else if (rack_fixing == "nut_trap")
            translate([0, 0, post_d - R[5] - 0.2 + 0.6 * explode]) v_hexnut(R[4], R[5], R[8]);
        else if (rack_fixing == "square_nut")
            translate([0, 0, 1.4 + 0.6 * explode]) v_sqnut(R[6], R[7], R[8]);
        else if (rack_fixing == "channel")
            translate([0, 0, 0.25 + 0.6 * explode]) v_sqnut(R[6], R[7], R[8]);
    }

// one bay fixing; local +Z points into the bay, local z = -radius
module bay_hw(s, y, z)
    translate([0, y, z]) rotate([0, s > 0 ? -90 : 90, 0]) {
        translate([0, 0, -(bay_w / 2 + case_wall_t) - explode]) v_screw(B[8], bay_L, bay_screw_head);
        if (bay_fixing == "heatset")
            translate([0, 0, -sw - 0.4 * explode]) v_insert(B[2], B[3], B[8]);
        else if (bay_fixing == "nut")
            translate([0, 0, -sw + b_len - B[5] - 0.2 + 0.6 * explode]) v_hexnut(B[4], B[5], B[8]);
        else if (bay_fixing == "clearance")
            translate([0, 0, -sw + wall_t + 0.6 * explode]) v_hexnut(B[4], B[5], B[8]);
    }

module hardware() {
    for (s = [-1, 1], z = rack_zs)
        rack_hw(s * hole_s / 2, z, -ft - accessory_panel_t - explode, rack_L_dev, show_devices);
    if (filler_mode == "separate")
        for (zn = zones, s = [-1, 1])
            rack_hw(s * hole_s / 2, zn[0] + zn[1] / 2, -ft - filler_t - 2 * explode, rack_L_fill);
    if (bay_fixing != "none")
        for (s = [-1, 1], y = bay_ys, z = bay_zs) bay_hw(s, y, z);
}

// ---------------------------------------------------------------------
//  Assembly preview
// ---------------------------------------------------------------------
sec_z = len(rack_zs) > 0 ? rack_zs[floor(len(rack_zs) / 2)]
      : len(zones) > 0 ? zones[0][0] + zones[0][1] / 2 : frame_z0 + frame_h / 2;

// cut box kept close to the model so "view all" still frames it
sec_x = max(panel_w, fw) / 2 + 15;
sec_y = [-ft - 30 - 3 * explode, sleeve_depth + 100];
sec_zr = [min(frame_z0, units_z0) - 15, max(frame_z1, units_z0 + units * U) + 15];

module section_cut() {
    if (section == "none") children();
    else intersection() {
        children();
        if (section == "rack_row")
            translate([-sec_x, sec_y[0], sec_zr[0]]) cube([2 * sec_x, sec_y[1] - sec_y[0], sec_z - sec_zr[0]]);
        else if (section == "rack_column")
            translate([-sec_x, sec_y[0], sec_zr[0]]) cube([sec_x + hole_s / 2, sec_y[1] - sec_y[0], sec_zr[1] - sec_zr[0]]);
        else
            translate([-sec_x, bay_ys[0], sec_zr[0]]) cube([2 * sec_x, sec_y[1] - bay_ys[0], sec_zr[1] - sec_zr[0]]);
    }
}

module dummy_devices() if (units > 0)
    for (u = [0 : units - 1]) {
        z = units_z0 + u * U + 0.395;
        color([0.18, 0.19, 0.21]) translate([0, -ft - explode, z]) plate(panel_w, U - 0.79, accessory_panel_t, 0.5);
        color([0.05, 0.05, 0.05]) for (i = [0 : 7])
            translate([-52 + i * 13, -ft - accessory_panel_t - 0.1 - explode, z + U / 2 - 6]) cube([10, 0.2, 9]);
        color([0.3, 0.3, 0.32]) translate([-min(2 * x_in - 6, 120) / 2, -ft - explode, z + 6])
            cube([min(2 * x_in - 6, 120), 90, U - 14]);
    }

module case_ghost() {
    % difference() {
        translate([-95, 0.01, -20]) cube([190, 0.8, stack_raw + 40]);
        translate([-bay_w / 2 - 0.5, -1, 0]) cube([bay_w + 1, 3, stack_raw]);
    }
    % for (s = [-1, 1]) translate([s > 0 ? bay_w / 2 : -bay_w / 2 - case_wall_t, 1, 0])
        cube([case_wall_t, 200, stack_raw]);
    if (bezel_mode) % difference() {   // plastic case front the bezel sits flush in
        translate([-fw / 2 - 30, -ft, base_z0 - 25]) cube([fw + 60, ft - 0.02, base_h + 50]);
        translate([-bezel_w / 2, -ft - 1, base_z0 - bezel_clearance / 2]) cube([bezel_w, ft + 2, base_h + bezel_clearance]);
    }
}

// --- preview PC tower ------------------------------------------------
tc_bays  = case_bays > 0 ? max(case_bays, bays) : bays + 1;
tc_extra = tc_bays - bays;                            // covered bays below the adapter
tc_cz0   = -tc_extra * bay_pitch;                     // cage bottom
tc_cz1   = stack_raw;                                 // cage top
TC_W = 215; TC_D = 450;
TC_H = max(470, tc_cz1 - tc_cz0 + 330);
tc_z1 = max(tc_cz1, frame_z1, units_z0 + units * U) + 32;
tc_z0 = tc_z1 - TC_H;
tc_fd = ft;                                           // case front depth: frame front is flush with it
TC_BODY   = [0.24, 0.24, 0.27];
TC_FRONT  = [0.15, 0.15, 0.17];
TC_COVER  = [0.19, 0.19, 0.21];
TC_METAL  = [0.62, 0.64, 0.68, 0.35];

module tower_case() {
    wx = case_window == "left" ? -1 : case_window == "right" ? 1 : 0;
    // body shell, front metal with the cage opening
    color(TC_BODY) difference() {
        translate([-TC_W / 2, 0, tc_z0]) cube([TC_W, TC_D, TC_H]);
        translate([-TC_W / 2 + 1, 1, tc_z0 + 1]) cube([TC_W - 2, TC_D - 2, TC_H - 2]);
        if (wx != 0) translate([wx > 0 ? TC_W / 2 - 2 : -TC_W / 2 - 1, 15, tc_z0 + 15]) cube([3, TC_D - 30, TC_H - 30]);
        translate([-bay_w / 2 - 0.5, -1, tc_cz0 - 0.5]) cube([bay_w + 1, 3, tc_cz1 - tc_cz0 + 1]);
    }
    // drive cage
    color(TC_METAL) {
        for (s = [-1, 1]) translate([s > 0 ? bay_w / 2 : -bay_w / 2 - case_wall_t, 1, tc_cz0])
            cube([case_wall_t, 200, tc_cz1 - tc_cz0]);
        for (zz = [tc_cz0 - case_wall_t, tc_cz1]) translate([-bay_w / 2 - case_wall_t, 1, zz])
            cube([bay_w + 2 * case_wall_t, 200, case_wall_t]);
    }
    // motherboard + PSU, for scale
    color([0.12, 0.32, 0.2]) translate([TC_W / 2 - 22, TC_D - 262, tc_z1 - 30 - 305]) cube([1.6, 244, 305]);
    color([0.1, 0.1, 0.1]) translate([-TC_W / 2 + 6, TC_D - 146, tc_z0 + 4]) cube([150, 140, 86]);
    // plastic front
    color(TC_FRONT) difference() {
        translate([-TC_W / 2, -tc_fd + 0.15, tc_z0 + 8]) cube([TC_W, tc_fd - 0.17, TC_H - 8]);   // 0.15 behind the frame front: no z-fighting
        translate([-fw / 2 - 0.3, -tc_fd - 1, frame_z0 - 0.3]) cube([fw + 0.6, tc_fd + 2, frame_h + 0.6]);
        if (tc_extra > 0) for (k = [1 : tc_extra])
            translate([-bezel_w / 2, -tc_fd - 1, -k * bay_pitch - (bezel_h1 - bay_h) / 2]) cube([bezel_w, tc_fd + 2, bezel_h1]);
        // vents in the lower front
        for (z = [tc_z0 + 30 : 9 : tc_cz0 - 30])
            translate([-TC_W / 2 + 25, -tc_fd - 1, z]) cube([TC_W - 50, 1.6, 4]);
        // power button recess
        translate([TC_W / 2 - 32, -tc_fd - 1, tc_z1 - 16]) rotate([-90, 0, 0]) cylinder(d = 14, h = 1.6);
    }
    // blank covers in the free bays
    color(TC_COVER) if (tc_extra > 0) for (k = [1 : tc_extra])
        translate([0, 0, -k * bay_pitch - (bezel_h1 - bay_h) / 2 + 0.3])
            plate(bezel_w - 0.6, bezel_h1 - 0.6, tc_fd - 0.3, 0.6);
    // power button, front USB, feet
    color([0.75, 0.75, 0.78]) translate([TC_W / 2 - 32, -tc_fd - 0.5, tc_z1 - 16]) rotate([-90, 0, 0]) cylinder(d = 10, h = 1);
    color([0.03, 0.03, 0.03]) for (i = [0, 1]) translate([TC_W / 2 - 70 - i * 18, -tc_fd - 0.3, tc_z1 - 19]) cube([13, 0.4, 5]);
    color([0.05, 0.05, 0.05]) for (x = [-TC_W / 2 + 20, TC_W / 2 - 40], y = [20, TC_D - 40])
        translate([x, y, tc_z0 - 8]) cube([20, 20, 8]);
    // window panel last so it blends over the inside
    if (wx != 0) color([0.6, 0.7, 0.8, 0.18]) translate([wx > 0 ? TC_W / 2 - 1 : -TC_W / 2, 0, tc_z0]) cube([1, TC_D, TC_H]);
}

module assembly() {
    section_cut() color([0.92, 0.55, 0.2]) adapter();
    if (filler_mode == "separate") for (zn = zones)
        section_cut() color([0.25, 0.6, 0.85]) translate([0, -ft - 2 * explode, zn[0] + 0.4]) filler_panel(zn);
    if (show_devices) section_cut() dummy_devices();
    if (show_hardware) section_cut() hardware();
    if (section == "none") {
        if (case_view == "ghost") case_ghost();
        else if (case_view == "tower") tower_case();
    }
}

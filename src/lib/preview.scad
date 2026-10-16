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
        translate([0, 0, 0.3]) cylinder(d = dh - 0.2, h = l - 0.3);
        for (f = [0.2, 0.6]) translate([0, 0, l * f]) cylinder(d = dh + 0.2, h = l * 0.25);
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
        rack_hw(s * hole_s / 2, z, -ft - panel_t - explode, rack_L_dev, show_devices);
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

// --- preview PC tower: real cases ---------------------------------------
// Outer size from the makers' spec sheets (approximate, preview only).
// [id, name, width, height, depth, 5.25in bays, case top to the first bay, front, body colour, front colour]
CASES = [
    ["definer5",     "Fractal Design Define R5",    232, 451, 521,  2, 34, "solid", [0.13, 0.13, 0.14], [0.09, 0.09, 0.10]],
    ["obsidian750d", "Corsair Obsidian 750D",       230, 560, 545,  3, 34, "solid", [0.14, 0.14, 0.15], [0.22, 0.22, 0.24]],
    ["antec300",     "Antec Three Hundred",         205, 470, 465,  3, 22, "mesh",  [0.10, 0.10, 0.11], [0.06, 0.06, 0.07]],
    ["enthoopro",    "Phanteks Enthoo Pro",         235, 535, 550,  3, 36, "solid", [0.11, 0.11, 0.12], [0.08, 0.08, 0.09]],
    ["definexlr2",   "Fractal Design Define XL R2", 232, 560, 560,  4, 34, "solid", [0.13, 0.13, 0.14], [0.09, 0.09, 0.10]],
    ["haf932",       "Cooler Master HAF 932",       230, 605, 548,  5, 40, "mesh",  [0.09, 0.09, 0.10], [0.05, 0.05, 0.06]],
    ["stacker830",   "Cooler Master Stacker 830",   220, 547, 598, 11, 24, "mesh",  [0.70, 0.71, 0.73], [0.60, 0.61, 0.64]]
];
tc_fit = [for (c = CASES) if (c[5] >= bays) c];
tc_sel = [for (c = CASES) if (c[0] == case_model) c];
TC = case_model == "auto" ? (len(tc_fit) > 0 ? tc_fit[0] : CASES[len(CASES) - 1])
   : len(tc_sel) > 0 ? tc_sel[0] : CASES[0];
TC_W = TC[2]; TC_H = TC[3]; TC_D = TC[4];
tc_extra = max(0, TC[5] - bays);                      // covered bays below the adapter
tc_cz1   = stack_raw;                                 // cage top = top of the adapter's top bay
tc_cz0   = -tc_extra * bay_pitch;                     // cage bottom
tc_z1    = tc_cz1 + TC[6];
tc_z0    = tc_z1 - TC_H;
tc_fd    = ft;                                        // case front depth: frame front is flush with it
TC_COVER = [0.17, 0.17, 0.19];
TC_METAL = [0.62, 0.64, 0.68, 0.35];
if (part == "assembly" && case_view == "tower") {
    echo(str("NOTE: preview case ", TC[1], " - approx. ", TC_W, " x ", TC_H, " x ", TC_D, " mm, ", TC[5], " x 5.25in bays"));
    if (bays > TC[5]) echo(str("WARNING: the adapter needs ", bays, " bays but the ", TC[1], " has ", TC[5]));
}

module tower_case() {
    wx = case_window == "left" ? -1 : case_window == "right" ? 1 : 0;
    // body shell, front metal with the cage opening
    color(TC[8]) difference() {
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
        // the tabs the drives rest on (the adapter has grooves for them)
        for (s = [-1, 1], j = [ceil(tc_cz0 / bay_pitch) : floor(tc_cz1 / bay_pitch) + 1], y = [14, 120]) {
            z = j * bay_pitch - (bay_pitch - bay_h) / 2;
            if (z > tc_cz0 + 2 && z < tc_cz1 - 2) translate([s > 0 ? bay_w / 2 - 2.2 : -bay_w / 2, y, z - 0.5]) cube([2.2, 24, 1]);
        }
    }
    // motherboard + PSU, for scale
    color([0.12, 0.32, 0.2]) translate([TC_W / 2 - 22, TC_D - 262, tc_z1 - 30 - 305]) cube([1.6, 244, 305]);
    color([0.1, 0.1, 0.1]) translate([-TC_W / 2 + 6, TC_D - 146, tc_z0 + 4]) cube([150, 140, 86]);
    // plastic front with the bay openings
    color(TC[9]) difference() {
        translate([-TC_W / 2, -tc_fd + 0.15, tc_z0 + 8]) cube([TC_W, tc_fd - 0.17, TC_H - 8]);   // 0.15 behind the frame front: no z-fighting
        translate([-fw / 2 - 0.3, -tc_fd - 1, frame_z0 - 0.3]) cube([fw + 0.6, tc_fd + 2, frame_h + 0.6]);
        if (tc_extra > 0) for (k = [1 : tc_extra])
            translate([-bezel_w / 2, -tc_fd - 1, -k * bay_pitch - (bezel_h1 - bay_h) / 2]) cube([bezel_w, tc_fd + 2, bezel_h1]);
    }
    // front texture: mesh grid or two side intake slits
    yf = -tc_fd - 0.05;
    mz0 = tc_z0 + 22; mz1 = tc_cz0 - 12;
    color([0.02, 0.02, 0.03]) if (TC[7] == "mesh") {
        if (mz1 - mz0 > 10) {
            for (z = [mz0 : 5 : mz1]) translate([-TC_W / 2 + 14, yf, z]) cube([TC_W - 28, 0.1, 2.2]);
            for (x = [-TC_W / 2 + 14 : 6 : TC_W / 2 - 14]) translate([x, yf - 0.05, mz0]) cube([1.2, 0.1, mz1 - mz0]);
        }
    } else {
        for (s = [-1, 1]) translate([s * (TC_W / 2 - 9) - 1, yf, tc_z0 + 20]) cube([2, 0.1, TC_H - 50]);
    }
    // blank covers in the free bays
    color(TC_COVER) if (tc_extra > 0) for (k = [1 : tc_extra])
        translate([0, 0, -k * bay_pitch - (bezel_h1 - bay_h) / 2 + 0.3])
            plate(bezel_w - 0.6, bezel_h1 - 0.6, tc_fd - 0.3, 0.6);
    // power button, front USB, feet
    color([0.75, 0.75, 0.78]) translate([TC_W / 2 - 32, -tc_fd - 0.5, tc_z1 - TC[6] / 2]) rotate([-90, 0, 0]) cylinder(d = 10, h = 1);
    color([0.03, 0.03, 0.03]) for (i = [0, 1]) translate([TC_W / 2 - 70 - i * 18, -tc_fd - 0.3, tc_z1 - TC[6] / 2 - 2.5]) cube([13, 0.4, 5]);
    color([0.05, 0.05, 0.05]) for (x = [-TC_W / 2 + 20, TC_W / 2 - 40], y = [20, TC_D - 40])
        translate([x, y, tc_z0 - 8]) cube([20, 20, 8]);
    // window panel last so it blends over the inside
    if (wx != 0) color([0.6, 0.7, 0.8, 0.18]) translate([wx > 0 ? TC_W / 2 - 1 : -TC_W / 2, 0, tc_z0]) cube([1, TC_D, TC_H]);
}

// --- example devices ------------------------------------------------
// printed parts: exact colours, the web viewer maps them to the chosen filament
PRINT_A = [48, 50, 54] / 255;                         // adapter
PRINT_B = [63, 65, 70] / 255;                         // filler panels
PRINT_C = [77, 79, 84] / 255;                         // rack modules and covers
LABEL_C = [92, 64, 160] / 255;                        // multicolour letters (the web paints them in your label colour)

module rj45_port(x, z, yf) {     // dark socket with the latch notch, front at yf
    color([0.04, 0.04, 0.05]) translate([x - 6, yf - 0.05, z - 4.5]) cube([12, 0.3, 9]);
    color([0.04, 0.04, 0.05]) translate([x - 2.5, yf - 0.05, z + 4.4]) cube([5, 0.3, 2]);
    color([0.8, 0.65, 0.2]) translate([x - 4, yf - 0.1, z + 2.2]) cube([8, 0.1, 1.2]);
}

// Mercusys MS105G: black body, five red ports and the power jack on the front
function ms_ports(zc) = [for (i = [0 : 4]) [-ms_w / 2 + 13 + i * 15.5, zc - 1]];
module ms105g_model(yf, zc) {     // yf = front face, zc = body centre height
    color([0.07, 0.07, 0.08]) translate([-ms_w / 2, yf, zc - ms_h / 2]) cube([ms_w, ms_d, ms_h]);
    for (p = ms_ports(zc)) {
        color([0.86, 0.13, 0.15]) translate([p[0] - 7, yf - 0.1, p[1] - 6.5]) cube([14, 0.2, 13]);
        rj45_port(p[0], p[1], yf - 0.15);
    }
    color([0.02, 0.02, 0.02]) translate([ms_w / 2 - 10, yf - 0.1, zc - 1]) rotate([-90, 0, 0]) cylinder(d = 8, h = 0.3);
    color([0.7, 0.7, 0.7]) translate([ms_w / 2 - 10, yf - 0.2, zc - 1]) rotate([-90, 0, 0]) cylinder(d = 2.2, h = 0.3);
}

// NanoKVM-style KVM over IP box (about 40 x 28 x 40 mm) standing on the shelf
module nanokvm_model(yf, zb, x = -34) {
    color([0.94, 0.94, 0.93]) translate([x - 20, yf, zb]) cube([40, 40, 28]);
    color([0.03, 0.03, 0.04]) translate([x - 16, yf - 0.1, zb + 15]) cube([20, 0.2, 9]);      // OLED
    color([0.35, 0.85, 1]) for (r = [0 : 2]) translate([x - 14, yf - 0.2, zb + 17 + r * 2.4]) cube([10 + (r % 2) * 5, 0.1, 0.9]);
    rj45_port(x + 10, zb + 9, yf - 0.1);
    color([0.1, 0.1, 0.1]) for (dx = [-17, -6]) translate([x + dx, yf - 0.1, zb + 4]) cube([9, 0.2, 3.2]);   // USB-C
}

// JetKVM: black aluminium box with a 1.69in colour touch screen on the front
module jetkvm_model(x, yf, zc) {
    d = jetkvm_dims;
    color([0.08, 0.08, 0.09]) translate([x - d[0] / 2, yf, zc - d[1] / 2]) cube([d[0], d[2], d[1]]);
    color([0.02, 0.02, 0.03]) translate([x - 17, yf - 0.1, zc - 12]) cube([34, 0.2, 24]);
    color([0.36, 0.55, 1.0]) translate([x - 15, yf - 0.2, zc + 4]) cube([30, 0.1, 6]);        // screen UI
    color([0.35, 0.85, 1.0]) translate([x - 15, yf - 0.2, zc - 9]) cube([20, 0.1, 3]);
    color([0.20, 0.95, 0.40]) translate([x + 9, yf - 0.2, zc - 9]) cube([6, 0.1, 3]);
}
// Sipeed NanoKVM Full: white box, small OLED on the front
module nanokvm_front(x, yf, zc) {
    d = nanokvm_dims;
    color([0.94, 0.94, 0.93]) translate([x - d[0] / 2, yf, zc - d[1] / 2]) cube([d[0], d[2], d[1]]);
    color([0.03, 0.03, 0.04]) translate([x - 11, yf - 0.1, zc + 2]) cube([22, 0.2, 10]);
    color([0.35, 0.85, 1.0]) for (r = [0 : 2]) translate([x - 9, yf - 0.2, zc + 4 + r * 2.6]) cube([10 + (r % 2) * 6, 0.1, 1]);
    color([0.02, 0.02, 0.02]) translate([x - 6, yf - 0.1, zc - 11]) cube([12, 0.2, 7]);
}

// any other KVM box: grey body with a status LED
module kvm_custom_model(x, yf, zc) {
    d = kvm_custom;
    color([0.2, 0.21, 0.23]) translate([x - d[0] / 2, yf, zc - d[1] / 2]) cube([d[0], d[2], d[1]]);
    color([0.2, 0.95, 0.4]) translate([x + d[0] / 2 - 7, yf - 0.2, zc + d[1] / 2 - 5]) cube([3, 0.1, 1.5]);
}
module kvm_box_model(b, x, yf, zc) {
    if (b == "jet") jetkvm_model(x, yf, zc);
    else if (b == "nano") nanokvm_front(x, yf, zc);
    else kvm_custom_model(x, yf, zc);
}

// NanoKVM Lite in its bay: black board stack, heatsink on top, Ethernet at u = 0, HDMI + USB-C at u = L
module nkvm_board() {
    L = nkvm_dims[0]; W = nkvm_dims[2]; H = nkvm_dims[1];
    color([0.08, 0.09, 0.1]) cube([L, W, 1.6]);
    color([0.12, 0.13, 0.15]) translate([2, 2, 1.6]) cube([L - 4, W - 4, H - 7]);
    color([0.08, 0.09, 0.1]) translate([0, 0, H - 5.6]) cube([L, W, 1.6]);
    color([0.62, 0.66, 0.7]) for (i = [0 : 4]) translate([L / 2 - 8 + i * 3.6, W / 2 - 7, H - 4]) cube([1.4, 14, 4]);   // heatsink fins
    color([0.62, 0.66, 0.7]) translate([L / 2 - 8.4, W / 2 - 7, H - 4]) cube([16.8, 14, 1]);
    color([0.78, 0.8, 0.82]) translate([-0.6, (W - nkvm_rj45[0]) / 2, nkvm_rj45[2]]) cube([12, nkvm_rj45[0], nkvm_rj45[1]]);   // RJ45
    color([0.75, 0.77, 0.8]) translate([L - 8, W / 2 - 7.5, H - 6.5]) cube([8.6, 15, 5.6]);                                     // HDMI
    color([0.75, 0.77, 0.8]) translate([L - 6, W / 2 - 4.5, 2.4]) cube([6.6, 9, 3.2]);                                           // USB-C
}
// side: standing, the heatsink to the front; front: lying flat
module nkvm_model(lay)
    if (lay == "side") multmatrix([[1, 0, 0, nk_x0()], [0, 0, -1, nk_yd0 + nkvm_dims[1]], [0, 1, 0, nk_zv0], [0, 0, 0, 1]]) nkvm_board();
    else nk_front_frame() translate([0, 0, nk_zf + nk_fl]) nkvm_board();

// Raspberry Pi boards, port edge at y = y0, underside at z = zb
PI_PCB = [18, 77, 41] / 255;                           // the web viewer gives this green a PCB texture
PI_METAL = [189, 194, 201] / 255;                      // shielded jacks: steel
module pi_board_model(b, x0, y0, zb) {
    S = pi_spec(b);
    color(PI_PCB) translate([x0, y0, zb]) cube([S[0], S[1], 1.4]);
    zt = zb + 1.4;
    if (b == "zero") {
        color([0.75, 0.76, 0.78]) translate([x0 + 25, y0 + 8, zt]) cube([15, 14, 2.2]);          // SoC can
        color(PI_METAL) translate([x0 + 6.8, y0 - 0.6, zt]) cube([11.2, 7.5, 3.3]);              // mini HDMI
        for (x = [41.4, 54]) color(PI_METAL) translate([x0 + x - 4, y0 - 1, zt]) cube([8, 5.6, 2.8]);   // micro USB
        color([0.05, 0.05, 0.05]) translate([x0 + 7, y0 + 25, zt]) cube([51, 5, 2.5]);          // GPIO pads / header
    } else {
        eth_x = b == "pi4" ? 45.75 : 10.25;                // Pi 4 has the Ethernet jack on the other side
        usb_x = b == "pi4" ? [9, 27] : [29.1, 47];
        color(PI_METAL) translate([x0 + eth_x - 8, y0 - S[4], zt]) cube([16, 21, 13.5]);
        rj45_port(x0 + eth_x, zt + 6.5, y0 - S[4] - 0.05);
        for (i = [0, 1]) {
            color(PI_METAL) translate([x0 + usb_x[i] - 7.3, y0 - S[4], zt]) cube([14.6, 17.5, 16]);
            for (k = [0, 1]) color(b == "pi3" || (b == "pi4" ? i == 0 : i == 1) ? [0.04, 0.04, 0.05] : [0.12, 0.3, 0.85])
                translate([x0 + usb_x[i] - 6.2, y0 - S[4] - 0.1, zt + 2 + k * 7.6]) cube([12.4, 0.3, 5]);
        }
        color([0.05, 0.05, 0.05]) translate([x0 + S[0] - 6, y0 + 85 - 58, zt]) cube([5, 51, 8.5]);   // GPIO header
        color([0.7, 0.72, 0.75]) translate([x0 + 20, y0 + 85 - 34, zt]) cube([15, 15, 1.4]);    // SoC
        if (b == "pi5") {                                   // active cooler
            color([0.45, 0.47, 0.5]) translate([x0 + 6, y0 + 85 - 62, zt + 1.4]) cube([40, 34, 6]);
            color([0.08, 0.08, 0.09]) translate([x0 + 26, y0 + 85 - 45, zt + 7.4]) cylinder(d = 26, h = 2.5);
        }
    }
}
// blades: the board stands on edge, components towards +X, USB-C edge on top
module pi_blade_models(items, yb, z) {
    L = blade_list(items);
    for (i = [0 : len(L) - 1])
        translate([blade_xb(L, i), 0, z + blade_zb + 56]) multmatrix([[0, 0, 1, 0], [0, 1, 0, 0], [-1, 0, 0, 0], [0, 0, 0, 1]])
            pi_board_model(L[i], 0, yb + pi_spec(L[i])[4] + 0.2, 0);
}
module pi_models(items, yb, z) {
    L = pi_list(items);
    x0 = pi_x0s(items);
    for (i = [0 : len(L) - 1]) pi_board_model(L[i], x0[i], yb + pi_spec(L[i])[4] + 0.2, z + pi_zb);
}

// UniFi USW-Flex-Mini: white body, five ports and USB-C on the port face
module uswflex_model(yf, zc) {
    d = usw_dims;
    color([0.95, 0.95, 0.94]) translate([-d[0] / 2, yf, zc - d[1] / 2]) cube([d[0], d[2], d[1]]);
    for (i = [0 : 4]) rj45_port(-d[0] / 2 + 14 + i * 15, zc, yf - 0.1);
    color([0.1, 0.1, 0.1]) translate([d[0] / 2 - 14, yf - 0.1, zc - 1.6]) cube([9, 0.2, 3.2]);
    color([0.36, 0.55, 1.0]) translate([d[0] / 2 - 6, yf - 0.2, zc + 6]) cube([3, 0.1, 1.2]);
}
// UniFi Express: white rounded box with a small display
module ux_model(yf, zc) {
    d = ux_dims;
    color([0.95, 0.95, 0.94]) translate([-d[0] / 2, yf, zc - d[1] / 2]) cube([d[0], d[2], d[1]]);
    color([0.02, 0.02, 0.03]) translate([-13, yf - 0.1, zc - 6]) cube([26, 0.2, 12]);
    color([0.36, 0.55, 1.0]) translate([-11, yf - 0.2, zc - 1]) cube([16, 0.1, 2.4]);
    color([0.36, 0.55, 1.0]) translate([-30, yf - 0.2, zc - d[1] / 2 + 3]) cube([60, 0.1, 1]);
}

// a generic device box for dev1 / dev2
module dev_model(d, yf, zc) {
    color([0.2, 0.21, 0.23]) translate([-d[0] / 2, yf, zc - d[1] / 2]) cube([d[0], d[2], d[1]]);
    color([0.2, 0.95, 0.4]) translate([d[0] / 2 - 8, yf - 0.2, zc + d[1] / 2 - 5]) cube([3, 0.1, 1.5]);
}

// keystone jack / cover models at a port centre; yf = front face of the panel
module jack_model(tp, yf) {
    if (tp == "rj45m") {
        color([0.72, 0.74, 0.77]) { translate([-7.2, yf + 0.6, -8]) cube([14.4, 9, 16]); translate([-8, yf + 9.6, -10]) cube([16, 22, 22]); }
        color([0.05, 0.05, 0.06]) translate([-5.9, yf + 0.5, -5]) cube([11.8, 0.3, 8.5]);
    } else if (tp == "rj45" || tp == "hdmi" || tp == "usb") {
        color(tp == "rj45" ? [0.95, 0.95, 0.93] : [0.12, 0.12, 0.13]) {
            translate([-7.2, yf + 0.4, -8]) cube([14.4, 26, 16]);
        }
        if (tp == "rj45") color([0.05, 0.05, 0.06]) translate([-5.9, yf + 0.3, -5]) cube([11.8, 0.3, 8.5]);
        if (tp == "hdmi") color([0.75, 0.62, 0.25]) translate([0, yf + 0.3, 1]) rotate([-90, 0, 0])
            linear_extrude(0.3) polygon([[-7, -2.2], [7, -2.2], [7, 0.6], [5.6, 2.2], [-5.6, 2.2], [-7, 0.6]]);
        if (tp == "usb") { color([0.05, 0.05, 0.06]) translate([-6, yf + 0.3, -1.5]) cube([12, 0.3, 5]);
                           color([0.2, 0.35, 0.85]) translate([-5, yf + 0.25, -0.2]) cube([10, 0.3, 1.6]); }
    } else if (tp == "rca" || tp == "jack" || tp == "toslink") {          // audio keystones: black body
        color([0.1, 0.1, 0.11]) translate([-7.2, yf + 0.4, -8]) cube([14.4, 24, 16]);
        if (tp == "rca") {
            color([0.8, 0.66, 0.3]) translate([0, yf + 0.3, 0]) rotate([90, 0, 0]) cylinder(d = 8.4, h = 3.2, $fn = 32);
            color([0.85, 0.15, 0.15]) translate([0, yf + 0.25, 0]) rotate([90, 0, 0]) cylinder(d = 11, h = 0.3, $fn = 32);
            color([0.03, 0.03, 0.03]) translate([0, yf - 2.95, 0]) rotate([90, 0, 0]) cylinder(d = 3.2, h = 0.3, $fn = 16);
        }
        if (tp == "jack") {
            color([0.6, 0.62, 0.65]) translate([0, yf + 0.3, 0]) rotate([90, 0, 0]) cylinder(d = 7, h = 0.4, $fn = 32);
            color([0.03, 0.03, 0.03]) translate([0, yf - 0.15, 0]) rotate([90, 0, 0]) cylinder(d = 3.6, h = 0.3, $fn = 16);
        }
        if (tp == "toslink") color([0.03, 0.03, 0.03]) translate([-3.6, yf + 0.25, -3]) cube([7.2, 0.3, 6]);
    } else if (tp == "cover" || tp == "pass") {
        color(PRINT_C) translate([0, yf - 1.2, 0]) mirror([0, 0, 1]) rotate([-90, 0, 0])
            keystone_cover(tp == "pass" ? "pass" : "blank");
    }
}

// keyboard switch + keycap and the LEDs of a button panel
module buttons_models(w, h, z0, yf) {
    t = 3;
    if (btn_type == "retro") {
        // printed caps (PRINT_C, they print with the modules), the carrier, the black switches
        for (k = rt_keys(h)) color(k[2] == "power" ? [0.86, 0.84, 0.78] : PRINT_C) translate([k[0], yf - 1.5, z0 + k[1]])
            rotate([-90, 0, 0]) button_cap(k[2]);
        color(PRINT_C) translate([0, yf + t, z0]) button_carrier(h);
        for (k = rt_keys(h)) color([0.1, 0.1, 0.11]) translate([k[0] - 6, yf + t + rt_carrier_y, z0 + k[1] - 6]) cube([12, rt_tact[2], 12]);
        for (k = rt_leds(h)) color(k[2] == "power" ? [0.2, 0.95, 0.4] : k[2] == "hdd" ? [1, 0.55, 0.1] : [1, 0.9, 0.2])
            translate([k[0], yf - led_protrude, z0 + k[1]]) rotate([-90, 0, 0]) {
                translate([0, 0, led_d / 2]) cylinder(d = led_d, h = led_body - led_d / 2);
                translate([0, 0, led_d / 2]) sphere(d = led_d);
            }
    } else if (btn_type == "metal") {
        for (k = btn_keys(w, h)) translate([k[0], yf, z0 + k[1]]) rotate([90, 0, 0]) {
            color([0.75, 0.77, 0.8]) cylinder(d = btn_metal_d + 3, h = 1.6);                  // the steel ring
            color([0.68, 0.7, 0.73]) cylinder(d = btn_metal_d - 3, h = 2);                    // the push face
            if (k[2] == "power") color([0.2, 0.55, 1]) translate([0, 0, 1.6]) linear_extrude(0.2)
                difference() { circle(d = btn_metal_d - 1.2); circle(d = btn_metal_d - 2.2); }   // its LED ring
        }
        for (k = btn_leds(w, h)) color([0.2, 0.55, 1]) translate([k[0], yf - led_protrude, z0 + k[1]]) rotate([-90, 0, 0]) {
            translate([0, 0, led_d / 2]) cylinder(d = led_d, h = led_body - led_d / 2);
            translate([0, 0, led_d / 2]) sphere(d = led_d);
        }
    } else mx_models(w, h, z0, yf);
}
module mx_models(w, h, z0, yf) {
    L = btn_layout(w, h);
    for (k = L[0]) translate([k[0], 0, z0 + k[1]]) {
        color([0.18, 0.18, 0.2]) translate([-7, yf - 5, -7]) cube([14, 5 + 6, 14]);
        color(k[2] == "power" ? [0.88, 0.89, 0.9] : [0.32, 0.33, 0.36])
            hull() { translate([-9, yf - 6.5, -9]) cube([18, 0.1, 18]); translate([-6.5, yf - 13.5, -6.5]) cube([13, 0.1, 13]); }
    }
    for (k = L[1]) {
        lc = k[2] == "hdd" ? [0.2, 0.55, 1] : [0.2, 0.95, 0.4];
        lz = led_style == "halo" ? k[1] - mx_cut / 2 - halo_gap - halo_w / 2 : k[1];
        if (led_style == "ring")
            color(lc) translate([k[0], yf - led_protrude, z0 + lz]) rotate([-90, 0, 0]) {
                translate([0, 0, led_d / 2]) cylinder(d = led_d, h = led_body - led_d / 2);
                translate([0, 0, led_d / 2]) sphere(d = led_d);
            }
        else if (led_style == "halo")      // lit ring around the key
            color(lc) translate([k[0], yf - 0.15, z0 + k[1]]) rotate([90, 0, 0]) mirror([0, 0, 1]) linear_extrude(0.2)
                difference() { square(mx_cut + 2 * (halo_gap + halo_w), center = true); square(mx_cut + 2 * halo_gap, center = true); }
        else
            color(lc) translate([k[0], yf - 0.15, z0 + lz]) rotate([90, 0, 0]) mirror([0, 0, 1]) linear_extrude(0.2)
                icon2d(k[2] == "hdd" ? "hdd" : "power", 4.4);
    }
}

// yf = front face of the plate, t = its thickness (the fans sit behind it)
module fill_devices(type, w, h, z0, yf, t = 3) {
    if (type == "keystone")
        for (p = ks_layout(w, h, len(ks_types))) translate([p[0], 0, z0 + p[1]]) jack_model(ks_types[p[3]], yf);
    else if (type == "buttons") buttons_models(w, h, z0, yf);
    else if (type == "fan40" && h >= 41) for (x = fan40_xs(w)) fan_model(40, fan40_t, x, yf + t + 0.2, z0 + h / 2);
    else if (type == "fan80" && h >= 82) fan_model(80, 25, 0, yf + t + 0.2, z0 + h / 2);
}

// the printed rack modules, with their devices
module rack_contents() for (k = [0 : 1 : len(placed_mods) - 1]) if (preview_item == "all" || preview_index == k) {
    m = placed_mods[k][0];
    z = units_z0 + placed_mods[k][1] * U + 0.395;
    yb = -ft - explode;                                // back face of the module plate
    // (outside the module's colour: OpenSCAD's outer color() wins)
    if (labels_multicolour) color(LABEL_C) translate([0, yb, z]) module_labels(m);
    color(PRINT_C + [k, 0, 0] / 255) translate([0, yb, z]) {
        rack_module(m);
        if (mod_kind(m) == "nkvm") translate(nk_layout(mod_items(m)) == "side" ? [0, -explode, 0] : [0, 0, explode]) nkvm_lid(mod_items(m));
    }
    if (demo_devices == "homelab") {
        if (m == "ms105g") ms105g_model(yb + 0.2, z + ms_z0 + ms_ch / 2);
        else if (m == "uswflex") uswflex_model(yb + 0.2, z + tunnel_z0(dev_c(usw_dims)[1]) + dev_c(usw_dims)[1] / 2);
        else if (m == "ux") ux_model(yb + 0.2, z + tunnel_z0(dev_c(ux_dims)[1]) + dev_c(ux_dims)[1] / 2);
        else if (m == "dev1") dev_model(dev1_dims, yb + 0.2, z + tunnel_z0(dev_c(dev1_dims)[1]) + dev_c(dev1_dims)[1] / 2);
        else if (m == "dev2") dev_model(dev2_dims, yb + 0.2, z + tunnel_z0(dev_c(dev2_dims)[1]) + dev_c(dev2_dims)[1] / 2);
        else if (mod_kind(m) == "kvm") {
            L = kvm_list(mod_items(m));
            cs = kvm_cs(mod_items(m));
            xs = kvm_xs(mod_items(m));
            for (i = [0 : len(L) - 1]) kvm_box_model(L[i], xs[i], yb + 0.2, z + tunnel_z0(cs[i][1]) + cs[i][1] / 2);
        }
        else if (mod_kind(m) == "pi") pi_models(mod_items(m), yb, z);
        else if (mod_kind(m) == "piblade") pi_blade_models(mod_items(m), yb, z);
        else if (m == "fan40") fill_devices("fan40", hole_s - R[0] - 6, U - 0.79, z, yb - panel_t, panel_t);
        else if (m == "shelf") nanokvm_model(yb + 6, z + shelf_z + 2);
        else if (mod_kind(m) == "nkvm") translate([0, yb, z]) nkvm_model(nk_layout(mod_items(m)));
        else if (m == "patch") fill_devices("keystone", hole_s - R[0] - 6, U - 0.79, z, yb - panel_t);
        else if (m == "buttons") fill_devices("buttons", hole_s - R[0] - 6, U - 0.79, z, yb - panel_t);
    }
}

// what sits in the spare zone (keystone jacks, keys and LEDs)
zn_sep = filler_mode == "separate";
function zone_w() = zn_sep ? hole_s - R[0] - 6 : 2 * x_in - 2;
function zone_h(zn) = zn_sep ? zn[1] - 0.8 : zn[1];
function zone_z0(zn) = zn_sep ? zn[0] + 0.4 : zn[0];
zone_yf = zn_sep ? -ft - filler_t - 2 * explode : -ft;

module zone_devices() if (demo_devices == "homelab")
    for (zn = zones) fill_devices(zn[2], zone_w(), zone_h(zn), zone_z0(zn), zone_yf, zn_sep ? filler_t : ft);

// assembly() calls rack_contents and zone_devices on their own, so each can be rendered apart (preview_item)

// --- homelab scene: client PCs, access point, network cables ------------
CABLE_D = 5.2;
module cable(pts, c = [0.15, 0.45, 0.9], d = CABLE_D)
    color(c) for (i = [0 : len(pts) - 2]) hull() {
        translate(pts[i]) sphere(d = d, $fn = 10);
        translate(pts[i + 1]) sphere(d = d, $fn = 10);
    }
module plug(p, c) color(c) translate(p) translate([-6, -14, -4.5]) cube([12, 14, 9]);   // RJ45 boot, cable side -Y

// keystone ports of the first patch zone, in world coordinates: [x, z, type]
ks_zone = [for (zn = zones) if (zn[2] == "keystone") zn];
patch_ports = len(ks_zone) == 0 ? [] :
    [for (p = ks_layout(zone_w(), zone_h(ks_zone[0]), len(ks_types))) [p[0], zone_z0(ks_zone[0]) + p[1], ks_types[p[3]]]];
rj_ports = [for (p = patch_ports) if (p[2] == "rj45m" || p[2] == "rj45") p];
pass_ports = [for (p = patch_ports) if (p[2] == "pass") p];
// switches in the rack: the managed UniFi one is the main switch when there are two
function sw_ch(m) = m == "ms105g" ? ms_ch : dev_c(usw_dims)[1];
function sw_zc_of(p) = units_z0 + p[1] * U + 0.395 + tunnel_z0(sw_ch(p[0])) + sw_ch(p[0]) / 2;
sw_list = concat([for (p = placed_mods) if (p[0] == "uswflex") p], [for (p = placed_mods) if (p[0] == "ms105g") p]);
sw_main = len(sw_list) > 0 ? sw_list[0] : undef;
sw_second = len(sw_list) > 1 ? sw_list[1] : undef;
function sw_ports_of(p) = p[0] == "ms105g" ? ms_ports(sw_zc_of(p))
                        : [for (i = [0 : 4]) [-usw_dims[0] / 2 + 14 + i * 15, sw_zc_of(p)]];
function sw_jack_of(p) = p[0] == "ms105g" ? [ms_w / 2 - 10, sw_zc_of(p) - 1] : [usw_dims[0] / 2 - 9.5, sw_zc_of(p)];
sw_yf = -ft - explode + 0.2;

// clients: old towers next to the server, fronts in line with it
CLIENTS = [[185, 420, 440, [0.84, 0.81, 0.73]], [166, 199, 223, [0.10, 0.10, 0.11]]];   // old PC, 4-bay NAS
cl_x = [TC_W / 2 + 70 + CLIENTS[0][0] / 2, TC_W / 2 + 70 + CLIENTS[0][0] + 60 + CLIENTS[1][0] / 2];
ap_pos = [0, TC_D * 0.55, tc_z1];

module client_pc(x, c) {
    W = c[0]; H = c[1]; D = c[2];
    color(c[3]) translate([x - W / 2, -tc_fd, tc_z0]) cube([W, D, H]);

    color([0.2, 0.9, 0.35]) translate([x + W / 2 - 24, -tc_fd - 0.5, tc_z0 + H - 135]) rotate([-90, 0, 0]) cylinder(d = 3, h = 0.6);
    color([0.6, 0.6, 0.62]) translate([x + W / 2 - 36, -tc_fd - 0.5, tc_z0 + H - 135]) rotate([-90, 0, 0]) cylinder(d = 9, h = 0.6);
    color([0.05, 0.05, 0.05]) for (i = [0 : 9]) translate([x - W / 2 + 25, -tc_fd - 0.3, tc_z0 + 30 + i * 9]) cube([W - 50, 0.3, 4]);
}
// the clients reuse bay2rack too: a 1-bay bezel with the button panel and one with vents
CLIENT_FILLS = [["buttons", 1], ["fan80", 2]];                 // [fill, bays], from the top
function client_bay_z(i, k) = tc_z0 + CLIENTS[i][1] - 38 - (k + 1) * bay_pitch;   // bottom of bay k (0 = top)
function client_bezels_at() = [[client_bay_z(0, 0), 1], [client_bay_z(0, 2), 2]];   // [bottom z, bays]
module client_bezel(fill, x, zb, nb = 1) {
    w = bezel_w - bezel_clearance;
    h = (nb - 1) * bay_pitch + bezel_h1 - bezel_clearance;
    t = 8;
    translate([x, -tc_fd + t, zb]) {
        color(PRINT_C) difference() {
            union() { plate(w, h, t, 0.8); fill_add(fill, w - 20, h, t); }
            fill_cut(fill, w - 20, h, t);
        }
        fill_devices(fill, w - 20, h, 0, -t, t);
    }
}
module client_bezels() for (k = [0, 1]) client_bezel(CLIENT_FILLS[k][0], cl_x[0], client_bezels_at()[k][0], CLIENT_FILLS[k][1]);
// square fan of size s and thickness th, front face at y, centred on (x, zc)
// a real axial fan: rounded frame with a round throat and the four screw holes, seven pitched
// blades on a hub with its label, four struts holding the motor at the back
module fan_model(s, th, x, y, zc) {
    k = s / 80;
    r_hub = 15 * k;
    r_tip = s * 0.47 - 0.8;
    translate([x, y, zc]) rotate([-90, 0, 0]) {        // local z = the fan axis, into the case (+Y)
        color([0.07, 0.07, 0.08]) difference() {
            linear_extrude(th) offset(r = 3 * k) square(s - 6 * k, center = true);
            translate([0, 0, -1]) cylinder(r = r_tip + 0.8, h = th + 2, $fn = 96);
            for (sx = [-1, 1], sz = [-1, 1]) translate([sx * (s / 2 - 4.25 * k), sz * (s / 2 - 4.25 * k), -1])
                cylinder(d = 4.3 * k, h = th + 2, $fn = 20);
        }
        color([0.07, 0.07, 0.08]) {
            translate([0, 0, th - 3]) cylinder(r = r_hub + 1, h = 3, $fn = 48);
            for (a = [45 : 90 : 315]) rotate(a) translate([r_hub, -1.2 * k, th - 2.5]) cube([r_tip + 1 - r_hub, 2.4 * k, 2.5]);
        }
        color([0.09, 0.09, 0.1]) translate([0, 0, 1]) cylinder(r = r_hub, h = th - 4, $fn = 64);
        color([0.55, 0.57, 0.6]) translate([0, 0, 0.8]) cylinder(r = r_hub * 0.72, h = 0.3, $fn = 64);
        color([0.11, 0.11, 0.12]) for (i = [0 : 6]) rotate(i * 360 / 7)
            translate([0, 0, 1.5]) linear_extrude(height = th - 5, twist = -28, slices = 6)
                polygon([[r_hub - 1, -3.5 * k], [r_tip, -6 * k], [r_tip, 7.5 * k], [r_hub - 1, 4 * k]]);
    }
}

function client_port(i) = i == 0 ? [cl_x[0] - CLIENTS[0][0] / 2 + 34, CLIENTS[0][2] - tc_fd, tc_z0 + CLIENTS[0][1] - 70]
                               : [cl_x[1] + 30, CLIENTS[1][2] - tc_fd, tc_z0 + 40];

module nas(x, c) {
    W = c[0]; H = c[1]; D = c[2];
    color(c[3]) translate([x - W / 2, -tc_fd, tc_z0]) cube([W, D, H]);
    color([0.18, 0.18, 0.2]) for (i = [0 : 3]) translate([x - W / 2 + 12 + i * 36, -tc_fd - 1, tc_z0 + 14]) cube([33, 1, 150]);
    color([0.2, 0.9, 0.35]) for (i = [0 : 3]) translate([x - W / 2 + 26 + i * 36, -tc_fd - 1.2, tc_z0 + 172]) cube([5, 0.3, 2]);
}

module access_point() {
    color([0.96, 0.96, 0.95]) translate(ap_pos) cylinder(d = 170, h = 32, $fn = 64);
    color([0.96, 0.96, 0.95]) translate(ap_pos + [0, 0, 32]) cylinder(d1 = 170, d2 = 150, h = 6, $fn = 64);
    color([0.3, 0.75, 1]) translate(ap_pos + [0, 0, 38]) cylinder(d = 10, h = 0.6);
}

// Rear of an ATX tower (same layout as the web viewer's case): the I/O shield under the top and
// the seven expansion slots below it, horizontal and stacked; the motherboard side is +X.
PCI_PITCH = 20.32;
pci_xr = TC_W / 2 - 18;                                // motherboard end of the slots
pci_x0 = pci_xr - PCI_L;
pci_ztop = tc_z1 - 40 - 175;                           // slot 0: board top 40 mm under the roof, 175 mm lower (ATX)
function pci_cz(i) = pci_ztop - i * PCI_PITCH;
function pci_x(along) = pci_xr - along;                // a point this far along a slot from the motherboard end
// the printed bracket (built flat: X width, Y length, Z up) standing in slot i, its tab inside the case
module in_slot(i) multmatrix([[0, -1, 0, pci_xr], [0, 0, -1, TC_D + 0.6], [1, 0, 0, pci_cz(i)], [0, 0, 0, 1]]) children();
module rear_brackets() if (rear_slots)
    for (b = [[pci_lan_slot, "lan"], [pci_power_slot, "power"]]) color(PRINT_C) in_slot(b[0]) pci_bracket(b[1]);

// this PC is the router: a 4-port network card (Intel i350-T4 style) in an expansion slot
nic_on = scene == "homelab" && router_nic_slot >= 0;
function nic_port(j) = [pci_x(24 + j * 18), TC_D + 1, pci_cz(router_nic_slot)];
io_nic = [TC_W / 2 - 38, TC_D - 3, tc_z1 - 150];       // motherboard LAN when there is no card
lan_port = nic_on ? nic_port(1) : io_nic;
wan_port = nic_on ? nic_port(0) : io_nic + [14, 0, 0];

// keystone back -> along the inside of the case -> out through the rear LAN slot (or the back) -> target
function inner_route(p, i) =
    let(xr = -TC_W / 2 + 26 + i * 7, zr = tc_z1 - 120 - i * 6, yb = zone_yf + 33,
        xs = rear_slots ? pci_x(40 + i * 14) : xr, zs = rear_slots ? pci_cz(pci_lan_slot) : zr)
    [[p[0], yb, p[1]], [p[0], yb + 30, p[1] - 8], [xr, 150, p[1] - 30], [xs, TC_D - 60, zs], [xs, TC_D + 25, zs]];

// The showcase network: this PC is the router (OPNsense / pfSense), the managed switch
// carries the VLANs, the access point gets a trunk. Cable colour = VLAN.
VLANS = [[10, "Management", [0.62, 0.64, 0.68]], [20, "Servers", [0.18, 0.68, 0.36]], [30, "Clients", [0.16, 0.46, 0.92]],
         [40, "Wi-Fi / IoT", [0.58, 0.32, 0.86]], [0, "Trunk", [0.95, 0.77, 0.16]], [-1, "WAN", [0.84, 0.2, 0.22]]];
function vlan_c(id) = [for (v = VLANS) if (v[0] == id) v[2]][0];
LINK_VLAN = [30, 20, 0];                               // old PC, NAS, access point (trunk with VLAN 30 + 40)
n_links = min(len(rj_ports), 3);
n_cords = len(sw_list) > 0 ? n_links : 0;

function link_route(i) =
    let(p = rj_ports[i], r = inner_route(p, i), last = r[len(r) - 1], zf = tc_z0 + 12 + i * 6,
        out = i < 2
            ? let(t = client_port(i))
              [last, [last[0], TC_D + 45, zf], [t[0], TC_D + 45, zf], [t[0], t[1] + 30, t[2]], [t[0], t[1] + 2, t[2]]]
            : [last, [last[0], TC_D + 30, tc_z1 + 12], [ap_pos[0] + 20, ap_pos[1] + 95, tc_z1 + 12], [ap_pos[0] + 20, ap_pos[1] + 82, tc_z1 + 14]])
    concat(r, [for (k = [1 : len(out) - 1]) out[k]]);

// front patch cord between two points [x, z] on faces at y = ya and y = yb
function cord(a, ya, b, yb, lift = 4) =
    [[a[0], ya - 2, a[1]], [a[0], ya - 14, a[1]], [a[0], min(ya, yb) - 28, a[1] + lift],
     [b[0], min(ya, yb) - 28, b[1] - lift], [b[0], yb - 14, b[1]], [b[0], yb - 2, b[1]]];
// which switch port feeds patch port i: with two switches the NAS hangs off the second one
function cord_from(i) = sw_second != undef && i == 1 ? sw_ports_of(sw_second)[1] : sw_ports_of(sw_main)[i];
function cord_route(i) = cord(cord_from(i), sw_yf, rj_ports[i], zone_yf);

// cable through a pass-through cover, along the inside to a rear expansion slot and out
function pass_route(a, q, slot, along, tail) =
    let(xp = pci_x(along), zp = pci_cz(slot))
    concat([[a[0], sw_yf - 2, a[1]], [a[0], sw_yf - 20, a[1]], [q[0], zone_yf - 18, q[1]], [q[0], zone_yf + 4, q[1]],
            [q[0], 60, q[1]], [TC_W / 2 - 30, 160, q[1] - 40]],
           rear_slots ? concat([[xp, TC_D - 60, zp], [xp, TC_D + 30, zp]], tail) : [[TC_W / 2 - 30, TC_D - 40, tc_z0 + 60]]);
function power_route() = pass_route(sw_jack_of(sw_main), pass_ports[len(pass_ports) - 1], pci_power_slot, 80,
    [[pci_x(80), TC_D + 60, tc_z0 + 8], [pci_x(80) + 160, TC_D + 90, tc_z0 + 4]]);
// router LAN (trunk): last switch port -> first pass-through -> inside, out through the LAN slot -> card port 2
function uplink_route() = let(q = pass_ports[0], a = sw_ports_of(sw_main)[4], p = lan_port,
                              xs = pci_x(30), zs = pci_cz(pci_lan_slot) + 3)
    concat([[a[0], sw_yf - 2, a[1]], [a[0], sw_yf - 14, a[1]], [a[0], zone_yf - 26, q[1] + 6], [q[0], zone_yf - 18, q[1]],
            [q[0], zone_yf + 4, q[1]], [q[0], 70, q[1] + 10], [TC_W / 2 - 34, 180, q[1] - 40]],
           rear_slots ? [[xs, TC_D - 60, zs], [xs, TC_D + 30, zs], [p[0] - 8, TC_D + 44, (zs + p[2]) / 2]]
                      : [[p[0] - 18, TC_D - 40, p[2] - 20], [p[0] - 18, TC_D + 20, p[2] - 10]],
           [[p[0], TC_D + 32, p[2]], [p[0], TC_D + 4, p[2]]]);
// WAN: card port 1 to the fibre box on the floor behind the case
// the fibre box (ONT) on the floor behind the case: 140 x 95 x 28, its LAN port on the side facing
// the router, the fibre comes in on the other side
ont_pos = [-TC_W / 2 + 10, TC_D + 120, tc_z0];
ont_lan = [ont_pos[0] + 70, ont_pos[1] - 20, tc_z0 + 12];
ont_fibre = [ont_pos[0] - 70, ont_pos[1] + 10, tc_z0 + 12];
function wan_route() = let(p = wan_port)
    [[p[0], TC_D + 4, p[2]], [p[0], TC_D + 36, p[2]], [p[0] - 10, TC_D + 62, tc_z0 + 70], [p[0] - 30, TC_D + 90, tc_z0 + 8],
     [ont_lan[0] + 60, ont_lan[1] + 8, tc_z0 + 6], [ont_lan[0] + 30, ont_lan[1], ont_lan[2]], [ont_lan[0] + 2, ont_lan[1], ont_lan[2]]];
function fibre_route() = [ont_fibre + [-1, 0, 0], ont_fibre + [-30, 0, -6], ont_fibre + [-110, 60, -11],
                          ont_fibre + [-260, 220, -11.5], ont_fibre + [-420, 420, -11.5]];

// every cable of the scene: [colour, diameter, points, plug at start, plug at end, vlan]
two_sw = sw_second != undef;
cables = concat(
    n_links > 0 ? [for (i = [0 : n_links - 1]) [vlan_c(LINK_VLAN[i]), CABLE_D, link_route(i), false, i < 2, LINK_VLAN[i]]] : [],
    n_cords > 0 ? [for (i = [0 : n_cords - 1]) [vlan_c(LINK_VLAN[i]), 4.6, cord_route(i), true, true, LINK_VLAN[i]]] : [],
    two_sw ? [[vlan_c(20), 4.6, cord(sw_ports_of(sw_main)[1], sw_yf, sw_ports_of(sw_second)[0], sw_yf, 10), true, true, 20]] : [],
    len(sw_list) > 0 && len(pass_ports) > 1 ? [[vlan_c(0), 4.6, uplink_route(), true, true, 0]] : [],
    rear_slots ? [[vlan_c(-1), CABLE_D, wan_route(), true, true, -1]] : [],
    rear_slots ? [[[0.95, 0.86, 0.42], 2.8, fibre_route(), false, false, -3]] : [],
    len(sw_list) > 0 && len(pass_ports) > 0 ? [[[0.05, 0.05, 0.05], 3.2, power_route(), false, false, -2]] : []);

module homelab_scene() {
    client_pc(cl_x[0], CLIENTS[0]);
    nas(cl_x[1], CLIENTS[1]);
    client_bezels();
    access_point();
    for (c = cables) {
        cable(c[2], c[0], c[1]);
        if (c[3]) plug(c[2][0], c[0]);
        if (c[4]) plug(c[2][len(c[2]) - 1], c[0]);
    }
}

// --- scene as data for the web viewer (it draws these with real materials) ----
function jstr(x) = str("\"", x, "\"");
module scene_echo() {
    if (case_view == "tower")
        echo(str("SCENE ", "{", jstr("case"), ":{",
            jstr("id"), ":", jstr(TC[0]), ",", jstr("name"), ":", jstr(TC[1]),
            ",", jstr("w"), ":", TC_W, ",", jstr("h"), ":", TC_H, ",", jstr("d"), ":", TC_D,
            ",", jstr("z0"), ":", tc_z0, ",", jstr("z1"), ":", tc_z1, ",", jstr("bays"), ":", TC[5],
            ",", jstr("extra"), ":", tc_extra, ",", jstr("cz0"), ":", tc_cz0, ",", jstr("cz1"), ":", tc_cz1,
            ",", jstr("fd"), ":", tc_fd, ",", jstr("front"), ":", jstr(TC[7]),
            ",", jstr("open"), ":", [-fw / 2 - 0.3, fw / 2 + 0.3, frame_z0 - 0.3, frame_z1 + 0.3],
            ",", jstr("bay"), ":", [bay_w, bay_h, bay_pitch, bezel_w, bezel_h1, case_wall_t],
            ",", jstr("window"), ":", jstr(case_window),
            ",", jstr("rearSlots"), ":", rear_slots ? [pci_lan_slot, pci_power_slot] : [],
            ",", jstr("pci"), ":", [pci_x0, pci_ztop, PCI_PITCH, PCI_L],
            ",", jstr("nic"), ":", nic_on ? router_nic_slot : -1,
            ",", jstr("nicPorts"), ":", [for (j = [0 : 3]) nic_port(j)], "}}"));
    if (case_view == "tower" && scene == "homelab") {
        echo(str("SCENE ", "{", jstr("homelab"), ":{",
            jstr("clients"), ":", [for (i = [0, 1]) [cl_x[i], CLIENTS[i][0], CLIENTS[i][1], CLIENTS[i][2], CLIENTS[i][3]]],
            ",", jstr("types"), ":", ["pc", "nas"],
            ",", jstr("clientBezels"), ":", [for (b = client_bezels_at()) [b[0], (b[1] - 1) * bay_pitch + bezel_h1]],

            ",", jstr("ports"), ":", [client_port(0), client_port(1)],
            ",", jstr("ap"), ":", ap_pos, ",", jstr("ont"), ":", ont_pos,
            ",", jstr("vlans"), ":", [for (v = VLANS) [v[0], v[2]]], "}}"));
        for (c = cables)
            echo(str("SCENE ", "{", jstr("cable"), ":{", jstr("c"), ":", c[0], ",", jstr("d"), ":", c[1],
                     ",", jstr("p"), ":", c[2], ",", jstr("plugs"), ":", [c[3], c[4]], ",", jstr("vlan"), ":", c[5], "}}"));
    }
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

module assembly() {
    pi = preview_item;
    if (pi == "all" || pi == "adapter") section_cut() color(PRINT_A) adapter();
    if (pi == "all" || pi == "filler") {
        if (filler_mode == "separate") for (zn = zones)
            section_cut() {
                color(PRINT_B) translate([0, -ft - 2 * explode, zn[0] + 0.4]) filler_panel(zn);
                if (labels_multicolour) color(LABEL_C) translate([0, -ft - 2 * explode, zn[0] + 0.4])
                    fill_labels(zn[2], hole_s - R[0] - 6, zn[1] - 0.8, filler_t);
            }
        if (show_devices) zone_devices();
    }
    if ((pi == "all" || pi == "module") && show_devices) section_cut() rack_contents();
    if ((pi == "all" || pi == "hardware") && show_hardware) section_cut() hardware();
    if (section == "none") {
        if (web_scene) {
            if (pi == "all" || pi == "adapter") scene_echo();
            if ((pi == "all" || pi == "clients") && case_view == "tower" && scene == "homelab") client_bezels();
            if ((pi == "all" || pi == "clients" || pi == "brackets") && case_view == "tower") rear_brackets();
            // one bezel of the Proxmox node on its own (the video swaps them)
            for (k = [0, 1]) if (pi == str("bezel", k) && case_view == "tower" && scene == "homelab")
                client_bezel(CLIENT_FILLS[k][0], cl_x[0], client_bezels_at()[k][0], CLIENT_FILLS[k][1]);
        }
        else {
            if (case_view == "ghost") case_ghost();
            else if (case_view == "tower") { tower_case(); rear_brackets(); }
            if (case_view == "tower" && scene == "homelab") homelab_scene();
        }
    }
}

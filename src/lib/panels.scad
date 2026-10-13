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
        union() {
            plate(panel_w, h, filler_t, 0.6);
            fill_add(zn[2], hole_s - R[0] - 6, h, filler_t);
        }
        panel_holes([h / 2], filler_t, panel_hole_slot);
        fill_cut(zn[2], hole_s - R[0] - 6, h, filler_t);
    }
}

// rack hole heights of an n-U panel (panel bottom at z = 0)
function panel_zs(n) = [for (u = [0 : n - 1]) for (o = pat(hole_pattern)) u * U + o - 0.395];

module rack_panel_u(n, fill) {
    h = n * U - 0.79;
    difference() {
        union() {
            plate(panel_w, h, panel_t, 0.6);
            fill_add(fill, hole_s - R[0] - 6, h, panel_t);
        }
        panel_holes(panel_zs(n), panel_t, panel_hole_slot);
        fill_cut(fill, hole_s - R[0] - 6, h, panel_t);
    }
}

module rack_panel() rack_panel_u(panel_u, panel_fill);

// one U of the rack contents
module rack_module(type) {
    if (type == "ms105g") switch_mount();
    else if (type == "shelf") shelf_mount();
    else rack_panel_u(1, type == "patch" ? "keystone" : type);
}

// ---------------------------------------------------------------------
//  Device mounts (1U, front at y = -panel_t, the device behind)
// ---------------------------------------------------------------------
// Mercusys MS105G: ports and power jack are all on the front. The switch slides
// into a tunnel from the back, the window lip stops it, a zip tie behind it holds it.
ms_cw = ms_w + mount_clear;
ms_ch = ms_h + mount_clear;
ms_z0 = (U - 0.79 - ms_ch) / 2;                       // cavity bottom inside the 1U plate
ms_td = ms_d + mount_clear + 6;                       // tunnel depth behind the plate

module switch_mount() {
    h = U - 0.79;
    w = mount_wall;
    if (ms_cw + 2 * w > 2 * x_in) echo("WARNING: the switch mount is wider than the rack opening");
    difference() {
        union() {
            plate(panel_w, h, panel_t, 0.6);
            translate([-ms_cw / 2 - w, -eps, ms_z0 - w]) cube([ms_cw + 2 * w, ms_td, ms_ch + 2 * w]);
        }
        panel_holes(panel_zs(1), panel_t, panel_hole_slot);
        // front window: a lip smaller than the switch all round
        translate([-ms_cw / 2 + mount_lip, -panel_t - 1, ms_z0 + mount_lip])
            cube([ms_cw - 2 * mount_lip, panel_t + 2, ms_ch - 2 * mount_lip]);
        translate([-ms_cw / 2, 0, ms_z0]) cube([ms_cw, ms_td + 1, ms_ch]);   // tunnel, open at the back
        // vent slots in roof and floor, along the depth (no bridges when printed front-down)
        for (zz = [ms_z0 - w - 1, ms_z0 + ms_ch - 1]) for (i = [-3 : 3])
            translate([i * 14 - 3, 10, zz]) cube([6, ms_td - 20, w + 2]);
        // zip-tie slots just behind the switch: the tie runs behind it from wall to wall
        for (s = [-1, 1]) translate([s * (ms_cw / 2 + w / 2) - (w + 2) / 2, ms_d + mount_clear + 0.4, ms_z0 + ms_ch / 2 - 2.2])
            cube([w + 2, 3.2, 4.4]);
    }
}

// 1U shelf for small devices (NanoKVM, Raspberry Pi, a small router...)
shelf_w = 2 * x_in - 8;
shelf_z = 2.5;                                        // shelf floor bottom inside the 1U plate
YZ = [[0, 0, 1, 0], [1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0, 1]];   // 2D (y, z) -> 3D, extruded along X

module shelf_mount() {
    h = U - 0.79;
    d = shelf_depth;
    difference() {
        union() {
            plate(panel_w, h, panel_t, 0.6);
            translate([-shelf_w / 2, -eps, shelf_z]) cube([shelf_w, d, 2]);
            for (s = [-1, 1]) translate([s > 0 ? shelf_w / 2 - 2 : -shelf_w / 2, -eps, shelf_z]) cube([2, d, 10]);
            // side gussets and rear stop: sloped profiles, printable front-down
            for (x = [-shelf_w / 2, shelf_w / 2 - 2]) translate([x, 0, 0])
                multmatrix(YZ) linear_extrude(2) polygon([[-eps, shelf_z + 2], [16, shelf_z + 2], [-eps, shelf_z + 18]]);
            translate([-shelf_w / 2, 0, 0])
                multmatrix(YZ) linear_extrude(shelf_w) polygon([[d - 12, shelf_z + 2], [d, shelf_z + 2], [d, shelf_z + 9]]);
        }
        panel_holes(panel_zs(1), panel_t, panel_hole_slot);
        // front window for the device's ports and cables
        translate([-shelf_w / 2 + 6, -panel_t - 1, shelf_z + 4]) cube([shelf_w - 12, panel_t + 2, h - shelf_z - 9]);
        // zip-tie slot pairs across the shelf
        for (y = [22, 62], x = [-34, 34]) for (dx = [-6, 6])
            translate([x + dx - 1.6, y, shelf_z - 1]) cube([3.2, 4.4, 4]);
    }
}

// ---------------------------------------------------------------------
//  Keystone covers: pushed into an unused port from the front. Two flexible
//  tongues with a detent click behind the front opening. "pass" is split so
//  it clips around a cable that is already routed (e.g. the switch uplink).
//  Built in print orientation: flange on the bed, body up +Z.
// ---------------------------------------------------------------------
module keystone_cover(kind = cover_type) {
    metal = ks_style == "metal";
    ow = (metal ? ksm_w : ks_w) - 2 * cover_clear;    // body that goes into the opening
    oh = (metal ? ksm_face_h : ks_h) - 2 * cover_clear;
    fl = 1.2;                                         // flange thickness
    bl = metal ? 6.5 : 4.5;                           // body length
    bz = metal ? 3.6 : ks_plate_t + 0.6;              // detent depth behind the front face
    wt = 1.2;                                         // wall thickness
    tw = ow * 0.6;                                    // tongue width
    difference() {
        union() {
            linear_extrude(fl) offset(r = 1) square([ow + 1.6, oh + 1.6], center = true);
            translate([-ow / 2, -oh / 2, 0]) cube([ow, oh, fl + bl]);
            for (s = [-1, 1]) translate([0, s * oh / 2, fl + bz]) rotate([0, 90, 0]) cylinder(d = 1.5, h = tw - 1, center = true);
        }
        translate([-ow / 2 + wt, -oh / 2 + wt, fl]) cube([ow - 2 * wt, oh - 2 * wt, bl + 1]);   // hollow
        for (s = [-1, 1], x = [-tw / 2, tw / 2])                                            // tongue slits
            translate([x - 0.35, s > 0 ? oh / 2 - wt - 1 : -oh / 2 - 1, fl + 0.6]) cube([0.7, wt + 2, bl + 1]);
        if (kind == "pass") {
            translate([0, 0, -1]) cylinder(d = cover_cable_d, h = fl + bl + 2);
            translate([-cover_cable_d * 0.35, -oh, -1]) cube([cover_cable_d * 0.7, oh, fl + bl + 2]);
        }
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

// one keystone port with the same plate thickness as the filler panels
module test_keystone() {
    tp = ks_style == "metal" ? "rj45m" : "rj45";
    w = ks_cw + 8;
    h = ks_hi - ks_lo + 8;
    difference() {
        union() {
            plate(w, h, filler_t, 0.6);
            keystone_add(w, h, filler_t, [tp]);
        }
        keystone_cut(w, h, filler_t, [tp]);
    }
}

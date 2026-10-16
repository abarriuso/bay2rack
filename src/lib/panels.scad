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
function panel_zs(n) = [for (u = [0 : n - 1]) for (o = pat(hole_pat)) u * U + o - 0.395];

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
    else if (mod_kind(type) == "kvm") kvm_mount(mod_items(type));
    else if (mod_kind(type) == "pi") pi_mount(mod_items(type));
    else if (mod_kind(type) == "piblade") pi_blade_mount(mod_items(type));
    else if (mod_kind(type) == "nkvm") nkvm_mount(mod_items(type));
    else if (type == "uswflex") dev_mount(usw_dims);
    else if (type == "ux") dev_mount(ux_dims);
    else if (type == "dev1") dev_mount(dev1_dims);
    else if (type == "dev2") dev_mount(dev2_dims);
    else if (type == "shelf") shelf_mount();
    else rack_panel_u(1, type == "patch" ? "keystone" : type);
}

// ---------------------------------------------------------------------
//  Device mounts (1U, front at y = -panel_t, the device behind)
// ---------------------------------------------------------------------
// A device slides into a tunnel from the back, the window lip in the plate stops it and a
// zip tie behind it holds it. Used by the switch and the KVM mounts.
shelf_z = 2.5;                                        // floor bottom of the shelf and Pi trays inside the plate
YZ = [[0, 0, 1, 0], [1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0, 1]];   // 2D (y, z) -> 3D, extruded along X
function tunnel_z0(ch) = (U - 0.79 - ch) / 2;          // cavity bottom, centred in the 1U plate

module tunnel_add(x, cw, ch, d)
    translate([x - cw / 2 - mount_wall, -eps, tunnel_z0(ch) - mount_wall]) cube([cw + 2 * mount_wall, d, ch + 2 * mount_wall]);

module tunnel_cut(x, cw, ch, d, dev_d) {
    z0 = tunnel_z0(ch);
    w = mount_wall;
    translate([x - cw / 2 + mount_lip, -panel_t - 1, z0 + mount_lip]) cube([cw - 2 * mount_lip, panel_t + 2, ch - 2 * mount_lip]);
    translate([x - cw / 2, 0, z0]) cube([cw, d + 1, ch]);                     // open at the back
    // vent slots in roof and floor, along the depth (no bridges when printed front-down)
    n = max(1, floor((cw - 8) / 14));
    if (d > 26) for (zz = [z0 - w - 1, z0 + ch - 1]) for (i = [0 : n - 1])
        translate([x - (n - 1) * 7 + i * 14 - 3, 10, zz]) cube([6, d - 20, w + 2]);
    // zip-tie slots just behind the device: the tie runs behind it from wall to wall
    for (s = [-1, 1]) translate([x + s * (cw / 2 + w / 2) - (w + 2) / 2, dev_d + mount_clear + 0.4, z0 + ch / 2 - 2.2])
        cube([w + 2, 3.2, 4.4]);
}

// Mercusys MS105G: ports and power jack are all on the front
ms_cw = ms_w + mount_clear;
ms_ch = ms_h + mount_clear;
ms_z0 = tunnel_z0(ms_ch);
ms_td = ms_d + mount_clear + 6;                       // tunnel depth behind the plate

module switch_mount() {
    if (ms_cw + 2 * mount_wall > 2 * x_in) echo("WARNING: the switch mount is wider than the rack opening");
    difference() {
        union() { plate(panel_w, U - 0.79, panel_t, 0.6); tunnel_add(0, ms_cw, ms_ch, ms_td); }
        panel_holes(panel_zs(1), panel_t, panel_hole_slot);
        tunnel_cut(0, ms_cw, ms_ch, ms_td, ms_d);
    }
}

// KVM-over-IP tray: 1 to 3 boxes side by side, each in its own tunnel, screens visible in front.
// Neighbouring tunnels share a wall when space is short, otherwise they are kvm_gap apart.
function kvm_dims(b) = b == "jet" ? jetkvm_dims : b == "nano" ? nanokvm_dims : kvm_custom;
function kvm_c(k) = [k[0] + mount_clear, k[1] + mount_clear, k[2] + mount_clear + 6];
kvm_gap = 12;
function kvm_list(items) = len(items) == 0 ? ["nano"] : [for (i = [0 : min(len(items), 3) - 1]) items[i]];
function kvm_cs(items) = [for (b = kvm_list(items)) kvm_c(kvm_dims(b))];
function kvm_wsum(items) = sum_list([for (c = kvm_cs(items)) c[0]]);
function kvm_space(items) = let(n = len(kvm_cs(items)))       // wall-to-wall distance between cavities
    n < 2 ? 0 : min(kvm_gap + 2 * mount_wall, max(mount_wall, (2 * x_in - 6 - 2 * mount_wall - kvm_wsum(items)) / (n - 1)));
function kvm_xs(items) = let(cs = kvm_cs(items), n = len(cs), sp = kvm_space(items), tot = kvm_wsum(items) + (n - 1) * sp)
    [for (i = [0 : n - 1]) -tot / 2 + sum_list([for (j = [0 : i]) cs[j][0]]) - cs[i][0] / 2 + i * sp];
function kvm_fits(items) = let(cs = kvm_cs(items))
    kvm_wsum(items) + (len(cs) + 1) * mount_wall <= 2 * x_in - 1 && max([for (c = cs) c[1]]) + 2 * mount_wall <= U - 0.79;

module kvm_mount(items) {
    L = kvm_list(items);
    cs = kvm_cs(items);
    xs = kvm_xs(items);
    if (len(items) > 3) echo("WARNING: a KVM tray takes 3 boxes at most");
    if (!kvm_fits(items))
        echo(str("WARNING: the KVM boxes ", L, " do not fit in one 1U tray - use fewer boxes or two trays"));
    difference() {
        union() {
            plate(panel_w, U - 0.79, panel_t, 0.6);
            for (i = [0 : len(cs) - 1]) tunnel_add(xs[i], cs[i][0], cs[i][1], cs[i][2]);
        }
        panel_holes(panel_zs(1), panel_t, panel_hole_slot);
        for (i = [0 : len(cs) - 1]) tunnel_cut(xs[i], cs[i][0], cs[i][1], cs[i][2], kvm_dims(L[i])[2]);
    }
}

// ---------------------------------------------------------------------
//  NanoKVM bay, two pieces: the bay and its lid, screwed on with four M3
//  heat-set inserts.
//    side  = the NanoKVM out in front, standing in a pocket of the plate with its
//            heatsink facing you; the lid is the front frame round it. Ethernet
//            plugs in on the left, HDMI and USB on the right, the plugs stay inside
//            the pocket (nkvm_plugs) and the cables go back into the case.
//            Prints face-down like the other modules.
//    front = the board lying flat on an open frame behind the plate, only its
//            Ethernet port at the front, HDMI and USB facing into the case; the lid
//            is a frame on top. Prints floor-down, the plate standing.
//  Up to two keystone openings on the left of the plate (nkvm_keystones).
//  Board coordinates: u along the port axis (0 = Ethernet end), v across, w = height.
// ---------------------------------------------------------------------
nk_c  = mount_clear;                                  // clearance around the board
nk_fl = 2.4;                                          // floor (front layout)
nk_pw = 8;                                            // post length along the board edge
nk_pd = 7;                                            // post thickness
nk_fs = 1.6;                                          // corner fingers that stop the board lengthwise
nk_lid_t = 2.4;
nk_wall = 2;                                          // pocket walls (side layout)
NK_M3 = with_insert(hw("M3"), nkvm_insert_d, 0);   // M3 heat-set inserts of the lid (and the split plate)
function nk_layout(items) = len(items) > 0 && (items[0] == "front" || items[0] == "ks") ? items[0] : "side";
// ks = the network port reaches the front through keystone 1: the board lies flat right behind it, its Ethernet
// port facing the back of the keystone (a short straight patch cable), HDMI and USB facing into the case
// keystones: none in the standing version (its plugs take the whole width), at least one in ks
function nk_nks(lay) = lay == "ks" ? max(1, nk_n_ks()) : lay == "side" ? 0 : nk_n_ks();
nk_ks_rear = 28.6;                                     // back of a metal keystone jack, behind the plate
function nk_n_ks() = max(0, min(2, nkvm_keystones));
function nk_ks_w(n) = ks_cw + (n - 1) * ks_px;        // width of the keystone group
function nk_ks_x0(lay = "side") = lay == "ks" ? -nk_ks_w(nk_nks("ks")) / 2 : -x_in + 2;   // its left edge: next to the rack post, or centred (ks)
nk_top = nk_fl + nkvm_dims[1] + nk_c;                 // front layout: post tops = underside of the lid
// the end stop at u = 0 is the plate itself in the front layout
function nk_u0(lay) = lay == "front" ? -nk_c : -nk_c - nk_fs;    // (ks: away from the plate, with fingers)
function nk_u1() = nkvm_dims[0] + nk_c + nk_fs;
// post centres (where the inserts go), board coordinates
function nk_posts(lay) = let(L = nkvm_dims[0], W = nkvm_dims[2], a = (nk_u0(lay) + nk_pw - nk_c) / 2, b = (L - nk_pw + nk_c + nk_u1()) / 2)
    [for (u = [a, b], v = [-nk_c - nk_pd / 2, W + nk_c + nk_pd / 2]) [u, v]];

XZ_Y = [[1, 0, 0, 0], [0, 0, 1, 0], [0, 1, 0, 0], [0, 0, 0, 1]];   // 2D (x, z) -> 3D, extruded along +Y
module nk_rrect(x0, y0, x1, y1, r) translate([x0, y0]) offset(r) offset(-r) square([x1 - x0, y1 - y0]);

// the four posts with their corner fingers, 2D in board coordinates; v0 / v1 = how far the outer posts reach
module nk_posts2d(lay, v0, v1) {
    L = nkvm_dims[0]; W = nkvm_dims[2];
    u0 = nk_u0(lay); u1 = nk_u1();
    for (e = [0, 1], f = [0, 1]) {
        pu = e == 0 ? [u0, nk_pw - nk_c] : [L - nk_pw + nk_c, u1];
        pv = f == 0 ? [v0, -nk_c] : [W + nk_c, v1];
        nk_rrect(pu[0], pv[0], pu[1], pv[1], 1.5);
        if (!(lay == "front" && e == 0))              // (none against the plate)
            nk_rrect(e == 0 ? u0 : L + nk_c, f == 0 ? -nk_c - nk_pd : W - 2.5, e == 0 ? u0 + nk_fs : L + nk_c + nk_fs,
                     f == 0 ? 2.5 : W + nk_c + nk_pd, 0.7);
    }
}

// ---- side layout: the pocket ----
nk_h = U - 0.79;
nk_zv0 = (nk_h - nkvm_dims[2]) / 2;                    // bottom edge of the standing board
nk_yp0 = -panel_t + 0.6 + nk_lid_t;                    // back of the lid = front of the posts
nk_yd0 = nk_yp0 + nk_c;                                // front of the board (heatsink)
nk_yb0 = nk_yd0 + nkvm_dims[1] + nk_c;                 // back wall
nk_yb1 = nk_yb0 + 2.4;
// pocket [x left, x right] and the board's Ethernet end x
function nk_pocket() = let(n = 0, need = nk_u1() - nk_u0("side") + nkvm_plugs[0] + nkvm_plugs[1] + 2 * nk_wall,
                           bw = min(need, 2 * x_in - 2))
    n > 0 ? [nk_ks_x0() + nk_ks_w(n) + 1.5, x_in - 1] : [-bw / 2, bw / 2];
function nk_x0() = let(p = nk_pocket())
    max(p[0] + nk_wall - nk_u0("side"),
        min(p[0] + nk_wall + nkvm_plugs[0] - nk_u0("side"), p[1] - nk_wall - nkvm_plugs[1] - nk_u1()));
function nk_plugs_fit() = let(p = nk_pocket(), x0 = nk_x0())
    x0 + nk_u0("side") - nkvm_plugs[0] >= p[0] + nk_wall - 0.01 && x0 + nk_u1() + nkvm_plugs[1] <= p[1] - nk_wall + 0.01;
// board coordinates (u, v, depth from the front) -> the module
module nk_side_frame(y) multmatrix([[1, 0, 0, nk_x0()], [0, 0, 1, y], [0, 1, 0, nk_zv0], [0, 0, 0, 1]]) children();

// three-piece version (nkvm_split): the plate and the pocket are printed apart and screwed together from
// behind - four M3 screws through the pocket corners into heat-set inserts in bosses on the back of the plate,
// so nothing shows on the front
nk_boss = 8;                                           // corner boss (split) / plate corner left over the pocket
nk_pboss = 7;                                          // depth of the bosses on the back of the plate (the inserts)
function nk_split() = nkvm_split;
function nk_bosses() = let(p = nk_pocket(), o = nk_wall + nk_boss / 2)
    [for (x = [p[0] + o, p[1] - o], z = [o, nk_h - o]) [x, z]];
// the pocket opening in the plate: with nkvm_cover just the lid's outline (the plugs and the inside of
// the case stay hidden behind the plate), otherwise the whole pocket (corners kept in the split version)
module nk_opening2d() {
    p = nk_pocket();
    x0 = nk_x0();
    W = nkvm_dims[2];
    if (nkvm_cover) nk_rrect(x0 + nk_u0("side") - 0.4, nk_zv0 - nk_c - nk_pd - 0.4,
                             x0 + nk_u1() + 0.4, nk_zv0 + W + nk_c + nk_pd + 0.4, 3.4);
    else difference() {
        translate([p[0] + nk_wall, nk_wall]) square([p[1] - p[0] - 2 * nk_wall, nk_h - 2 * nk_wall]);
        if (nk_split()) for (b = nk_bosses()) translate([b[0] - nk_boss / 2 - 0.4, b[1] - nk_boss / 2 - 0.4])
            offset(r = 0.4) square(nk_boss);
    }
}

// the covered parts of the pocket beside the lid: [x from, x to, label]
function nk_side_zones() = let(p = nk_pocket(), x0 = nk_x0())
    [[p[0] + nk_wall, x0 + nk_u0("side") - 0.4, "LAN"], [x0 + nk_u1() + 0.4, p[1] - nk_wall, "HDMI · USB"]];

module nk_zone_labels2d() for (zn = nk_side_zones()) translate([(zn[0] + zn[1]) / 2, nk_h - 6.4])
    text(zn[2], size = 3.2, font = "Liberation Sans:style=Bold", halign = "center", valign = "center");

// the multicolour label piece of a rack module (where its plate has letters)
module module_labels(type) {
    h = U - 0.79;
    lay = mod_kind(type) == "nkvm" ? nk_layout(mod_items(type)) : "";
    n = lay == "" ? 0 : nk_nks(lay);
    if (type == "patch") fill_labels("keystone", hole_s - R[0] - 6, h, panel_t);
    else if (type == "label") fill_labels("label", hole_s - R[0] - 6, h, panel_t);
    else if (lay != "") {
        if (n > 0 && ks_labels) translate([nk_ks_x0(lay) + nk_ks_w(n) / 2, 0, 0]) xz_extrude(-panel_t, ks_label_d)
            ks_labels2d(nk_ks_w(n) + 0.1, h, [for (i = [0 : n - 1]) ks_style == "metal" ? "rj45m" : "rj45"]);
        if (lay == "side" && nkvm_cover && ks_labels) translate([0, -panel_t, 0]) multmatrix(XZ_Y) linear_extrude(ks_label_d) nk_zone_labels2d();
    }
}

// the front plate: rack holes, keystones, the pocket opening
module nk_side_plate(n, types, xk) {
    h = nk_h;
    difference() {
        union() {
            plate(panel_w, h, panel_t, 0.6);
            if (n > 0) translate([xk, 0, 0]) keystone_add(nk_ks_w(n) + 0.1, h, panel_t, types);
            if (nk_split()) for (b = nk_bosses()) translate([b[0] - nk_boss / 2, -eps, b[1] - nk_boss / 2]) cube([nk_boss, nk_pboss + eps, nk_boss]);
        }
        panel_holes(panel_zs(1), panel_t, panel_hole_slot);
        if (nk_split()) for (b = nk_bosses()) translate([b[0], nk_pboss + eps, b[1]]) rotate([90, 0, 0])
            cylinder(d = NK_M3[2], h = NK_M3[3] + 0.8, $fn = 24);
        if (n > 0) translate([xk, 0, 0]) keystone_cut(nk_ks_w(n) + 0.1, h, panel_t, types);
        translate([0, -panel_t - 1, 0]) multmatrix(XZ_Y) linear_extrude(panel_t + 1 + 2 * eps) nk_opening2d();
        // the covered sides: vertical vent slots over the plugs, and what plugs in behind engraved above them
        if (nkvm_cover) for (zn = nk_side_zones()) {
            k = min(5, floor((zn[1] - zn[0] - 6) / 6));
            if (nkvm_vents && k > 0) for (i = [0 : k - 1])
                translate([(zn[0] + zn[1]) / 2 + (i - (k - 1) / 2) * 6, -panel_t - 1, 0]) multmatrix(XZ_Y)
                    linear_extrude(panel_t + 2) hull() for (z = [nk_split() ? 13 : 7.5, h - 13.5]) translate([0, z]) circle(d = 3, $fn = 16);
        }
        if (nkvm_cover && ks_labels) translate([0, -panel_t - eps, 0]) multmatrix(XZ_Y) linear_extrude(ks_label_d + eps) nk_zone_labels2d();
    }
}

// the pocket behind it: floor, roof, side walls, the wall the board leans on, the posts
module nk_side_bay() {
    h = nk_h;
    L = nkvm_dims[0]; W = nkvm_dims[2];
    p = nk_pocket();
    x0 = nk_x0();
    difference() {
        union() {
            for (z = [0, h - nk_wall]) translate([p[0], 0, z]) cube([p[1] - p[0], nk_yb1, nk_wall]);
            for (x = [p[0], p[1] - nk_wall]) translate([x, 0, 0]) cube([nk_wall, nk_yb1, h]);
            translate([x0 + nk_u0("side"), nk_yb0, 0]) cube([nk_u1() - nk_u0("side"), nk_yb1 - nk_yb0, h]);
            nk_side_frame(nk_yp0) linear_extrude(nk_yb0 - nk_yp0 + eps) nk_posts2d("side", -nk_zv0 + eps, h - nk_zv0 - eps);
            // (split) a corner block behind each plate boss, the screw goes in from the back
            if (nk_split()) for (b = nk_bosses())
                translate([b[0] - nk_boss / 2 - (b[0] < 0 ? nk_wall : 0), nk_pboss + 0.2, b[1] - nk_boss / 2 - (b[1] < h / 2 ? nk_wall : 0)])
                    cube([nk_boss + nk_wall, 6.8, nk_boss + nk_wall]);
            // cable anchors: a bar from floor to roof near each end wall, at the back; a zip tie goes round it and the cable
            for (x = [p[0] + nk_wall + 4, p[1] - nk_wall - 4 - 3]) translate([x, nk_yb1 - 3, 0]) cube([3, 3, h]);
        }
        // an open back behind the board
        translate([0, nk_yb0 - 1, 0]) multmatrix(XZ_Y) linear_extrude(nk_yb1 - nk_yb0 + 2)
            nk_rrect(x0 + 5, nk_zv0 + 4, x0 + L - 5, nk_zv0 + W - 4, 2.5);
        // heat-set inserts: the lid on the posts, and (split) the plate on the corner bosses
        for (q = nk_posts("side")) translate([x0 + q[0], nk_yp0 - eps, nk_zv0 + q[1]]) rotate([-90, 0, 0])
            cylinder(d = NK_M3[2], h = NK_M3[3] + 0.8 + eps, $fn = 24);
        if (nk_split()) for (b = nk_bosses()) translate([b[0], nk_pboss, b[1]]) rotate([-90, 0, 0]) {
            cylinder(d = NK_M3[0], h = 8, $fn = 20);
            translate([0, 0, 3.8]) cylinder(d = 6.4, h = 4, $fn = 28);             // room for the screw head
        }
    }
}

// ---- side layout, raised: out of the case in a little mountain on the plate ----
// The board stands in front of the plate, its back on it, the lid at the top of the mountain. The ends of the
// mountain are open caves where the plugs go in from the sides (Ethernet left, HDMI / USB right); the cables
// run along the plate, or into the case through the slots at its ends. Prints back face down, the mountain up.
nk_r_lb = -panel_t - 2 * nk_c - nkvm_dims[1];          // back of the lid (front of the posts)
nk_r_lf = nk_r_lb - nk_lid_t;                          // front of the lid
nk_r_wall = 2;
nk_r_foot = 12;                                        // how far the slopes reach past the posts at the plate
function nk_r_x0() = (nkvm_plugs[0] - nkvm_plugs[1]) / 2 - nkvm_dims[0] / 2;   // board's Ethernet end, centred between its plugs
function nk_r_zv0() = nk_zv0;
module nk_r_frame(y) multmatrix([[1, 0, 0, nk_r_x0()], [0, 0, 1, y], [0, 1, 0, nk_zv0], [0, 0, 0, 1]]) children();
// the mountain, 2D outline at the plate (big) and at the top (the lid with a rim)
module nk_r_base2d(g = 0) let(x0 = nk_r_x0()) nk_rrect(x0 + nk_u0("side") - nk_r_foot + g, 0.8 + g,
    x0 + nk_u1() + nk_r_foot - g, nk_h - 0.8 - g, 6);
module nk_r_top2d(g = 0) let(x0 = nk_r_x0(), W = nkvm_dims[2]) nk_rrect(x0 + nk_u0("side") - 1.4 + g, nk_zv0 - nk_c - nk_pd - 1.4 + g,
    x0 + nk_u1() + 1.4 - g, nk_zv0 + W + nk_c + nk_pd + 1.4 - g, 4);
module nk_r_slab(y, g, top) translate([0, y, 0]) multmatrix(XZ_Y) linear_extrude(0.01) if (top) nk_r_top2d(g); else nk_r_base2d(g);

// the plate of the raised bay: rack holes, air behind the board, cable ways from inside the case at both ends;
// (three pieces) countersunk from the back for the screws into the posts
module nk_r_plate() {
    h = nk_h;
    L = nkvm_dims[0]; W = nkvm_dims[2];
    x0 = nk_r_x0();
    difference() {
        plate(panel_w, h, panel_t, 0.6);
        panel_holes(panel_zs(1), panel_t, panel_hole_slot);
        translate([0, -panel_t - 1, 0]) multmatrix(XZ_Y) linear_extrude(panel_t + 2) nk_rrect(x0 + 5, nk_zv0 + 4, x0 + L - 5, nk_zv0 + W - 4, 2.5);
        for (x = [x0 - nkvm_plugs[0] + 2, x0 + L + nkvm_plugs[1] - 2])
            translate([0, -panel_t - 1, 0]) multmatrix(XZ_Y) linear_extrude(panel_t + 2) nk_rrect(x - 3.5, h / 2 - 9, x + 3.5, h / 2 + 9, 3.4);
        if (nkvm_split) for (q = nk_posts("side")) translate([x0 + q[0], eps, nk_zv0 + q[1]]) rotate([90, 0, 0]) {
            cylinder(d = NK_M3[0], h = panel_t + 2 * eps, $fn = 20);
            cylinder(d1 = 6.4, d2 = NK_M3[0], h = 1.7, $fn = 24);
        }
    }
}
// the mountain: a shell from the plate up to the lid, with the four posts; its ends are open caves for the plugs
module nk_r_mountain() {
    L = nkvm_dims[0]; W = nkvm_dims[2];
    x0 = nk_r_x0();
    difference() {
        union() {
            difference() {
                hull() { nk_r_slab(-panel_t, 0, false); nk_r_slab(nk_r_lf, 0, true); }
                hull() { nk_r_slab(-panel_t + eps, nk_r_wall, false); nk_r_slab(nk_r_lf - 1, nk_r_wall, true); }
            }
            nk_r_frame(nk_r_lb) linear_extrude(-panel_t - nk_r_lb) nk_posts2d("side", -nk_c - nk_pd, W + nk_c + nk_pd);
        }
        // the lid sits in the top of the mountain
        translate([0, nk_r_lf - 1, 0]) multmatrix(XZ_Y) linear_extrude(nk_lid_t + 1 + eps)
            nk_rrect(x0 + nk_u0("side") - 0.4, nk_zv0 - nk_c - nk_pd - 0.4, x0 + nk_u1() + 0.4, nk_zv0 + W + nk_c + nk_pd + 0.4, 3.4);
        // the caves at both ends, where the plugs go in
        for (e = [0, 1]) translate([e == 0 ? x0 + nk_u0("side") - nk_r_foot - 5 : x0 + L, nk_r_lb, nk_zv0 + 0.5])
            cube([nk_r_foot + 5 + nk_fs + nk_c, -panel_t - nk_r_lb + 1, W - 1]);
        // heat-set inserts: the lid at the top of the posts, (three pieces) the plate screws at their foot
        for (q = nk_posts("side")) translate([x0 + q[0], 0, nk_zv0 + q[1]]) {
            translate([0, nk_r_lb - eps, 0]) rotate([-90, 0, 0]) cylinder(d = NK_M3[2], h = NK_M3[3] + 0.8 + eps, $fn = 24);
            if (nkvm_split) translate([0, -panel_t + eps, 0]) rotate([90, 0, 0]) cylinder(d = NK_M3[2], h = NK_M3[3] + 0.8 + eps, $fn = 24);
        }
    }
}
module nk_raised_mount() {
    L = nkvm_dims[0];
    x0 = nk_r_x0();
    if (x0 - nkvm_plugs[0] < -x_in + 1 || x0 + L + nkvm_plugs[1] > x_in - 1)
        echo("WARNING: the NanoKVM with its plugs (nkvm_plugs) is wider than the rack opening - shorter plugs");
    nk_r_plate();
    nk_r_mountain();
}

module nk_side_mount(n, types, xk) {
    if (!nk_plugs_fit())
        echo("WARNING: the NanoKVM with its plugs (nkvm_plugs) does not fit in the pocket - fewer keystones, shorter plugs or nkvm:front");
    nk_side_plate(n, types, xk);
    nk_side_bay();
}

// ---- front layout: lying flat behind the plate ----
// [x, y] of the board's Ethernet-end corner: centred, or right after the keystones so its port reads as one more in the row
function nk_place_front(lay = "front") = lay == "ks"
    ? [nk_ks_x0("ks") + ks_cw / 2 + nkvm_dims[2] / 2, nk_ks_rear + nkvm_patch]       // in line behind keystone 1
    : [nk_n_ks() > 0 ? nk_ks_x0() + nk_ks_w(nk_n_ks()) + 2 + nk_c + nk_pd + nkvm_dims[2] : nkvm_dims[2] / 2, nk_c];
// the board sits on a pedestal so its Ethernet port is centred in the plate, in line with the keystones
nk_zf = max(0, min(nk_h - nk_top - nk_lid_t - 0.5, nk_h / 2 - (nk_fl + nkvm_rj45[2] + nkvm_rj45[1] / 2)));
module nk_front_frame(lay = "front") translate([nk_place_front(lay)[0], nk_place_front(lay)[1], 0]) rotate(90) children();

module nk_tray_local(lay = "front") {
    L = nkvm_dims[0]; W = nkvm_dims[2];
    u0 = nk_u0(lay); u1 = nk_u1();
    v0 = -nk_c - nk_pd; v1 = W + nk_c + nk_pd;
    difference() {
        union() {
            // floor: one open frame, the board rests on its rim
            linear_extrude(nk_fl) difference() {
                nk_rrect(u0, v0, u1, v1, 3);
                nk_rrect(4, 3, L - 4, W - 3, 3);
            }
            linear_extrude(nk_top) nk_posts2d(lay, v0, v1);
        }
        // heat-set inserts from the top
        for (q = nk_posts(lay)) translate([q[0], q[1], nk_top - NK_M3[3] - 0.8]) cylinder(d = NK_M3[2], h = NK_M3[3] + 0.8 + eps, $fn = 24);
    }
}

module nkvm_mount(items) {
    lay = nk_layout(items);
    n = nk_nks(lay);
    if (lay == "side" && nkvm_keystones > 0)
        echo("NOTE: the standing NanoKVM bay has no room for keystones - use nkvm:ks to bring its network port to a keystone");
    h = nk_h;
    W = nkvm_dims[2];
    xk = nk_ks_x0(lay) + nk_ks_w(nk_nks(lay)) / 2;
    types = [for (i = [0 : max(n, 1) - 1]) ks_style == "metal" ? "rj45m" : "rj45"];
    if (len(items) > 1) echo("NOTE: the NanoKVM bay holds one board; extra items ignored");
    if (lay == "side") {
        if (W + 2 * (nk_c + nk_pd) > h - 2 * nk_wall - 1) echo("WARNING: the NanoKVM is too wide to stand in the 1U pocket - lower nkvm_dims[2]");
        if (nkvm_raised) nk_raised_mount(); else nk_side_mount(n, types, xk);
    } else {
        if (nk_zf + nk_top + nk_lid_t > h) echo("WARNING: the NanoKVM is too tall for the 1U bay - lower nkvm_dims[1]");
        nks = nk_nks(lay);
        kt = [for (i = [0 : max(nks, 1) - 1]) ks_style == "metal" ? "rj45m" : "rj45"];
        Pf = nk_place_front(lay);
        u0 = nk_u0(lay);
        rail = [Pf[0] - W - nk_c - nk_pd, Pf[0] + nk_c + nk_pd - 2.4];     // x of the two rails / pedestal walls
        if (lay == "ks") echo(str("NOTE: the NanoKVM bay is ", round(Pf[1] + nk_u1() + 2), " mm deep - patch cable about ",
                                  round(nkvm_patch + 55), " mm (10 cm) from keystone 1 to the NanoKVM"));
        difference() {
            union() {
                plate(panel_w, h, panel_t, 0.6);
                nk_front_frame(lay) {
                    translate([0, 0, nk_zf]) nk_tray_local(lay);
                    // the pedestal: two walls along the board and one across its back end
                    if (nk_zf > eps) {
                        for (v = [-nk_c - nk_pd, nkvm_dims[2] + nk_c + nk_pd - 2])
                            translate([u0, v, 0]) cube([nk_u1() - u0, 2, nk_zf + eps]);
                        translate([nk_u1() - 2, -nk_c - nk_pd, 0]) cube([2, nkvm_dims[2] + 2 * (nk_c + nk_pd), nk_zf + eps]);
                    }
                }
                // ks: two rails from the plate to the tray, under the keystone and the patch cable, with gussets
                if (lay == "ks") for (x = rail) {
                    translate([x, -eps, 0]) cube([2.4, Pf[1] + u0 + 2 * eps, nk_zf + nk_fl]);
                    translate([x, 0, 0]) multmatrix(YZ) linear_extrude(2.4)
                        polygon([[-eps, nk_zf + nk_fl - eps], [24, nk_zf + nk_fl - eps], [-eps, nk_zf + nk_fl + 10]]);
                }
                if (nks > 0) translate([xk, 0, 0]) keystone_add(nk_ks_w(nks) + 0.1, h, panel_t, kt);
            }
            panel_holes(panel_zs(1), panel_t, panel_hole_slot);
            if (nks > 0) translate([xk, 0, 0]) keystone_cut(nk_ks_w(nks) + 0.1, h, panel_t, kt);
            // front: the Ethernet port, through the plate
            if (lay == "front")
                translate([Pf[0] - W / 2 - (nkvm_rj45[0] + 1) / 2, -panel_t - 1, nk_zf + nk_fl + nkvm_rj45[2] - 0.5])
                    cube([nkvm_rj45[0] + 1, panel_t + 2, nkvm_rj45[1] + 1]);
        }
    }
}

// the lid: a frame on the four posts, open over the board and its heatsink, countersunk screws on top
module nkvm_lid_local(lay) {
    L = nkvm_dims[0]; W = nkvm_dims[2];
    difference() {
        hull() {
            linear_extrude(nk_lid_t - 0.6) nk_rrect(nk_u0(lay), -nk_c - nk_pd, nk_u1(), W + nk_c + nk_pd, 3);
            linear_extrude(nk_lid_t) offset(-0.6) nk_rrect(nk_u0(lay), -nk_c - nk_pd, nk_u1(), W + nk_c + nk_pd, 3);
        }
        translate([0, 0, -1]) linear_extrude(nk_lid_t + 2) nk_rrect(3, 3, L - 3, W - 3, 3);
        for (q = nk_posts(lay)) translate([q[0], q[1], 0]) {
            translate([0, 0, -1]) cylinder(d = NK_M3[0], h = nk_lid_t + 2, $fn = 20);
            translate([0, 0, nk_lid_t - 1.7]) cylinder(d1 = NK_M3[0], d2 = 6.4, h = 1.7 + eps, $fn = 24);
        }
    }
}
// the lid for printing: flat
module nkvm_lid_print(items) nkvm_lid_local(nk_layout(items));
// in place: side = standing in the pocket, its countersunk face to the front; front = on top of the posts
module nkvm_lid(items)
    if (nk_layout(items) == "side" && nkvm_raised)
        multmatrix([[1, 0, 0, nk_r_x0()], [0, 0, -1, nk_r_lb], [0, 1, 0, nk_zv0], [0, 0, 0, 1]]) nkvm_lid_local("side");
    else if (nk_layout(items) == "side")
        multmatrix([[1, 0, 0, nk_x0()], [0, 0, -1, nk_yp0], [0, 1, 0, nk_zv0], [0, 0, 0, 1]]) nkvm_lid_local("side");
    else nk_front_frame(nk_layout(items)) translate([0, 0, nk_zf + nk_top]) nkvm_lid_local(nk_layout(items));

// ---------------------------------------------------------------------
//  Raspberry Pi tray: boards flat on four standoffs, the port edge facing
//  the front window. Pi 5 / 4 / 3: USB + Ethernet in front, USB-C and HDMI
//  on the left side. Zero / Zero 2 W: HDMI and both micro USB in front.
//  Board coordinates: x from the left edge, y from the port edge backwards.
// ---------------------------------------------------------------------
// [width across the front, depth, mounting holes, front window [w, h above the board], port overhang]
function pi_spec(b) = b == "zero"
    ? [65, 30, [[3.5, 3.5], [61.5, 3.5], [3.5, 26.5], [61.5, 26.5]], [57, 9], 1.0]
    : [56, 85, [[3.5, 23.5], [52.5, 23.5], [3.5, 81.5], [52.5, 81.5]], [53, 17.5], 2.6];
function pi_list(items) = len(items) == 0 ? ["pi5"] : [for (i = [0 : min(len(items), 2) - 1]) items[i]];
pi_tw = 2 * x_in - 4;                                 // tray floor width (passes between the rack posts)
pi_zb = shelf_z + 2 + pi_standoff;                    // board underside above the module bottom
function pi_wsum(items) = sum_list([for (b = pi_list(items)) pi_spec(b)[0]]);
function pi_gap(items) = len(pi_list(items)) < 2 ? 0 : min(20, (pi_tw - 2 - pi_wsum(items)));
// left edge of each board; one big board sits to the right so its USB-C / HDMI plugs have room
function pi_x0s(items) = let(L = pi_list(items), g = pi_gap(items))
    len(L) == 1 ? [L[0] == "zero" ? -pi_spec("zero")[0] / 2 : pi_tw / 2 - 4 - pi_spec(L[0])[0]]
  : [-(pi_wsum(items) + g) / 2, -(pi_wsum(items) + g) / 2 + pi_spec(L[0])[0] + g];
function pi_fits(items) = pi_wsum(items) + (len(pi_list(items)) - 1) * 3 <= pi_tw - 2;

module pi_mount(items) {
    L = pi_list(items);
    x0 = pi_x0s(items);
    h = U - 0.79;
    d = max([for (b = L) pi_spec(b)[4] + pi_spec(b)[1]]) + 8;
    hole = pi_fixing == "heatset" ? 3.6 : 2.2;
    if (len(items) > 2) echo("WARNING: a Raspberry Pi tray takes 2 boards at most");
    if (!pi_fits(items)) echo(str("WARNING: the boards ", L, " do not fit side by side in one tray - use two trays"));
    else if (len(L) == 2 && L[0] != "zero" && L[1] != "zero")
        echo("NOTE: two boards side by side leave no room for USB-C plugs - power them with PoE HATs");
    // full-height side walls only where no board is in the way, low rails elsewhere
    function clear_at(x) = len([for (i = [0 : len(L) - 1]) if (x + 2 > x0[i] - 0.6 && x < x0[i] + pi_spec(L[i])[0] + 0.6) 1]) == 0;
    walls = [-pi_tw / 2, pi_tw / 2 - 2];
    difference() {
        union() {
            plate(panel_w, h, panel_t, 0.6);
            translate([-pi_tw / 2, -eps, shelf_z]) cube([pi_tw, d, 2]);
            for (x = walls) translate([x, -eps, shelf_z])
                cube([2, d, clear_at(x) ? 12 : pi_standoff + 1]);
            for (x = walls) if (clear_at(x)) translate([x, 0, 0])
                multmatrix(YZ) linear_extrude(2) polygon([[-eps, shelf_z + 2], [16, shelf_z + 2], [-eps, shelf_z + 18]]);
            // standoffs
            for (i = [0 : len(L) - 1], p = pi_spec(L[i])[2])
                translate([x0[i] + p[0], pi_spec(L[i])[4] + p[1], shelf_z + 2 - eps]) cylinder(d = 6.2, h = pi_standoff + eps, $fn = 28);
        }
        panel_holes(panel_zs(1), panel_t, panel_hole_slot);
        for (i = [0 : len(L) - 1]) {
            S = pi_spec(L[i]);
            // port window, from just under the board to the top of the tallest port
            translate([x0[i] + (S[0] - S[3][0]) / 2, -panel_t - 1, pi_zb + 0.4]) cube([S[3][0], panel_t + 2, S[3][1] + 1.4]);
            for (p = S[2]) translate([x0[i] + p[0], S[4] + p[1], shelf_z + 2 + pi_standoff - 6]) cylinder(d = hole, h = 6.5, $fn = 16);
            // airflow slots under the board, along the depth
            for (k = [0 : floor((S[0] - 20) / 9) - 1])
                translate([x0[i] + 10 + k * 9, S[4] + 10, shelf_z - 1]) cube([5, max(S[1] - 20, 4), 4]);
        }
    }
}

// any box W x H x D in a 1U tunnel (UniFi Flex Mini, UniFi Express...)
function dev_c(d) = [d[0] + mount_clear, d[1] + mount_clear, d[2] + mount_clear + 6];
module dev_mount(dims) {
    c = dev_c(dims);
    if (c[0] + 2 * mount_wall > 2 * x_in) echo("WARNING: the device mount is wider than the rack opening");
    if (c[1] + 2 * mount_wall > U - 0.79) echo("WARNING: the device is too tall for 1U");
    difference() {
        union() { plate(panel_w, U - 0.79, panel_t, 0.6); tunnel_add(0, c[0], c[1], c[2]); }
        panel_holes(panel_zs(1), panel_t, panel_hole_slot);
        tunnel_cut(0, c[0], c[1], c[2], dims[2]);
    }
}

// ---------------------------------------------------------------------
//  Rear PCI-slot bracket that replaces a slot cover. Print orientation:
//  plate flat on the bed (X width, Y length), top tab rising +Z.
//  lan   = keyhole: pass the RJ45 plugs through the round end, then slide the cables down the slot
//  power = round hole for the power cable + two zip-tie slots for strain relief
// ---------------------------------------------------------------------
PCI_W = 18.42;
PCI_L = 112;
module pci_bracket(kind = pci_kind) {
    t = pci_t;
    difference() {
        union() {
            translate([-PCI_W / 2, 0, 0]) cube([PCI_W, PCI_L, t]);
            translate([-5.1, -8, 0]) cube([10.2, 8 + eps, t]);                       // bottom tongue
            translate([-PCI_W / 2, PCI_L - t, 0]) cube([PCI_W, t, 11.4]);           // top tab
            translate([-PCI_W / 2, PCI_L - t - 3, t - eps]) multmatrix(YZ_X())      // fillet under the tab
                linear_extrude(PCI_W) polygon([[0, 0], [3, 0], [3, 3]]);
        }
        translate([-2.2, PCI_L - t - 1, 4.5]) cube([4.4, t + 2, 10]);                // screw notch in the tab
        if (kind == "lan") {
            translate([0, 92, -1]) cylinder(d = 13, h = t + 2, $fn = 48);
            hull() for (y = [24, 88]) translate([0, y, -1]) cylinder(d = 7, h = t + 2, $fn = 32);
        } else {
            translate([0, 80, -1]) cylinder(d = 9, h = t + 2, $fn = 40);
            for (x = [-4.6, 4.6]) translate([x - 0.9, 54, -1]) cube([1.8, 4.6, t + 2]);
        }
    }
}
function YZ_X() = [[0, 0, 1, 0], [1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0, 1]];

// 1U shelf for small devices (NanoKVM, Raspberry Pi, a small router...)
shelf_w = 2 * x_in - 8;

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
//  2U Raspberry Pi blades: up to four Pi 5 / 4 / 3 standing on edge, each
//  screwed to its own fin, the USB / Ethernet edge in a front window and
//  the USB-C / HDMI edge on top. Built front-down like the other modules:
//  the standoffs have a 45 degree chin so they print without supports.
// ---------------------------------------------------------------------
function blade_list(items) = let(L = [for (b = items) if (b != "zero") b])
    len(L) == 0 ? ["pi5"] : [for (i = [0 : min(len(L), 4) - 1]) L[i]];
blade_zb = shelf_z + 5;                               // bottom edge of the boards
blade_fin = 2;
function blade_span(n) = (n - 1) * pi_blade_pitch + blade_fin + pi_standoff + 1.4 + 17;
function blade_xf(items, i) = -blade_span(len(blade_list(items))) / 2 + i * pi_blade_pitch;   // left face of fin i
function blade_xb(items, i) = blade_xf(items, i) + blade_fin + pi_standoff;                    // board underside

module pi_blade_mount(items) {
    L = blade_list(items);
    n = len(L);
    h = 2 * U - 0.79;
    S = pi_spec("pi5");
    d = S[4] + S[1] + 8;
    fh = blade_zb + S[0] + 4 - shelf_z;                // fin height above the floor bottom
    hole = pi_fixing == "heatset" ? 3.6 : 2.2;
    if (len([for (b = items) if (b == "zero") 1]) > 0) echo("WARNING: Zero boards go in the flat pi tray, not in the blades");
    if (len(items) > 4) echo("WARNING: the blade tray takes 4 boards at most");
    if (blade_span(n) > pi_tw - 2) echo(str("WARNING: ", n, " blades at ", pi_blade_pitch, " mm do not fit between the rack posts - lower pi_blade_pitch or use fewer boards"));
    difference() {
        union() {
            plate(panel_w, h, panel_t, 0.6);
            translate([-pi_tw / 2, -eps, shelf_z]) cube([pi_tw, d, 2]);
            for (i = [0 : n - 1]) {
                xf = blade_xf(L, i);
                translate([xf, -eps, shelf_z]) cube([blade_fin, d, fh]);
                // standoffs with a chin towards the plate (the print bed)
                for (p = S[2]) translate([xf + blade_fin - eps, S[4] + p[1], blade_zb + S[0] - p[0]])
                    hull() {
                        translate([0, -3, -3]) cube([pi_standoff + eps, 6, 6]);
                        translate([0, -3 - pi_standoff, -3]) cube([eps, 6, 6]);
                    }
            }
            // rear tie bar across the fins tops
            translate([blade_xf(L, 0), d - 6, shelf_z + fh - 4]) cube([blade_xf(L, n - 1) - blade_xf(L, 0) + blade_fin, 6, 4]);
        }
        panel_holes(panel_zs(2), panel_t, panel_hole_slot);
        for (i = [0 : n - 1]) {
            xb = blade_xb(L, i);
            // port window: the jacks stand 17 mm off the board
            translate([xb - 1, -panel_t - 1, blade_zb + (S[0] - S[3][0]) / 2]) cube([1.4 + 18, panel_t + 2, S[3][0]]);
            for (p = S[2]) translate([xb - pi_standoff - 0.5, S[4] + p[1], blade_zb + S[0] - p[0]])
                rotate([0, 90, 0]) cylinder(d = hole, h = pi_standoff + 1, $fn = 16);
            // airflow windows in the fins, clear of the standoffs
            xf = blade_xf(L, i);
            for (y = [S[4] + 31, S[4] + 52]) translate([xf - 1, y, blade_zb + 12])
                cube([blade_fin + 2, 12, S[0] - 24]);
        }
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
    ow = (metal ? ksm_w : ks_w) + 2 * ks_fit - 2 * cover_clear;    // body that goes into the opening
    oh = (metal ? ksm_face_h : ks_h) + 2 * ks_fit - 2 * cover_clear;
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
        // one bay high, or up to the first tab groove so that fits too
        translate([x_in - eps, -ft - 1, min(frame_z0, 0) - 1])
            cube([fw / 2 - x_in + 1, sleeve_depth + ft + 2, len(tab_zs) > 0 ? bay_pitch + 6 : bay_h + 2]);
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

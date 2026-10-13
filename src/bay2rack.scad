// =====================================================================
//  bay2rack - 5.25" drive bay  ->  6" mini rack adapter (parametric)
//  License: CC BY-NC-SA 4.0 - see LICENSE
//
//  Units: mm.  Axes (assembly view):
//    X = width, Y = depth (+Y goes INTO the case), Z = height.
//    Y = 0 is the case front plane = front of a drive's metal chassis
//          (bay holes are measured from it) = back face of the front frame.
//    Z = 0 is the bottom of the lowest bay used.
//
//  Works with the OpenSCAD Customizer (Window > Customizer) and with
//  the parameter sets in bay2rack.json.  Values marked VERIFY are
//  best-known defaults: measure your own case / rack gear.
// =====================================================================

/* [Part to render] */
// What to render. "assembly" is a preview only, do not print it.
part = "assembly"; // [assembly:Assembly preview, adapter:Adapter - frame + sleeve, filler:Spare-zone filler panel, filler_2:Second filler - split mode, rack_panel:Standalone rack panel, test_rack:Test - rack hole spacing bar, test_bay:Test - bay screw corner, test_keystone:Test - keystone coupon]
// Lay printable parts front-face down on the bed
print_orientation = true;

/* [Drive bays] */
// Number of stacked 5.25" bays the adapter fills
bays = 3; // [1:1:6]
// Bay standard
bay_std = "sff"; // [sff:5.25in - SFF-8551 / EIA-741, custom:Custom]
custom_bay_w = 146.05;
custom_bay_h = 41.53;
// Bay-to-bay vertical pitch in a stacked cage (VERIFY)
custom_bay_pitch = 43.18;
// Width of a 5.25in drive bezel
custom_bezel_w = 148.0;
// Removed from the sleeve's total width
sleeve_clearance = 0.3;
// Removed from the stack height
height_clearance = 0.4;
// Side hole distance from the case front plane (VERIFY)
bay_hole_y1 = 47.40;
// Optional rear side hole (VERIFY)
bay_hole_y2 = 126.65;
use_hole_y2 = false;
// Side hole height above each bay's bottom (VERIFY)
bay_hole_z1 = 10.0;
bay_hole_z2 = 21.84;
use_hole_z2 = false;
// Shift all side holes in depth
bay_hole_offset = 0;
// Elongate side holes along depth (ignored for heat-set)
bay_hole_slot = 0; // [0:0.5:10]

/* [Front style] */
// plate = flat frame behind the rack panels.  bezel = exact 5.25in drive bezel, flush with the case front like an original drive
front_style = "plate"; // [plate:Plate frame, bezel:Exact 5.25in drive bezel]
// Single-bay drive bezel height (SFF-8551 - VERIFY)
bezel_h1 = 42.30;
// How far a drive bezel sits in front of the drive chassis = how deep your case front is (VERIFY)
bezel_depth = 8.0;
// Removed from bezel width and height so it slips into the case opening
bezel_clearance = 0.3;
// Cosmetic grooves where stacked drive bezels would meet
bezel_grooves = true;

/* [Fit mode] */
// flush = N-1 U + spare zone, nothing sticks out.  overhang = N bays = N U, rack panels stick out a few mm above/below
fit = "flush"; // [flush:Flush - inside the bay stack, overhang:Overhang - N bays = N U]
// Rack units to provide (0 = automatic)
units_override = 0; // [0:1:6]
// Where the extra height goes when there is no spare zone
overhang_align = "center"; // [center, top, bottom]
// Where the spare zone goes
spare_pos = "top"; // [top, bottom, split]
// Spare zones smaller than this become plain frame rim
min_spare = 4;

/* [Rack standard] */
// 6in wide, built with the 10in mini rack rules: EIA-310 holes, 1U = 44.45, same 8.74 mm edge-to-hole inset
rack_std = "6in"; // [6in:6in - 10in mini rack conventions, custom:Custom]
custom_panel_w = 152.4;
// Horizontal centre-to-centre distance between rack holes
custom_hole_spacing = 134.9;
// Height of one rack unit
rack_u_h = 44.45;
hole_pattern = "eia"; // [eia:EIA-310 - 3 holes per U, eia_outer:2 holes per U - outer, center:1 hole per U - centre, none:No holes]

/* [Rack hardware] */
// 10in mini rack convention: M6, 10-32 or 12-24
rack_screw = "M6"; // [M3, M4, M5, M6, 10-32, 12-24]
rack_screw_head = "button"; // [button:Button head - ISO 7380, socket:Socket head - ISO 4762, countersunk:Countersunk - ISO 10642, pan:Pan head - ISO 7045]
// Screw length in mm (0 = pick the right standard length automatically)
rack_screw_len = 0;
rack_fixing = "heatset"; // [heatset:Heat-set inserts, tap:Self-tapping pilot hole, nut_trap:Hex nut trap - back, square_nut:Square nut side slot, channel:Sliding square-nut channel - any height]
// Hole for your heat-set insert (0 = table value)
rack_insert_d = 0;
// Length of your heat-set insert (0 = table value)
rack_insert_l = 0;
// Ear thickness of your rack accessories (for screw length)
accessory_panel_t = 2.5;
// Horizontal elongation of rack holes, absorbs spacing differences (clearance-based fixings only)
rack_hole_slot = 0; // [0:0.5:6]

/* [Bay hardware] */
bay_screw = "M3"; // [M3, 6-32]
bay_screw_head = "pan"; // [pan:Pan head, button:Button head, socket:Socket head, countersunk:Countersunk]
// Screw length in mm (0 = automatic)
bay_screw_len = 0;
bay_fixing = "heatset"; // [heatset:Heat-set insert, tap:Self-tapping pilot hole, nut:Hex nut pocket inside, clearance:Plain clearance + loose nut, none:No holes]
bay_insert_d = 0;
bay_insert_l = 0;
// Sheet thickness of your drive cage (for screw length)
case_wall_t = 0.8;

/* [Frame and sleeve] */
// Front frame width (0 = bezel width, 148)
frame_w_override = 0;
// Plate-style frame thickness (bezel style uses bezel_depth)
frame_t = 4;
frame_chamfer = 0.8;
// Rim kept above/below every opening
frame_rim = 2.5;
// Depth of the rack-screw posts behind the frame
post_d = 10;
wall_t = 2.4;
// How deep the sleeve goes into the bay
sleeve_depth = 62;
sleeve_style = "rails"; // [rails:Side rails only, box:Side + top and bottom plates]
// Cut print-friendly windows in walls and plates
lighten = true;

/* [Spare-zone filler] */
// separate = screw-on panel you can swap (modular).  integral = features cut into the frame
filler_mode = "separate"; // [separate:Separate screw-on panel, integral:Cut into the frame]
spare_fill = "keystone"; // [blank, keystone, vent, cable, led, label]
// Fill of the top zone when spare_pos = split
spare_fill_2 = "vent"; // [blank, keystone, vent, cable, led, label]
filler_t = 3;
label_text = "HOMELAB";

/* [Keystone patch] */
ks_ports = 6; // [1:1:12]
// Keystone cut-out (standard jack ~14.5 x 16.0)
ks_w = 14.9;
ks_h = 16.4;
ks_pitch = 19.0;
// Plate thickness where the jack clips in
ks_plate_t = 2.0;
ks_labels = true;
ks_label_start = 1;

/* [Standalone rack panel] */
panel_u = 1; // [1:1:4]
panel_fill = "keystone"; // [blank, keystone, vent, cable, led, label]
panel_t = 3;
// Horizontal slotting of panel holes
panel_hole_slot = 2; // [0:0.5:6]

/* [Preview] */
explode = 0; // [0:1:60]
show_case = true;
show_devices = true;
// Draw screws, inserts and nuts
show_hardware = true;
// Cut the assembly open to see the hardware inside
section = "none"; // [none:No cut, rack_row:Horizontal cut through a rack hole row, rack_column:Vertical cut through the right rack holes, bay:Cut through the bay screws]

/* [Hidden] */
$fn = 40;
eps = 0.01;

// ---------------------------------------------------------------------
//  Hardware table
//  [clear, tap, heatset_d, heatset_l, nut_af, nut_t, sq_w, sq_t, d_nominal]
//  Heat-set values follow common standard inserts - override above.
// ---------------------------------------------------------------------
function hw(s) =
    s == "M3"    ? [3.4, 2.6, 4.2,  5.7, 5.5,  2.4, 5.5,  1.8, 3.0] :
    s == "M4"    ? [4.5, 3.5, 5.6,  8.1, 7.0,  3.2, 7.0,  2.2, 4.0] :
    s == "M5"    ? [5.5, 4.4, 6.4,  9.5, 8.0,  4.0, 8.0,  2.7, 5.0] :
    s == "M6"    ? [6.6, 5.2, 8.0, 12.7, 10.0, 5.0, 10.0, 3.2, 6.0] :
    s == "6-32"  ? [3.7, 2.9, 4.4,  4.8, 7.94, 2.4, 7.94, 2.4, 3.51] :
    s == "10-32" ? [5.1, 4.2, 6.4,  9.5, 9.53, 3.2, 9.53, 3.2, 4.83] :
    s == "12-24" ? [5.8, 4.7, 7.1,  9.5, 11.1, 4.0, 11.1, 3.2, 5.49] :
                   [3.4, 2.6, 4.2,  5.7, 5.5,  2.4, 5.5,  1.8, 3.0];

function with_insert(v, d, l) = [v[0], v[1], d > 0 ? d : v[2], l > 0 ? l : v[3], v[4], v[5], v[6], v[7], v[8]];

// [head diameter, head height]
function head_dims(h, d) =
    h == "button"      ? [1.75 * d, 0.55 * d] :
    h == "socket"      ? [1.5 * d + 1, d] :
    h == "countersunk" ? [2 * d, d / 2] :
                         [2 * d, 0.75 * d];
function head_name(h) = h == "button" ? "button head" : h == "socket" ? "socket head"
                      : h == "countersunk" ? "countersunk" : "pan head";

METRIC_LEN = [3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 25, 30, 35, 40, 45, 50];
IMP_LEN    = [3.18, 4.76, 6.35, 7.94, 9.53, 12.7, 15.88, 19.05, 22.23, 25.4, 31.75, 38.1];
IMP_NAME   = ["1/8", "3/16", "1/4", "5/16", "3/8", "1/2", "5/8", "3/4", "7/8", "1", "1-1/4", "1-1/2"];
function is_imp(s) = s == "6-32" || s == "10-32" || s == "12-24";
function pick_len(s, r) =
    let(c = [for (l = is_imp(s) ? IMP_LEN : METRIC_LEN) if (l >= r[0] - 0.01 && l <= r[1] + 0.01) l])
    len(c) > 0 ? c[0] : -1;
function screw_len(s, user, r) = user > 0 ? user : let(p = pick_len(s, r)) (p > 0 ? p : ceil(r[0]));
function len_str(s, l) = is_imp(s)
    ? let(m = [for (i = [0 : len(IMP_LEN) - 1]) if (abs(IMP_LEN[i] - l) < 0.05) IMP_NAME[i]])
      (len(m) > 0 ? str(m[0], "in") : str(l, "mm"))
    : str(l);

// ---------------------------------------------------------------------
//  Derived values
// ---------------------------------------------------------------------
bay_w     = bay_std == "sff" ? 146.05 : custom_bay_w;
bay_h     = bay_std == "sff" ? 41.53  : custom_bay_h;
bay_pitch = bay_std == "sff" ? 43.18  : custom_bay_pitch;
bezel_w   = bay_std == "sff" ? 148.0  : custom_bezel_w;

stack_raw = (bays - 1) * bay_pitch + bay_h;
stack_h   = stack_raw - height_clearance;
sw        = (bay_w - sleeve_clearance) / 2;           // sleeve outer half width

bezel_mode = front_style == "bezel";
ft      = bezel_mode ? bezel_depth : frame_t;          // front thickness
fw      = frame_w_override > 0 ? frame_w_override : bezel_mode ? bezel_w - bezel_clearance : bezel_w;
base_h  = bezel_mode ? stack_raw - bay_h + bezel_h1 - bezel_clearance : stack_h;
base_z0 = bezel_mode ? -(bezel_h1 - bay_h - bezel_clearance) / 2 : 0;

// 10in mini rack: 254 mm panel, 236.525 mm hole spacing -> 8.7375 mm edge inset
U       = rack_u_h;
panel_w = rack_std == "6in" ? 152.4 : custom_panel_w;
hole_s  = rack_std == "6in" ? 152.4 - (254 - 236.525) : custom_hole_spacing;

units   = units_override > 0 ? units_override
        : fit == "overhang" ? bays : floor((base_h + 0.001) / U);
grow    = !bezel_mode && fit == "overhang";           // plate frame grows to N U
frame_h = grow ? max(units * U, base_h) : base_h;
frame_z0 = !grow ? base_z0
         : overhang_align == "top"    ? stack_h - frame_h
         : overhang_align == "bottom" ? 0
         : (stack_h - frame_h) / 2;
frame_z1 = frame_z0 + frame_h;
spare     = frame_h - units * U;
has_spare = spare >= min_spare;

sp_bot = !has_spare ? 0 : spare_pos == "bottom" ? spare : spare_pos == "split" ? spare / 2 : 0;
sp_top = !has_spare ? 0 : spare_pos == "top"    ? spare : spare_pos == "split" ? spare / 2 : 0;
units_z0 = has_spare ? frame_z0 + sp_bot
         : overhang_align == "top"    ? frame_z1 - units * U
         : overhang_align == "bottom" ? frame_z0
         : frame_z0 + spare / 2;

// zones: [z0, height, fill]
zones = concat(
    sp_bot > 0 ? [[frame_z0, sp_bot, spare_fill]] : [],
    sp_top > 0 ? [[frame_z1 - sp_top, sp_top, spare_pos == "split" ? spare_fill_2 : spare_fill]] : []);

R = with_insert(hw(rack_screw), rack_insert_d, rack_insert_l);
B = with_insert(hw(bay_screw), bay_insert_d, bay_insert_l);

// rack posts
r_feat = rack_fixing == "heatset"    ? R[2]
       : rack_fixing == "tap"        ? R[1]
       : rack_fixing == "nut_trap"   ? R[4] / cos(30) + 0.3
       : rack_fixing == "square_nut" ? R[6] + 0.5
       :                               R[6] + 0.6;
r_slot  = (rack_fixing == "heatset" || rack_fixing == "tap") ? 0 : rack_hole_slot;
post_in = r_feat / 2 + 2.4 + r_slot / 2;
x_in    = hole_s / 2 - post_in;                       // half width of the opening
T_post  = ft + post_d;
pz0 = max(frame_z0, 0);
pz1 = min(frame_z1, stack_h);

function pat(p) = p == "eia" ? [6.35, 22.225, 38.1]
                : p == "eia_outer" ? [6.35, 38.1]
                : p == "center" ? [22.225] : [];
rack_zs = units > 0 ? [for (u = [0 : units - 1]) for (o = pat(hole_pattern)) units_z0 + u * U + o] : [];

// bay holes
bay_ys = concat([bay_hole_y1 + bay_hole_offset], use_hole_y2 ? [bay_hole_y2 + bay_hole_offset] : []);
bay_zo = concat([bay_hole_z1], use_hole_z2 ? [bay_hole_z2] : []);
bay_zs = [for (k = [0 : bays - 1]) for (o = bay_zo) k * bay_pitch + o];
b_feat = bay_fixing == "heatset" ? B[2] : bay_fixing == "tap" ? B[1]
       : bay_fixing == "nut" ? B[4] / cos(30) + 0.3 : B[0];
b_slot = bay_fixing == "heatset" ? 0 : bay_hole_slot;
boss_l = bay_fixing == "heatset" ? max(0, B[3] + 0.8 - wall_t)
       : bay_fixing == "tap"     ? max(0, 6 - wall_t)
       : bay_fixing == "nut"     ? B[5] + 1.6
       : 0;
boss_d = b_feat + 4.4;
b_len  = wall_t + boss_l;                             // hole length from the outer face

// screw length ranges [min, max], measured from under the head (countersunk: from the surface)
function rack_range(pt) =
    rack_fixing == "heatset"    ? [pt + 0.7 * R[3], pt + R[3] + 0.5]
  : rack_fixing == "tap"        ? [pt + ft + 2, pt + T_post - 1.7]
  : rack_fixing == "nut_trap"   ? [pt + T_post - 0.4, pt + T_post + 5]
  : rack_fixing == "square_nut" ? [pt + ft + 1.6 + R[7], pt + T_post - 1.8]
  :                               [pt + ft + 0.5 + R[7], pt + ft + R[7] + 4.2];
bay_range = bay_fixing == "heatset" ? [case_wall_t + 0.7 * B[3], case_wall_t + B[3] + 0.5]
          : bay_fixing == "tap"     ? [case_wall_t + wall_t + 1, case_wall_t + b_len - 0.3]
          : bay_fixing == "nut"     ? [case_wall_t + b_len, case_wall_t + b_len + 3]
          :                           [case_wall_t + wall_t + B[5] + 0.5, case_wall_t + wall_t + B[5] + 4];
rack_r_dev  = rack_range(accessory_panel_t);
rack_r_fill = rack_range(filler_t);
rack_L_dev  = screw_len(rack_screw, rack_screw_len, rack_r_dev);
rack_L_fill = screw_len(rack_screw, rack_screw_len, rack_r_fill);
bay_L       = screw_len(bay_screw, bay_screw_len, bay_range);

// ---------------------------------------------------------------------
//  Report + bill of materials
// ---------------------------------------------------------------------
echo(str("bay2rack | bays=", bays, " stack=", stack_h, "mm | front=", front_style, " | fit=", fit,
         " | units=", units, "U (", units * U, "mm) | spare=", spare,
         "mm | frame=", fw, "x", frame_h, "x", ft, "mm | opening=", 2 * x_in,
         "mm | hole spacing=", hole_s, "mm"));

function fix_str(f, H, s) =
    f == "heatset" ? str(s, " heat-set insert (hole ", H[2], " x ", H[3], " mm)")
  : (f == "nut_trap" || f == "nut" || f == "clearance") ? str(s, " hex nut (", H[4], " mm AF)")
  : (f == "square_nut" || f == "channel") ? str(s, " square nut (", H[6], " mm)")
  : "";
module bom(label, n, s, L, head, f, H)
    if (n > 0) echo(str("BOM | ", label, ": ", n, " x ", s, " x ", len_str(s, L), " ", head_name(head),
                        fix_str(f, H, s) == "" ? "" : str("  +  ", n, " x ", fix_str(f, H, s))));
n_dev  = 2 * len(rack_zs);
n_fill = filler_mode == "separate" ? 2 * len(zones) : 0;
n_bay  = bay_fixing == "none" ? 0 : 2 * len(bay_ys) * len(bay_zs);
bom("rack accessories", n_dev, rack_screw, rack_L_dev, rack_screw_head, rack_fixing, R);
bom("filler panels", n_fill, rack_screw, rack_L_fill, rack_screw_head, rack_fixing, R);
bom("drive bay", n_bay, bay_screw, bay_L, bay_screw_head, bay_fixing, B);

module check_len(label, s, L, r)
    if (L < r[0] - 0.01 || L > r[1] + 0.01)
        echo(str("WARNING: ", label, " screw length ", L, "mm is outside the usable range ",
                 r[0], "-", r[1], "mm", pick_len(s, r) < 0 ? " (no standard length fits - adjust post_d or the fixing)" : ""));
if (n_dev > 0)  check_len("rack", rack_screw, rack_L_dev, rack_r_dev);
if (n_fill > 0) check_len("filler", rack_screw, rack_L_fill, rack_r_fill);
if (n_bay > 0)  check_len("bay", bay_screw, bay_L, bay_range);

if (!bezel_mode && fit == "flush" && units * U > frame_h + 0.01)
    echo("WARNING: units do not fit in the frame - lower units_override or use overhang");
if (bezel_mode && units * U > frame_h + 0.01)
    echo(str("NOTE: rack panels overlap the case front by ", (units * U - frame_h) / 2, "mm above and below the bezel"));
if (hole_s / 2 + r_feat / 2 + 1.2 > fw / 2)
    echo("WARNING: rack holes are too close to the frame edge - wider frame or smaller screws");
if (rack_fixing == "heatset" && T_post < R[3] + 1)
    echo("WARNING: posts too shallow for these heat-set inserts - raise post_d");
if (rack_screw_head == "countersunk" && (head_dims("countersunk", R[8])[0] + 0.4 - R[0]) / 2 > min(filler_t, panel_t))
    echo("WARNING: countersunk heads are deeper than the filler/panel thickness");
if (frame_h > 250)
    echo("WARNING: part is taller than 250 mm - check your print bed");
if (max(bay_ys) + boss_d / 2 + 2 > sleeve_depth)
    echo("WARNING: bay screw holes are deeper than the sleeve - raise sleeve_depth");
for (z = rack_zs) {
    if (z - r_feat / 2 < frame_z0 + 0.8 || z + r_feat / 2 > frame_z1 - 0.8)
        echo(str("WARNING: rack hole at z=", z, " breaks out of the frame edge - smaller screws or another hole_pattern"));
    else if (z - r_feat / 2 < pz0 || z + r_feat / 2 > pz1)
        echo(str("WARNING: rack hole at z=", z, " is outside the posts (only the frame holds it)"));
}

// ---------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------
// 2D children drawn in X-Z (child Y = Z), extruded from y0 towards +Y
module xz_extrude(y0, depth)
    translate([0, y0, 0]) rotate([90, 0, 0]) mirror([0, 0, 1])
        linear_extrude(depth) children();

// cylinder along +Y, elongated along X by len
module slot_y(d, len, y0, L)
    hull() for (s = [-1, 1]) translate([s * len / 2, y0, 0])
        rotate([-90, 0, 0]) cylinder(d = d, h = L);

module rslot2d(w, h) {
    r = min(w, h) / 2;
    offset(r = r) square([max(w - 2 * r, 0.01), max(h - 2 * r, 0.01)], center = true);
}

// plate centred in X, z in [0,h], y in [-t,0], chamfered front edges
module plate(w, h, t, c = 0.8) {
    hull() {
        translate([-w / 2 + c, -t, c]) cube([w - 2 * c, eps, h - 2 * c]);
        translate([-w / 2, -t + c, 0]) cube([w, t - c, h]);
    }
}

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

module keystone_cut(w, h, t) {
    pw = ks_w + 3;
    ph = ks_h + 7;
    cell = ph + 1;
    per_row = max(1, floor((w - 2) / ks_pitch));
    rows = ceil(ks_ports / per_row);
    need = rows * cell + (ks_labels ? 2 : 0);
    if (need > h || pw > w)
        echo(str("WARNING: ", ks_ports, " keystones need ", need, "mm of height, zone has ", h, "mm - skipped"));
    else for (r = [0 : rows - 1]) {
        n = min(per_row, ks_ports - r * per_row);
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
        translate([sw - 22, -ft - 1, min(frame_z0, 0) - 1]) cube([fw / 2 - sw + 23, sleeve_depth + ft + 2, bay_h + 2]);
    }
}

module test_keystone()
    difference() {
        plate(ks_w + 10, ks_h + 14, filler_t, 0.6);
        keystone_cut(ks_w + 10, ks_h + 14, filler_t);
    }

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

module assembly() {
    section_cut() color([0.92, 0.55, 0.2]) adapter();
    for (zn = zones)
        section_cut() color([0.25, 0.6, 0.85]) translate([0, -ft - 2 * explode, zn[0] + 0.4]) filler_panel(zn);
    if (show_devices) section_cut() dummy_devices();
    if (show_hardware) section_cut() hardware();
    if (show_case && section == "none") case_ghost();
}

// ---------------------------------------------------------------------
//  Dispatch
// ---------------------------------------------------------------------
module printable(t) {
    if (print_orientation) translate([0, 0, t]) rotate([90, 0, 0]) children();
    else children();
}

if (part == "assembly") assembly();
else if (part == "adapter") printable(ft) translate([0, 0, -frame_z0]) adapter();
else if (part == "filler") {
    if (len(zones) > 0) printable(filler_t) filler_panel(zones[0]);
    else echo("WARNING: no spare zone in this configuration");
}
else if (part == "filler_2") {
    if (len(zones) > 1) printable(filler_t) filler_panel(zones[1]);
    else echo("WARNING: no second spare zone (use spare_pos = split)");
}
else if (part == "rack_panel") printable(panel_t) rack_panel();
else if (part == "test_rack") printable(ft) test_rack();
else if (part == "test_bay") printable(ft) test_bay();
else if (part == "test_keystone") printable(filler_t) test_keystone();

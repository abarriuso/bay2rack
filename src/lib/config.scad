// bay2rack - Derived dimensions, checks and bill of materials (needs the parameters)
// Part of bay2rack.scad (included after the parameters). License: CC BY-NC-SA 4.0

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

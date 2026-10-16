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

units   = fit == "panel" ? 0 : units_override > 0 ? units_override
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

sp_bot = !has_spare ? 0 : spare_pos == "bottom" ? spare : spare_pos == "split" ? spare * spare_split : 0;
sp_top = !has_spare ? 0 : spare_pos == "top"    ? spare : spare_pos == "split" ? spare * (1 - spare_split) : 0;
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

// keystone port types and rack contents
ks_types  = ks_ports_list == "" ? [for (i = [0 : max(ks_ports, 1) - 1]) ks_style == "metal" ? "rj45m" : "rj45"]
          : str_split(ks_ports_list);
rack_mods = str_split(rack_modules);
// "kvm:jet+nano" -> kind "kvm", items ["jet", "nano"]; a bare "kvm" / "pi" takes kvm_boxes / pi_boards
// ("kvm2" is the old name of the JetKVM + NanoKVM tray)
function mod_kind(m) = let(p = str_split(m, ":")) len(p) == 0 ? "blank" : p[0] == "kvm2" ? "kvm" : p[0];
function mod_items(m) = let(p = str_split(m, ":"), k = mod_kind(m))
    len(p) > 1 ? str_split(p[1], "+")
  : m == "kvm2" ? ["jet", "nano"]
  : k == "kvm" ? str_split(kvm_boxes, "+")
  : k == "pi" ? str_split(pi_boards, "+")
  : [];
function mod_u(m) = mod_kind(m) == "piblade" ? 2 : 1;                 // rack units taken by a module
// modules placed from the top: [module, bottom unit (0 = bottom)]; one that no longer fits becomes a blank
function place_mods(i, top) =
    top <= 0 ? []
  : i >= len(rack_mods) ? concat([["blank", top - 1]], place_mods(i, top - 1))
  : mod_u(rack_mods[i]) <= top ? concat([[rack_mods[i], top - mod_u(rack_mods[i])]], place_mods(i + 1, top - mod_u(rack_mods[i])))
  : concat([["blank", top - 1]], place_mods(i + 1, top - 1));
placed_mods = units > 0 ? place_mods(0, units) : [];
used_mods = [for (p = placed_mods) p[0]];
// modules counted in the BOM: every unit of the assembly, or the one module being made
bom_mods = part == "assembly" ? used_mods : part == "rack_module" ? [module_type] : [];

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
// screws for what this part is: the whole assembly, or just the piece being printed
bom_adapter = part == "assembly" || part == "adapter";
bom("rack accessories", bom_adapter ? n_dev : 0, rack_screw, rack_L_dev, rack_screw_head, rack_fixing, R);
bom("filler panels", part == "assembly" ? n_fill : (part == "filler" || part == "filler_2") && filler_mode == "separate" ? 2 : 0,
    rack_screw, rack_L_fill, rack_screw_head, rack_fixing, R);
bom("drive bay", bom_adapter ? n_bay : 0, bay_screw, bay_L, bay_screw_head, bay_fixing, B);
bom("rack module", part == "rack_module" ? 2 * len(panel_zs(mod_u(module_type))) : 0, rack_screw, rack_L_dev, rack_screw_head, rack_fixing, R);
bom("rack panel", part == "rack_panel" ? 2 * len(panel_zs(panel_u)) : 0, rack_screw, rack_L_dev, rack_screw_head, rack_fixing, R);
// keystone jacks and covers: one set per patch panel
n_patch = part == "rack_panel" ? (panel_fill == "keystone" ? 1 : 0)
        : part == "rack_module" ? (module_type == "patch" ? 1 : 0)
        : (part == "assembly" || (part == "adapter" && filler_mode != "separate")
           || ((part == "filler" || part == "filler_2") && filler_mode == "separate"))
          ? len([for (zn = zones) if (zn[2] == "keystone") 1])
            + len([for (m = bom_mods) if (m == "patch") 1])
        : 0;
function ks_count(tp) = n_patch * len([for (x = ks_types) if (x == tp) 1]);
KS_NAMES = [["rj45m", "metal / shielded RJ45 keystone"], ["rj45", "RJ45 keystone"], ["hdmi", "HDMI keystone"],
            ["usb", "USB keystone"], ["rca", "RCA keystone"], ["jack", "3.5 mm audio keystone"], ["toslink", "Toslink optical keystone"],
            ["cover", "printed keystone cover"], ["pass", "printed cable pass-through cover"]];
for (k = KS_NAMES) if (ks_count(k[0]) > 0) echo(str("BOM | keystones: ", ks_count(k[0]), " x ", k[1]));
function ties_of(m) = mod_kind(m) == "kvm" ? len(mod_items(m))
    : (m == "ms105g" || m == "shelf" || m == "uswflex" || m == "ux" || m == "dev1" || m == "dev2") ? 1 : 0;
n_ties = sum_list([for (m = bom_mods) ties_of(m)]);
n_pi = sum_list([for (m = bom_mods) mod_kind(m) == "pi" ? len(pi_list(mod_items(m)))
                                      : mod_kind(m) == "piblade" ? len(blade_list(mod_items(m))) : 0]);
if (n_pi > 0) echo(str("BOM | Raspberry Pi: ", 4 * n_pi, " x M2.5 x 6 screw",
    pi_fixing == "heatset" ? str(" + ", 4 * n_pi, " x M2.5 heat-set insert (hole 3.6 mm)") : " (self-tapping into the standoffs)"));
// NanoKVM bay: the lid screws onto four heat-set inserts
n_nkvm = part == "rack_module_lid" ? (mod_kind(module_type) == "nkvm" ? 1 : 0) : len([for (m = bom_mods) if (mod_kind(m) == "nkvm") 1]);
n_nkvm_split = nkvm_split && (part == "rack_module_bay" || part == "rack_module" || part == "assembly")
    ? len([for (m = part == "assembly" ? used_mods : [module_type]) if (mod_kind(m) == "nkvm" && mod_items(m)[0] != "front") 1]) : 0;
if (n_nkvm > 0) echo(str("BOM | NanoKVM bay lid: ", 4 * n_nkvm, " x M3 x 8 countersunk  +  ", 4 * n_nkvm,
    " x M3 heat-set insert (hole ", hw("M3")[2], " x ", hw("M3")[3], " mm)"));
if (n_nkvm_split > 0) echo(str("BOM | NanoKVM bay plate to pocket: ", 4 * n_nkvm_split, " x M3 x 8 countersunk  +  ", 4 * n_nkvm_split,
    " x M3 heat-set insert"));
n_btn = part == "rack_panel" ? (panel_fill == "buttons" ? 1 : 0)
      : part == "rack_module" ? (module_type == "buttons" ? 1 : 0)
      : (part == "assembly" || (part == "adapter" && filler_mode != "separate")
         || ((part == "filler" || part == "filler_2") && filler_mode == "separate"))
        ? len([for (zn = zones) if (zn[2] == "buttons") 1])
          + (part == "assembly" ? len([for (m = used_mods) if (m == "buttons") 1]) : 0)
      : 0;
if (n_btn > 0) {
    echo(str("BOM | buttons: ", n_btn * btn_count, " x Cherry MX compatible keyboard switch + 1u keycap (",
             btn_count >= 2 ? "power, reset" : "power", ")"));
    echo(str("BOM | buttons: ", n_btn * 2, " x ", led_d, " mm dome LED (power, disk activity) + front-panel header wires"));
}
n_fan = part == "rack_panel" ? (panel_fill == "fan80" ? 1 : 0)
      : (part == "assembly" || (part == "adapter" && filler_mode != "separate")
         || ((part == "filler" || part == "filler_2") && filler_mode == "separate"))
        ? len([for (zn = zones) if (zn[2] == "fan80" && zn[1] - (filler_mode == "separate" ? 0.8 : 0) >= 82) 1]) : 0;
if (n_fan > 0) echo(str("BOM | fan: ", n_fan, " x 80 mm fan (80 x 80 x 25) + ", 4 * n_fan, " x fan screws"));
n_fan40 = fan40_count * (part == "rack_panel" ? (panel_fill == "fan40" ? 1 : 0)
      : len([for (m = bom_mods) if (m == "fan40") 1])
        + ((part == "assembly" || (part == "adapter" && filler_mode != "separate")
            || ((part == "filler" || part == "filler_2") && filler_mode == "separate"))
           ? len([for (zn = zones) if (zn[2] == "fan40" && zn[1] - (filler_mode == "separate" ? 0.8 : 0) >= 41) 1]) : 0));
if (n_fan40 > 0) echo(str("BOM | fans: ", n_fan40, " x 40 mm fan (40 x 40 x ", fan40_t, ") + ", 4 * n_fan40,
                         " x M3 x ", fan40_t + 6, " screw + nut (5 or 12 V, to a fan header)"));
if ((part == "assembly" && rear_slots) || part == "pci_bracket")
    echo(str("BOM | rear slots: ", part == "pci_bracket" ? 1 : 2, " x printed PCI-slot bracket",
             part == "pci_bracket" ? (pci_kind == "lan" ? " (network cables)" : " (power cable)") : " (network cables, power cable)", " + the case's slot screws"));
if (n_ties > 0) echo(str("BOM | zip ties: ", 2 * n_ties, " x 2.5-3.6 mm cable tie (holds the device)"));

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
//  Parameter checks: values that are in range one by one but do not go together
// ---------------------------------------------------------------------
KS_TYPES = ["rj45m", "rj45", "hdmi", "usb", "rca", "jack", "toslink", "cover", "pass", "none"];
MOD_KINDS = ["ms105g", "kvm", "kvm2", "pi", "piblade", "nkvm", "uswflex", "ux", "dev1", "dev2", "shelf", "patch",
             "fan40", "buttons", "vent", "blank", "cable", "led", "label"];
function known(x, list) = len([for (y = list) if (y == x) 1]) > 0;
for (tp = ks_types) if (!known(tp, KS_TYPES)) echo(str("WARNING: unknown keystone type '", tp, "' in ks_ports_list - use ", KS_TYPES));
for (m = concat(rack_mods, [module_type])) if (!known(mod_kind(m), MOD_KINDS))
    echo(str("WARNING: unknown rack module '", m, "' - it is made as a blank panel"));
for (m = rack_mods) {
    k = mod_kind(m);
    for (b = mod_items(m)) if (!known(b, k == "kvm" ? ["jet", "nano", "custom"] : k == "nkvm" ? ["side", "front"]
                                        : (k == "pi" || k == "piblade") ? ["pi5", "pi4", "pi3", "zero"] : [b]))
        echo(str("WARNING: '", b, "' is not a box of the ", k, " module (", m, ")"));
}
if (fw < bay_w - 2 * sleeve_clearance)
    echo("WARNING: frame_w_override is narrower than the sleeve - the frame no longer covers the bay");
if (custom_hole_spacing > custom_panel_w - 8 && rack_std == "custom")
    echo("WARNING: custom_hole_spacing puts the rack holes outside the panel - lower it or widen custom_panel_w");
for (z = concat([bay_hole_z1], use_hole_z2 ? [bay_hole_z2] : []))
    if (z < 3 || z > bay_h - 3) echo(str("WARNING: bay side hole at ", z, " mm is outside the bay height (", bay_h, " mm)"));
if (use_hole_y2 && abs(bay_hole_y2 - bay_hole_y1) < 10)
    echo("WARNING: the two bay side holes are less than 10 mm apart - turn use_hole_y2 off");
if (rear_slots && pci_lan_slot == pci_power_slot)
    echo("WARNING: pci_lan_slot and pci_power_slot are the same slot");
if (bezel_mode && bezel_depth > sleeve_depth)
    echo("WARNING: bezel_depth is deeper than the sleeve - raise sleeve_depth");
if (mount_lip * 2 >= min(ms_w, ms_h))
    echo("WARNING: mount_lip closes the switch window - lower it");

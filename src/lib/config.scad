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
// a patch module's own ports: "patch:rj45m=NAS+hdmi+cover" (type, = its name with _ for spaces); a bare "patch"
// takes ks_ports_list / ks_names like the strip.  A label module's own text: "label:MY_LAB"; a bare "label" says label_text
function patch_types(m) = let(it = mod_items(m)) len(it) == 0 ? ks_types : [for (x = it) let(p = str_split(x, "=")) len(p) > 0 ? p[0] : "none"];
function patch_names(m) = let(it = mod_items(m)) len(it) == 0 ? PORT_NAMES
    : [for (x = it) let(p = str_split(x, "=")) len(p) > 1 ? unscore(p[1]) : ""];
function label_of(m) = let(a = str_after(m, ":")) a == "" ? label_text : unscore(a);
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
// auto: EIA-310 inside the bays; one centred hole per U when the units stick out (the outer EIA holes would break out of the frame)
hole_pat = hole_pattern == "auto" ? (fit == "overhang" ? "center" : "eia") : hole_pattern;
rack_zs = units > 0 ? [for (u = [0 : units - 1]) for (o = pat(hole_pat)) units_z0 + u * U + o] : [];

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
  : f == "adapter" ? "(into the adapter's fixings - nothing else to buy)"
  : "";
module bom(label, n, s, L, head, f, H)
    if (n > 0) echo(str("BOM | ", label, ": ", n, " x ", s, " x ", len_str(s, L), " ", head_name(head),
                        f == "adapter" ? str("  ", fix_str(f, H, s))
                      : fix_str(f, H, s) == "" ? "" : str("  +  ", n, " x ", fix_str(f, H, s))));
n_dev  = 2 * len(rack_zs);
n_fill = filler_mode == "separate" ? 2 * len(zones) : 0;
n_bay  = bay_fixing == "none" ? 0 : 2 * len(bay_ys) * len(bay_zs);
// screws for what this part is: the whole assembly, or just the piece being printed
bom_adapter = part == "assembly" || part == "adapter";
bom("rack accessories", bom_adapter ? n_dev : 0, rack_screw, rack_L_dev, rack_screw_head, rack_fixing, R);
bom("filler panels", part == "assembly" ? n_fill : (part == "filler" || part == "filler_2") && filler_mode == "separate" ? 2 : 0,
    rack_screw, rack_L_fill, rack_screw_head, rack_fixing, R);
bom("drive bay", bom_adapter ? n_bay : 0, bay_screw, bay_L, bay_screw_head, bay_fixing, B);
bom("rack module", part == "rack_module" ? 2 * len(panel_zs(mod_u(module_type))) : 0, rack_screw, rack_L_dev, rack_screw_head, "adapter", R);
bom("rack panel", part == "rack_panel" ? 2 * len(panel_zs(panel_u)) : 0, rack_screw, rack_L_dev, rack_screw_head, "adapter", R);
// the room a fill of the strip gets: a separate filler panel between the rack holes (0.8 mm clearance in height),
// or the frame between the posts
function zone_w_of(zn) = filler_mode == "separate" ? hole_s - R[0] - 6 : 2 * x_in - 2;
function zone_h_of(zn) = filler_mode == "separate" ? zn[1] - 0.8 : zn[1];
// keystone jacks and covers: the ports of every patch panel this part makes whose ports fit (one that does
// not fit is left out); each patch module has its own
function ks_fit_in(w, h, types = ks_types) = len(ks_layout_of(w, h, types)) > 0;
function zone_ks_ok(zn) = ks_fit_in(zone_w_of(zn), zone_h_of(zn));
function patch_sets() = let(mw = hole_s - R[0] - 6, mh = U - 0.79)
    part == "rack_panel" ? (panel_fill == "keystone" && ks_fit_in(mw, panel_u * U - 0.79) ? [ks_types] : [])
  : part == "rack_module" ? (mod_kind(module_type) == "patch" && ks_fit_in(mw, mh, patch_types(module_type)) ? [patch_types(module_type)] : [])
  : (part == "assembly" || (part == "adapter" && filler_mode != "separate")
     || ((part == "filler" || part == "filler_2") && filler_mode == "separate"))
    ? concat([for (zn = zones) if (zn[2] == "keystone" && zone_ks_ok(zn)) ks_types],
             [for (m = bom_mods) if (mod_kind(m) == "patch" && ks_fit_in(mw, mh, patch_types(m))) patch_types(m)])
  : [];
function n_patch() = len(patch_sets());
function ks_count(tp) = sum_list([for (s = patch_sets()) len([for (x = s) if (x == tp) 1])])
    + (tp == (ks_style == "metal" ? "rj45m" : "rj45") ? n_nk_jacks : 0);
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
// NanoKVM bays: the hardware of the whole bay, for the assembly or any of its pieces
nk_bom = [for (m = part == "assembly" ? used_mods
                 : (part == "rack_module" || part == "rack_module_bay" || part == "rack_module_lid") ? [module_type] : [])
          if (mod_kind(m) == "nkvm") nk_layout(mod_items(m))];
function nk_bom_n(lay) = len([for (l = nk_bom) if (l == lay) 1]);
n_nk_jacks = sum_list([for (l = nk_bom) nk_nks(l)]) - nk_bom_n("ks");      // (ks: keystone 1 is the coupler)
nk_drawer_L = max([for (l = [6, 8, 10, 12, 16, 20]) if (l <= 2 + panel_t + 7) l]);   // bezel + plate + the insert boss
if (len(nk_bom) > 0) echo(str("BOM | NanoKVM bay lid: ", 4 * len(nk_bom), " x M3 x 8 countersunk  +  ", 4 * len(nk_bom),
    " x M3 heat-set insert (hole ", NK_M3[2], " x ", NK_M3[3], " mm)"));
if (nkvm_split && !nkvm_raised && nk_bom_n("side") > 0) echo(str("BOM | NanoKVM bay to plate: ", 4 * nk_bom_n("side"),
    " x M3 x 8 pan head, from the back  +  ", 4 * nk_bom_n("side"), " x M3 heat-set insert (in the plate)"));
if (nkvm_split && nkvm_raised && nk_bom_n("side") > 0) echo(str("BOM | NanoKVM mountain to plate: ", 4 * nk_bom_n("side"),
    " x M3 x 8 countersunk, from the back  +  ", 4 * nk_bom_n("side"), " x M3 heat-set insert (in the mountain posts)"));
if (nkvm_split && nk_bom_n("front") > 0) echo(str("BOM | NanoKVM drawer: ", 2 * nk_bom_n("front"), " x M3 x ", nk_drawer_L,
    " countersunk  +  ", 2 * nk_bom_n("front"), " x M3 heat-set insert (behind the plate)"));
if (nk_bom_n("ks") > 0) echo(str("BOM | NanoKVM bay: ", nk_bom_n("ks"), " x RJ45 keystone coupler (female-female)  +  ",
    nk_bom_n("ks"), " x 10 cm patch cable (keystone to NanoKVM)"));
n_btn = part == "rack_panel" ? (panel_fill == "buttons" ? 1 : 0)
      : part == "rack_module" ? (module_type == "buttons" ? 1 : 0)
      : (part == "button_carrier" || part == "button_cap") ? 1          // the button panel these pieces are for
      : (part == "assembly" || (part == "adapter" && filler_mode != "separate")
         || ((part == "filler" || part == "filler_2") && filler_mode == "separate"))
        ? len([for (zn = zones) if (zn[2] == "buttons" && btn_fits(zone_w_of(zn), zone_h_of(zn))) 1])
          + (part == "assembly" ? len([for (m = used_mods) if (m == "buttons") 1]) : 0)
      : 0;
n_keys = btn_count + (btn_type == "retro" && btn_turbo ? 1 : 0);
// the first button panel's thickness (caps, test piece): a spare zone (its filler, or the frame when cut into it), else a 1U module
btn_panel_t = len([for (zn = zones) if (zn[2] == "buttons") 1]) > 0 ? (filler_mode == "separate" ? filler_t : ft) : panel_t;
if (n_btn > 0) {
    if (btn_type == "metal") {
        echo(str("BOM | buttons: ", n_btn * btn_count, " x ", btn_metal_d, " mm metal push button, momentary, LED ring (",
                 btn_count >= 2 ? "power, reset" : "power", ")"));
        echo(str("BOM | buttons: ", n_btn, " x ", led_d, " mm dome LED (disk activity) + front-panel header wires"));
    } else if (btn_type == "retro") {
        echo(str("BOM | buttons: ", n_btn * n_keys, " x 12 x 12 mm tactile switch (12 x 12 x 7.3) + the printed caps (part = button_cap)"));
        echo(str("BOM | buttons: ", n_btn * (btn_turbo ? 3 : 2), " x ", led_d, " mm dome LED (power green, HDD amber",
                 btn_turbo ? ", turbo yellow" : "", ") + front-panel header wires"));
        echo(str("BOM | buttons: ", n_btn * 2, " x M3 x 8 screw + ", n_btn * 2, " x M3 heat-set insert (switch carrier)"));
    } else {
        echo(str("BOM | buttons: ", n_btn * btn_count, " x Cherry MX compatible keyboard switch + 1u keycap (",
                 btn_count >= 2 ? "power, reset" : "power", ")"));
        echo(str("BOM | buttons: ", n_btn * 2, " x ", led_d, " mm dome LED (power, disk activity) + front-panel header wires"));
    }
}
n_fan = part == "rack_panel" ? (panel_fill == "fan80" && panel_u * U - 0.79 >= 82 ? 1 : 0)
      : (part == "assembly" || (part == "adapter" && filler_mode != "separate")
         || ((part == "filler" || part == "filler_2") && filler_mode == "separate"))
        ? len([for (zn = zones) if (zn[2] == "fan80" && zone_h_of(zn) >= 82 && zone_w_of(zn) >= 82) 1]) : 0;
if (n_fan > 0) echo(str("BOM | fan: ", n_fan, " x 80 mm fan (80 x 80 x 25) + ", 4 * n_fan, " x fan screws"));
// 40 mm fans: only where they fit side by side (the model leaves them out otherwise); the screws go through the
// thickest plate that holds fans (a 1U module, the filler panel, or the frame when they are cut into it)
fan40_zones = (part == "assembly" || (part == "adapter" && filler_mode != "separate")
               || ((part == "filler" || part == "filler_2") && filler_mode == "separate"))
            ? [for (zn = zones) if (zn[2] == "fan40" && fan40_fits(zone_w_of(zn), zone_h_of(zn))) zn] : [];
fan40_mods = fan40_fits(hole_s - R[0] - 6, U - 0.79) ? len([for (m = bom_mods) if (m == "fan40") 1]) : 0;
n_fan40 = fan40_count * (part == "rack_panel" ? (panel_fill == "fan40" && fan40_fits(hole_s - R[0] - 6, panel_u * U - 0.79) ? 1 : 0)
      : fan40_mods + len(fan40_zones));
fan40_plate = max(concat(fan40_mods > 0 || part == "rack_panel" ? [panel_t] : [],
                         len(fan40_zones) > 0 ? [filler_mode == "separate" ? filler_t : ft] : [], [0]));
if (n_fan40 > 0) echo(str("BOM | fans: ", n_fan40, " x 40 mm fan (40 x 40 x ", fan40_t, ") + ", 4 * n_fan40,
                         " x M3 x ", min([for (l = [16, 20, 25, 30, 35, 40, 45, 50]) if (l >= fan40_t + fan40_plate + 2.6) l]),
                         " screw + nut (5 or 12 V, to a fan header)"));
if ((part == "assembly" && rear_slots) || part == "pci_bracket")
    echo(str("BOM | rear slots: ", part == "pci_bracket" ? 1 : 2, " x printed PCI-slot bracket",
             part == "pci_bracket" ? (pci_kind == "lan" ? " (network cables)" : " (power cable)") : " (network cables, power cable)", " + the case's slot screws"));
if (n_ties > 0) echo(str("BOM | zip ties: ", 2 * n_ties, " x 2.5-3.6 mm cable tie (holds the device)"));
function dev_of(m) = let(k = mod_kind(m), it = mod_items(m))
    k == "ms105g" ? ["5-port switch (MS105G size)"] : k == "uswflex" ? ["UniFi USW-Flex-Mini"] : k == "ux" ? ["UniFi Express"]
  : k == "kvm" ? [for (b = it) b == "jet" ? "JetKVM" : b == "nano" ? "NanoKVM Full" : "KVM (your size)"]
  : k == "pi" || k == "piblade" ? [for (b = k == "pi" ? pi_list(it) : blade_list(it))
                                   b == "zero" ? "Raspberry Pi Zero" : str("Raspberry Pi ", str_split(b, "i")[1])]
  : k == "nkvm" ? ["NanoKVM Lite"] : k == "dev1" ? ["your device 1"] : k == "dev2" ? ["your device 2"] : [];
bom_devs = [for (m = bom_mods) each dev_of(m)];
if (len(bom_devs) > 0) {
    echo(str("BOM | devices (not included): ", count_list(bom_devs)));
    has_kvm = len([for (m = bom_mods) if (mod_kind(m) == "kvm" || mod_kind(m) == "nkvm") 1]) > 0;
    echo(str("BOM | cables and power (not included): a network patch cable per port",
             has_kvm ? ", HDMI + USB cables from each KVM to its computer" : "", ", the devices' power supplies (or USB-C / PoE)"));
}

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
    echo(str("NOTE: rack panels overlap the case front by ", round((units * U - frame_h) / 2 * 10) / 10, " mm above and below the bezel"));
if (hole_s / 2 + r_feat / 2 + 1.2 > fw / 2)
    echo("WARNING: rack holes are too close to the frame edge - wider frame or smaller screws");
// the rack fixings sit in the posts, a few mm from the bay's steel side: a thin wall bulges when the insert goes in,
// and a nut pocket or slot as wide as a big nut breaks through it
rack_side_wall = sw - (hole_s / 2 + r_feat / 2 + r_slot / 2);
has_rack_fix = n_dev + n_fill > 0;                   // (a panel-only front cut into the frame has no rack screws)
FIX_NAME = rack_fixing == "heatset" ? "inserts" : rack_fixing == "tap" ? "self-tapping holes"
         : rack_fixing == "channel" ? "nut channels" : "nut pockets";
if (has_rack_fix && rack_side_wall < 1)
    echo(str("WARNING: the rack ", FIX_NAME, " leave only ", round(rack_side_wall * 10) / 10,
             " mm of plastic to the bay side - smaller screws (", rack_fixing == "heatset" ? "M5 or M4" : "M5 or M4 with a square nut, M4 with a hex nut",
             ") or another rack_fixing"));
else if (has_rack_fix && rack_fixing == "heatset" && rack_side_wall < 2)
    echo(str("NOTE: the rack inserts leave ", round(rack_side_wall * 10) / 10,
             " mm of plastic to the bay side - press them in slowly and slide the rack-holes test piece (test_rack) into a bay to check it still fits",
             rack_screw == "M6" ? " (M5 or M4 inserts leave 2 mm or more)" : ""));
if (rack_fixing == "heatset" && T_post < R[3] + 1)
    echo("WARNING: posts too shallow for these heat-set inserts - raise post_d");
if (rack_screw_head == "countersunk" && (head_dims("countersunk", R[8])[0] + 0.4 - R[0]) / 2 > min(filler_t, panel_t))
    echo("WARNING: countersunk heads are deeper than the filler/panel thickness");
if (frame_h > 250)
    echo(str("NOTE: the adapter lies ", round(fw), " x ", round(frame_h * 10) / 10, " mm on the bed - check your printer takes it"));
if (max(bay_ys) + boss_d / 2 + 2 > sleeve_depth)
    echo("WARNING: bay screw holes are deeper than the sleeve - raise sleeve_depth");
for (z = rack_zs) {
    if (z - r_feat / 2 < frame_z0 + 0.8 || z + r_feat / 2 > frame_z1 - 0.8)
        echo(str("WARNING: a rack hole ", round((z - frame_z0) * 10) / 10, " mm from the bottom of the frame breaks out of its edge - smaller screws or another hole_pattern"));
    else if (z - r_feat / 2 < pz0 || z + r_feat / 2 > pz1)
        echo(str("WARNING: a rack hole ", round((z - frame_z0) * 10) / 10, " mm from the bottom of the frame is outside the posts (only the frame holds it)"));
}

// ---------------------------------------------------------------------
//  Parameter checks: values that are in range one by one but do not go together
// ---------------------------------------------------------------------
KS_TYPES = ["rj45m", "rj45", "hdmi", "usb", "rca", "jack", "toslink", "cover", "pass", "none"];
MOD_KINDS = ["ms105g", "kvm", "kvm2", "pi", "piblade", "nkvm", "uswflex", "ux", "dev1", "dev2", "shelf", "patch",
             "fan40", "buttons", "vent", "blank", "cable", "label"];
function known(x, list) = len([for (y = list) if (y == x) 1]) > 0;
for (tp = ks_types) if (!known(tp, KS_TYPES)) echo(str("WARNING: unknown keystone type '", tp, "' in ks_ports_list - use ", KS_TYPES));
for (m = concat(rack_mods, [module_type])) if (!known(mod_kind(m), MOD_KINDS))
    echo(str("WARNING: unknown rack module '", m, "' - it is made as a blank panel"));
for (m = part == "rack_module" ? [module_type] : rack_mods) {   // (the modules of this part)
    k = mod_kind(m);
    if (k == "patch") { for (tp = patch_types(m)) if (!known(tp, KS_TYPES))
        echo(str("WARNING: unknown keystone type '", tp, "' in the patch module (", m, ") - use ", KS_TYPES)); }
    else if (k != "label") for (b = mod_items(m)) if (!known(b, k == "kvm" ? ["jet", "nano", "custom"] : k == "nkvm" ? ["side", "front", "ks"]
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
if (ks_ports_list != "" && ks_ports != len(ks_types))
    echo(str("NOTE: ks_ports_list sets ", len(ks_types), " ports - ks_ports (", ks_ports, ") only counts when the list is empty"));
if (nkvm_raised && len([for (m = concat(used_mods, [module_type])) if (mod_kind(m) == "nkvm" && nk_layout(mod_items(m)) == "side") 1]) > 0
    && (part == "assembly" || mod_kind(module_type) == "nkvm"))
    echo(str("NOTE: the raised NanoKVM bay sticks out ", round((-nk_r_lf - panel_t) * 10) / 10,
             " mm from the rack front - check that your case door still closes (else set nkvm_raised = false: in the plate)"));
if (mount_lip * 2 >= min(ms_w, ms_h))
    echo("WARNING: mount_lip closes the switch window - lower it");

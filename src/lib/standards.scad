// bay2rack - Hardware tables, screw heads and standard lengths
// Part of bay2rack.scad (included after the parameters). License: CC BY-NC-SA 4.0

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

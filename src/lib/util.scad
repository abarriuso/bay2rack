// bay2rack - Small geometry helpers
// Part of bay2rack.scad (included after the parameters). License: CC BY-NC-SA 4.0

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

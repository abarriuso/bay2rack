# bay2rack — 5.25" drive bay → 6" mini rack

*[Leer en español](README.es.md)*

A parametric OpenSCAD adapter that screws into the standard side holes of one or more
5.25" drive bays and turns them into a **6" mini rack**, so 6" rack accessories (switches,
patch panels, shelves…) mount straight into a PC case. The space a bay stack leaves over can
become a **built-in 6-port keystone patch panel**.

![bay2rack mounted in a PC tower](docs/img/hero.png)

Evolution of the original
[6" mini rack switch + patch panel in a 5.25" bay](https://www.reddit.com/r/minilab/comments/1vr8vc1/6_mini_rack_switch_patch_panel_in_525_bay/).

> **[Open the web generator](https://abarriuso.github.io/bay2rack/)**: configure it, preview it in 3D (mounted in a PC tower,
> with the hardware) and download the STL, all in your browser. Nothing to install.
>
> **Just want to print?** Every variant is pre-built in [`stl/`](stl/README.md), with the screws and inserts it needs.
> Print the [test pieces](stl/README.md#tests) first.

---

## The height problem

A 5.25" bay is 41.53 mm tall and stacked bays repeat every ~43.18 mm. A rack unit is 44.45 mm.
So **N bays never hold N U inside the stack**. The deficit grows by 1.27 mm per bay:

| Bays | Stack height | Flush (inside the stack) | Spare zone | Overhang (N U) | Panels stick out |
|-----:|-------------:|-------------------------:|-----------:|---------------:|-----------------:|
| 1 | 41.1 mm | 0U | 41.1 mm | 1U | +3.3 mm |
| 2 | 84.3 mm | 1U | 39.9 mm | 2U | +4.6 mm |
| 3 | 127.5 mm | 2U | 38.6 mm | 3U | +5.9 mm |
| 4 | 170.7 mm | 3U | 37.3 mm | 4U | +7.1 mm |
| 5 | 213.9 mm | 4U | 36.1 mm | 5U | +8.4 mm |
| 6 | 257.0 mm | 5U | 34.8 mm | 6U | +9.7 mm |

The design handles this with **one parametric model** instead of one model per bay count.

## Variants

Two independent choices give four families, each available for 1–4 bays:

| | **Flush**: N−1 U + spare zone, nothing sticks out | **Overhang**: N bays = N U |
|---|---|---|
| **Plate front**: flat frame behind the rack panels | `plate-flush`: the spare zone takes a **swappable filler** (6-port patch, vent, blank) | `plate-overhang`: the frame is a few mm taller than the stack |
| **Bezel front**: the exact outline of stacked 5.25" drive bezels | `bezel-flush`: flush with the case front like an original drive, patch panel cut into the bezel | `bezel-overhang`: the bezel stays flush, only the rack panels overlap the case front |

![The four families](docs/img/variants.png)

![Mounted in a PC tower](docs/img/mounted.png)

Use the plate front when your case front is flat at the drive bays. If the case has a plastic front that
stands out from the metal, use the bezel front and set `bezel_depth` to how far that front stands out.

Other knobs: `units_override`, `overhang_align` (center/top/bottom), `spare_pos` (top/bottom/split),
and the spare-zone fill (`keystone`, `vent`, `cable`, `led`, `label`, `blank`).
The fill can be `separate` (a screw-on panel in the same plane as the rack accessories) or `integral` (cut into the frame).

## Keystones

The patch panel takes 1–12 ports (rows are added automatically) with optional engraved numbers.
`ks_style` picks the holder:

- **`metal`** (default) is a holder cell for **metal / shielded keystones**, replicated from the original
  bay adapter. It has a 15 × 16.5 mm front opening, a latch ramp, a 24.3 mm cavity and rear lips that catch the jack.
  It is 9.5 mm deep, with 2 mm walls and a 20 mm pitch. Every dimension is a parameter (`ksm_*`).
- `standard` is a plain 14.9 × 16.4 mm cut-out in a 2 mm plate for plastic snap-in keystones.

![Metal keystone holder](docs/img/keystone.png)

## Rack standard

There is no official 6" standard, so this project uses **the 10" mini rack rules on a 6" width**:

- 152.4 mm (6") panels
- **134.925 mm hole spacing**: the same 8.74 mm edge-to-hole inset as the 10" standard (254 mm panel, 236.525 mm spacing)
- EIA-310 vertical hole pattern (6.35 / 22.225 / 38.1 mm in each U), 1U = 44.45 mm
- M6, 10-32 or 12-24 screws, with M6 as the default

If your gear differs, set `rack_std = custom`.

## Hardware

| | Options |
|---|---|
| Rack screw | M3, M4, M5, M6, 10-32, 12-24 |
| Head | button (ISO 7380), socket (ISO 4762), countersunk (ISO 10642, adds countersinks to panels), pan (ISO 7045) |
| Rack fixing | heat-set insert, self-tapping, hex nut trap, square nut side slot, sliding square-nut channel (screws at any height) |
| Bay screw | M3 or 6-32, with heat-set insert, self-tapping, hex nut or clearance + loose nut |
| Overrides | `rack_insert_d/l`, `bay_insert_d/l` for your inserts; `rack_screw_len`, `bay_screw_len` (0 = auto) |

The model **chooses the right standard screw length**, metric or imperial. It uses the accessory
ear thickness, the case sheet thickness and the fixing type, and warns when nothing fits.
Every render prints a bill of materials:

```
BOM | rack accessories: 12 x M6 x 12 button head  +  12 x M6 heat-set insert (hole 8 x 12.7 mm)
BOM | filler panels: 2 x M6 x 12 button head  +  2 x M6 heat-set insert (hole 8 x 12.7 mm)
BOM | drive bay: 6 x M3 x 5 pan head  +  6 x M3 heat-set insert (hole 4.2 x 5.7 mm)
```

The preview draws screws, inserts and nuts in place (`show_hardware`). `explode` pulls the parts apart,
and `section` cuts the model open so you can see each fixing inside the plastic.

![Hardware preview](docs/img/hardware.png)

## Bay standard

The defaults follow SFF-8551 / EIA-741 (5.25" devices): width 146.05 mm, height 41.53 mm,
bezel 148 × 42.3 mm, M3 side holes 10 mm above each bay's bottom and 47.4 mm from the front.
A rear hole at 126.65 mm and a second row at 21.84 mm are optional. **Cases vary, so verify these
numbers** with the `test_bay` piece. Use `bay_hole_offset` / `bay_hole_slot` to adjust, or set `bay_std = custom`.

## Printing

- The STL files are already oriented **front face down**. Walls and posts rise vertically, and window
  roofs and screw bosses are 45° teardrops, so **no supports** are needed.
- PETG or ABS/ASA is recommended inside a warm case; PLA works for cool cases.
- 3–4 perimeters, 20–30 % infill.
- 3 bays print at 148 × 128 mm on the bed, about 66–70 mm tall.

<p align="center"><img src="docs/img/print.png" width="420" alt="Print orientation"></p>

## Customizing

- **Web generator:** [abarriuso.github.io/bay2rack](https://abarriuso.github.io/bay2rack/) runs OpenSCAD compiled to
  WebAssembly in the browser. It has the same parameters as the Customizer, shareable links, the bill of materials
  and STL / colored 3MF downloads. The source is in `web/` (Vite + pnpm); `corepack pnpm --dir web dev` runs it locally.

- **OpenSCAD Customizer:** open `src/bay2rack.scad` and use *Window → Customizer*. Every variant is a preset
  in the dropdown. Press F5 to preview (the adapter is shown mounted in a PC tower, `case_view`) and F6 to render.
- **Command line:**
  ```bash
  openscad -o adapter.stl -D 'part="adapter"' -D bays=3 -D 'front_style="bezel"' src/bay2rack.scad
  ```
- **Rebuild everything:** `python scripts/build.py` regenerates the presets, every STL and `stl/README.md`.
  `python scripts/render_docs.py` regenerates the images.

Every render prints a summary line, the BOM and a `WARNING`/`NOTE` whenever the screws, inserts or fills don't fit.

## Repository layout

```
src/bay2rack.scad        all parameters (open this one)
src/bay2rack.json        Customizer presets (generated)
src/lib/
  standards.scad         screw / insert / nut tables, standard lengths
  config.scad            derived dimensions, checks, bill of materials
  util.scad              geometry helpers
  fills.scad             keystones (metal / standard), vent, cable, LED, label
  adapter.scad           rack fixings, bay sleeve, front frame
  panels.scad            fillers, rack panels, test pieces
  preview.scad           hardware models, sections, PC tower (preview only)
scripts/build.py         variant table -> presets + stl/ + stl/README.md
scripts/render_docs.py   README images
web/                     browser viewer + generator (GitHub Pages)
stl/<family>/<variant>/  ready-to-print STLs, see stl/README.md
docs/img/                README images
```

## Roadmap / ideas

- [ ] Verified hole spacings for commercial 6" racks (PRs with measurements welcome)
- [ ] Shelf / tray part for devices without rack ears
- [ ] Tool-less clip option for cases without side screws
- [ ] Brush or grommet cable fill

## License

[CC BY-NC-SA 4.0](LICENSE): you may share and remix it with attribution, under the same
license, and **not for commercial use** without permission. For commercial licensing, contact the author.

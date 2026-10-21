# bay2rack: turn the 5.25" bays of an old PC case into a 6" mini rack

Old towers came with 5.25" bays for CD drives. ATX hasn't changed, so that case still takes a modern motherboard,
and with this adapter its bays become a **6" mini rack**: a router with VLANs, switches, KVM over IP,
Raspberry Pi blades and a patch panel, right in the front of the case.

It screws into the bays like a drive. The rack accessories screw into the adapter.

**About the photos:** the real photos show the first version of the adapter, 2 bays: 1U for the switch plus the patch panel as a separate panel. The files here are the current version, which adds grooves for the metal tabs between the bays and stiffer side walls (see the renders).

**Work in progress, help welcome.** This is an ongoing project. If something doesn't fit your case, a part prints badly or you find a defect, tell me in the comments or open an issue on GitHub (https://github.com/abarriuso/bay2rack/issues), with photos and your case model if you can. Measurements of other cases and rack gear, new modules and fixes are welcome as pull requests.

**Configure it in your browser, with a 3D preview of the case:** https://bay2rack.pages.dev/
(choose the bays, every rack unit and every keystone port, then download a kit with every STL and the bill of materials).
Source and docs: https://github.com/abarriuso/bay2rack

## What's included

- **Adapters**: 2, 3 and 4 bays (1U, 2U and 3U inside the bays plus a strip for a filler), and a 3-bay version with
  an exact 5.25" bezel and a 6-port patch panel.
- **Fillers** for the strip: 6 keystones, vents, blank.
- **Rack modules** (1U): Mercusys MS105G switch, UniFi Flex Mini, UniFi Express, JetKVM + NanoKVM, Raspberry Pi 5,
  three 40 mm fans, 6-port patch panel, power / reset buttons with MX switches. **2U**: four Raspberry Pi blades.
- **Bezel without a rack**: 80 mm fan + power / reset buttons, for the other PCs of the homelab.
- **Keystone covers** (blank and cable pass-through) and **PCI-slot brackets** to bring the cables in from the back.
- **Test pieces**: print these first and check them against your case. If the keystone jack, the sleeve or an insert comes out tight or loose, change it in the "Print fits" step of the web configurator before printing the rest.

Anything else (other bay counts, other switches, your own device sizes, M4/M5/10-32/12-24 screws, nut traps
instead of inserts...) is in the parametric model: use the web configurator, or open the .scad file in OpenSCAD.

## Print

- Already oriented front face down: **no supports**.
- PETG or ASA inside a warm case, PLA is fine for a cool one. 3-4 walls, 20-30 % infill, 0.2 mm layers.
- 3 bays: 148 x 128 mm on the bed, about 70 mm tall.

## Hardware (3-bay adapter, defaults)

- Rack: M5 x 10 button head screws + M5 heat-set inserts (6.4 mm hole) in the adapter; the modules screw into those
  inserts, they need no inserts of their own. No soldering iron? Switch on "No soldering iron" in the configurator
  (square nuts). M6, 10-32 or 12-24 if you prefer.
- Bay: 6 x M3 x 5 screws + M3 heat-set inserts.
- Keystones: standard 14.9 x 16.4 mm or metal / shielded RJ45 (the cell holds them from the back).

## Check your case first

Cases vary. The bay screw holes follow SFF-8551 (10 mm up, 47.4 mm from the front). Print the **bay test piece**
before the adapter. Grooves along the sleeve clear the metal tabs between the bays, so you don't have to bend them.

The 6" rack has no official standard: the hole spacing is 134.925 mm, with the same rules as 10" mini racks
(EIA-310 vertical pattern). Print the **rack test piece** to check your gear.

Build guide (what to buy, inserts, assembly, cables and power): https://github.com/abarriuso/bay2rack/blob/main/docs/BUILD.md

License: CC BY-NC-SA 4.0, not for commercial use without permission.

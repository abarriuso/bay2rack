# bay2rack: turn the 5.25" bays of an old PC case into a 6" mini rack

Old towers came with 5.25" bays for CD drives. ATX hasn't changed, so that case still takes a modern motherboard,
and with this adapter its bays become a **6" mini rack**: a router with VLANs, switches, KVM over IP,
Raspberry Pi blades and a patch panel, right in the front of the case.

It screws into the bays like a drive. The rack accessories screw into the adapter.

**Configure it in your browser, with a 3D preview of the case:** https://abarriuso.github.io/bay2rack/
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
- **Test pieces**: print these first and check them against your case.

Anything else (other bay counts, other switches, your own device sizes, M4/M5/10-32/12-24 screws, nut traps
instead of inserts...) is in the parametric model: use **Customize** here or the web configurator.

## Print

- Already oriented front face down: **no supports**.
- PETG or ASA inside a warm case, PLA is fine for a cool one. 3-4 walls, 20-30 % infill, 0.2 mm layers.
- 3 bays: 148 x 128 mm on the bed, about 70 mm tall.

## Hardware (3-bay adapter, defaults)

- Rack: M6 x 12 button head screws + M6 heat-set inserts (8 mm hole). The modules use the same.
- Bay: 6 x M3 x 5 screws + M3 heat-set inserts.
- Keystones: standard 14.9 x 16.4 mm or metal / shielded RJ45 (the cell holds them from the back).

## Check your case first

Cases vary. The bay screw holes follow SFF-8551 (10 mm up, 47.4 mm from the front). Print the **bay test piece**
before the adapter. Grooves along the sleeve clear the metal tabs between the bays, so you don't have to bend them.

The 6" rack has no official standard: the hole spacing is 134.925 mm, with the same rules as 10" mini racks
(EIA-310 vertical pattern). Print the **rack test piece** to check your gear.

License: CC BY-NC-SA 4.0, not for commercial use without permission.

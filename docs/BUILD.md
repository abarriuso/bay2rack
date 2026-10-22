# Build guide

*[Leer en español](BUILD.es.md)*

From the kit (.zip) of the [web generator](https://bay2rack.pages.dev/) to a rack in the front of your case. The kit's
`README.txt` lists the exact screws, inserts and keystones of your build; this guide explains what to do with them.

## 1. What you need

**Tools**
- A soldering iron with a heat-set insert tip (one for M3, one for the rack inserts, M5 by default).
  No iron? Switch on **No soldering iron** in the **Screws** step: square nuts for the M5 rack screws and hex nuts for
  the bay screws, all with a screwdriver. (Nuts need M5 or smaller: an M6 nut is too wide, it would leave no plastic
  between the post and the side of the bay.) The NanoKVM bay and the retro button carrier still take M3 heat-set inserts.
- Hex keys or screwdrivers for your screws (M5 button head: 3 mm hex; M3: 2 mm hex or a Phillips for pan heads).
- Flush cutters and a deburring tool or a small file.

**Filament and print settings**
- PETG, or ASA / ABS: a PC case gets warm. PLA is fine for a cool case or a first test.
- 0.4 mm nozzle, 0.2 mm layers, **4 walls** (the posts and bosses take inserts), 20–30 % infill.
- **No supports**: every STL is already oriented front face down.
- Bed: a 3-bay adapter is 148 × 128 mm on the bed and about 70 mm tall.

**Hardware** (the kit's list has the quantities)
- Rack screws and heat-set inserts: by default *M5 × 10 button head (ISO 7380)* and *M5 heat-set inserts,
  6.4 mm hole, 9.5 mm long*. Brands such as Ruthex or CNC Kitchen make both sizes. (M5 screws also go through the M6
  holes of panels made for other mini racks; M6 is in the **Screws** step if you want it.)
- Bay screws: *M3 × 5 pan head* plus *M3 heat-set inserts (4.2 mm hole, 5.7 mm long)*. The screws of the old
  DVD drive are usually M3 × 5 and work.
- Keystones: the patch panel's **metal cells** take metal / shielded RJ45 keystone jacks, which go in from the back. The
  **standard cut-out** (`ks_style = standard`) takes plastic snap-in keystones (HDMI, USB, plastic RJ45). The
  ready-made `filler-keystone6.stl` has metal cells.
- Zip ties of 2.5–3.6 mm for the devices in their trays.
- The devices themselves (switch, KVM, Raspberry Pi…), their power supplies and the cables: the list says which ones
  your build holds, under *devices (not included)*.

## 2. Print the test pieces first

They are in the kit's `tests/` folder (`test_bay`, `test_rack`, `test_keystone`, and `test_button` when there is a
button panel). In [`stl/tests`](../stl/README.md#tests) they are `bay-plate` / `bay-bezel`, `rack-M5-heatset`,
`keystone-metal` / `keystone-standard` and `button-mx` / `button-metal-16` / `button-retro`.

| Test piece | Check | If it is wrong |
|---|---|---|
| Bay corner (`test_bay`) | it slides into a bay; its holes line up with the case's side holes | tight: raise *Sleeve in the bay*; holes off: `bay_hole_y1`, `bay_hole_z1`, `bay_hole_offset` |
| Rack holes (`test_rack`) | the screws line up 134.925 mm apart; press its two inserts in and slide it into a bay | insert spins: lower *Rack insert hole*; goes in crooked: raise it; tight in the bay after the inserts: see step 4 |
| Keystone port (`test_keystone`) | the jack clips in and stays | tight: raise *Keystone openings* (+0.1 to +0.2); loose: lower it |
| One button (`test_button`) | the key, push button or printed cap fits | MX: *MX key cut-out* |

Change what you need in the **Adjust after the test prints** step of the web generator, download the kit again and print the rest.

## 3. Print the rest

The adapter first (the longest print), then the filler and the rack modules, then the small pieces: keystone covers,
PCI-slot brackets, button caps, the NanoKVM lid. With a multi-material printer, each panel with letters has a
`-labels.stl`: import both at once and answer *Yes* to "load as a single object with multiple parts", then give the
letters the second filament.

## 4. Heat-set inserts

- Use the temperature your inserts' maker gives for your filament (usually 200–250 °C).
- Put the insert on the hole, press straight and slowly with the matching tip, and stop when it is flush. Let it cool
  before you screw into it.
- **Rack inserts (front of the adapter's posts):** M5 inserts leave 2.2 mm of plastic between the insert and the side
  of the bay. Press them in straight so that wall does not bulge, then check that the adapter still slides into the
  bays. (M6 inserts leave only 1.4 mm; the model says so in a note.)
- **Bay inserts:** inside the sleeve, in the bosses behind the case's side holes.
- Modules: the NanoKVM lid posts and drawer bosses (M3), the retro button carrier posts (M3).

## 5. Assemble

1. **Prepare the case.** Take out the 5.25" bay covers: the plastic ones on the front and the metal plates behind
   them. Take off tool-less rails or clips that cover the side holes. The metal tabs between bays can stay: the
   adapter has grooves for them.
2. **Devices into their trays.** The switch slides into its tunnel from the back and a zip tie holds it; the KVM boxes
   sit in their pockets with zip ties; Raspberry Pis screw onto their standoffs (M2.5 × 6).
3. **Keystones.** Metal jacks go into their cells from the back until the lips catch. Plastic ones snap in from the
   front. Covers and pass-through covers push in from the front.
4. **Adapter into the bays.** Slide it in from the front until the frame sits on the case front, and screw the bay
   screws through the case's side holes on both sides.
5. **Filler and modules.** Screw them to the adapter's rack posts, top first. Their screws go into the adapter's
   inserts: modules need no inserts of their own for this.
6. **Back of the case.** Screw the PCI-slot brackets into two free slots: one for the network cables, one for the power
   cable.

## 6. Cables and power

- **Network:** short patch cords on the front, from the switch to the keystones. Behind the keystones, the cables of
  the other machines come in through the network PCI bracket.
- **KVM over IP:** HDMI from the computer's video output and USB to the computer (keyboard and mouse). To switch the
  computer on and off from the KVM, JetKVM and NanoKVM sell an ATX board that connects to the motherboard's
  front-panel header; follow their instructions.
- **Power:** the simplest and safest way is each device's own power supply. Its cable leaves the case through the
  power PCI bracket to a power strip. A Raspberry Pi 5 needs a 5 V 5 A USB-C supply (or a PoE HAT on a PoE switch).
  Do not tap the PC's power supply unless you know exactly what you are doing.
- **Button panel:** the switches and LEDs go to the motherboard's front-panel header (POWER SW, RESET SW, POWER LED,
  HDD LED); check the pin order in the motherboard manual. Modern boards have no TURBO pin: that button can do
  whatever you wire it to, or nothing.

## 7. If something does not fit

| Problem | Change (web: Adjust after the test prints / Every parameter) |
|---|---|
| The adapter is tight in the bays | *Sleeve in the bay* (`sleeve_clearance`) up |
| Too tall for the stack of bays | *Height in the bays* (`height_clearance`) up |
| Keystones tight or loose | *Keystone openings* (`ks_fit`) |
| A device is tight in its tray | *Devices in their trays* (`mount_clear`) up |
| Rack inserts spin | *Rack insert hole* (`rack_insert_d`) down |
| Bay holes do not line up | `bay_hole_y1`, `bay_hole_z1`, `bay_hole_offset` (measure yours) |
| The case door does not close | an overhang build or the raised NanoKVM bay sticks out: use flush, or `nkvm_raised` off |

Then tell us how it went: [case report](https://github.com/abarriuso/bay2rack/issues/new?template=case-report.yml).
Every report goes into the [compatibility list](CASES.md).

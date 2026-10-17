# Compatibility list

*[Leer en español](CASES.es.md)*

How bay2rack fits in real PC cases. Every case is a little different (bay screw holes, metal tabs between the
bays, how far the plastic front stands out), so this list grows with the reports of the people who print it.

**Add yours:** [open a case report](https://github.com/abarriuso/bay2rack/issues/new?template=case-report.yml),
it takes two minutes. Print the bay test piece first if you can (`test_bay` in the kit; `stl/tests/bay-plate.stl`
for a plate front, `stl/tests/bay-bezel.stl` for a bezel front).

## Check your case in five minutes

1. **How many 5.25" bays?** Count the wide covers (about 15 cm) where the CD drive went. The narrow ones for a floppy
   drive (3.5") don't count.
2. **Side holes.** Take a bay cover off and look at the side of the cage: a row of small holes about 10 mm above the
   bottom of each bay and about 47 mm from the front. If they are elsewhere, the bay test piece shows by how much.
3. **Tool-less rails or clips.** Many cases hold drives with plastic clips or rails instead of screws. Take them off
   if they cover the side holes; if they can't come off, the sleeve may not slide in.
4. **Metal tabs between bays.** Lanced ledges in the gap between two bays are fine: the adapter has grooves for them.
5. **The front.** Flat at the bays (or standing out less than about 4 mm): *plate* front. A plastic front that stands
   out from the metal: *bezel* front, and measure how far it stands out (`bezel_depth`). With a plate front on a deep
   plastic front, the 152.4 mm rack panels hit the 148 mm opening.
6. **A front door?** Overhang builds stick out a few mm and the raised NanoKVM bay about 19 mm: check the door closes,
   or use a flush build.
7. **Depth.** The sleeve goes 62 mm into the bays and the trays as deep as their devices (the switch about 70 mm,
   the shelf 100 mm): check nothing (cables, a radiator, the top of the motherboard) is in the way behind the bays.

## Reported cases

| Case | 5.25" bays | Adapter | Version | Result | Notes |
|---|---|---|---|---|---|
| Silver and chrome ATX tower (model not known yet) | 2 used | 2 bays: 1U switch + patch panel as a separate panel | v1 | ✅ Fits as it is | M6 heat-set inserts, MS105G switch and 6-port patch panel mounted |

**Result:** ✅ fits as it is · 🔧 fits after changing parameters (in Notes) · ❌ doesn't fit

The cases in the configurator's 3D preview (Fractal Define R5, Corsair Obsidian 750D, Antec Three Hundred, Phanteks
Enthoo Pro, Define XL R2, Cooler Master HAF 932 and Stacker 830) are approximate outer sizes for the picture, not
tested fits.

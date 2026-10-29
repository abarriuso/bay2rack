// ready-made builds: the examples step and the gallery (applied on top of the defaults). Each one names the
// case of its gallery picture (scripts/blender/gallery.py), so loading it shows the same PC.
export const EXAMPLES = {
  router: { bays: 4, case_model: 'definexlr2', scene: 'homelab', fit: 'flush', front_style: 'plate', filler_mode: 'separate', rack_modules: 'uswflex,ms105g,kvm:jet+nano',
            spare_pos: 'top', spare_fill: 'keystone', ks_ports_list: 'rj45m,rj45m,rj45m,cover,pass,pass' },
  homelab: { bays: 3, scene: 'homelab', fit: 'flush', front_style: 'plate', filler_mode: 'separate', rack_modules: 'ms105g,kvm:jet+nano',
             spare_pos: 'top', spare_fill: 'keystone', ks_ports_list: 'rj45m,rj45m,rj45m,cover,cover,pass' },
  network: { bays: 5, case_model: 'haf932', fit: 'flush', front_style: 'plate', filler_mode: 'separate', rack_modules: 'uswflex,ms105g,ux,patch',
             spare_pos: 'top', spare_fill: 'vent', ks_ports_list: 'rj45m,rj45m,rj45m,rj45m,cover,pass' },
  pi: { bays: 4, case_model: 'stacker830', fit: 'flush', front_style: 'plate', filler_mode: 'separate', rack_modules: 'uswflex,piblade:pi5+pi5+pi5+pi5',
        spare_pos: 'top', spare_fill: 'vent' },
  kvm: { bays: 3, case_model: 'enthoopro', fit: 'flush', front_style: 'plate', filler_mode: 'separate', rack_modules: 'kvm:jet+jet,kvm:nano+nano',
         spare_pos: 'top', spare_fill: 'keystone', ks_ports_list: 'rj45m,rj45m,rj45m,rj45m,hdmi,usb' },
  audio: { bays: 3, case_model: 'obsidian750d', fit: 'flush', front_style: 'plate', filler_mode: 'separate', rack_modules: 'pi:pi4,fan40',
           spare_pos: 'top', spare_fill: 'keystone', ks_ports_list: 'rca,rca,jack,toslink,rj45m,pass' },
  unifi: { bays: 3, case_model: 'obsidian750d', fit: 'flush', front_style: 'plate', filler_mode: 'separate', rack_modules: 'uswflex,ux',
           spare_pos: 'top', spare_fill: 'keystone', ks_ports_list: 'rj45m,rj45m,rj45m,rj45m,cover,pass' },
  client: { bays: 3, case_model: 'antec300', fit: 'panel', front_style: 'plate', filler_mode: 'integral', spare_pos: 'split', spare_split: 0.67,
            spare_fill: 'fan80', spare_fill_2: 'buttons' },
  bezel: { bays: 3, case_model: 'definexlr2', fit: 'flush', front_style: 'bezel', filler_mode: 'integral', rack_modules: 'ms105g,kvm:jet+nano',
           spare_pos: 'top', spare_fill: 'keystone', ks_ports_list: 'rj45m,rj45m,rj45m,cover,cover,pass' },
};

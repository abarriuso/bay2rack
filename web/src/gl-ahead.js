// The 3D view's WebGL context, made ahead. Making one is a wait on the GPU (some 60 to 90 ms, it cannot be cut): the
// film makes it as the page comes in - before any scroll, while the page is still busy coming anyway - and the view
// (viewer.js) takes it when it starts, mid-film. No three.js here: just the canvas and its context, asked for with the
// very attributes three.js asks for (WebGLRenderer, r186, with the view's antialias and alpha).
const ATTRS = {
  alpha: true, depth: true, stencil: false, antialias: true, premultipliedAlpha: true,
  preserveDrawingBuffer: false, powerPreference: 'default', failIfMajorPerformanceCaveat: false,
};
// ...and the extensions three.js asks for (each its own wait on the GPU, the first one until the context is made):
// asked for here, three.js has them at once
const EXTENSIONS = ['EXT_clip_control', 'EXT_color_buffer_float', 'EXT_color_buffer_half_float', 'EXT_texture_compression_bptc',
  'EXT_texture_compression_rgtc', 'EXT_texture_filter_anisotropic', 'EXT_texture_norm16', 'KHR_parallel_shader_compile',
  'OES_texture_float_linear', 'WEBGL_clip_cull_distance', 'WEBGL_compressed_texture_astc', 'WEBGL_compressed_texture_etc',
  'WEBGL_compressed_texture_pvrtc', 'WEBGL_compressed_texture_s3tc', 'WEBGL_compressed_texture_s3tc_srgb', 'WEBGL_multi_draw',
  'WEBGL_multisampled_render_to_texture', 'WEBGL_render_shared_exponent'];
let ahead = null;
export function glAhead() {
  if (ahead) return;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', ATTRS);
    if (!gl) return;
    for (const name of EXTENSIONS) gl.getExtension(name);
    // (and what three.js asks of it as it starts - its limits, its precisions: each a wait too, the answers kept)
    for (const k of ['MAX_TEXTURE_IMAGE_UNITS', 'MAX_VERTEX_TEXTURE_IMAGE_UNITS', 'MAX_COMBINED_TEXTURE_IMAGE_UNITS', 'MAX_TEXTURE_SIZE',
      'MAX_CUBE_MAP_TEXTURE_SIZE', 'MAX_VERTEX_ATTRIBS', 'MAX_VERTEX_UNIFORM_VECTORS', 'MAX_VARYING_VECTORS', 'MAX_FRAGMENT_UNIFORM_VECTORS',
      'MAX_SAMPLES', 'SAMPLES', 'VERSION', 'SCISSOR_BOX', 'VIEWPORT', 'IMPLEMENTATION_COLOR_READ_FORMAT', 'IMPLEMENTATION_COLOR_READ_TYPE'])
      gl.getParameter(gl[k]);
    for (const sh of [gl.VERTEX_SHADER, gl.FRAGMENT_SHADER]) for (const p of [gl.HIGH_FLOAT, gl.MEDIUM_FLOAT]) gl.getShaderPrecisionFormat(sh, p);
    ahead = { canvas, gl };
  } catch { /* the view makes its own */ }
}
// -> { canvas, gl } (once), or null: none made, or lost meanwhile
export function takeGL() {
  const a = ahead;
  ahead = null;
  return a && !a.gl.isContextLost() ? a : null;
}
export const madeAhead = () => !!ahead;

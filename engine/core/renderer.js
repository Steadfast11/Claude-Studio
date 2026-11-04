// engine/core/renderer.js — WebGLRenderer factory, quality presets and procedural image-based lighting.
// createRenderer({ width, height, canvas, quality }) → { renderer, quality }
// proceduralEnvironment(renderer, { top, horizon, bottom, panels }) → PMREM texture for scene.environment
import * as THREE from 'three';

/** Quality presets. Every expensive effect reads its knob from here. */
export const QUALITY = {
  draft:   { msaa: 0, shadowMap: 2048, ao: false, aoScale: 0.5, shafts: 24, shaftScale: 0.25, dofTaps: 48, bloom: true, motionBlur: 1 },
  preview: { msaa: 2, shadowMap: 2048, ao: true,  aoScale: 0.5, shafts: 32, shaftScale: 0.25, dofTaps: 80, bloom: true, motionBlur: 1 },
  final:   { msaa: 4, shadowMap: 4096, ao: true,  aoScale: 0.5, shafts: 48, shaftScale: 0.33, dofTaps: 128, bloom: true, motionBlur: 1 },
};

export function createRenderer({ width = 1920, height = 1080, canvas, quality = 'preview', pixelRatio = 1 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping; // used only for direct-to-screen renders; the post stack tone-maps itself
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // r186 removed PCFSoftShadowMap; PCF + shadow.radius gives soft Vogel-disk PCF
  renderer.shadowMap.autoUpdate = true;
  const q = typeof quality === 'string' ? { name: quality, ...QUALITY[quality] } : quality;
  return { renderer, quality: q };
}

/** Human-readable GPU string (SwiftShader in the cloud). */
export function rendererInfo(renderer) {
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
}

/**
 * A generated environment: gradient sphere + emissive "soft boxes" (e.g. a bright window), prefiltered with PMREM.
 * panels: [{ dir: [x,y,z], color: '#ffb070', intensity: 6, size: 0.5 }]
 */
export function proceduralEnvironment(renderer, { top = '#9fb4d0', horizon = '#d9b48c', bottom = '#4a3426', intensity = 1, panels = [] } = {}) {
  const scene = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color(top) }, horizon: { value: new THREE.Color(horizon) }, bottom: { value: new THREE.Color(bottom) }, k: { value: intensity } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform vec3 top, horizon, bottom; uniform float k; varying vec3 vDir;
      void main(){ float y = vDir.y; vec3 c = y > 0. ? mix(horizon, top, pow(y, .6)) : mix(horizon, bottom, pow(-y, .45)); gl_FragColor = vec4(c * k, 1.); }`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), mat));
  for (const p of panels) {
    const d = new THREE.Vector3(...p.dir).normalize();
    const s = (p.size || 0.4) * 50;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s * (p.aspect || 1)), new THREE.MeshBasicMaterial({ color: new THREE.Color(p.color).multiplyScalar(p.intensity ?? 4), side: THREE.DoubleSide }));
    m.position.copy(d.multiplyScalar(45));
    m.lookAt(0, 0, 0);
    scene.add(m);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(scene, 0.02).texture;
  pmrem.dispose();
  scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  return tex;
}

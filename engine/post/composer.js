// engine/post/composer.js — the full post stack, driven by a plain params object every frame.
//   const post = new Composer(renderer, { width, height, quality });
//   post.render(scene, camera, { time, dof, shafts, ao, bloom, grade, overlay });
// Order: scene (MSAA HalfFloat + depth) → GTAO (half res) → volumetric shafts (ray-marched through the sun's
// shadow map, low res + blur) → composite (AO·colour + shafts, signed CoC in alpha) → bokeh DOF (half-res
// golden-angle gather) + overlay layer (titles) → bloom → grade (tone map, lift/gamma/gain, warmth, split tone,
// saturation, vignette, chromatic aberration, grain, letterbox) → screen.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { createShaftsMaterial, bindSunUniforms } from '../fx/lightshafts.js';
import { GRADE_FRAG, COMPOSITE_FRAG, DOF_FRAG, DOF_MERGE_FRAG, BLUR_FRAG } from './shaders.js';

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
const rt = (w, h, o = {}) => new THREE.WebGLRenderTarget(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), { type: THREE.HalfFloatType, depthBuffer: false, ...o });
const mat = (frag, uniforms, defines = {}) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, defines, depthTest: false, depthWrite: false, toneMapped: false });

export const DEFAULT_GRADE = {
  exposure: 1.0, tone: 'aces', contrast: 1.04, saturation: 1.06, warmth: 0.12, tint: 0.0,
  lift: [0.0, 0.0, 0.0], gamma: [1, 1, 1], gain: [1, 1, 1],
  shadowTint: [-0.01, 0.012, 0.03], highlightTint: [0.03, 0.012, -0.02],
  vignette: 0.32, grain: 0.035, ca: 0.0015, letterbox: 0, letterboxAspect: 2.35, fade: 0,
};

export class Composer {
  constructor(renderer, { width, height, quality }) {
    this.renderer = renderer;
    this.q = quality;
    this.w = width; this.h = height;
    const q = quality;
    const depthTexture = new THREE.DepthTexture(width, height, THREE.FloatType);
    this.sceneRT = rt(width, height, { samples: q.msaa || 0, depthBuffer: true, depthTexture });
    this.overlayRT = rt(width, height, { samples: q.msaa || 0, depthBuffer: true });
    this.compRT = rt(width, height);
    this.dofHalf = rt(width / 2, height / 2);
    this.dofRT = rt(width, height);
    const ss = q.shaftScale || 0.25;
    this.shaftA = rt(width * ss, height * ss);
    this.shaftB = rt(width * ss, height * ss);
    this.quad = new FullScreenQuad();
    this.shaftsMat = createShaftsMaterial();
    this.shaftsMat.defines.STEPS = q.shafts || 32;
    this.blurMat = mat(BLUR_FRAG, { tInput: { value: null }, dir: { value: new THREE.Vector2() } });
    this.compMat = mat(COMPOSITE_FRAG, {
      tScene: { value: this.sceneRT.texture }, tDepth: { value: depthTexture }, tAO: { value: null }, tShafts: { value: this.shaftA.texture },
      aoOn: { value: 0 }, aoIntensity: { value: 1 }, shaftsOn: { value: 0 }, near: { value: 1 }, far: { value: 1000 },
      focusDist: { value: 100 }, cocScale: { value: 0 }, maxCoc: { value: 24 },
    });
    this.dofMat = mat(DOF_FRAG, { tColor: { value: this.compRT.texture }, texel: { value: new THREE.Vector2(1 / width, 1 / height) }, maxCoc: { value: 24 }, radScale: { value: 0.6 } });
    this.mergeMat = mat(DOF_MERGE_FRAG, { tSharp: { value: this.compRT.texture }, tBlur: { value: this.dofHalf.texture }, tOverlay: { value: this.overlayRT.texture }, dofOn: { value: 1 }, overlayOn: { value: 0 } });
    this.gradeMat = mat(GRADE_FRAG, {
      tColor: { value: this.dofRT.texture }, toneMappingExposure: { value: 1 }, resolution: { value: new THREE.Vector2(width, height) }, time: { value: 0 },
      exposure: { value: 1 }, toneMode: { value: 1 }, contrast: { value: 1 }, saturation: { value: 1 }, warmth: { value: 0 }, tint: { value: 0 },
      lift: { value: new THREE.Vector3() }, gammaV: { value: new THREE.Vector3(1, 1, 1) }, gain: { value: new THREE.Vector3(1, 1, 1) },
      shadowTint: { value: new THREE.Vector3() }, highlightTint: { value: new THREE.Vector3() },
      vignette: { value: 0 }, grain: { value: 0 }, ca: { value: 0 }, letterbox: { value: 0 }, fade: { value: 0 },
    });
    this.bloom = new UnrealBloomPass(new THREE.Vector2(width / 2, height / 2), 0.35, 0.6, 1.0);
    this.gtao = null;
    this._v = new THREE.Vector3();
  }

  _gtao(scene, camera) {
    if (!this.gtao || this.gtao.scene !== scene || this.gtao.camera !== camera) {
      const s = this.q.aoScale || 0.5;
      this.gtao = new GTAOPass(scene, camera, Math.round(this.w * s), Math.round(this.h * s));
      this.gtao.output = GTAOPass.OUTPUT.Off;
    }
    return this.gtao;
  }

  _pass(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.quad.render(this.renderer);
  }

  /**
   * p.dof    { on, focus (world distance), fstop, focal (mm), sensor (mm, default 36), maxCoc (px) }
   * p.shafts { on, light (DirectionalLight with shadow), color, density, g, box: [[minx,miny,minz],[max...]], noise }
   * p.ao     { on, intensity, radius }
   * p.bloom  { strength, radius, threshold }
   * p.grade  partial DEFAULT_GRADE
   * p.overlay { scene, camera } rendered sharp over the image (titles)
   */
  render(scene, camera, p = {}) {
    const r = this.renderer, q = this.q;
    const prevClear = r.getClearColor(new THREE.Color()), prevAlpha = r.getClearAlpha();
    // 1. scene
    r.setRenderTarget(this.sceneRT);
    r.setClearColor(0x000000, 1);
    r.clear();
    r.render(scene, camera);
    // 2. ambient occlusion
    const aoOn = q.ao && p.ao?.on !== false;
    if (aoOn) {
      const g = this._gtao(scene, camera);
      g.updateGtaoMaterial({ radius: p.ao?.radius ?? 6, distanceExponent: 1.5, thickness: p.ao?.thickness ?? 4, scale: 1, samples: 12 });
      g.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      g.render(r, null, this.sceneRT);
      this.compMat.uniforms.tAO.value = g.pdRenderTarget.texture;
    }
    // 3. light shafts
    const sh = p.shafts;
    const shaftsOn = !!(sh && sh.on !== false && sh.light && q.shafts > 0);
    if (shaftsOn) {
      const u = this.shaftsMat.uniforms;
      bindSunUniforms(u, sh.light);
      u.tDepth.value = this.sceneRT.depthTexture;
      u.projInv.value.copy(camera.projectionMatrixInverse);
      u.camWorld.value.copy(camera.matrixWorld);
      u.camPos.value.setFromMatrixPosition(camera.matrixWorld);
      u.lightDir.value.copy(sh.light.target.position).sub(sh.light.position).normalize();
      u.color.value.set(sh.color ?? '#ffc58a');
      u.density.value = sh.density ?? 0.002;
      u.g.value = sh.g ?? 0.55;
      u.time.value = p.time || 0;
      u.noiseAmount.value = sh.noise ?? 0.6;
      u.noiseScale.value = sh.noiseScale ?? 0.035;
      if (sh.box) { u.boxMin.value.set(...sh.box[0]); u.boxMax.value.set(...sh.box[1]); }
      this._pass(this.shaftsMat, this.shaftA);
      const bu = this.blurMat.uniforms;
      bu.tInput.value = this.shaftA.texture; bu.dir.value.set(1 / this.shaftA.width, 0); this._pass(this.blurMat, this.shaftB);
      bu.tInput.value = this.shaftB.texture; bu.dir.value.set(0, 1 / this.shaftA.height); this._pass(this.blurMat, this.shaftA);
    }
    // 4. composite + circle of confusion
    const cu = this.compMat.uniforms;
    cu.aoOn.value = aoOn ? 1 : 0;
    cu.aoIntensity.value = p.ao?.intensity ?? 1;
    cu.shaftsOn.value = shaftsOn ? 1 : 0;
    cu.near.value = camera.near; cu.far.value = camera.far;
    const dof = p.dof || {};
    const dofOn = dof.on !== false && dof.focus > 0;
    if (dofOn) {
      // thin lens: CoC_px = A·f·|z−zf| / (z·(zf−f)) / sensor · width ; world units are cm → mm ×10
      const f = dof.focal ?? 50, N = dof.fstop ?? 2.8, zf = dof.focus * 10, sensor = dof.sensor ?? 36;
      cu.focusDist.value = dof.focus;
      cu.cocScale.value = ((f / N) * f / Math.max(zf - f, 1)) / sensor * this.w * (dof.scale ?? 1);
      cu.maxCoc.value = dof.maxCoc ?? 22;
    } else cu.cocScale.value = 0;
    this._pass(this.compMat, this.compRT);
    // 5. depth of field (+ overlay)
    if (dofOn) {
      const du = this.dofMat.uniforms;
      du.maxCoc.value = cu.maxCoc.value;
      du.radScale.value = Math.max(0.35, cu.maxCoc.value ** 2 / (2 * (q.dofTaps || 64))); // ≈ dofTaps samples
      this._pass(this.dofMat, this.dofHalf);
    }
    const ov = p.overlay;
    if (ov?.scene) {
      r.setRenderTarget(this.overlayRT);
      r.setClearColor(0x000000, 0); r.clear();
      r.render(ov.scene, ov.camera);
    }
    this.mergeMat.uniforms.dofOn.value = dofOn ? 1 : 0;
    this.mergeMat.uniforms.overlayOn.value = ov?.scene ? 1 : 0;
    this._pass(this.mergeMat, this.dofRT);
    // 6. bloom (additive, in place)
    if (q.bloom && p.bloom?.strength !== 0) {
      this.bloom.strength = p.bloom?.strength ?? 0.35;
      this.bloom.radius = p.bloom?.radius ?? 0.6;
      this.bloom.threshold = p.bloom?.threshold ?? 1.0;
      this.bloom.render(r, null, this.dofRT);
    }
    // 7. grade → screen
    const gr = { ...DEFAULT_GRADE, ...(p.grade || {}) };
    const gu = this.gradeMat.uniforms;
    gu.time.value = p.time || 0;
    gu.exposure.value = gr.exposure; gu.toneMode.value = gr.tone === 'aces' ? 0 : 1;
    gu.contrast.value = gr.contrast; gu.saturation.value = gr.saturation; gu.warmth.value = gr.warmth; gu.tint.value = gr.tint;
    gu.lift.value.set(...gr.lift); gu.gammaV.value.set(...gr.gamma); gu.gain.value.set(...gr.gain);
    gu.shadowTint.value.set(...gr.shadowTint); gu.highlightTint.value.set(...gr.highlightTint);
    gu.vignette.value = gr.vignette; gu.grain.value = gr.grain; gu.ca.value = gr.ca; gu.fade.value = gr.fade;
    gu.letterbox.value = gr.letterbox * Math.max(0, (1 - (this.w / this.h) / gr.letterboxAspect) / 2);
    this._pass(this.gradeMat, null);
    r.setClearColor(prevClear, prevAlpha);
  }
}

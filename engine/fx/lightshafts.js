// engine/fx/lightshafts.js — volumetric light shafts ray-marched through a directional light's shadow map.
// Because the march samples the real shadow map, window frames / lattices / props cut real beams.
//   const shafts = createShaftsMaterial();  composer drives the uniforms each frame (see post/composer.js).
// Also exports SUNLIT_GLSL: `float sunVisibility(vec3 worldPos)` for particles that should glow only in the beam.
import * as THREE from 'three';

/** GLSL: shadow-map visibility of a world point (1 = in sunlight). Needs uniforms tSunShadow, sunShadowMatrix, sunShadowOn. */
export const SUNLIT_GLSL = /* glsl */ `
uniform sampler2DShadow tSunShadow;
uniform mat4 sunShadowMatrix;
uniform float sunShadowOn;
float sunVisibility(vec3 wp) {
  if (sunShadowOn < 0.5) return 1.0;
  vec4 sc = sunShadowMatrix * vec4(wp, 1.0);
  sc.xyz /= sc.w;
  if (sc.x < 0.0 || sc.x > 1.0 || sc.y < 0.0 || sc.y > 1.0 || sc.z > 1.0) return 0.0;
  return texture(tSunShadow, vec3(sc.xy, sc.z - 0.0015));
}`;

/** Uniform block matching SUNLIT_GLSL; call bindSunUniforms(uniforms, light) every frame after the scene render. */
export const sunUniforms = () => ({ tSunShadow: { value: null }, sunShadowMatrix: { value: new THREE.Matrix4() }, sunShadowOn: { value: 0 } });
export function bindSunUniforms(u, light) {
  const tex = light?.shadow?.map?.depthTexture;
  u.sunShadowOn.value = tex ? 1 : 0;
  if (tex) { u.tSunShadow.value = tex; u.sunShadowMatrix.value.copy(light.shadow.matrix); }
}

export function createShaftsMaterial() {
  return new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    defines: { STEPS: 32 },
    uniforms: {
      ...sunUniforms(),
      tDepth: { value: null }, projInv: { value: new THREE.Matrix4() }, camWorld: { value: new THREE.Matrix4() },
      camPos: { value: new THREE.Vector3() }, lightDir: { value: new THREE.Vector3(0, 1, 0) }, color: { value: new THREE.Color(1, 0.8, 0.5) },
      density: { value: 0.002 }, g: { value: 0.55 }, boxMin: { value: new THREE.Vector3(-1e4, -1e4, -1e4) }, boxMax: { value: new THREE.Vector3(1e4, 1e4, 1e4) },
      time: { value: 0 }, noiseScale: { value: 0.035 }, noiseAmount: { value: 0.6 }, maxDist: { value: 3000 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tDepth; uniform mat4 projInv, camWorld; uniform vec3 camPos, lightDir, color, boxMin, boxMax;
      uniform float density, g, time, noiseScale, noiseAmount, maxDist;
      ${SUNLIT_GLSL}
      float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float vnoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.-2.*f);
        return mix(mix(mix(h3(i), h3(i+vec3(1,0,0)), f.x), mix(h3(i+vec3(0,1,0)), h3(i+vec3(1,1,0)), f.x), f.y),
                   mix(mix(h3(i+vec3(0,0,1)), h3(i+vec3(1,0,1)), f.x), mix(h3(i+vec3(0,1,1)), h3(i+vec3(1,1,1)), f.x), f.y), f.z); }
      float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
      void main() {
        float d = texture2D(tDepth, vUv).x;
        vec4 vp = projInv * vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); vp /= vp.w;
        vec3 wp = (camWorld * vec4(vp.xyz, 1.0)).xyz;
        vec3 rd = wp - camPos; float sceneDist = min(length(rd), maxDist); rd = normalize(rd);
        // clip the ray against the participating-medium box
        vec3 inv = 1.0 / rd; vec3 t0 = (boxMin - camPos) * inv, t1 = (boxMax - camPos) * inv;
        vec3 tmin = min(t0, t1), tmax = max(t0, t1);
        float a = max(max(max(tmin.x, tmin.y), tmin.z), 0.0), b = min(min(min(tmax.x, tmax.y), tmax.z), sceneDist);
        if (b <= a) { gl_FragColor = vec4(0.0); return; }
        float dt = (b - a) / float(STEPS), j = ign(gl_FragCoord.xy), sum = 0.0;
        for (int i = 0; i < STEPS; i++) {
          vec3 p = camPos + rd * (a + (float(i) + j) * dt);
          float vis = sunVisibility(p);
          float n = vnoise(p * noiseScale + vec3(0.0, time * 0.12, time * 0.05)) * 0.65 + vnoise(p * noiseScale * 2.7 - vec3(time * 0.1)) * 0.35;
          sum += vis * (1.0 - noiseAmount + noiseAmount * n * 1.6);
        }
        float mu = dot(rd, -lightDir);
        float phase = (1.0 - g*g) / pow(1.0 + g*g - 2.0*g*mu, 1.5) * 0.0796;
        gl_FragColor = vec4(color * sum * dt * density * phase * 12.566, 1.0);
      }`,
  });
}

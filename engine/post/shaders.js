// engine/post/shaders.js — fragment shaders for the post stack (see composer.js for the pass order).
// All read `varying vec2 vUv`. Colours are linear HDR until GRADE_FRAG, which tone-maps and encodes sRGB.

export const COMPOSITE_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D tScene, tDepth, tAO, tShafts;
  uniform float aoOn, aoIntensity, shaftsOn, near, far, focusDist, cocScale, maxCoc;
  float linDepth(float d) { float z = d * 2.0 - 1.0; return 2.0 * near * far / (far + near - z * (far - near)); }
  void main() {
    vec3 c = texture2D(tScene, vUv).rgb;
    if (aoOn > 0.5) c *= mix(1.0, texture2D(tAO, vUv).r, aoIntensity);
    if (shaftsOn > 0.5) c += texture2D(tShafts, vUv).rgb;
    float z = linDepth(texture2D(tDepth, vUv).x);
    float coc = clamp(cocScale * (z - focusDist) / z, -maxCoc, maxCoc); // signed: <0 in front of focus
    gl_FragColor = vec4(c, coc);
  }`;

// Single-pass scatter-as-gather bokeh (golden-angle spiral). Background samples may not bleed over sharper
// foreground; foreground samples spill over the background, giving soft near-field edges.
export const DOF_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D tColor; uniform vec2 texel; uniform float maxCoc, radScale;
  void main() {
    vec4 c0 = texture2D(tColor, vUv);
    float cs = abs(c0.a);
    vec3 acc = c0.rgb; float tot = 1.0, radius = radScale, ang = 0.0;
    for (int i = 0; i < 512; i++) {
      if (radius >= maxCoc) break;
      vec4 s = texture2D(tColor, vUv + vec2(cos(ang), sin(ang)) * texel * radius);
      float ss = abs(s.a);
      if (s.a > c0.a) ss = clamp(ss, 0.0, cs * 2.0);
      float m = smoothstep(radius - 0.5, radius + 0.5, ss);
      vec3 sc = s.rgb * (1.0 + 0.6 * smoothstep(1.5, 6.0, dot(s.rgb, vec3(0.3, 0.6, 0.1)))); // brighter bokeh discs
      acc += mix(acc / tot, sc, m);
      tot += 1.0;
      radius += radScale / radius;
      ang += 2.39996323;
    }
    gl_FragColor = vec4(acc / tot, cs);
  }`;

export const DOF_MERGE_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D tSharp, tBlur, tOverlay; uniform float dofOn, overlayOn;
  void main() {
    vec4 s = texture2D(tSharp, vUv);
    vec3 c = s.rgb;
    if (dofOn > 0.5) {
      vec4 b = texture2D(tBlur, vUv);
      c = mix(c, b.rgb, smoothstep(0.5, 2.5, max(abs(s.a), b.a)));
    }
    if (overlayOn > 0.5) { vec4 o = texture2D(tOverlay, vUv); c = c * (1.0 - o.a) + o.rgb; }
    gl_FragColor = vec4(c, 1.0);
  }`;

export const BLUR_FRAG = /* glsl */ `
  varying vec2 vUv; uniform sampler2D tInput; uniform vec2 dir;
  void main() {
    vec3 c = texture2D(tInput, vUv).rgb * 0.227027;
    c += (texture2D(tInput, vUv + dir * 1.384615).rgb + texture2D(tInput, vUv - dir * 1.384615).rgb) * 0.316216;
    c += (texture2D(tInput, vUv + dir * 3.230769).rgb + texture2D(tInput, vUv - dir * 3.230769).rgb) * 0.070270;
    gl_FragColor = vec4(c, 1.0);
  }`;

export const GRADE_FRAG = /* glsl */ `
  #include <tonemapping_pars_fragment>
  varying vec2 vUv;
  uniform sampler2D tColor; uniform vec2 resolution;
  uniform float time, exposure, toneMode, contrast, saturation, warmth, tint, vignette, grain, ca, letterbox, fade;
  uniform vec3 lift, gammaV, gain, shadowTint, highlightTint;
  float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
  void main() {
    vec2 d = vUv - 0.5;
    vec3 c;
    if (ca > 0.0) {
      vec2 off = d * ca * length(d) * 4.0;
      c = vec3(texture2D(tColor, vUv - off).r, texture2D(tColor, vUv).g, texture2D(tColor, vUv + off).b);
    } else c = texture2D(tColor, vUv).rgb;
    c *= exposure * vec3(1.0 + warmth * 0.12, 1.0 + tint * 0.05, 1.0 - warmth * 0.12);
    c = toneMode > 0.5 ? AgXToneMapping(c) : ACESFilmicToneMapping(c);
    c = toSRGB(clamp(c, 0.0, 1.0));
    c = (c - 0.5) * contrast + 0.5;
    c = gain * (c + lift * (1.0 - c));
    c = pow(max(c, 0.0), 1.0 / gammaV);
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c += shadowTint * pow(1.0 - l, 2.0) + highlightTint * l * l;
    c = mix(vec3(l), c, saturation);
    float v = length(d * vec2(resolution.x / resolution.y, 1.0));
    c *= 1.0 - vignette * smoothstep(0.35, 1.1, v);
    float n = hash12(gl_FragCoord.xy + fract(time * 7.31) * vec2(913.0, 371.0)) + hash12(gl_FragCoord.xy * 1.37 + fract(time * 3.17) * vec2(127.0, 911.0)) - 1.0;
    c += n * grain * (1.0 - 0.6 * l);
    c *= 1.0 - fade;
    if (abs(vUv.y - 0.5) > 0.5 - letterbox) c = vec3(0.0);
    c += (hash12(gl_FragCoord.xy + 17.0) - 0.5) / 255.0;
    gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
  }`;

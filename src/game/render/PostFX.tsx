"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { type Camera, HalfFloatType, type Object3D, type Scene, WebGLRenderTarget } from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

/**
 * GTAO that skips sprites and anything tagged `userData.noAO` (bubbles, cursors, ghosts,
 * queue markers): they float over the world and shouldn't darken what's behind them.
 */
class FarmAOPass extends GTAOPass {
  private hidden: Object3D[] = [];

  constructor(scene: Scene, camera: Camera, width: number, height: number) {
    super(scene, camera, width, height);
    // biome-ignore lint/suspicious/noExplicitAny: patching three's private visibility hooks
    const self = this as any;
    const baseOverride = self._overrideVisibility.bind(this);
    const baseRestore = self._restoreVisibility.bind(this);
    self._overrideVisibility = () => {
      baseOverride();
      scene.traverse((o: Object3D & { isSprite?: boolean }) => {
        if (o.visible && (o.isSprite || o.userData.noAO)) {
          o.visible = false;
          this.hidden.push(o);
        }
      });
    };
    self._restoreVisibility = () => {
      for (const o of this.hidden) o.visible = true;
      this.hidden.length = 0;
      baseRestore();
    };
  }
}

/** Warm, slightly richer colors and a soft vignette, applied after tone mapping (sRGB). */
const GradeShader = {
  name: "FarmGrade",
  uniforms: {
    tDiffuse: { value: null },
    saturation: { value: 1.04 },
    contrast: { value: 1.06 },
    warmth: { value: 0.018 },
    vignette: { value: 0.22 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float saturation;
    uniform float contrast;
    uniform float warmth;
    uniform float vignette;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 c = texel.rgb;
      float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(luma), c, saturation);
      c = (c - 0.5) * contrast + 0.5;
      c += vec3(warmth, warmth * 0.4, -warmth);
      vec2 d = vUv - 0.5;
      c *= 1.0 - vignette * smoothstep(0.35, 0.85, length(d * vec2(1.0, 0.8)) * 1.25);
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), texel.a);
    }`,
};

/** Takes over rendering: scene → ambient occlusion → tone mapping → color grade. */
export function PostFX() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const composer = useMemo(() => {
    const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
    const composer = new EffectComposer(gl, target);
    composer.addPass(new RenderPass(scene, camera));
    const ao = new FarmAOPass(scene, camera, 1, 1);
    ao.updateGtaoMaterial({
      radius: 0.9,
      distanceExponent: 1.6,
      thickness: 1.2,
      scale: 1.25,
      samples: 12,
    });
    ao.updatePdMaterial({ radius: 6, samples: 12, rings: 2, radiusExponent: 2 });
    ao.blendIntensity = 0.85;
    composer.addPass(ao);
    composer.addPass(new OutputPass());
    composer.addPass(new ShaderPass(GradeShader));
    return composer;
  }, [gl, scene, camera]);

  useEffect(() => {
    composer.setPixelRatio(gl.getPixelRatio());
    composer.setSize(size.width, size.height);
  }, [composer, gl, size]);

  useEffect(() => () => composer.dispose(), [composer]);

  // A positive priority tells R3F we render the frame ourselves.
  useFrame((_, delta) => composer.render(delta), 1);
  return null;
}

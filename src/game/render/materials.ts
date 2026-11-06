import { MeshLambertMaterial } from "three";

// Shared materials for procedural models: flat-shaded, colored by vertex colors.
export const flatMaterial = new MeshLambertMaterial({ vertexColors: true, flatShading: true });

/** Same look, tinted dry brown for withered crops. */
export const witheredMaterial = new MeshLambertMaterial({
  vertexColors: true,
  flatShading: true,
  color: "#b08a52",
});

/** Shared clock for the crop sway (seconds); FieldLayer advances it each frame. */
export const swayUniforms = { uTime: { value: 0 }, uSway: { value: 1 } };

/**
 * Crops: the flat look plus a gentle breeze. Each plant leans by an amount that grows with its
 * height, phased by its instance position so a field ripples instead of moving in lockstep.
 */
export const cropMaterial = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
cropMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = swayUniforms.uTime;
  shader.uniforms.uSway = swayUniforms.uSway;
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nuniform float uTime;\nuniform float uSway;")
    .replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = instanceMatrix[3].xyz;
        float h = max(transformed.y, 0.0);
        float wave = sin(uTime * 1.7 + ip.x * 0.8 + ip.z * 0.6);
        transformed.x += wave * 0.05 * h * uSway;
        transformed.z += cos(uTime * 1.3 + ip.x * 0.5) * 0.035 * h * uSway;
      #endif`,
    );
};
cropMaterial.customProgramCacheKey = () => "crop-sway";

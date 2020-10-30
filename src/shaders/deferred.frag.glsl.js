export default function(params) {
  // console.log(JSON.stringify(params));    // Display information of the variable

  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  
  varying vec2 v_uv;

  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;

  struct Light {
    vec3 position;
    float radius;
    vec3 color;
  };

  // Jacky added
  uniform mat4 u_viewMatrix;
  uniform mat4 u_viewProjectionMatrix;
  uniform vec3 u_camPos;

  float ExtractFloat(sampler2D texture, int textureWidth, int textureHeight, int index, int component) {
    float u = float(index + 1) / float(textureWidth + 1);
    int pixel = component / 4;
    float v = float(pixel + 1) / float(textureHeight + 1);
    vec4 texel = texture2D(texture, vec2(u, v));
    int pixelComponent = component - pixel * 4;
    if (pixelComponent == 0) {
      return texel[0];
    } else if (pixelComponent == 1) {
      return texel[1];
    } else if (pixelComponent == 2) {
      return texel[2];
    } else if (pixelComponent == 3) {
      return texel[3];
    }
  }

  Light UnpackLight(int index) {
    Light light;
    float u = float(index + 1) / float(${params.numLights + 1});
    vec4 v1 = texture2D(u_lightbuffer, vec2(u, 0.3));
    vec4 v2 = texture2D(u_lightbuffer, vec2(u, 0.6));
    light.position = v1.xyz;

    // LOOK: This extracts the 4th float (radius) of the (index)th light in the buffer
    // Note that this is just an example implementation to extract one float.
    // There are more efficient ways if you need adjacent values
    light.radius = ExtractFloat(u_lightbuffer, ${params.numLights}, 2, index, 3);

    light.color = v2.rgb;
    return light;
  }


  // Cubic approximation of gaussian curve so we falloff to exactly 0 at the light radius
  float cubicGaussian(float h) {
    if (h < 1.0) {
      return 0.25 * pow(2.0 - h, 3.0) - pow(1.0 - h, 3.0);
    } else if (h < 2.0) {
      return 0.25 * pow(2.0 - h, 3.0);
    } else {
      return 0.0;
    }
  }
  
  void main() {
    // TODO: extract data from g buffers and do lighting
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv);  // color
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv);  // normal
    vec4 gb2 = texture2D(u_gbuffers[2], v_uv);  // position
    vec4 gb3 = texture2D(u_gbuffers[3], v_uv);

    vec3 albedo = gb0.rgb;
    vec3 normal = gb1.xyz;
    vec3 pos = gb2.xyz;

    vec3 fragColor = vec3(0.0);

    vec2 fragUV = gl_FragCoord.xy / vec2(float(${params.widthParam}), float(${params.heightParam}));
    float xInterval = 1.0 / float(${params.xSlicesParam});
    float yInterval = 1.0 / float(${params.ySlicesParam});
    float zInterval = (float(${params.farParam}) - float(${params.nearParam})) / float(${params.zSlicesParam});
    int xCluster = int(floor(fragUV.x / xInterval));
    int yCluster = int(floor(fragUV.y / yInterval));
    float depth = abs((u_viewMatrix * vec4(pos, 1.0)).z);
    int zCluster = int(floor((depth - float(${params.nearParam})) / zInterval));

    int indexCluster = xCluster + yCluster * ${params.xSlicesParam} + zCluster * ${params.xSlicesParam} * ${params.ySlicesParam};
    int totalClusterNum = ${params.xSlicesParam} * ${params.ySlicesParam} * ${params.zSlicesParam};
    int lightCount = int(ExtractFloat(u_clusterbuffer, totalClusterNum, ${params.maxLightsParam} + 1, indexCluster, 0));

    for (int i = 0; i < ${params.maxLightsParam}; i++) {
      if (i >= lightCount) {
        break;
      }
      // Note that it's i + 1 in the last input argument into ExtractFloat() here because the 0th component always stores
      // the number of lights in that cluster
      int indexLight = int(ExtractFloat(u_clusterbuffer, totalClusterNum, ${params.maxLightsParam} + 1, indexCluster, i + 1));

      Light light = UnpackLight(indexLight);
      float lightDistance = distance(light.position, pos);
      vec3 L = (light.position - pos) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);

      float lambertTerm = max(dot(L, normal), 0.0);

      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
    
      bool blinnPhong = true;
      if (blinnPhong) {
        // Blinn Phong
        vec3 lightVec = normalize(light.position - pos);
        vec3 viewVec = normalize(u_camPos - pos);
        vec3 h = normalize(lightVec + viewVec);
        float exp = 8.0;
        float specularIntensity = max(pow(dot(h, normal), exp), 0.0);
        vec3 specularColor = specularIntensity * light.color * vec3(lightIntensity);

        fragColor += specularColor;
      }
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    fragColor = clamp(fragColor, vec3(0.0), vec3(1.0));
    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}
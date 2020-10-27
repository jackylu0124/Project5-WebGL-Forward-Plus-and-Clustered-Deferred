import TextureBuffer from './textureBuffer';
import { Vector3, Vector4, Plane, Sphere, Frustum } from 'three';

export const MAX_LIGHTS_PER_CLUSTER = 100;

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
  }

  updateClusters(camera, viewMatrix, scene) {
    // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...

    let camPos = camera.position;
    let viewMat = camera.matrixWorldInverse;

    let camR = new Vector3();
    let camU = new Vector3();
    let camF = new Vector3();
    viewMat.clone().transpose().extractBasis(camR, camU, camF);

    let nearClip = camera.near;
    let farClip = 40.0;
    let divNumX = this._xSlices;
    let divNumY = this._ySlices;
    let divNumZ = this._zSlices;
    let dz = (farClip - nearClip) / divNumZ;
    let fovRad = camera.fov / 180.0 * Math.PI;

    // Sphere Benchmark Test
    // new Sphere(new Vector3(15.0, -5.0, 0.0), 8.2) intersects with 245 clusters when divNumX = divNumY = divNumZ = 15
    // and when camera is at initial position
    let s1 = new Sphere(new Vector3(15.0, -5.0, 0.0), 8.2);  // For testing purposes
    let counter = 0;  // For testing purposes

    for (let z = 0; z < divNumZ; ++z) {
      let depthCur = nearClip + dz * z;
      let heightCur = depthCur * Math.tan(fovRad / 2.0) * 2;
      let widthCur = camera.aspect * heightCur;

      let depthNext = nearClip + dz * (z + 1);
      let heightNext = heightCur * (depthNext / depthCur);
      let widthNext = widthCur * (depthNext / depthCur);

      let originCur = camPos.clone().add(camR.clone().multiplyScalar(-widthCur / 2.0));
      originCur = originCur.add(camU.clone().multiplyScalar(-heightCur / 2.0));
      originCur = originCur.add(camF.clone().multiplyScalar(-depthCur));

      let originNext = camPos.clone().add(camR.clone().multiplyScalar(-widthNext / 2.0));
      originNext = originNext.add(camU.clone().multiplyScalar(-heightNext / 2.0));
      originNext = originNext.add(camF.clone().multiplyScalar(-depthNext));

      let dxCur = widthCur / divNumX;
      let dyCur = heightCur / divNumY;
      let dxNext = widthNext / divNumX;
      let dyNext = heightNext / divNumY;

      for (let y = 0; y < divNumY; ++y) {
        for (let x = 0; x < divNumX; ++x) {
          let pt0 = originCur.clone().add(camR.clone().multiplyScalar(x * dxCur)).add(camU.clone().multiplyScalar(y * dyCur));
          let pt1 = pt0.clone().add(camR.clone().multiplyScalar(dxCur));
          let pt2 = pt0.clone().add(camR.clone().multiplyScalar(dxCur)).add(camU.clone().multiplyScalar(dyCur));
          let pt3 = pt0.clone().add(camU.clone().multiplyScalar(dyCur));

          let pt4 = originNext.clone().add(camR.clone().multiplyScalar(x * dxNext)).add(camU.clone().multiplyScalar(y * dyNext));
          let pt5 = pt4.clone().add(camR.clone().multiplyScalar(dxNext));
          let pt6 = pt4.clone().add(camR.clone().multiplyScalar(dxNext)).add(camU.clone().multiplyScalar(dyNext));
          let pt7 = pt4.clone().add(camU.clone().multiplyScalar(dyNext));

          // Front Plane
          let planeFront = new Plane();
          planeFront.setFromCoplanarPoints(pt0, pt1, pt2);

          // Back Plane
          let planeBack = new Plane();
          planeBack.setFromCoplanarPoints(pt4, pt7, pt6);

          // Left Plane
          let planeLeft = new Plane();
          planeLeft.setFromCoplanarPoints(pt0, pt3, pt7);

          // Right Plane
          let planeRight = new Plane();
          planeRight.setFromCoplanarPoints(pt1, pt5, pt6);

          // Top Plane
          let planeTop = new Plane();
          planeTop.setFromCoplanarPoints(pt3, pt2, pt6);

          // Bottom Plane
          let planeBottom = new Plane();
          planeBottom.setFromCoplanarPoints(pt0, pt4, pt5);

          // Construct Sub-frustum/Cluster
          planeFront.negate();
          planeBack.negate();
          planeLeft.negate();
          planeRight.negate();
          planeTop.negate();
          planeBottom.negate();
          let frust = new Frustum(planeFront, planeBack, planeLeft, planeRight, planeTop, planeBottom);

          // For testing purposes
          if (frust.containsPoint(s1.center) || frust.intersectsSphere(s1)) {
            counter++;
          }


          let i = x + y * divNumX + z * divNumX * divNumY;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }
    // console.log(JSON.stringify(counter));    // Display information of the variable
    this._clusterTexture.update();
  }
}
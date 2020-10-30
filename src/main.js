import { makeRenderLoop, camera, cameraControls, gui, gl } from './init';
import ForwardRenderer from './renderers/forward';
import ForwardPlusRenderer from './renderers/forwardPlus';
import ClusteredDeferredRenderer from './renderers/clusteredDeferred';
import Scene from './scene';
import Wireframe from './wireframe';
import { Vector3, Vector4, Plane, Sphere, Frustum } from 'three';

const FORWARD = 'Forward';
const FORWARD_PLUS = 'Forward+';
const CLUSTERED = 'Clustered Deferred';

const params = {
  renderer: FORWARD_PLUS,
  _renderer: null,
};

setRenderer(params.renderer);

function setRenderer(renderer) {
  switch(renderer) {
    case FORWARD:
      params._renderer = new ForwardRenderer();
      break;
    case FORWARD_PLUS:
      params._renderer = new ForwardPlusRenderer(15, 15, 15);
      break;
    case CLUSTERED:
      params._renderer = new ClusteredDeferredRenderer(15, 15, 15);
      break;
  }
}

gui.add(params, 'renderer', [FORWARD, FORWARD_PLUS, CLUSTERED]).onChange(setRenderer);

const scene = new Scene();
scene.loadGLTF('models/sponza/sponza.gltf');

// LOOK: The Wireframe class is for debugging.
// It lets you draw arbitrary lines in the scene.
// This may be helpful for visualizing your frustum clusters so you can make
// sure that they are in the right place.
const wireframe = new Wireframe();

/*
var segmentStart = [-14.0, 0.0, -6.0];
var segmentEnd = [14.0, 20.0, 6.0];
var segmentColor = [1.0, 0.0, 0.0];
wireframe.addLineSegment(segmentStart, segmentEnd, segmentColor);
wireframe.addLineSegment([-14.0, 1.0, -6.0], [14.0, 21.0, 6.0], [0.0, 1.0, 0.0]);
*/

camera.position.set(-10, 8, 0);
cameraControls.target.set(0, 2, 0);
gl.enable(gl.DEPTH_TEST);

function render() {
  scene.update();  
  params._renderer.render(camera, scene);

  // Test
  // drawClusters(camera);

  // LOOK: Render wireframe "in front" of everything else.
  // If you would like the wireframe to render behind and in front
  // of objects based on relative depths in the scene, comment out /
  //the gl.disable(gl.DEPTH_TEST) and gl.enable(gl.DEPTH_TEST) lines.
  gl.disable(gl.DEPTH_TEST);
  wireframe.render(camera);
  gl.enable(gl.DEPTH_TEST);
}

function drawClusters(camera) {
  // let camPos = camera.position;
  let camPos = new Vector3(-10.0, 8.0, 0.0);

  let viewMat = camera.matrixWorldInverse;

  // let camR = new Vector3();
  // let camU = new Vector3();
  // let camF = new Vector3();
  // viewMat.clone().transpose().extractBasis(camR, camU, camF);

  let camR = new Vector3(0.0, 0.0, 1.0);
  let camU = new Vector3(0.5144957554275265, 0.8574929257125443, 0.0);
  let camF = new Vector3(-0.8574929257125443, 0.5144957554275265, 0.0);

  // console.log(JSON.stringify(camera.position));    // Display information of the variable
  // console.log(JSON.stringify(camR));    // Display information of the variable
  // console.log(JSON.stringify(camU));    // Display information of the variable
  // console.log(JSON.stringify(camF));    // Display information of the variable

  let nearClip = camera.near;
  let farClip = 40.0;
  let divNumX = 1;
  let divNumY = 1;
  let divNumZ = 1;
  let dz = (farClip - nearClip) / divNumZ;
  let fovRad = camera.fov / 180.0 * Math.PI;

  // new Sphere(new Vector3(15.0, -5.0, 0.0), 8.2) intersects with 245 clusters when divNumX = divNumY = divNumZ = 15
  // and when camera is at initial position
  let s1 = new Sphere(new Vector3(15.0, -50.0, 0.0), 8.2);
  drawSphere(s1, new Vector3(1.0, 0.0, 1.0));

  let counter = 0;
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

    // Test
    // wireframe.addLineSegment(originCur.toArray(), originNext.toArray(), [0.0, 1.0, 0.0]);
    // let deltaX
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

        let red = new Vector3(1.0, 0.0, 0.0);
        let green = new Vector3(0.0, 1.0, 0.0);

        let normalSize = 2.0; // For visualization purposes
        // Draw Front Plane And Its Normal
        let centerFront = getCenter(pt0, pt1, pt2, pt3);
        let normalFront = getNormal(pt0, pt1, pt2);
        let planeFront = new Plane();
        planeFront.setFromCoplanarPoints(pt0, pt1, pt2);
        // console.log(JSON.stringify(planeFront));    // Display information of the variable
        // drawLine(centerFront, centerFront.clone().add(planeFront.normal.clone().multiplyScalar(normalSize)), green);
        drawPlane(pt0, pt1, pt2, pt3, red);

        // Draw Back Plane And Its Normal
        let centerBack = getCenter(pt4, pt7, pt6, pt5);
        let normalBack = getNormal(pt4, pt7, pt6);
        let planeBack = new Plane();
        planeBack.setFromCoplanarPoints(pt4, pt7, pt6);
        // drawLine(centerBack, centerBack.clone().add(planeBack.normal.clone().multiplyScalar(normalSize)), green);
        drawPlane(pt4, pt7, pt6, pt5, red);

        // Draw Left Plane And Its Normal
        let centerLeft = getCenter(pt0, pt3, pt7, pt4);
        let normalLeft = getNormal(pt0, pt3, pt7);
        let planeLeft = new Plane();
        planeLeft.setFromCoplanarPoints(pt0, pt3, pt7);
        // drawLine(centerLeft, centerLeft.clone().add(planeLeft.normal.clone().multiplyScalar(normalSize)), green);
        drawPlane(pt0, pt3, pt7, pt4, red);

        // Draw Right Plane And Its Normal
        let centerRight = getCenter(pt1, pt5, pt6, pt2);
        let normalRight = getNormal(pt1, pt5, pt6);
        let planeRight = new Plane();
        planeRight.setFromCoplanarPoints(pt1, pt5, pt6);
        // drawLine(centerRight, centerRight.clone().add(planeRight.normal.clone().multiplyScalar(normalSize)), green);
        drawPlane(pt1, pt5, pt6, pt2, red);

        // Draw Top Plane And Its Normal
        let centerTop = getCenter(pt3, pt2, pt6, pt7);
        let normalTop = getNormal(pt3, pt2, pt6);
        let planeTop = new Plane();
        planeTop.setFromCoplanarPoints(pt3, pt2, pt6);
        // drawLine(centerTop, centerTop.clone().add(planeTop.normal.clone().multiplyScalar(normalSize)), green);
        drawPlane(pt3, pt2, pt6, pt7, red);

        // Draw Bottom Plane And Its Normal
        let centerBottom = getCenter(pt0, pt4, pt5, pt1);
        let normalBottom = getNormal(pt0, pt4, pt5);
        let planeBottom = new Plane();
        planeBottom.setFromCoplanarPoints(pt0, pt4, pt5);
        // drawLine(centerBottom, centerBottom.clone().add(planeBottom.normal.clone().multiplyScalar(normalSize)), green);
        drawPlane(pt0, pt4, pt5, pt1, red);
        
        // Construct Sub-frustum/Cluster
        planeFront.negate();
        planeBack.negate();
        planeLeft.negate();
        planeRight.negate();
        planeTop.negate();
        planeBottom.negate();

        let frust = new Frustum(planeFront, planeBack, planeLeft, planeRight, planeTop, planeBottom);
        if (frust.containsPoint(s1.center) || frust.intersectsSphere(s1)) {
          counter++;
        }
      }
    }
  }
  console.log(JSON.stringify(counter));    // Display information of the variable
}

function getCenter(pt0, pt1, pt2, pt3) {
  let result = pt0.clone().add(pt1).add(pt2).add(pt3);
  result.divideScalar(4.0);
  return result;
}

function getNormal(pt0, pt1, pt2) {
  let vec01 = pt1.clone().sub(pt0);
  let vec12 = pt2.clone().sub(pt1);
  vec01.normalize();
  vec12.normalize();
  let result = vec01.clone().cross(vec12);
  return result;
}

function drawPlane(pt0, pt1, pt2, pt3, color) {
  wireframe.addLineSegment(pt0.toArray(), pt1.toArray(), color.toArray());
  wireframe.addLineSegment(pt1.toArray(), pt2.toArray(), color.toArray());
  wireframe.addLineSegment(pt2.toArray(), pt3.toArray(), color.toArray());
  wireframe.addLineSegment(pt3.toArray(), pt0.toArray(), color.toArray());
}

function drawLine(pt0, pt1, color) {
  wireframe.addLineSegment(pt0.toArray(), pt1.toArray(), color.toArray());
}

function drawSphere(sphere, color) {
  let center = sphere.center.clone();
  let r = sphere.radius;
  let div = 16;
  let dTheta = 2.0 * Math.PI / div;
  // YZ Plane
  for (let i = 0; i < div; i++) {
    let angleCur = dTheta * i;
    let angleNext = dTheta * ((i + 1) % div);
    let ptCur = center.clone().add(new Vector3(0.0, Math.cos(angleCur), Math.sin(angleCur)).multiplyScalar(r));
    let ptNext = center.clone().add(new Vector3(0.0, Math.cos(angleNext), Math.sin(angleNext)).multiplyScalar(r));
    wireframe.addLineSegment(ptCur.toArray(), ptNext.toArray(), color.toArray());
  }
  // XZ Plane
  for (let i = 0; i < div; i++) {
    let angleCur = dTheta * i;
    let angleNext = dTheta * ((i + 1) % div);
    let ptCur = center.clone().add(new Vector3(Math.cos(angleCur), 0.0, Math.sin(angleCur)).multiplyScalar(r));
    let ptNext = center.clone().add(new Vector3(Math.cos(angleNext), 0.0, Math.sin(angleNext)).multiplyScalar(r));
    wireframe.addLineSegment(ptCur.toArray(), ptNext.toArray(), color.toArray());
  }
  // XY Plane
  for (let i = 0; i < div; i++) {
    let angleCur = dTheta * i;
    let angleNext = dTheta * ((i + 1) % div);
    let ptCur = center.clone().add(new Vector3(Math.cos(angleCur), Math.sin(angleCur), 0.0).multiplyScalar(r));
    let ptNext = center.clone().add(new Vector3(Math.cos(angleNext), Math.sin(angleNext), 0.0).multiplyScalar(r));
    wireframe.addLineSegment(ptCur.toArray(), ptNext.toArray(), color.toArray());
  }
}

makeRenderLoop(render)();
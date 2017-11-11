
var pfgl = new PFGL('#canvas1');
var gl = pfgl.gl;
pfgl.offScreenDepthBuffer = gl.createRenderbuffer();
pfgl.offScreenFrameBuffer = gl.createFramebuffer();

var water;
var renderer;

var cubemap;

var angleX = -25;
var angleY = -200.5;

// Sphere physics info
var useSpherePhysics = false;
var center;
var oldCenter;
var velocity;
var gravity;
var radius;

var paused = false;
var animateFrame;
var frame = 0;


var ratio = window.devicePixelRatio || 1;


var prevTime = new Date().getTime();

var prevHit;
var planeNormal;
var mode = -1;
var MODE_ADD_DROPS = 0;
var MODE_MOVE_SPHERE = 1;
var MODE_ORBIT_CAMERA = 2;

var oldX, oldY;

var tilesImg;



var MVP = mat4.create();

// var lookat_eye = vec3.fromValues(1.269582730631437, 1.190473024326728, -3.3956534355979198);
var lookat_eye = vec3.fromValues(1.5, 1.5, -4.0);
var lookat_center = vec3.fromValues(0, 0, 0);
var lookat_up = vec3.fromValues(0, 1, 0);
var viewMat = mat4.create();
var projMat = mat4.create();

// mat4.lookAt(viewMat, lookat_eye, lookat_center, lookat_up);

mat4.perspective(projMat, glMatrix.toRadian(45), 1, 0.01, 100);

// mat4.mul(MVP, projMat, viewMat);




var urls = [
  'xpos.jpg', 'xneg.jpg',
  'ypos.jpg', 'ypos.jpg',
  'zpos.jpg', 'zneg.jpg'
];

//cube texture images
var pimgs = urls.map((v, i) => {
  return PFGL.loadImg(v);
});
//tiles image
pimgs.push(PFGL.loadImg('tiles.jpg'));

Promise.all(pimgs).then((a) => {

  console.log('imgs done', a);

  tilesImg = a.pop();

  cubemap = pfgl.textureCube(a, 2, null, null, {
    format: gl.RGB,
    type: gl.UNSIGNED_BYTE,
    filter: gl.LINEAR,
    wrap: gl.CLAMP_TO_EDGE,
    flip_y: true
  });

  main();

});



/*
 * main
 */

function main(){

  gl.clearColor(0, 0, 0, 1);

  water = new Water();
  renderer = new Renderer();

  if (!textureCanDrawTo(water.textureA) || !textureCanDrawTo(water.textureB)) {
    throw new Error('Rendering to floating-point textures is required but not supported');
  }

  center = oldCenter = vec3.fromValues(-0.4, -0.75, 0.2);
  velocity = vec3.create();
  gravity = vec3.fromValues(0, -4, 0);
  radius = 0.25;

  for (var i = 0; i < 20; i++) {
    water.addDrop(Math.random() * 2 - 1, Math.random() * 2 - 1, 0.03, (i & 1) ? 0.01 : -0.01);
  }

  var width = 600;
  var height = 600;
  gl.canvas.width = width * ratio;
  gl.canvas.height = height * ratio;
  gl.canvas.style.width = width + 'px';
  gl.canvas.style.height = height + 'px';
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  animateFrame = requestAnimationFrame(animate);
  manipulate();

  // setTimeout(() => {
  //   stopAnimate();
  // }, 6000);

}

function animate() {
  // console.log('animate');
  var nextTime = new Date().getTime();
  if (!paused) {
    update((nextTime - prevTime) / 1000);
    draw();
  }
  prevTime = nextTime;
  animateFrame = requestAnimationFrame(animate);
}

function stopAnimate(){
  cancelAnimationFrame(animateFrame);
}

function update(seconds) {
  // console.log('update');
  if (seconds > 1) return;
  frame += seconds * 2;

  if (mode == MODE_MOVE_SPHERE) {
    // Start from rest when the player releases the mouse after moving the sphere
    velocity = vec3.create();
  } else if (useSpherePhysics) {
    // console.log('useSpherePhysics');
    // Fall down with viscosity under water
    var percentUnderWater = Math.max(0, Math.min(1, (radius - center[1]) / (2 * radius)));// 这块计算在水下面百分之多少，难道水平面是一个死的高度？？？

    var gravity_sca_ = vec3.scale(vec3.create(), gravity, seconds - 1.1 * seconds * percentUnderWater);
    vec3.add(velocity, velocity, gravity_sca_);

    var velocity_norm = vec3.normalize(vec3.create(), velocity);
    vec3.scale(velocity_norm, velocity_norm, percentUnderWater * seconds * vec3.dot(velocity, velocity));
    vec3.subtract(velocity, velocity, velocity_norm);

    var velocity_sca_seconds = vec3.scale(vec3.create(), velocity, seconds);
    center = vec3.add(vec3.create(), center, velocity_sca_seconds);//这块要这么写的原因是 center不能和 oldcenter指向同一个地址

    // console.log('重力效果后的中心', center);

    // Bounce off the bottom
    if (center[1] < radius - 1) {
      center[1] = radius - 1;
      velocity[1] = Math.abs(velocity[1]) * 0.7;
    }

  }


  // Displace water around the sphere
  water.moveSphere(oldCenter, center, radius);
  oldCenter = center;

  // Update the water simulation and graphics
  water.stepSimulation();
  water.stepSimulation();
  water.updateNormals();
  renderer.updateCaustics(water);
}


function draw(){
  // console.log('draw');

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  viewMat = mat4.create();

  mat4.translate(viewMat, viewMat, vec3.fromValues(0.0, 0.0, -4.0));
  mat4.rotate(viewMat, viewMat, glMatrix.toRadian(-angleX), vec3.fromValues(1.0, 0.0, 0.0));
  mat4.rotate(viewMat, viewMat, glMatrix.toRadian(-angleY), vec3.fromValues(0.0, 1.0, 0.0));
  mat4.translate(viewMat, viewMat, vec3.fromValues(0.0, 0.5, 0.0));

  mat4.mul(MVP, projMat, viewMat);


  gl.enable(gl.DEPTH_TEST);
  renderer.sphereCenter = center;
  renderer.sphereRadius = radius;
  renderer.renderCube();
  renderer.renderWater(water, cubemap);
  renderer.renderSphere();
  gl.disable(gl.DEPTH_TEST);
}


function manipulate(){

  function startDrag(x, y) {
    // console.log('startDrag');
    oldX = x;
    oldY = y;
    var tracer = new PFGL.Raytracer(viewMat, projMat);
    var ray = tracer.getRayForPixel(x * ratio, y * ratio);

    var ray_sca_ = vec3.scale(vec3.create(), ray, -tracer.eye[1] / ray[1]);
    var pointOnPlane = vec3.add(vec3.create(), tracer.eye, ray_sca_);
    var sphereHitTest = PFGL.Raytracer.hitTestSphere(tracer.eye, ray, center, radius);



    if(sphereHitTest){

      // console.log('startDrag MODE_MOVE_SPHERE');
      mode = MODE_MOVE_SPHERE;
      prevHit = sphereHitTest.hit;
      planeNormal = vec3.create();//这个应该是当前摄像机看到的 平面的法向量
      vec3.negate(planeNormal, tracer.getRayForPixel(gl.canvas.width / 2, gl.canvas.height / 2));


    }else if(Math.abs(pointOnPlane[0]) < 1 && Math.abs(pointOnPlane[2]) < 1){

      // console.log('startDrag MODE_ADD_DROPS');
      mode = MODE_ADD_DROPS;
      duringDrag(x, y);

    }else{

      // console.log('startDrag MODE_ORBIT_CAMERA');
      mode = MODE_ORBIT_CAMERA;

    }
  }

  function duringDrag(x, y) {
    // console.log('duringDrag');
    switch(mode){

      case MODE_ADD_DROPS:
        // console.log('duringDrag MODE_ADD_DROPS');
        var tracer = new PFGL.Raytracer(viewMat, projMat);
        var ray = tracer.getRayForPixel(x * ratio, y * ratio);

        var ray_sca_ = vec3.scale(vec3.create(), ray, -(tracer.eye[1] / ray[1]));
        var pointOnPlane = vec3.add(vec3.create(), tracer.eye, ray_sca_);
        water.addDrop(pointOnPlane[0], pointOnPlane[2], 0.03, 0.01);

        if(paused){
          water.updateNormals();
          renderer.updateCaustics(water);
        }

        break;

      case MODE_MOVE_SPHERE:
        // console.log('duringDrag MODE_MOVE_SPHERE');

        var tracer = new PFGL.Raytracer(viewMat, projMat);
        var ray = tracer.getRayForPixel(x * ratio, y * ratio);

        // console.log(ray);

        var eye_sub_prevHit = vec3.subtract(vec3.create(), tracer.eye, prevHit);
        var t = -(vec3.dot(planeNormal, eye_sub_prevHit) / vec3.dot(planeNormal, ray));

        // console.log(tracer.eye);

        var ray_sca_t = vec3.scale(vec3.create(), ray, t);

        var nextHit = vec3.add(vec3.create(), tracer.eye, ray_sca_t);

        var diffCenter = vec3.subtract(vec3.create(), nextHit, prevHit);
        center = vec3.add(vec3.create(), center, diffCenter);//这块要这么写的原因是 center不能和 oldcenter指向同一个地址

        // console.log('限制之前的中心', center);

        center[0] = Math.max(radius - 1, Math.min(1 - radius, center[0]));
        center[1] = Math.max(radius - 1, Math.min(10, center[1]));
        center[2] = Math.max(radius - 1, Math.min(1 - radius, center[2]));

        // console.log('移动后的中心', center);//center 有时候是NaN

        prevHit = nextHit;
        if(paused){
          renderer.updateCaustics(water);
        }
        break;

      case MODE_ORBIT_CAMERA:
        // console.log('duringDrag MODE_ORBIT_CAMERA');
        angleY -= x - oldX;
        angleX -= y - oldY;
        angleX = Math.max(-89.999, Math.min(89.999, angleX));
        break;

    }
    oldX = x;
    oldY = y;
    if (paused) draw();
  }

  function stopDrag() {
    mode = -1;
  }


  document.onmousedown = function(e) {
      e.preventDefault();
      startDrag(e.pageX, e.pageY);
  };

  document.onmousemove = function(e) {
    duringDrag(e.pageX, e.pageY);
  };

  document.onmouseup = function() {
    stopDrag();
  };

  document.ontouchstart = function(e) {
    if (e.touches.length === 1) {
      e.preventDefault();
      startDrag(e.touches[0].pageX, e.touches[0].pageY);
    }
  };

  document.ontouchmove = function(e) {
    if (e.touches.length === 1) {
      duringDrag(e.touches[0].pageX, e.touches[0].pageY);
    }
  };

  document.ontouchend = function(e) {
    if (e.touches.length == 0) {
      stopDrag();
    }
  };

  document.onkeydown = function(e) {
    if (e.which == ' '.charCodeAt(0)){

      paused = !paused;

    }else if (e.which == 'G'.charCodeAt(0)){

      useSpherePhysics = !useSpherePhysics;

    }else if (e.which == 'L'.charCodeAt(0)){

      // Change the light direction to the camera look vector when the L key is pressed
      renderer.lightDir = vectorfromAngles((90 - angleY) * Math.PI / 180, -angleX * Math.PI / 180);

      if(paused){
        renderer.updateCaustics(water);
        draw();
      }

    }

  };

  function vectorfromAngles(theta, phi) {
    return vec3.fromValues(Math.cos(theta) * Math.cos(phi), Math.sin(phi), Math.sin(theta) * Math.cos(phi));
    // return vec3.fromValues(Math.sin(phi) * Math.sin(theta), Math.cos(phi), Math.cos(theta) * Math.sin(phi));
  }

}






/*
 * render
 */

function Renderer(){

  var FS_precision = `
  precision highp float;
  `;

  var helperFunctions = `
    const float IOR_AIR = 1.0;
    const float IOR_WATER = 1.333;
    const vec3 abovewaterColor = vec3(0.25, 1.0, 1.25);
    const vec3 underwaterColor = vec3(0.4, 0.9, 1.0);
    const float poolHeight = 1.0;
    uniform vec3 light;
    uniform vec3 sphereCenter;
    uniform float sphereRadius;
    uniform sampler2D tiles;
    uniform sampler2D causticTex;
    uniform sampler2D water;

    vec2 intersectCube(vec3 origin, vec3 ray, vec3 cubeMin, vec3 cubeMax) {
      vec3 tMin = (cubeMin - origin) / ray;
      vec3 tMax = (cubeMax - origin) / ray;
      vec3 t1 = min(tMin, tMax);
      vec3 t2 = max(tMin, tMax);
      float tNear = max(max(t1.x, t1.y), t1.z);
      float tFar = min(min(t2.x, t2.y), t2.z);
      return vec2(tNear, tFar);
    }

    float intersectSphere(vec3 origin, vec3 ray, vec3 sphereCenter, float sphereRadius) {
      vec3 toSphere = origin - sphereCenter;
      float a = dot(ray, ray);
      float b = 2.0 * dot(toSphere, ray);
      float c = dot(toSphere, toSphere) - sphereRadius * sphereRadius;
      float discriminant = b*b - 4.0*a*c;
      if (discriminant > 0.0) {
        float t = (-b - sqrt(discriminant)) / (2.0 * a);
        if (t > 0.0) return t;
      }
      return 1.0e6;
    }

    vec3 getSphereColor(vec3 point) {
      vec3 color = vec3(0.5);

      /* ambient occlusion with walls */
      color *= 1.0 - 0.9 / pow((1.0 + sphereRadius - abs(point.x)) / sphereRadius, 3.0);
      color *= 1.0 - 0.9 / pow((1.0 + sphereRadius - abs(point.z)) / sphereRadius, 3.0);
      color *= 1.0 - 0.9 / pow((point.y + 1.0 + sphereRadius) / sphereRadius, 3.0);

      /* caustics */
      vec3 sphereNormal = (point - sphereCenter) / sphereRadius;
      vec3 refractedLight = refract(-light, vec3(0.0, 1.0, 0.0), IOR_AIR / IOR_WATER);
      float diffuse = max(0.0, dot(-refractedLight, sphereNormal)) * 0.5;
      vec4 info = texture2D(water, point.xz * 0.5 + 0.5);
      if (point.y < info.r) {
        vec4 caustic = texture2D(causticTex, 0.75 * (point.xz - point.y * refractedLight.xz / refractedLight.y) * 0.5 + 0.5);
        diffuse *= caustic.r * 4.0;
      }
      color += diffuse;

      return color;
    }
    
    vec3 getWallColor(vec3 point) {
      float scale = 0.5;

      vec3 wallColor;
      vec3 normal;
      if (abs(point.x) > 0.999) {
        wallColor = texture2D(tiles, point.yz * 0.5 + vec2(1.0, 0.5)).rgb;
        normal = vec3(-point.x, 0.0, 0.0);
      } else if (abs(point.z) > 0.999) {
        wallColor = texture2D(tiles, point.yx * 0.5 + vec2(1.0, 0.5)).rgb;
        normal = vec3(0.0, 0.0, -point.z);
      } else {
        wallColor = texture2D(tiles, point.xz * 0.5 + 0.5).rgb;
        normal = vec3(0.0, 1.0, 0.0);
      }

      scale /= length(point); /* pool ambient occlusion */
      scale *= 1.0 - 0.9 / pow(length(point - sphereCenter) / sphereRadius, 4.0); /* sphere ambient occlusion */

      /* caustics */
      vec3 refractedLight = -refract(-light, vec3(0.0, 1.0, 0.0), IOR_AIR / IOR_WATER);
      float diffuse = max(0.0, dot(refractedLight, normal));
      vec4 info = texture2D(water, point.xz * 0.5 + 0.5);
      if (point.y < info.r) {
        vec4 caustic = texture2D(causticTex, 0.75 * (point.xz - point.y * refractedLight.xz / refractedLight.y) * 0.5 + 0.5);
        scale += diffuse * caustic.r * 2.0 * caustic.g;
      } else {
        /* shadow for the rim of the pool */
        vec2 t = intersectCube(point, refractedLight, vec3(-1.0, -poolHeight, -1.0), vec3(1.0, 2.0, 1.0));
        diffuse *= 1.0 / (1.0 + exp(-200.0 / (1.0 + 10.0 * (t.y - t.x)) * (point.y + refractedLight.y * t.y - 2.0 / 12.0)));
        
        scale += diffuse * 0.5;
      }

      return wallColor * scale;
    }
  `;

  var sphereVS = `
    attribute vec4 LIGHTGLgl_Vertex;
    uniform mat4 LIGHTGLgl_ModelViewProjectionMatrix;

    varying vec3 position;
    void main() {
      position = sphereCenter + LIGHTGLgl_Vertex.xyz * sphereRadius;
      gl_Position = LIGHTGLgl_ModelViewProjectionMatrix * vec4(position, 1.0);
    }
  `;
  var sphereFS = `
    varying vec3 position;
    void main() {
      gl_FragColor = vec4(getSphereColor(position), 1.0);
      vec4 info = texture2D(water, position.xz * 0.5 + 0.5);
      if (position.y < info.r) {
        gl_FragColor.rgb *= underwaterColor * 1.2;
      }
    }
  `;

  var cubeVS = `
    attribute vec4 LIGHTGLgl_Vertex;
    uniform mat4 LIGHTGLgl_ModelViewProjectionMatrix;

    varying vec3 position;
    void main() {
      position = LIGHTGLgl_Vertex.xyz;
      position.y = ((1.0 - position.y) * (7.0 / 12.0) - 1.0) * poolHeight;
      gl_Position = LIGHTGLgl_ModelViewProjectionMatrix * vec4(position, 1.0);
    }
  `;
  var cubeFS = `
    varying vec3 position;
    void main() {
      gl_FragColor = vec4(getWallColor(position), 1.0);
      vec4 info = texture2D(water, position.xz * 0.5 + 0.5);
      if (position.y < info.r) {
        gl_FragColor.rgb *= underwaterColor * 1.2;
      }
    }
  `;


  var hasDerivatives = !!gl.getExtension('OES_standard_derivatives');

  var causticsFS_header_segment = '';
  var causticsFS_main_segment = 'gl_FragColor = vec4(0.2, 0.2, 0.0, 0.0);';

  if(hasDerivatives){
    causticsFS_header_segment = '#extension GL_OES_standard_derivatives : enable\n';
    causticsFS_main_segment = `
      /* if the triangle gets smaller, it gets brighter, and vice versa */
      float oldArea = length(dFdx(oldPos)) * length(dFdy(oldPos));
      float newArea = length(dFdx(newPos)) * length(dFdy(newPos));
      gl_FragColor = vec4(oldArea / newArea * 0.2, 1.0, 0.0, 0.0);
    `;
  }

  var causticsVS = `
    attribute vec4 LIGHTGLgl_Vertex;

    varying vec3 oldPos;
    varying vec3 newPos;
    varying vec3 ray;

    /* project the ray onto the plane */
    vec3 project(vec3 origin, vec3 ray, vec3 refractedLight) {
      vec2 tcube = intersectCube(origin, ray, vec3(-1.0, -poolHeight, -1.0), vec3(1.0, 2.0, 1.0));
      origin += ray * tcube.y;
      float tplane = (-origin.y - 1.0) / refractedLight.y;
      return origin + refractedLight * tplane;
    }

    void main() {
      vec4 info = texture2D(water, LIGHTGLgl_Vertex.xy * 0.5 + 0.5);
      info.ba *= 0.5;
      vec3 normal = vec3(info.b, sqrt(1.0 - dot(info.ba, info.ba)), info.a);

      /* project the vertices along the refracted vertex ray */
      vec3 refractedLight = refract(-light, vec3(0.0, 1.0, 0.0), IOR_AIR / IOR_WATER);
      ray = refract(-light, normal, IOR_AIR / IOR_WATER);
      oldPos = project(LIGHTGLgl_Vertex.xzy, refractedLight, refractedLight);
      newPos = project(LIGHTGLgl_Vertex.xzy + vec3(0.0, info.r, 0.0), ray, refractedLight);

      gl_Position = vec4(0.75 * (newPos.xz + refractedLight.xz / refractedLight.y), 0.0, 1.0);
    }
  `;
  var causticsFS = `
    varying vec3 oldPos;
    varying vec3 newPos;
    varying vec3 ray;

    void main() {

      ${causticsFS_main_segment}

      vec3 refractedLight = refract(-light, vec3(0.0, 1.0, 0.0), IOR_AIR / IOR_WATER);

      /* compute a blob shadow and make sure we only draw a shadow if the player is blocking the light */
      vec3 dir = (sphereCenter - newPos) / sphereRadius;
      vec3 area = cross(dir, refractedLight);
      float shadow = dot(area, area);
      float dist = dot(dir, -refractedLight);
      shadow = 1.0 + (shadow - 1.0) / (0.05 + dist * 0.025);
      shadow = clamp(1.0 / (1.0 + exp(-shadow)), 0.0, 1.0);
      shadow = mix(1.0, shadow, clamp(dist * 2.0, 0.0, 1.0));
      gl_FragColor.g = shadow;

      /* shadow for the rim of the pool */
      vec2 t = intersectCube(newPos, -refractedLight, vec3(-1.0, -poolHeight, -1.0), vec3(1.0, 2.0, 1.0));
      gl_FragColor.r *= 1.0 / (1.0 + exp(-200.0 / (1.0 + 10.0 * (t.y - t.x)) * (newPos.y - refractedLight.y * t.y - 2.0 / 12.0)));
    }
  `;

  var waterVS = `
    attribute vec4 LIGHTGLgl_Vertex;
    uniform mat4 LIGHTGLgl_ModelViewProjectionMatrix;

    uniform sampler2D water;
    varying vec3 position;
    void main() {
      vec4 info = texture2D(water, LIGHTGLgl_Vertex.xy * 0.5 + 0.5);
      position = LIGHTGLgl_Vertex.xzy;
      position.y += info.r;
      gl_Position = LIGHTGLgl_ModelViewProjectionMatrix * vec4(position, 1.0);
    }
  `;
  var waterFS_aboveWater_segment = `
    vec3 reflectedRay = reflect(incomingRay, normal);
    vec3 refractedRay = refract(incomingRay, normal, IOR_AIR / IOR_WATER);
    float fresnel = mix(0.25, 1.0, pow(1.0 - dot(normal, -incomingRay), 3.0));

    vec3 reflectedColor = getSurfaceRayColor(position, reflectedRay, abovewaterColor);
    vec3 refractedColor = getSurfaceRayColor(position, refractedRay, abovewaterColor);

    gl_FragColor = vec4(mix(refractedColor, reflectedColor, fresnel), 1.0);
  `;
  var waterFS_underWater_segment = `
    normal = -normal;
    vec3 reflectedRay = reflect(incomingRay, normal);
    vec3 refractedRay = refract(incomingRay, normal, IOR_WATER / IOR_AIR);
    float fresnel = mix(0.5, 1.0, pow(1.0 - dot(normal, -incomingRay), 3.0));

    vec3 reflectedColor = getSurfaceRayColor(position, reflectedRay, underwaterColor);
    vec3 refractedColor = getSurfaceRayColor(position, refractedRay, vec3(1.0)) * vec3(0.8, 1.0, 1.1);

    gl_FragColor = vec4(mix(reflectedColor, refractedColor, (1.0 - fresnel) * length(refractedRay)), 1.0);
  `;


  this.tileTexture = pfgl.texture2d(tilesImg[0], 0, null, null, {
    minFilter: gl.LINEAR_MIPMAP_LINEAR,
    wrap: gl.REPEAT,
    format: gl.RGB
  });
  // ???????????????????
  // gl.generateMipmap(gl.TEXTURE_2D);

  //光照方向
  this.lightDir = vec3.normalize(vec3.create(), vec3.fromValues(2.0, 2.0, -1.0));
  this.causticTex = pfgl.texture2d(null, 0, 1024, 1024, {
    format: gl.RGBA,
    type: gl.UNSIGNED_BYTE,
    filter: gl.LINEAR,
    options: gl.CLAMP_TO_EDGE
  });

  var waterMesh = PFGL.Mesh.plane({ detail: 200 });
  this.waterMeshVertexBuffer = waterMesh.vertexBuffer.buffer;
  this.waterMeshIndexBuffer = waterMesh.indexBuffer.buffer;
  this.waterMeshIndexBufferLen = waterMesh.indexBuffer.length;

  // this.waterShaders = [];
  this.waterProgram = [];


  // var waterFS = 

  for (var i = 0; i < 2; i++) {
    this.waterProgram[i] = pfgl.shader(waterVS, FS_precision + helperFunctions + `
      uniform vec3 eye;
      varying vec3 position;
      uniform samplerCube sky;

      vec3 getSurfaceRayColor(vec3 origin, vec3 ray, vec3 waterColor) {
        vec3 color;
        float q = intersectSphere(origin, ray, sphereCenter, sphereRadius);
        if (q < 1.0e6) {
          color = getSphereColor(origin + ray * q);
        } else if (ray.y < 0.0) {
          vec2 t = intersectCube(origin, ray, vec3(-1.0, -poolHeight, -1.0), vec3(1.0, 2.0, 1.0));
          color = getWallColor(origin + ray * t.y);
        } else {
          vec2 t = intersectCube(origin, ray, vec3(-1.0, -poolHeight, -1.0), vec3(1.0, 2.0, 1.0));
          vec3 hit = origin + ray * t.y;
          if (hit.y < 2.0 / 12.0) {
            color = getWallColor(hit);
          } else {
            color = textureCube(sky, ray).rgb;
            color += vec3(pow(max(0.0, dot(light, ray)), 5000.0)) * vec3(10.0, 8.0, 6.0);
          }
        }
        if (ray.y < 0.0) color *= waterColor;
        return color;
      }

      void main() {
        vec2 coord = position.xz * 0.5 + 0.5;
        vec4 info = texture2D(water, coord);

        /* make water look more "peaked" */
        for (int i = 0; i < 5; i++) {
          coord += info.ba * 0.005;
          info = texture2D(water, coord);
        }

        vec3 normal = vec3(info.b, sqrt(1.0 - dot(info.ba, info.ba)), info.a);
        vec3 incomingRay = normalize(position - eye);

        ` + (i ? waterFS_underWater_segment  : waterFS_aboveWater_segment ) + `
      }
    `);
  }


  var sphereMesh = PFGL.Mesh.sphere({ detail: 10 });
  this.sphereMeshVertexBuffer = sphereMesh.vertexBuffer.buffer;
  this.sphereMeshIndexBuffer = sphereMesh.indexBuffer.buffer;
  this.sphereMeshIndexBufferLen = sphereMesh.indexBuffer.length;


  this.sphereProgram = pfgl.shader(helperFunctions + sphereVS, FS_precision + helperFunctions + sphereFS);


  var cubeMesh = PFGL.Mesh.cube();
  cubeMesh.triangles.splice(4, 2);
  cubeMesh.compile();
  this.cubeMeshVertexBuffer = cubeMesh.vertexBuffer.buffer;
  this.cubeMeshIndexBuffer = cubeMesh.indexBuffer.buffer;
  this.cubeMeshIndexBufferLen = cubeMesh.indexBuffer.length;

  this.cubeProgram = pfgl.shader(helperFunctions + cubeVS, FS_precision + helperFunctions + cubeFS);

  this.sphereCenter = vec3.create();
  this.sphereRadius = 0.0;

  this.causticsProgram = pfgl.shader(helperFunctions + causticsVS,
     causticsFS_header_segment + FS_precision + helperFunctions + causticsFS);

}


Renderer.prototype.updateCaustics = function(water){

  if (!this.causticsProgram){
    console.error('causticsProgram error')
  }

  pfgl.useProgram(this.causticsProgram);

  drawToTexture(this.causticTex, 1024, 1024, () => {

    gl.clear(gl.COLOR_BUFFER_BIT);
    pfgl.bindTextureUnit(water.textureA, 0);

    pfgl.uniform('light', this.lightDir);
    pfgl.uniform('water', 0, '1i');
    pfgl.uniform('sphereCenter', this.sphereCenter);
    pfgl.uniform('sphereRadius', this.sphereRadius, '1f');

    // pfgl.uniform('LIGHTGLgl_ModelViewProjectionMatrix', MVP);

    pfgl.attribute('LIGHTGLgl_Vertex', this.waterMeshVertexBuffer);

    pfgl.drawElements(gl.TRIANGLES, this.waterMeshIndexBuffer,
      gl.UNSIGNED_SHORT, 0, this.waterMeshIndexBufferLen);

  });

};

Renderer.prototype.renderWater = function(water, sky){

  var tracer = new PFGL.Raytracer(viewMat, projMat);

  pfgl.bindTextureUnit(water.textureA, 0);
  pfgl.bindTextureUnit(this.tileTexture, 1);
  pfgl.bindTextureUnit(sky, 2, 3);
  pfgl.bindTextureUnit(this.causticTex, 3);

  gl.enable(gl.CULL_FACE);

  for (var i = 0; i < 2; i++) {
    gl.cullFace(i ? gl.BACK : gl.FRONT);
    
    pfgl.useProgram(this.waterProgram[i]);
    
    pfgl.uniform('light', this.lightDir);
    pfgl.uniform('water', 0, '1i');
    pfgl.uniform('tiles', 1, '1i');
    pfgl.uniform('sky', 2, '1i');
    pfgl.uniform('causticTex', 3, '1i');

    // pfgl.uniform('eye', vec3.fromValues(1.269582730631437, 1.190473024326728, -3.3956534355979198));
    pfgl.uniform('eye', tracer.eye);//眼睛的位置不对啊
    // pfgl.uniform('eye', lookat_eye);

    pfgl.uniform('sphereCenter', this.sphereCenter);
    pfgl.uniform('sphereRadius', this.sphereRadius, '1f');

    pfgl.uniform('LIGHTGLgl_ModelViewProjectionMatrix', MVP);

    pfgl.attribute('LIGHTGLgl_Vertex', this.waterMeshVertexBuffer);

    pfgl.drawElements(gl.TRIANGLES, this.waterMeshIndexBuffer,
      gl.UNSIGNED_SHORT, 0, this.waterMeshIndexBufferLen);

  }

  gl.disable(gl.CULL_FACE);

};

Renderer.prototype.renderSphere = function() {

  pfgl.bindTextureUnit(water.textureA, 0);
  pfgl.bindTextureUnit(this.causticTex, 1);

  pfgl.useProgram(this.sphereProgram);

  pfgl.uniform('light', this.lightDir);
  pfgl.uniform('water', 0, '1i');
  pfgl.uniform('causticTex', 1, '1i');
  pfgl.uniform('sphereCenter', this.sphereCenter);
  pfgl.uniform('sphereRadius', this.sphereRadius, '1f');

  pfgl.uniform('LIGHTGLgl_ModelViewProjectionMatrix', MVP);

  pfgl.attribute('LIGHTGLgl_Vertex', this.sphereMeshVertexBuffer);

  pfgl.drawElements(gl.TRIANGLES, this.sphereMeshIndexBuffer,
    gl.UNSIGNED_SHORT, 0, this.sphereMeshIndexBufferLen);

};

Renderer.prototype.renderCube = function() {
  gl.enable(gl.CULL_FACE);

  pfgl.bindTextureUnit(water.textureA, 0);
  pfgl.bindTextureUnit(this.tileTexture, 1);
  pfgl.bindTextureUnit(this.causticTex, 2);

  pfgl.useProgram(this.cubeProgram);

  pfgl.uniform('light', this.lightDir);
  pfgl.uniform('water', 0, '1i');
  pfgl.uniform('tiles', 1, '1i');
  pfgl.uniform('causticTex', 2, '1i');
  pfgl.uniform('sphereCenter', this.sphereCenter);
  pfgl.uniform('sphereRadius', this.sphereRadius, '1f');

  pfgl.uniform('LIGHTGLgl_ModelViewProjectionMatrix', MVP);

  pfgl.attribute('LIGHTGLgl_Vertex', this.cubeMeshVertexBuffer);

  pfgl.drawElements(gl.TRIANGLES, this.cubeMeshIndexBuffer,
    gl.UNSIGNED_SHORT, 0, this.cubeMeshIndexBufferLen);

  gl.disable(gl.CULL_FACE);

};

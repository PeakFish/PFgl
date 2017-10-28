/*
 * 水就是上面的一个表面是水
 */


const T_WIDTH = 256;
const T_HEIGHT = 256;

// The data in the texture is (position.y, velocity.y, normal.x, normal.z)
function Water() {

  var vertexShader = `
    attribute vec4 LIGHTGLgl_Vertex;

    varying vec2 coord;
    void main() {
      coord = LIGHTGLgl_Vertex.xy * 0.5 + 0.5;
      gl_Position = vec4(LIGHTGLgl_Vertex.xyz, 1.0);
    }
  `;

  var dropFragmentShader = `
    precision highp float;

    const float PI = 3.141592653589793;
    uniform sampler2D texture;
    uniform vec2 center;
    uniform float radius;
    uniform float strength;
    varying vec2 coord;
    void main() {
      /* get vertex info */
      vec4 info = texture2D(texture, coord);

      /* add the drop to the height */
      float drop = max(0.0, 1.0 - length(center * 0.5 + 0.5 - coord) / radius);
      drop = 0.5 - cos(drop * PI) * 0.5;
      info.r += drop * strength;

      gl_FragColor = info;
    }
  `;
  var updateFragmentShader = `
    precision highp float;

    uniform sampler2D texture;
    uniform vec2 delta;
    varying vec2 coord;
    void main() {
      /* get vertex info */
      vec4 info = texture2D(texture, coord);

      /* calculate average neighbor height */
      vec2 dx = vec2(delta.x, 0.0);
      vec2 dy = vec2(0.0, delta.y);
      float average = (
        texture2D(texture, coord - dx).r +
        texture2D(texture, coord - dy).r +
        texture2D(texture, coord + dx).r +
        texture2D(texture, coord + dy).r
      ) * 0.25;

      /* change the velocity to move toward the average */
      info.g += (average - info.r) * 2.0;

      /* attenuate the velocity a little so waves do not last forever */
      info.g *= 0.995;

      /* move the vertex along the velocity */
      info.r += info.g;

      gl_FragColor = info;
    }
  `;
  var normalFragmentShader = `
    precision highp float;

    uniform sampler2D texture;
    uniform vec2 delta;
    varying vec2 coord;
    void main() {
      /* get vertex info */
      vec4 info = texture2D(texture, coord);

      /* update the normal */
      vec3 dx = vec3(delta.x, texture2D(texture, vec2(coord.x + delta.x, coord.y)).r - info.r, 0.0);
      vec3 dy = vec3(0.0, texture2D(texture, vec2(coord.x, coord.y + delta.y)).r - info.r, delta.y);
      info.ba = normalize(cross(dy, dx)).xz;

      gl_FragColor = info;
    }
  `;
  var sphereFragmentShader = `
    precision highp float;

    uniform sampler2D texture;
    uniform vec3 oldCenter;
    uniform vec3 newCenter;
    uniform float radius;
    varying vec2 coord;

    float volumeInSphere(vec3 center) {
      vec3 toCenter = vec3(coord.x * 2.0 - 1.0, 0.0, coord.y * 2.0 - 1.0) - center;
      float t = length(toCenter) / radius;
      float dy = exp(-pow(t * 1.5, 6.0));
      float ymin = min(0.0, center.y - dy);
      float ymax = min(max(0.0, center.y + dy), ymin + 2.0 * dy);
      return (ymax - ymin) * 0.1;
    }

    void main() {
      /* get vertex info */
      vec4 info = texture2D(texture, coord);

      /* add the old volume */
      info.r += volumeInSphere(oldCenter);

      /* subtract the new volume */
      info.r -= volumeInSphere(newCenter);

      gl_FragColor = info;
    }
  `;

  var plane = PFGL.Mesh.plane();

  this.planeVertexBuffer = plane.vertexBuffer.buffer;
  this.planeIndexBuffer = plane.indexBuffer.buffer;
  this.planeIndexBufferLen = plane.indexBuffer.length;

  if (!gl.getExtension('OES_texture_float')) {
    throw new Error('This demo requires the OES_texture_float extension');
  }

  var filter = gl.getExtension('OES_texture_float_linear') ? gl.LINEAR : gl.NEAREST;

  this.textureA = pfgl.texture2d(null, 0, 256, 256, { type: gl.FLOAT, filter: filter });
  this.textureB = pfgl.texture2d(null, 0, 256, 256, { type: gl.FLOAT, filter: filter });

  if ((!textureCanDrawTo(this.textureA) || !textureCanDrawTo(this.textureB)) &&
    gl.getExtension('OES_texture_half_float')) {

    filter = gl.getExtension('OES_texture_half_float_linear') ? gl.LINEAR : gl.NEAREST;
    this.textureA = pfgl.texture2d(null, 0, 256, 256, { type: gl.HALF_FLOAT_OES, filter: filter });
    this.textureB = pfgl.texture2d(null, 0, 256, 256, { type: gl.HALF_FLOAT_OES, filter: filter });

  }

  this.dropProgram = pfgl.shader(vertexShader, dropFragmentShader);
  this.updateProgram = pfgl.shader(vertexShader, updateFragmentShader);
  this.normalProgram = pfgl.shader(vertexShader, normalFragmentShader);
  this.sphereProgram = pfgl.shader(vertexShader, sphereFragmentShader);

}
// 添加涟漪的效果
Water.prototype.addDrop = function(x, y, radius, strength){

  pfgl.useProgram(this.dropProgram);

  drawToTexture(this.textureB, 256, 256, () => {

    pfgl.bindTextureUnit(this.textureA);

    // pfgl.uniform('texture', 0, '1i');

    pfgl.uniform('center', new Float32Array([x, y]));
    pfgl.uniform('radius', radius, '1f');
    pfgl.uniform('strength', strength, '1f');

    pfgl.attribute('LIGHTGLgl_Vertex', this.planeVertexBuffer);

    pfgl.drawElements(gl.TRIANGLES, this.planeIndexBuffer,
      gl.UNSIGNED_SHORT, 0, this.planeIndexBufferLen);

  });

  [this.textureB, this.textureA] = [this.textureA, this.textureB]

};

Water.prototype.stepSimulation = function(){

  pfgl.useProgram(this.updateProgram);

  drawToTexture(this.textureB, 256, 256, () => {

    pfgl.bindTextureUnit(this.textureA);

    pfgl.uniform('delta', new Float32Array([1 / T_WIDTH, 1 / T_HEIGHT]));

    pfgl.attribute('LIGHTGLgl_Vertex', this.planeVertexBuffer);

    pfgl.drawElements(gl.TRIANGLES, this.planeIndexBuffer,
      gl.UNSIGNED_SHORT, 0, this.planeIndexBufferLen);

  });

  [this.textureB, this.textureA] = [this.textureA, this.textureB]

};

Water.prototype.updateNormals = function(){

  pfgl.useProgram(this.normalProgram);

  drawToTexture(this.textureB, 256, 256, () => {

    pfgl.bindTextureUnit(this.textureA);

    pfgl.uniform('delta', new Float32Array([1 / T_WIDTH, 1 / T_HEIGHT]));

    pfgl.attribute('LIGHTGLgl_Vertex', this.planeVertexBuffer);

    pfgl.drawElements(gl.TRIANGLES, this.planeIndexBuffer,
      gl.UNSIGNED_SHORT, 0, this.planeIndexBufferLen);

  });

  [this.textureB, this.textureA] = [this.textureA, this.textureB]

};

// 移动球的时候也有涟漪的效果
Water.prototype.moveSphere = function(oldCenter, newCenter, radius){

  // console.log(oldCenter === newCenter);

  pfgl.useProgram(this.sphereProgram);

  drawToTexture(this.textureB, 256, 256, () => {

    pfgl.bindTextureUnit(this.textureA);

    // console.log('pfbug', oldCenter, newCenter);

    pfgl.uniform('oldCenter', oldCenter);
    pfgl.uniform('newCenter', newCenter);
    pfgl.uniform('radius', radius, '1f');

    pfgl.attribute('LIGHTGLgl_Vertex', this.planeVertexBuffer);

    pfgl.drawElements(gl.TRIANGLES, this.planeIndexBuffer,
      gl.UNSIGNED_SHORT, 0, this.planeIndexBufferLen);

  });

  [this.textureB, this.textureA] = [this.textureA, this.textureB]

};

/*
 * my shim or polyfill to lightgl.js
 */

function textureCanDrawTo(texture){
  var framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  var result = gl.checkFramebufferStatus(gl.FRAMEBUFFER) == gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return result;
}

function drawToTexture(texture, width, height, callback){
  var v = gl.getParameter(gl.VIEWPORT);
  v = [0, 0, 600, 600];
  var offScreen = pfgl.offScreen(width, height, {texture: texture, type: 2, unit: 0});
  gl.viewport(0, 0, width, height);
  callback();
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindRenderbuffer(gl.RENDERBUFFER, null);
  gl.viewport(v[0], v[1], v[2], v[3]);
}

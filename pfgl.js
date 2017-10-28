;(function(){


  function PFGL(selector, parameters){

    var gl = this.gl = document.querySelector(selector).getContext('webgl', parameters);
    this.program = [];
    this.pointer = [];
    this.currentProgramIndex = -1;

    this.textureCubeTargets = [
      gl.TEXTURE_CUBE_MAP_POSITIVE_X, gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
      gl.TEXTURE_CUBE_MAP_POSITIVE_Y, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
      gl.TEXTURE_CUBE_MAP_POSITIVE_Z, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z
    ];

  };


  PFGL.prototype.useProgram = function(program){

    this.currentProgramIndex = this.program.indexOf(program);
    this.gl.useProgram(program);

    return this;

  };


  PFGL.prototype.getCurrentProgram = function(){
    return this.program[this.currentProgramIndex];
  };


  PFGL.prototype.shader = function(vshader, fshader){

    var gl = this.gl;
    var vertexShader = this.loadShader(gl.VERTEX_SHADER, vshader);
    var fragmentShader = this.loadShader(gl.FRAGMENT_SHADER, fshader);

    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    var linked = gl.getProgramParameter(program, gl.LINK_STATUS);
    if(!linked){
      var error = gl.getProgramInfoLog(program);
      console.error('Failed to link program: ' + error);
      gl.deleteProgram(program);
      gl.deleteShader(fragmentShader);
      gl.deleteShader(vertexShader);
      return;
    }

    this.program.push(program);
    this.pointer.push({});
    this.useProgram(program);

    return program;

  };

  PFGL.prototype.loadShader = function(type, source){

    var gl = this.gl;
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    var compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if(!compiled){
      var error = gl.getShaderInfoLog(shader);
      console.error('Failed to compile shader: ' + error);
      console.log(gl.getShaderSource(shader));
      gl.deleteShader(shader);
      return;
    }

    return shader;

  };


  PFGL.prototype.buildBuffer = function(type, data){

    var gl = this.gl;
    var buffer = gl.createBuffer();
    gl.bindBuffer(type, buffer);
    gl.bufferData(type, data, gl.STATIC_DRAW);

    return buffer;

  };


  PFGL.prototype.drawElements = function(mode, data, type, offset, bufferLen){

    var gl = this.gl;

    if(data.byteLength){

      this.buildBuffer(gl.ELEMENT_ARRAY_BUFFER, data);
      gl.drawElements(mode, data.length, type, offset);

    }else if(data.constructor === WebGLBuffer){

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, data);
      gl.drawElements(mode, bufferLen, type, offset);

    }else{

      console.error('Unkonw parameter `data` type: ' + data);

    }

  };


  PFGL.prototype.attribute = function(attributes, data, program){

    var gl = this.gl;

    if(typeof attributes == 'string'){
      attributes = { name: attributes };
    }

    if(!Array.isArray(attributes)){
      attributes = new Array(attributes);
    }

    // ArrayBuffer.isView(data) || data.constructor === ArrayBuffer
    if(data.byteLength){
      this.buildBuffer(gl.ARRAY_BUFFER, data);
    }else if(data.constructor === WebGLBuffer){
      gl.bindBuffer(gl.ARRAY_BUFFER, data);
    }else{
      console.error('Unkonw parameter `data` type: ' + data);
    }

    program = program || this.getCurrentProgram();

    for(var i = 0, len = attributes.length; i < len; i ++){

      var name = attributes[i].name;
      var pointer = null;

      if(this.pointer[this.currentProgramIndex][name] >= 0){

        pointer = this.pointer[this.currentProgramIndex][name];

      }else{

        pointer = gl.getAttribLocation(program, name);
        if(pointer < 0){
          console.error('Failed to get the attribute location of ' + name);
          return;
        }
        this.pointer[this.currentProgramIndex][name] = pointer;

      }

      var size = attributes[i].size || 3;
      var type = attributes[i].type || gl.FLOAT;
      var normalized = attributes[i].normalized || false;
      var stride = attributes[i].stride || 0;
      var offset = attributes[i].offset || 0;

      gl.vertexAttribPointer(pointer, size, type, normalized, stride, offset);
      gl.enableVertexAttribArray(pointer);

    }

  };


  PFGL.prototype.uniform = function(uniform, typedArray, type, program){

    var gl = this.gl;

    if(typeof type != 'string'){
      program = type;
      type = '';
    }

    type = type || '';
    program = program || this.getCurrentProgram();

    if(!type){

      if(typeof typedArray == 'number'){

        if(typedArray % 1 === 0){

          type = '1i';

        }else{

          type = '1f';

        }

      }else if(typedArray.length){

        if(typedArray.some(isNaN)){
          console.error('Some values are not a number ' + typedArray);
          return;
        }

        switch(typedArray.length){

          case 2:
            type = '2fv';
            break;

          case 3:
            type = '3fv';
            break;

          case 4:
            type = '4fv';
            break;

          case 9:
            type = 'mat3fv';
            break;

        }

      }

    }

    var pointer = null;

    if(this.pointer[this.currentProgramIndex][uniform]){

      pointer = this.pointer[this.currentProgramIndex][uniform];

    }else{

      pointer = gl.getUniformLocation(program, uniform);
      if(!pointer){
        console.error('Failed to get the uniform location of ' + uniform);
        return;
      }
      this.pointer[this.currentProgramIndex][uniform] = pointer;

    }

    switch(type){

      case '1i':
        gl.uniform1i(pointer, typedArray);
        break;

      case '1f':
        gl.uniform1f(pointer, typedArray);
        break;

      case '2fv':
        gl.uniform2fv(pointer, typedArray);
        break;

      case '3fv':
        gl.uniform3fv(pointer, typedArray);
        break;

      case '4fv':
        gl.uniform4fv(pointer, typedArray);
        break;

      case 'mat3fv':
        gl.uniformMatrix3fv(pointer, false, typedArray);
        break;

      case 'mat4fv':
      default:
        gl.uniformMatrix4fv(pointer, false, typedArray);

    }

    return pointer;

  };

  PFGL.prototype.texture2d = function(element, unit, width, height, options = {}){

    var gl = this.gl;

    var format = options.format || gl.RGBA;
    var type = options.type || gl.UNSIGNED_BYTE;
    var minFilter = options.filter || options.minFilter || gl.LINEAR;
    var magFilter = options.filter || options.magFilter || gl.LINEAR;
    var wrapS = options.wrap || options.wrapS || gl.CLAMP_TO_EDGE;
    var wrapT = options.wrap || options.wrapT || gl.CLAMP_TO_EDGE;

    //flip the image's y axis
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    var texture = gl.createTexture();

    gl.activeTexture(gl.TEXTURE0 + unit);

    gl.bindTexture(gl.TEXTURE_2D, texture);

    //set texture resource https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/texImage2D
    if(element && /img|canvas|video/i.test(element.nodeName)){

      gl.texImage2D(gl.TEXTURE_2D, 0, format, format, type, element);

    }else if(!element){

      gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, 0, format, type, null);

    }else{

      console.error('Unkonw parameter `element` type: ' + element);

    }

    //set texture behaviour
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);

    return texture;

  };

  /*
   * @param {Array} elements - Array elements is return value frome PFGL.loadImg.
   */
  PFGL.prototype.textureCube = function(elements, unit, width, height, options = {}){

    var gl = this.gl;

    var format = options.format || gl.RGBA;
    var type = options.type || gl.UNSIGNED_BYTE;
    var minFilter = options.filter || options.minFilter || gl.LINEAR;
    var magFilter = options.filter || options.magFilter || gl.LINEAR;
    var wrapS = options.wrap || options.wrapS || gl.CLAMP_TO_EDGE;
    var wrapT = options.wrap || options.wrapT || gl.CLAMP_TO_EDGE;
    var flip_y = options.flip_y || false;

    //flip the image's y axis
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flip_y);

    var texture = gl.createTexture();

    gl.activeTexture(gl.TEXTURE0 + unit);

    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

    elements.forEach((v, i) => { // v => value i => index

      var element = v && v[0];

      if(element && /img|canvas|video/i.test(element.nodeName)){

        gl.texImage2D(this.textureCubeTargets[i], 0, format, format, type, element);

      }else if(!element){

        gl.texImage2D(this.textureCubeTargets[i], 0, format, width, height, 0, gl.RGBA, type, null);

      }else{

        console.error('Unkonw parameter `element` type: ' + element);

      }

    });

    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, minFilter);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, magFilter);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, wrapS);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, wrapT);

    gl.generateMipmap(gl.TEXTURE_CUBE_MAP);

    return texture;

  };

  PFGL.prototype.bindTextureUnit = function(texture, textureUnit = 0, textureType = 2){

    var gl = this.gl;
    var format;

    if(textureType === 2){
      format = gl.TEXTURE_2D;
    }else if(textureType === 3){
      format = gl.TEXTURE_CUBE_MAP;
    }

    gl.activeTexture(gl.TEXTURE0 + textureUnit);
    gl.bindTexture(format, texture);

  };


  PFGL.prototype.offScreen = function(width, height, textureOptions = {}){

    var gl = this.gl;

    var texture = textureOptions.texture;
    var textureType = textureOptions.type || 2;//Default off-screen texture is 2d
    var textureUnit = textureOptions.unit || 0;

    if(!texture){
      if(textureType === 2){
        texture = this.texture2d(null, textureUnit, width, height);
      }else if(textureType === 3){
        texture = this.textureCube([...(new Array(6))], textureUnit, width, height);
      }else{
        console.error('Unkonw parameter `textureType` type: ' + textureType);
      }
    }

    var depthBuffer = this.offScreenDepthBuffer || gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);

    var frameBuffer = this.offScreenFrameBuffer || gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);

    if(textureType === 2){
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    }else if(textureType === 3){
      // this.textureCubeTargets.forEach((v) => {
      //   gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, v, texture, 0);
      // });
    }

    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);

    var e = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if(gl.FRAMEBUFFER_COMPLETE !== e){
      gl.deleteFramebuffer(frameBuffer);
      gl.deleteTexture(texture);
      gl.deleteRenderbuffer(depthBuffer);
      console.error('Frame buffer object is incomplete: ' + e.toString());
      return;
    }

    // gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // gl.bindTexture(gl.TEXTURE_2D, null);
    // gl.bindRenderbuffer(gl.RENDERBUFFER, null);

    return {
      frameBuffer: frameBuffer,
      depthBuffer: depthBuffer,
      texture: texture
    };

  };


  //static
  PFGL.loadImg = function(url){

    return new Promise((resolve, reject) => {

      var img = new Image;

      img.onload = () => {

        //power-of-two check
        if(is2Pow(img.width) && is2Pow(img.height)){

          resolve([img, img.width, img.height]);

        }else{

          var canvas = document.createElement('canvas');
          var ctx = canvas.getContext('2d');

          canvas.width = nearestPowerOfTwo(img.width);
          canvas.height = nearestPowerOfTwo(img.height);

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          resolve([canvas, img.width, img.height]);

        }

      };

      img.onerror = () => {

        reject('Can\'t load image at ' + url);

      };

      img.src = url;

    });

    function nearestPowerOfTwo(num){

      return Math.pow(2, Math.round(Math.log(num) / Math.LN2));

    }

    function is2Pow(num){

      return (num & num - 1) == 0 && num != 0;

    }

  };



   window.PFGL = PFGL;

})();

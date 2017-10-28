/*
 * 从 lightgl 里面复制过来
 */
;(function(){


  function Indexer() {
    this.unique = [];
    this.indices = [];
    this.map = {};
  }

  Indexer.prototype.add = function(obj) {
    var key = JSON.stringify(obj);
    if (!(key in this.map)) {
      this.map[key] = this.unique.length;
      this.unique.push(obj);
    }
    return this.map[key];
  };


  function Mesh(options = {}){
    this.vertices = [];
    this.triangles = [];
  }

  Mesh.prototype.compile = function(){

    this.vertexBuffer = compileVertexBuffer(flattenArray(this.vertices));
    this.indexBuffer = compileIndexBuffer(flattenArray(this.triangles));

    function compileVertexBuffer(data){
      data = new Float32Array(data);
      var pfglBufObj = {
        buffer: pfgl.buildBuffer(pfgl.gl.ARRAY_BUFFER, data),
        length: data.length
      };
      return pfglBufObj;
    }

    function compileIndexBuffer(data){
      data = new Uint16Array(data);
      var pfglBufObj = {
        buffer: pfgl.buildBuffer(pfgl.gl.ELEMENT_ARRAY_BUFFER, data),
        length: data.length
      };
      return pfglBufObj;
    }

    function flattenArray(arr){
      var data = [];
      for (var i = 0, chunk = 10000; i < arr.length; i += chunk) {
        data = Array.prototype.concat.apply(data, arr.slice(i, i + chunk));
      }
      return data;
    }

  };


  Mesh.plane = function(options = {}){

    var mesh = new Mesh(options);
    detailX = options.detailX || options.detail || 1;
    detailY = options.detailY || options.detail || 1;

    for(var y = 0; y <= detailY; y ++){
      var t = y / detailY;
      for (var x = 0; x <= detailX; x ++){
        var s = x / detailX;
        mesh.vertices.push([2 * s - 1, 2 * t - 1, 0]);
        if (mesh.coords) mesh.coords.push([s, t]);
        if (mesh.normals) mesh.normals.push([0, 0, 1]);
        if (x < detailX && y < detailY) {
          var i = x + y * (detailX + 1);
          mesh.triangles.push([i, i + 1, i + detailX + 1]);
          mesh.triangles.push([i + detailX + 1, i + 1, i + detailX + 2]);
        }
      }
    }
    mesh.compile();
    return mesh;
  };

  var cubeData = [
    [0, 4, 2, 6, -1, 0, 0], // -x
    [1, 3, 5, 7, +1, 0, 0], // +x
    [0, 1, 4, 5, 0, -1, 0], // -y
    [2, 6, 3, 7, 0, +1, 0], // +y
    [0, 2, 1, 3, 0, 0, -1], // -z
    [4, 5, 6, 7, 0, 0, +1]  // +z
  ];

  function pickOctant(i){
    return [(i & 1) * 2 - 1, (i & 2) - 1, (i & 4) / 2 - 1];
  }


  Mesh.cube = function(options = {}){
    var mesh = new Mesh(options);

    for (var i = 0; i < cubeData.length; i ++) {
      var data = cubeData[i], v = i * 4;
      for (var j = 0; j < 4; j ++) {
        var d = data[j];
        mesh.vertices.push(pickOctant(d));
        if (mesh.coords) mesh.coords.push([j & 1, (j & 2) / 2]);
        if (mesh.normals) mesh.normals.push(data.slice(4, 7));
      }
      mesh.triangles.push([v, v + 1, v + 2]);
      mesh.triangles.push([v + 2, v + 1, v + 3]);
    }
    mesh.compile();
    return mesh;
  };


  Mesh.sphere = function(options = {}) {
    function tri(a, b, c){ return flip ? [a, c, b] : [a, b, c]; }
    function fix(x){ return x + (x - x * x) / 2; }

    var mesh = new Mesh(options);
    var indexer = new Indexer();

    detail = options.detail || 6;

    for(var octant = 0; octant < 8; octant ++){
      var scale = pickOctant(octant);
      var flip = scale[0] * scale[1] * scale[2] > 0;
      var data = [];
      for (var i = 0; i <= detail; i++) {
        // Generate a row of vertices on the surface of the sphere
        // using barycentric coordinates.
        for (var j = 0; i + j <= detail; j++) {
          var a = i / detail;
          var b = j / detail;
          var c = (detail - i - j) / detail;

          var vec3_c = vec3.fromValues(fix(a), fix(b), fix(c));
          var vec3_scale = vec3.fromValues(...scale);
          vec3.normalize(vec3_c, vec3_c);
          vec3.mul(vec3_c, vec3_c, vec3_scale);

          var vertex = { vertex: [...vec3_c] };
          if (mesh.coords) vertex.coord = scale[1] > 0 ? [1 - a, c] : [c, 1 - a];
          data.push(indexer.add(vertex));
        }

        // Generate triangles from this row and the previous row.
        if (i > 0) {
          for (var j = 0; i + j <= detail; j++) {
            var a = (i - 1) * (detail + 1) + ((i - 1) - (i - 1) * (i - 1)) / 2 + j;
            var b = i * (detail + 1) + (i - i * i) / 2 + j;
            mesh.triangles.push(tri(data[a], data[a + 1], data[b]));
            if (i + j < detail) {
              mesh.triangles.push(tri(data[b], data[a + 1], data[b + 1]));
            }
          }
        }
      }
    }

    // Reconstruct the geometry from the indexer.
    mesh.vertices = indexer.unique.map(function(v) { return v.vertex; });
    if (mesh.coords) mesh.coords = indexer.unique.map(function(v) { return v.coord; });
    if (mesh.normals) mesh.normals = mesh.vertices;
    mesh.compile();
    return mesh;
  };


  PFGL.Mesh = Mesh;
  PFGL.Indexer = Indexer;

})();

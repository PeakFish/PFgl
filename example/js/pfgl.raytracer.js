;(function(){


  // src/raytracer.js
  // Provides a convenient raytracing interface.

  // ### new GL.HitTest([t, hit, normal])
  //
  // This is the object used to return hit test results. If there are no
  // arguments, the constructed argument represents a hit infinitely far
  // away.
  function HitTest(t, hit, normal) {
    this.t = arguments.length ? t : Number.MAX_VALUE;
    this.hit = hit;
    this.normal = normal;
  }

  // ### .mergeWith(other)
  //
  // Changes this object to be the closer of the two hit test results.
  HitTest.prototype.mergeWith = function(other) {
    if (other.t > 0 && other.t < this.t) {
      this.t = other.t;
      this.hit = other.hit;
      this.normal = other.normal;
    }
  };

  // ### new GL.Raytracer()
  //
  // This will read the current modelview matrix, projection matrix, and viewport,
  // reconstruct the eye position, and store enough information to later generate
  // per-pixel rays using `getRayForPixel()`.
  //
  // Example usage:
  //
  //     var tracer = new GL.Raytracer();
  //     var ray = tracer.getRayForPixel(
  //       gl.canvas.width / 2,
  //       gl.canvas.height / 2);
  //     var result = GL.Raytracer.hitTestSphere(
  //       tracer.eye, ray, new GL.Vector(0, 0, 0), 1);

/*
   0  1  2  3
   4  5  6  7
   8  9 10 11
  12 13 14 15

  0 4 8  12
  1 5 9  13
  2 6 10 14
  3 7 11 15
*/

  function Raytracer(mv, p) {
    var v = gl.getParameter(gl.VIEWPORT);
    var mv = mv;
    var p = p;

    var axisX = vec3.fromValues(mv[0], mv[1], mv[2]);
    var axisY = vec3.fromValues(mv[4], mv[5], mv[6]);
    var axisZ = vec3.fromValues(mv[8], mv[9], mv[10]);
    var offset = vec3.fromValues(mv[12], mv[13], mv[14]);

    var eyeX = -vec3.dot(offset, axisX);
    var eyeY = -vec3.dot(offset, axisY);
    var eyeZ = -vec3.dot(offset, axisZ);
    this.eye = vec3.fromValues(eyeX, eyeY, eyeZ);

    // console.log(this.eye);

    var minX = v[0], maxX = minX + v[2];
    var minY = v[1], maxY = minY + v[3];

    this.ray00 = vec3.subtract(vec3.create(), unProject(minX, minY, 1, mv, p, v), this.eye);
    this.ray10 = vec3.subtract(vec3.create(), unProject(maxX, minY, 1, mv, p, v), this.eye);
    this.ray01 = vec3.subtract(vec3.create(), unProject(minX, maxY, 1, mv, p, v), this.eye);
    this.ray11 = vec3.subtract(vec3.create(), unProject(maxX, maxY, 1, mv, p, v), this.eye);
    this.viewport = v;

    function unProject(winX, winY, winZ, modelview, projection, viewport) {
      var point = vec3.fromValues(
        (winX - viewport[0]) / viewport[2] * 2 - 1,
        (winY - viewport[1]) / viewport[3] * 2 - 1,
        winZ * 2 - 1
      );
      var mvpMat = mat4.create();
      mat4.mul(mvpMat, projection, modelview);
      mat4.invert(mvpMat, mvpMat);
      vec3.transformMat4(point, point, mvpMat);
      return point;
    }

  }


  // ### .getRayForPixel(x, y)
  //
  // Returns the ray originating from the camera and traveling through the pixel `x, y`.
  Raytracer.prototype.getRayForPixel = function(x, y) {
    x = (x - this.viewport[0]) / this.viewport[2];
    y = 1 - (y - this.viewport[1]) / this.viewport[3];
    // var ray0 = Vector.lerp(this.ray00, this.ray10, x);
    // var ray1 = Vector.lerp(this.ray01, this.ray11, x);

    var ray0 = vec3.lerp(vec3.create(), this.ray00, this.ray10, x);
    var ray1 = vec3.lerp(vec3.create(), this.ray01, this.ray11, x);

    var vec = vec3.create();
    vec3.lerp(vec, ray0, ray1, y);
    vec3.normalize(vec, vec);
    return vec;
  };

  // ### GL.Raytracer.hitTestBox(origin, ray, min, max)
  //
  // Traces the ray starting from `origin` along `ray` against the axis-aligned box
  // whose coordinates extend from `min` to `max`. Returns a `HitTest` with the
  // information or `null` for no intersection.
  //
  // This implementation uses the [slab intersection method](http://www.siggraph.org/education/materials/HyperGraph/raytrace/rtinter3.htm).
  Raytracer.hitTestBox = function(origin, ray, min, max) {
    var tMin = min.subtract(origin).divide(ray);
    var tMax = max.subtract(origin).divide(ray);
    var t1 = Vector.min(tMin, tMax);
    var t2 = Vector.max(tMin, tMax);
    var tNear = t1.max();
    var tFar = t2.min();

    if (tNear > 0 && tNear < tFar) {
      var epsilon = 1.0e-6, hit = origin.add(ray.multiply(tNear));
      min = min.add(epsilon);
      max = max.subtract(epsilon);
      return new HitTest(tNear, hit, new Vector(
        (hit.x > max.x) - (hit.x < min.x),
        (hit.y > max.y) - (hit.y < min.y),
        (hit.z > max.z) - (hit.z < min.z)
      ));
    }

    return null;
  };

  // ### GL.Raytracer.hitTestSphere(origin, ray, center, radius)
  //
  // Traces the ray starting from `origin` along `ray` against the sphere defined
  // by `center` and `radius`. Returns a `HitTest` with the information or `null`
  // for no intersection.
  Raytracer.hitTestSphere = function(origin, ray, center, radius) {
    var offset = vec3.subtract(vec3.create(), origin, center);
    var a = vec3.dot(ray, ray);
    var b = 2 * vec3.dot(ray, offset);
    var c = vec3.dot(offset, offset) - radius * radius;
    var discriminant = b * b - 4 * a * c;



    if (discriminant > 0) {
      var t = (-b - Math.sqrt(discriminant)) / (2 * a);
      var ray_sca_t = vec3.scale(vec3.create(), ray, t);
      var hit = vec3.add(vec3.create(), origin, ray_sca_t);

      var normal = vec3.create();
      vec3.subtract(normal, hit, center);
      vec3.scale(normal, normal, 1/radius);

      return new HitTest(t, hit, normal);
    }

    return null;
  };

  // ### GL.Raytracer.hitTestTriangle(origin, ray, a, b, c)
  //
  // Traces the ray starting from `origin` along `ray` against the triangle defined
  // by the points `a`, `b`, and `c`. Returns a `HitTest` with the information or
  // `null` for no intersection.
  Raytracer.hitTestTriangle = function(origin, ray, a, b, c) {
    var ab = b.subtract(a);
    var ac = c.subtract(a);
    var normal = ab.cross(ac).unit();
    var t = normal.dot(a.subtract(origin)) / normal.dot(ray);

    if (t > 0) {
      var hit = origin.add(ray.multiply(t));
      var toHit = hit.subtract(a);
      var dot00 = ac.dot(ac);
      var dot01 = ac.dot(ab);
      var dot02 = ac.dot(toHit);
      var dot11 = ab.dot(ab);
      var dot12 = ab.dot(toHit);
      var divide = dot00 * dot11 - dot01 * dot01;
      var u = (dot11 * dot02 - dot01 * dot12) / divide;
      var v = (dot00 * dot12 - dot01 * dot02) / divide;
      if (u >= 0 && v >= 0 && u + v <= 1) return new HitTest(t, hit, normal);
    }

    return null;
  };


  PFGL.HitTest = HitTest;
  PFGL.Raytracer = Raytracer;

})();

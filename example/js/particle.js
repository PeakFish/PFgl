(function(){


// Framework.js
var canvas, ctx, isContinue, timeoutID;

function start(canvasName, func) {
  if (timeoutID)
    stop();

  canvas = document.getElementById(canvasName);
  ctx = canvas.getContext("2d");
  isContinue = true;

  var loop = function() {
    func();
    if (isContinue)
      timeoutID = setTimeout(loop, 10);
  }

  loop();
}

function stop() {
  clearTimeout(timeoutID);
  isContinue = false;
}

function clearCanvas() {
  if (ctx != null)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// Vector2.js
Vector2 = function(x, y) { this.x = x; this.y = y; };

Vector2.prototype = {
  copy: function() { return new Vector2(this.x, this.y); },
  length: function() { return Math.sqrt(this.x * this.x + this.y * this.y); },
  sqrLength: function() { return this.x * this.x + this.y * this.y; },
  normalize: function() { var inv = 1 / this.length(); return new Vector2(this.x * inv, this.y * inv); },
  negate: function() { return new Vector2(-this.x, -this.y); },
  add: function(v) { return new Vector2(this.x + v.x, this.y + v.y); },
  subtract: function(v) { return new Vector2(this.x - v.x, this.y - v.y); },
  multiply: function(f) { return new Vector2(this.x * f, this.y * f); },
  divide: function(f) { var invf = 1 / f; return new Vector2(this.x * invf, this.y * invf); },
  dot: function(v) { return this.x * v.x + this.y * v.y; }
};

Vector2.zero = new Vector2(0, 0);

// Color.js
Color = function(r, g, b) { this.r = r; this.g = g; this.b = b };

Color.prototype = {
  copy: function() { return new Color(this.r, this.g, this.b); },
  add: function(c) { return new Color(this.r + c.r, this.g + c.g, this.b + c.b); },
  multiply: function(s) { return new Color(this.r * s, this.g * s, this.b * s); },
  modulate: function(c) { return new Color(this.r * c.r, this.g * c.g, this.b * c.b); },
  saturate: function() { this.r = Math.min(this.r, 1); this.g = Math.min(this.g, 1); this.b = Math.min(this.b, 1); }
};

Color.black = new Color(0, 0, 0);
Color.white = new Color(1, 1, 1);
Color.red = new Color(1, 0, 0);
Color.green = new Color(0, 1, 0);
Color.blue = new Color(0, 0, 1);
Color.yellow = new Color(1, 1, 0);
Color.cyan = new Color(0, 1, 1);
Color.purple = new Color(1, 0, 1);

// Particle.js
Particle = function(position, velocity, life, color, size) {
  this.position = position;
  this.velocity = velocity;
  this.acceleration = Vector2.zero;
  this.age = 0;
  this.life = life;
  this.color = color;
  this.size = size;
};

// ParticleSystem.js
function ParticleSystem(){
  // Private fields
  var that = this;
  var particles = new Array();

  // Public fields
  this.gravity = new Vector2(0, 100);
  this.effectors = new Array();

  // Public methods

  this.emit = function(particle){
    particles.push(particle);
  };

  this.simulate = function(dt){
    aging(dt);
    applyGravity();
    applyEffectors();
    kinematics(dt);
  };

  this.render = function(ctx){
    for(var i in particles){
      var p = particles[i];
      var alpha = 1 - p.age / p.life;
      ctx.fillStyle = "rgba("
        + Math.floor(p.color.r * 255) + ","
        + Math.floor(p.color.g * 255) + ","
        + Math.floor(p.color.b * 255) + ","
        + alpha.toFixed(2) + ")";
      ctx.beginPath();
      ctx.arc(p.position.x, p.position.y, p.size, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.fill();
    }
  };

  // Private methods

  function aging(dt){
    for (var i = 0; i < particles.length; ) {
      var p = particles[i];
      p.age += dt;
      if (p.age >= p.life)
        kill(i);
      else
        i++;
    }
  }

  function kill(index){
    //把当前的删除掉， 替换成最后一个，然后在删除掉复制完的那个。
    if (particles.length > 1)
      particles[index] = particles[particles.length - 1];
    particles.pop();
  }

  function applyGravity(){
    for(var i in particles)
      particles[i].acceleration = that.gravity;
  }

  function applyEffectors() {
    for(var j in that.effectors){
      var apply = that.effectors[j].apply;
      console.log(apply);
      for(var i in particles)
        apply(particles[i]);
    }
  }

  function kinematics(dt){
    for(var i in particles){
      var p = particles[i];
      p.position = p.position.add(p.velocity.multiply(dt));
      p.velocity = p.velocity.add(p.acceleration.multiply(dt));
    }
  }
}

// ChamberBox.js
/* 
* @requires Vector2, Particle
*/
function ChamberBox(x1, y1, x2, y2){
  this.apply = function(particle){
    if (particle.position.x - particle.size < x1 || particle.position.x + particle.size > x2)
      particle.velocity.x = -particle.velocity.x;

    if (particle.position.y - particle.size < y1 || particle.position.y + particle.size > y2)
      particle.velocity.y = -particle.velocity.y;
  };
}





//粒子执行

var ps = new ParticleSystem();
var dt = 0.01;

function sampleDirection(){
  var theta = Math.random() * 2 * Math.PI;
  return new Vector2(Math.cos(theta), Math.sin(theta));
}

function step(){
  ps.emit(new Particle(new Vector2(200, 200), sampleDirection().multiply(100), 1, Color.red, 5));
  ps.simulate(dt);

  clearCanvas();
  ps.render(ctx);
}


start('basicParticleSystemCanvas', step);






})();

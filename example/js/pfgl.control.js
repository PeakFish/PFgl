/*

依赖gl-matrix.js
相机控制 控制的是 view matrix (vec3 eye, vec3 center, vec3 up)

旋转 左键 移动的只有眼睛 应该先把 坐标系转换成球坐标系，操作完两个方位角， 然后再转换成笛卡尔坐标系。

平移 右键 移动的是眼睛和中心点，一样的移动距离，是二维的

*/

/*
 * gl-matrix mat4 viewMat
 */
;(function(){

  PFGL.control = function(element, fn, viewMat, eye, center, up){

    var STATE = {NONE: - 1, ROTATE: 0, DOLLY: 1, PAN: 2, TOUCH_ROTATE: 3, TOUCH_DOLLY: 4, TOUCH_PAN: 5};
    var state = STATE.NONE;

    var lastMouseX = null;
    var lastMouseY = null;

    /*
     **************
     *绑定事件*
     **************
     */

    element.addEventListener('mousedown', handleMouseDown, false);
    document.addEventListener('mouseup', handleMouseUp, false);
    document.addEventListener('mousemove', handleMouseMove, false);
    document.addEventListener( 'contextmenu', handleContextMenu, false );
    element.addEventListener('wheel', handleMouseWheel, false);

    /*
     **************
     *绑定事件函数*
     **************
     */

    function handleContextMenu(e){
      e.preventDefault();
    }

    function handleMouseDown(e){
      e.preventDefault();
      //0 左键，1 滚轮，2右键
      if(e.button == STATE.ROTATE){//左键旋转
        mouseDownRotate(e);
        state = STATE.ROTATE;
      }else if(e.button == STATE.PAN){//右键平移
        mouseDownPan(e);
        state = STATE.PAN;
      }
    }

    function handleMouseUp(e){
      if(state == STATE.NONE){
        return;
      }
      e.preventDefault();
      state = STATE.NONE
    }

    function handleMouseMove(e){
      if(state == STATE.NONE){
        return;
      }
      e.preventDefault();

      if(state == STATE.ROTATE){//左键旋转
        mouseMoveRotate(e);
      }else if(state == STATE.PAN){//右键平移
        mouseMovePan(e);
      }

    }

    function handleMouseWheel(e){//console.log('缩放');
      e.preventDefault();
      var delta = 0.0;
      if(e.deltaMode == 0){
        delta = e.deltaY * 0.001;
      }else if (e.deltaMode == 1){
        delta = e.deltaY * 0.03;
      }else{
        delta = e.deltaY;
      }
      //缩放控制是一维的，控制的是 眼睛的位置。眼睛距离中心点的距离
      var e_c = vec3.sub(vec3.create(), eye, center);
      //移动眼睛，让眼睛离中心位置 增加或者减少
      vec3.scaleAndAdd(eye, eye, e_c, delta);
      //这里没有移动观察点的位置，移动的话也可以。
      //vec3.scaleAndAdd(center, center, e_c, delta);
      update();
    }



    /*
     **************
     *处理移动函数*
     **************
     */
    //旋转时候的点击函数
    function mouseDownRotate(e){
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    }
    //平移时候的点击函数
    function mouseDownPan(e){
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    }
    //旋转时候的移动函数
    function mouseMoveRotate(e){//console.log('旋转');

      var factors = -1.0;

      var newX = e.clientX;
      var newY = e.clientY;

      var deltaX = newX - lastMouseX;
      var deltaY = newY - lastMouseY;

      lastMouseX = newX;
      lastMouseY = newY;

      var deltaTheta = 2 * Math.PI * deltaX / element.clientWidth * factors;
      var deltaPhi = 2 * Math.PI * deltaY / element.clientHeight * factors;


      var copyEye = vec3.copy(vec3.create(), eye);
      //up is the orbit axis
      var q = quat.rotationTo(quat.create(), up, vec3.fromValues(0, 1, 0));
      var qInverse = quat.invert(quat.create(), q);

      //这步的操作是把眼睛平移回到原点（相机也做相同的操错），下面还要平移回来， 因为旋转点是原点
      vec3.subtract(copyEye, copyEye, center);

      //把旋转轴转换成 最普通的 y 正方向
      vec3.transformQuat(copyEye, copyEye, q);

      //转换为球坐标系 方便计算
      var sphericalEye = vector2spherical(copyEye);
      sphericalEye.theta += deltaTheta;
      sphericalEye.phi +=  deltaPhi;
      //makeSafe restrict phi to be betwee EPS and PI-EPS
      sphericalEye.phi = Math.max(glMatrix.EPSILON, Math.min(Math.PI - glMatrix.EPSILON, sphericalEye.phi));
      //console.log(sphericalEye.theta, sphericalEye.phi);
      //再把球坐标系 转换回来
      copyEye = spherical2vector(sphericalEye);

      //载把旋转轴转换回去
      vec3.transformQuat(copyEye, copyEye, qInverse);

      //旋转完之后再把眼睛平移回去
      vec3.add(copyEye, copyEye, center);

      vec3.copy(eye, copyEye);

      update();

    }
    //平移时候的移动函数
    function mouseMovePan(e){//console.log('平移');

      //移动的因子 负值是因为移动是相反方向的 物体往左移 相当于眼睛往右移
      var factors = -0.002;
      //保存新的鼠标位置
      var newX = e.clientX;
      var newY = e.clientY;
      //根据鼠标点击时候保存的信息计算移动的距离
      var deltaX = newX - lastMouseX;
      var deltaY = newY - lastMouseY;
      //鼠标的坐标和正常的是反的
      deltaY *= -1;
      //更新点的信息
      lastMouseX = newX;
      lastMouseY = newY;

      //移动中心点和视点
      //计算出 视点 和 观察点的 连接 向量
      var e_c = vec3.sub(vec3.create(), center, eye);
      var e_cLen = vec3.length(e_c);
      //vec3.normalize(e_c, e_c);
      //向量叉乘计算出 两个垂直于 视点 相机 连接的向量
      var horizontalVec = vec3.cross(vec3.create(), e_c, up);
      var verticalVec = vec3.cross(vec3.create(), horizontalVec, e_c);
      //向量归一化
      vec3.normalize(horizontalVec, horizontalVec);
      vec3.normalize(verticalVec, verticalVec);

      //1.使用 向量 水平方向 和 垂直方向 向量 作为坐标系 按照鼠标移动的 距离 移动 观察点 和 视点
      //2.乘以 视点 相机 向量的长度 让远距离和近距离 移动的速率一样
      var moveXD = vec3.scale(vec3.create(), horizontalVec, deltaX * factors * e_cLen);
      var moveYD = vec3.scale(vec3.create(), verticalVec, deltaY * factors * e_cLen);

      var moveVer = vec3.add(vec3.create(), moveXD, moveYD);
      //平移的时候需要眼睛和中心点一起移动
      vec3.add(eye, eye, moveVer);
      vec3.add(center, center, moveVer);

      update();

    }

    function update(){//console.log('--------------', center);

      mat4.lookAt(viewMat, eye, center, up);

      //console.log(viewMat);
      fn();

    }

  };

  /*
   **************
   *一些工具函数*
   **************
   */

  function spherical2vector(s){
    var sinPhiRadius = Math.sin(s.phi) * s.radius;
    var x = sinPhiRadius * Math.sin(s.theta);
    var y = Math.cos(s.phi) * s.radius;
    var z = sinPhiRadius * Math.cos(s.theta);
    return vec3.fromValues(x, y, z);
  }

  function vector2spherical(v3){
    var s = {};
    var EPS = 0.000001;
    s.radius = vec3.length(v3);
    s.theta;
    s.phi;
    if(s.radius == 0){
      s.theta = 0;
      s.phi = 0;
    }else{
      s.theta = Math.atan2(v3[0], v3[2]); // equator angle around y-up axis
      s.phi = Math.acos(Math.max(-1, Math.min(1, v3[1] / s.radius))); // polar angle
    }
    return s;
  }



})();

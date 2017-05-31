
##PFgl(selector, parameters)
```js
var pfgl = new PFgl('#canvas1');
```

#property

##.gl
webglprogram

##.program
```js
.program = [
  program,
  program,
  ...
];
```

##.pointer
```js
.pointer = [
  {
    name: pointer,
    name: pointer,
    ...
  },
  {

  }
];
```



<!--
修改数据结构吗？
```js
[
  {
    program: webglprogram,
    pointer: {
      name: uniformpointer,
      name: uniformpointer,
      name: uniformpointer
    }
  }
]
```
-->

#API

##.useProgram(program)
##.getCurrentProgram()
##.shader(vshader, fshader)
##.loadShadertype, source)
##.buildBuffer(type, typedArray)
##.drawElements(mode, indices, type, offset)

##.attribute(attributes, typeAray, program)
```js
attributes = [
  {
    name: 'a_position',
    size: 3, //default is 3
    stride: 0, //default is 0
    offset: 0 //default is 0
  },
  ...
];
```

##.uniform(uniform, typedArray, type, program)
##.texture2d(element, unit, width, height)
##.textureCube(elements, unit, width, height)
##.frameBuffer(width, height, textureType, textureUnit)

#static

##PFGL.loadImg

# THREE-Commonjsify

This is a node program that provides an ast parser that transforms the [THREE.js](http://threejs.org/) source code in commonJS format, to be used in node.js or in browsers, using [QuickStart](https://github.com/spotify/quickstart), [Browserify](https://github.com/substack/node-browserify), or whatever you like the most.
This parser is run every time a new THREE.js revision is released, and the results are [published to npm](https://www.npmjs.com/package/three.cjs).

```
npm install three.cjs --save
```

## Basic Usage (NPM Package)

```js
var THREE = require("three.cjs");
// use THREE as normal
```

However, if you plan on using THREE.js including everything, you might as well include the [global version](https://github.com/mrdoob/three.js/tree/master/build), or depend on [the official package](https://www.npmjs.com/package/three) instead.

## CommonJS Usage (NPM Package)

Basic
```js
var Vector3 = require("three.cjs/math/Vector3").Vector3;
console.log(new Vector3().sub(new Vector3(-1, -2, -3)));
```

Example from the THREE.js README, in commonJS format, [live demo](http://requirebin.com/?gist=b7fe528d8059a7403960):
```js
var Scene = require( 'three.cjs/scenes/Scene' ).Scene;
var PerspectiveCamera = require( 'three.cjs/cameras/PerspectiveCamera' ).PerspectiveCamera;
var BoxGeometry = require( 'three.cjs/extras/geometries/BoxGeometry' ).BoxGeometry;
var MeshBasicMaterial = require( 'three.cjs/materials/MeshBasicMaterial' ).MeshBasicMaterial;
var Mesh = require( 'three.cjs/objects/Mesh' ).Mesh;
var WebGLRenderer = require( 'three.cjs/renderers/WebGLRenderer' ).WebGLRenderer;

var scene, camera, renderer;
var geometry, material, mesh;

init();
animate();

function init() {

    scene = new Scene();

    camera = new PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 10000 );
    camera.position.z = 1000;

    geometry = new BoxGeometry( 200, 200, 200 );
    material = new MeshBasicMaterial( { color: 0xff0000, wireframe: true } );

    mesh = new Mesh( geometry, material );
    scene.add( mesh );

    renderer = new WebGLRenderer();
    renderer.setSize( window.innerWidth, window.innerHeight );

    document.body.appendChild( renderer.domElement );

}

function animate() {

    requestAnimationFrame( animate );

    mesh.rotation.x += 0.01;
    mesh.rotation.y += 0.02;

    renderer.render( scene, camera );

}
```

The directory structure is kept starting from [src](https://github.com/mrdoob/three.js/tree/master/src).

## Compiler Usage

This package's primary goal is to publish `three.cjs` on npm, therefore it is not very user-friendly.

You have to clone from GitHub then run `npm install`, then:

```
node ./compile.js --input /path/to/three.js/src --output /path/to/dist
```

You can also pack in extra files (examples ?) by adding them to the three.js src folder and running the above command.

## Optimizations

This program optimizes the THREE.js code at the AST level. It gets rid of all the instanceof checks, by setting a `.is` property on every function exported on the THREE object, thus eliminating a lot of dependencies. It also gets rid of the native instanceof checks, by replacing it with the more solid `Object.prototype.toString` method.

Here is an example from `Object3D.js`.

before:
```js
if ( object instanceof THREE.PerspectiveCamera ) {
    // some other code
}
```

after:
```js
var instance;
// ... //
if (!!(instance = object) && !!instance.isPerspectiveCamera) {
    // some other code
}
```

Now, `Object3D` does not depend on `PerspectiveCamera` any longer.

## Handling circular dependencies

When a circular dependency is found, the generated AST for the require call looks like this:

source: `math/Vector3.js`
```js
var Matrix4Module, getMatrix4Module = function () {
    return Matrix4Module = require('./Matrix4');
};

// ... //

Vector3.prototype.project = function () {
  var matrix;
  return function (camera) {
    if (matrix === undefined) matrix = new (Matrix4Module || (getMatrix4Module())).Matrix4();
    matrix.multiplyMatrices(camera.projectionMatrix, matrix.getInverse(camera.matrixWorld));
    return this.applyProjection(matrix);
  };
}();
```

It's not very pretty to look at, but it's fast, only one function call per module.

## Issues

Some files in THREE.js use computed expressions on the THREE object:

`./loaders/Loader.js (computed expression)`
`./loaders/MaterialLoader.js (computed expression)`
`./loaders/ObjectLoader.js (computed expression)`
`./loaders/JSONLoader.js (missing Loader definition)` (since Loader.js was ignored)

These files are unable to be parsed by this program, and are therefore ignored.

See [this pull request](https://github.com/mrdoob/three.js/pull/6546) for more info.

For reasons unknown to humanity, `./core/Raycaster.js` uses THREE as the argument of an anonymous function. This file cannot be compiled.

You can use [my branch](https://github.com/kamicane/three.js/tree/common-js-r71) if you want to compile THREE from source with loaders support and Raycaster.

The three.cjs package on npm uses my branch.

## Versioning

The published `three.cjs` package follows the `three` package versioning, where the minor version represents the THREE.js revision. The patch version will be used for patches in compilation, should bugs arise.

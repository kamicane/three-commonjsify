# three.cjs

This is a transpiled-to-commonJS version of the [THREE.js](http://threejs.org/) library, to be used in node.js or in browsers, using [QuickStart](https://github.com/spotify/quickstart), [Browserify](https://github.com/substack/node-browserify), or whatever you like the most.

It is transpiled with [three-commonjsify](https://github.com/kamicane/three-commonjsify).

## Usage

Basic (Math modules work in node.js as well)
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

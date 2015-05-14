var Scene = require('three.cjs/scenes/Scene').Scene;
var PerspectiveCamera = require('three.cjs/cameras/PerspectiveCamera').PerspectiveCamera;
var BoxGeometry = require('three.cjs/extras/geometries/BoxGeometry').BoxGeometry;
var MeshBasicMaterial = require('three.cjs/materials/MeshBasicMaterial').MeshBasicMaterial;
var Mesh = require('three.cjs/objects/Mesh').Mesh;
var WebGLRenderer = require('three.cjs/renderers/WebGLRenderer').WebGLRenderer;

var scene, camera, renderer;
var geometry, material, mesh;

init();
animate();

function init() {

    scene = new Scene();

    camera = new PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 10000 );
    camera.position.z = 1000;

    geometry = new BoxGeometry( 200, 200, 200 );
    material = new MeshBasicMaterial( { color: "red", wireframe: true } );

    mesh = new Mesh( geometry, material );
    scene.add( mesh );

    renderer = new WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize( window.innerWidth, window.innerHeight );

    document.body.appendChild( renderer.domElement );

}

function animate() {

    requestAnimationFrame( animate );

    mesh.rotation.x += 0.01;
    mesh.rotation.y += 0.02;

    renderer.render( scene, camera );

}

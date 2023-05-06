import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.126.0/build/three.module.js'
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.126.0/examples/jsm/controls/OrbitControls.js'
import { Rhino3dmLoader } from 'https://cdn.jsdelivr.net/npm/three@0.126.0/examples/jsm/loaders/3DMLoader.js'
import rhino3dm from 'https://cdn.jsdelivr.net/npm/rhino3dm@0.15.0-beta/rhino3dm.module.js'
import { HDRCubeTextureLoader } from 'https://cdn.jsdelivr.net/npm/three@0.124.0/examples/jsm/loaders/HDRCubeTextureLoader.js'

let material = new THREE.MeshStandardMaterial( {
  //color: 0xffffff,
  color: 0xFF8C17,
  metalness: 1.0,
  roughness: 0.0
} );



const initialFile = 'solve/b_ring.gh';
const data = {
  definition: '',
  inputs: getInputs(),
	initialLoaded: false, // new property
};

const loader = new Rhino3dmLoader();
loader.setLibraryPath('https://cdn.jsdelivr.net/npm/rhino3dm@0.15.0-beta/');
loader.load(initialFile, function (definition) {
  if (definition) {
    data.definition = definition;
    data.inputs = getInputs();
    compute();
  }
});

// globals
// test
let rhino, doc

rhino3dm().then(async m => {
  rhino = m;
  const b_ring_response = await fetch(initialFile); // use initialFile here as well
  const b_ring_definition = await b_ring_response.text();
  const b_ring_data = {
    definition: b_ring_definition,
    inputs: {}
  };
  data.definition = b_ring_definition; // update data with the initial file definition
  data.inputs = getInputs(); // update data with initial inputs
  compute();
  init();
});



const downloadButton = document.getElementById("downloadButton")
downloadButton.onclick = download

 

// get <input> elements from html and set onchange handlers
const inputs = getInputs();
for (const input of Object.values(inputs)) {
  if (input instanceof HTMLInputElement) {
    input.onchange = async () => {
      // get current input values
      const currentInputs = getInputs();

      // construct filename from input values
      const filename = `${currentInputs.input1}_${currentInputs.input2}.gh`;

      // load file from server
      const response = await fetch(`ori/solve/${filename}`);
      const definition = await response.text();

      // update 'data' object and recompute
      data.definition = definition;
      data.inputs = currentInputs;
      compute();
    }
  }
}


  /////////////////////////////////////////////////////////////////////////////
 //                            HELPER  FUNCTIONS                            //
/////////////////////////////////////////////////////////////////////////////

/**
 * Gets <input> elements from html and sets handlers
 * (html is generated from the grasshopper definition)
 */
function getInputs() {
  const inputs = {}
  for (const input of document.getElementsByTagName('input')) {
    switch (input.type) {
      case 'number':
        inputs[input.id] = input.valueAsNumber
        input.onchange = onSliderChange
        break
      case 'range':
        inputs[input.id] = input.valueAsNumber
        input.onmouseup = onSliderChange
        input.ontouchend = onSliderChange
        break
      case 'checkbox':
        inputs[input.id] = input.checked
        input.onclick = onSliderChange
        break
      default:
        break
    }
  }
  return inputs
}

// more globals
let scene, camera, renderer, controls

/**
 * Sets up the scene, camera, renderer, lights and controls and starts the animation
 */
function init() {

    // Rhino models are z-up, so set this as the default
    THREE.Object3D.DefaultUp = new THREE.Vector3( 0, 0, 1 );

    // create a scene and a camera
    scene = new THREE.Scene()
    scene.background = new THREE.Color(1, 1, 1)
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000)
    camera.position.set(1, -1, 1) // like perspective view
    
    //very light grey for background, like rhino

    //scene.background = new THREE.Color('whitesmoke')

    // create the renderer and add it to the html
    renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.physicallyCorrectLights = true;
		renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setPixelRatio( window.devicePixelRatio )
    renderer.setSize(window.innerWidth, window.innerHeight)
    document.body.appendChild(renderer.domElement)

    let cubeMap

   cubeMap = new HDRCubeTextureLoader()
         .setPath( 'assets/' )
         .setDataType( THREE.UnsignedByteType )
         .load( [ 'px.hdr', 'nx.hdr', 'py.hdr', 'ny.hdr', 'pz.hdr', 'nz.hdr' ] )

   //cubeMap = new THREE.CubeTextureLoader()
     //   .setPath('assets/')
       // .load( [ 'px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png' ] )

    // add some controls to orbit the camera
    controls = new OrbitControls(camera, renderer.domElement)

    // add a directional light
    const directionalLight = new THREE.DirectionalLight( 0xffffff )
    directionalLight.intensity = 2
    scene.add( directionalLight )

    const ambientLight = new THREE.AmbientLight()
    scene.add( ambientLight )

    scene.background = cubeMap
    material.envMap = scene.background

    // handle changes in the window size
    window.addEventListener( 'resize', onWindowResize, false )

    animate()
}

/**
 * Call appserver
 */

async function compute() {

  // get the inputs from the html
  const inputs = getInputs();

  // construct the name of the JSON file to load
  const filename = Object.values(inputs).join('_') + '.gh';

  // construct the URL for the GET request to load the response file
  const url = new URL(`ori/solve/${filename}`, window.location.origin);

  try {
    // try to fetch the file from the solve folder
    const response = await fetch(url);

    // if the file was found, load the JSON data
    if (response.ok) {
      const json = await response.json();
      // use the JSON data to create a new Rhino3dm model
      if (json && json.values && json.values[0] && json.values[0].data && json.values[0].data.type === "Mesh") {
        const meshData = json.values[0].data;
        const mesh = rhino.CommonObject.decode(meshData);
      } else {
        console.error("Failed to compute mesh data");
      }
      collectResults(json);
      console.log(`Loaded response file: ${filename}`);
      console.log(`Corresponding URL: ${url.toString()}`);
    } else {
      // if the file was not found, display an error message
      console.error('Could not load file: ' + filename);
    }
 
  } catch (error) {
    // if there was an error fetching or parsing the file, display an error message
    console.error('Error loading file: ' + filename + '\n' + error.message);
  }
}


/**
 * Parse response
 */
function collectResults(responseJson) {

    const values = responseJson.values

    // clear doc
    if( doc !== undefined)
        doc.delete()

    //console.log(values)
    doc = new rhino.File3dm()

    // for each output (RH_OUT:*)...
    for ( let i = 0; i < values.length; i ++ ) {
      // ...iterate through data tree structure...
      for (const path in values[i].InnerTree) {
        const branch = values[i].InnerTree[path]
        // ...and for each branch...
        for( let j = 0; j < branch.length; j ++) {
          // ...load rhino geometry into doc
          const rhinoObject = decodeItem(branch[j])
          if (rhinoObject !== null) {
            doc.objects().add(rhinoObject, null)
          }
        }
      }
    }

    if (doc.objects().count < 1) {
      console.error('No rhino objects to load!')
      showSpinner(false)
      return
    }

    // load rhino doc into three.js scene
    const buffer = new Uint8Array(doc.toByteArray()).buffer
    loader.parse( buffer, function ( object ) 
    {
        // debug 
        
        object.traverse(child => {
          child.material = material
        })
        

        // clear objects from scene. do this here to avoid blink
        scene.traverse(child => {
            if (!child.isLight) {
                scene.remove(child)
            }
        })

        // add object graph from rhino model to three.js scene
        scene.add( object )

        // hide spinner and enable download button
        showSpinner(false)
        downloadButton.disabled = false

        // zoom to extents
       // zoomCameraToSelection(camera, controls, scene.children)
	 
	    if (!data.initialLoaded) {
      zoomCameraToSelection(camera, controls, scene.children);
      data.initialLoaded = true; // mark the initial loaded 3D as processed
    }
	    
	    
    })
}

/**
 * Attempt to decode data tree item to rhino geometry
 */




function decodeItem(item) {
  const data = JSON.parse(item.data)
  if (item.type === 'System.String') {
    // hack for draco meshes
    try {
        return rhino.DracoCompression.decompressBase64String(data)
    } catch {} // ignore errors (maybe the string was just a string...)
  } else if (typeof data === 'object') {
    return rhino.CommonObject.decode(data)
  }
  return null
}

/**
 * Called when a slider value changes in the UI. Collect all of the
 * slider values and call compute to solve for a new scene
 */
function onSliderChange () {
  showSpinner(true)
  // get slider values
  let inputs = {}
  for (const input of document.getElementsByTagName('input')) {
    switch (input.type) {
    case 'number':
      inputs[input.id] = input.valueAsNumber
      break
    case 'range':
      inputs[input.id] = input.valueAsNumber
      break
    case 'checkbox':
      inputs[input.id] = input.checked
      break
    }
  }
  
  data.inputs = inputs

  compute()
}

/**
 * The animation loop!
 */
function animate() {
  requestAnimationFrame( animate )
  controls.update()
  renderer.render(scene, camera)
}

/**
 * Helper function for window resizes (resets the camera pov and renderer size)
  */
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize( window.innerWidth, window.innerHeight )
  animate()
}

/**
 * Helper function that behaves like rhino's "zoom to selection", but for three.js!
 */
function zoomCameraToSelection( camera, controls, selection, fitOffset = 3.6 ) {
  
  const box = new THREE.Box3();
  
  for( const object of selection ) {
    if (object.isLight) continue
    box.expandByObject( object );
  }
  
  const size = box.getSize( new THREE.Vector3() );
  const center = box.getCenter( new THREE.Vector3() );
  
  const maxSize = Math.max( size.x, size.y, size.z );
  const fitHeightDistance = maxSize / ( 2 * Math.atan( Math.PI * camera.fov / 360 ) );
  const fitWidthDistance = fitHeightDistance / camera.aspect;
  const distance = fitOffset * Math.max( fitHeightDistance, fitWidthDistance );
  
  const direction = controls.target.clone()
    .sub( camera.position )
    .normalize()
    .multiplyScalar( distance );
  controls.maxDistance = distance * 10;
  controls.target.copy( center );
  
  camera.near = distance / 100;
  camera.far = distance * 100;
  camera.updateProjectionMatrix();
  camera.position.copy( controls.target ).sub(direction);
  
  controls.update();
  
}

/**
 * This function is called when the download button is clicked
 */
function download () {
    // write rhino doc to "blob"
    const bytes = doc.toByteArray()
    const blob = new Blob([bytes], {type: "application/octect-stream"})

    // use "hidden link" trick to get the browser to download the blob
    const filename = data.definition.replace(/\.gh$/, '') + '.3dm'
    const link = document.createElement('a')
    link.href = window.URL.createObjectURL(blob)
    link.download = filename
    link.click()
}

/**
 * Shows or hides the loading spinner
 */
function showSpinner(enable) {
  if (enable)
    document.getElementById('loader').style.display = 'block'
  else
    document.getElementById('loader').style.display = 'none'
}

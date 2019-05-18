//// importing the required libraries
let THREE = require("./OrbitControls");

// set up all links for AJAX requests
let localhost = "http://192.168.0.10:6923";
const publicDirectoryUrl = localhost + "/public";
const cadMetaDataUrl = localhost + "/cadmeta/";
let fusionFlaskServerUrl = localhost + "/fusion360";
let fusionFlaskServerLCNCUrl = localhost + "/send_gcode_to_lcnc";

//// 3.js initialisations
// camera, scene init
let scene, camera, renderer;
scene = new THREE.Scene();
scene.background = new THREE.Color(0x1d4047);
const aspectRatio = window.innerWidth / window.innerHeight;
camera = new THREE.PerspectiveCamera(45, aspectRatio, 0.1, 1000);
camera.position.z = 1000;

// renderer init
renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth * (3 / 4), window.innerHeight * (3 / 4));
document.getElementById('renderOutput').appendChild(renderer.domElement);

// OrbitalControl init
let controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.campingFactor = 0.25;
controls.enableZoom = true;

// set lighting directions
let createLighting = function () {
    let keyLight = new THREE.DirectionalLight(
        new THREE.Color('hsl(30, 100%, 75%)'), 1.0);
    keyLight.position.set(-100, 0, 100);
    let fillLight = new THREE.DirectionalLight(
        new THREE.Color('hsl(240, 100%,75%)'), 0.75);
    fillLight.position.set(100, 0, 100);
    let backLight = new THREE.DirectionalLight(0xffffff, 1.0);
    backLight.position.set(100, 0, -100).normalize();
    let topLight = new THREE.DirectionalLight(
        new THREE.Color('hsl(30, 100%,75%)'), 1.0);
    topLight.position.set(0, 1, 0);
    let bottomLight = new THREE.DirectionalLight(
        new THREE.Color('hsl(30, 100%,75%)'), 1.0);
    bottomLight.position.set(0, -1, 0);
    scene.add(keyLight);
    scene.add(fillLight);
    scene.add(backLight);
    scene.add(topLight);
    scene.add(bottomLight);
};

//// gets the current STL file contents
// this actually makes an ajax call
function httpRequestHandler(url, body, method, asyncState = false, asyncResponseObject) {
    let xmlHttp = new XMLHttpRequest();
    
    if (asyncState) {
        xmlHttp.timeout = 5 * 60 * 1000; // 5 min LCNC timeout
        xmlHttp.ontimeout = function () {
            asyncResponseObject.innerText = "LCNC Response Timed Out";
            setTimeout(() => {
                asyncResponseObject.innerText = "";
            }, 3000);
        };
        xmlHttp.onreadystatechange = function () {
            if (xmlHttp.readyState === XMLHttpRequest.DONE && xmlHttp.status === 200) {
                asyncResponseObject.innerText = xmlHttp.responseText;
                setTimeout(() => {
                    asyncResponseObject.innerText = "";
                }, 5000);
            } else if (xmlHttp.status === 500) {
                asyncResponseObject.innerText = "Internal server" +
                    " error occured";
                setTimeout(() => {
                    asyncResponseObject.innerText = "";
                }, 3000);
            }
        };
    }
    
    xmlHttp.open(method, url, asyncState);
    if (method === 'POST') {
        xmlHttp.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    }
    xmlHttp.send(JSON.stringify(body));
    return xmlHttp.responseText;
}

// stl file drop down list initialisations
let ddownList = document.getElementById('selectSTL');
let panelNameElement = document.getElementById("panelName");
panelNameElement.innerHTML = "<b>Control Panel</b>";

let controlPanelForm = document.getElementById('controlPanel');
let fileList = JSON.parse(httpRequestHandler(publicDirectoryUrl, null, 'GET'));
let flaskServerResponsePanel = document.getElementById('flaskServerResponse');

// populate the drop down list
for (let _file of fileList) {
    // populate with only stl files
    if (_file.slice(_file.length - 3, _file.length) === 'stl') {
        let option = document.createElement('option');
        option.text = _file;
        ddownList.add(option);
    }
}

//// initialising stl loader
let stlLoader = new THREE.STLLoader();
let clickCounter = 0;
ddownList.addEventListener('click', function () {
    clickCounter++;
    // using clickcounter to stop reload on first drop down roll down
    if (ddownList.value !== "0" && clickCounter > 1) {
        // option value defaults to option text if not specified
        clickCounter = 0;
        stlLoader.load(localhost + "/get_stl_file/" + ddownList.value, function (geometry) {
            let mat = new THREE.MeshLambertMaterial({
                                                        color: 0xf2d937
                                                    });
            let mesh = new THREE.Mesh(geometry, mat);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            
            // first remove already existing models from scene
            while (scene.children.length > 0) {
                scene.remove(scene.children[0]);
            }
            createLighting();
            scene.add(mesh);
            
            // first make sure the form element is empty
            controlPanelForm.innerHTML = "";
            
            // parse the stl json meta data to populate controls panel
            let cadMetaData = httpRequestHandler(cadMetaDataUrl + ddownList.value, null, 'GET');
            const cadJsonMetaData = JSON.parse(cadMetaData);
            
            for (let dim in cadJsonMetaData) {
                
                let labelForRangeControl = document.createElement('label');
                let rangeControlElement = document.createElement('input');
                let spanElement = document.createElement('span');
                
                console.log("CAD metadata:");
                console.log(cadJsonMetaData);
                
                // creating the range element
                rangeControlElement.type = "range";
                rangeControlElement.min = cadJsonMetaData[dim]["min"];
                rangeControlElement.max = cadJsonMetaData[dim]["max"];
                rangeControlElement.name = dim;
                rangeControlElement.id = dim;
                rangeControlElement.step = "2";
                rangeControlElement.setAttribute('value', cadJsonMetaData[dim]["currentValue"]);
                
                labelForRangeControl.setAttribute('for', dim);
                labelForRangeControl.innerText = dim;
                
                // set attributes for the span element
                spanElement.setAttribute('id', 'spanFor' + dim);
                spanElement.innerText = rangeControlElement.value;
                
                // add all the elements to the DOM in the control
                // Panel
                let parElem1 = document.createElement("p");
                let parElem2 = document.createElement("p");
                
                parElem1.appendChild(labelForRangeControl);
                parElem2.append(rangeControlElement, spanElement);
                controlPanelForm.append(parElem1, parElem2);
                
                // connect rangeControlElement to onchange listeners
                // for display change on the numeric outputs
                rangeControlElement.addEventListener('change', () => {
                    // get the corresponding span element
                    let spanElement = document.getElementById('spanFor' + dim);
                    spanElement.innerText = rangeControlElement.value;
                });
            }
            let submitElement = document.createElement('button');
            submitElement.type = "button";
            submitElement.innerText = "Update CAD";
            // attach an event listener to the submit button = Update
            // CAD
            submitElement.addEventListener('click', () => {
                let allInputs = document.querySelectorAll('input');
                flaskServerResponsePanel.innerHTML = "";
                let flaskServerPostReqBody = {};
                allInputs.forEach((currentInput) => {
                    flaskServerPostReqBody[currentInput.id] = currentInput.value;
                });
                // also pass the filename
                flaskServerPostReqBody['filename'] = ddownList.value;
                console.log("this is the POST req body before" +
                                " param change");
                console.log(flaskServerPostReqBody);
                let responseFromFlaskServer = httpRequestHandler(
                    fusionFlaskServerUrl, flaskServerPostReqBody, 'POST');
                flaskServerResponsePanel.innerText = responseFromFlaskServer;
                setTimeout(() => {
                    flaskServerResponsePanel.innerText = "";
                }, 2000);
                clickCounter = 2; // make the counter >1 so that stl
                                  // reloads
                ddownList.click(); // fire a click event on the ddwon
                                   // list
            });
            controlPanelForm.appendChild(submitElement);
            
            // now add button for gcode export
            let submitElement2 = document.createElement('button');
            let spanElement2 = document.createElement('span');
            submitElement2.type = 'button';
            submitElement2.innerText = "Repost ToolPath";
            controlPanelForm.appendChild(spanElement2);
            controlPanelForm.appendChild(submitElement2);
            submitElement2.addEventListener('click', () => {
                console.log("sending req to lcnc");
                // g code generation takes long time. so
                // making this ajax call asynchronous
                httpRequestHandler(
                    fusionFlaskServerLCNCUrl, null, 'GET',
                    true, flaskServerResponsePanel);
            });
        });
    }
});
let animate = function () {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate); // recursively calls itself
};
animate();
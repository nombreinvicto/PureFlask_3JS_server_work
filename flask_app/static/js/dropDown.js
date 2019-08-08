//// importing the required libraries
let THREE = require("./OrbitControls");
let plotly = require("plotly.js");

// set up all links for AJAX requests
let localhost = "http://f360app.ngrok.io";
const publicDirectoryUrl = localhost + "/public";
const cadMetaDataUrl = localhost + "/cadmeta/";
let fusionFlaskServerUrl = localhost + "/fusion360";
let fusionFlaskServerLCNCUrl = localhost + "/send_gcode_to_lcnc";
let currentF360DocUrl = localhost + "/currentOpenDoc";
//let lcnc_status_url = "http://pocketncsim.ngrok.io/lcn_xyz_status";
let lcnc_status_url = "http://152.1.58.35:3296/lcn_xyz_status";

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
renderer.setSize(window.innerWidth * (0.6),
                 window.innerHeight * (0.6));
let renderOutputElement = document.getElementById("renderOutput");
renderOutputElement.appendChild(renderer.domElement);

// OrbitalControl init
let controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.campingFactor = 0.25;
controls.enableZoom = true;

// set lighting directions
let createLighting = function () {
    
    let keyLight = new THREE.DirectionalLight(
        new THREE.Color('hsl(0,0%,100%)'), 1.0);
    keyLight.position.set(-100, 0, 100);
    let fillLight = new THREE.DirectionalLight(
        new THREE.Color('hsl(0,0%,100%)'), 0.75);
    fillLight.position.set(100, 0, 100);
    let backLight = new THREE.DirectionalLight(0xffffff, 1.0);
    backLight.position.set(100, 0, -100).normalize();
    let topLight = new THREE.DirectionalLight(
        new THREE.Color('hsl(0,0%,100%)'), 1.0);
    topLight.position.set(0, 1, 0);
    let bottomLight = new THREE.DirectionalLight(
        new THREE.Color('hsl(0,0%,100%)'), 1.0);
    
    bottomLight.position.set(0, -1, 0);
    scene.add(keyLight);
    scene.add(fillLight);
    scene.add(backLight);
    scene.add(topLight);
    scene.add(bottomLight);
};

// makes AJAX calls
function httpRequestHandler(url,
                            body,
                            method,
                            asyncState = false,
                            asyncResponseObject,
                            buttonObject = [],
                            asyncPlotFlag = false) {
    let xmlHttp = new XMLHttpRequest();
    
    function disableButtons() {
        buttonObject.forEach((button) => {
            button.disabled = true;
        });
    }
    
    function enableButtons() {
        buttonObject.forEach((button) => {
            button.disabled = false;
        });
    }
    
    if (asyncState) {
        // asyncState is only true when making request to post new
        // toolpath or when making calls to lcnc status
        
        if (!asyncPlotFlag) {
            disableButtons();
            asyncResponseObject.innerText = "Posting new toolpath...";
            // then disable the buttons in the control panel
            xmlHttp.timeout = 2 * 60 * 1000; // 5 min LCNC timeout
            xmlHttp.ontimeout = function () {
                asyncResponseObject.innerText = "LCNC Response Timed Out";
                setTimeout(() => {
                    asyncResponseObject.innerText = "IDLE";
                    enableButtons();
                }, 3000);
            };
            xmlHttp.onreadystatechange = function () {
                if (xmlHttp.readyState === XMLHttpRequest.DONE
                    && xmlHttp.status === 200) {
                    asyncResponseObject.innerText = xmlHttp.responseText;
                    setTimeout(() => {
                        asyncResponseObject.innerText = "IDLE";
                        enableButtons();
                    }, 2000);
                } else if (xmlHttp.status === 500) {
                    asyncResponseObject.innerText = "Internal server" +
                        " error occured";
                    setTimeout(() => {
                        asyncResponseObject.innerText = "IDLE";
                        enableButtons();
                    }, 3000);
                }
            };
        } else {
            // make calls to lcnc status
            xmlHttp.timeout = 0.5 * 60 * 1000;
            xmlHttp.ontimeout = () => {
                // do nothing
                console.log("plot update from LCNC timed out");
            };
            xmlHttp.onreadystatechange = function () {
                if (xmlHttp.readyState === XMLHttpRequest.DONE
                    && xmlHttp.status === 200) {
                    let responseJSON = JSON.parse(xmlHttp.responseText);
                    console.log("Reply from LCNC for plotly: ");
                    console.log(responseJSON);
                    if (responseJSON["error"]) {
                        lcncStatusSpan.innerText = responseJSON["error"];
                        return;
                    } else {
                        lcncStatusSpan.innerText = responseJSON["motion_status_name"];
                    }
                    if (parseInt(responseJSON["motion_status"]) !== 2) {
                        plotly.extendTraces("renderOutput", {
                            x: [[parseFloat(responseJSON["x"])]],
                            y: [[parseFloat(responseJSON["y"])]],
                            z: [[parseFloat(responseJSON["z"])]]
                        }, [0]);
                    }
                } else if (xmlHttp.status === 500) {
                    console.log("Internal server error for plotly");
                }
            };
        }
    }
    
    xmlHttp.open(method, url, asyncState);
    if (method === 'POST') {
        xmlHttp.setRequestHeader("Content-Type",
                                 "application/json;charset=UTF-8");
    }
    
    xmlHttp.send(JSON.stringify(body));
    return xmlHttp.responseText; // in case of async request, this
    // line doesnt return anything, probably an unhandled promise
}

// stl file drop down list initialisations
let ddownList = document.getElementById('selectSTL');
let panelNameElement = document.getElementById("panelName");
panelNameElement.innerHTML = "<b>Control Panel</b>";
let flaskServerResponsePanelName = document
    .getElementById("flaskServerResponsePanelName");
flaskServerResponsePanelName.innerHTML = "<b>Status Panel</b>";

// setting/getting up some of the initial HTML elements
let controlPanelForm = document.getElementById('controlPanel');
let fileList = JSON
    .parse(httpRequestHandler(publicDirectoryUrl, null, 'GET'));
let flaskServerResponsePanel = document
    .getElementById('flaskServerResponse');
let currentF360DocPanel = document.getElementById('f360DocOpen');
let refreshF360DocButton = document.getElementById('refreshDoc');
refreshF360DocButton.addEventListener('click', () => {
    currentF360DocPanel.innerText = httpRequestHandler(
        currentF360DocUrl,
        null,
        "GET"
    );
});
refreshF360DocButton.click();

// populate the drop down list
for (let _file of fileList) {
    // populate with only stl files
    if (_file.slice(_file.length - 3, _file.length) === 'stl') {
        let option = document.createElement('option');
        option.text = _file;
        ddownList.add(option);
    }
}

// all plotly tasks//////////////////////////////////////////////////
// get all the buttons and elements
let setIntervalObject = "";
let renderOutput = document.getElementById("renderOutput");

let togglePlotButton = document.getElementById("togglePlot");
let togglePlotFlag = true;
let firsPlotFlag = true;
let refreshPlotButton = document.getElementById("refreshPlot");
let toggleDataStreamButton = document.getElementById("toggleDataStream");
let dataStreamFlag = true;
let globalDataTrace = "";
let globalPlotlyLayout = "";

let lcncStatusSpan = document.getElementById("lcncStatus");
let toggleDataStateSpan = document.getElementById("toggleDataStateDisplay");

// attach listeners to buttons
togglePlotButton.addEventListener("click", () => {
    if (togglePlotFlag && firsPlotFlag) {
        renderNewPlot();
        firsPlotFlag = !firsPlotFlag;
    } else if (togglePlotFlag && !firsPlotFlag) {
        // if togglePlotFlag is true, but not firstPlot means render
        // previously running data trace of plotly
        renderPreviousPlot();
    } else {
        // if togglePlotflag is false means render 3JS DOM
        renderThreeJSDOM();
    }
    togglePlotFlag = !togglePlotFlag;
});

refreshPlotButton.addEventListener("click", () => {
    stopUpdatePlotlyChart();
    renderNewPlot();
});

toggleDataStreamButton.addEventListener("click", () => {
    if (dataStreamFlag) {
        // uncomment here to change from pocketnc to data stream simu
        updatePlotlyChart();
        //extendTrace();
    } else {
        stopUpdatePlotlyChart();
    }
    dataStreamFlag = !dataStreamFlag;
});

function renderNewPlot() {
    renderOutput.innerHTML = "";
    let init_data = [{
        x: [0],
        y: [0],
        z: [0],
        mode: 'markers',
        marker: {
            size: 5,
            line: {
                color: 'rgba(0, 0, 255, 1)',
                width: 0.5
            },
            opacity: 0.8
        },
        type: 'scatter3d'
    }];
    
    let layout = {
        margin: {
            l: 1,
            r: 1,
            b: 1,
            t: 1
        }
    };
    globalDataTrace = init_data;
    globalPlotlyLayout = layout;
    plotly.newPlot("renderOutput", init_data, layout);
}

// render previous plot
function renderPreviousPlot() {
    renderOutput.innerHTML = "";
    plotly.newPlot("renderOutput", globalDataTrace, globalPlotlyLayout);
}

// this is for experimental update for the chart
function extendTrace() {
    toggleDataStateSpan.classList.add("greenDisplay");
    toggleDataStateSpan.classList.remove("redDisplay");
    toggleDataStateSpan.innerText = "STREAM ON";
    setIntervalObject = setInterval(() => {
        plotly.extendTraces("renderOutput", {
            x: [[Math.random() * 10]],
            y: [[Math.random() * 10]],
            z: [[Math.random() * 10]]
        }, [0]).then((res) => {
            console.log("extended trace: ");
            console.log(res);
        });
    }, 1000);
}

// periodically request xyz data from LCNC and then update plot
function updatePlotlyChart() {
    toggleDataStateSpan.classList.add("greenDisplay");
    toggleDataStateSpan.classList.remove("redDisplay");
    toggleDataStateSpan.innerText = "STREAM ON";
    setIntervalObject = setInterval(function () {
        httpRequestHandler(lcnc_status_url, null, "GET",
                           true, null,
                           null, true);
    }, 100);
}

function stopUpdatePlotlyChart() {
    toggleDataStateSpan.classList.remove("greenDisplay");
    toggleDataStateSpan.classList.add("redDisplay");
    toggleDataStateSpan.innerText = "STREAM OFF";
    clearInterval(setIntervalObject);
}

function renderThreeJSDOM() {
    renderOutput.innerHTML = "";
    renderOutput.appendChild(renderer.domElement);
}

//////////////////////////////////////////////////////////////////////
//// initialising stl loader
let stlLoader = new THREE.STLLoader();
let clickCounter = 0;
ddownList.addEventListener('click', function () {
    renderThreeJSDOM();
    clickCounter++;
    // using clickcounter to stop reload on first drop down roll
    // down
    if (ddownList.value !== "0" && clickCounter > 1) {
        // option value defaults to option text if not specified
        clickCounter = 0;
        stlLoader.load(localhost + "/get_stl_file/" + ddownList.value, function (geometry) {
            let mat = new THREE.MeshLambertMaterial({
                                                        color: 0xC0C0C0
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
            
            //lets create a table in the controlpanel
            let controlPanelTable = document.createElement('table');
            
            controlPanelForm.appendChild(controlPanelTable);
            
            // parse the stl json meta data to populate controls panel
            let cadMetaData = httpRequestHandler(cadMetaDataUrl + ddownList.value, null, 'GET');
            const cadJsonMetaData = JSON.parse(cadMetaData);
            
            // to show alphabetically ordered panels
            let dimArray = [];
            let cols = [];
            let tableRowElement = '';
            
            for (let dim in cadJsonMetaData) {
                dimArray.push(dim);
            }
            dimArray.sort();
            let dimArrayLength = dimArray.length;
            let dimArrayIterator = dimArray.entries();
            
            // change height of parent div acc to the number of
            // elements coming in
            let parentDivElement = document.getElementById('parent_div');
            if (dimArrayLength > 2) {
                let rowNum = Math.round(dimArrayLength / 2);
                let totalHeight = 128 * rowNum + 150;
                parentDivElement.style.height = totalHeight.toString() + 'px';
            }else {
                parentDivElement.style.height = '300px';
            }
            
            // lets iterate over elements and populate control panel
            for (let dim of dimArray) {
                let currentDimIndex = dimArrayIterator.next().value[0];
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
                //rangeControlElement.step = "1";
                let steps = (parseFloat(rangeControlElement.max)
                    - parseFloat(rangeControlElement.min)) / 100;
                rangeControlElement.step =
                    Math.round(steps * 100) / 100;
                rangeControlElement.setAttribute('value',
                                                 cadJsonMetaData[dim]["currentValue"]);
                
                labelForRangeControl.setAttribute('for', dim);
                labelForRangeControl.innerText = dim;
                
                // set attributes for the span element
                spanElement.setAttribute('id', 'spanFor' + dim);
                spanElement.innerText = rangeControlElement.value;
                
                // add all the elements to the DOM in the control
                // Panel
                let parElem1 = document.createElement("p");
                let parElem2 = document.createElement("p");
                //let handInputElement =
                // document.createElement('input');
                // handInputElement.type = 'text';
                // handInputElement.style.width = '40px';
                
                let tableCellElement = document.createElement('td');
                
                parElem1.appendChild(labelForRangeControl);
                parElem2.append(rangeControlElement, spanElement);
                //controlPanelForm.append(parElem1, parElem2);
                tableCellElement.append(parElem1, parElem2);
                cols.push(tableCellElement);
                
                if (cols.length === 1) {
                    let spacerTd = document.createElement('td');
                    spacerTd.style.width = '10px';
                    cols.push(spacerTd);
                }
                
                if (((currentDimIndex === dimArrayLength - 1) && (dimArrayLength % 2 !== 0)) ||
                    cols.length === 3) {
                    tableRowElement = document.createElement('tr');
                    tableRowElement.append(...cols);
                    controlPanelForm.appendChild(tableRowElement);
                    cols = [];
                }
                
                //
                // connect rangeControlElement to onchange
                // listeners for display change on the numeric
                // outputs
                rangeControlElement.addEventListener('change', () => {
                    // get the corresponding span element
                    let spanElement =
                        document.getElementById('spanFor' + dim);
                    spanElement.innerText = rangeControlElement.value;
                });
            }
            let submitElement = document.createElement('button');
            submitElement.type = "button";
            submitElement.innerText = "Update CAD";
            submitElement.classList.add("submitButton");
            // attach an event listener to the submit button =
            // Update CAD
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
                    flaskServerResponsePanel.innerText = "IDLE";
                }, 3000);
                clickCounter = 2; // make the counter >1 so that
                                  // stl reloads
                ddownList.click(); // fire a click event on the
                                   // ddwon list
            });
            controlPanelForm.appendChild(submitElement);
            
            // now add button for gcode export
            let submitElement2 = document.createElement('button');
            let spanElement2 = document.createElement('span');
            submitElement2.type = 'button';
            submitElement2.innerText = "POST ToolPath";
            submitElement2.classList.add("submitButton");
            
            //controlPanelForm.appendChild(spanElement2);
            controlPanelForm.appendChild(submitElement2);
            submitElement2.addEventListener('click', () => {
                console.log("sending req to lcnc");
                // g code generation takes long time. so
                // making this ajax call asynchronous
                
                // we need to also send the buttons to disable
                let buttonArray = [];
                buttonArray.push(submitElement, submitElement2);
                httpRequestHandler(
                    fusionFlaskServerLCNCUrl, null, 'GET',
                    true, flaskServerResponsePanel, buttonArray);
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


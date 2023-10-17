(function() {

  // function setActiveButton(buttonId) {
  //     // List of all tool button ids
  //     const buttonIds = ["eraseButton", "zoomInButton", "brushButton"];
  //
  //     // Remove the active class from all buttons
  //     buttonIds.forEach(id => {
  //         const button = document.getElementById(id);
  //         button.classList.remove("active");
  //     });
  //
  //     // Add the active class to the clicked button
  //     const activeButton = document.getElementById(buttonId);
  //     activeButton.classList.add("active");
  // }

  function setActiveButton(buttonId) {
      // Deactivate all tool buttons
      const toolButtons = document.querySelectorAll('.tool-button');
      toolButtons.forEach(button => {
          button.classList.remove('active');
      });

      // Activate the specified button
      const button = document.getElementById(buttonId);
      if (button) {
          button.classList.add('active');
      }
  }


  class Layer {
      constructor(id, name, order, z) {
          this.id = id;
          this.name = name;
          this.triangles = [];
          this.rectangles = [];
          this.order = order;
          this.z = z;
          this.sessionTriangles = [];
          this.poppedTriangles = [];
          this.temporaryTriangles = [];
          this.temporaryRectangle = []
          this.sessionRectangles = []
          this.movingTriangle = []
          this.selectedRectangle = null;
          this.trianglesToCopy = [];
      }
  }

  let layers = [
      new Layer(1, "Layer 1", 0, 0.1),
      new Layer(2, "Layer 2", 1, 0.2),
      new Layer(3, "Layer 3", 2, 0.3)
  ];


  // let layers = [
  //     new Layer(1, "Layer 1", 1, 0.1)
  // ];

  let currentLayer = layers[0];
  let layerss = []
  function handleLayerChange() {
      const layerSelector = document.getElementById('layerSelector');
      const selectedLayerId = layerSelector.value; // Assuming the value of each option is the layer's ID
      eraseRectangle();
      selectLayer(selectedLayerId);
  }

  function selectLayer(layerId) {
      // Convert the layerId to a number
      const numericLayerId = Number(layerId);

      currentLayer = layers.find(layer => layer.id === numericLayerId);

      if (!currentLayer) {
          console.error(`Layer with ID ${layerId} not found.`);
          return;
      }

      renderAllTriangles(); // Assuming this is your rendering function
  }

  function moveLayerDown() {
      // Check if the current layer is not already at the top
      if (currentLayer.order < layers.length - 1) {
          const aboveLayer = layers.find(l => l.order === currentLayer.order + 1);

          // Swap the order of the current layer and the layer above it
          if (aboveLayer) {
              currentLayer.order += 1;
              aboveLayer.order -= 1;

              // Swap the z-values of the two layers
              const tempZ = currentLayer.z;
              currentLayer.z = aboveLayer.z;
              aboveLayer.z = tempZ;

              // Adjust z-values of triangles in the affected layers
              currentLayer.triangles.forEach(triangle => triangle.vertices[2] = currentLayer.z);
              aboveLayer.triangles.forEach(triangle => triangle.vertices[2] = aboveLayer.z);

              populateLayerSelector();
              renderAllTriangles(); // Re-render all triangles after changing the order
          } else {
              console.error(`Layer with order ${currentLayer.order + 1} not found.`);
          }
      }
  }

  function moveLayerUp() {
      // Check if the current layer is not already at the bottom
      if (currentLayer.order > 0) {
          const belowLayer = layers.find(l => l.order === currentLayer.order - 1);

          // Swap the order of the current layer and the layer below it
          if (belowLayer) {
              currentLayer.order -= 1;
              belowLayer.order += 1;

              // Swap the z-values of the two layers
              const tempZ = currentLayer.z;
              currentLayer.z = belowLayer.z;
              belowLayer.z = tempZ;

              // Adjust z-values of triangles in the affected layers
              currentLayer.triangles.forEach(triangle => triangle.vertices[2] = currentLayer.z);
              belowLayer.triangles.forEach(triangle => triangle.vertices[2] = belowLayer.z);

              populateLayerSelector();
              renderAllTriangles(); // Re-render all triangles after changing the order
          } else {
              console.error(`Layer with order ${currentLayer.order - 1} not found.`);
          }
      }
  }

  function populateLayerSelector() {
      const layerSelector = document.getElementById('layerSelector');
      layerSelector.innerHTML = ''; // Clear existing options

      // Sort layers by order
      layers.sort((a, b) => a.order - b.order);

      layers.forEach(layer => {
          const option = document.createElement('option');
          option.value = layer.id;
          option.textContent = layer.name;
          if (layer === currentLayer) {
              option.selected = true;
          }
          layerSelector.appendChild(option);
      });
  }

  populateLayerSelector();

  // document.getElementById('layer1Button').addEventListener('click', () => {
  //     currentLayer = layers[0];
  // });
  // document.getElementById('layer2Button').addEventListener('click', () => {
  //     currentLayer = layers[1];
  // });
  // document.getElementById('layer3Button').addEventListener('click', () => {
  //     currentLayer = layers[2];
  // });

  let triangles = [];
  let drawingHistory = [];
  let lastX = null;
  let lastY = null;
  let temporaryTriangles = [];
  let sessionTriangles = [];
  let poppedTriangles = []
  let isErase= false;
  let isErase_2 = false;
  let panStartX = null;
  let panStartY = null;
  let isZoom = false;
  let isDragging =false;
  let startX, startY;
  let vertices_rect = [];
  let isRectSelection = false;
  let triggerSelection= false;
  let temporaryRectangle = []
  let sessionRectangles = []
  let movingTriangle = []
  let isMoving= false;
  let letsMove = false;
  let isCopy = false;
  const gridSize = 0.05;

  let panOffset = [0.0, 0.0];
  let zoomFactor = 1.0;
  var mvMatrix = mat4();

  mvMatrix = lookAt([0.0, 0.0, 1.0], [0.0, 0.0, 0.0], [0.0, 1.0, 0.0]);

  const canvas = document.getElementById('paintCanvas');

  function resizeCanvas() {
      // Set the canvas's internal resolution to match its display size
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
  }

  // Call the function once to set the initial size
  resizeCanvas();

  // Optionally, add an event listener to resize the canvas when the window is resized
  window.addEventListener('resize', resizeCanvas);


  const gl = canvas.getContext('webgl');
  const ctx = canvas.getContext('2d');
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);

  if (!gl) {
      alert('WebGL not supported!');
      return;
  }

  const vertexShaderSource = `
      attribute vec3 position; // Change vec2 to vec3
      uniform mat4 modelView;
      void main() {
          gl_Position = modelView * vec4(position, 1.0); // position already has 3 components now
      }
  `;


  const fragmentShaderSource = `
      precision mediump float;
      uniform vec4 color;

      void main() {
          gl_FragColor = color;
      }
  `;

  function compileShader(source, type) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          console.error('Shader compilation failed:', gl.getShaderInfoLog(shader));
          gl.deleteShader(shader);
          return null;
      }
      return shader;
  }

  const vertexShader = compileShader(vertexShaderSource, gl.VERTEX_SHADER);
  const fragmentShader = compileShader(fragmentShaderSource, gl.FRAGMENT_SHADER);

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);



  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program linking failed:', gl.getProgramInfoLog(program));
      return;
  }
  gl.useProgram(program);
  modelView = gl.getUniformLocation( program, "modelView" );

  projection = gl.getUniformLocation( program, "projection" );
  let isDrawing = false;


  function eraseRectangle() {
      // Clear the last rectangle from the sessionRectangles of the current layer
      for (const layer of layers){
          if (layer.sessionRectangles.length > 0) {
              layer.sessionRectangles.pop();
          }
      }


      // Redraw the canvas to reflect the changes
      renderAllTriangles();
  }

  let isSelecting = false;
  let selectStartPoint = null;
  let selectEndPoint = null;
  let currentRectangle = null;
  let rectStartPoint = null;

  function selectButtonHandler() {
      isSelecting = true;
      isCopying = false;
      isDrawing = false;
      isDragging = false;
      letsMove = false;
      triggerSelection = false;
      isMoving = false;
      isRectSelection = false;
      isErase = false;
      isErase_2 = false;
      currentLayer.sessionRectangles = [];
      setActiveButton('selectButton');
      renderAllTriangles();
      }
  function clearPreviousSelection() {
      if (currentLayer.sessionRectangles.length > 0) {
          currentLayer.sessionRectangles.pop();
      }
  }
  canvas.addEventListener('mousedown', (event) => {
      if (isSelecting) {
          clearPreviousSelection(); // Clear the previous selection

          const rect = canvas.getBoundingClientRect();
          const x = ((event.clientX - rect.left) / canvas.width) * 2 - 1;
          const y = ((event.clientY - rect.top) / canvas.height) * -2 + 1;
          selectStartPoint = { x, y };
          selectEndPoint = { x, y };
          // rectStartPoint = { x, y };
      }
  });
  canvas.addEventListener('mousemove', (event) => {
      if (isSelecting && selectStartPoint) {
          const rect = canvas.getBoundingClientRect();
          const x = ((event.clientX - rect.left) / canvas.width) * 2 - 1;
          const y = ((event.clientY - rect.top) / canvas.height) * -2 + 1;
          selectEndPoint = { x, y };
          renderAllTriangles(); // This will also render the selection rectangle
          drawRectangle(selectStartPoint.x, selectStartPoint.y, x, y, [1.0, 0.0, 0.0, 1.0]); // Red color
      }
  });
  canvas.addEventListener('mouseup', (event) => {
      if (isSelecting && selectStartPoint && selectEndPoint) {
          // Convert the start and end points to a rectangle representation
          currentRectangle = [
              selectStartPoint.x, selectStartPoint.y,
              selectEndPoint.x, selectStartPoint.y,
              selectEndPoint.x, selectEndPoint.y,
              selectStartPoint.x, selectEndPoint.y
          ];
          currentLayer.sessionRectangles.push(currentRectangle);
          currentLayer.selectedRectangle = currentRectangle;
          selectStartPoint = null;
          selectEndPoint = null;
          // isSelecting = false; // Reset the selecting mode
      }
  });

  function drawRectangle(x1, y1, x2, y2, color) {
      const rectangleVertices = new Float32Array([
          x1, y1,
          x2, y1,
          x2, y2,
          x1, y2
      ]);

      // Set the color
      gl.uniform4f(colorLocation, ...color);

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, rectangleVertices, gl.STATIC_DRAW);

      const position = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.LINE_LOOP, 0, 4);
  }

  let isCopying = false;
  let hasCopied = false;

  // function isTriangleInsideRectangle(triangle, rectangle) {
  //     // Derive the left, right, top, and bottom values from the rectangle array
  //     const left = Math.min(rectangle[0], rectangle[2], rectangle[4], rectangle[6]);
  //     const right = Math.max(rectangle[0], rectangle[2], rectangle[4], rectangle[6]);
  //     const top = Math.max(rectangle[1], rectangle[3], rectangle[5], rectangle[7]);
  //     const bottom = Math.min(rectangle[1], rectangle[3], rectangle[5], rectangle[7]);
  //     console.log("left")
  //     console.log(left)
  //     console.log("right")
  //     console.log(right)
  //     console.log("top")
  //     console.log(top)
  //     console.log("bottom")
  //     console.log(bottom)
  //
  //     for (let i = 0; i < triangle.vertices.length; i += 2) { // Increment by 2 to skip z coordinate
  //         const x = triangle.vertices[i];
  //         const y = triangle.vertices[i + 1];
  //         if (!(x >= left && x <= right && y >= bottom && y <= top)) {
  //             return false; // Return false if any vertex is outside the rectangle
  //         }
  //     }
  //     return true;
  // }

  function isTriangleInsideRectangle(triangle, rectangle) {
      // Check if all vertices of the triangle are inside the rectangle
      // console.log("triangle")
      // console.log(triangle)
      // console.log("rectangle")
      // console.log(rectangle)
      // Derive the left, right, top, and bottom values from the rectangle array
      const left = Math.min(rectangle[0], rectangle[2], rectangle[4], rectangle[6]);
      const right = Math.max(rectangle[0], rectangle[2], rectangle[4], rectangle[6]);
      const top = Math.max(rectangle[1], rectangle[3], rectangle[5], rectangle[7]);
      const bottom = Math.min(rectangle[1], rectangle[3], rectangle[5], rectangle[7]);
      // console.log("left")
      // console.log(left)
      // console.log("right")
      // console.log(right)
      // console.log("top")
      // console.log(top)
      // console.log("bottom")
      // console.log(bottom)

      for (let i = 0; i < triangle.vertices.length; i += 3) { // Increment by 2 to skip z coordinate
          const sx = triangle.vertices[i];
          const sy = triangle.vertices[i + 1];
          // console.log("x")
          // console.log(sx)
          // console.log("y")
          // console.log(sy)
          if (!(sx >= left && sx <= right && sy >= bottom && sy <= top)) {
              // console.log("false")
              return false; // Return false if any vertex is outside the rectangle
          }
      }
      // console.log("true")
      return true;
  }

  function copyRectangleArea() {
      setActiveButton("copyButton");
      isCopying = true;
      isSelecting = false;
      isDrawing = false;
      // selectedRectangle = null;

      // Iterate over each session and each triangle in that session
      for (let session of currentLayer.sessionTriangles) {
          for (let triangle of session) {
              if (isTriangleInsideRectangle(triangle, currentLayer.selectedRectangle)) {
                  currentLayer.trianglesToCopy.push(triangle);
              }
          }
      }
  }

  canvas.addEventListener('mousedown', function(event) {
      if (isCopying) {
          startX = event.clientX;
          startY = event.clientY;

          canvas.addEventListener('mousemove', handleCopyDrag);
          canvas.addEventListener('mouseup', finalizeCopy);
      }
  });

  function handleCopyDrag(event) {
      // Visualize the movement of the rectangle (you can use your existing code for this)
      // ...
  }


  function finalizeCopy(event) {
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;

      const normalizedOffsetX = (event.clientX - startX) / (canvasWidth / 2);
      const normalizedOffsetY = -(event.clientY - startY) / (canvasHeight / 2); // Negative because y-axis is inverted in WebGL

      let copiedTrianglesSession = []; // Temporary array to hold the copied triangles for this session

      for (let triangle of currentLayer.trianglesToCopy) {
          const newTriangle = {
              vertices: triangle.vertices.map((vertex, index) => {
                  if (index % 3 === 0) { // x-coordinate
                      return vertex + normalizedOffsetX;
                  } else if (index % 3 === 1) { // y-coordinate
                      return vertex + normalizedOffsetY;
                  } else {
                      return vertex; // z-coordinate remains unchanged
                  }
              }),
              color: triangle.color
          };

          currentLayer.triangles.push(newTriangle); // Add to the main triangles array
          copiedTrianglesSession.push(newTriangle); // Add to the temporary session array
      }

      // Push the session of copied triangles to currentLayer.sessionTriangles
      currentLayer.sessionTriangles.push(copiedTrianglesSession);
      currentLayer.trianglesToCopy = []; // Clear the temporary array
      isCopying = false; // End the copy mode
      canvas.removeEventListener('mousemove', handleCopyDrag);
      canvas.removeEventListener('mouseup', finalizeCopy);
      renderAllTriangles();
      continueDrawing();
  }

  canvas.addEventListener('mousedown', () => {

    // if(triggerSelection)
    if(isCopying)
	  {
		  // isRectSelection = true;
      isSelecting = false;
		  isDrawing = false;
		  isErase = false;
		  isErase_2 = false;
		  isZoom = false;
	  }
    else if(isSelecting)
	  {
		  // isRectSelection = true;
      isCopying = false;
		  isDrawing = false;
		  isErase = false;
		  isErase_2 = false;
		  isZoom = false;
	  }

	  else if(isZoom)
	  {
      isCopying = false;
		  isDrawing = false;
		  triggerSelection = false;
		  isRectSelection = false;
		  isDrawing = false;
		  isErase = false;
		  isErase_2 = false;
		  isRectSelection = false;
	  }
	  else
	  {
		  if(isErase_2 === true){
        isCopying = false;
  		  isDrawing = false;
			  triggerSelection = false;
			  isRectSelection = false;
			  isErase = true;
			  isDrawing = false;

		  }
		  else{
        isCopying = false;
  		  isDrawing = false;
			  triggerSelection = false;
			  isRectSelection = false;
			  isDrawing = true;
			  isErase = false;
			  isErase_2 = false;
		  }
	  }
	  currentLayer.temporaryTriangles = []

  });

  canvas.addEventListener('mouseup', () => {
  	  // triggerSelection = false;
  	  isRectSelection = false;
      isDrawing = false;
  	  isErase = false;
  	  // isErase_2 = false;
      lastX = null;
      lastY = null;
	  // currentLayer.sessionRectangles.push([...currentLayer.temporaryRectangle]);
	  // console.log(currentLayer.sessionRectangles);

	  currentLayer.sessionTriangles.push([...currentLayer.temporaryTriangles]);
    currentLayer.temporaryTriangles = [];
	  currentLayer.temporaryRectangle = [];

      renderAllTriangles();
  });
  canvas.addEventListener('wheel', (event) => {
	if (!isZoom) return;
    const zoomDelta = event.deltaY / 100;
    const zoomIncrement = 0.1;

    // Adjust the zoom factor based on the wheel movement
    zoomFactor += zoomDelta * zoomIncrement* -1;

    // Ensure zoomFactor is within valid limits
    //zoomFactor = Math.max(0.1, zoomFactor);
	//zoomFactor = zoomFactor * 1.1
    // Calculate the change in panOffset based on the zoom level
    //const panOffsetChange = [(canvas.width / 2) * (zoomFactor - 1),(canvas.height / 2) * (zoomFactor - 1)];

    // Update the panOffset accordingly
    //panOffset[0] += panOffsetChange[0];
    //panOffset[1] += panOffsetChange[1];

    // Update the view matrix with the new zoom factor and panOffset
    updateViewMatrix(zoomFactor, panOffset);

    // Render the triangles with the updated view matrix
    renderAllTriangles();
});

  function handleMouseDown(event) {

    startX = event.clientX;
	  startY = event.clientY;
	  if(isMoving)
	  {
		  letsMove=true;
		  isDragging= true;
	  }
	   if(!isZoom && isRectSelection && !isMoving)
	  {
		  currentLayer.sessionRectangles = []
		  isMoving = true;
		  isDrawing = false;
		  isDragging = false;
	  }

	  if (!isZoom && !isRectSelection) return;

	  /*if(!isZoom && isRectSelection && isMoving)
	  {
		  letsMove= true;
		  isDragging = true;
	  }
	  */
	  else isDragging = true;


	}

	function handleMouseUp() {
		if(isRectSelection && !letsMove)
		{
			isRectSelection=false;
			letsMove = true;
		}
		if(letsMove && isDragging)
		{
			isCopy = false;
			isDragging = false;
			letsMove=false;
		}
		if (!isZoom) return;
		letsMove = false;
		isDragging = false;
		isMoving =false;
	}

	function handleMouseMove(event) {
		if (isZoom && !letsMove){

			if (isDragging) {
				const rect = canvas.getBoundingClientRect();
				const rectCenterX = (rect.left + rect.right) / 2;
				const rectCenterY = (rect.top + rect.bottom) / 2;
				const x = ((event.clientX  - rectCenterX) / canvas.width) * 2 - 1;
				const y = ((event.clientY - rectCenterY) / canvas.height) * -2 + 1;

				const relativeX = (x + 1) *0.008; //snappedX;
				const relativeY = (y - 1)  *0.008//snappedYX;
				const minPanOffset = -100;
				const maxPanOffset = 100;



				panOffset[0] += relativeX
				panOffset[1] += relativeY
				panOffset[0] = Math.max(minPanOffset, Math.min(maxPanOffset, panOffset[0]));
				panOffset[1] = Math.max(minPanOffset, Math.min(maxPanOffset, panOffset[1]));

				updateViewMatrix(zoomFactor, panOffset);

				renderAllTriangles();
			  }
		}
		if(letsMove)
		{
			if (isDragging && isCopy)
			{
				const rect = canvas.getBoundingClientRect();
				const rectCenterX = (rect.left + rect.right) / 2;
				const rectCenterY = (rect.top + rect.bottom) / 2;
				const x = ((event.clientX  - rectCenterX) / canvas.width) * 2 - 1;
				const y = ((event.clientY - rectCenterY) / canvas.height) * -2 + 1;

				const relativeX = (x + 1)* 0.02 //snappedX;
				const relativeY = (y - 1)* 0.02//snappedYX;
				let tmpTriangles = []

				for (const triangle of currentLayer.sessionTriangles[currentLayer.sessionTriangles.length -1])
				{

					triangle.vertices[0] += relativeX;
					triangle.vertices[1] += relativeY;
					triangle.vertices[2] += relativeX;
					triangle.vertices[3] += relativeY;
					triangle.vertices[4] += relativeX;
					triangle.vertices[5] += relativeY;

					//renderAllTriangles();
				}
				//temporaryTriangles.push([...tmpTriangles]);
				//const session of sessionTriangles
				// console.log(currentLayer.sessionRectangles)
				for (const rectangle of currentLayer.sessionRectangles) {
					for (let i = 0; i < rectangle.length; i++)
					{
						//const rectangle_tmp = sessionRectangles[i];
						rectangle[i][0] += relativeX;
						rectangle[i][1] += relativeY;
						rectangle[i][2] += relativeX;
						rectangle[i][3] += relativeY;
						rectangle[i][4] += relativeX;
						rectangle[i][5] += relativeY;
						rectangle[i][6] += relativeX;
						rectangle[i][7] += relativeY;
						rectangle[i][8] += relativeX;
						rectangle[i][9] += relativeY;
						rectangle[i][10] += relativeX;
						rectangle[i][11] += relativeY;
						rectangle[i][12] += relativeX;
						rectangle[i][13] += relativeY;
						rectangle[i][14] += relativeX;
						rectangle[i][15] += relativeY;
					}
				}
				renderAllTriangles();
			}
			else if (isDragging && !isCopy)
			{

				//console.log("still here")
				//const deltaX = event.clientX - startX;
				//const deltaY = event.clientY - startY;
				const rect = canvas.getBoundingClientRect();
				const rectCenterX = (rect.left + rect.right) / 2;
				const rectCenterY = (rect.top + rect.bottom) / 2;
				const x = ((event.clientX  - rectCenterX) / canvas.width) * 2 - 1;
				const y = ((event.clientY - rectCenterY) / canvas.height) * -2 + 1;

				const relativeX = (x + 1)* 0.02 //snappedX;
				const relativeY = (y - 1)* 0.02//snappedYX;
				for (let i = 0; i < currentLayer.movingTriangle.length; i++)
				{

					//const triangle_tmp = session[i];
					currentLayer.sessionTriangles[currentLayer.movingTriangle[i][0]][currentLayer.movingTriangle[i][1]].vertices[0] += relativeX;
					currentLayer.sessionTriangles[currentLayer.movingTriangle[i][0]][currentLayer.movingTriangle[i][1]].vertices[1] += relativeY;
					currentLayer.sessionTriangles[currentLayer.movingTriangle[i][0]][currentLayer.movingTriangle[i][1]].vertices[2] += relativeX;
					currentLayer.sessionTriangles[currentLayer.movingTriangle[i][0]][currentLayer.movingTriangle[i][1]].vertices[3] += relativeY;
					currentLayer.sessionTriangles[currentLayer.movingTriangle[i][0]][currentLayer.movingTriangle[i][1]].vertices[4] += relativeX;
					currentLayer.sessionTriangles[currentLayer.movingTriangle[i][0]][currentLayer.movingTriangle[i][1]].vertices[5] += relativeY;
				}
				//const session of sessionTriangles

				for (const rectangle of currentLayer.sessionRectangles) {
					for (let i = 0; i < rectangle.length; i++)
					{
						//const rectangle_tmp = sessionRectangles[i];
						rectangle[i][0] += relativeX;
						rectangle[i][1] += relativeY;
						rectangle[i][2] += relativeX;
						rectangle[i][3] += relativeY;
						rectangle[i][4] += relativeX;
						rectangle[i][5] += relativeY;
						rectangle[i][6] += relativeX;
						rectangle[i][7] += relativeY;
						rectangle[i][8] += relativeX;
						rectangle[i][9] += relativeY;
						rectangle[i][10] += relativeX;
						rectangle[i][11] += relativeY;
						rectangle[i][12] += relativeX;
						rectangle[i][13] += relativeY;
						rectangle[i][14] += relativeX;
						rectangle[i][15] += relativeY;
					}
				}
				renderAllTriangles();
			}

			}

	}
	canvas.addEventListener('mouseleave', (event) => {
	  isDragging = false;

	  const mouseUpEvent = new MouseEvent('mouseup');
	  document.dispatchEvent(mouseUpEvent);
	});

  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('mouseup', handleMouseUp);
  canvas.addEventListener('mousemove', handleMouseMove);

  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mousemove', erase);
  canvas.addEventListener('mousemove', drawRect);

   function isPointInRectangle(x, y, rectX, rectY, rectWidth, rectHeight) {
	  return (
		x >= rectX &&
		x <= rectX + rectWidth &&
		y <= rectY &&
		y >= rectY + rectHeight
	  );

	}

  function drawRect(event) {
      if (!isRectSelection || letsMove) return;
      currentLayer.temporaryRectangle = [];
      const currentX = event.clientX;
      const currentY = event.clientY;
      const rect = canvas.getBoundingClientRect();

      const startXNormalized = (startX - rect.left) / canvas.width * 2 - 1;
      const startYNormalized = -((startY - rect.top) / canvas.height) * 2 + 1;
      const currentXNormalized = (currentX - rect.left) / canvas.width * 2 - 1;
      const currentYNormalized = -((currentY - rect.top) / canvas.height) * 2 + 1;

      const snappedX = Math.floor(startXNormalized / gridSize) * gridSize;
      const snappedY = Math.floor(startYNormalized / gridSize) * gridSize;
      const currentSnappedX = Math.floor(currentXNormalized / gridSize) * gridSize;
      const currentSnappedY = Math.floor(currentYNormalized / gridSize) * gridSize;

      const vertices_rect = new Float32Array([
          startXNormalized, startYNormalized,
          currentXNormalized, startYNormalized,
          currentXNormalized, currentYNormalized,
          startXNormalized, currentYNormalized,
          startXNormalized, startYNormalized
      ]);

      currentLayer.movingTriangle = [];
      for (let sessionIndex = 0; sessionIndex < currentLayer.sessionTriangles.length; sessionIndex++) {
          const session = currentLayer.sessionTriangles[sessionIndex];
          for (let i = 0; i < session.length; i++) {
              const [x1, y1, x2, y2, x3, y3] = session[i].vertices;
              if (
                  isPointInRectangle(x1, y1, snappedX, snappedY, currentSnappedX - snappedX, currentSnappedY - snappedY) ||
                  isPointInRectangle(x2, y2, snappedX, snappedY, currentSnappedX - snappedX, currentSnappedY - snappedY) ||
                  isPointInRectangle(x3, y3, snappedX, snappedY, currentSnappedX - snappedX, currentSnappedY - snappedY)
              ) {
                  let tmp_index = [sessionIndex, i];
                  currentLayer.movingTriangle.push(tmp_index);
              }
          }
      }

      currentLayer.temporaryRectangle.push(vertices_rect);
      renderAllTriangles();
  }

  function draw(event) {
      if (!isDrawing) return;

      const rect = canvas.getBoundingClientRect();

      const x = ((event.clientX - rect.left) / canvas.width) * 2 - 1;
      const y = ((event.clientY - rect.top) / canvas.height) * -2 + 1;

      const snappedX = Math.floor(x / gridSize) * gridSize;
      const snappedY = Math.floor(y / gridSize) * gridSize;

      const relativeX = x - snappedX;
      const relativeY = y - snappedY;

      let triangleVertices;

      if (relativeX + relativeY < gridSize) {
          if (relativeX > relativeY) {
              // Bottom-right triangle
              triangleVertices = [
                  snappedX + gridSize, snappedY, currentLayer.z,
                  snappedX, snappedY, currentLayer.z,
                  snappedX + gridSize, snappedY + gridSize, currentLayer.z
              ];
          } else {
              // Top-left triangle
              triangleVertices = [
                  snappedX, snappedY + gridSize, currentLayer.z,
                  snappedX, snappedY, currentLayer.z,
                  snappedX + gridSize, snappedY + gridSize, currentLayer.z
              ];
          }
      } else {
          if (relativeX > relativeY) {
              // Top-right triangle
              triangleVertices = [
                  snappedX + gridSize, snappedY + gridSize, currentLayer.z,
                  snappedX, snappedY + gridSize, currentLayer.z,
                  snappedX + gridSize, snappedY, currentLayer.z
              ];
          } else {
              // Bottom-left triangle
              triangleVertices = [
                  snappedX, snappedY, currentLayer.z,
                  snappedX + gridSize, snappedY, currentLayer.z,
                  snappedX, snappedY + gridSize, currentLayer.z
              ];
          }
      }

      const triangleData = {
          vertices: new Float32Array(triangleVertices),
          color: [...currentColor]
      };

      currentLayer.triangles.push(triangleData);
      currentLayer.temporaryTriangles.push(triangleData);

      renderAllTriangles();
  }

  function erase(event) {
      // console.log(isErase);
      if (!isErase) return;

      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / canvas.width) * 2 - 1;
      const y = ((event.clientY - rect.top) / canvas.height) * -2 + 1;

      const snappedX = Math.floor(x / gridSize) * gridSize;
      const snappedY = Math.floor(y / gridSize) * gridSize;

      const relativeX = x - snappedX;
      const relativeY = y - snappedY;

      let triangleVertices;

      if (relativeX + relativeY < gridSize) {
          if (relativeX > relativeY) {
              // Bottom-right triangle
              triangleVertices = new Float32Array([
                  snappedX + gridSize, snappedY,
                  snappedX, snappedY,
                  snappedX + gridSize, snappedY + gridSize,
              ]);
          } else {
              // Top-left triangle
              triangleVertices = new Float32Array([
                  snappedX, snappedY + gridSize,
                  snappedX, snappedY,
                  snappedX + gridSize, snappedY + gridSize,
              ]);
          }
      } else {
          if (relativeX > relativeY) {
              // Top-right triangle
              triangleVertices = new Float32Array([
                  snappedX + gridSize, snappedY + gridSize,
                  snappedX, snappedY + gridSize,
                  snappedX + gridSize, snappedY,
              ]);
          } else {
              // Bottom-left triangle
              triangleVertices = new Float32Array([
                  snappedX, snappedY,
                  snappedX + gridSize, snappedY,
                  snappedX, snappedY + gridSize
              ]);
          }
      }
      function verticesEqualityCheck(vertices1, vertices2) {
          // console.log('vertices1')
          // console.log(vertices1)
          // console.log('vertices2')
          // console.log(vertices2)
          const epsilon = 0.00001; // A small threshold value

          if (vertices1.length !== vertices2.length) {
              return false;
          }

          for (let i = 0; i < vertices1.length; i++) {
              if (Math.abs(vertices1[i] - vertices2[i]) > epsilon) {
                  return false;
              }
          }
          return true;
      }


      function removeTriangle(triangleVertices) {
          // Loop through the triangles in the current layer
          for (let i = currentLayer.triangles.length - 1; i >= 0; i--) {
              const triangleVertices_tmp = currentLayer.triangles[i].vertices;
              const triangleVertices_tmp_2D = triangleVertices_tmp.filter((_, index) => index % 3 !== 2);
              // console.log(verticesEqualityCheck(triangleVertices_tmp, triangleVertices));
              if(verticesEqualityCheck(triangleVertices_tmp_2D, triangleVertices)){
                  // Remove the triangle from the current layer
                  currentLayer.triangles.splice(i, 1);
                  // console.log(`Triangle removed from layer ${currentLayer.name}`);
                  break;
              }
          }
      }
      // console.log(`Trying to erase triangle with vertices:`, triangleVertices);
      // console.log(`Current layer: ${currentLayer.name}`);

      removeTriangle(triangleVertices);
      currentLayer.temporaryTriangles = [];

      renderAllTriangles();
    }
    function areTrianglesEqual(triangle1, triangle2) {
        for (let i = 0; i < triangle1.vertices.length; i++) {
            // Use a small epsilon value to account for floating point precision issues
            if (Math.abs(triangle1.vertices[i] - triangle2.vertices[i]) > 0.00001) {
                return false;
            }
        }
        return true;
    }

    function undo() {
        while (currentLayer.sessionTriangles.length > 0) {
            // Pop the last session array
            const lastSession = currentLayer.sessionTriangles.pop();
            currentLayer.poppedTriangles.push(lastSession);

            if (lastSession.length > 0) { // Check if the session is non-empty
                // Iterate over each triangle in the last session and remove it from currentLayer.triangles
                for (const tmpTriangle of lastSession) {
                    const index = currentLayer.triangles.findIndex(triangle =>
                        areTrianglesEqual(triangle, tmpTriangle)
                    );
                    if (index > -1) {
                        currentLayer.triangles.splice(index, 1);
                    }
                }
                renderAllTriangles();
                break; // Exit the loop once a non-empty session is processed
            }
        }
    }

    function redo() {
        while (currentLayer.poppedTriangles.length > 0) {
            // Pop the last session array from poppedTriangles
            const lastPoppedSession = currentLayer.poppedTriangles.pop();
            currentLayer.sessionTriangles.push(lastPoppedSession);

            if (lastPoppedSession.length > 0) { // Check if the session is non-empty
                // Iterate over each triangle in the last popped session and add it back to currentLayer.triangles
                for (const tmpTriangle of lastPoppedSession) {
                    currentLayer.triangles.push(tmpTriangle);
                }
                renderAllTriangles();
                break; // Exit the loop once a non-empty session is processed
            }
        }
    }

  function renderAllTriangles() {
      // Clear the canvas before drawing
      gl.clearColor(1.0, 1.0, 1.0, 1.0); // Set clear color to white
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniformMatrix4fv(modelView, false, flatten(mvMatrix));
  	  // console.log(layers)
      const position = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(position);
  	  let indexes = 0;
      for (const layer of layers) {
          const zCoord = layer.z;

          // Render triangles in the layer
          for (let triangle of layer.triangles) {

              let adjustedVertices = [];

              for (let i = 0; i < triangle.vertices.length; i += 3) {
                  adjustedVertices.push(triangle.vertices[i], triangle.vertices[i + 1], zCoord);
              }
              // Set the color uniform for the current triangle
              gl.uniform4f(colorLocation, ...triangle.color);

              const buffer = gl.createBuffer();
              gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
              gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(adjustedVertices), gl.STATIC_DRAW);
              gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 0, 0);

              gl.drawArrays(gl.TRIANGLES, 0, adjustedVertices.length / 3);
          }
          // Render Rectangeles
          // Draw the selected rectangle (if any)
          if (currentLayer.sessionRectangles.length > 0) {
              const rectangle = currentLayer.sessionRectangles[currentLayer.sessionRectangles.length - 1]; // Get the last rectangle

              const colorUniform = gl.getUniformLocation(program, 'u_color');
              const colorRed = [1.0, 0.0, 0.0, 1.0];  // Red color
              gl.uniform4fv(colorUniform, colorRed);

              const buffer = gl.createBuffer();
              gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
              gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(rectangle), gl.STATIC_DRAW);

              const position = gl.getAttribLocation(program, 'position');
              gl.enableVertexAttribArray(position);
              gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

              gl.drawArrays(gl.LINE_LOOP, 0, 4); // Use LINE_LOOP to draw the rectangle's outline
              }
        }
  }

  let currentColor = [0.0, 0.0, 1.0, 1.0]; // Default to red

  const colorLocation = gl.getUniformLocation(program, 'color');
  gl.uniform4f(colorLocation, 0.0, 0.0, 1.0, 1.0); // Red color

  let currentColorButton = document.querySelector('.color-button.blue'); // To keep track of the currently active color button

  function changeColor(color) {
      currentColor = color;

      if (currentColorButton) {
          currentColorButton.classList.remove('active');
      }

      const clickedColorButton = event.currentTarget;

      clickedColorButton.classList.add('active');

      currentColorButton = clickedColorButton;
  }

  function eraseTrigger() {
      isErase_2 = true;
  }
  function changeDimension(zoomFactors) {


	  const matrix = [[0.0, 0.0, 0.0, 0.0],
				[0.0, 0.0, 0.0, 0.0],
				[0.0, 0.0, 0.0, 0.0],
				[0.0, 0.0, 0.0, 1.0]];

	  matrix[0][0] = zoomFactors[0];
	  matrix[1][1] = zoomFactors[1];
	  matrix[2][2] = zoomFactors[2];

	  return matrix;
	}

  function updateViewMatrix(zoomFactor, panOffset) {

	mvMatrix = mat4();

	let aa = scale(zoomFactor, [1.0, 1.0, 1.0])


	let aaa = changeDimension(aa);
	mvMatrix = mult_2( mvMatrix, aaa);

	let bb = translate( panOffset[0], panOffset[1], 0 );

	mvMatrix = mult_2(mvMatrix, bb);

	renderAllTriangles();

  }
  function zoomTrigger() {

	isZoom = true;

  }
  function rectSelector() {

	triggerSelection = true;

  }
  function copy() {

	isCopy = true;
	doCopy();
  }
  function continueDrawing() {
      isCopying = false;
      isSelecting = false;
      isDragging = false;
      letsMove = false;
      triggerSelection = false;
      isMoving = false;
      isRectSelection = false;
      isErase = false;
      isErase_2 = false;
      eraseRectangle();
      // currentLayer.sessionRectangles = [];
      setActiveButton('brushButton');
      renderAllTriangles();
  }

  function zoomTriggerOff() {
      continueDrawing()
    	isZoom = false;
    	let panOffset = [0.0, 0.0];
    	let zoomFactor = 1.0;
    	var mvMatrix = mat4();

    	vMatrix = lookAt([0.0, 0.0, 1.0], [0.0, 0.0, 0.0], [0.0, 1.0, 0.0]);
    	updateViewMatrix(zoomFactor,panOffset)
        renderAllTriangles();
      }
  function doCopy() {
    console.log('doCopuy()')
    	if(currentLayer.movingTriangle.length === 0) return;
    	let tmpTriangles = []
    	for (let i = 0; i < currentLayer.movingTriangle.length; i++)
    	{
    		const copiedVertices = new Float32Array(currentLayer.sessionTriangles[currentLayer.movingTriangle[i][0]][currentLayer.movingTriangle[i][1]].vertices.length);
    		for (let j = 0; j < copiedVertices.length; j++) {
    			copiedVertices[j] = currentLayer.sessionTriangles[currentLayer.movingTriangle[i][0]][currentLayer.movingTriangle[i][1]].vertices[j];
    		  }

    		currentLayer.temporaryTriangles.push({
    			vertices: copiedVertices,
    			color: [...currentColor]
    		  });
	      }
    	currentLayer.sessionTriangles.push([...currentLayer.temporaryTriangles]);
      }
  function saveToFile(data, fileName) {
	  const json = JSON.stringify(data);  // Convert the objects to a JSON string
	  const blob = new Blob([json], { type: 'application/json' });  // Specify the MIME type as application/json
	  const link = document.createElement('a');
	  link.href = window.URL.createObjectURL(blob);
	  link.download = fileName + '.json';  // Add .json extension to the file
	  document.body.appendChild(link);
	  link.click();
	  document.body.removeChild(link);
	  console.log(data)
	}


	function save() {
		  saveToFile(layers, 'vertices');  // Save the objects as a JSON file
		}

	  function load() {
	  const input = document.createElement('input');
	  input.type = 'file';
	  input.accept = '.txt, .json'; // Allow both .txt and .json files
	  input.addEventListener('change', handleFileSelect);
	  input.click();
	}

	function handleFileSelect(event) {
	  const file = event.target.files[0];

	  if (file) {
		const reader = new FileReader();

		reader.onload = function (e) {
		  const contents = e.target.result;
		  // console.log('File contents:', contents);
		  // Process the loaded data (replace with your specific logic)
		  processLoadedData(contents);
		};

		reader.readAsText(file);
	  }
	}

	function processLoadedData(data) {

	  try {
		const parsedData = JSON.parse(data);
		// console.log('Processed data:', parsedData);

		if (Array.isArray(parsedData)) {
		  for (let j = 0; j < parsedData.length; j++)
		  {

			  layer_tmp = new Layer(1, "Layer 1", 0, 0.1)

			  layer_tmp.id = parsedData[j]['id'];
			  layer_tmp.name = parsedData[j]['name'];
			  layer_tmp.order = parsedData[j]['order'];
			  layer_tmp.z = parsedData[j]['order'];


			  triangles = []
			  for (let k = 0; k < parsedData[j]['triangles'].length; k++)
			  {
				  tmp_triangle = parsedData[j]['triangles'][k]

				  const dataArray = Object.values(tmp_triangle.vertices);

				  const a = new Float32Array(dataArray);


				  const tri = {
					  vertices: new Float32Array(a),
					  color: [...tmp_triangle.color]
				  };
				  // console.log("asasa: ", tri.vertices)
				  triangles.push(tri)
				  // console.log(tri)

			  }

			  layer_tmp.triangles = triangles;
			  rectangles = []
			  for (let k = 0; k < parsedData[j]['rectangles'].length; k++)
			  {

				  rectangles.push(parsedData[j]['rectangles'][k])
			  }
			  layer_tmp.rectangles = rectangles;

			  sessionTriangles = []
			  for (let k = 0; k < parsedData[j]['sessionTriangles'].length; k++)
			  {
				  sessionTriangles.push(parsedData[j]['sessionTriangles'][k])
			  }
			  layer_tmp.sessionTriangles = sessionTriangles;


			  poppedTriangles = []
			  for (let k = 0; k < parsedData[j]['poppedTriangles'].length; k++)
			  {
				  poppedTriangles.push(parsedData[j]['poppedTriangles'][k])
			  }
			  layer_tmp.poppedTriangles = poppedTriangles;

			  temporaryTriangles = []
			  for (let k = 0; k < parsedData[j]['temporaryTriangles'].length; k++)
			  {
				  temporaryTriangles.push(parsedData[j]['temporaryTriangles'][k])
			  }
			  layer_tmp.temporaryTriangles = temporaryTriangles;

			  temporaryRectangle = []
			  for (let k = 0; k < parsedData[j]['temporaryRectangle'].length; k++)
			  {
				  temporaryRectangle.push(parsedData[j]['temporaryRectangle'][k])
			  }
			  layer_tmp.temporaryRectangle = temporaryRectangle;

			  sessionRectangles = []
			  for (let k = 0; k < parsedData[j]['sessionRectangles'].length; k++)
			  {
				  sessionRectangles.push(parsedData[j]['sessionRectangles'][k])
			  }
			  layer_tmp.sessionRectangles = sessionRectangles;

			  movingTriangle = []
			  for (let k = 0; k < parsedData[j]['movingTriangle'].length; k++)
			  {
				  movingTriangle.push(parsedData[j]['movingTriangle'][k])
			  }
			  layer_tmp.movingTriangle = movingTriangle;

			  layers.push(layer_tmp)
		  }
		}
		else{
			// console.log("Error!")
		}


		renderAllTriangles();
	  } catch (error) {
		console.error('Error parsing JSON:', error);

	  }
	}

  window.copyRectangleArea = copyRectangleArea;
  window.selectButtonHandler = selectButtonHandler;
  window.load = load;
  window.save = save;
  window.copy = copy;
  window.continueDrawing = continueDrawing;
  window.rectSelector = rectSelector;
  window.zoomTriggerOff = zoomTriggerOff;
  window.zoomTrigger = zoomTrigger;
  window.eraseTrigger = eraseTrigger;
  window.redo = redo;
  window.undo = undo;
  window.changeColor = changeColor;
  window.moveLayerUp = moveLayerUp;
  window.moveLayerDown = moveLayerDown;
  window.selectLayer = selectLayer;
  window.handleLayerChange = handleLayerChange;
  window.setActiveButton = setActiveButton
})();

(function() {
  let triangles = [];
  let drawingHistory = [];
  let lastX = null;
  let lastY = null;
  let useInterpolation = true; // By default, interpolation is enabled
  let temporaryTriangles = [];  
  let sessionTriangles = [];
  let poppedTriangles = []
  let isErase= false;
  let isErase_2 = false;
  let panStartX = null;
  let panStartY = null;
  let isZoom = false;
  let isDragging =false;
  const gridSize = 0.05; // This will create a grid where each cell is 0.05 units in size.
  
  let panOffset = [0.0, 0.0];
  let zoomFactor = 1.0;
  var mvMatrix = mat4();

  mvMatrix = lookAt([0.0, 0.0, 1.0], [0.0, 0.0, 0.0], [0.0, 1.0, 0.0]);
 
  
  const canvas = document.getElementById('paintCanvas');
  const gl = canvas.getContext('webgl');
  const ctx = canvas.getContext('2d');
  
  
  
  
  if (!gl) {
      alert('WebGL not supported!');
      return;
  }
  
  const vertexShaderSource = `
      attribute vec2 position;
	  uniform mat4 modelView;
      void main() {
          gl_Position = modelView *vec4(position, 0.0, 1.0);
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
  
  canvas.addEventListener('mousedown', () => {
	  if(isZoom)
	  {
		  isDrawing = false;
		  isErase = false;
		  isErase_2 = false;
	  }
	  else
	  {
		  if(isErase_2 === true){
			  isErase = true;
			  isDrawing = false;
		  }
		  else{
			  isDrawing = true;
			  isErase = false;
			  isErase_2 = false;
		  }
	  }
	  temporaryTriangles = []
  });

  canvas.addEventListener('mouseup', () => {
      isDrawing = false;
	  isErase = false;
	  isErase_2 = false;
      lastX = null;
      lastY = null;
	  
	  sessionTriangles.push([...temporaryTriangles]);
      temporaryTriangles = [];
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
	  if (!isZoom) return;
		isDragging = true;
		
	}

	function handleMouseUp() {
		if (!isZoom) return;
		isDragging = false;
	}

	function handleMouseMove(event) {
		if (!isZoom) return;
		if (isDragging) {
			const rect = canvas.getBoundingClientRect();
			const rectCenterX = (rect.left + rect.right) / 2;
			const rectCenterY = (rect.top + rect.bottom) / 2;
			const x = ((event.clientX  - rectCenterX) / canvas.width) * 2 - 1;
			const y = ((event.clientY - rectCenterY) / canvas.height) * -2 + 1;
			 
		    const relativeX = (x + 1)*0.008; //snappedX;
		    const relativeY = (y - 1)* 0.008 //snappedYX;
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
  
  
  function draw(event) {
      if (!isDrawing) return;

      const rect = canvas.getBoundingClientRect();
	  
	  //const x = ((event.clientX - canvas.offsetLeft - panOffset[0]) / zoomFactor - rect.left) / (canvas.width / zoomFactor) * 2 - 1;
      //const y = -(((event.clientY - canvas.offsetTop - panOffset[1]) / zoomFactor - rect.top) / (canvas.height / zoomFactor) * 2 - 1);
	  //const adjustedMouseX = (event.clientX - rect.left - panOffset[0]) / zoomFactor;
      //const adjustedMouseY = (event.clientY - rect.top  - panOffset[1]) / zoomFactor;
	  
	
	  
      const x = ((event.clientX  - rect.left) / canvas.width) * 2 - 1;
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
                  snappedX + gridSize, snappedY + gridSize
              ]);
          } else {
              // Top-left triangle
              triangleVertices = new Float32Array([
                  snappedX, snappedY + gridSize,
                  snappedX, snappedY,
                  snappedX + gridSize, snappedY + gridSize
              ]);
          }
      } else {
          if (relativeX > relativeY) {
              // Top-right triangle
              triangleVertices = new Float32Array([
                  snappedX + gridSize, snappedY + gridSize,
                  snappedX, snappedY + gridSize,
                  snappedX + gridSize, snappedY
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
	  
      triangles.push({
        vertices: triangleVertices,
        color: [...currentColor]
      });
	  
	  temporaryTriangles.push({
        vertices: triangleVertices,
        color: [...currentColor]
      });
	  renderAllTriangles();  
      
  }
  function erase(event) {
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
                  snappedX + gridSize, snappedY + gridSize
              ]);
          } else {
              // Top-left triangle
              triangleVertices = new Float32Array([
                  snappedX, snappedY + gridSize,
                  snappedX, snappedY,
                  snappedX + gridSize, snappedY + gridSize
              ]);
          }
      } else {
          if (relativeX > relativeY) {
              // Top-right triangle
              triangleVertices = new Float32Array([
                  snappedX + gridSize, snappedY + gridSize,
                  snappedX, snappedY + gridSize,
                  snappedX + gridSize, snappedY
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
		  if (vertices1.length !== vertices2.length) 
			  return false;
		  for (let i = 0; i < vertices1.length; i++) {
			if (vertices1[i] !== vertices2[i]) 
				return false;
		  }
		  return true;
	  }

	  function removeTriangle(triangleVertices) {
		  for (const session of sessionTriangles) {
			  for (let i = session.length - 1; i >= 0; i--) {
				  const triangleVertices_tmp = session[i].vertices;
				  if(verticesEqualityCheck(triangleVertices_tmp,triangleVertices)){
					  session.splice(i, 1); 
					break; 
				  }
			  }
		  }
		}
	  removeTriangle(triangleVertices)
      temporaryTriangles =[]
	 
	  renderAllTriangles();  
      
  }
  function bresenhamLine(x1, y1, x2, y2) {
      x1 = Math.floor(x1 / gridSize);
      y1 = Math.floor(y1 / gridSize);
      x2 = Math.floor(x2 / gridSize);
      y2 = Math.floor(y2 / gridSize);

      const points = [];
      const dx = Math.abs(x2 - x1);
      const dy = Math.abs(y2 - y1);
      const sx = (x1 < x2) ? 1 : -1;
      const sy = (y1 < y2) ? 1 : -1;
      let err = dx - dy;

      while (true) {
          points.push({ x: x1 * gridSize, y: y1 * gridSize });

          if (x1 === x2 && y1 === y2) break;

          const e2 = 2 * err;
          if (e2 > -dy) {
              err -= dy;
              x1 += sx;
          }
          if (e2 < dx) {
              err += dx;
              y1 += sy;
          }
      }

      return points;
  }

  function undo(){
	  if (sessionTriangles.length > 0) {
        const tmpTriangle = sessionTriangles.pop();
		poppedTriangles.push(tmpTriangle)
        renderAllTriangles();  
    }
  }
  function redo(){
	  if (poppedTriangles.length > 0) {
		  const tmpTriangle_2 = poppedTriangles.pop()
		  sessionTriangles.push(tmpTriangle_2)
		  renderAllTriangles();  
	  }
  }
  function renderAllTriangles() {
      // Clear the canvas before drawing
      gl.clearColor(1.0, 1.0, 1.0, 1.0); // Set clear color to white
      gl.clear(gl.COLOR_BUFFER_BIT);
	  
	  
	  gl.uniformMatrix4fv(modelView, false, flatten(mvMatrix));
	  for (let triangle of temporaryTriangles) {
		  // Set the color uniform for the current triangle
		  gl.uniform4f(colorLocation, ...triangle.color);

		  const buffer = gl.createBuffer();
		  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		  gl.bufferData(gl.ARRAY_BUFFER, triangle.vertices, gl.STATIC_DRAW);

		  const position = gl.getAttribLocation(program, 'position');
		  gl.enableVertexAttribArray(position);
		  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

		  gl.drawArrays(gl.TRIANGLES, 0, triangle.vertices.length / 2);
		  
	  }
  
	  
	  for (const session of sessionTriangles) {
		  for (let triangle of session) {
			  // Set the color uniform for the current triangle
			  gl.uniform4f(colorLocation, ...triangle.color);

			  const buffer = gl.createBuffer();
			  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
			  gl.bufferData(gl.ARRAY_BUFFER, triangle.vertices, gl.STATIC_DRAW);

			  const position = gl.getAttribLocation(program, 'position');
			  gl.enableVertexAttribArray(position);
			  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

			  gl.drawArrays(gl.TRIANGLES, 0, triangle.vertices.length / 2);
			  
		  }
	  }
	  
  }
  function toggleInterpolation() {
      useInterpolation = !useInterpolation;
      alert(`Interpolation is now ${useInterpolation ? 'enabled' : 'disabled'}.`);
  }

  let currentColor = [0.0, 0.0, 1.0, 1.0]; // Default to red

  const colorLocation = gl.getUniformLocation(program, 'color');
  gl.uniform4f(colorLocation, 0.0, 0.0, 1.0, 1.0); // Red color

  function changeColor(color) {
      currentColor = color;
  }
  function changeColor(color) {
      currentColor = color;
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
	
  /*
  function caller()
  {
	//const zoomDelta = event.deltaY / 100;
    zoomFactor += 0.1;
    
    // Ensure zoomFactor is within valid limits
    zoomFactor = Math.max(0.1, zoomFactor);

    // Update the panOffset (optional, adjust based on your requirements)
    //panOffset[0] += event.deltaX / 100;
    //panOffset[1] += event.deltaY / 100;
	
    // Update the view matrix with the new zoom factor and panOffset
    updateViewMatrix(zoomFactor, panOffset);

    // Render the triangles with the updated view matrix
    
  }
  */
  function updateViewMatrix(zoomFactor, panOffset) {
	
	mvMatrix = mat4();

	let aa = scale(zoomFactor, [1.0, 1.0, 1.0])
	
	
	let aaa = changeDimension(aa);
	mvMatrix = mult_2( mvMatrix, aaa);
	console.log(panOffset)
	let bb = translate( panOffset[0], panOffset[1], 0 );
	console.log(bb)
	mvMatrix = mult_2(mvMatrix, bb);
	
	renderAllTriangles();
	
  }
  function zoomTrigger() {
	
	isZoom = true;
	
  }
  function zoomTriggerOff() {
	
	isZoom = false;
	let panOffset = [0.0, 0.0];
	let zoomFactor = 1.0;
	var mvMatrix = mat4();

	vMatrix = lookAt([0.0, 0.0, 1.0], [0.0, 0.0, 0.0], [0.0, 1.0, 0.0]);
	updateViewMatrix(zoomFactor,panOffset)
    renderAllTriangles();
  }
  window.zoomTriggerOff= zoomTriggerOff;
  window.zoomTrigger = zoomTrigger;
  window.eraseTrigger = eraseTrigger;
  window.redo = redo;
  window.undo = undo;
  window.changeColor = changeColor;
})();

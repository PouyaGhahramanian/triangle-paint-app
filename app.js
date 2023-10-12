(function() {

  let triangles = [];
  let lastX = null;
  let lastY = null;

  const gridSize = 0.05; // This will create a grid where each cell is 0.05 units in size.

  const canvas = document.getElementById('paintCanvas');
  const gl = canvas.getContext('webgl');
  if (!gl) {
      alert('WebGL not supported!');
      return;
  }

  const vertexShaderSource = `
      attribute vec2 position;
      void main() {
          gl_Position = vec4(position, 0.0, 1.0);
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

  let isDrawing = false;

  canvas.addEventListener('mousedown', () => {
      isDrawing = true;
  });

  canvas.addEventListener('mouseup', () => {
      isDrawing = false;
      lastX = null;
      lastY = null;
  });

  canvas.addEventListener('mousemove', draw);

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

      triangles.push(triangleVertices);
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

  function interpolateAndDraw(x1, y1, x2, y2) {
      const points = bresenhamLine(x1, y1, x2, y2);
      for (const point of points) {
          drawTriangle(point.x, point.y);
      }
      renderAllTriangles();
  }

  function drawTriangle(x, y) {
      const snappedX = Math.floor(x / gridSize) * gridSize;
      const snappedY = Math.floor(y / gridSize) * gridSize;

      const relativeX = x - snappedX;
      const relativeY = y - snappedY;

      let triangleVertices;

      if (relativeX + relativeY < gridSize) {
          if (relativeX > relativeY) {
              triangleVertices = new Float32Array([
                  snappedX + gridSize, snappedY,
                  snappedX, snappedY,
                  snappedX + gridSize, snappedY + gridSize
              ]);
          } else {
              triangleVertices = new Float32Array([
                  snappedX, snappedY + gridSize,
                  snappedX, snappedY,
                  snappedX + gridSize, snappedY + gridSize
              ]);
          }
      } else {
          if (relativeX > relativeY) {
              triangleVertices = new Float32Array([
                  snappedX + gridSize, snappedY + gridSize,
                  snappedX, snappedY + gridSize,
                  snappedX + gridSize, snappedY
              ]);
          } else {
              triangleVertices = new Float32Array([
                  snappedX, snappedY,
                  snappedX + gridSize, snappedY,
                  snappedX, snappedY + gridSize
              ]);
          }
      }

      triangles.push(triangleVertices);
  }

  function renderAllTriangles() {
      // Clear the canvas before drawing
      gl.clearColor(1.0, 1.0, 1.0, 1.0); // Set clear color to white
      gl.clear(gl.COLOR_BUFFER_BIT);

      for (let triangleVertices of triangles) {
          const buffer = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
          gl.bufferData(gl.ARRAY_BUFFER, triangleVertices, gl.STATIC_DRAW);

          const position = gl.getAttribLocation(program, 'position');
          gl.enableVertexAttribArray(position);
          gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

          gl.drawArrays(gl.TRIANGLES, 0, triangleVertices.length / 2);
      }
  }

  const colorLocation = gl.getUniformLocation(program, 'color');
  gl.uniform4f(colorLocation, 1.0, 0.0, 0.0, 1.0); // Red color
})();

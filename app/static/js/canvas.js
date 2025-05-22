document.addEventListener('DOMContentLoaded', function() {
    // Get canvas data from the server (passed from Flask)
    const canvasData = JSON.parse(document.getElementById('canvas-data').textContent);
    
    // Create main elements
    const canvasContainer = document.querySelector('.canvas-container');
    const canvas = document.getElementById('canvas');
    
    // Make sure container takes full viewport
    canvasContainer.style.width = '100vw';
    canvasContainer.style.height = '100vh';
    canvasContainer.style.overflow = 'hidden';
    canvasContainer.style.position = 'relative';
    
    // Create wrapper for transformation
    const wrapper = document.createElement('div');
    wrapper.className = 'canvas-wrapper';
    wrapper.style.position = 'absolute';
    wrapper.style.transformOrigin = '0 0';
    canvas.appendChild(wrapper);
    
    // Create SVG for connections
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('canvas-svg');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.pointerEvents = 'none';
    wrapper.appendChild(svg);
    
    // Track pan and zoom state
    let scale = 0.35; // Initial zoom level
    let offsetX = 0;
    let offsetY = 0;
    
    // Find canvas boundaries for initial positioning
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    // Calculate canvas boundaries
    canvasData.nodes.forEach(node => {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x + node.width);
        maxY = Math.max(maxY, node.y + node.height);
    });
    
    // Calculate center offset for initial positioning
    const canvasWidth = maxX - minX;
    const canvasHeight = maxY - minY;
    const containerWidth = window.innerWidth;  // Use window dimensions instead of container
    const containerHeight = window.innerHeight;
    
    // Center the canvas in the container
    offsetX = (containerWidth / 2) - ((minX + maxX) / 2) * scale;
    offsetY = (containerHeight / 2) - ((minY + maxY) / 2) * scale;
    
    // Update transform based on current state
    function updateTransform() {
        wrapper.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
        // Debug output to console to verify transform is working
        console.log(`Transform: translate(${offsetX}px, ${offsetY}px) scale(${scale})`);
    }
    
    // Apply initial transform
    updateTransform();
    
    // Create nodes
    canvasData.nodes.forEach(node => {
        const nodeElement = document.createElement('div');
        nodeElement.id = node.id;
        nodeElement.className = `node node-${node.type}`;
        
        if (node.color) {
            nodeElement.classList.add(`node-color-${node.color}`);
        }
        
        // Position the node (in original coordinates, scaling applied via wrapper)
        nodeElement.style.position = 'absolute';
        nodeElement.style.left = `${node.x}px`;
        nodeElement.style.top = `${node.y}px`;
        nodeElement.style.width = `${node.width}px`;
        nodeElement.style.height = `${node.height}px`;
        
        // Add content based on node type
        if (node.type === 'group') {
            nodeElement.classList.add('node-group');
            nodeElement.innerHTML = `<div class="node-label">${node.label || ''}</div>`;
        } else if (node.type === 'file') {
            nodeElement.classList.add('node-file');
            // Display file preview (placeholder)
            nodeElement.innerHTML = `<div class="node-text">
                <p><strong>File:</strong> ${node.file || ''}</p>
                <img src="/static/images/file-placeholder.png" alt="File preview">
            </div>`;
        } else {
            // Text content with markdown formatting
            nodeElement.innerHTML = `<div class="node-text">${formatMarkdown(node.text)}</div>`;
        }
        
        wrapper.appendChild(nodeElement);
    });

    // Format markdown text with basic parsing
    function formatMarkdown(text) {
        if (!text) return '';
        
        // Replace headers
        text = text.replace(/## (.*?)$/gm, '<h2>$1</h2>');
        text = text.replace(/### (.*?)$/gm, '<h3>$1</h3>');
        
        // Replace bold
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Replace italics
        text = text.replace(/\_(.*?)\_/g, '<em>$1</em>');
        
        // Replace lists
        text = text.replace(/• (.*?)$/gm, '<li>$1</li>');
        
        // Replace line breaks
        text = text.replace(/\n/g, '<br>');
        
        return text;
    }
    
    // Create connections after all nodes are placed
    canvasData.edges.forEach(edge => {
        drawConnection(edge);
    });
    
    // Function to draw connection between nodes
    function drawConnection(edge) {
        const fromNode = document.getElementById(edge.fromNode);
        const toNode = document.getElementById(edge.toNode);
        
        if (!fromNode || !toNode) {
            console.warn(`Cannot draw connection: Node not found (${edge.fromNode} -> ${edge.toNode})`);
            return;
        }
        
        // Get node positions and dimensions (directly from style attributes)
        const fromX = parseInt(fromNode.style.left);
        const fromY = parseInt(fromNode.style.top);
        const fromWidth = parseInt(fromNode.style.width);
        const fromHeight = parseInt(fromNode.style.height);
        
        const toX = parseInt(toNode.style.left);
        const toY = parseInt(toNode.style.top);
        const toWidth = parseInt(toNode.style.width);
        const toHeight = parseInt(toNode.style.height);
        
        // Calculate connection points based on sides
        let startX, startY, endX, endY;
        
        // Starting point
        switch (edge.fromSide) {
            case 'top':
                startX = fromX + fromWidth / 2;
                startY = fromY;
                break;
            case 'right':
                startX = fromX + fromWidth;
                startY = fromY + fromHeight / 2;
                break;
            case 'bottom':
                startX = fromX + fromWidth / 2;
                startY = fromY + fromHeight;
                break;
            case 'left':
                startX = fromX;
                startY = fromY + fromHeight / 2;
                break;
            default:
                startX = fromX + fromWidth / 2;
                startY = fromY + fromHeight / 2;
        }
        
        // Ending point
        switch (edge.toSide) {
            case 'top':
                endX = toX + toWidth / 2;
                endY = toY;
                break;
            case 'right':
                endX = toX + toWidth;
                endY = toY + toHeight / 2;
                break;
            case 'bottom':
                endX = toX + toWidth / 2;
                endY = toY + toHeight;
                break;
            case 'left':
                endX = toX;
                endY = toY + toHeight / 2;
                break;
            default:
                endX = toX + toWidth / 2;
                endY = toY + toHeight / 2;
        }
        
        // Calculate control points for curve
        const dx = Math.abs(endX - startX);
        const dy = Math.abs(endY - startY);
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Control point offsets (create nice curves)
        const curveIntensity = Math.min(distance * 0.4, 150);
        
        let cp1x, cp1y, cp2x, cp2y;
        
        // Set control points based on sides for better curves
        switch (edge.fromSide) {
            case 'top':
                cp1x = startX;
                cp1y = startY - curveIntensity;
                break;
            case 'right':
                cp1x = startX + curveIntensity;
                cp1y = startY;
                break;
            case 'bottom':
                cp1x = startX;
                cp1y = startY + curveIntensity;
                break;
            case 'left':
                cp1x = startX - curveIntensity;
                cp1y = startY;
                break;
            default:
                cp1x = startX;
                cp1y = startY;
        }
        
        switch (edge.toSide) {
            case 'top':
                cp2x = endX;
                cp2y = endY - curveIntensity;
                break;
            case 'right':
                cp2x = endX + curveIntensity;
                cp2y = endY;
                break;
            case 'bottom':
                cp2x = endX;
                cp2y = endY + curveIntensity;
                break;
            case 'left':
                cp2x = endX - curveIntensity;
                cp2y = endY;
                break;
            default:
                cp2x = endX;
                cp2y = endY;
        }
        
        // Create path element
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`);
        path.setAttribute('class', 'connection-path');
        path.setAttribute('id', `connection-${edge.id}`);
        path.setAttribute('stroke', '#888');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        svg.appendChild(path);
        
        // Add arrow marker
        addArrow(endX, endY, cp2x, cp2y, edge.id);
        
        // Add label if present
        if (edge.label) {
            addLabel(edge.label, startX, startY, endX, endY, cp1x, cp1y, cp2x, cp2y);
        }
    }
    
    // Add arrow at the end of connection
    function addArrow(x, y, controlX, controlY, id) {
        // Calculate angle based on the curve's direction at the endpoint
        const angle = Math.atan2(y - controlY, x - controlX);
        
        // Arrow size
        const arrowSize = 8;
        
        // Calculate arrow points
        const points = [
            `${x},${y}`,
            `${x - arrowSize * Math.cos(angle - Math.PI/6)},${y - arrowSize * Math.sin(angle - Math.PI/6)}`,
            `${x - arrowSize * Math.cos(angle + Math.PI/6)},${y - arrowSize * Math.sin(angle + Math.PI/6)}`
        ].join(' ');
        
        // Create arrow
        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        arrow.setAttribute('points', points);
        arrow.setAttribute('fill', '#888');
        arrow.setAttribute('id', `arrow-${id}`);
        svg.appendChild(arrow);
    }
    
    // Add label to connection
    function addLabel(label, x1, y1, x2, y2, cp1x, cp1y, cp2x, cp2y) {
        // Calculate position along the bezier curve (at t=0.5, middle point)
        const t = 0.5;
        const x = bezierPoint(x1, cp1x, cp2x, x2, t);
        const y = bezierPoint(y1, cp1y, cp2y, y2, t);
        
        // Create text element
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', x);
        text.setAttribute('y', y);
        text.setAttribute('fill', '#bbb');
        text.setAttribute('font-size', '12px');
        text.setAttribute('text-anchor', 'middle');
        
        // Add small background for better readability
        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bg.setAttribute('x', x - 40);
        bg.setAttribute('y', y - 12);
        bg.setAttribute('width', 80);
        bg.setAttribute('height', 16);
        bg.setAttribute('fill', 'rgba(30, 30, 30, 0.7)');
        bg.setAttribute('rx', '3');
        svg.appendChild(bg);
        
        text.textContent = label;
        svg.appendChild(text);
    }
    
    // Calculate point on bezier curve
    function bezierPoint(p0, p1, p2, p3, t) {
        const mt = 1 - t;
        return mt*mt*mt*p0 + 3*mt*mt*t*p1 + 3*mt*t*t*p2 + t*t*t*p3;
    }
    
    // Pan functionality - completely rewritten for better reliability
    let isPanning = false;
    let lastMouseX = 0;
    let lastMouseY = 0;
    
    // Function to handle mouse down events for panning
    function handleMouseDown(e) {
        // Only activate panning with left mouse button
        if (e.button === 0) {
            e.preventDefault();
            isPanning = true;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
            document.body.style.cursor = 'grabbing';
            
            // Debug log
            console.log('Pan started', e.clientX, e.clientY);
        }
    }
    
    // Function to handle mouse move events for panning
    function handleMouseMove(e) {
        if (!isPanning) return;
        
        e.preventDefault();
        
        // Calculate how far the mouse has moved since last position
        const deltaX = e.clientX - lastMouseX;
        const deltaY = e.clientY - lastMouseY;
        
        // Update last position
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        
        // Update the offset based on mouse movement
        offsetX += deltaX;
        offsetY += deltaY;
        
        // Apply the new transform
        updateTransform();
        
        // Debug log
        console.log('Pan moved', deltaX, deltaY, offsetX, offsetY);
    }
    
    // Function to handle mouse up events for panning
    function handleMouseUp(e) {
        if (isPanning) {
            e.preventDefault();
            isPanning = false;
            document.body.style.cursor = 'default';
            
            // Debug log
            console.log('Pan ended');
        }
    }
    
    // Add mouse event listeners directly to the canvas container
    canvasContainer.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove); // Use document for better tracking
    document.addEventListener('mouseup', handleMouseUp);
    
    // Prevent text selection during panning
    canvasContainer.addEventListener('selectstart', (e) => {
        if (isPanning) e.preventDefault();
    });
    
    // Zoom functionality
    function handleWheel(e) {
        e.preventDefault();
        
        // Get mouse position relative to window
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        
        // Calculate point under mouse in canvas coordinates
        const pointX = (mouseX - offsetX) / scale;
        const pointY = (mouseY - offsetY) / scale;
        
        // Adjust zoom scale
        const zoomIntensity = 0.1;
        const delta = -e.deltaY;
        
        // Limit zoom level
        const newScale = delta > 0 ? 
            Math.min(scale * (1 + zoomIntensity), 3) : 
            Math.max(scale * (1 - zoomIntensity), 0.1);
        
        // Apply zoom
        scale = newScale;
        
        // Adjust offset to keep point under mouse the same
        offsetX = mouseX - pointX * scale;
        offsetY = mouseY - pointY * scale;
        
        updateTransform();
        
        // Debug log
        console.log('Zoom', e.deltaY, scale);
    }
    
    // Add wheel event listener for zooming
    canvasContainer.addEventListener('wheel', handleWheel);
    
    // Fit to view button
    const fitButton = document.createElement('button');
    fitButton.innerText = 'Fit to View';
    fitButton.style.position = 'absolute';
    fitButton.style.top = '10px';
    fitButton.style.right = '10px';
    fitButton.style.padding = '8px 12px';
    fitButton.style.zIndex = '10';
    fitButton.style.backgroundColor = '#444';
    fitButton.style.color = '#fff';
    fitButton.style.border = 'none';
    fitButton.style.borderRadius = '4px';
    fitButton.style.cursor = 'pointer';
    canvasContainer.appendChild(fitButton);
    
    fitButton.addEventListener('click', () => {
        // Recalculate boundaries (in case nodes were added/removed)
        minX = Infinity; minY = Infinity; maxX = -Infinity; maxY = -Infinity;
        
        canvasData.nodes.forEach(node => {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x + node.width);
            maxY = Math.max(maxY, node.y + node.height);
        });
        
        const canvasWidth = maxX - minX + 200; // Add padding
        const canvasHeight = maxY - minY + 200;
        const containerWidth = window.innerWidth;
        const containerHeight = window.innerHeight;
        
        // Calculate scale to fit canvas in container
        const scaleX = containerWidth / canvasWidth;
        const scaleY = containerHeight / canvasHeight;
        scale = Math.min(scaleX, scaleY, 1); // Don't zoom in more than 100%
        
        // Center canvas
        offsetX = (containerWidth / 2) - ((minX + maxX) / 2) * scale;
        offsetY = (containerHeight / 2) - ((minY + maxY) / 2) * scale;
        
        updateTransform();
        
        // Debug log
        console.log('Fit to view', scale, offsetX, offsetY);
    });
    
    // Debug help button
    const debugButton = document.createElement('button');
    debugButton.innerText = 'Debug Info';
    debugButton.style.position = 'absolute';
    debugButton.style.top = '10px';
    debugButton.style.right = '120px';
    debugButton.style.padding = '8px 12px';
    debugButton.style.zIndex = '10';
    debugButton.style.backgroundColor = '#444';
    debugButton.style.color = '#fff';
    debugButton.style.border = 'none';
    debugButton.style.borderRadius = '4px';
    debugButton.style.cursor = 'pointer';
    canvasContainer.appendChild(debugButton);
    
    debugButton.addEventListener('click', () => {
        console.log('Canvas size:', canvasContainer.clientWidth, canvasContainer.clientHeight);
        console.log('Transform:', offsetX, offsetY, scale);
        console.log('Nodes count:', canvasData.nodes.length);
        console.log('Edges count:', canvasData.edges.length);
    });
    
    // Call fit to view on initial load
    setTimeout(() => {
        fitButton.click();
    }, 100);
});
// Initialize the map centered on Vietnam
const map = L.map("map").setView([16.0, 107.0], 6);

// Add OpenStreetMap tile layer
const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
}).addTo(map);

// Toggle OpenStreetMap layer
document.getElementById('osmToggle').addEventListener('change', function(e) {
  if (e.target.checked) {
    map.addLayer(osmLayer);
  } else {
    map.removeLayer(osmLayer);
  }
});

// Fetch and display Vietnam province boundaries
async function loadVietnamProvinces() {
  try {
    const response = await fetch(
      "https://hoanglongcao.github.io/bib/mekong%20delta%20database/vietnam_provinces.geojson"
    );
    const data = await response.json();

    L.geoJSON(data, {
      style: {
        color: "#2c3e50",
        weight: 0.2,
        fillColor: "#ecf0f1",
        fillOpacity: 0.1,
      },
      onEachFeature: (feature, layer) => {
        // if (feature.properties) {
        //   const name =
        //     feature.properties.Name ||
        //     feature.properties.name ||
        //     feature.properties.Name_VI ||
        //     feature.properties.Name_EN ||
        //     "Unknown";
        //   layer.bindPopup(`<b>${name}</b>`);
        // }
      },
    }).addTo(map);
  } catch (error) {
    console.error("Error loading Vietnam boundaries:", error);
  }
}

// Edit mode variables
let isEditMode = false;
let editingLayer = null;
let editingFeature = null;
let editMarkers = [];
let editPolyline = null;

async function loadExpresswayData() {
  try {
    const response = await fetch("vietnam_express_way.geojson");
    const data = await response.json();

    L.geoJSON(data, {
      style: {
        color: "#08a64aff",
        weight: 3,
        opacity: 1,
      },
      onEachFeature: (feature, layer) => {
        if (feature.properties) {
          const name = feature.properties.name || "Unknown Expressway";
          const length = feature.properties.length_km || "N/A";
          const status = feature.properties.status || "Unknown";
          layer.bindPopup(
            `<b>${name}</b><br>Length: ${length} km<br>Status: ${status}`
          );
        }

        // Add click handler to enter edit mode
        layer.on('click', function(e) {
          L.DomEvent.stopPropagation(e);
          enterEditMode(feature, layer);
        });
      },
    }).addTo(map);
  } catch (error) {
    console.error("Error loading expressway data:", error);
  }
}

async function loadAll(){
  // Load provinces when the page is ready
  await loadVietnamProvinces();

  // Load provinces when the page is ready
  await loadExpresswayData();
}

loadAll();

// Edit mode functions
function enterEditMode(feature, layer) {
  // Exit drawing mode if active
  if (isDrawing) {
    isDrawing = false;
    document.getElementById('drawBtn').textContent = 'Draw';
    document.getElementById('drawBtn').style.backgroundColor = '';
    map.getContainer().style.cursor = '';
  }

  // Clear any existing edit mode
  exitEditMode();

  isEditMode = true;
  editingFeature = feature;
  editingLayer = layer;

  // Get coordinates from the feature
  let coords = [];
  if (feature.geometry.type === 'LineString') {
    coords = feature.geometry.coordinates;
  } else if (feature.geometry.type === 'MultiLineString') {
    coords = feature.geometry.coordinates[0]; // Edit first line for now
  }

  // Hide the original layer
  layer.setStyle({ opacity: 0 });

  // Create editable polyline
  const leafletCoords = coords.map(coord => [coord[1], coord[0]]);
  editPolyline = L.polyline(leafletCoords, {
    color: '#3498db',
    weight: 4,
    opacity: 0.8
  }).addTo(map);

  // Create draggable circle markers for each coordinate
  coords.forEach((coord, index) => {
    const marker = L.circleMarker([coord[1], coord[0]], {
      radius: 6,
      fillColor: '#e74c3c',
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8,
      draggable: true
    }).addTo(map);

    // Store the index with the marker
    marker.coordIndex = index;

    // Enable dragging
    marker.on('drag', function(e) {
      updateCoordinatePosition(this.coordIndex, e.latlng);
    });

    // Remove coordinate on right-click
    marker.on('contextmenu', function(e) {
      L.DomEvent.stopPropagation(e);
      removeCoordinate(this.coordIndex);
    });

    // Show tooltip
    marker.bindTooltip(`Point ${index + 1}<br>Right-click to remove`, {
      permanent: false,
      direction: 'top'
    });

    editMarkers.push(marker);
  });

  // Show notification
  alert(`Edit mode: ${feature.properties.name || 'Expressway'}\nDrag points to move\nRight-click points to remove\nClick map to exit`);

  // Add click handler to exit edit mode
  map.once('click', function() {
    exitEditMode();
  });
}

function updateCoordinatePosition(index, latlng) {
  // Update the coordinate in the feature
  const coords = editingFeature.geometry.type === 'LineString'
    ? editingFeature.geometry.coordinates
    : editingFeature.geometry.coordinates[0];

  coords[index] = [latlng.lng, latlng.lat];

  // Update the polyline
  const leafletCoords = coords.map(coord => [coord[1], coord[0]]);
  editPolyline.setLatLngs(leafletCoords);
}

function removeCoordinate(index) {
  const coords = editingFeature.geometry.type === 'LineString'
    ? editingFeature.geometry.coordinates
    : editingFeature.geometry.coordinates[0];

  if (coords.length <= 2) {
    alert('Cannot remove - need at least 2 points for a line');
    return;
  }

  // Remove the coordinate
  coords.splice(index, 1);

  // Remove the marker
  map.removeLayer(editMarkers[index]);
  editMarkers.splice(index, 1);

  // Update indices for remaining markers
  editMarkers.forEach((marker, i) => {
    marker.coordIndex = i;
    marker.setTooltipContent(`Point ${i + 1}<br>Right-click to remove`);
  });

  // Update the polyline
  const leafletCoords = coords.map(coord => [coord[1], coord[0]]);
  editPolyline.setLatLngs(leafletCoords);
}

function exitEditMode() {
  if (!isEditMode) return;

  // Remove all edit markers
  editMarkers.forEach(marker => map.removeLayer(marker));
  editMarkers = [];

  // Remove edit polyline
  if (editPolyline) {
    map.removeLayer(editPolyline);
    editPolyline = null;
  }

  // Restore original layer
  if (editingLayer) {
    editingLayer.setStyle({ opacity: 1 });
  }

  isEditMode = false;
  editingLayer = null;
  editingFeature = null;
}

// Drawing functionality
let isDrawing = false;
let drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);
let currentPolyline = null;
let drawnCoordinates = [];

// Draw button
document.getElementById('drawBtn').addEventListener('click', function() {
  isDrawing = !isDrawing;
  this.textContent = isDrawing ? 'Stop Drawing' : 'Draw';
  this.style.backgroundColor = isDrawing ? '#e74c3c' : '';

  if (isDrawing) {
    drawnCoordinates = [];
    currentPolyline = null;
    map.getContainer().style.cursor = 'crosshair';
  } else {
    map.getContainer().style.cursor = '';
  }
});

// Map click handler for drawing
map.on('click', function(e) {
  if (!isDrawing) return;

  const latlng = [e.latlng.lng, e.latlng.lat];
  drawnCoordinates.push(latlng);

  if (currentPolyline) {
    drawnItems.removeLayer(currentPolyline);
  }

  const leafletCoords = drawnCoordinates.map(coord => [coord[1], coord[0]]);
  currentPolyline = L.polyline(leafletCoords, {
    color: '#3498db',
    weight: 3,
    opacity: 0.8
  });
  drawnItems.addLayer(currentPolyline);
});

// Clear button
document.getElementById('clearBtn').addEventListener('click', function() {
  drawnItems.clearLayers();
  drawnCoordinates = [];
  currentPolyline = null;
  if (isDrawing) {
    isDrawing = false;
    document.getElementById('drawBtn').textContent = 'Draw';
    document.getElementById('drawBtn').style.backgroundColor = '';
    map.getContainer().style.cursor = '';
  }
});

// Copy Coordinates button
document.getElementById('copyBtn').addEventListener('click', function() {
  if (drawnCoordinates.length === 0) {
    alert('No coordinates to copy. Draw on the map first.');
    return;
  }

  const coordinatesText = JSON.stringify(drawnCoordinates, null, 2);

  navigator.clipboard.writeText(coordinatesText).then(() => {
    alert('Coordinates copied to clipboard!');
  }).catch(err => {
    console.error('Failed to copy coordinates:', err);
    alert('Failed to copy coordinates. Check console for details.');
  });
});
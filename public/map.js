// Initialize the map centered on Vietnam
const map = L.map("map").setView([16.0, 107.0], 6);

// Helper function to show messages in info panel
function showInfoMessage(message, type = 'info') {
  const messageDiv = document.getElementById('info-message');
  messageDiv.textContent = message;
  messageDiv.style.display = 'block';

  // Set color based on type
  if (type === 'success') {
    messageDiv.style.backgroundColor = '#d4edda';
    messageDiv.style.color = '#155724';
    messageDiv.style.border = '1px solid #c3e6cb';
  } else if (type === 'error') {
    messageDiv.style.backgroundColor = '#f8d7da';
    messageDiv.style.color = '#721c24';
    messageDiv.style.border = '1px solid #f5c6cb';
  } else {
    messageDiv.style.backgroundColor = '#d1ecf1';
    messageDiv.style.color = '#0c5460';
    messageDiv.style.border = '1px solid #bee5eb';
  }

  // Auto-hide after 3 seconds
  // setTimeout(() => {
  //   messageDiv.style.display = 'none';
  // }, 3000);
}

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
    weight: 8,
    opacity: 0.8
  }).addTo(map);

  // Add click handler to polyline to insert new points
  editPolyline.on('click', function(e) {
    L.DomEvent.stopPropagation(e);
    insertPointOnLine(e.latlng);
  });

  // Create draggable markers for each coordinate
  coords.forEach((coord, index) => {
    // Create a custom divIcon for circular appearance
    const icon = L.divIcon({
      className: 'edit-marker',
      html: '<div style="width: 12px; height: 12px; background-color: #e74c3c; border: 2px solid #fff; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    });

    const marker = L.marker([coord[1], coord[0]], {
      icon: icon,
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

  // Show edit controls
  document.getElementById('edit-controls').style.display = 'block';

  // Show notification
  showInfoMessage(`Edit mode: ${feature.properties.name || 'Expressway'}. Click line to add point, drag points to move, right-click to remove, click map to exit.`, 'info');

  // Add click handler to exit edit mode
  map.once('click', function() {
    exitEditMode();
  });
}

function insertPointOnLine(latlng) {
  const coords = editingFeature.geometry.type === 'LineString'
    ? editingFeature.geometry.coordinates
    : editingFeature.geometry.coordinates[0];

  // Find the closest segment to insert the point
  let minDistance = Infinity;
  let insertIndex = 1;

  for (let i = 0; i < coords.length - 1; i++) {
    const p1 = L.latLng(coords[i][1], coords[i][0]);
    const p2 = L.latLng(coords[i + 1][1], coords[i + 1][0]);
    const distance = L.LineUtil.pointToSegmentDistance(
      L.point(latlng.lat, latlng.lng),
      L.point(p1.lat, p1.lng),
      L.point(p2.lat, p2.lng)
    );

    if (distance < minDistance) {
      minDistance = distance;
      insertIndex = i + 1;
    }
  }

  // Insert the new coordinate
  coords.splice(insertIndex, 0, [latlng.lng, latlng.lat]);

  // Create new marker for the inserted point
  const icon = L.divIcon({
    className: 'edit-marker',
    html: '<div style="width: 12px; height: 12px; background-color: #e74c3c; border: 2px solid #fff; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
    iconSize: [12, 12],
    iconAnchor: [6, 6]
  });

  const marker = L.marker([latlng.lat, latlng.lng], {
    icon: icon,
    draggable: true
  }).addTo(map);

  marker.coordIndex = insertIndex;

  marker.on('drag', function(e) {
    updateCoordinatePosition(this.coordIndex, e.latlng);
  });

  marker.on('contextmenu', function(e) {
    L.DomEvent.stopPropagation(e);
    removeCoordinate(this.coordIndex);
  });

  marker.bindTooltip(`Point ${insertIndex + 1}<br>Right-click to remove`, {
    permanent: false,
    direction: 'top'
  });

  // Insert the marker at the correct position
  editMarkers.splice(insertIndex, 0, marker);

  // Update indices for all markers after the inserted one
  editMarkers.forEach((m, i) => {
    m.coordIndex = i;
    m.setTooltipContent(`Point ${i + 1}<br>Right-click to remove`);
  });

  // Update the polyline
  const leafletCoords = coords.map(coord => [coord[1], coord[0]]);
  editPolyline.setLatLngs(leafletCoords);

  showInfoMessage('New point added', 'success');
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
    showInfoMessage('Cannot remove - need at least 2 points for a line', 'error');
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

  // Hide edit controls
  document.getElementById('edit-controls').style.display = 'none';

  isEditMode = false;
  editingLayer = null;
  editingFeature = null;
}

// Copy Coordinates button
document.getElementById('copyBtn').addEventListener('click', function() {
  // Check if we're in edit mode
  if (isEditMode && editingFeature) {
    const coords = editingFeature.geometry.type === 'LineString'
      ? editingFeature.geometry.coordinates
      : editingFeature.geometry.coordinates[0];
    const source = editingFeature.properties.name || 'Edited road';
    const coordinatesText = JSON.stringify(coords, null, 2);

    navigator.clipboard.writeText(coordinatesText).then(() => {
      showInfoMessage(`Coordinates from "${source}" copied to clipboard!`, 'success');
    }).catch(err => {
      console.error('Failed to copy coordinates:', err);
      showInfoMessage('Failed to copy coordinates. Check console for details.', 'error');
    });
  } else {
    showInfoMessage('No road being edited. Click a road to edit it first.', 'error');
  }
});

// Save button
document.getElementById('saveBtn').addEventListener('click', async function() {
  // Check if we're in edit mode
  if (!isEditMode || !editingFeature) {
    showInfoMessage('No road being edited. Click a road to edit it first.', 'error');
    return;
  }

  try {
    showInfoMessage('Saving changes...', 'info');

    // Send the updated feature to the server
    const response = await fetch('/api/update-expressway', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        feature: editingFeature
      })
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }

    await response.json();
    showInfoMessage(`Changes saved successfully for "${editingFeature.properties.name || 'Expressway'}"!`, 'success');

    // Exit edit mode after successful save
    setTimeout(() => {
      exitEditMode();
      // Reload the expressway data to show the updated version
      location.reload();
    }, 1500);

  } catch (err) {
    console.error('Failed to save changes:', err);
    showInfoMessage(`Failed to save: ${err.message}`, 'error');
  }
});
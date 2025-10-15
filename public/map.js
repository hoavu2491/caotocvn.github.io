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

async function loadExpresswayData() {
  try {
    const response = await fetch("vietnam_express_way.geojson");
    const data = await response.json();

    L.geoJSON(data, {
      style: {
        color: "#e74c3c",
        weight: 3,
        opacity: 0.8,
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
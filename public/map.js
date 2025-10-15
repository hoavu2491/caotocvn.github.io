// Initialize the map centered on Vietnam
const map = L.map("map").setView([16.0, 107.0], 6);

// Add OpenStreetMap tile layer
// L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
//     attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
//     maxZoom: 19
// }).addTo(map);

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
        if (feature.properties) {
          const name =
            feature.properties.Name ||
            feature.properties.name ||
            feature.properties.Name_VI ||
            feature.properties.Name_EN ||
            "Unknown";
          layer.bindPopup(`<b>${name}</b>`);
        }
      },
    }).addTo(map);
  } catch (error) {
    console.error("Error loading Vietnam boundaries:", error);
  }
}

async function loadExpresswayData() {
  try {
    
  } catch (error) {
    console.error("Error loading Vietnam boundaries:", error);
  }
}

async function loadAll(){
  // Load provinces when the page is ready
  await loadVietnamProvinces();

  // Load provinces when the page is ready
  await loadExpresswayData();
}

loadAll();
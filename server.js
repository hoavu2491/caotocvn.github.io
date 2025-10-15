const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON bodies
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Route to serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to update expressway data
app.post('/api/update-expressway', async (req, res) => {
  try {
    const { feature } = req.body;

    if (!feature || !feature.properties) {
      return res.status(400).json({
        success: false,
        error: 'Invalid feature data'
      });
    }

    // Read the current GeoJSON file
    const geojsonPath = path.join(__dirname, 'public', 'vietnam_express_way.geojson');
    const data = await fs.readFile(geojsonPath, 'utf8');
    const geojson = JSON.parse(data);

    // Find and update the matching feature
    let updated = false;
    for (let i = 0; i < geojson.features.length; i++) {
      // Match by name or other unique identifier
      if (geojson.features[i].properties.name === feature.properties.name) {
        // Update the entire feature with the edited one
        geojson.features[i] = feature;
        updated = true;
        break;
      }
    }

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Feature not found in GeoJSON'
      });
    }

    // Write the updated GeoJSON back to the file
    await fs.writeFile(
      geojsonPath,
      JSON.stringify(geojson, null, 2),
      'utf8'
    );

    res.json({
      success: true,
      message: 'Expressway updated successfully',
      featureName: feature.properties.name
    });

  } catch (error) {
    console.error('Error updating expressway:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update expressway data',
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

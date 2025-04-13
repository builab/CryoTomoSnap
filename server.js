const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Path to micrographs folder
const micrographsPath = './micrographs';

// Helper: Get tags file path for a dataset
function getTagsFilePath(dataset) {
  return path.join(micrographsPath, dataset, 'imageTags.json');
}

// Initialize tags for a dataset (creates file if missing)
async function initDatasetTags(dataset) {
  const tagsFile = getTagsFilePath(dataset);
  try {
    await fs.access(tagsFile);
  } catch {
    await fs.writeFile(tagsFile, JSON.stringify({}));
  }
}

// --- API Endpoints ---

// Get all datasets
app.get('/api/datasets', async (req, res) => {
  try {
    const items = await fs.readdir(micrographsPath, { withFileTypes: true });
    const datasets = items
      .filter(item => item.isDirectory())
      .map(dir => dir.name);
    res.json({ datasets });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve datasets' });
  }
});

// Get images (all or filtered by dataset)
app.get('/api/images', async (req, res) => {
  try {
    const dataset = req.query.dataset;
    let images = [];

    if (dataset) {
      // Get images from a single dataset
      const datasetPath = path.join(micrographsPath, dataset);
      const files = await fs.readdir(datasetPath);
      
      // Load tags if they exist
      let tags = {};
      try {
        const tagsData = await fs.readFile(getTagsFilePath(dataset), 'utf8');
        tags = JSON.parse(tagsData);
      } catch {} // Ignore if no tags file

      images = files
        .filter(file => ['.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(path.extname(file).toLowerCase()))
        .map(file => ({
          filename: file,
          dataset,
          tags: tags[file] || [] // Tags are stored by filename (no path)
        }));

    } else {
      // Get images from all datasets
      const datasets = (await fs.readdir(micrographsPath, { withFileTypes: true }))
        .filter(item => item.isDirectory())
        .map(dir => dir.name);

      for (const dataset of datasets) {
        const datasetPath = path.join(micrographsPath, dataset);
        const files = await fs.readdir(datasetPath);

        // Load tags for this dataset
        let tags = {};
        try {
          const tagsData = await fs.readFile(getTagsFilePath(dataset), 'utf8');
          tags = JSON.parse(tagsData);
        } catch {} // Ignore if no tags file

        const datasetImages = files
          .filter(file => ['.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(path.extname(file).toLowerCase()))
          .map(file => ({
            filename: file,
            dataset,
            tags: tags[file] || []
          }));

        images.push(...datasetImages);
      }
    }

    res.json(images);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve images' });
  }
});

// Serve an image
app.get('/api/images/:dataset/:filename', async (req, res) => {
  try {
    const { dataset, filename } = req.params;
    const imagePath = path.join(micrographsPath, dataset, filename);

    // Check if file exists
    await fs.access(imagePath);

    // Set Content-Type based on extension
    const ext = path.extname(filename).toLowerCase();
    const contentType = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp'
    }[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    require('fs').createReadStream(imagePath).pipe(res);
  } catch (error) {
    res.status(404).json({ error: 'Image not found' });
  }
});

// Get tags for an image
app.get('/api/tags/:dataset/:filename', async (req, res) => {
  try {
    const { dataset, filename } = req.params;
    const tagsFile = getTagsFilePath(dataset);

    const tagsData = await fs.readFile(tagsFile, 'utf8');
    const tags = JSON.parse(tagsData);

    res.json({ tags: tags[filename] || [] });
  } catch (error) {
    res.json({ tags: [] }); // Return empty if file doesn't exist
  }
});

// Update tags for an image
app.post('/api/tags/:dataset/:filename', async (req, res) => {
  try {
    const { dataset, filename } = req.params;
    const newTags = req.body.tags || [];
    const tagsFile = getTagsFilePath(dataset);

    // Initialize tags file if missing
    await initDatasetTags(dataset);

    // Read current tags
    const tagsData = await fs.readFile(tagsFile, 'utf8');
    const tags = JSON.parse(tagsData);

    // Update tags
    tags[filename] = newTags;

    // Save back to file
    await fs.writeFile(tagsFile, JSON.stringify(tags, null, 2));

    res.json({ success: true, tags: newTags });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update tags' });
  }
});

// Search across datasets
app.get('/api/search', async (req, res) => {
  try {
    const term = (req.query.term || '').toLowerCase();
    const datasetFilter = req.query.dataset;

    // Get all images (reuses /api/images logic)
    const response = await fetch(`http://localhost:${port}/api/images?dataset=${datasetFilter || ''}`);
    const allImages = await response.json();

    // Filter by search term
    const results = term ? allImages.filter(img => 
      img.filename.toLowerCase().includes(term) ||
      img.dataset.toLowerCase().includes(term) ||
      img.tags.some(tag => tag.toLowerCase().includes(term))
    ) : allImages;

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
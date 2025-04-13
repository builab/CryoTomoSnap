// server.js - Updated with dataset support
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
// File to store tags
const tagsFile = path.join(__dirname, 'imageTags.json');

// Initialize tags storage if it doesn't exist
async function initializeTagsStorage() {
  try {
    await fs.access(tagsFile);
  } catch (error) {
    // File doesn't exist, create it with empty tags object
    await fs.writeFile(tagsFile, JSON.stringify({}));
  }
}

// Get all datasets (folders) from the micrographs directory
app.get('/api/datasets', async (req, res) => {
  try {
    const items = await fs.readdir(micrographsPath, { withFileTypes: true });
    const datasets = items
      .filter(item => item.isDirectory())
      .map(dir => dir.name);
    
    res.json({ datasets });
  } catch (error) {
    console.error('Error reading datasets:', error);
    res.status(500).json({ error: 'Failed to retrieve datasets' });
  }
});

// Get all image files from all datasets or a specific dataset
app.get('/api/images', async (req, res) => {
  try {
    const dataset = req.query.dataset;
    let imagesWithMeta = [];
    
    // Read tags file
    const tagsData = await fs.readFile(tagsFile, 'utf8');
    const tags = JSON.parse(tagsData);
    
    if (dataset) {
      // Get images from specific dataset
      const datasetPath = path.join(micrographsPath, dataset);
      const files = await fs.readdir(datasetPath);
      
      const imageFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(ext);
      });
      
      imagesWithMeta = imageFiles.map(file => {
        const fullPath = `${dataset}/${file}`;
        return {
          filename: file,
          fullPath: fullPath,
          dataset: dataset,
          tags: tags[fullPath] || []
        };
      });
    } else {
      // Get images from all datasets
      const datasets = await fs.readdir(micrographsPath, { withFileTypes: true });
      const directories = datasets.filter(item => item.isDirectory()).map(dir => dir.name);
      
      for (const dir of directories) {
        const datasetPath = path.join(micrographsPath, dir);
        const files = await fs.readdir(datasetPath);
        
        const imageFiles = files.filter(file => {
          const ext = path.extname(file).toLowerCase();
          return ['.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(ext);
        });
        
        const datasetImages = imageFiles.map(file => {
          const fullPath = `${dir}/${file}`;
          return {
            filename: file,
            fullPath: fullPath,
            dataset: dir,
            tags: tags[fullPath] || []
          };
        });
        
        imagesWithMeta = [...imagesWithMeta, ...datasetImages];
      }
    }
    
    res.json(imagesWithMeta);
  } catch (error) {
    console.error('Error reading images:', error);
    res.status(500).json({ error: 'Failed to retrieve images' });
  }
});

// Serve an image
app.get('/api/images/:dataset/:filename', async (req, res) => {
  try {
    const dataset = req.params.dataset;
    const filename = req.params.filename;
    const imagePath = path.join(micrographsPath, dataset, filename);
    
    // Check if file exists
    await fs.access(imagePath);
    
    // Add proper content type header based on extension
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.png') {
      res.setHeader('Content-Type', 'image/png');
    } else if (ext === '.jpg' || ext === '.jpeg') {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (ext === '.gif') {
      res.setHeader('Content-Type', 'image/gif');
    } else if (ext === '.bmp') {
      res.setHeader('Content-Type', 'image/bmp');
    }
    
    // Use fs stream to send the file
    const fileStream = require('fs').createReadStream(imagePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error serving image:', error);
    res.status(404).json({ error: 'Image not found' });
  }
});

// Get tags for a specific image
app.get('/api/tags/:dataset/:filename', async (req, res) => {
  try {
    const tagsData = await fs.readFile(tagsFile, 'utf8');
    const tags = JSON.parse(tagsData);
    const dataset = req.params.dataset;
    const filename = req.params.filename;
    const fullPath = `${dataset}/${filename}`;
    
    res.json({ tags: tags[fullPath] || [] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve tags' });
  }
});

// Add or update tags for an image
app.post('/api/tags/:dataset/:filename', async (req, res) => {
  try {
    const dataset = req.params.dataset;
    const filename = req.params.filename;
    const fullPath = `${dataset}/${filename}`;
    const newTags = req.body.tags || [];
    
    // Read current tags
    const tagsData = await fs.readFile(tagsFile, 'utf8');
    const tags = JSON.parse(tagsData);
    
    // Update tags for the image
    tags[fullPath] = newTags;
    
    // Save updated tags
    await fs.writeFile(tagsFile, JSON.stringify(tags, null, 2));
    
    res.json({ success: true, tags: newTags });
  } catch (error) {
    console.error('Error updating tags:', error);
    res.status(500).json({ error: 'Failed to update tags' });
  }
});

// Search images by tag, dataset name, or image name
app.get('/api/search', async (req, res) => {
  try {
    const searchTerm = req.query.term?.toLowerCase() || '';
    const datasetFilter = req.query.dataset;
    
    if (!searchTerm && !datasetFilter) {
      return res.status(400).json({ error: 'Search term or dataset filter required' });
    }
    
    // Get all images with their metadata
    let allImages = [];
    const datasets = await fs.readdir(micrographsPath, { withFileTypes: true });
    const directories = datasets.filter(item => item.isDirectory()).map(dir => dir.name);
    
    // If filtering by dataset, only process that dataset
    const datasetsToProcess = datasetFilter ? [datasetFilter] : directories;
    
    // Read tags
    const tagsData = await fs.readFile(tagsFile, 'utf8');
    const allTags = JSON.parse(tagsData);
    
    // Get all images from relevant datasets
    for (const dir of datasetsToProcess) {
      if (!directories.includes(dir)) continue;
      
      const datasetPath = path.join(micrographsPath, dir);
      const files = await fs.readdir(datasetPath);
      
      const imageFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(ext);
      });
      
      const datasetImages = imageFiles.map(file => {
        const fullPath = `${dir}/${file}`;
        return {
          filename: file,
          fullPath: fullPath,
          dataset: dir,
          tags: allTags[fullPath] || []
        };
      });
      
      allImages = [...allImages, ...datasetImages];
    }
    
    // Filter images by search term (if provided)
    let results = allImages;
    if (searchTerm) {
      results = allImages.filter(image => {
        // Check if filename contains search term
        if (image.filename.toLowerCase().includes(searchTerm)) {
          return true;
        }
        
        // Check if dataset name contains search term
        if (image.dataset.toLowerCase().includes(searchTerm)) {
          return true;
        }
        
        // Check if any tag contains search term
        if (image.tags.some(tag => tag.toLowerCase().includes(searchTerm))) {
          return true;
        }
        
        return false;
      });
    }
    
    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Initialize and start the server
async function startServer() {
  await initializeTagsStorage();
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

startServer();
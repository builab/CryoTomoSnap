#!/usr/bin/env node
const fs = require('fs').promises;
const path = require('path');

// Config
const MICROGRAPHS_PATH = './micrographs'; // Path to your datasets folder
const TAGS_FILE = 'imageTags.json';       // Tags filename (per dataset)

// Helper: Load or initialize tags for a dataset
async function loadTags(datasetPath) {
  const tagsFile = path.join(datasetPath, TAGS_FILE);
  try {
    const data = await fs.readFile(tagsFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {}; // Return empty tags if file doesn't exist
  }
}

// Helper: Save tags to a dataset
async function saveTags(datasetPath, tags) {
  const tagsFile = path.join(datasetPath, TAGS_FILE);
  await fs.writeFile(tagsFile, JSON.stringify(tags, null, 2));
  console.log(`Tags saved to ${path.relative(process.cwd(), tagsFile)}`);
}

// Add tags to specific images in a dataset
async function addTagsToImages(dataset, tags, imageNames = []) {
  const datasetPath = path.join(MICROGRAPHS_PATH, dataset);
  
  try {
    // Check if dataset exists
    await fs.access(datasetPath);
    
    // Load existing tags (or create new)
    const currentTags = await loadTags(datasetPath);
    
    // Get all images in dataset if no specific images provided
    const files = await fs.readdir(datasetPath);
    const imagesToUpdate = imageNames.length > 0 
      ? imageNames.filter(img => files.includes(img))
      : files.filter(file => ['.jpg', '.jpeg', '.png'].includes(path.extname(file).toLowerCase()));

    if (imagesToUpdate.length === 0) {
      throw new Error('No matching images found in dataset.');
    }

    // Update tags for each image
    imagesToUpdate.forEach(image => {
      if (!currentTags[image]) currentTags[image] = [];
      tags.forEach(tag => {
        if (!currentTags[image].includes(tag)) {
          currentTags[image].push(tag);
        }
      });
    });

    // Save updated tags
    await saveTags(datasetPath, currentTags);
    console.log(`Added tags [${tags.join(', ')}] to ${imagesToUpdate.length} image(s) in dataset "${dataset}".`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// --- Command Line Interface ---
const args = process.argv.slice(2);

if (args.length < 2 || args.includes('--help')) {
  console.log(`
Usage: node add-tags.js <dataset> <tags> [images...]

Example:
1. Add tags to ALL images in a dataset:
   node add-tags.js cells "biology, nucleus"

2. Add tags to SPECIFIC images:
   node add-tags.js cells "mitosis, microscope" cell1.jpg cell2.png
`);
  process.exit(0);
}

const [dataset, tags, ...images] = args;
const tagsList = tags.split(',').map(tag => tag.trim());

addTagsToImages(dataset, tagsList, images);
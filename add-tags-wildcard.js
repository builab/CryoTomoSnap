#!/usr/bin/env node
const fs = require('fs').promises;
const path = require('path');
const { glob } = require('glob'); // Updated import

// Config
const MICROGRAPHS_PATH = './micrographs';
const TAGS_FILE = 'imageTags.json';

// Helper: Load tags for a dataset
async function loadTags(datasetPath) {
  const tagsFile = path.join(datasetPath, TAGS_FILE);
  try {
    const data = await fs.readFile(tagsFile, 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

// Helper: Save tags to a dataset
async function saveTags(datasetPath, tags) {
  const tagsFile = path.join(datasetPath, TAGS_FILE);
  await fs.writeFile(tagsFile, JSON.stringify(tags, null, 2));
  console.log(`Tags saved to ${path.relative(process.cwd(), tagsFile)}`);
}

// Match datasets/images using wildcards
async function resolveWildcards(datasetPattern, imagePattern = '*') {
  // Find matching datasets
  const datasetMatches = await glob(path.join(MICROGRAPHS_PATH, datasetPattern), { nodir: false });
  const datasets = datasetMatches.map(d => path.basename(d));

  if (datasets.length === 0) {
    throw new Error(`No datasets match "${datasetPattern}"`);
  }

  // For each dataset, find matching images
  const results = [];
  for (const dataset of datasets) {
    const datasetPath = path.join(MICROGRAPHS_PATH, dataset);
    const imageMatches = await glob(path.join(datasetPath, imagePattern), { nodir: true });
    const images = imageMatches
      .map(img => path.basename(img))
      .filter(img => ['.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(path.extname(img).toLowerCase()));

    if (images.length > 0) {
      results.push({ dataset, datasetPath, images });
    }
  }

  if (results.length === 0) {
    throw new Error(`No images match "${imagePattern}" in datasets "${datasetPattern}"`);
  }

  return results;
}

// Add tags to matched images
async function addTagsWithWildcards(datasetPattern, tags, imagePattern = '*') {
  try {
    const matches = await resolveWildcards(datasetPattern, imagePattern);
    const tagsList = tags.split(',').map(tag => tag.trim());

    for (const { dataset, datasetPath, images } of matches) {
      const currentTags = await loadTags(datasetPath);
      let updated = 0;

      images.forEach(image => {
        if (!currentTags[image]) currentTags[image] = [];
        tagsList.forEach(tag => {
          if (!currentTags[image].includes(tag)) {
            currentTags[image].push(tag);
            updated++;
          }
        });
      });

      await saveTags(datasetPath, currentTags);
      console.log(`Added tags [${tagsList.join(', ')}] to ${updated} image(s) in dataset "${dataset}"`);
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// --- Command Line Interface ---
const args = process.argv.slice(2);

if (args.length < 2 || args.includes('--help')) {
  console.log(`
Usage: node add-tags-wildcard.js <dataset-pattern> <tags> [image-pattern]

Examples:
1. Add tags to ALL images in datasets matching "CHEM*":
   node add-tags-wildcard.js "CHEM*" "biology, nucleus"

2. Add tags to images matching "cell*.png" in dataset "cells":
   node add-tags-wildcard.js cells "mitosis, microscope" "cell*.png"
`);
  process.exit(0);
}

const [datasetPattern, tags, imagePattern = '*'] = args;
addTagsWithWildcards(datasetPattern, tags, imagePattern);
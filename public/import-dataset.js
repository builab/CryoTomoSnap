document.addEventListener('DOMContentLoaded', function() {
  console.log('Import dataset script loaded');
  
  // Get DOM elements
  const sourceFolderInput = document.getElementById('source-folder');
  const filePatternInput = document.getElementById('file-pattern');
  const datasetNameInput = document.getElementById('dataset-name');
  const removeSuffixInput = document.getElementById('remove-suffix');
  const previewBtn = document.getElementById('preview-btn');
  const importBtn = document.getElementById('import-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  const statusMessage = document.getElementById('status-message');
  const fileList = document.getElementById('file-list');
  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');

  // Add console logs to verify elements are found
  console.log('Preview button found:', !!previewBtn);
  console.log('Import button found:', !!importBtn);

  let selectedFiles = [];
  let sourceDirectory = '';

  // Handle folder selection
  sourceFolderInput.addEventListener('change', function(e) {
    console.log('Folder selection changed');
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      // Get the common directory path
      const firstFilePath = files[0].webkitRelativePath;
      sourceDirectory = firstFilePath.substring(0, firstFilePath.indexOf('/'));
      showStatus(`Selected folder: ${sourceDirectory}`, 'success');
    } else {
      sourceDirectory = '';
      showStatus('No folder selected', 'error');
    }
  });

  // Preview files
previewBtn.addEventListener('click', function() {
  console.log('Preview button clicked');
  if (!sourceDirectory) {
    showStatus('Please select a source folder first', 'error');
    return;
  }

  const pattern = filePatternInput.value.trim();
  const suffixToRemove = removeSuffixInput.value.trim();

  try {
    // Handle wildcard patterns better
    let regexPattern = null;
    if (pattern) {
      // Special handling for common patterns
      if (pattern === "*.png") {
        regexPattern = /\.png$/i;  // Match any file ending with .png (case insensitive)
      } else if (pattern === "*.jpg" || pattern === "*.jpeg") {
        regexPattern = /\.(jpg|jpeg)$/i;  // Match jpg or jpeg extensions
      } else {
        // Convert wildcard pattern to regex more carefully
        const escapedPattern = pattern
          .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars except * and ?
          .replace(/\*/g, '.*')                // Convert * to .*
          .replace(/\?/g, '.');                // Convert ? to .
        regexPattern = new RegExp(escapedPattern, 'i'); // Case insensitive
      }
    }
    
    console.log('Pattern:', pattern, 'Regex:', regexPattern);

    selectedFiles = Array.from(sourceFolderInput.files)
      .filter(file => {
        // Skip directories
        if (file.name === '' || !file.name) return false;
        
        // Apply pattern filter if specified
        if (regexPattern) {
          const match = regexPattern.test(file.name);
          console.log(`Testing ${file.name} against pattern: ${match}`);
          return match;
        }
        
        return true;
      });

    console.log('Selected files count:', selectedFiles.length);

    if (selectedFiles.length === 0) {
      showStatus('No files match the pattern', 'error');
      fileList.innerHTML = '';
      importBtn.disabled = true;
      return;
    }
      // Display matched files
      fileList.innerHTML = '<h4>Files to be imported:</h4>';
      const ul = document.createElement('ul');
      
      selectedFiles.forEach(file => {
        const li = document.createElement('li');
        let displayName = file.name;
        
        // Show how filename will be transformed
        if (suffixToRemove && file.name.includes(suffixToRemove)) {
          displayName += ` → ${file.name.replace(suffixToRemove, '')}`;
        }
        
        li.textContent = displayName;
        ul.appendChild(li);
      });
      
      fileList.appendChild(ul);
      showStatus(`Found ${selectedFiles.length} matching files`, 'success');
      importBtn.disabled = false;

    } catch (error) {
      console.error('Error in preview:', error);
      showStatus('Invalid pattern: ' + error.message, 'error');
    }
  });

  // Import dataset
  importBtn.addEventListener('click', async function() {
    console.log('Import button clicked');
    const datasetName = datasetNameInput.value.trim();
    const suffixToRemove = removeSuffixInput.value.trim();

    if (!datasetName) {
      showStatus('Please enter a dataset name', 'error');
      return;
    }

    if (selectedFiles.length === 0) {
      showStatus('No files selected for import', 'error');
      return;
    }

    try {
      progressContainer.style.display = 'block';
      progressBar.style.width = '0%';
      progressText.textContent = `0/${selectedFiles.length} files processed`;
      importBtn.disabled = true;
      cancelBtn.disabled = true;

      // Prepare the data to send
      const formData = new FormData();
      formData.append('datasetName', datasetName);
      formData.append('suffixToRemove', suffixToRemove);
      
      // Add only the filtered files
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        formData.append('files', file, file.webkitRelativePath);
        
        // Update progress intermittently
        if (i % 5 === 0 || i === selectedFiles.length - 1) {
          updateProgress(i + 1, selectedFiles.length);
          // Allow UI to update
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      showStatus(`Sending ${selectedFiles.length} files...`, 'success');
      
      // Send the request
      const response = await fetch('/api/import-dataset', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        showStatus(`Successfully imported ${result.importedFiles} files to dataset "${datasetName}"`, 'success');
      } else {
        showStatus('Error: ' + (result.error || 'Failed to import dataset'), 'error');
      }
    } catch (error) {
      console.error('Import error:', error);
      showStatus('Error: ' + error.message, 'error');
    } finally {
      progressContainer.style.display = 'none';
      importBtn.disabled = false;
      cancelBtn.disabled = false;
    }
  });

  // Cancel button
  cancelBtn.addEventListener('click', function() {
    console.log('Cancel button clicked');
    sourceFolderInput.value = '';
    filePatternInput.value = '';
    datasetNameInput.value = '';
    removeSuffixInput.value = '';
    fileList.innerHTML = '';
    selectedFiles = [];
    sourceDirectory = '';
    importBtn.disabled = true;
    showStatus('', '');
  });

  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = type || '';
    statusMessage.style.display = message ? 'block' : 'none';
  }

  function updateProgress(current, total) {
    const percent = Math.round((current / total) * 100);
    progressBar.style.width = `${percent}%`;
    progressText.textContent = `${current}/${total} files processed`;
  }

  // Log initial state
  console.log('DOM content loaded, event listeners set up');
});
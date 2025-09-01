import { renderAsync } from 'docx-preview';

export const parseWordDocument = async (file, onProgress) => {
  try {
    if (onProgress) onProgress('Reading file data...');
    const arrayBuffer = await file.arrayBuffer();
    
    if (onProgress) onProgress('Rendering document with tables and images...');
    
    // Create container for rendering
    const container = document.createElement('div');
    container.className = 'word-document-preview';
    
    // Enhanced options to properly render tables and images
    const options = {
      className: 'word-document-preview',
      inWrapper: false,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      breakPages: false,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      renderEndnotes: true,
      renderComments: true,
      renderTables: true, // Explicitly enable tables
      renderImages: true, // Explicitly enable images
      experimental: true, // Enable experimental features for better table/image support
      trimXmlDeclaration: true,
      useBase64URL: true, // Better image handling
      debug: false
    };
    
    await renderAsync(arrayBuffer, container, null, options);
    
    if (onProgress) onProgress('Processing tables and images...');
    
    // Wait longer for tables and images to render
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Post-process to ensure tables and images are properly formatted
    await postProcessContent(container);
    
    // Get the rendered HTML
    const htmlContent = container.innerHTML;
    
    if (!htmlContent || htmlContent.trim() === '') {
      throw new Error('Document appears to be empty or corrupted');
    }
    
    // Extract plain text for comparison while preserving structure
    const plainText = extractPlainTextWithStructure(htmlContent);
    
    if (onProgress) onProgress('Complete');
    
    return {
      content: plainText,
      htmlContent: htmlContent,
      originalHtmlContent: htmlContent,
      tables: extractTables(container),
      images: extractImages(container)
    };
  } catch (error) {
    console.error('Error parsing document:', error);
    throw new Error(`Failed to parse document: ${error.message}`);
  }
};

// Post-process content to ensure tables and images are properly formatted
const postProcessContent = async (container) => {
  // Fix table styling
  const tables = container.querySelectorAll('table');
  tables.forEach((table, index) => {
    table.classList.add('word-table');
    table.setAttribute('data-table-index', index);
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.marginBottom = '16px';
    
    // Ensure table cells have proper styling
    const cells = table.querySelectorAll('td, th');
    cells.forEach(cell => {
      if (!cell.style.border) {
        cell.style.border = '1px solid #d1d5db';
      }
      if (!cell.style.padding) {
        cell.style.padding = '8px 12px';
      }
    });
  });

  // Fix image styling and add data attributes
  const images = container.querySelectorAll('img');
  images.forEach((img, index) => {
    img.classList.add('word-image');
    img.setAttribute('data-image-index', index);
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    img.style.display = 'block';
    img.style.margin = '16px auto';
    
    // Add loading error handling
    img.onerror = function() {
      this.style.display = 'none';
      const placeholder = document.createElement('div');
      placeholder.className = 'image-placeholder';
      placeholder.style.cssText = `
        width: 200px;
        height: 150px;
        border: 2px dashed #d1d5db;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 16px auto;
        color: #6b7280;
        font-style: italic;
        background-color: #f9fafb;
      `;
      placeholder.textContent = `[Image ${index + 1}]`;
      this.parentNode.insertBefore(placeholder, this);
    };
  });

  // Add paragraph numbering for better comparison
  const paragraphs = container.querySelectorAll('p, h1, h2, h3, h4, h5, h6');
  paragraphs.forEach((p, index) => {
    p.setAttribute('data-line-number', index + 1);
  });
};

// Extract table information for comparison
const extractTables = (container) => {
  const tables = container.querySelectorAll('table');
  return Array.from(tables).map((table, index) => ({
    index,
    element: table,
    rows: table.querySelectorAll('tr').length,
    cols: table.querySelector('tr')?.querySelectorAll('td, th').length || 0,
    content: table.textContent?.trim() || '',
    html: table.outerHTML
  }));
};

// Extract image information for comparison
const extractImages = (container) => {
  const images = container.querySelectorAll('img');
  return Array.from(images).map((img, index) => ({
    index,
    element: img,
    src: img.src,
    alt: img.alt || '',
    width: img.width,
    height: img.height,
    html: img.outerHTML
  }));
};

const extractPlainTextWithStructure = (html) => {
  if (!html) return '';
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Remove script and style elements
  const scripts = tempDiv.querySelectorAll('script, style');
  scripts.forEach(el => el.remove());
  
  // Process tables to preserve structure
  const tables = tempDiv.querySelectorAll('table');
  tables.forEach((table, index) => {
    const tableText = `[TABLE ${index + 1}]\n${extractTableText(table)}\n[/TABLE ${index + 1}]`;
    const placeholder = document.createElement('div');
    placeholder.textContent = tableText;
    table.parentNode.replaceChild(placeholder, table);
  });

  // Process images to preserve structure
  const images = tempDiv.querySelectorAll('img');
  images.forEach((img, index) => {
    const imageText = `[IMAGE ${index + 1}: ${img.alt || 'No description'}]`;
    const placeholder = document.createElement('div');
    placeholder.textContent = imageText;
    img.parentNode.replaceChild(placeholder, img);
  });
  
  // Get text content with basic structure preservation
  let text = tempDiv.textContent || '';
  
  // Clean up excessive whitespace while preserving line breaks
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n'); // Multiple line breaks to double
  text = text.replace(/[ \t]+/g, ' '); // Multiple spaces to single
  text = text.trim();
  
  return text;
};

// Extract text from table while preserving structure
const extractTableText = (table) => {
  const rows = table.querySelectorAll('tr');
  return Array.from(rows).map(row => {
    const cells = row.querySelectorAll('td, th');
    return Array.from(cells).map(cell => cell.textContent?.trim() || '').join(' | ');
  }).join('\n');
};

export const validateFile = (file) => {
  const validTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ];
  
  const validExtensions = ['.docx', '.doc'];
  const hasValidType = validTypes.includes(file.type);
  const hasValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
  
  return hasValidType || hasValidExtension;
};
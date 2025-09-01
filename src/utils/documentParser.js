import { renderAsync } from 'docx-preview';

export const parseWordDocument = async (file, onProgress) => {
  try {
    if (onProgress) onProgress('Reading file data...');
    const arrayBuffer = await file.arrayBuffer();
    
    if (onProgress) onProgress('Rendering document...');
    
    // Create container for rendering
    const container = document.createElement('div');
    container.className = 'word-document-preview';
    
    // Simplified options for better compatibility and performance
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
      experimental: false,
      trimXmlDeclaration: true
    };
    
    await renderAsync(arrayBuffer, container, null, options);
    
    if (onProgress) onProgress('Processing content...');
    
    // Wait for rendering to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Get the rendered HTML
    const htmlContent = container.innerHTML;
    
    if (!htmlContent || htmlContent.trim() === '') {
      throw new Error('Document appears to be empty or corrupted');
    }
    
    // Extract plain text for comparison
    const plainText = extractPlainTextWithStructure(htmlContent);
    
    if (onProgress) onProgress('Complete');
    
    return {
      content: plainText,
      htmlContent: htmlContent,
      originalHtmlContent: htmlContent
    };
  } catch (error) {
    console.error('Error parsing document:', error);
    throw new Error(`Failed to parse document: ${error.message}`);
  }
};

const extractPlainTextWithStructure = (html) => {
  if (!html) return '';
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Remove script and style elements
  const scripts = tempDiv.querySelectorAll('script, style');
  scripts.forEach(el => el.remove());
  
  // Get text content with basic structure preservation
  let text = tempDiv.textContent || '';
  
  // Clean up excessive whitespace while preserving line breaks
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n'); // Multiple line breaks to double
  text = text.replace(/[ \t]+/g, ' '); // Multiple spaces to single
  text = text.trim();
  
  return text;
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
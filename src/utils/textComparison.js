import { diffChars, diffWordsWithSpace } from "diff";
import { diff_match_patch } from 'diff-match-patch';

export const compareDocuments = (leftText, rightText) => {
  const diffs = diffChars(leftText, rightText);
  const leftDiffs = [];
  const rightDiffs = [];
  let summary = { additions: 0, deletions: 0, changes: 0 };

  diffs.forEach((diff) => {
    if (diff.added) {
      rightDiffs.push({ type: "insert", content: diff.value });
      summary.additions++;
    } else if (diff.removed) {
      leftDiffs.push({ type: "delete", content: diff.value });
      summary.deletions++;
    } else {
      leftDiffs.push({ type: "equal", content: diff.value });
      rightDiffs.push({ type: "equal", content: diff.value });
    }
  });

  summary.changes = summary.additions + summary.deletions;
  return { leftDiffs, rightDiffs, summary };
};

export const compareHtmlDocuments = async (leftHtml, rightHtml) => {
  return new Promise((resolve) => {
    // Use requestIdleCallback for better performance
    const performComparison = () => {
      try {
        console.log('Starting optimized mutual document comparison...');
        
        // Quick text comparison first
        const leftText = extractPlainText(leftHtml);
        const rightText = extractPlainText(rightHtml);

        if (leftText.trim() === rightText.trim()) {
          console.log('Documents are identical');
          resolve({
            leftDiffs: [{ type: "equal", content: leftHtml }],
            rightDiffs: [{ type: "equal", content: rightHtml }],
            summary: { additions: 0, deletions: 0, changes: 0 },
            detailed: { lines: [], tables: [], images: [] }
          });
          return;
        }

        console.log('Documents differ, performing mutual comparison...');
        
        // Perform optimized mutual comparison
        const result = performOptimizedMutualComparison(leftHtml, rightHtml);
        console.log('Comparison completed successfully');
        resolve(result);
        
      } catch (error) {
        console.error("Error during document comparison:", error);
        resolve({
          leftDiffs: [{ type: "equal", content: leftHtml }],
          rightDiffs: [{ type: "equal", content: rightHtml }],
          summary: { additions: 0, deletions: 0, changes: 0 },
          detailed: { lines: [], tables: [], images: [] },
        });
      }
    };

    // Use requestIdleCallback if available, otherwise setTimeout
    if (window.requestIdleCallback) {
      window.requestIdleCallback(performComparison, { timeout: 1000 });
    } else {
      setTimeout(performComparison, 0);
    }
  });
};

// Optimized mutual comparison that handles tables and images
const performOptimizedMutualComparison = (leftHtml, rightHtml) => {
  const leftDiv = htmlToDiv(leftHtml);
  const rightDiv = htmlToDiv(rightHtml);

  // Extract all content elements including tables and images
  const leftElements = extractAllElements(leftDiv);
  const rightElements = extractAllElements(rightDiv);

  console.log(`Comparing ${leftElements.length} vs ${rightElements.length} elements`);

  // Perform mutual comparison with tables and images
  const { leftProcessed, rightProcessed, summary } = performMutualElementComparison(leftElements, rightElements);

  // Apply the processed content back to the divs
  applyProcessedElementsToDiv(leftDiv, leftProcessed);
  applyProcessedElementsToDiv(rightDiv, rightProcessed);

  const detailed = generateDetailedReport(leftElements, rightElements);

  return {
    leftDiffs: [{ type: "equal", content: leftDiv.innerHTML }],
    rightDiffs: [{ type: "equal", content: rightDiv.innerHTML }],
    summary,
    detailed
  };
};

// Extract all elements including paragraphs, headings, tables, and images
const extractAllElements = (container) => {
  const elements = [];
  const allNodes = container.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, table, img, div');
  
  allNodes.forEach((element, index) => {
    // Skip nested elements (except for tables and images which are standalone)
    if (element.tagName === 'TABLE' || element.tagName === 'IMG') {
      // Always include tables and images
      const text = element.tagName === 'TABLE' ? extractTableText(element) : (element.alt || `Image ${index + 1}`);
      elements.push({
        element,
        text,
        html: element.outerHTML,
        index,
        tagName: element.tagName.toLowerCase(),
        isEmpty: !text.trim(),
        isTable: element.tagName === 'TABLE',
        isImage: element.tagName === 'IMG'
      });
    } else if (!element.closest('table') && !element.querySelector('p, h1, h2, h3, h4, h5, h6, li, table, img')) {
      // Include text elements that aren't nested
      const text = (element.textContent || '').trim();
      elements.push({
        element,
        text,
        html: element.innerHTML || '',
        index,
        tagName: element.tagName.toLowerCase(),
        isEmpty: !text,
        isTable: false,
        isImage: false
      });
    }
  });
  
  return elements;
};

// Extract text from table while preserving structure
const extractTableText = (table) => {
  const rows = table.querySelectorAll('tr');
  return Array.from(rows).map(row => {
    const cells = row.querySelectorAll('td, th');
    return Array.from(cells).map(cell => cell.textContent?.trim() || '').join(' | ');
  }).join('\n');
};

// Perform mutual element comparison including tables and images
const performMutualElementComparison = (leftElements, rightElements) => {
  const leftProcessed = [];
  const rightProcessed = [];
  let additions = 0, deletions = 0;

  // Create alignment between elements
  const maxElements = Math.max(leftElements.length, rightElements.length);
  
  for (let i = 0; i < maxElements; i++) {
    const leftElement = leftElements[i];
    const rightElement = rightElements[i];
    
    if (leftElement && rightElement) {
      // Both elements exist - compare based on type
      if (leftElement.isTable && rightElement.isTable) {
        // Compare tables
        const tablesEqual = compareTableContent(leftElement.element, rightElement.element);
        if (tablesEqual) {
          leftProcessed.push({ ...leftElement, highlight: 'none' });
          rightProcessed.push({ ...rightElement, highlight: 'none' });
        } else {
          leftProcessed.push({ ...leftElement, highlight: 'modified' });
          rightProcessed.push({ ...rightElement, highlight: 'modified' });
          additions++;
          deletions++;
        }
      } else if (leftElement.isImage && rightElement.isImage) {
        // Compare images
        const imagesEqual = leftElement.element.src === rightElement.element.src && 
                           leftElement.element.alt === rightElement.element.alt;
        if (imagesEqual) {
          leftProcessed.push({ ...leftElement, highlight: 'none' });
          rightProcessed.push({ ...rightElement, highlight: 'none' });
        } else {
          leftProcessed.push({ ...leftElement, highlight: 'modified' });
          rightProcessed.push({ ...rightElement, highlight: 'modified' });
          additions++;
          deletions++;
        }
      } else if (leftElement.isEmpty && rightElement.isEmpty) {
        // Both empty - no highlighting
        leftProcessed.push({ ...leftElement, highlight: 'none' });
        rightProcessed.push({ ...rightElement, highlight: 'none' });
      } else if (leftElement.isEmpty && !rightElement.isEmpty) {
        // Left empty, right has content - show as addition
        leftProcessed.push({ 
          ...leftElement, 
          highlight: 'empty-space-added',
          placeholderText: rightElement.text,
          placeholderType: rightElement.isTable ? 'table' : rightElement.isImage ? 'image' : 'text'
        });
        rightProcessed.push({ ...rightElement, highlight: 'added' });
        additions++;
      } else if (!leftElement.isEmpty && rightElement.isEmpty) {
        // Left has content, right empty - show as deletion
        leftProcessed.push({ ...leftElement, highlight: 'removed' });
        rightProcessed.push({ 
          ...rightElement, 
          highlight: 'empty-space-removed',
          placeholderText: leftElement.text,
          placeholderType: leftElement.isTable ? 'table' : leftElement.isImage ? 'image' : 'text'
        });
        deletions++;
      } else if (areElementsEqual(leftElement, rightElement)) {
        // Same content - no highlighting
        leftProcessed.push({ ...leftElement, highlight: 'none' });
        rightProcessed.push({ ...rightElement, highlight: 'none' });
      } else {
        // Different content - show as modified with detailed diff
        if (leftElement.isTable || rightElement.isTable || leftElement.isImage || rightElement.isImage) {
          // Structural difference
          leftProcessed.push({ ...leftElement, highlight: 'modified' });
          rightProcessed.push({ ...rightElement, highlight: 'modified' });
        } else {
          // Text difference - perform word-level diff
          const { leftHighlighted, rightHighlighted } = performWordLevelDiff(leftElement.html, rightElement.html);
          leftProcessed.push({ 
            ...leftElement, 
            highlight: 'modified',
            processedHtml: leftHighlighted 
          });
          rightProcessed.push({ 
            ...rightElement, 
            highlight: 'modified',
            processedHtml: rightHighlighted 
          });
        }
        additions++;
        deletions++;
      }
    } else if (leftElement && !rightElement) {
      // Only left element exists - show as removed
      leftProcessed.push({ ...leftElement, highlight: 'removed' });
      rightProcessed.push({ 
        element: null, 
        text: '', 
        html: '', 
        isEmpty: true, 
        highlight: 'empty-space-removed',
        placeholderText: leftElement.text,
        placeholderType: leftElement.isTable ? 'table' : leftElement.isImage ? 'image' : 'text',
        tagName: leftElement.tagName 
      });
      deletions++;
    } else if (!leftElement && rightElement) {
      // Only right element exists - show as added
      leftProcessed.push({ 
        element: null, 
        text: '', 
        html: '', 
        isEmpty: true, 
        highlight: 'empty-space-added',
        placeholderText: rightElement.text,
        placeholderType: rightElement.isTable ? 'table' : rightElement.isImage ? 'image' : 'text',
        tagName: rightElement.tagName 
      });
      rightProcessed.push({ ...rightElement, highlight: 'added' });
      additions++;
    }
  }

  return {
    leftProcessed,
    rightProcessed,
    summary: { additions, deletions, changes: additions + deletions }
  };
};

// Compare table content for equality
const compareTableContent = (table1, table2) => {
  const text1 = extractTableText(table1);
  const text2 = extractTableText(table2);
  return text1 === text2;
};

// Check if elements are equal
const areElementsEqual = (element1, element2) => {
  if (element1.isTable && element2.isTable) {
    return compareTableContent(element1.element, element2.element);
  }
  if (element1.isImage && element2.isImage) {
    return element1.element.src === element2.element.src && 
           element1.element.alt === element2.element.alt;
  }
  return areTextsEqual(element1.text, element2.text);
};

// Apply processed elements back to the document
const applyProcessedElementsToDiv = (container, processedElements) => {
  // Clear existing content
  container.innerHTML = '';
  
  processedElements.forEach(element => {
    let newElement;
    
    if (element.element) {
      // Use existing element
      newElement = element.element.cloneNode(true);
    } else {
      // Create placeholder element
      if (element.placeholderType === 'table') {
        newElement = document.createElement('div');
        newElement.className = 'table-placeholder';
      } else if (element.placeholderType === 'image') {
        newElement = document.createElement('div');
        newElement.className = 'image-placeholder';
      } else {
        newElement = document.createElement(element.tagName || 'p');
      }
    }
    
    // Apply highlighting classes
    switch (element.highlight) {
      case 'added':
        newElement.classList.add('git-line-added');
        if (element.isTable) newElement.classList.add('git-table-added');
        if (element.isImage) newElement.classList.add('git-image-added');
        if (element.processedHtml) newElement.innerHTML = element.processedHtml;
        break;
      case 'removed':
        newElement.classList.add('git-line-removed');
        if (element.isTable) newElement.classList.add('git-table-removed');
        if (element.isImage) newElement.classList.add('git-image-removed');
        if (element.processedHtml) newElement.innerHTML = element.processedHtml;
        break;
      case 'modified':
        newElement.classList.add('git-line-modified');
        if (element.isTable) newElement.classList.add('git-table-modified');
        if (element.isImage) newElement.classList.add('git-image-modified');
        if (element.processedHtml) newElement.innerHTML = element.processedHtml;
        break;
      case 'empty-space-added':
        newElement.classList.add('git-line-placeholder', 'placeholder-added');
        const addedIcon = element.placeholderType === 'table' ? '📊' : element.placeholderType === 'image' ? '🖼️' : '📝';
        newElement.innerHTML = `<span style="color: #166534; font-style: italic; opacity: 0.8;">${addedIcon} [Empty space - ${element.placeholderType} added: "${element.placeholderText?.substring(0, 50)}${element.placeholderText?.length > 50 ? '...' : ''}"]</span>`;
        break;
      case 'empty-space-removed':
        newElement.classList.add('git-line-placeholder', 'placeholder-removed');
        const removedIcon = element.placeholderType === 'table' ? '📊' : element.placeholderType === 'image' ? '🖼️' : '📝';
        newElement.innerHTML = `<span style="color: #991b1b; font-style: italic; opacity: 0.8;">${removedIcon} [Empty space - ${element.placeholderType} removed: "${element.placeholderText?.substring(0, 50)}${element.placeholderText?.length > 50 ? '...' : ''}"]</span>`;
        break;
      default:
        if (element.processedHtml) {
          newElement.innerHTML = element.processedHtml;
        }
    }
    
    container.appendChild(newElement);
  });
};

// Perform word-level diff between two HTML contents
const performWordLevelDiff = (leftHtml, rightHtml) => {
  const leftText = extractPlainText(leftHtml);
  const rightText = extractPlainText(rightHtml);
  
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(leftText, rightText);
  dmp.diff_cleanupSemantic(diffs);
  
  const leftHighlighted = applyDiffHighlighting(diffs, 'left');
  const rightHighlighted = applyDiffHighlighting(diffs, 'right');
  
  return { leftHighlighted, rightHighlighted };
};

// Apply diff highlighting for mutual comparison
const applyDiffHighlighting = (diffs, side) => {
  let html = '';
  
  diffs.forEach(diff => {
    const [operation, text] = diff;
    
    if (operation === 0) {
      // Unchanged text
      html += escapeHtml(text);
    } else if (operation === 1) {
      // Added text
      if (side === 'right') {
        html += `<span class="git-inline-added">${escapeHtml(text)}</span>`;
      } else {
        html += `<span class="git-inline-placeholder" style="color: #22c55e; font-style: italic; opacity: 0.7; background: #f0fdf4; padding: 1px 3px; border-radius: 2px;">[+${escapeHtml(text)}]</span>`;
      }
    } else if (operation === -1) {
      // Removed text
      if (side === 'left') {
        html += `<span class="git-inline-removed">${escapeHtml(text)}</span>`;
      } else {
        html += `<span class="git-inline-placeholder" style="color: #ef4444; font-style: italic; opacity: 0.7; background: #fef2f2; padding: 1px 3px; border-radius: 2px;">[-${escapeHtml(text)}]</span>`;
      }
    }
  });
  
  return html;
};

// Text similarity and equality functions
const areTextsEqual = (text1, text2) => {
  const normalize = (text) => text.trim().replace(/\s+/g, ' ').toLowerCase();
  return normalize(text1) === normalize(text2);
};

const htmlToDiv = (html) => {
  if (!html) return document.createElement("div");
  
  const d = document.createElement("div");
  try {
    d.innerHTML = html;
  } catch (error) {
    console.warn('Error parsing HTML:', error);
  }
  return d;
};

const extractPlainText = (html) => {
  if (!html) return "";
  
  const tempDiv = document.createElement("div");
  try {
    tempDiv.innerHTML = html;
  } catch (error) {
    console.warn('Error extracting plain text:', error);
    return "";
  }
  return tempDiv.textContent || "";
};

export const renderHtmlDifferences = (diffs) => {
  return diffs.map((d) => d.content).join("");
};

export const highlightDifferences = (diffs) => {
  return diffs
    .map((diff) => {
      switch (diff.type) {
        case "insert":
          return `<span class=\"diff-insert\">${escapeHtml(
            diff.content
          )}</span>`;
        case "delete":
          return `<span class=\"diff-delete\">${escapeHtml(
            diff.content
          )}</span>`;
        default:
          return escapeHtml(diff.content);
      }
    })
    .join("");
};

const escapeHtml = (text) => {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
};

// Generate detailed report including tables and images
const generateDetailedReport = (leftElements, rightElements) => {
  try {
    const lines = [];
    const tables = [];
    const images = [];
    const maxElements = Math.max(leftElements.length, rightElements.length);
    
    for (let i = 0; i < maxElements; i++) {
      const leftElement = leftElements[i];
      const rightElement = rightElements[i];
      
      if (leftElement?.isTable || rightElement?.isTable) {
        // Handle table comparison
        if (leftElement?.isTable && rightElement?.isTable) {
          const tablesEqual = compareTableContent(leftElement.element, rightElement.element);
          tables.push({
            table: i + 1,
            status: tablesEqual ? "UNCHANGED" : "MODIFIED",
            diffHtml: tablesEqual ? escapeHtml(leftElement.text) : createInlineDiff(leftElement.text, rightElement.text)
          });
        } else if (leftElement?.isTable && !rightElement?.isTable) {
          tables.push({
            table: i + 1,
            status: "REMOVED",
            diffHtml: `<span class="git-inline-removed">${escapeHtml(leftElement.text)}</span>`
          });
        } else if (!leftElement?.isTable && rightElement?.isTable) {
          tables.push({
            table: i + 1,
            status: "ADDED",
            diffHtml: `<span class="git-inline-added">${escapeHtml(rightElement.text)}</span>`
          });
        }
      } else if (leftElement?.isImage || rightElement?.isImage) {
        // Handle image comparison
        if (leftElement?.isImage && rightElement?.isImage) {
          const imagesEqual = leftElement.element.src === rightElement.element.src;
          images.push({
            index: i + 1,
            status: imagesEqual ? "UNCHANGED" : "MODIFIED"
          });
        } else if (leftElement?.isImage && !rightElement?.isImage) {
          images.push({
            index: i + 1,
            status: "REMOVED"
          });
        } else if (!leftElement?.isImage && rightElement?.isImage) {
          images.push({
            index: i + 1,
            status: "ADDED"
          });
        }
      } else {
        // Handle text comparison
        if (leftElement && rightElement) {
          if (areTextsEqual(leftElement.text, rightElement.text)) {
            lines.push({
              v1: String(i + 1),
              v2: String(i + 1),
              status: "UNCHANGED",
              diffHtml: escapeHtml(leftElement.text),
              formatChanges: []
            });
          } else {
            const diffHtml = createInlineDiff(leftElement.text, rightElement.text);
            lines.push({
              v1: String(i + 1),
              v2: String(i + 1),
              status: "MODIFIED",
              diffHtml,
              formatChanges: ["Content modified"]
            });
          }
        } else if (leftElement && !rightElement) {
          lines.push({
            v1: String(i + 1),
            v2: "",
            status: "REMOVED",
            diffHtml: `<span class="git-inline-removed">${escapeHtml(leftElement.text)}</span>`,
            formatChanges: ["Line removed"]
          });
        } else if (!leftElement && rightElement) {
          lines.push({
            v1: "",
            v2: String(i + 1),
            status: "ADDED",
            diffHtml: `<span class="git-inline-added">${escapeHtml(rightElement.text)}</span>`,
            formatChanges: ["Line added"]
          });
        }
      }
    }

    return { lines, tables, images };
  } catch (error) {
    console.error('Error generating detailed report:', error);
    return { lines: [], tables: [], images: [] };
  }
};

// Create inline diff for detailed report
const createInlineDiff = (leftText, rightText) => {
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(leftText || "", rightText || "");
  dmp.diff_cleanupSemantic(diffs);
  
  return diffs.map(diff => {
    const [operation, text] = diff;
    const escaped = escapeHtml(text);
    
    if (operation === 1) return `<span class="git-inline-added">${escaped}</span>`;
    if (operation === -1) return `<span class="git-inline-removed">${escaped}</span>`;
    return escaped;
  }).join("");
};
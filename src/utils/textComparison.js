import { diffChars, diffWordsWithSpace, diffArrays, diffSentences } from "diff";
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

export const compareHtmlDocuments = (leftHtml, rightHtml) => {
  try {
    console.log('Starting document comparison...');
    
    // First, check if documents are identical
    const leftText = extractPlainText(leftHtml);
    const rightText = extractPlainText(rightHtml);

    if (leftText.trim() === rightText.trim()) {
      // Documents are identical, return original content without any highlighting
      const leftDiffs = [{ type: "equal", content: leftHtml }];
      const rightDiffs = [{ type: "equal", content: rightHtml }];
      const summary = { additions: 0, deletions: 0, changes: 0 };
      const detailed = { lines: [], tables: [], images: [] };
      return { leftDiffs, rightDiffs, summary, detailed };
    }

    console.log('Documents differ, performing detailed comparison...');
    
    // Check if we're in a browser environment
    if (typeof document === "undefined") {
      console.error("Document comparison requires browser environment");
      return {
        leftDiffs: [{ type: "equal", content: leftHtml }],
        rightDiffs: [{ type: "equal", content: rightHtml }],
        summary: { additions: 0, deletions: 0, changes: 0 },
        detailed: { lines: [], tables: [], images: [] },
      };
    }

    console.log('Applying block-level comparison...');
    // Apply mutual block-level comparison
    const { leftWithBlocks, rightWithBlocks, blockSummary } = 
      applyMutualBlockComparison(leftHtml, rightHtml);

    console.log('Applying structural comparisons...');
    // Apply mutual structural comparisons
    const { leftWithImages, rightWithImages, imageSummary } =
      applyMutualImageComparison(leftWithBlocks, rightWithBlocks);
    
    const { leftWithTables, rightWithTables, tableSummary } = 
      applyMutualTableComparison(leftWithImages, rightWithImages);

    console.log('Applying word-level comparison...');
    // Apply mutual word-level text comparison
    const { leftFinal, rightFinal, textSummary } =
      applyMutualWordLevelComparison(leftWithTables, rightWithTables);

    const summary = {
      additions: blockSummary.additions + imageSummary.additions + tableSummary.additions + textSummary.additions,
      deletions: blockSummary.deletions + imageSummary.deletions + tableSummary.deletions + textSummary.deletions,
      changes: 0
    };
    summary.changes = summary.additions + summary.deletions;

    console.log('Generating detailed report...');
    const detailed = generateDetailedReport(leftHtml, rightHtml);

    console.log('Comparison completed successfully');
    const leftDiffs = [{ type: "equal", content: leftFinal }];
    const rightDiffs = [{ type: "equal", content: rightFinal }];

    return { leftDiffs, rightDiffs, summary, detailed };
  } catch (error) {
    console.error("Error during document comparison:", error);
    console.error("Error stack:", error.stack);
    // Return original content on error
    return {
      leftDiffs: [{ type: "equal", content: leftHtml }],
      rightDiffs: [{ type: "equal", content: rightHtml }],
      summary: { additions: 0, deletions: 0, changes: 0 },
      detailed: { lines: [], tables: [], images: [] },
    };
  }
};

// Mutual block-level comparison - both documents show all changes
const applyMutualBlockComparison = (leftHtml, rightHtml) => {
  try {
  const leftDiv = htmlToDiv(leftHtml);
  const rightDiv = htmlToDiv(rightHtml);

  const leftBlocks = extractBlocks(leftDiv);
  const rightBlocks = extractBlocks(rightDiv);

  // Create alignment between blocks
  const alignment = alignBlocks(leftBlocks, rightBlocks);
  
  let additions = 0, deletions = 0;

  // Apply highlighting based on alignment
  alignment.forEach(({ left, right, type }) => {
    if (type === 'added') {
      // Block exists only in right document
      if (right) {
        right.element.classList.add('git-line-added');
        additions++;
        
        // Create placeholder in left document
        const placeholder = createPlaceholderBlock(right.element, 'removed');
        // insertPlaceholderInLeft(leftDiv, placeholder, right.index);
      }
    } else if (type === 'removed') {
      // Block exists only in left document
      if (left) {
        left.element.classList.add('git-line-removed');
        deletions++;
        
        // Create placeholder in right document
        const placeholder = createPlaceholderBlock(left.element, 'added');
        // insertPlaceholderInRight(rightDiv, placeholder, left.index);
      }
    } else if (type === 'modified') {
      // Block exists in both but content differs
      if (left && right) {
        left.element.classList.add('git-line-modified');
        right.element.classList.add('git-line-modified');
        additions++;
        deletions++;
      }
    }
    // 'equal' blocks remain unchanged
  });

  return {
    leftWithBlocks: leftDiv.innerHTML,
    rightWithBlocks: rightDiv.innerHTML,
    blockSummary: { additions, deletions }
  };
  } catch (error) {
    console.error('Error in block comparison:', error);
    return {
      leftWithBlocks: leftHtml,
      rightWithBlocks: rightHtml,
      blockSummary: { additions: 0, deletions: 0 }
    };
  }
};

// Extract blocks for comparison
const extractBlocks = (container) => {
  const blocks = [];
  const blockElements = container.querySelectorAll('p, h1, h2, h3, h4, h5, h6, div, li');
  
  blockElements.forEach((element, index) => {
    // Skip if element is inside a table or already processed
    if (isInsideTable(element) || element.closest('.placeholder-block')) {
      return;
    }
    
    const text = (element.textContent || '').trim();
    const tagName = element.tagName.toLowerCase();
    
    blocks.push({
      element,
      text,
      tagName,
      index,
      id: generateBlockId(element, text, index)
    });
  });
  
  return blocks;
};

// Generate unique ID for block matching
const generateBlockId = (element, text, index) => {
  const tagName = element.tagName.toLowerCase();
  const textHash = text.substring(0, 50); // First 50 chars for matching
  return `${tagName}-${textHash}-${index}`;
};

// Align blocks between documents for comparison
const alignBlocks = (leftBlocks, rightBlocks) => {
  const alignment = [];
  const leftUsed = new Set();
  const rightUsed = new Set();

  // First pass: exact matches
  leftBlocks.forEach((leftBlock, leftIndex) => {
    const rightIndex = rightBlocks.findIndex((rightBlock, idx) => 
      !rightUsed.has(idx) && 
      leftBlock.tagName === rightBlock.tagName &&
      areTextsEqual(leftBlock.text, rightBlock.text)
    );
    
    if (rightIndex !== -1) {
      alignment.push({
        left: leftBlock,
        right: rightBlocks[rightIndex],
        type: 'equal'
      });
      leftUsed.add(leftIndex);
      rightUsed.add(rightIndex);
    }
  });

  // Second pass: similar content matches
  leftBlocks.forEach((leftBlock, leftIndex) => {
    if (leftUsed.has(leftIndex)) return;
    
    const rightIndex = rightBlocks.findIndex((rightBlock, idx) => 
      !rightUsed.has(idx) && 
      leftBlock.tagName === rightBlock.tagName &&
      getTextSimilarity(leftBlock.text, rightBlock.text) > 0.6
    );
    
    if (rightIndex !== -1) {
      alignment.push({
        left: leftBlock,
        right: rightBlocks[rightIndex],
        type: 'modified'
      });
      leftUsed.add(leftIndex);
      rightUsed.add(rightIndex);
    }
  });

  // Third pass: unmatched blocks
  leftBlocks.forEach((leftBlock, leftIndex) => {
    if (!leftUsed.has(leftIndex)) {
      alignment.push({
        left: leftBlock,
        right: null,
        type: 'removed'
      });
    }
  });

  rightBlocks.forEach((rightBlock, rightIndex) => {
    if (!rightUsed.has(rightIndex)) {
      alignment.push({
        left: null,
        right: rightBlock,
        type: 'added'
      });
    }
  });

  return alignment.sort((a, b) => {
    const aIndex = a.left?.index ?? a.right?.index ?? 0;
    const bIndex = b.left?.index ?? b.right?.index ?? 0;
    return aIndex - bIndex;
  });
};

// Create placeholder block with same dimensions
const createPlaceholderBlock = (originalElement, type) => {
  const placeholder = document.createElement(originalElement.tagName);
  placeholder.className = `placeholder-block git-line-placeholder ${type === 'added' ? 'placeholder-added' : 'placeholder-removed'}`;
  
  // Copy dimensions and styling
  const computedStyle = window.getComputedStyle(originalElement);
  placeholder.style.height = computedStyle.height;
  placeholder.style.minHeight = computedStyle.minHeight || '20px';
  placeholder.style.width = computedStyle.width;
  placeholder.style.margin = computedStyle.margin;
  placeholder.style.padding = computedStyle.padding;
  placeholder.style.border = '2px dashed ' + (type === 'added' ? '#22c55e' : '#ef4444');
  placeholder.style.backgroundColor = type === 'added' ? '#f0fdf4' : '#fef2f2';
  placeholder.style.borderRadius = '4px';
  placeholder.style.opacity = '0.7';
  
  // Add indicator text
  const indicator = document.createElement('span');
  indicator.style.color = type === 'added' ? '#166534' : '#991b1b';
  indicator.style.fontSize = '12px';
  indicator.style.fontStyle = 'italic';
  indicator.textContent = type === 'added' ? '[Content added in other document]' : '[Content removed in other document]';
  placeholder.appendChild(indicator);
  
  return placeholder;
};

// Insert placeholder in appropriate position
// const insertPlaceholderInLeft = (leftDiv, placeholder, targetIndex) => {
//   const blocks = leftDiv.querySelectorAll('p, h1, h2, h3, h4, h5, h6, div, li');
//   if (targetIndex < blocks.length) {
//     blocks[targetIndex].parentNode.insertBefore(placeholder, blocks[targetIndex]);
//   } else {
//     leftDiv.appendChild(placeholder);
//   }
// };

// const insertPlaceholderInRight = (rightDiv, placeholder, targetIndex) => {
//   const blocks = rightDiv.querySelectorAll('p, h1, h2, h3, h4, h5, h6, div, li');
//   if (targetIndex < blocks.length) {
//     blocks[targetIndex].parentNode.insertBefore(placeholder, blocks[targetIndex]);
//   } else {
//     rightDiv.appendChild(placeholder);
//   }
// };

// Mutual image comparison
const applyMutualImageComparison = (leftHtml, rightHtml) => {
  try {
  const leftDiv = htmlToDiv(leftHtml);
  const rightDiv = htmlToDiv(rightHtml);

  const leftImages = Array.from(leftDiv.querySelectorAll("img"));
  const rightImages = Array.from(rightDiv.querySelectorAll("img"));

  let additions = 0, deletions = 0;

  // Compare images by position and src
  const maxImages = Math.max(leftImages.length, rightImages.length);
  
  for (let i = 0; i < maxImages; i++) {
    const leftImg = leftImages[i];
    const rightImg = rightImages[i];
    
    if (leftImg && !rightImg) {
      // Image removed - show in left as removed, create placeholder in right
      leftImg.classList.add("structural-removed");
      deletions++;
      
      const placeholder = createImagePlaceholder(leftImg, 'added');
      insertImagePlaceholder(rightDiv, placeholder, i);
    } else if (!leftImg && rightImg) {
      // Image added - show in right as added, create placeholder in left
      rightImg.classList.add("structural-added");
      additions++;
      
      const placeholder = createImagePlaceholder(rightImg, 'removed');
      insertImagePlaceholder(leftDiv, placeholder, i);
    } else if (leftImg && rightImg) {
      const leftSrc = leftImg.getAttribute("src") || "";
      const rightSrc = rightImg.getAttribute("src") || "";
      
      if (leftSrc !== rightSrc) {
        // Image modified
        leftImg.classList.add("structural-modified");
        rightImg.classList.add("structural-modified");
        additions++;
        deletions++;
      }
    }
  }

  return {
    leftWithImages: leftDiv.innerHTML,
    rightWithImages: rightDiv.innerHTML,
    imageSummary: { additions, deletions }
  };
  } catch (error) {
    console.error('Error in image comparison:', error);
    return {
      leftWithImages: leftHtml,
      rightWithImages: rightHtml,
      imageSummary: { additions: 0, deletions: 0 }
    };
  }
};

// Create image placeholder
const createImagePlaceholder = (originalImg, type) => {
  const placeholder = document.createElement('div');
  placeholder.className = `image-placeholder ${type === 'added' ? 'placeholder-added' : 'placeholder-removed'}`;
  
  // Copy dimensions
  const rect = originalImg.getBoundingClientRect();
  placeholder.style.width = originalImg.style.width || `${rect.width}px` || '200px';
  placeholder.style.height = originalImg.style.height || `${rect.height}px` || '150px';
  placeholder.style.border = '2px dashed ' + (type === 'added' ? '#22c55e' : '#ef4444');
  placeholder.style.backgroundColor = type === 'added' ? '#f0fdf4' : '#fef2f2';
  placeholder.style.borderRadius = '4px';
  placeholder.style.display = 'flex';
  placeholder.style.alignItems = 'center';
  placeholder.style.justifyContent = 'center';
  placeholder.style.margin = originalImg.style.margin || '8px 0';
  placeholder.style.opacity = '0.8';
  
  // Add indicator
  const indicator = document.createElement('span');
  indicator.style.color = type === 'added' ? '#166534' : '#991b1b';
  indicator.style.fontSize = '14px';
  indicator.style.fontWeight = 'bold';
  indicator.textContent = type === 'added' ? '[Image Added]' : '[Image Removed]';
  placeholder.appendChild(indicator);
  
  return placeholder;
};

// Insert image placeholder at correct position
const insertImagePlaceholder = (container, placeholder, targetIndex) => {
  const images = container.querySelectorAll('img');
  if (targetIndex < images.length) {
    images[targetIndex].parentNode.insertBefore(placeholder, images[targetIndex]);
  } else {
    // Find last image's parent and append after it
    const lastImg = images[images.length - 1];
    if (lastImg) {
      lastImg.parentNode.insertBefore(placeholder, lastImg.nextSibling);
    } else {
      container.appendChild(placeholder);
    }
  }
};

// Mutual table comparison
const applyMutualTableComparison = (leftHtml, rightHtml) => {
  try {
  const leftDiv = htmlToDiv(leftHtml);
  const rightDiv = htmlToDiv(rightHtml);

  const leftTables = Array.from(leftDiv.querySelectorAll("table"));
  const rightTables = Array.from(rightDiv.querySelectorAll("table"));

  let additions = 0, deletions = 0;

  const maxTables = Math.max(leftTables.length, rightTables.length);
  
  for (let t = 0; t < maxTables; t++) {
    const leftTable = leftTables[t];
    const rightTable = rightTables[t];
    
    if (leftTable && !rightTable) {
      // Table removed
      leftTable.classList.add("structural-removed");
      deletions++;
      
      const placeholder = createTablePlaceholder(leftTable, 'added');
      insertTablePlaceholder(rightDiv, placeholder, t);
    } else if (!leftTable && rightTable) {
      // Table added
      rightTable.classList.add("structural-added");
      additions++;
      
      const placeholder = createTablePlaceholder(rightTable, 'removed');
      insertTablePlaceholder(leftDiv, placeholder, t);
    } else if (leftTable && rightTable) {
      // Compare table contents
      const { tableAdditions, tableDeletions } = compareTableContents(leftTable, rightTable);
      additions += tableAdditions;
      deletions += tableDeletions;
    }
  }

  return {
    leftWithTables: leftDiv.innerHTML,
    rightWithTables: rightDiv.innerHTML,
    tableSummary: { additions, deletions }
  };
  } catch (error) {
    console.error('Error in table comparison:', error);
    return {
      leftWithTables: leftHtml,
      rightWithTables: rightHtml,
      tableSummary: { additions: 0, deletions: 0 }
    };
  }
};

// Create table placeholder
const createTablePlaceholder = (originalTable, type) => {
  const placeholder = document.createElement('div');
  placeholder.className = `table-placeholder ${type === 'added' ? 'placeholder-added' : 'placeholder-removed'}`;
  
  // Copy table dimensions
  const rect = originalTable.getBoundingClientRect();
  placeholder.style.width = originalTable.style.width || '100%';
  placeholder.style.height = originalTable.style.height || `${rect.height}px` || '100px';
  placeholder.style.border = '2px dashed ' + (type === 'added' ? '#22c55e' : '#ef4444');
  placeholder.style.backgroundColor = type === 'added' ? '#f0fdf4' : '#fef2f2';
  placeholder.style.borderRadius = '4px';
  placeholder.style.display = 'flex';
  placeholder.style.alignItems = 'center';
  placeholder.style.justifyContent = 'center';
  placeholder.style.margin = originalTable.style.margin || '16px 0';
  placeholder.style.opacity = '0.8';
  
  // Add indicator
  const indicator = document.createElement('span');
  indicator.style.color = type === 'added' ? '#166534' : '#991b1b';
  indicator.style.fontSize = '14px';
  indicator.style.fontWeight = 'bold';
  indicator.textContent = type === 'added' ? '[Table Added]' : '[Table Removed]';
  placeholder.appendChild(indicator);
  
  return placeholder;
};

// Insert table placeholder
const insertTablePlaceholder = (container, placeholder, targetIndex) => {
  const tables = container.querySelectorAll('table');
  if (targetIndex < tables.length) {
    tables[targetIndex].parentNode.insertBefore(placeholder, tables[targetIndex]);
  } else {
    const lastTable = tables[tables.length - 1];
    if (lastTable) {
      lastTable.parentNode.insertBefore(placeholder, lastTable.nextSibling);
    } else {
      container.appendChild(placeholder);
    }
  }
};

// Compare table contents cell by cell
const compareTableContents = (leftTable, rightTable) => {
  const leftRows = Array.from(leftTable.rows || []);
  const rightRows = Array.from(rightTable.rows || []);
  
  let additions = 0, deletions = 0;
  
  const maxRows = Math.max(leftRows.length, rightRows.length);
  
  for (let r = 0; r < maxRows; r++) {
    const leftRow = leftRows[r];
    const rightRow = rightRows[r];
    
    if (leftRow && !rightRow) {
      leftRow.classList.add("git-row-removed");
      deletions++;
    } else if (!leftRow && rightRow) {
      rightRow.classList.add("git-row-added");
      additions++;
    } else if (leftRow && rightRow) {
      const leftCells = Array.from(leftRow.cells || []);
      const rightCells = Array.from(rightRow.cells || []);
      const maxCells = Math.max(leftCells.length, rightCells.length);
      
      for (let c = 0; c < maxCells; c++) {
        const leftCell = leftCells[c];
        const rightCell = rightCells[c];
        
        if (leftCell && !rightCell) {
          leftCell.classList.add("git-cell-removed");
          deletions++;
        } else if (!leftCell && rightCell) {
          rightCell.classList.add("git-cell-added");
          additions++;
        } else if (leftCell && rightCell) {
          const leftText = (leftCell.textContent || '').trim();
          const rightText = (rightCell.textContent || '').trim();
          
          if (!areTextsEqual(leftText, rightText)) {
            leftCell.classList.add("git-cell-modified");
            rightCell.classList.add("git-cell-modified");
            
            // Apply word-level highlighting within cells
            applyWordLevelCellDiff(leftCell, leftText, rightText, "left");
            applyWordLevelCellDiff(rightCell, leftText, rightText, "right");
            
            additions++;
            deletions++;
          }
        }
      }
    }
  }
  
  return { tableAdditions: additions, tableDeletions: deletions };
};

// Mutual word-level comparison using diff-match-patch
const applyMutualWordLevelComparison = (leftHtml, rightHtml) => {
  try {
  const leftDiv = htmlToDiv(leftHtml);
  const rightDiv = htmlToDiv(rightHtml);

  // Get all text blocks that aren't already highlighted
  const leftBlocks = getTextBlocksForWordComparison(leftDiv);
  const rightBlocks = getTextBlocksForWordComparison(rightDiv);

  let additions = 0, deletions = 0;

  // Align blocks for word-level comparison
  const blockAlignment = alignTextBlocks(leftBlocks, rightBlocks);

  blockAlignment.forEach(({ left, right, type }) => {
    if (type === 'modified' && left && right) {
      const leftText = left.text;
      const rightText = right.text;
      
      // Use diff-match-patch for precise word-level comparison
      const dmp = new diff_match_patch();
      const diffs = dmp.diff_main(leftText, rightText);
      dmp.diff_cleanupSemantic(diffs);
      
      // Apply highlighting to both elements
      const leftHighlighted = applyDiffHighlighting(diffs, 'left');
      const rightHighlighted = applyDiffHighlighting(diffs, 'right');
      
      left.element.innerHTML = leftHighlighted;
      right.element.innerHTML = rightHighlighted;
      
      // Count changes
      diffs.forEach(diff => {
        if (diff[0] === 1) additions++; // Added
        if (diff[0] === -1) deletions++; // Removed
      });
    }
  });

  return {
    leftFinal: leftDiv.innerHTML,
    rightFinal: rightDiv.innerHTML,
    textSummary: { additions, deletions }
  };
  } catch (error) {
    console.error('Error in word-level comparison:', error);
    return {
      leftFinal: leftHtml,
      rightFinal: rightHtml,
      textSummary: { additions: 0, deletions: 0 }
    };
  }
};

// Get text blocks suitable for word-level comparison
const getTextBlocksForWordComparison = (container) => {
  const blocks = [];
  const elements = container.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');
  
  elements.forEach(element => {
    // Skip if already highlighted or inside table
    if (element.classList.contains('git-line-added') ||
        element.classList.contains('git-line-removed') ||
        element.classList.contains('git-line-modified') ||
        element.classList.contains('placeholder-block') ||
        isInsideTable(element)) {
      return;
    }
    
    const text = (element.textContent || '').trim();
    if (text) {
      blocks.push({
        element,
        text,
        tagName: element.tagName.toLowerCase()
      });
    }
  });
  
  return blocks;
};

// Align text blocks for word-level comparison
const alignTextBlocks = (leftBlocks, rightBlocks) => {
  const alignment = [];
  const leftUsed = new Set();
  const rightUsed = new Set();

  // Match blocks by content similarity
  leftBlocks.forEach((leftBlock, leftIndex) => {
    let bestMatch = null;
    let bestSimilarity = 0;
    
    rightBlocks.forEach((rightBlock, rightIndex) => {
      if (rightUsed.has(rightIndex)) return;
      
      if (leftBlock.tagName === rightBlock.tagName) {
        const similarity = getTextSimilarity(leftBlock.text, rightBlock.text);
        if (similarity > bestSimilarity && similarity > 0.3) {
          bestMatch = { block: rightBlock, index: rightIndex, similarity };
          bestSimilarity = similarity;
        }
      }
    });
    
    if (bestMatch) {
      const type = bestMatch.similarity === 1 ? 'equal' : 'modified';
      alignment.push({
        left: leftBlock,
        right: bestMatch.block,
        type
      });
      leftUsed.add(leftIndex);
      rightUsed.add(bestMatch.index);
    }
  });

  return alignment;
};

// Apply diff highlighting using diff-match-patch results
const applyDiffHighlighting = (diffs, side) => {
  let html = '';
  
  diffs.forEach(diff => {
    const [operation, text] = diff;
    
    if (operation === 0) {
      // Unchanged text
      html += escapeHtml(text);
    } else if (operation === 1 && side === 'right') {
      // Added text - show in right document
      html += `<span class="git-inline-added">${escapeHtml(text)}</span>`;
    } else if (operation === -1 && side === 'left') {
      // Removed text - show in left document
      html += `<span class="git-inline-removed">${escapeHtml(text)}</span>`;
    } else if (operation === 1 && side === 'left') {
      // Added text - show as placeholder in left document
      html += `<span class="git-inline-placeholder" style="color: #22c55e; font-style: italic; opacity: 0.7;">[+${escapeHtml(text)}]</span>`;
    } else if (operation === -1 && side === 'right') {
      // Removed text - show as placeholder in right document
      html += `<span class="git-inline-placeholder" style="color: #ef4444; font-style: italic; opacity: 0.7;">[-${escapeHtml(text)}]</span>`;
    }
  });
  
  return html;
};

// Apply word-level highlighting to table cells
const applyWordLevelCellDiff = (cell, leftText, rightText, side) => {
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(leftText || "", rightText || "");
  dmp.diff_cleanupSemantic(diffs);
  
  const highlighted = applyDiffHighlighting(diffs, side);
  cell.innerHTML = highlighted;
};

// Text similarity calculation
const getTextSimilarity = (text1, text2) => {
  if (!text1 && !text2) return 1;
  if (!text1 || !text2) return 0;
  
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(text1, text2);
  
  let totalLength = Math.max(text1.length, text2.length);
  let unchangedLength = 0;
  
  diffs.forEach(diff => {
    if (diff[0] === 0) { // Unchanged
      unchangedLength += diff[1].length;
    }
  });
  
  return totalLength > 0 ? unchangedLength / totalLength : 0;
};

// Check if texts are equal (with normalization)
const areTextsEqual = (text1, text2) => {
  const normalize = (text) => text.trim().replace(/\s+/g, ' ').toLowerCase();
  return normalize(text1) === normalize(text2);
};

const BLOCK_TAGS = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "li",
  "pre",
  "div",
]);

const isInsideTable = (node) => {
  let p = node.parentNode;
  while (p) {
    if (p.nodeType === 1) {
      const tag = p.tagName && p.tagName.toLowerCase();
      if (
        tag === "table" ||
        tag === "thead" ||
        tag === "tbody" ||
        tag === "tr" ||
        tag === "td" ||
        tag === "th"
      ) {
        return true;
      }
    }
    p = p.parentNode;
  }
  return false;
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
  const text = tempDiv.textContent || "";
  return text;
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

// ===== Detailed line-by-line report =====
const BLOCK_SELECTOR = Array.from(BLOCK_TAGS).join(",");

const extractLineFeatures = (element) => {
  // Gather formatting flags inside the block
  const hasBold = !!element.querySelector("b,strong");
  const hasItalic = !!element.querySelector("i,em");
  const hasUnderline = !!element.querySelector("u");
  const inlineFont =
    element.style && element.style.fontSize ? element.style.fontSize : "";
  let fontSize = inlineFont || "";
  let textAlign =
    element.style && element.style.textAlign ? element.style.textAlign : "";
  // fallback to attribute or class hints
  if (!textAlign) {
    const alignAttr = element.getAttribute && element.getAttribute("align");
    if (alignAttr) textAlign = alignAttr;
  }
  return { hasBold, hasItalic, hasUnderline, fontSize, textAlign };
};

const collectBlockLinesWithFormat = (root) => {
  const blocks = Array.from(root.querySelectorAll(BLOCK_SELECTOR));
  return blocks
    .filter((b) => !isInsideTable(b))
    .map((el, idx) => {
      const text = el.textContent || "";
      const fmt = extractLineFeatures(el);
      return { index: idx, text, fmt, element: el };
    });
};

const visibleSpaces = (s) => {
  if (!s) return "";
  return s
    .replace(/ /g, '<span class="ws">·</span>')
    .replace(/\t/g, '<span class="ws">→</span>');
};

const inlineDiffHtml = (a, b) => {
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(a || "", b || "");
  dmp.diff_cleanupSemantic(diffs);
  
  return diffs.map(diff => {
    const [operation, text] = diff;
    const val = visibleSpaces(escapeHtml(text));
    
    if (operation === 1) return `<span class="git-inline-added">${val}</span>`;
    if (operation === -1) return `<span class="git-inline-removed">${val}</span>`;
    return val;
  }).join("");
};

const compareFormat = (fa, fb) => {
  const changes = [];
  if (!!fa.hasBold !== !!fb.hasBold)
    changes.push(
      `bold: ${fa.hasBold ? "on" : "off"} → ${fb.hasBold ? "on" : "off"}`
    );
  if (!!fa.hasItalic !== !!fb.hasItalic)
    changes.push(
      `italic: ${fa.hasItalic ? "on" : "off"} → ${fb.hasItalic ? "on" : "off"}`
    );
  if (!!fa.hasUnderline !== !!fb.hasUnderline)
    changes.push(
      `underline: ${fa.hasUnderline ? "on" : "off"} → ${
        fb.hasUnderline ? "on" : "off"
      }`
    );
  if ((fa.fontSize || "") !== (fb.fontSize || ""))
    changes.push(
      `font-size: ${fa.fontSize || "auto"} → ${fb.fontSize || "auto"}`
    );
  if ((fa.textAlign || "") !== (fb.textAlign || ""))
    changes.push(
      `alignment: ${fa.textAlign || "auto"} → ${fb.textAlign || "auto"}`
    );
  return changes;
};

// Word-level equivalence check
const areWordsEquivalent = (word1, word2) => {
  // Normalize punctuation and case for comparison
  const normalize = (word) => {
    return word
      .replace(/[""'']/g, '"')
      .replace(/[–—]/g, '-')
      .trim()
      .toLowerCase();
  };
  
  return normalize(word1) === normalize(word2);
};

export const generateDetailedReport = (leftHtml, rightHtml) => {
  try {
  const L = htmlToDiv(leftHtml);
  const R = htmlToDiv(rightHtml);

  const leftLines = collectBlockLinesWithFormat(L);
  const rightLines = collectBlockLinesWithFormat(R);

  const leftTexts = leftLines.map((l) => l.text || "");
  const rightTexts = rightLines.map((l) => l.text || "");
  const parts = diffArrays(leftTexts, rightTexts, {
    comparator: (a, b) => areWordsEquivalent(a, b),
  });

  const lines = [];
  let iL = 0,
    iR = 0,
    v1 = 1,
    v2 = 1;

  for (const part of parts) {
    const count = part.count || (part.value ? part.value.length : 0);
    if (part.added) {
      for (let k = 0; k < count; k++) {
        const r = rightLines[iR++];
        if (r && r.text.trim()) {
          lines.push({
            v1: "",
            v2: String(v2++),
            status: "ADDED",
            diffHtml: inlineDiffHtml("", r.text),
            formatChanges: [`added line`],
          });
        }
      }
      continue;
    }
    if (part.removed) {
      for (let k = 0; k < count; k++) {
        const l = leftLines[iL++];
        if (l && l.text.trim()) {
          lines.push({
            v1: String(v1++),
            v2: "",
            status: "REMOVED",
            diffHtml: inlineDiffHtml(l.text, ""),
            formatChanges: [`removed line`],
          });
        }
      }
      continue;
    }
    // unchanged block - may still be formatting-only differences when synced positions differ in formatting
    for (let k = 0; k < count; k++) {
      const l = leftLines[iL++];
      const r = rightLines[iR++];
      if (!l || !r) continue;

      const textEqual = areWordsEquivalent(l.text || "", r.text || "");
      const fmtChanges = compareFormat(l.fmt, r.fmt);

      if (textEqual && fmtChanges.length > 0) {
        lines.push({
          v1: String(v1++),
          v2: String(v2++),
          status: "FORMATTING-ONLY",
          diffHtml: visibleSpaces(escapeHtml(l.text || "")),
          formatChanges: fmtChanges,
        });
      } else if (textEqual) {
        lines.push({
          v1: String(v1++),
          v2: String(v2++),
          status: "UNCHANGED",
          diffHtml: visibleSpaces(escapeHtml(l.text || "")),
          formatChanges: [],
        });
      } else if (l.text.trim() || r.text.trim()) {
        lines.push({
          v1: String(v1++),
          v2: String(v2++),
          status: "MODIFIED",
          diffHtml: inlineDiffHtml(l.text, r.text),
          formatChanges: fmtChanges,
        });
      }
    }
  }

  // Tables report
  const tableReport = [];
  const Lt = Array.from(L.querySelectorAll("table"));
  const Rt = Array.from(R.querySelectorAll("table"));
  const tcount = Math.max(Lt.length, Rt.length);
  for (let ti = 0; ti < tcount; ti++) {
    const TL = Lt[ti],
      TR = Rt[ti];
    if (!TL && TR) {
      tableReport.push({ table: ti + 1, status: "ADDED" });
      continue;
    }
    if (TL && !TR) {
      tableReport.push({ table: ti + 1, status: "REMOVED" });
      continue;
    }
    if (!(TL && TR)) continue;
    const rL = Array.from(TL.rows || []);
    const rR = Array.from(TR.rows || []);
    const rcount = Math.max(rL.length, rR.length);
    for (let ri = 0; ri < rcount; ri++) {
      const rowL = rL[ri],
        rowR = rR[ri];
      if (!rowL && rowR) {
        tableReport.push({ table: ti + 1, row: ri + 1, status: "ADDED" });
        continue;
      }
      if (rowL && !rowR) {
        tableReport.push({ table: ti + 1, row: ri + 1, status: "REMOVED" });
        continue;
      }
      const cL = Array.from(rowL.cells || []);
      const cR = Array.from(rowR.cells || []);
      const ccount = Math.max(cL.length, cR.length);
      for (let ci = 0; ci < ccount; ci++) {
        const cellL = cL[ci],
          cellR = cR[ci];
        if (!cellL && cellR) {
          tableReport.push({
            table: ti + 1,
            row: ri + 1,
            col: ci + 1,
            status: "ADDED",
          });
          continue;
        }
        if (cellL && !cellR) {
          tableReport.push({
            table: ti + 1,
            row: ri + 1,
            col: ci + 1,
            status: "REMOVED",
          });
          continue;
        }
        const a = (cellL.textContent || "").trim();
        const b = (cellR.textContent || "").trim();
        if (a && b && !areWordsEquivalent(a, b)) {
          tableReport.push({
            table: ti + 1,
            row: ri + 1,
            col: ci + 1,
            status: "MODIFIED",
            diffHtml: inlineDiffHtml(a, b),
          });
        }
      }
    }
  }

  // Images report
  const Li = Array.from(L.querySelectorAll("img")).map(
    (i) => i.getAttribute("src") || ""
  );
  const Ri = Array.from(R.querySelectorAll("img")).map(
    (i) => i.getAttribute("src") || ""
  );
  const imgReport = [];
  const imax = Math.max(Li.length, Ri.length);
  for (let i = 0; i < imax; i++) {
    const a = Li[i],
      b = Ri[i];
    if (a && !b) imgReport.push({ index: i + 1, status: "REMOVED", src: a });
    else if (!a && b) imgReport.push({ index: i + 1, status: "ADDED", src: b });
    else if (a && b && a !== b)
      imgReport.push({ index: i + 1, status: "REPLACED", from: a, to: b });
  }

  return { lines, tables: tableReport, images: imgReport };
  } catch (error) {
    console.error('Error generating detailed report:', error);
    return { lines: [], tables: [], images: [] };
  }
};
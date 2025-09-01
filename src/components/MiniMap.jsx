import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronUp, ChevronDown, RotateCcw, Table, Image, FileText } from 'lucide-react';

const CHANGE_SELECTORS = [
  '.git-line-added',
  '.git-line-removed', 
  '.git-line-modified',
  '.git-line-placeholder',
  '.git-inline-added',
  '.git-inline-removed',
  '.placeholder-added',
  '.placeholder-removed',
  '.git-table-added',
  '.git-table-removed',
  '.git-table-modified',
  '.git-image-added',
  '.git-image-removed',
  '.git-image-modified'
];

const UnifiedMiniMap = ({ leftContainerId, rightContainerId }) => {
  const minimapRef = useRef(null);
  const [markers, setMarkers] = useState([]);
  const [viewport, setViewport] = useState({ top: 0, height: 0 });
  const [currentChange, setCurrentChange] = useState(0);

  const getContainers = useCallback(() => ({
    left: document.getElementById(leftContainerId),
    right: document.getElementById(rightContainerId)
  }), [leftContainerId, rightContainerId]);

  const collectUnifiedMarkers = useCallback(() => {
    const { left, right } = getContainers();
    if (!left || !right) return [];

    const allMarkers = [];
    
    // Collect markers from both containers and unify them
    [left, right].forEach((container, containerIndex) => {
      const side = containerIndex === 0 ? 'left' : 'right';
      const elements = container.querySelectorAll(CHANGE_SELECTORS.join(','));
      
      elements.forEach((element) => {
        const rect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const relativeTop = rect.top - containerRect.top + container.scrollTop;
        
        const scrollHeight = Math.max(container.scrollHeight, container.clientHeight);
        const ratio = Math.min(1, Math.max(0, relativeTop / scrollHeight));
        
        // Determine change type, color, and icon
        let color = '#6b7280';
        let changeType = 'unknown';
        let priority = 0;
        let icon = FileText;
        let height = '4px';
        
        // Table changes
        if (element.classList.contains('git-table-added')) {
          color = '#10b981';
          changeType = 'table-added';
          priority = 5;
          icon = Table;
          height = '8px';
        } else if (element.classList.contains('git-table-removed')) {
          color = '#ef4444';
          changeType = 'table-removed';
          priority = 5;
          icon = Table;
          height = '8px';
        } else if (element.classList.contains('git-table-modified')) {
          color = '#f59e0b';
          changeType = 'table-modified';
          priority = 4;
          icon = Table;
          height = '8px';
        }
        // Image changes
        else if (element.classList.contains('git-image-added')) {
          color = '#10b981';
          changeType = 'image-added';
          priority = 5;
          icon = Image;
          height = '6px';
        } else if (element.classList.contains('git-image-removed')) {
          color = '#ef4444';
          changeType = 'image-removed';
          priority = 5;
          icon = Image;
          height = '6px';
        } else if (element.classList.contains('git-image-modified')) {
          color = '#f59e0b';
          changeType = 'image-modified';
          priority = 4;
          icon = Image;
          height = '6px';
        }
        // Text changes
        else if (element.classList.contains('git-line-added') || 
                 element.classList.contains('git-inline-added') ||
                 element.classList.contains('placeholder-added')) {
          color = '#10b981';
          changeType = 'text-added';
          priority = 3;
          icon = FileText;
        } else if (element.classList.contains('git-line-removed') || 
                   element.classList.contains('git-inline-removed') ||
                   element.classList.contains('placeholder-removed')) {
          color = '#ef4444';
          changeType = 'text-removed';
          priority = 3;
          icon = FileText;
        } else if (element.classList.contains('git-line-modified')) {
          color = '#f59e0b';
          changeType = 'text-modified';
          priority = 2;
          icon = FileText;
        } else if (element.classList.contains('git-line-placeholder')) {
          color = '#8b5cf6';
          changeType = 'empty-space';
          priority = 4;
          icon = FileText;
          height = '6px';
        }

        allMarkers.push({
          ratio,
          color,
          changeType,
          side,
          element,
          elementTop: relativeTop,
          priority,
          icon,
          height
        });
      });
    });

    // Sort by position and deduplicate nearby markers, keeping highest priority
    const sorted = allMarkers.sort((a, b) => a.ratio - b.ratio);
    const unified = [];
    const threshold = 0.01;
    
    sorted.forEach((marker) => {
      const existing = unified.find(m => Math.abs(m.ratio - marker.ratio) <= threshold);
      if (!existing) {
        unified.push({
          ...marker,
          unified: true,
          elements: [marker.element]
        });
      } else if (marker.priority > existing.priority) {
        // Replace with higher priority marker
        const index = unified.indexOf(existing);
        unified[index] = {
          ...marker,
          unified: true,
          elements: [existing.element, marker.element]
        };
      } else {
        // Add element to existing marker
        existing.elements.push(marker.element);
      }
    });

    return unified;
  }, [getContainers]);

  const updateViewport = useCallback(() => {
    const { left } = getContainers();
    if (!left) return;
    
    const scrollTop = left.scrollTop;
    const clientHeight = left.clientHeight;
    const scrollHeight = left.scrollHeight;
    
    if (scrollHeight <= clientHeight) {
      setViewport({ top: 0, height: 100 });
      return;
    }
    
    const topPercentage = (scrollTop / scrollHeight) * 100;
    const heightPercentage = (clientHeight / scrollHeight) * 100;
    
    setViewport({ 
      top: Math.min(100 - heightPercentage, topPercentage), 
      height: heightPercentage 
    });
  }, [getContainers]);

  const scrollToRatio = useCallback((targetRatio) => {
    const { left, right } = getContainers();
    if (!left || !right) return;

    const leftMaxScroll = Math.max(0, left.scrollHeight - left.clientHeight);
    const rightMaxScroll = Math.max(0, right.scrollHeight - right.clientHeight);
    
    const leftScrollTop = Math.round(leftMaxScroll * targetRatio);
    const rightScrollTop = Math.round(rightMaxScroll * targetRatio);

    left.scrollTo({ top: leftScrollTop, behavior: 'smooth' });
    right.scrollTo({ top: rightScrollTop, behavior: 'smooth' });
  }, [getContainers]);

  const scrollToElement = useCallback((elements) => {
    if (!elements || elements.length === 0) return;
    
    // Use the first element for navigation
    const element = elements[0];
    element.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center',
      inline: 'nearest'
    });
    
    // Highlight all related elements
    elements.forEach(el => {
      const originalBoxShadow = el.style.boxShadow;
      const originalTransition = el.style.transition;
      
      el.style.transition = 'box-shadow 0.3s ease';
      el.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.8), 0 0 20px rgba(59, 130, 246, 0.3)';
      
      setTimeout(() => {
        el.style.boxShadow = originalBoxShadow;
        setTimeout(() => {
          el.style.transition = originalTransition;
        }, 300);
      }, 1500);
    });
  }, []);

  const handleMinimapClick = useCallback((e) => {
    if (!minimapRef.current) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const rect = minimapRef.current.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const clickRatio = Math.min(1, Math.max(0, clickY / rect.height));
    
    const closestMarker = markers.reduce((closest, marker) => {
      const distance = Math.abs(marker.ratio - clickRatio);
      if (!closest || distance < closest.distance) {
        return { marker, distance };
      }
      return closest;
    }, null);
    
    if (closestMarker && closestMarker.distance < 0.03) {
      scrollToElement(closestMarker.marker.elements);
      setCurrentChange(markers.indexOf(closestMarker.marker));
    } else {
      scrollToRatio(clickRatio);
    }
  }, [markers, scrollToRatio, scrollToElement]);

  const navigateToNext = useCallback(() => {
    if (markers.length === 0) return;
    
    const nextIndex = (currentChange + 1) % markers.length;
    setCurrentChange(nextIndex);
    scrollToElement(markers[nextIndex].elements);
  }, [markers, currentChange, scrollToElement]);

  const navigateToPrevious = useCallback(() => {
    if (markers.length === 0) return;
    
    const prevIndex = currentChange === 0 ? markers.length - 1 : currentChange - 1;
    setCurrentChange(prevIndex);
    scrollToElement(markers[prevIndex].elements);
  }, [markers, currentChange, scrollToElement]);

  const resetView = useCallback(() => {
    const { left, right } = getContainers();
    if (!left || !right) return;
    
    left.scrollTo({ top: 0, behavior: 'smooth' });
    right.scrollTo({ top: 0, behavior: 'smooth' });
    setCurrentChange(0);
  }, [getContainers]);

  // Initialize and refresh markers
  useEffect(() => {
    const refreshAll = () => {
      setMarkers(collectUnifiedMarkers());
      updateViewport();
    };

    const initialTimer = setTimeout(refreshAll, 800);
    
    const { left, right } = getContainers();
    if (!left || !right) return () => clearTimeout(initialTimer);

    const handleScroll = () => {
      updateViewport();
    };

    const handleContentChange = () => {
      clearTimeout(window.minimapContentTimer);
      window.minimapContentTimer = setTimeout(refreshAll, 300);
    };

    left.addEventListener('scroll', handleScroll, { passive: true });
    right.addEventListener('scroll', handleScroll, { passive: true });

    const observer = new MutationObserver(handleContentChange);
    observer.observe(left, { 
      childList: true, 
      subtree: true, 
      attributes: true, 
      attributeFilter: ['class', 'style'],
      characterData: true 
    });
    observer.observe(right, { 
      childList: true, 
      subtree: true, 
      attributes: true, 
      attributeFilter: ['class', 'style'],
      characterData: true 
    });

    const handleResize = () => {
      clearTimeout(window.minimapResizeTimer);
      window.minimapResizeTimer = setTimeout(refreshAll, 300);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(initialTimer);
      clearTimeout(window.minimapContentTimer);
      clearTimeout(window.minimapResizeTimer);
      
      left.removeEventListener('scroll', handleScroll);
      right.removeEventListener('scroll', handleScroll);
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [collectUnifiedMarkers, updateViewport, getContainers]);

  // Group markers by type for legend
  const markersByType = markers.reduce((acc, marker) => {
    const baseType = marker.changeType.replace(/-added|-removed|-modified/, '');
    acc[baseType] = (acc[baseType] || 0) + 1;
    return acc;
  }, {});

  const getChangeTypeDisplay = (type) => {
    switch (type) {
      case 'text': return { icon: FileText, label: 'Text Changes' };
      case 'table': return { icon: Table, label: 'Table Changes' };
      case 'image': return { icon: Image, label: 'Image Changes' };
      case 'empty': return { icon: FileText, label: 'Empty Spaces' };
      default: return { icon: FileText, label: 'Other Changes' };
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Navigation Controls */}
      <div className="p-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-gray-700">
            📍 Unified Changes ({markers.length})
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={navigateToPrevious}
              disabled={markers.length === 0}
              className="p-1.5 rounded-md hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
              title="Previous change"
            >
              <ChevronUp className="h-3 w-3" />
            </button>
            <span className="text-xs text-gray-600 min-w-[45px] text-center font-mono bg-white px-2 py-1 rounded border">
              {markers.length > 0 ? `${currentChange + 1}/${markers.length}` : '0/0'}
            </span>
            <button
              onClick={navigateToNext}
              disabled={markers.length === 0}
              className="p-1.5 rounded-md hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
              title="Next change"
            >
              <ChevronDown className="h-3 w-3" />
            </button>
            <button
              onClick={resetView}
              className="p-1.5 rounded-md hover:bg-white transition-all duration-200 ml-1 shadow-sm"
              title="Reset to top"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Unified Minimap */}
      <div className="p-4">
        <div 
          ref={minimapRef}
          onClick={handleMinimapClick}
          className="relative w-full h-56 bg-gradient-to-b from-gray-50 via-white to-gray-50 rounded-lg border-2 border-gray-200 cursor-pointer overflow-hidden transition-all duration-200 hover:border-blue-300 hover:shadow-lg"
          title="Unified document changes • Click to navigate"
        >
          {/* Background grid */}
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            {[...Array(10)].map((_, i) => (
              <div 
                key={i}
                className="absolute left-0 right-0 border-t border-gray-300"
                style={{ top: `${(i + 1) * 10}%` }}
              />
            ))}
          </div>
          
          {/* Unified change markers */}
          {markers.map((marker, i) => {
            const IconComponent = marker.icon;
            return (
              <div 
                key={`unified-${i}`}
                className={`absolute transition-all duration-200 hover:scale-110 cursor-pointer z-20 rounded-sm flex items-center justify-center ${
                  i === currentChange ? 'ring-2 ring-blue-500 ring-offset-1 scale-110' : ''
                }`}
                style={{ 
                  left: '6px',
                  right: '6px',
                  top: `${marker.ratio * 100}%`, 
                  height: marker.height,
                  backgroundColor: marker.color,
                  opacity: 0.9,
                  boxShadow: `0 2px 4px ${marker.color}40, 0 1px 2px ${marker.color}60`
                }}
                title={`${marker.changeType.replace(/-/g, ' ')} - click to navigate`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  scrollToElement(marker.elements);
                  setCurrentChange(i);
                }}
              >
                {marker.height === '8px' && (
                  <IconComponent className="h-2 w-2 text-white" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.3))' }} />
                )}
              </div>
            );
          })}
          
          {/* Viewport indicator */}
          <div
            className="absolute left-0 right-0 border-2 border-blue-500 bg-blue-400/20 rounded-sm transition-all duration-300 pointer-events-none z-30"
            style={{ 
              top: `${viewport.top}%`, 
              height: `${Math.max(3, viewport.height)}%`,
              boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
            }}
          />
          
          {/* No changes message */}
          {markers.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
              <div className="text-xs text-gray-400 text-center bg-white/90 px-4 py-3 rounded-lg border border-gray-200 shadow-sm">
                <FileText className="h-4 w-4 mx-auto mb-1 opacity-50" />
                No changes detected
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Legend */}
      <div className="p-4 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50">
        <div className="text-xs font-medium text-gray-700 mb-3">📊 Change Types</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {Object.entries(markersByType).map(([type, count]) => {
            const { icon: IconComponent, label } = getChangeTypeDisplay(type);
            return (
              <div key={type} className="flex items-center gap-2 bg-white px-2 py-1 rounded border">
                <IconComponent className="h-3 w-3 text-gray-500" />
                <span className="text-gray-600">{label} ({count})</span>
              </div>
            );
          })}
        </div>
        
        {/* Mutual comparison explanation */}
        <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
          <div className="text-xs text-blue-700">
            <strong>🔄 Mutual Comparison:</strong> Both documents show all changes. 
            Empty spaces indicate where content exists in one document but not the other.
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnifiedMiniMap;
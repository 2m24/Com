import React, { useEffect, useRef, useState } from 'react';
import { renderHtmlDifferences } from '../utils/textComparison';
import { AlertCircle, FileText, Loader2 } from 'lucide-react';

const DocumentPreview = ({ document, diffs, title, containerId }) => {
  const contentRef = useRef(null);
  const containerRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const content = diffs ? renderHtmlDifferences(diffs) : document?.originalHtmlContent;

  // Handle scroll synchronization between containers
  useEffect(() => {
    if (!containerRef.current || !containerId) return;

    const container = containerRef.current;
    let isScrolling = false;

    const handleScroll = (e) => {
      if (isScrolling) return;
      
      const sourceContainer = e.target;
      const sourceId = sourceContainer.id;
      
      // Determine the target container ID
      const targetId = sourceId.includes('left') 
        ? sourceId.replace('left', 'right') 
        : sourceId.replace('right', 'left');
      const targetContainer = document.getElementById(targetId);
      
      if (targetContainer && targetContainer !== sourceContainer) {
        // Calculate scroll ratio
        const sourceMaxScroll = Math.max(1, sourceContainer.scrollHeight - sourceContainer.clientHeight);
        const targetMaxScroll = Math.max(1, targetContainer.scrollHeight - targetContainer.clientHeight);
        
        const scrollRatio = sourceContainer.scrollTop / sourceMaxScroll;
        const targetScrollTop = Math.round(targetMaxScroll * scrollRatio);
        
        // Prevent infinite loop
        isScrolling = true;
        targetContainer.scrollTop = targetScrollTop;
        
        // Reset flag after a short delay
        setTimeout(() => {
          isScrolling = false;
        }, 50);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [containerId]);

  // Handle content rendering
  useEffect(() => {
    if (!content || !contentRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      // Ensure content is properly rendered
      const timer = setTimeout(() => {
        if (contentRef.current) {
          // Check if content was rendered successfully
          const hasContent = contentRef.current.innerHTML.trim() !== '';
          if (!hasContent) {
            setError('Failed to render document content');
          }
        }
        setIsLoading(false);
      }, 300);

      return () => clearTimeout(timer);
    } catch (err) {
      setError('Error rendering document');
      setIsLoading(false);
    }
  }, [content]);

  if (!document) {
    return (
      <div className="h-full flex flex-col bg-white rounded-xl shadow-lg border border-gray-200">
        <div className="border-b border-gray-200 p-4 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No document uploaded</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-200 p-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full shadow-sm"></div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-800 truncate">
              {title}
            </h3>
            <p className="text-sm text-gray-600 truncate mt-0.5" title={document.name}>
              📄 {document.name}
            </p>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div 
        className="flex-1 overflow-auto bg-gray-50" 
        id={containerId} 
        ref={containerRef}
        style={{ scrollBehavior: 'smooth' }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-3" />
              <p className="text-gray-600">Rendering document...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-red-600">
              <AlertCircle className="h-12 w-12 mx-auto mb-3" />
              <p className="font-medium">Error loading document</p>
              <p className="text-sm text-gray-600 mt-1">{error}</p>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div 
              ref={contentRef}
              className="word-document-preview bg-white shadow-lg border border-gray-200 rounded-lg mx-auto"
              style={{ 
                maxWidth: '210mm', // A4 width
                minHeight: '297mm', // A4 height
                padding: '25.4mm', // 1 inch margins
                fontFamily: 'Calibri, Arial, sans-serif',
                fontSize: '11pt',
                lineHeight: '1.15',
                color: '#000000',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
              }}
              dangerouslySetInnerHTML={{ __html: content || '<p style="color: #6b7280; font-style: italic;">No content available</p>' }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentPreview;
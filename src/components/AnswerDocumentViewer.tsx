import React from 'react';
import { isHtmlDocument } from '../lib/pdfUtils';
import { PdfViewer } from './PdfViewer';
import { HtmlDocumentViewer } from './HtmlDocumentViewer';

interface AnswerDocumentViewerProps {
  collectionName: 'books' | 'questions' | 'word_notes';
  docId: string;
  inlineDataUrl?: string;
  fileName?: string;
  mimeType?: string;
  maxHeightClass?: string;
}

export const AnswerDocumentViewer: React.FC<AnswerDocumentViewerProps> = ({
  collectionName,
  docId,
  inlineDataUrl,
  fileName,
  mimeType,
  maxHeightClass = 'h-[580px]',
}) => {
  if (isHtmlDocument(fileName, mimeType, inlineDataUrl)) {
    return (
      <HtmlDocumentViewer
        collectionName={collectionName}
        docId={docId}
        inlineDataUrl={inlineDataUrl}
        fileName={fileName}
        maxHeightClass={maxHeightClass}
      />
    );
  }

  return (
    <PdfViewer
      collectionName={collectionName}
      docId={docId}
      inlineDataUrl={inlineDataUrl}
      fileName={fileName}
      maxHeightClass={maxHeightClass}
    />
  );
};

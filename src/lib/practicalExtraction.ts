export interface ExtractedPracticalQuestion {
  questionNumber: number;
  question: string;
  answer: string;
}

/**
 * Compresses an uploaded image in the browser for fast Gemini OCR / question extraction.
 */
export function compressImageForExtraction(
  file: File
): Promise<{ base64Data: string; mimeType: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = (e.target?.result as string) || '';
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1400;
        let { width, height } = img;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          resolve({
            base64Data: dataUrl.split(',')[1] || '',
            mimeType: 'image/jpeg',
          });
          return;
        }

        resolve({
          base64Data: rawDataUrl.split(',')[1] || '',
          mimeType: file.type || 'image/jpeg',
        });
      };
      img.onerror = () => {
        resolve({
          base64Data: rawDataUrl.split(',')[1] || '',
          mimeType: file.type || 'image/jpeg',
        });
      };
      img.src = rawDataUrl;
    };
    reader.onerror = () => {
      resolve({ base64Data: '', mimeType: 'image/jpeg' });
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Reads a Photo (.jpg, .png, .webp) or PDF (.pdf) file and calls the server Gemini endpoint
 * to extract individual practical questions and procedures/solutions.
 */
export async function extractPracticalQuestionsFromUpload(params: {
  file: File;
  courseCode?: string;
  courseTitle?: string;
}): Promise<ExtractedPracticalQuestion[]> {
  const { file, courseCode = '', courseTitle = '' } = params;
  const fileType = (file.type || '').toLowerCase();
  const fileNameLower = file.name.toLowerCase();

  const isImage =
    fileType.startsWith('image/') ||
    /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(fileNameLower);
  const isPdf = fileType === 'application/pdf' || fileNameLower.endsWith('.pdf');

  if (!isImage && !isPdf) {
    throw new Error('Please upload a Photo (.jpg, .png, .webp) or PDF (.pdf) file.');
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error('File exceeds 10 MB limit. Please upload a smaller Photo or PDF.');
  }

  let base64Data = '';
  let mimeType = '';

  if (isImage) {
    const compressed = await compressImageForExtraction(file);
    base64Data = compressed.base64Data;
    mimeType = compressed.mimeType;
  } else {
    base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = (event.target?.result as string) || '';
        const idx = dataUrl.indexOf(',');
        resolve(idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl);
      };
      reader.onerror = () => reject(new Error('Failed to read PDF file.'));
      reader.readAsDataURL(file);
    });
    mimeType = 'application/pdf';
  }

  if (!base64Data) {
    throw new Error('Could not read file contents for extraction.');
  }

  const res = await fetch('/api/gemini/extract-practical-questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base64Data,
      mimeType,
      fileName: file.name,
      courseCode,
      courseTitle,
    }),
  });

  const contentType = res.headers.get('content-type') || '';
  let data: any = {};
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    const raw = await res.text();
    throw new Error(`Server error (${res.status}): ${raw.slice(0, 120)}`);
  }

  if (!res.ok) {
    throw new Error(data.error || `Extraction failed (${res.status})`);
  }

  const list = Array.isArray(data.questions) ? data.questions : [];
  if (list.length === 0) {
    throw new Error(
      'No practical questions could be detected in this file. Please try a clearer photo or PDF.'
    );
  }

  return list.map((item: any, idx: number) => ({
    questionNumber: Number(item.questionNumber) || idx + 1,
    question: String(item.question || '').trim(),
    answer: String(item.answer || '').trim(),
  }));
}

const fs = require('fs');
const pdf = require('pdf-parse');

/**
 * Extract text content from a PDF file
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<Object>} - Extracted text and metadata
 */
async function extractTextFromPDF(filePath) {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Read the PDF file
    const dataBuffer = fs.readFileSync(filePath);
    
    // Parse the PDF
    const data = await pdf(dataBuffer);
    
    return {
      success: true,
      text: data.text,
      metadata: {
        pages: data.numpages,
        info: data.info || {},
        fileName: filePath.split('/').pop()
      },
      rawData: data
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      text: '',
      metadata: {}
    };
  }
}

/**
 * Clean and normalize extracted text
 * @param {string} text - Raw extracted text
 * @returns {string} - Cleaned text
 */
function cleanExtractedText(text) {
  if (!text) return '';
  
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove page breaks and form feeds
    .replace(/[\f\r]/g, ' ')
    // Normalize line endings
    .replace(/\n\s*\n/g, '\n')
    // Remove leading/trailing whitespace
    .trim()
    // Remove common PDF artifacts
    .replace(/\u0000/g, '')
    .replace(/\ufffd/g, '')
    // Normalize quotes
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'");
}

/**
 * Extract text with preprocessing for real estate contracts
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<Object>} - Processed extraction result
 */
async function extractContractText(filePath) {
  const result = await extractTextFromPDF(filePath);
  
  if (!result.success) {
    return result;
  }
  
  // Clean the text
  const cleanedText = cleanExtractedText(result.text);
  
  // Look for common TREC form indicators
  const formIndicators = [
    'TREC',
    'Texas Real Estate Commission',
    'ONE TO FOUR FAMILY RESIDENTIAL CONTRACT',
    'COMMERCIAL CONTRACT',
    'TAR'
  ];
  
  const detectedForms = formIndicators.filter(indicator => 
    cleanedText.toUpperCase().includes(indicator.toUpperCase())
  );
  
  return {
    ...result,
    text: cleanedText,
    metadata: {
      ...result.metadata,
      detectedForms,
      isLikelyTRECForm: detectedForms.some(form => 
        form.includes('TREC') || form.includes('Texas Real Estate')
      ),
      wordCount: cleanedText.split(/\s+/).length,
      characterCount: cleanedText.length
    }
  };
}

module.exports = {
  extractTextFromPDF,
  cleanExtractedText,
  extractContractText
};
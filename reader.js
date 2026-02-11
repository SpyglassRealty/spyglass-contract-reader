#!/usr/bin/env node

/**
 * Spyglass Realty Contract Reader
 * AI-powered contract analysis for Texas real estate contracts
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { extractContractText } = require('./lib/pdf-extractor');
const ContractAnalyzer = require('./lib/ai-analyzer');
const DeadlineCalculator = require('./lib/deadline-calculator');
const OutputFormatter = require('./lib/output-formatter');

class ContractReader {
  constructor() {
    this.analyzer = new ContractAnalyzer();
    this.deadlineCalculator = new DeadlineCalculator();
    this.formatter = new OutputFormatter();
  }

  /**
   * Process contract PDF from buffer (for serverless environments)
   * @param {Buffer} buffer - PDF file buffer
   * @param {string} fileName - Original filename
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processing results
   */
  async processContractFromBuffer(buffer, fileName, options = {}) {
    console.log(`📄 Processing contract from buffer: ${fileName}`);
    console.log('⏳ Extracting text from PDF buffer...');

    // Step 1: Extract text from PDF buffer
    const extractionResult = await this.extractContractTextFromBuffer(buffer, fileName);
    if (!extractionResult.success) {
      throw new Error(`PDF extraction failed: ${extractionResult.error}`);
    }

    console.log(`✅ Extracted ${extractionResult.metadata.pages} pages, ${extractionResult.metadata.wordCount} words`);
    
    if (extractionResult.metadata.isLikelyTRECForm) {
      console.log('🏠 Detected Texas TREC form');
    }

    console.log('🤖 Analyzing contract with AI...');

    // Step 2: Analyze with AI
    const analysisResult = await this.analyzer.analyzeContract(
      extractionResult.text, 
      extractionResult.metadata
    );

    if (!analysisResult.success) {
      throw new Error(`AI analysis failed: ${analysisResult.error}`);
    }

    console.log('✅ Contract analysis complete');

    // Step 3: Validate extracted data
    const validation = this.analyzer.validateExtractedData(analysisResult.data);
    console.log(`📊 Data completeness: ${validation.completeness_score.toFixed(1)}%`);

    if (validation.missing_required.length > 0) {
      console.log(`⚠️  Missing required fields: ${validation.missing_required.join(', ')}`);
    }

    // Step 4: Generate deadline timeline
    const timeline = this.deadlineCalculator.generateDeadlineTimeline(analysisResult.data);
    console.log(`📅 Generated timeline with ${timeline.length} deadlines`);

    // Check for urgent deadlines
    const urgentDeadlines = timeline.filter(d => !d.is_expired && d.days_remaining <= 2);
    if (urgentDeadlines.length > 0) {
      console.log(`🚨 ${urgentDeadlines.length} urgent deadline(s) within 2 days!`);
    }

    // Step 5: Format outputs
    const outputs = this.formatter.formatAllOutputs(
      analysisResult.data,
      timeline,
      analysisResult.metadata,
      validation
    );

    return {
      success: true,
      contractData: analysisResult.data,
      timeline: timeline,
      validation: validation,
      outputs: outputs,
      metadata: {
        ...analysisResult.metadata,
        file_name: fileName,
        processing_time: new Date().toISOString(),
        processed_from_buffer: true
      }
    };
  }

  /**
   * Extract text from PDF buffer
   * @param {Buffer} buffer - PDF file buffer
   * @param {string} fileName - Original filename
   * @returns {Promise<Object>} Extraction result
   */
  async extractContractTextFromBuffer(buffer, fileName) {
    const pdf = require('pdf-parse');
    
    try {
      const data = await pdf(buffer);
      
      const text = data.text;
      const pages = data.numpages;
      const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
      
      // Check if this looks like a TREC form
      const trecKeywords = ['TREC', 'Texas Real Estate Commission', 'Promulgated', 'Contract for Sale'];
      const isLikelyTRECForm = trecKeywords.some(keyword => 
        text.toUpperCase().includes(keyword.toUpperCase())
      );

      return {
        success: true,
        text: text,
        metadata: {
          pages: pages,
          wordCount: wordCount,
          isLikelyTRECForm: isLikelyTRECForm,
          fileName: fileName,
          fileSize: buffer.length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to extract text from PDF buffer: ${error.message}`,
        text: null,
        metadata: { fileName: fileName, fileSize: buffer.length }
      };
    }
  }

  /**
   * Process a single contract PDF
   * @param {string} filePath - Path to PDF contract
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processing results
   */
  async processContract(filePath, options = {}) {
    console.log(`📄 Processing contract: ${path.basename(filePath)}`);
    console.log('⏳ Extracting text from PDF...');

    // Step 1: Extract text from PDF
    const extractionResult = await extractContractText(filePath);
    if (!extractionResult.success) {
      throw new Error(`PDF extraction failed: ${extractionResult.error}`);
    }

    console.log(`✅ Extracted ${extractionResult.metadata.pages} pages, ${extractionResult.metadata.wordCount} words`);
    
    if (extractionResult.metadata.isLikelyTRECForm) {
      console.log('🏠 Detected Texas TREC form');
    }

    console.log('🤖 Analyzing contract with AI...');

    // Step 2: Analyze with AI
    const analysisResult = await this.analyzer.analyzeContract(
      extractionResult.text, 
      extractionResult.metadata
    );

    if (!analysisResult.success) {
      throw new Error(`AI analysis failed: ${analysisResult.error}`);
    }

    console.log('✅ Contract analysis complete');

    // Step 3: Validate extracted data
    const validation = this.analyzer.validateExtractedData(analysisResult.data);
    console.log(`📊 Data completeness: ${validation.completeness_score.toFixed(1)}%`);

    if (validation.missing_required.length > 0) {
      console.log(`⚠️  Missing required fields: ${validation.missing_required.join(', ')}`);
    }

    // Step 4: Generate deadline timeline
    const timeline = this.deadlineCalculator.generateDeadlineTimeline(analysisResult.data);
    console.log(`📅 Generated timeline with ${timeline.length} deadlines`);

    // Check for urgent deadlines
    const urgentDeadlines = timeline.filter(d => !d.is_expired && d.days_remaining <= 2);
    if (urgentDeadlines.length > 0) {
      console.log(`🚨 ${urgentDeadlines.length} urgent deadline(s) within 2 days!`);
    }

    // Step 5: Format outputs
    const outputs = this.formatter.formatAllOutputs(
      analysisResult.data,
      timeline,
      analysisResult.metadata,
      validation
    );

    return {
      success: true,
      contractData: analysisResult.data,
      timeline: timeline,
      validation: validation,
      outputs: outputs,
      metadata: {
        ...analysisResult.metadata,
        file_path: filePath,
        file_name: path.basename(filePath),
        processing_time: new Date().toISOString()
      }
    };
  }

  /**
   * Save outputs to files
   * @param {Object} results - Processing results
   * @param {string} outputDir - Output directory
   * @returns {Object} Saved file paths
   */
  async saveOutputs(results, outputDir) {
    const baseName = path.basename(results.metadata.file_path, '.pdf');
    const savedFiles = {};

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save JSON output
    const jsonPath = path.join(outputDir, `${baseName}_analysis.json`);
    fs.writeFileSync(jsonPath, results.outputs.json);
    savedFiles.json = jsonPath;

    // Save summary
    const summaryPath = path.join(outputDir, `${baseName}_summary.md`);
    fs.writeFileSync(summaryPath, results.outputs.summary);
    savedFiles.summary = summaryPath;

    // Save timeline
    const timelinePath = path.join(outputDir, `${baseName}_timeline.md`);
    fs.writeFileSync(timelinePath, results.outputs.timeline);
    savedFiles.timeline = timelinePath;

    // Save checklist
    const checklistPath = path.join(outputDir, `${baseName}_checklist.md`);
    fs.writeFileSync(checklistPath, results.outputs.checklist);
    savedFiles.checklist = checklistPath;

    return savedFiles;
  }

  /**
   * Display results summary to console
   * @param {Object} results - Processing results
   */
  displaySummary(results) {
    const data = results.contractData;
    
    console.log('\n' + '='.repeat(60));
    console.log('📋 CONTRACT ANALYSIS SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`🏠 Property: ${data.property_address || 'Not specified'}`);
    console.log(`💰 Sales Price: $${this.formatter.formatCurrency(data.sales_price)}`);
    console.log(`👥 Buyer(s): ${this.formatter.formatNamesList(data.buyer_names)}`);
    console.log(`👤 Seller(s): ${this.formatter.formatNamesList(data.seller_names)}`);
    console.log(`📅 Closing: ${this.formatter.formatDateValue(data.closing_date)}`);
    
    if (data.option_period && data.option_period.days) {
      console.log(`⏰ Option Period: ${data.option_period.days} days ($${this.formatter.formatCurrency(data.option_period.fee)})`);
    }

    // Show critical deadlines
    const criticalDeadlines = results.timeline.filter(d => 
      d.priority === 'critical' && !d.is_expired && d.days_remaining <= 7
    );
    
    if (criticalDeadlines.length > 0) {
      console.log('\n🚨 UPCOMING CRITICAL DEADLINES:');
      criticalDeadlines.forEach(deadline => {
        const urgency = deadline.days_remaining <= 2 ? ' ⚠️ URGENT' : '';
        console.log(`   ${this.deadlineCalculator.formatDate(deadline.date)} - ${deadline.description}${urgency}`);
      });
    }

    console.log(`\n📊 Completeness Score: ${results.validation.completeness_score.toFixed(1)}%`);
    
    if (results.validation.missing_required.length > 0) {
      console.log(`❌ Missing Critical Info: ${results.validation.missing_required.join(', ')}`);
    }

    console.log('='.repeat(60));
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
📄 Spyglass Realty Contract Reader

USAGE:
  node reader.js <contract.pdf> [options]

OPTIONS:
  --output <dir>     Save output files to directory (default: ./output)
  --json-only        Output only JSON to stdout
  --quiet           Minimal console output
  --help            Show this help

EXAMPLES:
  node reader.js contract.pdf
  node reader.js contract.pdf --output ./reports
  node reader.js contract.pdf --json-only > analysis.json

ENVIRONMENT:
  ANTHROPIC_API_KEY  Required: Your Anthropic API key
`);
    process.exit(0);
  }

  const contractPath = args[0];
  const options = {
    outputDir: './output',
    jsonOnly: args.includes('--json-only'),
    quiet: args.includes('--quiet')
  };

  // Parse output directory option
  const outputIndex = args.indexOf('--output');
  if (outputIndex !== -1 && args[outputIndex + 1]) {
    options.outputDir = args[outputIndex + 1];
  }

  // Validate contract file
  if (!fs.existsSync(contractPath)) {
    console.error(`❌ Error: Contract file not found: ${contractPath}`);
    process.exit(1);
  }

  if (!contractPath.toLowerCase().endsWith('.pdf')) {
    console.error('❌ Error: File must be a PDF');
    process.exit(1);
  }

  try {
    const reader = new ContractReader();
    
    if (!options.quiet) {
      console.log('🚀 Starting contract analysis...');
    }

    const results = await reader.processContract(contractPath, options);

    if (options.jsonOnly) {
      // Output only JSON for piping
      console.log(results.outputs.json);
    } else {
      // Full interactive mode
      if (!options.quiet) {
        reader.displaySummary(results);
        console.log('\n💾 Saving output files...');
      }

      const savedFiles = await reader.saveOutputs(results, options.outputDir);
      
      if (!options.quiet) {
        console.log('\n📁 Files saved:');
        Object.entries(savedFiles).forEach(([type, path]) => {
          console.log(`   ${type}: ${path}`);
        });
        
        console.log('\n✅ Analysis complete! Review the generated files for detailed information.');
        console.log('\n💡 Pro tip: Use the timeline and checklist to stay on top of deadlines.');
      }
    }

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    
    if (!options.quiet) {
      console.error('\n🔍 Troubleshooting tips:');
      console.error('   - Ensure ANTHROPIC_API_KEY is set');
      console.error('   - Check that the PDF is readable (not scanned image)');
      console.error('   - Try a different PDF if the contract is corrupted');
      console.error('   - Check your internet connection for API access');
    }
    
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = ContractReader;
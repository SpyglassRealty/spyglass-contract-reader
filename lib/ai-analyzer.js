const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

class ContractAnalyzer {
  constructor() {
    // Initialize Anthropic client
    const apiKey = process.env.ANTHROPIC_API_KEY || this.loadAPIKey();
    if (!apiKey) {
      throw new Error('Anthropic API key not found. Set ANTHROPIC_API_KEY environment variable or add to ~/.credentials/');
    }
    
    this.anthropic = new Anthropic({
      apiKey: apiKey,
    });
  }

  /**
   * Load API key from credentials file
   * @returns {string|null} API key
   */
  loadAPIKey() {
    try {
      const credentialsPath = path.join(require('os').homedir(), '.credentials', 'anthropic.key');
      if (fs.existsSync(credentialsPath)) {
        return fs.readFileSync(credentialsPath, 'utf8').trim();
      }
      
      // Also check for a general credentials JSON file
      const jsonCredentialsPath = path.join(require('os').homedir(), '.credentials', 'credentials.json');
      if (fs.existsSync(jsonCredentialsPath)) {
        const credentials = JSON.parse(fs.readFileSync(jsonCredentialsPath, 'utf8'));
        return credentials.anthropic_api_key || credentials.ANTHROPIC_API_KEY;
      }
      
      return null;
    } catch (error) {
      console.warn('Error loading API key from credentials:', error.message);
      return null;
    }
  }

  /**
   * Load extraction prompt template
   * @returns {string} Prompt template
   */
  loadExtractionPrompt() {
    try {
      const promptPath = path.join(__dirname, '..', 'templates', 'extraction-prompt.txt');
      return fs.readFileSync(promptPath, 'utf8');
    } catch (error) {
      console.warn('Could not load prompt template, using default');
      return this.getDefaultPrompt();
    }
  }

  /**
   * Get default extraction prompt
   * @returns {string} Default prompt
   */
  getDefaultPrompt() {
    return `You are an expert Texas real estate transaction coordinator analyzing a contract. Extract the following information from the provided contract text and return it as a structured JSON object.

IMPORTANT: Return ONLY valid JSON, no other text or formatting.

Extract these fields (use null for missing information):

{
  "buyer_names": ["array of buyer names"],
  "buyer_contact": {
    "phone": "phone number",
    "email": "email address"
  },
  "seller_names": ["array of seller names"],
  "seller_contact": {
    "phone": "phone number", 
    "email": "email address"
  },
  "property_address": "full property address",
  "sales_price": "sales price as number",
  "earnest_money": {
    "amount": "earnest money amount as number",
    "deposit_deadline": "deadline for earnest money deposit"
  },
  "option_period": {
    "days": "number of option period days",
    "fee": "option fee amount as number",
    "expiration_date": "calculated expiration date if contract date available"
  },
  "closing_date": "scheduled closing date",
  "title_company": "title company name and address",
  "financing": {
    "type": "cash, conventional, FHA, VA, etc",
    "amount": "loan amount if applicable",
    "terms": "financing terms summary"
  },
  "listing_agent": {
    "name": "listing agent name",
    "brokerage": "listing brokerage name"
  },
  "buyers_agent": {
    "name": "buyer's agent name", 
    "brokerage": "buyer's brokerage name"
  },
  "special_provisions": "summary of special provisions and addenda",
  "deadlines": [
    {
      "type": "deadline type",
      "date": "deadline date",
      "description": "what is due"
    }
  ],
  "contingencies": ["array of contingencies and conditions"],
  "missing_items": ["array of missing signatures, addenda, etc"],
  "form_type": "TREC 1-4, Commercial, etc",
  "unusual_terms": "any non-standard or unusual provisions"
}`;
  }

  /**
   * Analyze contract text with AI
   * @param {string} contractText - Extracted contract text
   * @param {Object} metadata - PDF metadata
   * @returns {Promise<Object>} Analyzed contract data
   */
  async analyzeContract(contractText, metadata = {}) {
    try {
      const prompt = this.loadExtractionPrompt();
      
      const message = await this.anthropic.messages.create({
        model: "claude-3-sonnet-20240229", // Using Sonnet for cost efficiency
        max_tokens: 4000,
        temperature: 0.1, // Low temperature for consistent extraction
        messages: [
          {
            role: "user",
            content: `${prompt}\n\nContract Text:\n${contractText}`
          }
        ]
      });

      const responseText = message.content[0].text.trim();
      
      // Parse the JSON response
      let extractedData;
      try {
        extractedData = JSON.parse(responseText);
      } catch (parseError) {
        // Try to extract JSON from the response if it's wrapped in other text
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Could not parse AI response as JSON');
        }
      }

      // Add metadata and processing info
      const result = {
        success: true,
        data: extractedData,
        metadata: {
          ...metadata,
          processed_at: new Date().toISOString(),
          model_used: "claude-3-sonnet-20240229",
          tokens_used: message.usage?.input_tokens + message.usage?.output_tokens || 'unknown'
        },
        raw_response: responseText
      };

      return result;

    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: null,
        metadata: {
          ...metadata,
          processed_at: new Date().toISOString(),
          error_type: error.constructor.name
        }
      };
    }
  }

  /**
   * Validate extracted data for completeness
   * @param {Object} data - Extracted contract data
   * @returns {Object} Validation results
   */
  validateExtractedData(data) {
    const required_fields = [
      'buyer_names',
      'seller_names', 
      'property_address',
      'sales_price',
      'closing_date'
    ];

    const missing_required = required_fields.filter(field => 
      !data[field] || (Array.isArray(data[field]) && data[field].length === 0)
    );

    const important_fields = [
      'earnest_money',
      'option_period', 
      'title_company',
      'listing_agent',
      'buyers_agent'
    ];

    const missing_important = important_fields.filter(field => !data[field]);

    return {
      is_complete: missing_required.length === 0,
      missing_required,
      missing_important,
      completeness_score: ((required_fields.length - missing_required.length) / required_fields.length) * 100
    };
  }
}

module.exports = ContractAnalyzer;
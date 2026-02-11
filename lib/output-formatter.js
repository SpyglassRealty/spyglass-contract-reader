const DeadlineCalculator = require('./deadline-calculator');

class OutputFormatter {
  constructor() {
    this.deadlineCalculator = new DeadlineCalculator();
  }

  /**
   * Format complete contract analysis as JSON
   * @param {Object} contractData - Extracted contract data
   * @param {Array} timeline - Deadline timeline
   * @param {Object} metadata - Processing metadata
   * @returns {string} Formatted JSON output
   */
  formatJSON(contractData, timeline, metadata) {
    const output = {
      contract_data: contractData,
      timeline: timeline,
      metadata: metadata,
      generated_at: new Date().toISOString()
    };

    return JSON.stringify(output, null, 2);
  }

  /**
   * Generate human-readable markdown summary
   * @param {Object} contractData - Extracted contract data
   * @param {Array} timeline - Deadline timeline
   * @param {Object} validation - Validation results
   * @returns {string} Markdown summary
   */
  formatMarkdownSummary(contractData, timeline, validation) {
    let markdown = `# Contract Analysis Summary\n\n`;
    
    // Header with key details
    markdown += `## Key Information\n\n`;
    markdown += `**Property:** ${contractData.property_address || 'Not specified'}\n`;
    markdown += `**Sales Price:** $${this.formatCurrency(contractData.sales_price)}\n`;
    markdown += `**Closing Date:** ${this.formatDateValue(contractData.closing_date)}\n`;
    markdown += `**Form Type:** ${contractData.form_type || 'Unknown'}\n\n`;

    // Parties
    markdown += `## Parties\n\n`;
    markdown += `**Buyers:** ${this.formatNamesList(contractData.buyer_names)}\n`;
    markdown += `**Sellers:** ${this.formatNamesList(contractData.seller_names)}\n\n`;

    // Critical deadlines
    const criticalDeadlines = timeline.filter(d => d.priority === 'critical');
    if (criticalDeadlines.length > 0) {
      markdown += `## 🚨 Critical Deadlines\n\n`;
      criticalDeadlines.forEach(deadline => {
        const status = deadline.is_expired ? '❌ EXPIRED' : 
                      deadline.days_remaining <= 2 ? '⚠️ URGENT' : '✅';
        markdown += `- **${deadline.description}:** ${this.deadlineCalculator.formatDate(deadline.date)} ${status}\n`;
      });
      markdown += `\n`;
    }

    // Option period (Texas-specific)
    if (contractData.option_period) {
      markdown += `## Option Period (Texas)\n\n`;
      markdown += `**Days:** ${contractData.option_period.days || 'Not specified'}\n`;
      markdown += `**Fee:** $${this.formatCurrency(contractData.option_period.fee)}\n`;
      if (contractData.option_period.expiration_date) {
        markdown += `**Expires:** ${this.formatDateValue(contractData.option_period.expiration_date)}\n`;
      }
      markdown += `\n`;
    }

    // Financing
    if (contractData.financing) {
      markdown += `## Financing\n\n`;
      markdown += `**Type:** ${contractData.financing.type || 'Not specified'}\n`;
      if (contractData.financing.amount) {
        markdown += `**Amount:** $${this.formatCurrency(contractData.financing.amount)}\n`;
      }
      if (contractData.financing.terms) {
        markdown += `**Terms:** ${contractData.financing.terms}\n`;
      }
      markdown += `\n`;
    }

    // Agents and brokerages
    markdown += `## Real Estate Professionals\n\n`;
    if (contractData.listing_agent) {
      markdown += `**Listing Agent:** ${contractData.listing_agent.name || 'Not specified'}\n`;
      markdown += `**Listing Brokerage:** ${contractData.listing_agent.brokerage || 'Not specified'}\n`;
    }
    if (contractData.buyers_agent) {
      markdown += `**Buyer's Agent:** ${contractData.buyers_agent.name || 'Not specified'}\n`;
      markdown += `**Buyer's Brokerage:** ${contractData.buyers_agent.brokerage || 'Not specified'}\n`;
    }
    if (contractData.title_company) {
      markdown += `**Title Company:** ${contractData.title_company}\n`;
    }
    markdown += `\n`;

    // Special provisions
    if (contractData.special_provisions) {
      markdown += `## Special Provisions\n\n`;
      markdown += `${contractData.special_provisions}\n\n`;
    }

    // Contingencies
    if (contractData.contingencies && contractData.contingencies.length > 0) {
      markdown += `## Contingencies\n\n`;
      contractData.contingencies.forEach(contingency => {
        markdown += `- ${contingency}\n`;
      });
      markdown += `\n`;
    }

    // Unusual terms
    if (contractData.unusual_terms) {
      markdown += `## ⚠️ Unusual Terms\n\n`;
      markdown += `${contractData.unusual_terms}\n\n`;
    }

    // Data completeness
    markdown += `## Data Completeness\n\n`;
    markdown += `**Completeness Score:** ${validation.completeness_score.toFixed(1)}%\n`;
    if (validation.missing_required.length > 0) {
      markdown += `**Missing Required Fields:** ${validation.missing_required.join(', ')}\n`;
    }
    if (validation.missing_important.length > 0) {
      markdown += `**Missing Important Fields:** ${validation.missing_important.join(', ')}\n`;
    }

    return markdown;
  }

  /**
   * Generate deadline timeline as formatted text
   * @param {Array} timeline - Deadline timeline
   * @returns {string} Formatted timeline
   */
  formatTimeline(timeline) {
    if (!timeline || timeline.length === 0) {
      return 'No deadlines identified.\n';
    }

    let output = '# Deadline Timeline\n\n';
    
    // Group by status
    const upcoming = timeline.filter(d => !d.is_expired && d.days_remaining >= 0);
    const expired = timeline.filter(d => d.is_expired || d.days_remaining < 0);
    
    if (upcoming.length > 0) {
      output += '## Upcoming Deadlines\n\n';
      upcoming.forEach(deadline => {
        const urgency = deadline.days_remaining <= 2 ? ' ⚠️ URGENT' : 
                       deadline.days_remaining <= 7 ? ' 🟡' : ' 🟢';
        const estimated = deadline.estimated ? ' (estimated)' : '';
        
        output += `**${this.deadlineCalculator.formatDate(deadline.date)}**${urgency}${estimated}\n`;
        output += `${deadline.description}\n`;
        if (deadline.days_remaining >= 0) {
          output += `*${deadline.days_remaining} days remaining*\n`;
        }
        output += `\n`;
      });
    }

    if (expired.length > 0) {
      output += '## Past/Expired Deadlines\n\n';
      expired.forEach(deadline => {
        output += `**${this.deadlineCalculator.formatDate(deadline.date)}** ❌ EXPIRED\n`;
        output += `${deadline.description}\n\n`;
      });
    }

    return output;
  }

  /**
   * Generate missing items checklist
   * @param {Object} contractData - Extracted contract data
   * @param {Object} validation - Validation results
   * @returns {string} Missing items checklist
   */
  formatMissingItemsChecklist(contractData, validation) {
    let checklist = '# Missing Items Checklist\n\n';
    
    // Required fields missing
    if (validation.missing_required.length > 0) {
      checklist += '## ❌ Critical Missing Information\n\n';
      validation.missing_required.forEach(field => {
        checklist += `- [ ] ${this.fieldToHuman(field)}\n`;
      });
      checklist += '\n';
    }

    // Important fields missing
    if (validation.missing_important.length > 0) {
      checklist += '## ⚠️ Important Missing Information\n\n';
      validation.missing_important.forEach(field => {
        checklist += `- [ ] ${this.fieldToHuman(field)}\n`;
      });
      checklist += '\n';
    }

    // Missing items identified by AI
    if (contractData.missing_items && contractData.missing_items.length > 0) {
      checklist += '## 📋 Items to Verify/Obtain\n\n';
      contractData.missing_items.forEach(item => {
        checklist += `- [ ] ${item}\n`;
      });
      checklist += '\n';
    }

    // Common missing items for Texas contracts
    checklist += '## 🔍 Common Items to Verify\n\n';
    checklist += '- [ ] All parties have signed the contract\n';
    checklist += '- [ ] Earnest money check received and deposited\n';
    checklist += '- [ ] Option fee paid (if applicable)\n';
    checklist += '- [ ] Property disclosure notice provided\n';
    checklist += '- [ ] HOA documents provided (if applicable)\n';
    checklist += '- [ ] Title commitment ordered\n';
    checklist += '- [ ] Survey ordered (if required)\n';
    checklist += '- [ ] Inspection completed (if option period exercised)\n';
    checklist += '- [ ] Financing application submitted\n';
    checklist += '- [ ] Appraisal ordered\n';

    return checklist;
  }

  /**
   * Format all outputs as a comprehensive report
   * @param {Object} contractData - Extracted contract data
   * @param {Array} timeline - Deadline timeline
   * @param {Object} metadata - Processing metadata
   * @param {Object} validation - Validation results
   * @returns {Object} All formatted outputs
   */
  formatAllOutputs(contractData, timeline, metadata, validation) {
    return {
      json: this.formatJSON(contractData, timeline, metadata),
      summary: this.formatMarkdownSummary(contractData, timeline, validation),
      timeline: this.formatTimeline(timeline),
      checklist: this.formatMissingItemsChecklist(contractData, validation)
    };
  }

  /**
   * Helper: Format currency values
   * @param {number|string} value - Currency value
   * @returns {string} Formatted currency
   */
  formatCurrency(value) {
    if (!value) return '0';
    const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
    return num.toLocaleString('en-US');
  }

  /**
   * Helper: Format names list
   * @param {Array} names - Array of names
   * @returns {string} Formatted names
   */
  formatNamesList(names) {
    if (!names || !Array.isArray(names) || names.length === 0) {
      return 'Not specified';
    }
    return names.join(', ');
  }

  /**
   * Helper: Format date values
   * @param {string} dateValue - Date string
   * @returns {string} Formatted date
   */
  formatDateValue(dateValue) {
    if (!dateValue) return 'Not specified';
    const date = this.deadlineCalculator.parseContractDate(dateValue);
    return date ? this.deadlineCalculator.formatDate(date) : dateValue;
  }

  /**
   * Helper: Convert field names to human-readable
   * @param {string} fieldName - Field name
   * @returns {string} Human-readable field name
   */
  fieldToHuman(fieldName) {
    const fieldMap = {
      'buyer_names': 'Buyer name(s)',
      'seller_names': 'Seller name(s)',
      'property_address': 'Property address',
      'sales_price': 'Sales price',
      'closing_date': 'Closing date',
      'earnest_money': 'Earnest money details',
      'option_period': 'Option period information',
      'title_company': 'Title company',
      'listing_agent': 'Listing agent information',
      'buyers_agent': 'Buyer\'s agent information'
    };
    
    return fieldMap[fieldName] || fieldName.replace(/_/g, ' ');
  }
}

module.exports = OutputFormatter;
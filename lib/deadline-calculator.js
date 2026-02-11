/**
 * Deadline Calculator for Texas Real Estate Contracts
 * Handles calculation of critical deadlines and timelines
 */

class DeadlineCalculator {
  constructor() {
    // Texas business days exclude weekends and common holidays
    this.holidays = [
      // Standard US holidays that affect real estate transactions
      '2024-01-01', '2024-01-15', '2024-02-19', '2024-05-27', '2024-06-19', 
      '2024-07-04', '2024-09-02', '2024-10-14', '2024-11-11', '2024-11-28', 
      '2024-12-25', '2024-12-31'
      // Add more years as needed
    ];
  }

  /**
   * Parse various date formats commonly found in contracts
   * @param {string} dateStr - Date string from contract
   * @returns {Date|null} Parsed date or null if invalid
   */
  parseContractDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;

    // Clean the date string
    const cleaned = dateStr.trim().replace(/[^\d\/\-\s]/g, '');
    
    // Common patterns in real estate contracts
    const patterns = [
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,  // MM/DD/YYYY
      /(\d{1,2})-(\d{1,2})-(\d{4})/,   // MM-DD-YYYY
      /(\d{4})-(\d{1,2})-(\d{1,2})/,   // YYYY-MM-DD
      /(\d{1,2})\/(\d{1,2})\/(\d{2})/  // MM/DD/YY
    ];

    for (const pattern of patterns) {
      const match = cleaned.match(pattern);
      if (match) {
        let year, month, day;
        
        if (pattern.source.startsWith('(\\d{4})')) {
          // YYYY-MM-DD format
          [, year, month, day] = match;
        } else if (match[3] && match[3].length === 2) {
          // Two-digit year - assume 20XX
          [, month, day, year] = match;
          year = '20' + year;
        } else {
          // MM/DD/YYYY or MM-DD-YYYY
          [, month, day, year] = match;
        }

        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        
        // Validate the date
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    return null;
  }

  /**
   * Check if a date is a business day (excludes weekends and holidays)
   * @param {Date} date - Date to check
   * @returns {boolean} True if business day
   */
  isBusinessDay(date) {
    const dayOfWeek = date.getDay();
    
    // Weekend check
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }

    // Holiday check
    const dateStr = date.toISOString().split('T')[0];
    return !this.holidays.includes(dateStr);
  }

  /**
   * Add business days to a date
   * @param {Date} startDate - Starting date
   * @param {number} businessDays - Number of business days to add
   * @returns {Date} Calculated end date
   */
  addBusinessDays(startDate, businessDays) {
    let currentDate = new Date(startDate);
    let daysAdded = 0;

    while (daysAdded < businessDays) {
      currentDate.setDate(currentDate.getDate() + 1);
      
      if (this.isBusinessDay(currentDate)) {
        daysAdded++;
      }
    }

    return currentDate;
  }

  /**
   * Add calendar days to a date
   * @param {Date} startDate - Starting date
   * @param {number} days - Number of days to add
   * @returns {Date} Calculated end date
   */
  addCalendarDays(startDate, days) {
    const result = new Date(startDate);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * Calculate option period deadline (Texas-specific)
   * Option period starts the day after effective date and runs for X days
   * @param {Date} effectiveDate - Contract effective date
   * @param {number} optionDays - Number of option period days
   * @returns {Object} Option period details
   */
  calculateOptionPeriod(effectiveDate, optionDays) {
    if (!effectiveDate || !optionDays) {
      return null;
    }

    // Option period starts the day after effective date
    const startDate = this.addCalendarDays(effectiveDate, 1);
    
    // Option period is calendar days, not business days
    const endDate = this.addCalendarDays(startDate, optionDays);
    
    // Option must be exercised by 5:00 PM on the last day
    const deadline = new Date(endDate);
    deadline.setHours(17, 0, 0, 0); // 5:00 PM

    return {
      start_date: startDate,
      end_date: endDate,
      deadline: deadline,
      days_remaining: this.daysBetween(new Date(), endDate),
      is_expired: new Date() > deadline
    };
  }

  /**
   * Calculate days between two dates
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {number} Number of days
   */
  daysBetween(startDate, endDate) {
    const timeDiff = endDate.getTime() - startDate.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }

  /**
   * Generate timeline of all deadlines from contract data
   * @param {Object} contractData - Extracted contract data
   * @returns {Array} Array of deadline objects sorted by date
   */
  generateDeadlineTimeline(contractData) {
    const deadlines = [];
    
    // Extract effective date (usually the last signature date or specified effective date)
    let effectiveDate = this.parseContractDate(contractData.effective_date);
    if (!effectiveDate && contractData.closing_date) {
      // Fallback: assume effective date is recent if closing date is provided
      const closingDate = this.parseContractDate(contractData.closing_date);
      if (closingDate) {
        effectiveDate = this.addCalendarDays(closingDate, -30); // Estimate
      }
    }

    // Option period deadline
    if (contractData.option_period && contractData.option_period.days && effectiveDate) {
      const optionPeriod = this.calculateOptionPeriod(effectiveDate, contractData.option_period.days);
      if (optionPeriod) {
        deadlines.push({
          type: 'option_period',
          date: optionPeriod.deadline,
          description: `Option period expires (${contractData.option_period.days} days)`,
          priority: 'critical',
          is_expired: optionPeriod.is_expired,
          days_remaining: optionPeriod.days_remaining
        });
      }
    }

    // Earnest money deadline
    if (contractData.earnest_money && contractData.earnest_money.deposit_deadline) {
      const earnestDeadline = this.parseContractDate(contractData.earnest_money.deposit_deadline);
      if (earnestDeadline) {
        deadlines.push({
          type: 'earnest_money',
          date: earnestDeadline,
          description: `Earnest money deposit due ($${contractData.earnest_money.amount})`,
          priority: 'high',
          is_expired: new Date() > earnestDeadline,
          days_remaining: this.daysBetween(new Date(), earnestDeadline)
        });
      }
    }

    // Closing date
    if (contractData.closing_date) {
      const closingDate = this.parseContractDate(contractData.closing_date);
      if (closingDate) {
        deadlines.push({
          type: 'closing',
          date: closingDate,
          description: 'Scheduled closing date',
          priority: 'critical',
          is_expired: new Date() > closingDate,
          days_remaining: this.daysBetween(new Date(), closingDate)
        });

        // Add typical deadlines before closing
        deadlines.push({
          type: 'financing_approval',
          date: this.addBusinessDays(closingDate, -7),
          description: 'Financing approval typically due',
          priority: 'high',
          estimated: true
        });

        deadlines.push({
          type: 'final_walkthrough',
          date: this.addBusinessDays(closingDate, -1),
          description: 'Final walkthrough',
          priority: 'medium',
          estimated: true
        });
      }
    }

    // Add deadlines from the contract data itself
    if (contractData.deadlines && Array.isArray(contractData.deadlines)) {
      contractData.deadlines.forEach(deadline => {
        const date = this.parseContractDate(deadline.date);
        if (date) {
          deadlines.push({
            type: deadline.type || 'other',
            date: date,
            description: deadline.description,
            priority: 'medium',
            is_expired: new Date() > date,
            days_remaining: this.daysBetween(new Date(), date)
          });
        }
      });
    }

    // Sort by date
    deadlines.sort((a, b) => a.date - b.date);

    return deadlines;
  }

  /**
   * Format date for display
   * @param {Date} date - Date to format
   * @returns {string} Formatted date string
   */
  formatDate(date) {
    if (!date) return 'Unknown';
    
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}

module.exports = DeadlineCalculator;
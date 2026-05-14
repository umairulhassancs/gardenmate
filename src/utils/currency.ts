/**
 * Currency Utility for Pakistani Rupee (PKR) formatting
 * 
 * This utility provides consistent price formatting across the application.
 * Prices are displayed in Pakistani Rupees (PKR) with proper formatting.
 */

/**
 * Format a price value to Pakistani Rupees (PKR)
 * 
 * @param price - The price value in PKR (already in local currency)
 * @returns Formatted price string with 'Rs.' prefix and comma separation
 * 
 * @example
 * formatPrice(1500) // Returns "Rs. 1,500"
 * formatPrice(25000) // Returns "Rs. 25,000"
 */
export function formatPrice(price: number): string {
    if (isNaN(price) || price === null || price === undefined) {
        return 'Rs. 0';
    }

    // Round to nearest whole number for cleaner display
    const roundedPrice = Math.round(price);

    // Format with Pakistani numbering system (commas every 2 digits after first 3)
    const formatted = roundedPrice.toLocaleString('en-PK');

    return `Rs. ${formatted}`;
}

/**
 * Format a price value with decimal places (for precise amounts)
 * 
 * @param price - The price value in PKR
 * @returns Formatted price string with 'Rs.' prefix and 2 decimal places
 */
export function formatPriceWithDecimals(price: number): string {
    if (isNaN(price) || price === null || price === undefined) {
        return 'Rs. 0.00';
    }

    const formatted = price.toLocaleString('en-PK', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    return `Rs. ${formatted}`;
}

/**
 * Parse a PKR formatted string back to a number
 * 
 * @param priceString - A string like "Rs. 1,500" or "1500"
 * @returns The numeric value
 */
export function parsePrice(priceString: string): number {
    if (!priceString) return 0;

    // Remove 'Rs.', 'Rs', commas, and spaces
    const cleaned = priceString
        .replace(/Rs\.?/gi, '')
        .replace(/,/g, '')
        .trim();

    return parseFloat(cleaned) || 0;
}

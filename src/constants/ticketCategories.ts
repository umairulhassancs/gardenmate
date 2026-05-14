// Ticket Category Configurations
// Defines all ticket categories with metadata for UI display
// COD-only business: removed payment_issue, refund_request, account_issue, technical_issue

import { CategoryMetadata, TicketCategory, TicketPriority } from '../types/ticket';

export const TICKET_CATEGORIES: Record<string, CategoryMetadata> = {
    damaged_product: {
        id: 'damaged_product' as TicketCategory,
        label: 'Damaged Product',
        icon: 'alert-octagon',
        description: 'Product arrived damaged or broken',
        suggestedPriority: 'critical',
    },
    wrong_item: {
        id: 'wrong_item' as TicketCategory,
        label: 'Wrong Item',
        icon: 'x-circle',
        description: 'Received incorrect or different product',
        suggestedPriority: 'high',
    },
    missing_parts: {
        id: 'missing_parts' as TicketCategory,
        label: 'Missing Parts',
        icon: 'box',
        description: 'Items missing from order',
        suggestedPriority: 'high',
    },
    delivery_issue: {
        id: 'delivery_issue' as TicketCategory,
        label: 'Delivery Issue',
        icon: 'truck',
        description: 'Late delivery, not received, wrong address',
        suggestedPriority: 'high',
    },
    product_issue: {
        id: 'product_issue' as TicketCategory,
        label: 'Product Quality',
        icon: 'package',
        description: 'Issues with product quality or performance',
        suggestedPriority: 'high',
    },
    general: {
        id: 'general' as TicketCategory,
        label: 'Other',
        icon: 'message-circle',
        description: 'General questions or other issues',
        suggestedPriority: 'low',
    },
};

/**
 * Get category metadata by ID
 */
export function getCategoryMetadata(categoryId: string): CategoryMetadata | null {
    return TICKET_CATEGORIES[categoryId] || null;
}

/**
 * Get all categories as array
 */
export function getAllCategories(): CategoryMetadata[] {
    return Object.values(TICKET_CATEGORIES);
}

/**
 * Get suggested priority for a category
 */
export function getSuggestedPriority(categoryId: string): TicketPriority {
    const category = TICKET_CATEGORIES[categoryId];
    return category ? category.suggestedPriority : 'medium';
}

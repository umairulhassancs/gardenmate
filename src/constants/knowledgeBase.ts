// Knowledge Base - FAQ Articles for Ticket System
// Suggest relevant articles before ticket creation to reduce unnecessary tickets

export interface KBArticle {
    id: string;
    title: string;
    content: string;
    category: string; // maps to ticket categories
    tags: string[];
    icon: string; // Feather icon
}

export const KB_ARTICLES: KBArticle[] = [
    // ── Damaged Product ──
    {
        id: 'kb-001',
        title: 'What should I do if my plant arrived damaged?',
        content: 'If your plant arrived damaged, please take clear photos of the damage (including packaging) within 24 hours of delivery. Then create a ticket with the photos attached. Our team will process a replacement or refund within 48 hours. For minor leaf damage during transit, plants usually recover within 1-2 weeks with proper care.',
        category: 'damaged_product',
        tags: ['damaged', 'broken', 'plant', 'delivery', 'replacement'],
        icon: 'alert-octagon',
    },
    {
        id: 'kb-002',
        title: 'Can I get a refund for a damaged item?',
        content: 'Yes! If your item arrived damaged, you are eligible for a full refund or free replacement. Please submit a ticket within 48 hours of receiving the order with photos of the damage. Refunds are processed to your original payment method within 5-7 business days after approval.',
        category: 'damaged_product',
        tags: ['refund', 'damaged', 'money back', 'replacement'],
        icon: 'dollar-sign',
    },

    // ── Wrong Item ──
    {
        id: 'kb-003',
        title: 'I received a different item than what I ordered',
        content: 'We apologize for the mix-up! Please do NOT discard the wrong item. Create a ticket with your order number, a photo of what you received, and what you expected. We will arrange a pickup for the wrong item and ship the correct one at no extra cost. This is typically resolved within 3-5 business days.',
        category: 'wrong_item',
        tags: ['wrong', 'different', 'incorrect', 'mix-up', 'order'],
        icon: 'x-circle',
    },
    {
        id: 'kb-004',
        title: 'The plant species I received doesn\'t match the listing',
        content: 'Plant appearance can vary from listing photos due to natural growth variations, seasons, and lighting. However, if you believe the species itself is different from what was listed, please create a ticket with a photo. Our plant experts will verify and arrange an exchange if needed.',
        category: 'wrong_item',
        tags: ['species', 'variety', 'different plant', 'listing', 'photo'],
        icon: 'image',
    },

    // ── Missing Parts ──
    {
        id: 'kb-005',
        title: 'My order is missing items',
        content: 'If items are missing from your order, first check if your order was split into multiple shipments (check your order confirmation email). If all items were supposed to arrive together, create a ticket with your order number and list which items are missing. We will ship the missing items immediately at no extra cost.',
        category: 'missing_parts',
        tags: ['missing', 'incomplete', 'items', 'parts', 'shipment'],
        icon: 'box',
    },
    {
        id: 'kb-006',
        title: 'My pot/accessory is missing from the plant order',
        content: 'Some plants ship separately from pots and accessories to prevent shipping damage. Check your order details to see if items are in separate packages. If all items should have arrived together and something is missing, create a ticket and we\'ll resolve it within 24 hours.',
        category: 'missing_parts',
        tags: ['pot', 'accessory', 'missing', 'separate', 'package'],
        icon: 'package',
    },

    // ── Delivery Issue ──
    {
        id: 'kb-007',
        title: 'My order hasn\'t arrived yet',
        content: 'Standard delivery takes 3-5 business days within your city and 5-7 business days for intercity orders. You can track your order status in the "Order History" section. If your estimated delivery date has passed, create a ticket and we\'ll investigate with the courier partner immediately.',
        category: 'delivery_issue',
        tags: ['late', 'delayed', 'not arrived', 'tracking', 'delivery time'],
        icon: 'clock',
    },
    {
        id: 'kb-008',
        title: 'My order was delivered to the wrong address',
        content: 'Please verify the delivery address in your order details first. If the address is correct but the package was delivered elsewhere, create a ticket immediately. We will coordinate with the courier to locate your package. For future orders, make sure to double-check your shipping address before checkout.',
        category: 'delivery_issue',
        tags: ['wrong address', 'delivered', 'location', 'courier', 'lost'],
        icon: 'map-pin',
    },
    {
        id: 'kb-009',
        title: 'Can I change my delivery address after placing an order?',
        content: 'Address changes can be made only if the order has not been shipped yet. Go to "Order History", find your order, and check its status. If it shows "Processing", contact us immediately through a ticket. Once shipped, address changes are unfortunately not possible.',
        category: 'delivery_issue',
        tags: ['change address', 'update', 'shipping', 'modify order'],
        icon: 'edit',
    },

    // ── Product Issue ──
    {
        id: 'kb-010',
        title: 'My plant is wilting or dying after delivery',
        content: 'Plants can experience "transplant shock" after shipping, which is normal. Here are recovery tips:\n\n• Water the plant lightly — don\'t overwater\n• Place in indirect sunlight for 3-5 days\n• Avoid repotting for at least a week\n• Remove any dead/yellow leaves\n\nIf the plant doesn\'t improve after a week, create a ticket with photos and we\'ll help.',
        category: 'product_issue',
        tags: ['wilting', 'dying', 'yellow leaves', 'drooping', 'care', 'shipping shock'],
        icon: 'feather',
    },
    {
        id: 'kb-011',
        title: 'The product quality doesn\'t match what was advertised',
        content: 'Plant sizes and appearances naturally vary. However, if the product significantly differs from the description (e.g., much smaller size, different pot color, unhealthy condition), please create a ticket with a photo comparison — the listing photo vs. what you received. We take quality very seriously.',
        category: 'product_issue',
        tags: ['quality', 'not as described', 'advertised', 'size', 'appearance'],
        icon: 'alert-circle',
    },
    {
        id: 'kb-012',
        title: 'My plant has pests or bugs',
        content: 'If you notice pests on your plant upon delivery, isolate it from other plants immediately. Common treatments:\n\n• Mealybugs: Wipe with rubbing alcohol\n• Aphids: Spray with neem oil solution\n• Spider mites: Increase humidity, use insecticidal soap\n\nCreate a ticket with photos for a replacement if the infestation is severe.',
        category: 'product_issue',
        tags: ['pest', 'bugs', 'insects', 'mealybugs', 'aphids', 'spider mites'],
        icon: 'alert-triangle',
    },

    // ── General ──
    {
        id: 'kb-013',
        title: 'How do I cancel my order?',
        content: 'Orders can be cancelled if they haven\'t been shipped yet. Go to "Order History", find the order, and check its status. If it shows "Processing", you can request cancellation through a ticket. Once shipped, cancellation is not possible — but you can refuse delivery and request a return.',
        category: 'general',
        tags: ['cancel', 'order', 'cancellation', 'return'],
        icon: 'x',
    },
    {
        id: 'kb-014',
        title: 'How do I track my order?',
        content: 'You can track your order in the app:\n\n1. Go to "Profile" → "Order History"\n2. Find your order and tap on it\n3. View current status and estimated delivery date\n\nYou\'ll also receive push notifications when your order status changes (shipped, out for delivery, delivered).',
        category: 'general',
        tags: ['track', 'order status', 'where is my order', 'shipping status'],
        icon: 'search',
    },
    {
        id: 'kb-015',
        title: 'How do I contact my vendor directly?',
        content: 'You can chat with your vendor directly from the order details screen. Go to "Order History", tap on the relevant order, and use the "Chat with Vendor" button. You can also visit the vendor\'s store page by tapping their name anywhere in the app.',
        category: 'general',
        tags: ['contact vendor', 'chat', 'message', 'seller', 'communicate'],
        icon: 'message-circle',
    },
    {
        id: 'kb-016',
        title: 'What is the return/exchange policy?',
        content: 'Our return policy:\n\n• Live plants: 48-hour return window for damaged/dead plants (photo required)\n• Pots & accessories: 7-day return for defective items (unused condition)\n• Seeds & fertilizers: Non-returnable once opened\n\nReturn shipping is covered by us for defective items. Create a ticket to initiate a return.',
        category: 'general',
        tags: ['return', 'exchange', 'policy', 'refund', 'send back'],
        icon: 'rotate-ccw',
    },
];

/**
 * Search KB articles by query (fuzzy match on title + tags)
 */
export function searchKB(query: string): KBArticle[] {
    if (!query || query.trim().length < 2) return [];
    const q = query.toLowerCase().trim();
    return KB_ARTICLES.filter(article => {
        const titleMatch = article.title.toLowerCase().includes(q);
        const tagMatch = article.tags.some(tag => tag.includes(q));
        const contentMatch = article.content.toLowerCase().includes(q);
        return titleMatch || tagMatch || contentMatch;
    });
}

/**
 * Get articles relevant to a specific ticket category
 */
export function getArticlesForCategory(category: string): KBArticle[] {
    return KB_ARTICLES.filter(a => a.category === category);
}

/**
 * Get all unique categories from KB
 */
export function getKBCategories(): string[] {
    return [...new Set(KB_ARTICLES.map(a => a.category))];
}

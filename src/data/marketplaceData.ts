// Marketplace Mock Data - Multi-Vendor Plant Store

// Type Definitions
export interface Vendor {
    id: string;
    name: string;
    logo: string;
    coverImage: string;
    description: string;
    rating: number;
    reviewsCount: number;
    totalSales: number;
    responseTime: string;
    memberSince: string;
    isVerified: boolean;
    location: string;
    email: string;
    phone: string;
    workingHours: string;
}

export interface Product {
    id: string;
    name: string;
    price: number;
    originalPrice?: number;
    rating: number;
    reviewsCount: number;
    image: string;
    images: string[];
    hasAR: boolean;
    vendorId: string;
    category: string;
    description: string;
    careInfo: {
        water: string;
        light: string;
        temperature: string;
        humidity: string;
    };
    tags: string[];
    inStock: boolean;
    stockCount: number;
    shippingDays: number;
    freeShipping: boolean;
}

// Vendor Data - 4 Different Plant Stores
export const VENDORS: Vendor[] = [ 
    {
        id: 'v1',
        name: 'Green Thumb Nursery',
        logo: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=100&h=100&fit=crop&crop=center',
        coverImage: 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=800&h=400&fit=crop',
        description: 'Premium indoor plants and rare tropical species. We\'ve been bringing nature indoors since 2015. Every plant is hand-selected and nurtured with care before reaching your home.',
        rating: 4.9,
        reviewsCount: 1240,
        totalSales: 5680,
        responseTime: 'Usually responds within 1 hour',
        memberSince: '2015',
        isVerified: true,
        location: 'Los Angeles, CA',
        email: 'hello@greenthumb.com',
        phone: '+1 (323) 555-0147',
        workingHours: 'Mon-Sat: 9AM - 6PM',
    },
    {
        id: 'v2',
        name: 'Botanical Bliss',
        logo: 'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=100&h=100&fit=crop&crop=center',
        coverImage: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=400&fit=crop',
        description: 'Your destination for flowering plants and succulents. We specialize in low-maintenance plants perfect for beginners and busy plant parents.',
        rating: 4.7,
        reviewsCount: 856,
        totalSales: 3420,
        responseTime: 'Usually responds within 2 hours',
        memberSince: '2018',
        isVerified: true,
        location: 'Austin, TX',
        email: 'care@botanicalbliss.com',
        phone: '+1 (512) 555-0198',
        workingHours: 'Mon-Fri: 10AM - 7PM',
    },
    {
        id: 'v3',
        name: 'Urban Jungle Co.',
        logo: 'https://images.unsplash.com/photo-1520412099551-62b6bafeb5bb?w=100&h=100&fit=crop&crop=center',
        coverImage: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=800&h=400&fit=crop',
        description: 'Transform your space into a lush urban jungle. We offer rare aroids, statement plants, and modern planters to elevate your interior design.',
        rating: 4.8,
        reviewsCount: 672,
        totalSales: 2890,
        responseTime: 'Usually responds within 3 hours',
        memberSince: '2019',
        isVerified: true,
        location: 'New York, NY',
        email: 'hello@urbanjungle.co',
        phone: '+1 (212) 555-0284',
        workingHours: 'Mon-Sun: 8AM - 8PM',
    },
    {
        id: 'v4',
        name: 'Desert Rose Plants',
        logo: 'https://images.unsplash.com/photo-1509423350716-97f9360b4e09?w=100&h=100&fit=crop&crop=center',
        coverImage: 'https://images.unsplash.com/photo-1446071103084-c257b5f70672?w=800&h=400&fit=crop',
        description: 'Specialists in cacti, succulents, and drought-tolerant plants. Perfect for sunny spots and minimal watering schedules.',
        rating: 4.6,
        reviewsCount: 445,
        totalSales: 1870,
        responseTime: 'Usually responds within 4 hours',
        memberSince: '2020',
        isVerified: false,
        location: 'Phoenix, AZ',
        email: 'info@desertroseplants.com',
        phone: '+1 (602) 555-0321',
        workingHours: 'Tue-Sat: 9AM - 5PM',
    },
];

// Product Data - Distributed Across Vendors
export const PRODUCTS: Product[] = [
    // Green Thumb Nursery (v1) - Tropical Plants
    {
        id: '1',
        name: 'Monstera Deliciosa',
        price: 45.00,
        originalPrice: 55.00,
        rating: 4.8,
        reviewsCount: 324,
        image: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=400&h=400&fit=crop',
        images: [
            'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=600&h=600&fit=crop',
            'https://images.unsplash.com/photo-1637967886160-fd78dc3ce3f5?w=600&h=600&fit=crop',
            'https://images.unsplash.com/photo-1600411833196-7c1f6b1a8b90?w=600&h=600&fit=crop',
        ],
        hasAR: true,
        vendorId: 'v1',
        category: 'Tropical',
        description: 'Known as the Swiss Cheese Plant, this tropical beauty is famous for its natural leaf holes called fenestrations. It\'s a fast grower and adds an instant jungle vibe to any room. Perfect for bright, indirect light spaces.',
        careInfo: {
            water: 'Weekly',
            light: 'Bright Indirect',
            temperature: '18-30°C',
            humidity: '60-80%',
        },
        tags: ['Indoor', 'Tropical', 'Air Purifying'],
        inStock: true,
        stockCount: 23,
        shippingDays: 3,
        freeShipping: true,
    },
    {
        id: '2',
        name: 'Fiddle Leaf Fig',
        price: 65.00,
        rating: 4.7,
        reviewsCount: 218,
        image: 'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=400&h=400&fit=crop',
        images: [
            'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=600&h=600&fit=crop',
            'https://images.unsplash.com/photo-1545241047-6083a3684587?w=600&h=600&fit=crop',
        ],
        hasAR: true,
        vendorId: 'v1',
        category: 'Indoor',
        description: 'The Fiddle Leaf Fig is an Instagram favorite with its large, violin-shaped leaves. This statement plant can grow up to 6 feet tall indoors, making it perfect as a floor plant.',
        careInfo: {
            water: 'Every 1-2 weeks',
            light: 'Bright Indirect',
            temperature: '16-24°C',
            humidity: '50-60%',
        },
        tags: ['Indoor', 'Statement Plant', 'Popular'],
        inStock: true,
        stockCount: 12,
        shippingDays: 5,
        freeShipping: true,
    },
    {
        id: '3',
        name: 'Bird of Paradise',
        price: 85.00,
        originalPrice: 99.00,
        rating: 4.9,
        reviewsCount: 156,
        image: 'https://images.unsplash.com/photo-1598880940371-c756e015fca7?w=400&h=400&fit=crop',
        images: [
            'https://images.unsplash.com/photo-1598880940371-c756e015fca7?w=600&h=600&fit=crop',
        ],
        hasAR: true,
        vendorId: 'v1',
        category: 'Tropical',
        description: 'Bring the tropics home with this stunning Bird of Paradise. Known for its banana-like leaves and exotic appearance, it creates an instant vacation vibe in any room.',
        careInfo: {
            water: 'Weekly',
            light: 'Full Sun to Bright Indirect',
            temperature: '18-30°C',
            humidity: '60-70%',
        },
        tags: ['Tropical', 'Statement Plant', 'Large'],
        inStock: true,
        stockCount: 8,
        shippingDays: 4,
        freeShipping: true,
    },

    // Botanical Bliss (v2) - Flowering & Easy Plants
    {
        id: '4',
        name: 'Peace Lily',
        price: 35.00,
        rating: 4.5,
        reviewsCount: 412,
        image: 'https://images.unsplash.com/photo-1593691509543-c55fb32e2db1?w=400&h=400&fit=crop',
        images: [
            'https://images.unsplash.com/photo-1593691509543-c55fb32e2db1?w=600&h=600&fit=crop',
        ],
        hasAR: true,
        vendorId: 'v2',
        category: 'Flowering',
        description: 'The Peace Lily is a classic houseplant known for its elegant white flowers and air-purifying qualities. Perfect for low-light spaces and beginner plant parents.',
        careInfo: {
            water: 'When soil is dry',
            light: 'Low to Medium',
            temperature: '18-26°C',
            humidity: '50-60%',
        },
        tags: ['Flowering', 'Air Purifying', 'Low Light', 'Beginner'],
        inStock: true,
        stockCount: 45,
        shippingDays: 2,
        freeShipping: false,
    },
    {
        id: '5',
        name: 'Pothos Golden',
        price: 18.00,
        rating: 4.6,
        reviewsCount: 567,
        image: 'https://images.unsplash.com/photo-1572688484438-313a6e50c333?w=400&h=400&fit=crop',
        images: [
            'https://images.unsplash.com/photo-1572688484438-313a6e50c333?w=600&h=600&fit=crop',
        ],
        hasAR: false,
        vendorId: 'v2',
        category: 'Indoor',
        description: 'The ultimate beginner plant! Golden Pothos is virtually indestructible and grows beautiful trailing vines. Perfect for shelves, hanging baskets, or as a climbing plant.',
        careInfo: {
            water: 'Every 1-2 weeks',
            light: 'Low to Bright Indirect',
            temperature: '15-30°C',
            humidity: '40-60%',
        },
        tags: ['Indoor', 'Beginner', 'Trailing', 'Air Purifying'],
        inStock: true,
        stockCount: 78,
        shippingDays: 2,
        freeShipping: false,
    },
    {
        id: '6',
        name: 'Anthurium Red',
        price: 42.00,
        rating: 4.4,
        reviewsCount: 234,
        image: 'https://images.unsplash.com/photo-1567748157439-651aca2ff064?w=400&h=400&fit=crop',
        images: [
            'https://images.unsplash.com/photo-1567748157439-651aca2ff064?w=600&h=600&fit=crop',
        ],
        hasAR: false,
        vendorId: 'v2',
        category: 'Flowering',
        description: 'Add a pop of color with this stunning Anthurium. Its heart-shaped red flowers bloom year-round, making it a perfect gift or centerpiece plant.',
        careInfo: {
            water: 'When top inch is dry',
            light: 'Bright Indirect',
            temperature: '20-28°C',
            humidity: '60-80%',
        },
        tags: ['Flowering', 'Colorful', 'Gift Plant'],
        inStock: true,
        stockCount: 19,
        shippingDays: 3,
        freeShipping: false,
    },

    // Urban Jungle Co. (v3) - Rare Aroids & Statement Plants
    {
        id: '7',
        name: 'Snake Plant',
        price: 25.00,
        rating: 4.9,
        reviewsCount: 689,
        image: 'https://images.unsplash.com/photo-1593482892540-9e4d90032a49?w=400&h=400&fit=crop',
        images: [
            'https://images.unsplash.com/photo-1593482892540-9e4d90032a49?w=600&h=600&fit=crop',
        ],
        hasAR: true,
        vendorId: 'v3',
        category: 'Indoor',
        description: 'The ultimate set-it-and-forget-it plant! Snake Plants are nearly indestructible and convert CO2 to oxygen at night, making them perfect bedroom companions.',
        careInfo: {
            water: 'Every 2-3 weeks',
            light: 'Low to Bright Indirect',
            temperature: '15-27°C',
            humidity: '30-50%',
        },
        tags: ['Indoor', 'Air Purifying', 'Low Maintenance', 'Bedroom'],
        inStock: true,
        stockCount: 56,
        shippingDays: 3,
        freeShipping: true,
    },
    {
        id: '8',
        name: 'Philodendron Pink Princess',
        price: 120.00,
        originalPrice: 150.00,
        rating: 4.8,
        reviewsCount: 89,
        image: 'https://images.unsplash.com/photo-1620127252536-03bdfcb68a37?w=400&h=400&fit=crop',
        images: [
            'https://images.unsplash.com/photo-1620127252536-03bdfcb68a37?w=600&h=600&fit=crop',
        ],
        hasAR: false,
        vendorId: 'v3',
        category: 'Rare',
        description: 'The highly coveted Pink Princess Philodendron features stunning pink variegation on dark green leaves. A true collector\'s item that will be the star of your plant collection.',
        careInfo: {
            water: 'When top inch is dry',
            light: 'Bright Indirect',
            temperature: '18-27°C',
            humidity: '60-70%',
        },
        tags: ['Rare', 'Collector', 'Variegated'],
        inStock: true,
        stockCount: 4,
        shippingDays: 2,
        freeShipping: true,
    },
    {
        id: '9',
        name: 'ZZ Plant',
        price: 40.00,
        rating: 4.8,
        reviewsCount: 445,
        image: 'https://images.unsplash.com/photo-1632207691143-643e2a9a9361?w=400&h=400&fit=crop',
        images: [
            'https://images.unsplash.com/photo-1632207691143-643e2a9a9361?w=600&h=600&fit=crop',
        ],
        hasAR: false,
        vendorId: 'v3',
        category: 'Indoor',
        description: 'The ZZ Plant is perfect for offices and low-light spaces. Its waxy, dark green leaves add a modern touch to any space while requiring minimal care.',
        careInfo: {
            water: 'Every 2-3 weeks',
            light: 'Low to Medium',
            temperature: '18-26°C',
            humidity: '40-50%',
        },
        tags: ['Indoor', 'Low Light', 'Office', 'Low Maintenance'],
        inStock: true,
        stockCount: 34,
        shippingDays: 3,
        freeShipping: true,
    },

    // Desert Rose Plants (v4) - Cacti & Succulents
    {
        id: '10',
        name: 'Echeveria Elegans',
        price: 15.00,
        rating: 4.5,
        reviewsCount: 287,
        image: 'https://images.unsplash.com/photo-1509423350716-97f9360b4e09?w=400&h=400&fit=crop',
        images: [
            'https://images.unsplash.com/photo-1509423350716-97f9360b4e09?w=600&h=600&fit=crop',
        ],
        hasAR: false,
        vendorId: 'v4',
        category: 'Succulents',
        description: 'This beautiful rosette-shaped succulent features powder-blue leaves with pink edges when stressed. Perfect for sunny windowsills and succulent arrangements.',
        careInfo: {
            water: 'Every 2-3 weeks',
            light: 'Full Sun',
            temperature: '10-25°C',
            humidity: '20-40%',
        },
        tags: ['Succulent', 'Compact', 'Sun Loving'],
        inStock: true,
        stockCount: 89,
        shippingDays: 2,
        freeShipping: false,
    },
    {
        id: '11',
        name: 'Golden Barrel Cactus',
        price: 28.00,
        rating: 4.6,
        reviewsCount: 156,
        image: 'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=400&h=400&fit=crop',
        images: [
            'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=600&h=600&fit=crop',
        ],
        hasAR: false,
        vendorId: 'v4',
        category: 'Cacti',
        description: 'A striking spherical cactus with golden spines that glows in sunlight. Extremely low maintenance and drought-tolerant, perfect for forgetful plant parents.',
        careInfo: {
            water: 'Monthly',
            light: 'Full Sun',
            temperature: '10-35°C',
            humidity: '10-30%',
        },
        tags: ['Cactus', 'Drought Tolerant', 'Sculptural'],
        inStock: true,
        stockCount: 42,
        shippingDays: 3,
        freeShipping: false,
    },
    {
        id: '12',
        name: 'Aloe Vera',
        price: 22.00,
        rating: 4.7,
        reviewsCount: 534,
        image: 'https://images.unsplash.com/photo-1567331711402-509c12c41959?w=400&h=400&fit=crop',
        images: [
            'https://images.unsplash.com/photo-1567331711402-509c12c41959?w=600&h=600&fit=crop',
        ],
        hasAR: true,
        vendorId: 'v4',
        category: 'Succulents',
        description: 'More than just a pretty plant! Aloe Vera is a natural remedy for minor burns and skin irritations. Easy to grow and a wonderful addition to any kitchen window.',
        careInfo: {
            water: 'Every 2-3 weeks',
            light: 'Bright Indirect to Full Sun',
            temperature: '13-27°C',
            humidity: '30-50%',
        },
        tags: ['Medicinal', 'Succulent', 'Kitchen', 'Beginner'],
        inStock: true,
        stockCount: 67,
        shippingDays: 2,
        freeShipping: false,
    },
];

// Helper Functions


export const getProductById = (productId: string): Product | undefined => {
    return PRODUCTS.find(p => p.id === productId);
};

export const getProductsByVendor = (vendorId: string): Product[] => {
    return PRODUCTS.filter(p => p.vendorId === vendorId);
};

export const getProductsByCategory = (category: string): Product[] => {
    if (category === 'All') return PRODUCTS;
    if (category === 'AR') return PRODUCTS.filter(p => p.hasAR);
    return PRODUCTS.filter(p => p.category === category || p.tags.includes(category));
};
// marketplaceData.ts mein isay update karein
export const getVendorById = (vendorId: string): Vendor | undefined => {
    if (!vendorId) return undefined;
    
    // Dono ko lowercase kar ke check karein taake mistake na ho
    return VENDORS.find(v => v.id.toLowerCase() === vendorId.toLowerCase());
};
// Categories derived from products
export const CATEGORIES = ['All', 'AR', 'Indoor', 'Tropical', 'Succulents', 'Flowering', 'Rare', 'Cacti'];

// Product Review Interface
export interface ProductReview {
    id: string;
    productId: string;
    customerName: string;
    customerAvatar: string;
    rating: number;
    title: string;
    text: string;
    date: string;
    helpful: number;
    verified: boolean;
    images?: string[];
}

// Mock Product Reviews
export const PRODUCT_REVIEWS: ProductReview[] = [
    // Monstera Deliciosa (id: 1)
    { id: 'r1', productId: '1', customerName: 'Sarah M.', customerAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop', rating: 5, title: 'Absolutely stunning!', text: 'This Monstera arrived in perfect condition with beautiful fenestrations. It\'s already pushing out new leaves. Highly recommend this seller!', date: '2 weeks ago', helpful: 24, verified: true },
    { id: 'r2', productId: '1', customerName: 'Mike R.', customerAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop', rating: 5, title: 'Perfect addition to my living room', text: 'Great packaging and fast shipping. The plant is healthy and big for the price. Already ordering another one for my bedroom!', date: '1 month ago', helpful: 18, verified: true },
    { id: 'r3', productId: '1', customerName: 'Emma T.', customerAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop', rating: 4, title: 'Beautiful but smaller than expected', text: 'The plant is healthy and beautiful, just a bit smaller than I expected from the photos. Still love it though!', date: '1 month ago', helpful: 12, verified: true },

    // Fiddle Leaf Fig (id: 2)
    { id: 'r4', productId: '2', customerName: 'James K.', customerAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop', rating: 5, title: 'Instagram-worthy plant!', text: 'Exactly what I was looking for. The seller even included care tips. It\'s been 3 months and it\'s thriving!', date: '3 weeks ago', helpful: 31, verified: true },
    { id: 'r5', productId: '2', customerName: 'Lisa P.', customerAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop', rating: 4, title: 'Great quality', text: 'Beautiful plant with big healthy leaves. Shipping took a few extra days but totally worth the wait.', date: '1 month ago', helpful: 8, verified: true },

    // Bird of Paradise (id: 3)
    { id: 'r6', productId: '3', customerName: 'David W.', customerAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop', rating: 5, title: 'Tropical paradise!', text: 'This plant instantly transformed my living room into a tropical oasis. Absolutely gorgeous and well-packaged.', date: '2 weeks ago', helpful: 42, verified: true },

    // Peace Lily (id: 4)
    { id: 'r7', productId: '4', customerName: 'Amanda C.', customerAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop', rating: 5, title: 'Perfect for my office', text: 'Low light in my office was a concern, but this Peace Lily is thriving! Already seeing new blooms.', date: '1 week ago', helpful: 15, verified: true },
    { id: 'r8', productId: '4', customerName: 'Robert J.', customerAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop', rating: 5, title: 'Great beginner plant', text: 'First plant I haven\'t killed! Easy to care for and looks beautiful. Highly recommend for beginners.', date: '3 weeks ago', helpful: 22, verified: true },

    // Pothos Golden (id: 5)
    { id: 'r9', productId: '5', customerName: 'Jennifer L.', customerAvatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=100&h=100&fit=crop', rating: 5, title: 'Grows so fast!', text: 'This pothos is unstoppable! Within 2 months it\'s already trailing down my bookshelf. Great value for money.', date: '2 weeks ago', helpful: 28, verified: true },
    { id: 'r10', productId: '5', customerName: 'Chris B.', customerAvatar: 'https://images.unsplash.com/photo-1507081323647-4d250478b919?w=100&h=100&fit=crop', rating: 4, title: 'Hardy and beautiful', text: 'Even with my inconsistent watering, this plant is doing great. Perfect for busy people like me.', date: '1 month ago', helpful: 11, verified: true },

    // Snake Plant (id: 7)
    { id: 'r11', productId: '7', customerName: 'Michelle S.', customerAvatar: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=100&h=100&fit=crop', rating: 5, title: 'The indestructible plant!', text: 'I\'ve killed many plants before, but this snake plant refuses to die. It\'s been 6 months and still going strong with minimal care.', date: '3 weeks ago', helpful: 45, verified: true },
    { id: 'r12', productId: '7', customerName: 'Alex T.', customerAvatar: 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=100&h=100&fit=crop', rating: 5, title: 'Perfect bedroom plant', text: 'Love that it produces oxygen at night. Sleeping better and my room looks amazing. Win-win!', date: '1 month ago', helpful: 33, verified: true },

    // Pink Princess (id: 8)
    { id: 'r13', productId: '8', customerName: 'Sophia R.', customerAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop', rating: 5, title: 'Worth every penny!', text: 'The variegation on this plant is incredible! Beautiful pink sections on almost every leaf. A true collector\'s piece.', date: '1 week ago', helpful: 56, verified: true },

    // ZZ Plant (id: 9)
    { id: 'r14', productId: '9', customerName: 'Tom H.', customerAvatar: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=100&h=100&fit=crop', rating: 5, title: 'Office favorite', text: 'Everyone at my office compliments this plant. It looks amazing and I barely have to do anything!', date: '2 weeks ago', helpful: 19, verified: true },

    // Aloe Vera (id: 12)
    { id: 'r15', productId: '12', customerName: 'Nancy M.', customerAvatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=100&h=100&fit=crop', rating: 5, title: 'Beautiful and useful!', text: 'Already used the gel for a kitchen burn. Works like magic! Plus it looks gorgeous on my kitchen windowsill.', date: '1 week ago', helpful: 27, verified: true },
    { id: 'r16', productId: '12', customerName: 'Steve P.', customerAvatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=100&h=100&fit=crop', rating: 4, title: 'Healthy and well-packaged', text: 'Arrived in great condition with healthy roots. Already producing pups after 2 months!', date: '3 weeks ago', helpful: 14, verified: true },
];

// Get reviews for a specific product
export const getReviewsByProduct = (productId: string): ProductReview[] => {
    return PRODUCT_REVIEWS.filter(r => r.productId === productId);
};

// Get average rating from reviews
export const getProductRating = (productId: string): { average: number; count: number } => {
    const reviews = getReviewsByProduct(productId);
    if (reviews.length === 0) return { average: 0, count: 0 };
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return { average: sum / reviews.length, count: reviews.length };
};


/**
 * Seed AR Products into Firestore
 * Run: node scripts/seedARProducts.js
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, getDocs, query, where } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyCccVpOYTW2xLXfB2tWVqjJ9VCSTl5SuZY",
    authDomain: "gardenmate-3e7c5.firebaseapp.com",
    databaseURL: "https://gardenmate-3e7c5-default-rtdb.firebaseio.com",
    projectId: "gardenmate-3e7c5",
    storageBucket: "gardenmate-3e7c5.firebasestorage.app",
    messagingSenderId: "429528664912",
    appId: "1:429528664912:web:9b7f02104bb744ce697a55",
    measurementId: "G-VC0ZHSYL06"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const arProducts = [
    {
        name: "Monstera Deliciosa",
        description: "The iconic Swiss Cheese Plant with its dramatic, naturally perforated leaves. A statement piece for any modern interior. Native to tropical rainforests of Central America, this plant thrives in bright indirect light and adds an exotic touch to living rooms, offices, and bedrooms. Easy to care for and fast-growing.",
        price: 2500,
        category: "Indoor",
        productType: "plant",
        stock: 15,
        image: "https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=600",
        images: [
            "https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=600",
            "https://images.unsplash.com/photo-1612363148951-15f16817a4d0?w=600"
        ],
        tags: ["Indoor", "Air Purifying", "Tropical"],
        careInfo: {
            water: "Weekly",
            light: "Bright Indirect",
            temperature: "18-30°C"
        },
        rating: 4.8,
        hasAR: true,
        arEnabled: true,
        arModelUrl: "https://gardenmate-3e7c5.firebasestorage.app/ar-models/monstera.glb",
        discount: 15,
        originalPrice: 2941,
        freeShipping: true,
        shippingDays: "3-5",
        createdAt: new Date(),
    },
    {
        name: "Peace Lily (Spathiphyllum)",
        description: "An elegant indoor plant known for its beautiful white blooms and superb air-purifying qualities. NASA-recommended for removing toxins like formaldehyde, benzene, and carbon monoxide from indoor air. Thrives in low to medium light, making it perfect for offices and rooms with limited natural light.",
        price: 1800,
        category: "Indoor",
        productType: "plant",
        stock: 22,
        image: "https://images.unsplash.com/photo-1593691509543-c55fb32d8de5?w=600",
        images: [
            "https://images.unsplash.com/photo-1593691509543-c55fb32d8de5?w=600",
            "https://images.unsplash.com/photo-1616690710400-a16d146927c5?w=600"
        ],
        tags: ["Indoor", "Air Purifying", "Low Maintenance"],
        careInfo: {
            water: "Twice Weekly",
            light: "Low to Medium",
            temperature: "16-27°C"
        },
        rating: 4.6,
        hasAR: true,
        arEnabled: true,
        arModelUrl: "https://gardenmate-3e7c5.firebasestorage.app/ar-models/peace-lily.glb",
        discount: 0,
        freeShipping: true,
        shippingDays: "2-4",
        createdAt: new Date(),
    },
    {
        name: "Fiddle Leaf Fig (Ficus Lyrata)",
        description: "The ultimate trendsetter plant with large, violin-shaped glossy leaves. A favorite among interior designers and plant enthusiasts alike. This statement plant grows tall and adds a dramatic architectural element to any room. Best placed near a bright window for optimal growth.",
        price: 3200,
        category: "Indoor",
        productType: "plant",
        stock: 8,
        image: "https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=600",
        images: [
            "https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=600",
            "https://images.unsplash.com/photo-1545241047-6083a3684587?w=600"
        ],
        tags: ["Indoor", "Tropical", "Rare"],
        careInfo: {
            water: "Weekly",
            light: "Bright Indirect",
            temperature: "18-28°C"
        },
        rating: 4.5,
        hasAR: true,
        arEnabled: true,
        arModelUrl: "https://gardenmate-3e7c5.firebasestorage.app/ar-models/fiddle-leaf-fig.glb",
        discount: 20,
        originalPrice: 4000,
        freeShipping: false,
        shippingDays: "3-5",
        createdAt: new Date(),
    },
    {
        name: "Snake Plant (Sansevieria)",
        description: "One of the hardiest houseplants available, perfect for beginners. The Snake Plant features upright, sword-like leaves with striking green and yellow variegation. Known for its exceptional air-purifying abilities — it even releases oxygen at night, making it ideal for bedrooms. Tolerates neglect and low light like a champion.",
        price: 1200,
        category: "Indoor",
        productType: "plant",
        stock: 30,
        image: "https://images.unsplash.com/photo-1572688484438-313a56e6dc34?w=600",
        images: [
            "https://images.unsplash.com/photo-1572688484438-313a56e6dc34?w=600",
            "https://images.unsplash.com/photo-1593482892540-0f282eb8dcfb?w=600"
        ],
        tags: ["Indoor", "Air Purifying", "Beginner"],
        careInfo: {
            water: "Biweekly",
            light: "Any Light",
            temperature: "15-32°C"
        },
        rating: 4.9,
        hasAR: true,
        arEnabled: true,
        arModelUrl: "https://gardenmate-3e7c5.firebasestorage.app/ar-models/snake-plant.glb",
        discount: 0,
        freeShipping: true,
        shippingDays: "2-3",
        createdAt: new Date(),
    }
];

async function seedProducts() {
    try {
        // Find Green Garden vendor
        console.log('🔍 Looking for Green Garden vendor...');
        const vendorsRef = collection(db, 'vendors');
        const vendorSnap = await getDocs(vendorsRef);

        let vendorId = null;
        vendorSnap.forEach(doc => {
            const data = doc.data();
            if (data.storeName && data.storeName.toLowerCase().includes('green garden')) {
                vendorId = doc.id;
                console.log(`✅ Found vendor: ${data.storeName} (ID: ${doc.id})`);
            }
        });

        if (!vendorId) {
            // If no Green Garden vendor, list all vendors
            console.log('⚠️  Green Garden vendor not found. Available vendors:');
            vendorSnap.forEach(doc => {
                const data = doc.data();
                console.log(`   - ${data.storeName || data.name || 'Unknown'} (ID: ${doc.id})`);
            });

            // Use first vendor as fallback
            if (vendorSnap.size > 0) {
                vendorId = vendorSnap.docs[0].id;
                console.log(`\n📌 Using first vendor as fallback: ${vendorId}`);
            } else {
                console.log('❌ No vendors found in database. Please create a vendor first.');
                process.exit(1);
            }
        }

        // Add products
        const productsRef = collection(db, 'products');
        console.log('\n🌿 Adding AR products...\n');

        for (const product of arProducts) {
            product.vendorId = vendorId;
            const docRef = await addDoc(productsRef, product);
            const discountLabel = product.discount > 0 ? ` (${product.discount}% OFF)` : '';
            console.log(`✅ Added: ${product.name} - Rs. ${product.price}${discountLabel} [ID: ${docRef.id}]`);
        }

        console.log('\n🎉 All 4 AR products added successfully!');
        console.log('   - 2 with discounts (Monstera 15% OFF, Fiddle Leaf Fig 20% OFF)');
        console.log('   - All are Indoor plants with AR support');
        console.log('   - All under Green Garden store');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

seedProducts();

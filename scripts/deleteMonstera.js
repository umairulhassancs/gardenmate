const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc } = require('firebase/firestore');

const app = initializeApp({
    apiKey: "AIzaSyCccVpOYTW2xLXfB2tWVqjJ9VCSTl5SuZY",
    authDomain: "gardenmate-3e7c5.firebaseapp.com",
    projectId: "gardenmate-3e7c5",
    storageBucket: "gardenmate-3e7c5.firebasestorage.app",
    messagingSenderId: "429528664912",
    appId: "1:429528664912:web:9b7f02104bb744ce697a55"
});
const db = getFirestore(app);

// Names of the 63 products just added
const addedNames = new Set([
    "Rubber Plant (Ficus Elastica)", "Pothos (Money Plant)", "ZZ Plant (Zamioculcas)",
    "Red Rose Bush", "Jasmine (Motia)", "Hibiscus (Gul-e-Daoodi)", "Marigold (Genda)",
    "Sunflower Plant", "Night Blooming Jasmine (Raat Ki Rani)", "Dahlia Mixed Colors",
    "Mango Tree (Chaunsa Grafted)", "Guava Tree (Amrood)", "Lemon Tree (Nimbu)",
    "Pomegranate Tree (Anaar)", "Banana Plant (Kela)", "Papaya Plant", "Fig Tree (Anjeer)",
    "Tomato Plant (Tamatar)", "Green Chili Plant (Hari Mirch)", "Cucumber Plant (Kheera)",
    "Spinach Seedlings (Palak)", "Bitter Gourd Plant (Karela)", "Okra Plant (Bhindi)", "Eggplant (Baingan)",
    "Mint Plant (Pudina)", "Coriander Plant (Dhaniya)", "Basil Plant (Niazbo)", "Aloe Vera",
    "Lemongrass (Hari Chai)", "Curry Leaf Plant (Kari Patta)", "Rosemary Plant",
    "Bougainvillea", "Star Jasmine (Chameli)", "English Ivy", "Passion Flower Vine",
    "Morning Glory (Petunia Vine)", "Madhumalti (Rangoon Creeper)",
    "Tomato Seeds Pack", "Sunflower Seeds Pack", "Mixed Herb Seeds Kit", "Watermelon Seeds Pack",
    "Marigold Seeds Pack", "Chili Seeds Variety Pack", "Lawn Grass Seeds (1 kg)",
    "Terracotta Clay Pot (Medium)", "Ceramic Glazed Pot (White)", "Hanging Macrame Planter",
    "Large Fiber Pot (12 inch)", "Self-Watering Pot (Smart Pot)", "Seedling Tray (72 Cells)",
    "Organic Compost (5 kg)", "NPK 20-20-20 Fertilizer (1 kg)", "Vermicompost (3 kg)",
    "DAP Fertilizer (1 kg)", "Bone Meal Organic (2 kg)", "Neem Cake Fertilizer (2 kg)", "Potting Mix Premium (5 kg)",
    "Garden Tool Set (5 Piece)", "Garden Spray Bottle (1L)", "Plant Support Sticks (Pack of 10)",
    "Gardening Gloves (Pair)", "Pruning Shears (Heavy Duty)", "Drip Irrigation Kit (20 Plants)",
]);

async function main() {
    const snap = await getDocs(collection(db, 'products'));
    let deleted = 0;
    let kept = 0;

    for (const d of snap.docs) {
        const name = d.data().name;
        if (addedNames.has(name)) {
            await deleteDoc(doc(db, 'products', d.id));
            deleted++;
        } else {
            kept++;
            console.log(`  ✅ Kept: ${name}`);
        }
    }

    console.log(`\n❌ Deleted: ${deleted} products`);
    console.log(`✅ Kept: ${kept} products`);
    process.exit(0);
}
main();

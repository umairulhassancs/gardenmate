const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');
const { getAuth, createUserWithEmailAndPassword, signOut } = require('firebase/auth');

const app = initializeApp({
    apiKey: "AIzaSyCccVpOYTW2xLXfB2tWVqjJ9VCSTl5SuZY",
    authDomain: "gardenmate-3e7c5.firebaseapp.com",
    projectId: "gardenmate-3e7c5",
    storageBucket: "gardenmate-3e7c5.firebasestorage.app",
    messagingSenderId: "429528664912",
    appId: "1:429528664912:web:9b7f02104bb744ce697a55"
});
const db = getFirestore(app);
const auth = getAuth(app);

const TEST_PASSWORD = 'test123456';

const testUsers = [
    {
        email: 'user@gmail.com',
        name: 'Test User',
        role: 'user',
        status: 'active',
    },
    {
        email: 'admin@gmail.com',
        name: 'Test Admin',
        role: 'admin',
        status: 'active',
    },
    {
        email: 'vendor@fmail.com',
        name: 'Test Vendor',
        role: 'vendor',
        status: 'approved',
        storeName: 'Test Nursery',
        cnic: '3410112345678',
        nurseryAddress: 'Test Address, Lahore',
    },
];

async function createTestUsers() {
    console.log('🔧 Creating test users...\n');

    for (const userData of testUsers) {
        try {
            // 1. Create Firebase Auth user
            const userCredential = await createUserWithEmailAndPassword(auth, userData.email, TEST_PASSWORD);
            const uid = userCredential.user.uid;
            console.log(`✅ Auth created: ${userData.email} (${uid})`);

            // 2. Create Firestore user document
            await setDoc(doc(db, "users", uid), {
                uid: uid,
                name: userData.name,
                email: userData.email,
                role: userData.role,
                status: userData.status,
                createdAt: new Date().toISOString(),
                ...(userData.storeName && { storeName: userData.storeName }),
                ...(userData.cnic && { cnic: userData.cnic }),
                ...(userData.nurseryAddress && { nurseryAddress: userData.nurseryAddress }),
            });
            console.log(`✅ Firestore user doc created: ${userData.role}`);

            // 3. If vendor, also create vendors collection doc
            if (userData.role === 'vendor') {
                await setDoc(doc(db, "vendors", uid), {
                    vendorId: uid,
                    vendorName: userData.name,
                    storeName: userData.storeName,
                    email: userData.email,
                    phone: '',
                    status: 'active',
                    cnic: userData.cnic || '',
                    nurseryAddress: userData.nurseryAddress || '',
                    nurseryPhotos: [],
                    registrationDocs: [],
                    registeredAt: new Date().toISOString(),
                    totalSales: 0,
                    totalCommissionDue: 0,
                    currentMonthSales: 0,
                    currentMonthCommission: 0
                });
                console.log(`✅ Vendors collection doc created`);
            }

            await signOut(auth);
            console.log(`✅ ${userData.role.toUpperCase()} ready!\n`);
        } catch (err) {
            if (err.code === 'auth/email-already-in-use') {
                console.log(`⚠️  ${userData.email} already exists, skipping.\n`);
            } else {
                console.error(`❌ Error for ${userData.email}:`, err.message, '\n');
            }
        }
    }

    console.log('🎉 All test users created!');
    console.log('📧 Credentials:');
    console.log('   user@gmail.com    / test123456  → User Dashboard');
    console.log('   admin@gmail.com   / test123456  → Admin Dashboard');
    console.log('   vendor@fmail.com  / test123456  → Vendor Dashboard');
    process.exit(0);
}

createTestUsers();

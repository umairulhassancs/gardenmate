import { auth, db } from './firebaseConfig';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { notifyAdmins } from './notifyHelper';

class AuthService {
    async register(email, password, name) {
        try {
            // 1. Automatic Role Detection
            let assignedRole = 'user';
            let shouldVerify = true; // Normal user ko verify karna hoga

            if (email.toLowerCase().includes('@admin')) {
                assignedRole = 'admin';
                shouldVerify = false; // Admin auto-verify
            } else if (email.toLowerCase().includes('@vendor')) {
                assignedRole = 'vendor';
                shouldVerify = false; // Vendor auto-verify

                // Notify admins about new vendor
                try {
                    // We use a lingering promise here
                    notifyAdmins(
                        'New Vendor Registration',
                        `New vendor ${name} (${email}) has registered.`,
                        '',
                        'alert'
                    ).catch(err => console.error("Failed to notify admins:", err));
                } catch (e) {
                    console.error('Failed to notify admins of new vendor:', e);
                }
            }

            // 2. Auth mein user banayein
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 3. Firestore mein data save karein
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                name: name,
                email: email,
                role: assignedRole,
                isVerified: !shouldVerify, // Database mein record rakhne ke liye
                createdAt: new Date().toISOString()
            });

            return { ...user, role: assignedRole };
        } catch (error) {
            console.error("Signup Error:", error.code, error.message);
            throw error;
        }
    }

    async login(email, password) {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 4. Role Fetch karein
            const userDoc = await getDoc(doc(db, "users", user.uid));

            if (userDoc.exists()) {
                const userData = userDoc.data();

                // 5. Verification Check (Sirf normal users ke liye)
                // Admin aur Vendor bina email verification ke login kar sakenge
                if (userData.role === 'user' && !user.emailVerified) {
                    await signOut(auth);
                    throw new Error("Pehle apni email verify karein!");
                }

                return userData;
            } else {
                throw new Error("User profile not found.");
            }
        } catch (error) {
            console.error("Login Error:", error.message);
            throw error;
        }
    }
}

export default new AuthService();
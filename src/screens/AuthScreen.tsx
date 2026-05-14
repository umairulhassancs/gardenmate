import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
    KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing } from '../theme';

// FIREBASE IMPORTS
import { auth, db, storage } from '../services/firebaseConfig';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendEmailVerification,
    sendPasswordResetEmail,
    signOut
} from 'firebase/auth';
import { doc, setDoc, getDoc, addDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { notifyAdmins } from '../services/notifyHelper';

type AuthStep = 'auth' | 'verify';
type Tab = 'login' | 'signup';
type UserRole = 'user' | 'vendor' | 'admin';

export default function AuthScreen({ navigation }: any) {
    const [step, setStep] = useState<AuthStep>('auth');
    const [activeTab, setActiveTab] = useState<Tab>('login');
    const [loading, setLoading] = useState(false);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [showLoginRoleModal, setShowLoginRoleModal] = useState(false);
    const [selectedRole, setSelectedRole] = useState<UserRole>('user');
    const [selectedLoginRole, setSelectedLoginRole] = useState<UserRole | null>(null);

    // Form states
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [signupName, setSignupName] = useState('');
    const [signupEmail, setSignupEmail] = useState('');
    const [signupPassword, setSignupPassword] = useState('');

    // Vendor Specific States
    const [nurseryName, setNurseryName] = useState('');
    const [cnic, setCnic] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [nurseryPhotos, setNurseryPhotos] = useState<string[]>([]);
    const [registrationDocs, setRegistrationDocs] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);

    // Password visibility states
    const [showLoginPassword, setShowLoginPassword] = useState(false);
    const [showSignupPassword, setShowSignupPassword] = useState(false);

    // Image Picker Helper
    const pickImage = async (setList: React.Dispatch<React.SetStateAction<string[]>>) => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false, // Set to true if you want cropping
            quality: 0.7,
            allowsMultipleSelection: true, // Allow selecting multiple images
        });

        if (!result.canceled) {
            const newUris = result.assets.map(asset => asset.uri);
            setList(prev => [...prev, ...newUris]);
        }
    };

    // Remove Image Helper
    const removeImage = (index: number, setList: React.Dispatch<React.SetStateAction<string[]>>) => {
        setList(prev => prev.filter((_, i) => i !== index));
    };

    // Robust Image Upload using FileSystem
    const uploadImages = async (uris: string[], path: string, userId: string) => {
        const downloadUrls = [];
        for (let i = 0; i < uris.length; i++) {
            try {
                const uri = uris[i];
                console.log(`Uploading image ${i + 1}/${uris.length} to ${path}...`);

                // 1. Read file as Base64 using expo-file-system
                const base64 = await FileSystem.readAsStringAsync(uri, {
                    encoding: 'base64',
                });

                // 2. Do NOT convert to Blob (unreliable). Use putString with 'base64'
                // Or better: Create a blob from base64 manually if needed, but uploadString is easiest for base64
                // However, uploadBytes requires Blob or Uint8Array. 
                // Let's use the fetch trick which works well with base64 data URIs on modern RN
                const response = await fetch(`data:image/jpeg;base64,${base64}`);
                const blob = await response.blob();

                const storageRef = ref(storage, `${path}/${userId}/${Date.now()}_${i}.jpg`);
                await uploadBytes(storageRef, blob);
                const url = await getDownloadURL(storageRef);
                downloadUrls.push(url);
                console.log(`Image ${i + 1} uploaded: ${url}`);
            } catch (uploadErr: any) {
                console.error(`Failed to upload image ${i}:`, uploadErr);
                throw new Error(`Image upload failed: ${uploadErr.message}`);
            }
        }
        return downloadUrls;
    };

    // Forgot Password Handler
    const handleForgotPassword = async () => {
        if (!loginEmail) {
            Alert.alert("Enter Email", "Please enter your email address first, then tap Forgot Password.");
            return;
        }
        console.log("Attempting to send password reset email to:", loginEmail);
        try {
            await sendPasswordResetEmail(auth, loginEmail);
            console.log("Password reset email sent successfully to:", loginEmail);
            Alert.alert("Reset Email Sent", `Check your inbox (${loginEmail}) for a password reset link.`);
        } catch (error: any) {
            console.error("Error sending password reset email:", error);
            Alert.alert("Error", error.message);
        }
    };

    // ✅ CHECK USER ROLES BEFORE SHOWING MODAL
    const checkUserRolesAndShowModal = async () => {
        if (!loginEmail || !loginPassword) {
            Alert.alert("Error", "Please enter email and password.");
            return;
        }

        setLoading(true);

        try {
            // 1. Sign In
            const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
            const user = userCredential.user;

            // 2. Data Fetch
            const userDoc = await getDoc(doc(db, "users", user.uid));

            if (!userDoc.exists()) {
                await signOut(auth);
                throw new Error("User record not found.");
            }

            const userData = userDoc.data();
            const emailLower = loginEmail.toLowerCase();

            // 3. ADMIN CHECK (Priority)
            if (userData.role === 'admin' || emailLower.includes('admin')) {
                navigation.replace('AdminTabs');
                return;
            }

            // 4. DOMAIN-BASED LOGIC

            // A. AGAR VENDOR DOMAIN HAI (@vendor.com)
            if (emailLower.endsWith('@vendor.com')) {
                // Vendor status check (Approval check)
                if (userData.status === 'pending') {
                    Alert.alert("Pending", "Your vendor account is awaiting admin approval.");
                    await signOut(auth);
                    return;
                }
                if (userData.status === 'blocked') {
                    Alert.alert("Access Denied", "Your vendor account is blocked.");
                    await signOut(auth);
                    return;
                }

                navigation.replace('VendorTabs');
            }

            // B. AGAR GMAIL HAI YA KOI AUR (@gmail.com)
            else {
                // User ke liye hamesha email verification check karein
                if (!user.emailVerified) {
                    Alert.alert("Verify Email", "Please verify your email first.");
                    await signOut(auth);
                    return;
                }

                navigation.replace('MainTabs');
            }

        } catch (error: any) {
            const code = error?.code || '';
            if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
                Alert.alert('Wrong Credentials', 'Wrong email or password. Please try again.');
            } else if (code === 'auth/too-many-requests') {
                Alert.alert('Too Many Attempts', 'Account temporarily locked due to too many failed attempts. Please try again later.');
            } else if (code === 'auth/invalid-email') {
                Alert.alert('Invalid Email', 'Please enter a valid email address.');
            } else if (code === 'auth/network-request-failed') {
                Alert.alert('No Internet', 'Please check your internet connection and try again.');
            } else {
                Alert.alert('Login Failed', error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    // ✅ LOGIN WITH SELECTED ROLE
    const handleLoginWithRole = async (roleToLogin: UserRole) => {
        setLoading(true);

        try {
            const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
            const user = userCredential.user;

            // Always get data from users collection first
            const userDoc = await getDoc(doc(db, "users", user.uid));

            if (!userDoc.exists()) {
                throw new Error("User record not found in database.");
            }

            const userData = userDoc.data();
            const status = userData.status;
            const actualRole = userData.role;

            // ✅ Admin Check - Admins can always login
            if (actualRole === 'admin') {
                navigation.replace('AdminTabs');
                setLoading(false);
                return;
            }

            // ✅ Vendor Approval Check (only if logging in as vendor)
            if (roleToLogin === 'vendor' || actualRole === 'vendor') {
                if (status === 'pending') {
                    Alert.alert("Approval Pending", "Your account is pending admin approval.");
                    await signOut(auth);
                    setLoading(false);
                    return;
                }
                if (status === 'blocked') {
                    Alert.alert("Access Denied", "Your account has been blocked.");
                    await signOut(auth);
                    setLoading(false);
                    return;
                }
            }

            // ✅ User Email Verification (only for normal users)
            if ((roleToLogin === 'user' || actualRole === 'user') && !user.emailVerified) {
                Alert.alert("Verify Email", "Please verify your email first.");
                await signOut(auth);
                setLoading(false);
                return;
            }

            // ✅ ROLE BASED NAVIGATION
            // Use the selected login role, or fall back to actual role
            const finalRole = roleToLogin || actualRole;

            if (finalRole === 'admin') {
                navigation.replace('AdminTabs');
            } else if (finalRole === 'vendor') {
                navigation.replace('VendorTabs');
            } else {
                navigation.replace('MainTabs');
            }
        } catch (error: any) {
            const code = error?.code || '';
            if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
                Alert.alert('Wrong Credentials', 'Wrong email or password. Please try again.');
            } else if (code === 'auth/too-many-requests') {
                Alert.alert('Too Many Attempts', 'Account temporarily locked due to too many failed attempts. Please try again later.');
            } else if (code === 'auth/invalid-email') {
                Alert.alert('Invalid Email', 'Please enter a valid email address.');
            } else if (code === 'auth/network-request-failed') {
                Alert.alert('No Internet', 'Please check your internet connection and try again.');
            } else {
                Alert.alert('Login Failed', error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    // ✅ HANDLE LOGIN ROLE SELECTION
    const selectLoginRoleAndProceed = async (role: UserRole) => {
        setShowLoginRoleModal(false);
        setSelectedLoginRole(role);
        await handleLoginWithRole(role);
    };

    // --- SIGNUP LOGIC ---
    const handleSignup = async () => {
        if (!signupEmail || !signupPassword || !signupName) {
            Alert.alert("Error", "All fields are required.");
            return;
        }

        // Vendor Validation
        if (selectedRole === 'vendor') {
            if (!nurseryName || !cnic || !phone || !address) {
                Alert.alert("Error", "Please fill all vendor details (Name, CNIC, Phone, Address).");
                return;
            }
            if (nurseryPhotos.length === 0) {
                Alert.alert("Error", "Please upload at least one nursery photo.");
                return;
            }
            if (registrationDocs.length === 0) {
                Alert.alert("Error", "Please upload the nursery registration form photo.");
                return;
            }
        }

        setLoading(true);

        try {
            let role: UserRole = selectedRole;

            // Admin check (override role if admin email)
            if (signupEmail.toLowerCase().includes('admin')) {
                role = 'admin' as UserRole;
            }

            const userCredential = await createUserWithEmailAndPassword(auth, signupEmail, signupPassword);
            const user = userCredential.user;

            // Vendor Image Upload
            let nurseryPhotoUrls: string[] = [];
            let registrationDocUrls: string[] = [];

            if (role === 'vendor') {
                try {
                    setUploading(true);
                    console.log('🚀 Starting Vendor Image Upload...');
                    nurseryPhotoUrls = await uploadImages(nurseryPhotos, 'nursery_photos', user.uid);
                    registrationDocUrls = await uploadImages(registrationDocs, 'registration_docs', user.uid);
                    console.log('✅ Images uploaded successfully.');
                } catch (imgErr: any) {
                    // If upload fails, we should ideally delete the user, but for now just alert
                    console.error("Image Upload Error:", imgErr);
                    throw new Error("Failed to upload images. " + imgErr.message);
                } finally {
                    setUploading(false);
                }
            }

            // Send Verification Email for ALL Users (User & Vendor)
            try {
                await sendEmailVerification(user);
                console.log("Verification email sent to:", user.email);
            } catch (emailErr: any) {
                console.error("Failed to send verification email:", emailErr);
                Alert.alert("Email Warning", "Account created but failed to send verification email. Please use 'Resend Link' later.");
            }

            const initialStatus = role === 'vendor' ? 'pending' : 'active';
            const createdAt = new Date().toISOString();

            // 1. Create User Document
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                name: signupName,
                email: signupEmail,
                role: role,
                status: initialStatus,
                createdAt: createdAt,
                ...(role === 'vendor' && {
                    nurseryName,
                    cnic,
                    phone,
                    address,
                    nurseryPhotos: nurseryPhotoUrls,
                    registrationDocs: registrationDocUrls
                })
            });

            // 2. If Vendor, create 'vendors' and 'vendorRequests' documents
            if (role === 'vendor') {
                const vendorData = {
                    vendorId: user.uid,
                    name: signupName,
                    email: signupEmail,
                    nurseryName,
                    cnic,
                    phone,
                    address,
                    nurseryPhotos: nurseryPhotoUrls,
                    registrationDocs: registrationDocUrls,
                    status: 'pending', // Explicitly pending
                    createdAt: createdAt,
                    rating: 0,
                    totalSales: 0,
                    commissionRate: 10, // Default 10%
                };

                // Add to 'vendors' collection
                await setDoc(doc(db, "vendors", user.uid), vendorData);


                // Add to 'vendorRequests' collection (for Admin Panel)
                await addDoc(collection(db, "vendorRequests"), {
                    ...vendorData,
                    status: 'pending'
                });

                // ✅ Notify Admin
                await notifyAdmins(
                    'New Vendor Registration 🏪',
                    `New vendor ${nurseryName} has registered and is pending approval.`,
                    user.uid,
                    'vendor_registration'
                );
            }

            if (role === 'user') {
                setStep('verify');
            } else if (role === 'vendor') {
                Alert.alert(
                    "Registration Successful",
                    "Your vendor account has been created and is pending admin approval. You will be able to login once approved."
                );
                // Reset form
                setSignupName(''); setSignupEmail(''); setSignupPassword('');
                setNurseryName(''); setCnic(''); setPhone(''); setAddress('');
                setNurseryPhotos([]); setRegistrationDocs([]);
                setActiveTab('login');
            } else {
                Alert.alert("Success", "Admin account created. Please login.");
                setActiveTab('login');
            }

        } catch (error: any) {
            const code = error?.code || '';
            if (code === 'auth/email-already-in-use') {
                Alert.alert('Email Already Exists', 'This email is already registered.');
            } else if (code === 'auth/invalid-email') {
                Alert.alert('Invalid Email', 'Please enter a valid email address.');
            } else if (code === 'auth/weak-password') {
                Alert.alert('Weak Password', 'Password must be at least 6 characters long.');
            } else if (code === 'auth/network-request-failed') {
                Alert.alert('No Internet', 'Please check your internet connection.');
            } else {
                Alert.alert('Signup Error', error.message);
            }
        } finally {
            setLoading(false);
            setUploading(false);
        }
    };

    const handleSignupTabClick = () => {
        setSelectedRole('user');
        setActiveTab('signup');
    };

    // ===== TEST QUICK LOGIN (REMOVE LATER) =====
    const quickTestLogin = async (email: string, password: string, targetScreen: string) => {
        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            navigation.replace(targetScreen);
        } catch (error: any) {
            Alert.alert('Quick Login Failed', error.message);
        } finally {
            setLoading(false);
        }
    };

    const TabButton = ({ tab, label }: { tab: Tab; label: string }) => (
        <TouchableOpacity
            style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
            onPress={() => {
                if (tab === 'signup') {
                    handleSignupTabClick();
                } else {
                    setActiveTab(tab);
                }
            }}
        >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{label}</Text>
        </TouchableOpacity>
    );

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={styles.blobTop} />
            <View style={styles.blobBottom} />

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.logoSection}>
                    <View style={styles.logoBox}>
                        <Feather name="feather" size={36} color={colors.primary} />
                    </View>
                    <Text style={styles.title}>Welcome to GardenMate</Text>
                    <Text style={styles.subtitle}>Your personal plant care assistant</Text>
                </View>

                <View style={styles.authCard}>
                    {step === 'auth' ? (
                        <View>
                            <View style={styles.tabContainer}>
                                <TabButton tab="login" label="Login" />
                                <TabButton tab="signup" label="Sign Up" />
                            </View>

                            {activeTab === 'login' ? (
                                <View style={styles.form}>
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Email</Text>
                                        <View style={styles.inputWrapper}>
                                            <Feather name="mail" size={18} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
                                            <TextInput
                                                style={styles.input}
                                                placeholder="hello@example.com"
                                                placeholderTextColor={colors.textMuted}
                                                value={loginEmail}
                                                onChangeText={setLoginEmail}
                                                keyboardType="email-address"
                                                autoCapitalize="none"
                                            />
                                        </View>
                                    </View>
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Password</Text>
                                        <View style={styles.inputWrapper}>
                                            <Feather name="lock" size={18} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
                                            <TextInput
                                                key={showLoginPassword ? 'visible' : 'hidden'}
                                                style={styles.input}
                                                placeholder="••••••••"
                                                placeholderTextColor={colors.textMuted}
                                                value={loginPassword}
                                                onChangeText={setLoginPassword}
                                                secureTextEntry={!showLoginPassword}
                                            />
                                            <TouchableOpacity onPress={() => setShowLoginPassword(!showLoginPassword)} style={styles.eyeButton}>
                                                <Feather name={showLoginPassword ? "eye" : "eye-off"} size={18} color={colors.textMuted} />
                                            </TouchableOpacity>
                                        </View>
                                        <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotButton}>
                                            <Text style={styles.forgotText}>Forgot Password?</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.submitButton}
                                        onPress={checkUserRolesAndShowModal}
                                        disabled={loading}
                                    >
                                        {loading ? <ActivityIndicator color="#fff" /> : (
                                            <>
                                                <Feather name="log-in" size={18} color="#fff" style={{ marginRight: 8 }} />
                                                <Text style={styles.submitText}>Sign In</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={styles.form}>
                                    {/* Role Selection Switcher */}
                                    <View style={styles.roleSwitcherContainer}>
                                        <TouchableOpacity
                                            style={[styles.roleSwitchBtn, selectedRole === 'user' && styles.roleSwitchBtnActive]}
                                            onPress={() => setSelectedRole('user')}
                                        >
                                            <Text style={[styles.roleSwitchText, selectedRole === 'user' && styles.roleSwitchTextActive]}>Customer</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.roleSwitchBtn, selectedRole === 'vendor' && styles.roleSwitchBtnActive]}
                                            onPress={() => setSelectedRole('vendor')}
                                        >
                                            <Text style={[styles.roleSwitchText, selectedRole === 'vendor' && styles.roleSwitchTextActive]}>Vendor</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Full Name</Text>
                                        <View style={styles.inputWrapper}>
                                            <Feather name="user" size={18} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
                                            <TextInput style={styles.input} placeholder="John Doe" placeholderTextColor={colors.textMuted} value={signupName} onChangeText={setSignupName} />
                                        </View>
                                    </View>
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Email</Text>
                                        <View style={styles.inputWrapper}>
                                            <Feather name="mail" size={18} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
                                            <TextInput style={styles.input} placeholder="hello@gmail.com" placeholderTextColor={colors.textMuted} value={signupEmail} onChangeText={setSignupEmail} keyboardType="email-address" autoCapitalize="none" />
                                        </View>
                                    </View>
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Password</Text>
                                        <View style={styles.inputWrapper}>
                                            <Feather name="lock" size={18} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
                                            <TextInput style={styles.input} placeholder="••••••••" placeholderTextColor={colors.textMuted} value={signupPassword} onChangeText={setSignupPassword} secureTextEntry={!showSignupPassword} autoComplete="off" textContentType="password" />
                                            <TouchableOpacity onPress={() => setShowSignupPassword(!showSignupPassword)} style={styles.eyeButton}>
                                                <Feather name={showSignupPassword ? "eye" : "eye-off"} size={18} color={colors.textMuted} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    {/* VENDOR SPECIFIC FIELDS */}
                                    {selectedRole === 'vendor' && (
                                        <>
                                            <View style={styles.divider} />
                                            <Text style={styles.sectionHeader}>Store Details</Text>

                                            <View style={styles.inputGroup}>
                                                <Text style={styles.label}>Nursery Name</Text>
                                                <View style={styles.inputWrapper}>
                                                    <Feather name="shopping-bag" size={18} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
                                                    <TextInput style={styles.input} placeholder="Green Valley Nursery" placeholderTextColor={colors.textMuted} value={nurseryName} onChangeText={setNurseryName} />
                                                </View>
                                            </View>

                                            <View style={styles.inputGroup}>
                                                <Text style={styles.label}>CNIC (National ID)</Text>
                                                <View style={styles.inputWrapper}>
                                                    <Feather name="credit-card" size={18} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
                                                    <TextInput style={styles.input} placeholder="12345-1234567-1" placeholderTextColor={colors.textMuted} value={cnic} onChangeText={setCnic} keyboardType="numeric" />
                                                </View>
                                            </View>

                                            <View style={styles.inputGroup}>
                                                <Text style={styles.label}>Phone Number</Text>
                                                <View style={styles.inputWrapper}>
                                                    <Feather name="phone" size={18} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
                                                    <TextInput style={styles.input} placeholder="0300 1234567" placeholderTextColor={colors.textMuted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                                                </View>
                                            </View>

                                            <View style={styles.inputGroup}>
                                                <Text style={styles.label}>Address</Text>
                                                <View style={styles.inputWrapper}>
                                                    <Feather name="map-pin" size={18} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
                                                    <TextInput style={styles.input} placeholder="Street 1, City..." placeholderTextColor={colors.textMuted} value={address} onChangeText={setAddress} />
                                                </View>
                                            </View>

                                            <View style={styles.imageSection}>
                                                <Text style={styles.label}>Nursery Photos (Required)</Text>
                                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalImages}>
                                                    <TouchableOpacity style={styles.addImageBtn} onPress={() => pickImage(setNurseryPhotos)}>
                                                        <Feather name="plus" size={24} color={colors.primary} />
                                                    </TouchableOpacity>
                                                    {nurseryPhotos.map((uri, index) => (
                                                        <View key={index} style={styles.thumbnailContainer}>
                                                            <View style={[styles.imageThumbnail, { backgroundColor: '#e0e7ff' }]} />
                                                            <Text style={{ fontSize: 10, color: '#4338ca', fontWeight: 'bold' }}>PHOTO {index + 1}</Text>
                                                            <TouchableOpacity style={styles.removeBtn} onPress={() => removeImage(index, setNurseryPhotos)}>
                                                                <Feather name="x" size={12} color="#fff" />
                                                            </TouchableOpacity>
                                                        </View>
                                                    ))}
                                                </ScrollView>
                                            </View>

                                            <View style={styles.imageSection}>
                                                <Text style={styles.label}>Nursery Registration Form (Required)</Text>
                                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalImages}>
                                                    <TouchableOpacity style={styles.addImageBtn} onPress={() => pickImage(setRegistrationDocs)}>
                                                        <Feather name="file-plus" size={24} color={colors.primary} />
                                                    </TouchableOpacity>
                                                    {registrationDocs.map((uri, index) => (
                                                        <View key={index} style={styles.thumbnailContainer}>
                                                            <View style={[styles.imageThumbnail, { backgroundColor: '#fef3c7' }]} />
                                                            <Text style={{ fontSize: 10, color: '#d97706', fontWeight: 'bold' }}>DOC {index + 1}</Text>
                                                            <TouchableOpacity style={styles.removeBtn} onPress={() => removeImage(index, setRegistrationDocs)}>
                                                                <Feather name="x" size={12} color="#fff" />
                                                            </TouchableOpacity>
                                                        </View>
                                                    ))}
                                                </ScrollView>
                                            </View>
                                        </>
                                    )}

                                    <TouchableOpacity style={styles.submitButton} onPress={handleSignup} disabled={loading || uploading}>
                                        {loading || uploading ? <ActivityIndicator color="#fff" /> : (
                                            <>
                                                <Feather name={selectedRole === 'vendor' ? "shopping-bag" : "user-plus"} size={18} color="#fff" style={{ marginRight: 8 }} />
                                                <Text style={styles.submitText}>
                                                    {selectedRole === 'vendor' ? "Register Store" : "Create Account"}
                                                </Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    ) : (
                        <View>
                            <TouchableOpacity style={styles.backRow} onPress={() => setStep('auth')}>
                                <Feather name="arrow-left" size={20} color={colors.text} style={{ marginRight: spacing.sm }} />
                                <Text style={styles.verifyTitle}>Verify Email</Text>
                            </TouchableOpacity>

                            <View style={styles.verifyCenter}>
                                <View style={styles.emailIconBox}><Feather name="mail" size={28} color={colors.primary} /></View>
                                <Text style={styles.verifyDesc}>
                                    We've sent a verification link to your email ({signupEmail}). Please click the link and come back to login.
                                </Text>
                            </View>

                            <TouchableOpacity style={styles.submitButton} onPress={() => setStep('auth')}>
                                <Text style={styles.submitText}>Go to Login</Text>
                            </TouchableOpacity>

                            {/* Resend Link Button */}
                            <TouchableOpacity
                                style={[styles.submitButton, { backgroundColor: 'transparent', marginTop: 10, borderWidth: 1, borderColor: colors.primary }]}
                                onPress={async () => {
                                    if (auth.currentUser) {
                                        try {
                                            await sendEmailVerification(auth.currentUser);
                                            Alert.alert("Sent", "Verification link resent!");
                                        } catch (e: any) {
                                            Alert.alert("Error", e.message);
                                        }
                                    } else {
                                        Alert.alert("Error", "No user found. Please try signing up again.");
                                        setStep('auth');
                                    }
                                }}
                            >
                                <Text style={[styles.submitText, { color: colors.primary }]}>Resend Link</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* ===== TEST BUTTONS (REMOVE LATER) ===== */}
                <View style={styles.testSection}>
                    <Text style={styles.testLabel}>⚡ Quick Test Login</Text>
                    <View style={styles.testButtonRow}>
                        <TouchableOpacity
                            style={[styles.testBtn, { backgroundColor: '#3b82f6' }]}
                            onPress={() => quickTestLogin('user@gmail.com', 'test123456', 'MainTabs')}
                            disabled={loading}
                        >
                            <Feather name="user" size={16} color="#fff" />
                            <Text style={styles.testBtnText}>User</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.testBtn, { backgroundColor: '#ef4444' }]}
                            onPress={() => quickTestLogin('admin@gmail.com', 'test123456', 'AdminTabs')}
                            disabled={loading}
                        >
                            <Feather name="shield" size={16} color="#fff" />
                            <Text style={styles.testBtnText}>Admin</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.testBtn, { backgroundColor: '#f97316' }]}
                            onPress={() => quickTestLogin('vendor@fmail.com', 'test123456', 'VendorTabs')}
                            disabled={loading}
                        >
                            <Feather name="shopping-bag" size={16} color="#fff" />
                            <Text style={styles.testBtnText}>Vendor</Text>
                        </TouchableOpacity>
                    </View>
                </View>
                {/* ===== END TEST BUTTONS ===== */}

            </ScrollView>



            {/* LOGIN ROLE SELECTION MODAL */}
            <Modal
                visible={showLoginRoleModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowLoginRoleModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalIconBox}>
                            <Feather name="users" size={32} color={colors.primary} />
                        </View>

                        <Text style={styles.modalTitle}>Choose Login Type</Text>
                        <Text style={styles.modalSubtitle}>
                            You have both Customer and Vendor accounts. How would you like to login?
                        </Text>

                        <TouchableOpacity
                            style={styles.roleOption}
                            onPress={() => selectLoginRoleAndProceed('user')}
                        >
                            <View style={styles.roleIconBox}>
                                <Feather name="user" size={28} color={colors.primary} />
                            </View>
                            <View style={styles.roleInfo}>
                                <Text style={styles.roleTitle}>Login as Customer</Text>
                                <Text style={styles.roleDesc}>Browse and shop for plants</Text>
                            </View>
                            <Feather name="chevron-right" size={20} color={colors.textMuted} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.roleOption}
                            onPress={() => selectLoginRoleAndProceed('vendor')}
                        >
                            <View style={[styles.roleIconBox, { backgroundColor: 'rgba(249,115,22,0.1)' }]}>
                                <Feather name="shopping-bag" size={28} color="#f97316" />
                            </View>
                            <View style={styles.roleInfo}>
                                <Text style={styles.roleTitle}>Login as Vendor</Text>
                                <Text style={styles.roleDesc}>Manage your store and products</Text>
                            </View>
                            <Feather name="chevron-right" size={20} color={colors.textMuted} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.modalCancelBtn}
                            onPress={() => setShowLoginRoleModal(false)}
                        >
                            <Text style={styles.modalCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f9fafb' },
    blobTop: { position: 'absolute', top: -100, right: -100, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(16, 185, 129, 0.1)' },
    blobBottom: { position: 'absolute', bottom: -100, left: -100, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(16, 185, 129, 0.1)' },
    scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
    logoSection: { alignItems: 'center', marginBottom: 40 },
    logoBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 },
    title: { fontSize: 28, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
    subtitle: { fontSize: 16, color: '#6b7280' },
    authCard: { backgroundColor: '#fff', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 },
    tabContainer: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: 12, padding: 4, marginBottom: 24 },
    tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
    tabButtonActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    tabText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
    tabTextActive: { color: '#10b981' },
    form: { gap: 16 },
    inputGroup: { gap: 8 },
    label: { fontSize: 14, fontWeight: '600', color: '#374151' },
    labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    forgotText: { fontSize: 13, color: '#10b981', fontWeight: '600' },
    forgotButton: { alignSelf: 'flex-end', marginTop: 4 },
    eyeButton: { padding: 4 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 16, height: 50 },
    input: { flex: 1, fontSize: 16, color: '#111827' },
    submitButton: { flexDirection: 'row', backgroundColor: '#10b981', height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
    submitText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
    verifyTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
    verifyCenter: { alignItems: 'center', paddingVertical: 32 },
    emailIconBox: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#ecfdf5', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    verifyDesc: { textAlign: 'center', color: '#6b7280', fontSize: 16, lineHeight: 24, paddingHorizontal: 20 },
    roleBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.1)', padding: 12, borderRadius: 12, gap: 8, marginBottom: 8 },
    roleBadgeText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.primary },
    changeRoleText: { fontSize: 12, fontWeight: 'bold', color: '#f97316' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { width: '100%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 24, padding: 24 },
    modalIconBox: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(16,185,129,0.1)', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#111827', textAlign: 'center', marginBottom: 8 },
    modalSubtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
    roleOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' },
    roleIconBox: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(16,185,129,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    roleInfo: { flex: 1 },
    roleTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
    roleDesc: { fontSize: 13, color: '#6b7280' },
    modalCancelBtn: { marginTop: 8, paddingVertical: 14, alignItems: 'center' },
    modalCancelText: { fontSize: 15, fontWeight: '600', color: '#6b7280' },

    // TEST STYLES (REMOVE LATER)
    testSection: { marginTop: 24, alignItems: 'center' },
    testLabel: { fontSize: 13, color: '#9ca3af', marginBottom: 10, fontWeight: '600' },
    testButtonRow: { flexDirection: 'row', gap: 10 },
    testBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, gap: 6 },
    testBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },

    // Role Switcher
    roleSwitcherContainer: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: 12, padding: 4, marginBottom: 16 },
    roleSwitchBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
    roleSwitchBtnActive: { backgroundColor: colors.primary },
    roleSwitchText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
    roleSwitchTextActive: { color: '#fff' },

    // Vendor Form
    divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 16 },
    sectionHeader: { fontSize: 16, fontWeight: 'bold', color: '#111827', marginBottom: 16 },
    imageSection: { marginTop: 8 },
    horizontalImages: { flexDirection: 'row', marginTop: 8 },
    addImageBtn: { width: 60, height: 60, borderRadius: 12, borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    thumbnailContainer: { width: 60, height: 60, borderRadius: 12, backgroundColor: '#f3f4f6', marginRight: 10, justifyContent: 'center', alignItems: 'center', position: 'relative' },
    imageThumbnail: { width: '100%', height: '100%', borderRadius: 12, position: 'absolute' },
    removeBtn: { position: 'absolute', top: -5, right: -5, backgroundColor: '#ef4444', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
});
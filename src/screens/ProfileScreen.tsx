import React, { useState, useEffect } from 'react';
import { onSnapshot } from "firebase/firestore";
import {
    View, Text, ScrollView, TouchableOpacity, Image, StyleSheet,
    Switch, Modal, TextInput, Alert, ActivityIndicator, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTasks, type TaskType, type TaskFrequency } from '../hooks/useTasks';
import { usePlants } from '../hooks/usePlants';
import { colors, spacing, borderRadius, fontSize } from '../theme';
import { auth, db, storage } from '../services/firebaseConfig';
import { signOut } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { scheduleReminderNotification } from '../services/NotificationService';
import {
    doc,
    getDoc,
    updateDoc,
    serverTimestamp,
    collection,
    addDoc,
    query,
    where,
    getDocs,
    deleteDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

import { triggerTestNotification } from '../services/NotificationService';

import { MediaType } from 'expo-image-picker';



interface UserProfile {
    name: string;
    email: string;
    location: string;
    phone?: string;
    photoURL?: string;
    lastLoginAt?: any;
    createdAt?: any;
}


export default function ProfileScreen({ navigation }: any) {
    const [requestStatus, setRequestStatus] = useState('none'); // Pehle ye 'pending' ho sakta hai, isay 'none' karein
    const { plants, getPlantById } = usePlants();
    const [userPlants, setUserPlants] = useState<any[]>([]);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [applicationId, setApplicationId] = useState('');
    // User State
    const [profile, setProfile] = useState<UserProfile>({
        name: 'User',
        email: '',
        location: 'Lahore, Pakistan'
    });
    const [loading, setLoading] = useState(true);
    const [lastLogin, setLastLogin] = useState<string>('');

    // Vendor State
    const [vendorStatus, setVendorStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
    const [vendorRequestId, setVendorRequestId] = useState<string>('');

    const [showVendorModal, setShowVendorModal] = useState(false);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);



    // Vendor Form State
    const [vendorForm, setVendorForm] = useState({
        storeName: '',
        businessEmail: '',
        phoneNumber: '',
        cnicNumber: '',
        nurseryAddress: '',
    });
    const [nurseryPhotos, setNurseryPhotos] = useState<string[]>([]);
    const [registrationDocs, setRegistrationDocs] = useState<string[]>([]);
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const loadNotificationSetting = async () => {
            const saved = await AsyncStorage.getItem('notificationsEnabled');
            if (saved !== null) {
                setNotificationsEnabled(saved === 'true');
            }
        };
        loadNotificationSetting();
    }, []);

    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        // User ki apni request ka status check karne ke liye listener
        const q = query(collection(db, "vendorRequests"), where("userId", "==", user.uid));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const data = snapshot.docs[0].data();
                setRequestStatus(data.status); // Ye "approved" ho jayega jab admin approve karega
            }
        });

        return () => unsubscribe();
    }, []);


    useEffect(() => {
        const fetchUserPlants = async () => {
            const user = auth.currentUser;
            if (!user) return;

            try {
                // Suppose user's plant IDs are stored in `users/{uid}/myPlants` as array of IDs
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (!userDoc.exists()) return;

                const data = userDoc.data();
                const plantIds: string[] = data.myPlants || []; // array of plant IDs
                if (plantIds.length === 0) {
                    setUserPlants([]);
                    return;
                }

                // Fetch plant details from 'plants' collection
                const plantsRef = collection(db, 'plants');
                const q = query(plantsRef, where('id', 'in', plantIds)); // Firestore supports 'in' with up to 10 IDs
                const snapshot = await getDocs(q);

                const fetchedPlants = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                setUserPlants(fetchedPlants);
            } catch (err) {
                console.error('Failed to fetch user plants:', err);
            }
        };

        fetchUserPlants();
    }, []);

    // ✅ Fetch User Profile & Vendor Status from Firebase
    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const user = auth.currentUser;
                if (!user) {
                    setLoading(false);
                    return;
                }

                // 1. Fetch user profile
                const userDocRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userDocRef);

                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    setProfile({
                        name: userData.name || user.displayName || 'User',
                        email: user.email || '',
                        location: userData.location || 'Lahore, Pakistan',
                        phone: userData.phone,
                        photoURL: userData.photoURL || user.photoURL,
                        lastLoginAt: userData.lastLoginAt,
                        createdAt: userData.createdAt,
                    });

                    if (userData.lastLoginAt) {
                        const lastLoginDate = userData.lastLoginAt?.toDate ? userData.lastLoginAt.toDate() : new Date(userData.lastLoginAt);
                        setLastLogin(formatLastLogin(lastLoginDate));
                    }

                    await updateDoc(userDocRef, {
                        lastLoginAt: serverTimestamp()
                    });

                    // ✅ NEW FIX: Agar role 'vendor' hai, to direct approved status set karein
                    if (userData.role === 'vendor') {
                        setVendorStatus('approved');
                        setLoading(false);
                        return; // Aage check karne ki zaroorat nahi
                    }
                } else {
                    setProfile({
                        name: user.displayName || 'User',
                        email: user.email || '',
                        location: 'Lahore, Pakistan',
                        photoURL: user.photoURL,
                    });
                }

                // 2. Check vendor status (Agar role vendor nahi hai tab check karein)
                await checkVendorStatus(user.uid);

                console.log('✅ User data loaded');
            } catch (error) {
                console.error('❌ Profile Fetch Error:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, []);


    // ✅ Check Vendor Status
    const checkVendorStatus = async (userId: string) => {
        try {
            // Check if user has approved vendor profile
            const vendorProfileRef = doc(db, 'vendors', userId);
            const vendorProfileDoc = await getDoc(vendorProfileRef);

            if (vendorProfileDoc.exists() && vendorProfileDoc.data().isActive) {
                setVendorStatus('approved');
                return;
            }

            // Check for pending/rejected requests
            const vendorRequestsRef = collection(db, 'vendorRequests');
            const q = query(vendorRequestsRef, where('userId', '==', userId));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const latestRequest = querySnapshot.docs[0];
                const requestData = latestRequest.data();
                setVendorStatus(requestData.status);
                setVendorRequestId(latestRequest.id);

                console.log('📋 Vendor Status:', requestData.status);
            } else {
                setVendorStatus('none');
            }
        } catch (error) {
            console.error('❌ Error checking vendor status:', error);
        }
    };
    useEffect(() => {
        const ExpoNotifications = require('expo-notifications');
        const sub = ExpoNotifications.addNotificationReceivedListener((notification: any) => {
            if (!notificationsEnabled) return;

            Alert.alert(
                notification.request.content.title || 'Notification',
                notification.request.content.body || ''
            );
        });

        return () => sub.remove();
    }, [notificationsEnabled]);

    // Format last login time
    const formatLastLogin = (date: Date) => {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const uploadImage = async (uri: string, path: string): Promise<string> => {
        try {
            // Blob conversion
            const response = await fetch(uri);
            const blob = await response.blob();

            // Storage reference
            // Ensure 'storage' is correctly imported from your firebaseConfig
            const storageRef = ref(storage, path);

            // Upload
            const snapshot = await uploadBytes(storageRef, blob);

            // Get URL
            const downloadURL = await getDownloadURL(snapshot.ref);
            return downloadURL;
        } catch (error) {
            console.error("Upload error details:", error);
            throw error;
        }
    };

    // ✅ Pick Images
    const pickNurseryPhotos = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Please allow access to photos');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            quality: 0.8,
        });

        if (!result.canceled) {
            setNurseryPhotos(result.assets.map(asset => asset.uri));
        }
    };

    const pickRegistrationDocs = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Please allow access to photos');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            quality: 0.8,
        });

        if (!result.canceled) {
            setRegistrationDocs(result.assets.map(asset => asset.uri));
        }
    };

    // ✅ Submit Vendor Request
    const handleVendorSubmit = async () => {
        // Validation
        if (!vendorForm.storeName || !vendorForm.businessEmail || !vendorForm.phoneNumber) {
            Alert.alert('Missing Information', 'Please fill all required fields');
            return;
        }

        if (!vendorForm.cnicNumber || vendorForm.cnicNumber.length < 13) {
            Alert.alert('Invalid CNIC', 'Please enter a valid CNIC number');
            return;
        }

        if (!vendorForm.nurseryAddress) {
            Alert.alert('Missing Address', 'Please provide your nursery address');
            return;
        }

        if (nurseryPhotos.length === 0) {
            Alert.alert('Missing Photos', 'Please upload at least one nursery photo');
            return;
        }

        if (!agreedToTerms) {
            Alert.alert('Terms Required', 'Please agree to terms and conditions');
            return;
        }

        try {
            setSubmitting(true);
            const user = auth.currentUser;
            if (!user) return;

            console.log('📝 Saving data to Firestore...');

            // ✅ Storage upload ko bypass karein, direct local URIs use karein
            const vendorRequestData = {
                userId: user.uid,
                userName: profile.name,
                userEmail: user.email,
                status: 'pending',
                storeName: vendorForm.storeName,
                businessEmail: vendorForm.businessEmail,
                phoneNumber: vendorForm.phoneNumber,
                cnicNumber: vendorForm.cnicNumber,
                nurseryAddress: vendorForm.nurseryAddress,
                // Direct local URIs save kar rahe hain:
                nurseryPhotos: nurseryPhotos,
                registrationDocs: registrationDocs,
                agreedToTerms: true,
                requestedAt: serverTimestamp(),
            };

            // Seedha Firestore mein data bhejein
            const docRef = await addDoc(collection(db, 'vendorRequests'), vendorRequestData);

            console.log('✅ Request submitted successfully!');

            setVendorRequestId(docRef.id);
            setApplicationId(docRef.id.slice(0, 8).toUpperCase());
            setVendorStatus('pending');
            setShowVendorModal(false);

            // ✅ Show success modal instead of alert
            setTimeout(() => {
                setShowSuccessModal(true);
            }, 300);

            setVendorForm({
                storeName: '',
                businessEmail: '',
                phoneNumber: '',
                cnicNumber: '',
                nurseryAddress: '',
            });
            setNurseryPhotos([]);
            setRegistrationDocs([]);
            setAgreedToTerms(false);

        } catch (error) {
            console.error('❌ Error submitting vendor request:', error);
            Alert.alert('Error', 'Failed to submit request. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    // ✅ Handle Logout with Firebase
    const handleLogout = async () => {
        Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Logout',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await signOut(auth);
                        navigation.replace('Auth');
                    } catch (error) {
                        console.error('Logout Error:', error);
                        Alert.alert('Error', 'Failed to logout');
                    }
                }
            },
        ]);
    };


    const MenuItem = ({ icon, title, subtitle, onPress, showArrow = true }: any) => (
        <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.menuIcon}>
                <Feather name={icon} size={20} color={colors.primary} />
            </View>
            <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{title}</Text>
                {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
            </View>
            {showArrow && <Feather name="chevron-right" size={20} color={colors.textMuted} />}
        </TouchableOpacity>
    );

    const getInitials = () => {
        return profile.name.split(' ').map(n => n[0]).join('').toUpperCase();
    };

    // ✅ Render Vendor Status Badge
    const renderVendorStatusSection = () => {
        if (vendorStatus === 'none') {
            return (
                <LinearGradient colors={['rgba(16,185,129,0.8)', '#059669']} style={styles.vendorCard}>
                    <View style={styles.vendorBlob} />
                    <View style={styles.vendorIconBox}>
                        <Feather name="shopping-bag" size={24} color="#fff" />
                    </View>
                    <Text style={styles.vendorTitle}>Become a Seller</Text>
                    <Text style={styles.vendorDesc}>
                        Start your own plant shop today. Reach thousands of plant lovers and grow your business with GardenMate.
                    </Text>
                    <TouchableOpacity style={styles.vendorButton} onPress={() => setShowVendorModal(true)}>
                        <Text style={styles.vendorButtonText}>Apply for Vendor Account</Text>
                    </TouchableOpacity>
                </LinearGradient>
            );
        }

        if (vendorStatus === 'pending') {
            return (
                <View style={styles.card}>
                    <View style={styles.pendingVendorHeader}>
                        <View style={styles.pendingIcon}>
                            <Feather name="clock" size={20} color="#f97316" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.pendingTitle}>Vendor Application Pending</Text>
                            <Text style={styles.pendingSubtitle}>Your application is under review</Text>
                        </View>
                        <View style={styles.pendingBadge}>
                            <Text style={styles.pendingBadgeText}>Pending</Text>
                        </View>
                    </View>
                    <Text style={styles.pendingMessage}>
                        We're reviewing your application. You'll receive a notification within 24-48 hours once approved.
                    </Text>
                </View>
            );
        }

        if (vendorStatus === 'approved') {
            return (
                <View style={styles.card}>
                    <View style={styles.vendorActiveHeader}>
                        <View style={styles.vendorActiveIcon}>
                            <Feather name="shopping-bag" size={20} color={colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.vendorActiveTitle}>Vendor Account Active</Text>
                            <Text style={styles.vendorActiveSubtitle}>Manage your store</Text>
                        </View>
                        <View style={styles.activeBadge}>
                            <Text style={styles.activeBadgeText}>Active</Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={styles.switchButton}
                        onPress={() => navigation.navigate('VendorTabs')}
                    >
                        <Text style={styles.switchButtonText}>Switch to Vendor Dashboard</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (vendorStatus === 'rejected') {
            return (
                <View style={styles.card}>
                    <View style={styles.rejectedVendorHeader}>
                        <View style={styles.rejectedIcon}>
                            <Feather name="x-circle" size={20} color="#ef4444" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.rejectedTitle}>Application Not Approved</Text>
                            <Text style={styles.rejectedSubtitle}>Your vendor request was declined</Text>
                        </View>
                    </View>
                    <Text style={styles.rejectedMessage}>
                        Unfortunately, we couldn't approve your vendor application at this time. Please contact support for more information.
                    </Text>
                    <TouchableOpacity
                        style={styles.reapplyButton}
                        onPress={() => setShowVendorModal(true)}
                    >
                        <Text style={styles.reapplyButtonText}>Reapply</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return null;
    };

    // Loading State
    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
                <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={{ marginTop: 10, color: colors.textMuted }}>Loading profile...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header - Keep existing code */}
                <View style={styles.headerBg}>
                    <LinearGradient colors={['rgba(16,185,129,0.1)', 'transparent']} style={styles.headerGradient} />
                    <View style={styles.headerContent}>
                        <View style={styles.headerRow}>
                            <Text style={styles.headerTitle}>My Profile</Text>
                            <TouchableOpacity style={styles.settingsButton} onPress={() => navigation.navigate('Settings')}>
                                <Feather name="settings" size={20} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.avatarSection}>
                            <View style={styles.avatarGlow}>
                                {profile.photoURL ? (
                                    <Image
                                        source={{ uri: profile.photoURL }}
                                        style={styles.avatarImage}
                                    />
                                ) : (
                                    <View style={styles.avatar}>
                                        <Text style={styles.avatarText}>{getInitials()}</Text>
                                    </View>
                                )}
                                <TouchableOpacity
                                    style={styles.cameraButton}
                                    onPress={() => navigation.navigate('AccountDetails')}
                                >
                                    <Feather name="camera" size={14} color="#fff" />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.userName}>{profile.name}</Text>
                            <Text style={styles.userEmail}>{profile.email}</Text>
                            <View style={styles.locationRow}>
                                <Feather name="map-pin" size={12} color={colors.textMuted} />
                                <Text style={styles.locationText}>{profile.location}</Text>
                            </View>
                            {lastLogin && (
                                <View style={styles.lastLoginRow}>
                                    <Feather name="clock" size={12} color={colors.textMuted} />
                                    <Text style={styles.lastLoginText}>Last login: {lastLogin}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                <View style={styles.contentSection}>


                    {/* My Garden - Keep existing */}
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>My Garden</Text>
                        <MenuItem
                            icon="feather"
                            title="View My Plants"
                            subtitle="Manage your collection"
                            onPress={() => navigation.navigate('MyPlants')}
                        />
                    </View>

                    {/* Orders - Keep existing */}
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Orders & Shipping</Text>
                        <MenuItem
                            icon="shopping-bag"
                            title="Order History"
                            subtitle="View past orders & leave reviews"
                            onPress={() => navigation.navigate('OrderHistory')}
                        />
                        <MenuItem
                            icon="map-pin"
                            title="Shipping Addresses"
                            subtitle="Manage delivery addresses"
                            onPress={() => navigation.navigate('ShippingAddresses')}
                        />
                    </View>

                    {/* Account - Keep existing */}
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Account</Text>
                        <MenuItem
                            icon="user"
                            title="Account Details"
                            subtitle="Update your information"
                            onPress={() => navigation.navigate('AccountDetails')}
                        />
                        <View style={styles.menuItem}>
                            <View style={styles.menuIcon}>
                                <Feather name="bell" size={20} color={colors.primary} />
                            </View>
                            <View style={styles.menuContent}>
                                <Text style={styles.menuTitle}>Notifications</Text>
                            </View>
                            <Switch
                                value={notificationsEnabled}
                                onValueChange={async (value) => {
                                    setNotificationsEnabled(value);
                                    await AsyncStorage.setItem('notificationsEnabled', value.toString());
                                }}
                                trackColor={{ true: colors.primary }}
                            />

                        </View>
                    </View>

                    {/* ✅ Vendor Status Section - UPDATED */}
                    {renderVendorStatusSection()}

                    {/* Support & Logout - Keep existing */}
                    <View style={styles.bottomSection}>
                        <TouchableOpacity
                            style={styles.supportButton}
                            onPress={() => navigation.navigate('HelpSupport')}
                        >
                            <Feather name="help-circle" size={18} color={colors.textMuted} />
                            <Text style={styles.supportText}>Help & Support</Text>
                            <Feather name="chevron-right" size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                            <Feather name="log-out" size={18} color="#ef4444" />
                            <Text style={styles.logoutText}>Log Out</Text>
                        </TouchableOpacity>
                        <Text style={styles.version}>Version 2.4.0 • Build 892</Text>
                    </View>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>




            {/* ✅ FULLY UPDATED Vendor Registration Modal */}
            <Modal visible={showVendorModal} animationType="slide" presentationStyle="pageSheet">
                <SafeAreaView style={styles.modalContainer}>
                    {/* Modal Header */}
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setShowVendorModal(false)}>
                            <Text style={styles.cancelText}>{requestStatus === 'none' ? 'Cancel' : 'Close'}</Text>
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>
                            {requestStatus === 'approved' ? 'Vendor Profile' : 'Become a Seller'}
                        </Text>
                        <View style={{ width: 60 }} />
                    </View>

                    {/* 1. AGAR REQUEST PENDING YA APPROVED HAI */}
                    {requestStatus !== 'none' ? (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 }}>
                            <View style={{
                                backgroundColor: requestStatus === 'approved' ? '#f0fdf4' : '#fffbeb',
                                padding: 40,
                                borderRadius: 25,
                                alignItems: 'center',
                                width: '100%',
                                borderWidth: 1,
                                borderColor: requestStatus === 'approved' ? '#dcfce7' : '#fef3c7'
                            }}>
                                <Feather
                                    name={requestStatus === 'approved' ? "check-circle" : "clock"}
                                    size={80}
                                    color={requestStatus === 'approved' ? "#10b981" : "#f59e0b"}
                                />

                                <Text style={{ fontSize: 24, fontWeight: 'bold', marginTop: 20, textAlign: 'center' }}>
                                    {requestStatus === 'approved' ? "Verified Vendor" : "Application Under Review"}
                                </Text>

                                <Text style={{ textAlign: 'center', color: '#6b7280', marginTop: 15, fontSize: 16, lineHeight: 24 }}>
                                    {requestStatus === 'approved'
                                        ? "Congratulations! Your nursery is now verified. You can now manage your inventory and start selling."
                                        : "Your application has been submitted successfully! Admin is currently reviewing your documents. Please check back soon."}
                                </Text>

                                {requestStatus === 'approved' && (
                                    <TouchableOpacity
                                        style={[styles.createButton, { marginTop: 30, width: '100%' }]}
                                        onPress={() => {
                                            setShowVendorModal(false);
                                            // navigation.navigate('VendorDashboard'); // Agar dashboard page hai to
                                        }}
                                    >
                                        <Text style={styles.createButtonText}>Open Vendor Dashboard</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    ) : (
                        /* 2. AGAR STATUS 'NONE' HAI (Yani user ne apply nahi kiya abhi tak) */
                        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                            <View style={styles.vendorWelcome}>
                                <View style={styles.vendorWelcomeIcon}>
                                    <Feather name="shopping-bag" size={24} color={colors.primary} />
                                </View>
                                <Text style={styles.vendorWelcomeTitle}>Join GardenMate Marketplace</Text>
                                <Text style={styles.vendorWelcomeText}>
                                    Reach thousands of plant lovers and grow your business with us.
                                </Text>
                            </View>

                            <Text style={styles.vendorSectionTitle}>Store Information</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Store/Nursery Name *"
                                placeholderTextColor={colors.textMuted}
                                value={vendorForm.storeName}
                                onChangeText={(text) => setVendorForm({ ...vendorForm, storeName: text })}
                            />
                            <TextInput
                                style={[styles.input, { marginTop: spacing.md }]}
                                placeholder="Business Email *"
                                placeholderTextColor={colors.textMuted}
                                keyboardType="email-address"
                                value={vendorForm.businessEmail}
                                onChangeText={(text) => setVendorForm({ ...vendorForm, businessEmail: text })}
                            />
                            <TextInput
                                style={[styles.input, { marginTop: spacing.md }]}
                                placeholder="Phone Number *"
                                placeholderTextColor={colors.textMuted}
                                keyboardType="phone-pad"
                                value={vendorForm.phoneNumber}
                                onChangeText={(text) => setVendorForm({ ...vendorForm, phoneNumber: text })}
                            />

                            <Text style={[styles.vendorSectionTitle, { marginTop: spacing.xl }]}>Owner Verification</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="CNIC Number (e.g., 12345-6789012-3) *"
                                placeholderTextColor={colors.textMuted}
                                value={vendorForm.cnicNumber}
                                onChangeText={(text) => setVendorForm({ ...vendorForm, cnicNumber: text })}
                            />
                            <Text style={styles.vendorHint}>Your CNIC is required for identity verification and is kept confidential.</Text>

                            <Text style={[styles.vendorSectionTitle, { marginTop: spacing.xl }]}>Nursery Address</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                placeholder="Full Nursery Address *"
                                placeholderTextColor={colors.textMuted}
                                multiline
                                numberOfLines={3}
                                value={vendorForm.nurseryAddress}
                                onChangeText={(text) => setVendorForm({ ...vendorForm, nurseryAddress: text })}
                            />

                            <Text style={[styles.vendorSectionTitle, { marginTop: spacing.xl }]}>Required Documents</Text>

                            <TouchableOpacity style={styles.uploadCard} onPress={pickNurseryPhotos}>
                                <View style={styles.uploadIcon}><Feather name="image" size={24} color={colors.primary} /></View>
                                <View style={styles.uploadContent}>
                                    <Text style={styles.uploadTitle}>Nursery Photos</Text>
                                    <Text style={styles.uploadSubtitle}>
                                        {nurseryPhotos.length > 0 ? `${nurseryPhotos.length} photo(s) selected` : 'Upload photos of your nursery/store'}
                                    </Text>
                                </View>
                                <Feather name="plus" size={20} color={colors.primary} />
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.uploadCard, { marginTop: spacing.md }]} onPress={pickRegistrationDocs}>
                                <View style={styles.uploadIcon}><Feather name="file-text" size={24} color={colors.primary} /></View>
                                <View style={styles.uploadContent}>
                                    <Text style={styles.uploadTitle}>Registration Documents</Text>
                                    <Text style={styles.uploadSubtitle}>
                                        {registrationDocs.length > 0 ? `${registrationDocs.length} document(s) selected` : 'Business registration or license'}
                                    </Text>
                                </View>
                                <Feather name="plus" size={20} color={colors.primary} />
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.termsRow} onPress={() => setAgreedToTerms(!agreedToTerms)}>
                                <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
                                    {agreedToTerms && <Feather name="check" size={14} color="#fff" />}
                                </View>
                                <Text style={styles.termsText}>I agree to the <Text style={styles.termsLink}>Terms of Service</Text></Text>
                            </TouchableOpacity>

                            <View style={styles.commissionNotice}>
                                <Feather name="info" size={16} color="#f97316" />
                                <Text style={styles.commissionNoticeText}>A 2% monthly commission applies to all sales.</Text>
                            </View>

                            <TouchableOpacity
                                style={[styles.createButton, (submitting || !agreedToTerms) && { opacity: 0.5 }]}
                                onPress={handleVendorSubmit}
                                disabled={submitting || !agreedToTerms}
                            >
                                {submitting ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <Feather name="check-circle" size={18} color="#fff" style={{ marginRight: 8 }} />
                                        <Text style={styles.createButtonText}>Submit Application</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                            <View style={{ height: 40 }} />
                        </ScrollView>
                    )}
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    // ... keep all existing styles ...
    // ✅ NEW Vendor Status Styles
    pendingVendorHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: '#fff7ed',
        borderRadius: borderRadius.md,
        marginBottom: spacing.md,
    },
    pendingIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(249,115,22,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    pendingTitle: {
        fontSize: fontSize.md,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 4,
    },
    pendingSubtitle: {
        fontSize: fontSize.sm,
        color: colors.textMuted,
    },
    pendingBadge: {
        backgroundColor: '#f97316',
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: borderRadius.sm,
    },
    pendingBadgeText: {
        fontSize: fontSize.xs,
        color: '#fff',
        fontWeight: '600',
    },
    pendingMessage: {
        fontSize: fontSize.sm,
        color: colors.textMuted,
        lineHeight: 20,
        paddingHorizontal: spacing.md,
    },
    rejectedVendorHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: '#fef2f2',
        borderRadius: borderRadius.md,
        marginBottom: spacing.md,
    },
    rejectedIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(239,68,68,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    rejectedTitle: {
        fontSize: fontSize.md,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 4,
    },
    rejectedSubtitle: {
        fontSize: fontSize.sm,
        color: colors.textMuted,
    },
    rejectedMessage: {
        fontSize: fontSize.sm,
        color: colors.textMuted,
        lineHeight: 20,
        paddingHorizontal: spacing.md,
        marginBottom: spacing.md,
    },
    reapplyButton: {
        backgroundColor: colors.primary,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        marginHorizontal: spacing.md,
    },
    reapplyButtonText: {
        color: '#fff',
        fontSize: fontSize.md,
        fontWeight: '600',
    },
    // Add these new styles
    avatarImage: {
        width: 112,
        height: 112,
        borderRadius: 56,
        borderWidth: 4,
        borderColor: '#fff',
    },
    userEmail: {
        fontSize: fontSize.sm,
        color: colors.textMuted,
        marginBottom: 4,
    },
    lastLoginRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        paddingHorizontal: 12,
        paddingVertical: 4,
        backgroundColor: 'rgba(16,185,129,0.1)',
        borderRadius: 12,
    },
    lastLoginText: {
        fontSize: fontSize.xs,
        color: colors.textMuted,
        marginLeft: 4,
    },
    container: { flex: 1, backgroundColor: colors.background },
    headerBg: { backgroundColor: '#fff', borderBottomLeftRadius: 32, borderBottomRightRadius: 32, paddingBottom: spacing.xl, marginBottom: -spacing.lg, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
    headerGradient: { position: 'absolute', left: 0, right: 0, top: 0, height: 128 },
    headerContent: { padding: spacing.lg, paddingTop: spacing.xl },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
    headerTitle: { fontSize: fontSize['2xl'], fontWeight: 'bold', color: colors.text },
    settingsButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(243,244,246,0.8)', justifyContent: 'center', alignItems: 'center' },
    avatarSection: { alignItems: 'center' },
    avatarGlow: { position: 'relative', marginBottom: spacing.md },
    avatar: { width: 112, height: 112, borderRadius: 56, backgroundColor: colors.primary, borderWidth: 4, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontSize: 36, fontWeight: 'bold', color: '#fff' },
    cameraButton: { position: 'absolute', bottom: 4, right: 4, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
    userName: { fontSize: fontSize['2xl'], fontWeight: 'bold', color: colors.text, marginBottom: 4 },
    locationRow: { flexDirection: 'row', alignItems: 'center' },
    locationText: { fontSize: fontSize.sm, color: colors.textMuted, marginLeft: 4 },
    contentSection: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
    section: { marginBottom: spacing.lg },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    sectionTitle: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text },
    addTaskButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md },
    addTaskText: { color: '#fff', fontWeight: '500', fontSize: fontSize.sm, marginLeft: 4 },
    tasksContainer: { backgroundColor: '#fff', borderRadius: borderRadius.xl, padding: spacing.md, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    taskItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.sm, marginBottom: spacing.sm },
    checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: colors.border, marginRight: spacing.md, justifyContent: 'center', alignItems: 'center' },
    checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
    taskContent: { flex: 1 },
    taskTitle: { fontSize: fontSize.sm, fontWeight: '500', color: colors.text },
    taskTitleCompleted: { textDecorationLine: 'line-through', color: colors.textMuted },
    taskDue: { fontSize: fontSize.xs, color: colors.textMuted },
    emptyTasks: { textAlign: 'center', color: colors.textMuted, padding: spacing.md },
    card: { backgroundColor: '#fff', borderRadius: borderRadius.xl, marginBottom: spacing.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    cardTitle: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text, padding: spacing.md, paddingBottom: 0 },
    menuItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
    menuIcon: { width: 40, height: 40, borderRadius: borderRadius.lg, backgroundColor: 'rgba(16,185,129,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
    menuContent: { flex: 1 },
    menuTitle: { fontSize: fontSize.base, fontWeight: '600', color: colors.text },
    menuSubtitle: { fontSize: fontSize.xs, color: colors.textMuted },
    vendorCard: { borderRadius: borderRadius.xl, padding: spacing.lg, marginBottom: spacing.lg, position: 'relative', overflow: 'hidden' },
    vendorBlob: { position: 'absolute', top: -40, right: -40, width: 128, height: 128, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 64 },
    vendorIconBox: { width: 48, height: 48, borderRadius: borderRadius.lg, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
    vendorTitle: { fontSize: fontSize.xl, fontWeight: 'bold', color: '#fff', marginBottom: spacing.sm },
    vendorDesc: { color: 'rgba(255,255,255,0.9)', fontSize: fontSize.sm, lineHeight: 20, marginBottom: spacing.lg },
    vendorButton: { backgroundColor: '#fff', borderRadius: borderRadius.md, padding: spacing.md, alignItems: 'center' },
    vendorButtonText: { color: colors.primary, fontWeight: 'bold' },
    vendorActiveHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, backgroundColor: 'rgba(243,244,246,0.5)' },
    vendorActiveIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(249,115,22,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
    vendorActiveTitle: { fontWeight: 'bold', color: colors.text },
    vendorActiveSubtitle: { fontSize: fontSize.xs, color: colors.textMuted },
    activeBadge: { backgroundColor: colors.emerald, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm },
    activeBadgeText: { color: '#fff', fontSize: fontSize.xs, fontWeight: 'bold' },
    switchButton: { backgroundColor: colors.text, margin: spacing.md, borderRadius: borderRadius.md, padding: spacing.md, alignItems: 'center' },
    switchButtonText: { color: '#fff', fontWeight: 'bold' },
    bottomSection: { marginTop: spacing.md },
    supportButton: { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: borderRadius.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    supportText: { flex: 1, fontWeight: '500', color: colors.textMuted, marginLeft: spacing.md },
    logoutButton: { backgroundColor: 'rgba(239,68,68,0.1)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.md, borderRadius: borderRadius.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
    logoutText: { fontWeight: 'bold', color: '#ef4444', marginLeft: spacing.sm },
    version: { textAlign: 'center', fontSize: fontSize.xs, color: colors.textMuted, paddingVertical: spacing.lg },
    modalContainer: { flex: 1, backgroundColor: colors.background },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border },
    cancelText: { color: colors.primary, fontWeight: '500' },
    modalTitle: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text },
    modalContent: { flex: 1, padding: spacing.lg },
    label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.sm, marginTop: spacing.md },
    input: { backgroundColor: '#fff', borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, fontSize: fontSize.base, color: colors.text },
    plantChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md, backgroundColor: 'rgba(243,244,246,0.8)', marginRight: spacing.sm },
    plantChipActive: { backgroundColor: colors.primary },
    plantChipText: { fontSize: fontSize.sm, color: colors.textMuted },
    plantChipTextActive: { color: '#fff' },
    optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
    typeOption: { width: '31%', padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: 'rgba(243,244,246,0.8)', alignItems: 'center' },
    typeOptionActive: { backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 1, borderColor: colors.primary },
    typeText: { fontSize: fontSize.xs, color: colors.textMuted, textTransform: 'capitalize', marginTop: 4 },
    typeTextActive: { color: colors.primary, fontWeight: '500' },
    freqChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md, backgroundColor: 'rgba(243,244,246,0.8)', marginRight: spacing.sm },
    freqChipActive: { backgroundColor: colors.primary },
    freqText: { fontSize: fontSize.sm, color: colors.textMuted, textTransform: 'capitalize' },
    freqTextActive: { color: '#fff' },
    createButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary, borderRadius: borderRadius.md, padding: spacing.md, marginTop: spacing.xl },
    createButtonText: { color: '#fff', fontWeight: 'bold', fontSize: fontSize.base },
    vendorModalDesc: { color: colors.textMuted, marginBottom: spacing.lg },
    textArea: { height: 80, textAlignVertical: 'top' },
    vendorWelcome: { alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.05)', borderRadius: borderRadius.xl, padding: spacing.lg, marginBottom: spacing.xl },
    vendorWelcomeIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(16,185,129,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
    vendorWelcomeTitle: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text, marginBottom: spacing.xs },
    vendorWelcomeText: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center' },
    vendorSectionTitle: { fontSize: fontSize.base, fontWeight: 'bold', color: colors.text, marginBottom: spacing.md },
    vendorHint: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: spacing.xs, fontStyle: 'italic' },
    uploadCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
    uploadIcon: { width: 44, height: 44, borderRadius: borderRadius.md, backgroundColor: 'rgba(16,185,129,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
    uploadContent: { flex: 1 },
    uploadTitle: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
    uploadSubtitle: { fontSize: fontSize.xs, color: colors.textMuted },
    termsRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.xl, marginBottom: spacing.md },
    checkbox: { width: 22, height: 22, borderRadius: 6, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
    termsText: { flex: 1, fontSize: fontSize.sm, color: colors.textMuted, lineHeight: 20 },
    termsLink: { color: colors.primary, fontWeight: '500' },
    commissionNotice: { flexDirection: 'row', backgroundColor: 'rgba(249,115,22,0.1)', padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.md },
    commissionNoticeText: { flex: 1, fontSize: fontSize.xs, color: '#b45309', marginLeft: spacing.sm, lineHeight: 18 },
});

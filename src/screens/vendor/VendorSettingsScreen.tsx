import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    Switch,
    Alert,
    ActivityIndicator,
    StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../../services/firebaseConfig';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc } from 'firebase/firestore';
import { colors, spacing, borderRadius, fontSize } from '../../theme';

export default function VendorSettingsScreen({ navigation }: any) {
    const [notifications, setNotifications] = useState(true);
    const [notifLoading, setNotifLoading] = useState(true);
    const [complaintCount, setComplaintCount] = useState(0); // Dynamic count state

    // ✅ FETCH PENDING COMPLAINTS COUNT
    useEffect(() => {
        const vendorId = auth.currentUser?.uid;
        if (!vendorId) return;

        // Sirf wo complaints jo is vendor ki hain aur status 'pending' ya 'open' hai
        const q = query(
            collection(db, "complaints"),
            where("vendorId", "==", vendorId),
            where("status", "==", "open")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setComplaintCount(snapshot.size); // Snapshot size tells us the number of documents
        }, (error) => {
            console.error("Error fetching complaint count:", error);
        });

        return () => unsubscribe();
    }, []);

    // ✅ LOAD PUSH NOTIFICATION PREFERENCE FROM FIRESTORE
    useEffect(() => {
        const loadNotifPref = async () => {
            const uid = auth.currentUser?.uid;
            if (!uid) return;
            try {
                const userDoc = await getDoc(doc(db, 'users', uid));
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    // default to true if field doesn't exist
                    setNotifications(data.pushNotificationsEnabled !== false);
                }
            } catch (e) {
                console.error('Error loading notification preference:', e);
            } finally {
                setNotifLoading(false);
            }
        };
        loadNotifPref();
    }, []);

    // ✅ TOGGLE PUSH NOTIFICATIONS & SAVE TO FIRESTORE
    const toggleNotifications = async (value: boolean) => {
        setNotifications(value);
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        try {
            const userRef = doc(db, 'users', uid);
            if (value) {
                // Turning ON: restore token from backup and set preference
                const userSnap = await getDoc(userRef);
                const savedToken = userSnap.data()?.expoPushTokenBackup || '';
                await updateDoc(userRef, {
                    pushNotificationsEnabled: true,
                    ...(savedToken ? { expoPushToken: savedToken } : {}),
                });
            } else {
                // Turning OFF: backup token, clear it, set preference
                const userSnap = await getDoc(userRef);
                const currentToken = userSnap.data()?.expoPushToken || '';
                await updateDoc(userRef, {
                    pushNotificationsEnabled: false,
                    expoPushTokenBackup: currentToken,
                    expoPushToken: '',    // clear token so no push reaches vendor
                });
            }
        } catch (e) {
            console.error('Error saving notification preference:', e);
            setNotifications(!value); // revert on error
            Alert.alert('Error', 'Failed to update notification preference.');
        }
    };

    const handleSwitchToCustomer = () => {
        Alert.alert(
            "Switch Mode",
            "Are you switching to customer mode?",
            [
                { text: "No", style: "cancel" },
                {
                    text: "Yes",
                    onPress: () => {
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'MainTabs' }],
                        });
                    }
                }
            ]
        );
    };

    const handleLogout = async () => {
        Alert.alert("Logout", "Are you sure?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Logout",
                style: "destructive",
                onPress: async () => {
                    try {
                        await signOut(auth);
                        await AsyncStorage.multiRemove(["vendor_user", "userToken"]);
                        navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
                    } catch (error) {
                        Alert.alert("Error", "Logout failed.");
                    }
                }
            }
        ]);
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Feather name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Settings</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Store Settings */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Store Settings</Text>
                    <View style={styles.card}>
                        <SettingItem
                            icon="shopping-bag"
                            color="#f97316"
                            label="Store Profile"
                            onPress={() => navigation.navigate('VendorStoreProfile')}
                        />

                        <SettingItem
                            icon="truck"
                            color="#10b981"
                            label="Shipping Options"
                            onPress={() => navigation.navigate('VendorShipping')}
                            isLast
                        />
                    </View>
                </View>

                {/* Notifications & Automation */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Preferences</Text>
                    <View style={styles.card}>
                        <View style={[styles.switchItem, { borderBottomWidth: 0 }]}>
                            <View>
                                <Text style={styles.switchLabel}>Push Notifications</Text>
                                <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                                    {notifications ? 'You will receive alerts' : 'Notifications are muted'}
                                </Text>
                            </View>
                            <Switch
                                value={notifications}
                                onValueChange={toggleNotifications}
                                trackColor={{ false: '#d1d5db', true: colors.primary }}
                                disabled={notifLoading}
                            />
                        </View>
                    </View>
                </View>

                {/* Support & Complaints */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Support</Text>
                    <View style={styles.card}>


                        <SettingItem
                            icon="star"
                            color="#f59e0b"
                            label="Ratings & Reviews"
                            onPress={() => navigation.navigate('VendorReviews')}
                        />

                        <SettingItem
                            icon="inbox"
                            color="#f97316"
                            label="Complaints"
                            badge={complaintCount > 0 ? complaintCount : null}
                            onPress={() => navigation.navigate('VendorComplaints')}
                        />

                        <SettingItem
                            icon="mail"
                            color="#ec4899"
                            label="Contact Support"
                            isLast
                            onPress={() => navigation.navigate('HelpSupport', { mode: 'vendor' })}
                        />
                    </View>
                </View>

                {/* Account Actions */}
                <View style={styles.section}>
                    <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                        <Feather name="log-out" size={20} color="#ef4444" />
                        <Text style={styles.logoutText}>Logout Account</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.switchButton, { backgroundColor: colors.primary }]}
                        onPress={handleSwitchToCustomer}
                    >
                        <Feather name="repeat" size={18} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.switchButtonText}>Switch to Customer Mode</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

// Reusable Component
const SettingItem = ({ icon, color, label, onPress, isLast, badge }: any) => (
    <TouchableOpacity
        style={[styles.menuItem, isLast && { borderBottomWidth: 0 }]}
        onPress={onPress}
    >
        <View style={[styles.menuIconBox, { backgroundColor: color + '10' }]}>
            <Feather name={icon} size={18} color={color} />
        </View>
        <Text style={styles.menuLabel}>{label}</Text>
        {badge !== null && badge !== undefined && (
            <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View>
        )}
        <Feather name="chevron-right" size={18} color="#9ca3af" />
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f9fafb' },
    header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
    title: { flex: 1, fontSize: 20, fontWeight: 'bold', color: colors.text, marginLeft: spacing.md },
    section: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: '#9ca3af', marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 1 },
    card: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
    menuItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
    menuIconBox: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
    menuLabel: { flex: 1, fontSize: 16, color: colors.text, fontWeight: '500' },
    badge: { backgroundColor: '#ef4444', minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', borderRadius: 10, marginRight: 8, paddingHorizontal: 4 },
    badgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
    switchItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
    switchLabel: { fontSize: 16, color: colors.text, fontWeight: '500' },
    logoutButton: { flexDirection: "row", justifyContent: "center", alignItems: "center", padding: spacing.md, backgroundColor: '#fee2e2', borderRadius: 12, marginBottom: 12 },
    logoutText: { color: "#ef4444", fontSize: 16, fontWeight: "bold", marginLeft: 10 },
    switchButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: spacing.md, borderRadius: 12 },
    switchButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
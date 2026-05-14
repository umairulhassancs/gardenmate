import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, SafeAreaView, Alert, Image, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
// Import with local fallbacks to prevent "Property doesn't exist" error
import * as Theme from '../theme';
import { auth, db, storage } from '../services/firebaseConfig';
import { doc, getDoc, updateDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { updateProfile as updateAuthProfile, updateEmail } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';

// Fallback values if theme file is missing properties
const colors = Theme.colors || { primary: '#4CAF50', text: '#000', textMuted: '#666', border: '#ddd', background: '#fff' };
const spacing = Theme.spacing || { sm: 8, md: 16, lg: 24, xl: 32 };
const borderRadius = Theme.borderRadius || { md: 8, lg: 12 };
const fontSize = Theme.fontSize || { xs: 12, sm: 14, base: 16, xl: 20 };

interface UserProfile {
    id: string;
    name: string;
    email: string;
    phone: string;
    location: string;
    photoURL?: string;
    createdAt?: any;
}

export default function AccountDetailsScreen({ navigation }: any) {
    const [profile, setProfile] = useState<UserProfile>({
        id: '', name: '', email: '', phone: '', location: '',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [location, setLocation] = useState('');
    const [photoURL, setPhotoURL] = useState('');
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const user = auth.currentUser;
                if (!user) {
                    Alert.alert('Error', 'Please login first');
                    navigation.goBack();
                    return;
                }

                const userRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userRef);

                let profileData: UserProfile;

                if (userDoc.exists()) {
                    const data = userDoc.data();
                    profileData = {
                        id: user.uid,
                        name: data.name || user.displayName || '',
                        email: user.email || '',
                        phone: data.phone || '',
                        location: data.location || '',
                        photoURL: data.photoURL || user.photoURL || '',
                        createdAt: data.createdAt,
                    };
                } else {
                    // Create doc if missing
                    profileData = {
                        id: user.uid,
                        name: user.displayName || '',
                        email: user.email || '',
                        phone: '',
                        location: 'Lahore, Pakistan',
                        photoURL: user.photoURL || '',
                    };
                    await setDoc(userRef, { ...profileData, createdAt: serverTimestamp() });
                }

                setProfile(profileData);
                setName(profileData.name);
                setEmail(profileData.email);
                setPhone(profileData.phone);
                setLocation(profileData.location);
                setPhotoURL(profileData.photoURL || '');

            } catch (error) {
                console.error('Fetch Error:', error);
                Alert.alert('Error', 'Failed to load profile');
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    useEffect(() => {
        const isChanged =
            name !== profile.name ||
            email !== profile.email ||
            phone !== profile.phone ||
            location !== profile.location ||
            photoURL !== profile.photoURL;
        setHasChanges(isChanged);
    }, [name, email, phone, location, photoURL]);

    const handleSave = async () => {
        if (!name.trim() || !email.trim()) {
            Alert.alert('Required', 'Name and email cannot be empty');
            return;
        }

        setSaving(true);
        try {
            const user = auth.currentUser;
            if (!user) return;

            // 1. Update Firestore
            await updateDoc(doc(db, 'users', user.uid), {
                name, phone, location, photoURL,
                updatedAt: serverTimestamp(),
            });

            // 2. Update Auth Display Name
            await updateAuthProfile(user, { displayName: name, photoURL: photoURL || null });

            // 3. Update Email (Check for re-auth error)
            if (email !== user.email) {
                await updateEmail(user, email);
            }

            setProfile(prev => ({ ...prev, name, email, phone, location, photoURL }));
            setHasChanges(false);
            Alert.alert('Success', 'Profile updated');
        } catch (error: any) {
            if (error.code === 'auth/requires-recent-login') {
                Alert.alert('Security Notice', 'Please re-login to change your email address.');
            } else {
                Alert.alert('Update Failed', error.message);
            }
        } finally {
            setSaving(false);
        }
    };

    const formatMemberSince = () => {
        if (!profile.createdAt) return 'New Member';
        try {
            // Handle both Firestore Timestamp and regular Date
            const date = profile.createdAt?.toDate ? profile.createdAt.toDate() : new Date(profile.createdAt);
            return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        } catch (e) {
            return 'Recently';
        }
    };

    if (loading) return (
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color={colors.primary} />
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Feather name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Account Details</Text>
                <TouchableOpacity onPress={handleSave} disabled={!hasChanges || saving}>
                    {saving ? <ActivityIndicator size="small" color={colors.primary} /> :
                        <Text style={[styles.saveText, !hasChanges && styles.saveTextDisabled]}>Save</Text>}
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                <View style={styles.avatarSection}>
                    <View style={styles.avatarContainer}>
                        {photoURL ? (
                            <Image source={{ uri: photoURL }} style={styles.avatarImage} />
                        ) : (
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
                            </View>
                        )}
                        <TouchableOpacity style={styles.changeAvatarBtn} onPress={async () => {
                            let res = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.5 });
                            if (!res.canceled) {
                                const localUri = res.assets[0].uri;
                                const user = auth.currentUser;
                                if (!user) return;
                                try {
                                    const response = await fetch(localUri);
                                    const blob = await response.blob();
                                    const storageRef = ref(storage, `profileImages/${user.uid}`);
                                    await uploadBytes(storageRef, blob);
                                    const downloadURL = await getDownloadURL(storageRef);
                                    setPhotoURL(downloadURL);
                                } catch (error) {
                                    console.error('Image upload error:', error);
                                    Alert.alert('Upload Failed', 'Could not upload image. Please try again.');
                                }
                            }
                        }}>
                            <Feather name="camera" size={16} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.formSection}>
                    <Text style={styles.inputLabel}>Full Name</Text>
                    <TextInput style={styles.input} value={name} onChangeText={setName} />

                    <Text style={styles.inputLabel}>Email</Text>
                    <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" />

                    <Text style={styles.inputLabel}>Phone</Text>
                    <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

                    <Text style={styles.inputLabel}>Location</Text>
                    <TextInput style={styles.input} value={location} onChangeText={setLocation} />
                </View>

                <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Member Since</Text>
                        <Text style={styles.infoValue}>{formatMemberSince()}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Account ID</Text>
                        <Text style={styles.infoValue}>#{profile.id.slice(0, 8).toUpperCase()}</Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

// Styles are already well-defined in your code, keeping them as is.
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
    title: { fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text },
    saveText: { fontSize: fontSize.base, fontWeight: 'bold', color: colors.primary },
    saveTextDisabled: { color: colors.textMuted },
    avatarSection: { alignItems: 'center', paddingVertical: spacing.xl },
    avatarContainer: { position: 'relative' },
    avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
    avatarImage: { width: 100, height: 100, borderRadius: 50 },
    avatarText: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
    changeAvatarBtn: { position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.text, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
    formSection: { paddingHorizontal: spacing.lg },
    inputLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.sm, marginTop: spacing.md },
    input: { backgroundColor: '#fff', borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, fontSize: fontSize.base, color: colors.text },
    infoCard: { backgroundColor: '#f9f9f9', marginHorizontal: spacing.lg, marginTop: spacing.xl, padding: spacing.md, borderRadius: borderRadius.lg },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
    infoLabel: { color: colors.textMuted },
    infoValue: { fontWeight: 'bold', color: colors.text }
});
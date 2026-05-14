import React, { useState, useEffect } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, TextInput,
    StyleSheet, Alert, ActivityIndicator, Image, Dimensions, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, borderRadius, fontSize } from '../../theme';
import { db, auth } from '../../services/firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getCurrentLocation, reverseGeocode } from '../../services/locationService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COVER_HEIGHT = 180;
const PROFILE_SIZE = 110;

export default function VendorStoreProfileScreen({ navigation }: any) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [storeName, setStoreName] = useState('');
    const [description, setDescription] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [logo, setLogo] = useState<string | null>(null);
    const [coverPhoto, setCoverPhoto] = useState<string | null>(null);
    const [nurseryAddress, setNurseryAddress] = useState('');
    const [cnic, setCnic] = useState('');
    const [nurseryPhotos, setNurseryPhotos] = useState<string[]>([]);
    const [registrationDocs, setRegistrationDocs] = useState<string[]>([]);
    const [locating, setLocating] = useState(false);
    const [nurseryLat, setNurseryLat] = useState<number | null>(null);
    const [nurseryLng, setNurseryLng] = useState<number | null>(null);

    const vendorId = auth.currentUser?.uid;

    useEffect(() => {
        const fetchStoreData = async () => {
            if (!vendorId) return;
            try {
                const docRef = doc(db, 'vendors', vendorId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setStoreName(data.storeName || '');
                    setDescription(data.description || '');
                    setEmail(data.email || auth.currentUser?.email || '');
                    setPhone(data.phone || '');
                    setLogo(data.logoUrl || null);
                    setCoverPhoto(data.coverPhotoUrl || null);
                    setNurseryAddress(data.nurseryAddress || '');
                    setCnic(data.cnic || '');
                    setNurseryPhotos(data.nurseryPhotos || []);
                    setRegistrationDocs(data.registrationDocs || []);
                    setNurseryLat(data.nurseryLatitude || null);
                    setNurseryLng(data.nurseryLongitude || null);
                }
            } catch (error) {
                console.error("Error:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStoreData();
    }, [vendorId]);

    // Pick profile photo (square crop)
    const pickProfilePhoto = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (!result.canceled && result.assets[0]) {
            setLogo(result.assets[0].uri);
        }
    };

    // Pick cover photo (landscape crop)
    const pickCoverPhoto = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.8,
        });
        if (!result.canceled && result.assets[0]) {
            setCoverPhoto(result.assets[0].uri);
        }
    };

    // Show photo options (Change / Remove)
    const showProfilePhotoOptions = () => {
        Alert.alert('Profile Photo', 'Choose an option', [
            { text: 'Change Photo', onPress: pickProfilePhoto },
            ...(logo ? [{ text: 'Remove Photo', style: 'destructive' as const, onPress: () => setLogo(null) }] : []),
            { text: 'Cancel', style: 'cancel' as const },
        ]);
    };

    const showCoverPhotoOptions = () => {
        Alert.alert('Cover Photo', 'Choose an option', [
            { text: 'Change Cover', onPress: pickCoverPhoto },
            ...(coverPhoto ? [{ text: 'Remove Cover', style: 'destructive' as const, onPress: () => setCoverPhoto(null) }] : []),
            { text: 'Cancel', style: 'cancel' as const },
        ]);
    };

    // 📍 Use current location for nursery address
    const handleUseMyLocation = async () => {
        setLocating(true);
        try {
            const coords = await getCurrentLocation();
            if (!coords) { setLocating(false); return; }

            setNurseryLat(coords.latitude);
            setNurseryLng(coords.longitude);

            const address = await reverseGeocode(coords.latitude, coords.longitude);
            if (address) {
                setNurseryAddress(address.formattedAddress);
            }
        } catch (error) {
            console.error('Location error:', error);
            Alert.alert('Error', 'Could not get your location');
        } finally {
            setLocating(false);
        }
    };

    // Save store profile to Firestore
    const handleSave = async () => {
        if (!vendorId || !storeName.trim()) {
            Alert.alert('Error', 'Store name is required.');
            return;
        }
        setSaving(true);
        try {
            await setDoc(doc(db, 'vendors', vendorId), {
                storeName: storeName.trim(),
                description: description.trim(),
                email,
                phone: phone.trim(),
                logoUrl: logo || '',
                coverPhotoUrl: coverPhoto || '',
                nurseryAddress: nurseryAddress.trim(),
                nurseryLatitude: nurseryLat || null,
                nurseryLongitude: nurseryLng || null,
                cnic,
                nurseryPhotos,
                registrationDocs,
            }, { merge: true });
            Alert.alert('Success', 'Store profile updated successfully!');
        } catch (error) {
            console.error('Error saving store profile:', error);
            Alert.alert('Error', 'Failed to save store profile.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#f97316" />
                    <Text style={{ color: colors.textMuted, marginTop: 12 }}>Loading store profile...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* ===== COVER PHOTO SECTION ===== */}
                <View style={styles.coverContainer}>
                    {coverPhoto ? (
                        <Image source={{ uri: coverPhoto }} style={styles.coverImage} />
                    ) : (
                        <View style={styles.coverPlaceholder}>
                            <Feather name="image" size={36} color="rgba(255,255,255,0.5)" />
                            <Text style={styles.coverPlaceholderText}>Add a cover photo</Text>
                        </View>
                    )}

                    {/* Cover photo overlay gradient */}
                    <View style={styles.coverOverlay} />

                    {/* Back button */}
                    <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                        <Feather name="arrow-left" size={22} color="#fff" />
                    </TouchableOpacity>

                    {/* Edit cover button */}
                    <TouchableOpacity
                        style={styles.editCoverBtn}
                        onPress={coverPhoto ? showCoverPhotoOptions : pickCoverPhoto}
                    >
                        <Feather name="camera" size={14} color="#fff" />
                        <Text style={styles.editCoverText}>
                            {coverPhoto ? 'Edit Cover' : 'Add Cover'}
                        </Text>
                    </TouchableOpacity>

                    {/* Title on cover */}
                    <Text style={styles.coverTitle}>Store Profile</Text>
                </View>

                {/* ===== PROFILE PHOTO SECTION ===== */}
                <View style={styles.profileSection}>
                    <TouchableOpacity
                        style={styles.profilePhotoWrapper}
                        onPress={logo ? showProfilePhotoOptions : pickProfilePhoto}
                        activeOpacity={0.8}
                    >
                        {logo ? (
                            <Image source={{ uri: logo }} style={styles.profileImage} />
                        ) : (
                            <View style={styles.profilePlaceholder}>
                                <Feather name="shopping-bag" size={36} color="#f97316" />
                            </View>
                        )}
                        {/* Camera badge */}
                        <View style={styles.cameraBadge}>
                            <Feather name="camera" size={14} color="#fff" />
                        </View>
                    </TouchableOpacity>
                    <Text style={styles.profileLabel}>
                        {logo ? 'Tap to change photo' : 'Tap to set profile photo'}
                    </Text>
                </View>

                {/* ===== FORM SECTION ===== */}
                <View style={styles.form}>
                    {/* Store Info Section */}
                    <Text style={styles.sectionTitle}>Store Information</Text>
                    <View style={styles.card}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Store Name *</Text>
                            <TextInput
                                style={styles.input}
                                value={storeName}
                                onChangeText={setStoreName}
                                placeholder="e.g. Green Thumb Gardens"
                                placeholderTextColor="#9ca3af"
                            />
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Description</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={description}
                                onChangeText={setDescription}
                                multiline
                                numberOfLines={4}
                                placeholder="Tell customers about your store..."
                                placeholderTextColor="#9ca3af"
                            />
                        </View>
                    </View>

                    {/* Contact Info Section */}
                    <Text style={styles.sectionTitle}>Contact Details</Text>
                    <View style={styles.card}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Email Address</Text>
                            <View style={styles.readonlyRow}>
                                <Feather name="mail" size={16} color="#9ca3af" style={{ marginRight: 10 }} />
                                <TextInput
                                    style={[styles.input, styles.readonlyInput]}
                                    value={email}
                                    editable={false}
                                />
                            </View>
                        </View>
                        <View style={[styles.inputGroup, { marginBottom: 0 }]}>
                            <Text style={styles.label}>Phone Number</Text>
                            <View style={styles.inputRow}>
                                <Feather name="phone" size={16} color="#9ca3af" style={{ marginRight: 10 }} />
                                <TextInput
                                    style={[styles.input, { flex: 1 }]}
                                    value={phone}
                                    onChangeText={setPhone}
                                    keyboardType="phone-pad"
                                    placeholder="+92 300 1234567"
                                    placeholderTextColor="#9ca3af"
                                />
                            </View>
                        </View>
                    </View>

                    {/* Location & Verification */}
                    <Text style={styles.sectionTitle}>Location & Verification</Text>
                    <View style={styles.card}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Nursery Address</Text>
                            <TouchableOpacity
                                style={styles.locationBtn}
                                onPress={handleUseMyLocation}
                                disabled={locating}
                                activeOpacity={0.7}
                            >
                                {locating ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Feather name="crosshair" size={16} color="#fff" />
                                )}
                                <Text style={styles.locationBtnText}>
                                    {locating ? 'Getting Location...' : '📍 Use My Current Location'}
                                </Text>
                            </TouchableOpacity>
                            {nurseryLat && nurseryLng && (
                                <View style={styles.locationPinned}>
                                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' }} />
                                    <Text style={styles.locationPinnedText}>
                                        Location pinned ({nurseryLat.toFixed(4)}, {nurseryLng.toFixed(4)})
                                    </Text>
                                </View>
                            )}
                            <View style={styles.inputRow}>
                                <Feather name="map-pin" size={16} color="#9ca3af" style={{ marginRight: 10 }} />
                                <TextInput
                                    style={[styles.input, { flex: 1 }]}
                                    value={nurseryAddress}
                                    onChangeText={setNurseryAddress}
                                    placeholder="Full address of your nursery"
                                    placeholderTextColor="#9ca3af"
                                />
                            </View>
                        </View>
                        <View style={[styles.inputGroup, { marginBottom: 0 }]}>
                            <Text style={styles.label}>CNIC Number</Text>
                            <View style={styles.readonlyRow}>
                                <Feather name="credit-card" size={16} color="#9ca3af" style={{ marginRight: 10 }} />
                                <TextInput
                                    style={[styles.input, styles.readonlyInput]}
                                    value={cnic}
                                    editable={false}
                                    placeholder="e.g. 12345-1234567-1"
                                    placeholderTextColor="#9ca3af"
                                />
                            </View>
                            <Text style={styles.hintText}>* CNIC cannot be changed after registration</Text>
                        </View>
                    </View>

                    {/* Gallery & Documents - Read Only */}
                    <Text style={styles.sectionTitle}>Gallery & Documents</Text>
                    <View style={styles.card}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Nursery Photos</Text>
                            {nurseryPhotos.length > 0 ? (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
                                    {nurseryPhotos.map((uri, index) => (
                                        <View key={index} style={styles.galleryImageContainer}>
                                            <Image source={{ uri }} style={styles.galleryImage} />
                                        </View>
                                    ))}
                                </ScrollView>
                            ) : (
                                <View style={styles.emptyGallery}>
                                    <Feather name="image" size={20} color="#d1d5db" />
                                    <Text style={styles.emptyGalleryText}>No photos uploaded</Text>
                                </View>
                            )}
                        </View>
                        <View style={[styles.inputGroup, { marginBottom: 0 }]}>
                            <Text style={styles.label}>Registration Documents</Text>
                            {registrationDocs.length > 0 ? (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
                                    {registrationDocs.map((uri, index) => (
                                        <View key={index} style={styles.galleryImageContainer}>
                                            <Image source={{ uri }} style={styles.galleryImage} />
                                        </View>
                                    ))}
                                </ScrollView>
                            ) : (
                                <View style={styles.emptyGallery}>
                                    <Feather name="file-text" size={20} color="#d1d5db" />
                                    <Text style={styles.emptyGalleryText}>No documents uploaded</Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.hintText}>* Photos and documents cannot be changed from the app</Text>
                    </View>
                </View>

                {/* ===== SAVE BUTTON ===== */}
                <TouchableOpacity
                    style={[styles.saveBtn, (saving || !storeName.trim()) ? { opacity: 0.6 } : {}]}
                    onPress={handleSave}
                    disabled={saving || !storeName.trim()}
                    activeOpacity={0.8}
                >
                    {saving ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Feather name="check" size={18} color="#fff" style={{ marginRight: 8 }} />
                            <Text style={styles.saveBtnText}>Save Changes</Text>
                        </>
                    )}
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },

    // ===== COVER PHOTO =====
    coverContainer: {
        width: SCREEN_WIDTH,
        height: COVER_HEIGHT,
        position: 'relative',
    },
    coverImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    coverPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#1e293b',
        justifyContent: 'center',
        alignItems: 'center',
    },
    coverPlaceholderText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 13,
        marginTop: 6,
    },
    coverOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.25)',
    },
    backBtn: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 16,
        left: 16,
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    editCoverBtn: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 20,
        gap: 6,
    },
    editCoverText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    coverTitle: {
        position: 'absolute',
        bottom: 14,
        left: 16,
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },

    // ===== PROFILE PHOTO =====
    profileSection: {
        alignItems: 'center',
        marginTop: -(PROFILE_SIZE / 2),
        marginBottom: spacing.md,
        zIndex: 10,
    },
    profilePhotoWrapper: {
        width: PROFILE_SIZE,
        height: PROFILE_SIZE,
        borderRadius: PROFILE_SIZE / 2,
        borderWidth: 4,
        borderColor: '#fff',
        backgroundColor: '#fff',
        overflow: 'visible',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 8,
    },
    profileImage: {
        width: '100%',
        height: '100%',
        borderRadius: PROFILE_SIZE / 2,
        resizeMode: 'cover',
    },
    profilePlaceholder: {
        width: '100%',
        height: '100%',
        borderRadius: PROFILE_SIZE / 2,
        backgroundColor: 'rgba(249,115,22,0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cameraBadge: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f97316',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2.5,
        borderColor: '#fff',
    },
    profileLabel: {
        color: colors.textMuted,
        fontSize: 12,
        marginTop: 8,
    },

    // ===== FORM =====
    form: {
        paddingHorizontal: spacing.lg,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.sm,
        marginTop: spacing.lg,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(229,231,235,0.5)',
    },
    inputGroup: {
        marginBottom: spacing.md,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 6,
    },
    input: {
        backgroundColor: '#f9fafb',
        borderRadius: borderRadius.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        fontSize: 15,
        color: colors.text,
    },
    readonlyInput: {
        flex: 1,
        backgroundColor: '#f3f4f6',
        color: '#6b7280',
    },
    readonlyRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    hintText: {
        fontSize: 10,
        color: '#9ca3af',
        marginTop: 4,
    },

    // ===== GALLERY =====
    imageScroll: {
        flexDirection: 'row',
        marginTop: 8,
    },
    galleryImageContainer: {
        marginRight: 10,
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    galleryImage: {
        width: 90,
        height: 90,
        resizeMode: 'cover',
    },

    // ===== SAVE BUTTON =====
    saveBtn: {
        backgroundColor: '#f97316',
        padding: 16,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
        marginHorizontal: spacing.lg,
        marginTop: spacing.xl,
        flexDirection: 'row',
        justifyContent: 'center',
        shadowColor: '#f97316',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    saveBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },

    // ===== EMPTY GALLERY =====
    emptyGallery: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f9fafb',
        borderRadius: borderRadius.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderStyle: 'dashed',
        gap: 8,
    },
    emptyGalleryText: {
        color: '#9ca3af',
        fontSize: 13,
        fontStyle: 'italic',
    },

    // ===== LOCATION BUTTON =====
    locationBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#3b82f6',
        paddingVertical: 10,
        borderRadius: borderRadius.md,
        gap: 6,
        marginBottom: 8,
    },
    locationBtnText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 13,
    },
    locationPinned: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16,185,129,0.08)',
        padding: 8,
        borderRadius: borderRadius.md,
        marginBottom: 8,
        gap: 8,
    },
    locationPinnedText: {
        flex: 1,
        fontSize: 11,
        color: '#10b981',
        fontWeight: '500',
    },
});
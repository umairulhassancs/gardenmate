import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    TextInput,
    Alert,
    ActivityIndicator,
    Switch
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../../theme';
import { db, auth } from '../../services/firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getCurrentLocation, reverseGeocode } from '../../services/locationService';
import AddressAutocomplete from '../../components/AddressAutocomplete';
import { type NominatimResult } from '../../services/locationService';

export default function VendorShippingScreen({ navigation }: any) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [locating, setLocating] = useState(false);

    // Vendor Location
    const [vendorCity, setVendorCity] = useState('');
    const [vendorArea, setVendorArea] = useState('');
    const [latitude, setLatitude] = useState<number | null>(null);
    const [longitude, setLongitude] = useState<number | null>(null);

    // Shipping Rates
    const [standardRate, setStandardRate] = useState('100');
    const [outsideCityRate, setOutsideCityRate] = useState('250');
    const [freeShippingThreshold, setFreeShippingThreshold] = useState('2000');
    const [freeShippingEnabled, setFreeShippingEnabled] = useState(true);

    // Delivery Radius
    const [radiusKm, setRadiusKm] = useState('10');

    // Delivery Areas
    const [deliveryAreas, setDeliveryAreas] = useState<string[]>([]);
    const [newArea, setNewArea] = useState('');

    const vendorId = auth.currentUser?.uid;

    useEffect(() => {
        loadShippingSettings();
    }, []);

    const loadShippingSettings = async () => {
        if (!vendorId) return;

        try {
            const shippingRef = doc(db, 'vendorShipping', vendorId);
            const shippingSnap = await getDoc(shippingRef);

            if (shippingSnap.exists()) {
                const data = shippingSnap.data();
                setVendorCity(data.vendorCity || '');
                setVendorArea(data.vendorArea || '');
                setLatitude(data.latitude || null);
                setLongitude(data.longitude || null);
                setStandardRate(String(data.standardRate || 100));
                setOutsideCityRate(String(data.outsideCityRate || 250));
                setFreeShippingThreshold(String(data.freeShippingThreshold || 2000));
                setFreeShippingEnabled(data.freeShippingEnabled !== false);
                setRadiusKm(String(data.radiusKm || 10));
                setDeliveryAreas(data.deliveryAreas || []);
            }
        } catch (error) {
            console.error('Error loading shipping settings:', error);
        } finally {
            setLoading(false);
        }
    };

    // 📍 USE CURRENT LOCATION
    const handleUseMyLocation = async () => {
        setLocating(true);
        try {
            const coords = await getCurrentLocation();
            if (!coords) {
                setLocating(false);
                return;
            }

            setLatitude(coords.latitude);
            setLongitude(coords.longitude);

            // Reverse geocode to auto-fill city & area
            const address = await reverseGeocode(coords.latitude, coords.longitude);
            if (address) {
                setVendorCity(address.city);
                setVendorArea(address.street || '');
                console.log('📍 Vendor location set:', address.formattedAddress);
            }

            Alert.alert('Location Set', `Your nursery location has been pinned!\n\nCoordinates: ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
        } catch (error) {
            console.error('Location error:', error);
            Alert.alert('Error', 'Could not get your location');
        } finally {
            setLocating(false);
        }
    };

    const handleSave = async () => {
        if (!vendorCity.trim()) {
            Alert.alert('Required', 'Please enter your city or use location');
            return;
        }

        setSaving(true);
        try {
            // Auto-geocode if no GPS coordinates set
            let finalLat = latitude;
            let finalLng = longitude;

            if (!finalLat || !finalLng) {
                const { geocodeAddress } = require('../../services/locationService');
                const addressText = vendorArea
                    ? `${vendorArea}, ${vendorCity}, Pakistan`
                    : `${vendorCity}, Pakistan`;
                console.log('🔍 Auto-geocoding vendor address:', addressText);
                const coords = await geocodeAddress(addressText);
                if (coords) {
                    finalLat = coords.latitude;
                    finalLng = coords.longitude;
                    setLatitude(finalLat);
                    setLongitude(finalLng);
                    console.log('✅ Vendor geocoded:', coords.latitude, coords.longitude);
                } else {
                    console.log('⚠️ Vendor geocoding failed, saving without coordinates');
                }
            }

            const shippingRef = doc(db, 'vendorShipping', vendorId!);
            await setDoc(shippingRef, {
                vendorId,
                vendorCity: vendorCity.trim().toLowerCase(),
                vendorArea: vendorArea.trim().toLowerCase(),
                latitude: finalLat || null,
                longitude: finalLng || null,
                standardRate: Number(standardRate) || 100,
                outsideCityRate: Number(outsideCityRate) || 250,
                freeShippingThreshold: Number(freeShippingThreshold) || 2000,
                freeShippingEnabled,
                radiusKm: Number(radiusKm) || 10,
                deliveryAreas: deliveryAreas.map(a => a.toLowerCase()),
                updatedAt: new Date().toISOString()
            }, { merge: true });

            Alert.alert('Saved', 'Shipping settings updated successfully!');
        } catch (error) {
            console.error('Save error:', error);
            Alert.alert('Error', 'Could not save settings');
        } finally {
            setSaving(false);
        }
    };

    const addDeliveryArea = () => {
        if (!newArea.trim()) return;
        if (deliveryAreas.includes(newArea.trim().toLowerCase())) {
            Alert.alert('Duplicate', 'This area is already added');
            return;
        }
        setDeliveryAreas([...deliveryAreas, newArea.trim()]);
        setNewArea('');
    };

    const removeDeliveryArea = (area: string) => {
        setDeliveryAreas(deliveryAreas.filter(a => a !== area));
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Feather name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Shipping Settings</Text>
                <TouchableOpacity onPress={handleSave} disabled={saving}>
                    {saving ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                        <Text style={styles.saveBtn}>Save</Text>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
                {/* ===== NURSERY LOCATION ===== */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📍 Nursery Location</Text>
                    <Text style={styles.sectionDesc}>Set your exact location for distance-based shipping</Text>

                    <View style={styles.card}>
                        {/* Use My Location Button */}
                        <TouchableOpacity
                            style={styles.locationBtn}
                            onPress={handleUseMyLocation}
                            disabled={locating}
                            activeOpacity={0.7}
                        >
                            {locating ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Feather name="crosshair" size={18} color="#fff" />
                            )}
                            <Text style={styles.locationBtnText}>
                                {locating ? 'Getting Location...' : 'Use My Current Location'}
                            </Text>
                        </TouchableOpacity>

                        {/* Location Status */}
                        {latitude && longitude ? (
                            <View style={styles.locationStatus}>
                                <View style={styles.locationDot} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.locationStatusText}>Location pinned</Text>
                                    <Text style={styles.locationCoords}>
                                        {latitude.toFixed(4)}, {longitude.toFixed(4)}
                                    </Text>
                                </View>
                                <TouchableOpacity onPress={() => { setLatitude(null); setLongitude(null); }}>
                                    <Feather name="x" size={16} color="#ef4444" />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.locationWarning}>
                                <Feather name="alert-circle" size={14} color="#f59e0b" />
                                <Text style={styles.locationWarningText}>
                                    No location set. Distance-based shipping won't work without it.
                                </Text>
                            </View>
                        )}

                        {/* 🔍 Address Search */}
                        <View style={{ marginVertical: 8 }}>
                            <Text style={[styles.inputLabel, { marginBottom: 4 }]}>🔍 Search Your Location</Text>
                            <AddressAutocomplete
                                placeholder="Search nursery location..."
                                onSelect={(result: NominatimResult) => {
                                    if (result.city) setVendorCity(result.city);
                                    if (result.street) setVendorArea(result.street);
                                    setLatitude(result.latitude);
                                    setLongitude(result.longitude);
                                    console.log('📍 Vendor location selected:', result.displayName);
                                }}
                            />
                        </View>

                        {/* Manual City/Area */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>City *</Text>
                            <View style={styles.inputContainer}>
                                <Feather name="map-pin" size={18} color={colors.textMuted} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g., Lahore, Karachi, Islamabad"
                                    placeholderTextColor={colors.textMuted}
                                    value={vendorCity}
                                    onChangeText={setVendorCity}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Area / Sector (Optional)</Text>
                            <View style={styles.inputContainer}>
                                <Feather name="home" size={18} color={colors.textMuted} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g., DHA Phase 5, Gulberg"
                                    placeholderTextColor={colors.textMuted}
                                    value={vendorArea}
                                    onChangeText={setVendorArea}
                                />
                            </View>
                        </View>
                    </View>
                </View>

                {/* ===== DELIVERY RADIUS ===== */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📏 Standard Delivery Radius</Text>
                    <Text style={styles.sectionDesc}>Orders within this radius get the standard rate</Text>

                    <View style={styles.card}>
                        <View style={styles.radiusRow}>
                            <View style={styles.radiusInfo}>
                                <View style={[styles.rateIcon, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                                    <Feather name="target" size={18} color="#3b82f6" />
                                </View>
                                <View>
                                    <Text style={styles.rateLabel}>Radius</Text>
                                    <Text style={styles.rateDesc}>Distance from your nursery</Text>
                                </View>
                            </View>
                            <View style={styles.radiusInputBox}>
                                <TextInput
                                    style={styles.radiusInput}
                                    value={radiusKm}
                                    onChangeText={setRadiusKm}
                                    keyboardType="numeric"
                                    placeholder="10"
                                />
                                <Text style={styles.radiusUnit}>km</Text>
                            </View>
                        </View>

                        <View style={styles.radiusVisual}>
                            <View style={styles.radiusBar}>
                                <View style={[styles.radiusBarFill, { width: `${Math.min(Number(radiusKm) / 50 * 100, 100)}%` }]} />
                            </View>
                            <View style={styles.radiusLabels}>
                                <Text style={styles.radiusLabelText}>0 km</Text>
                                <Text style={styles.radiusLabelText}>25 km</Text>
                                <Text style={styles.radiusLabelText}>50 km</Text>
                            </View>
                        </View>

                        <View style={styles.radiusExplainer}>
                            <View style={styles.explainerRow}>
                                <View style={[styles.explainerDot, { backgroundColor: '#10b981' }]} />
                                <Text style={styles.explainerText}>
                                    Within {radiusKm || '10'} km → Standard Rate (Rs. {standardRate})
                                </Text>
                            </View>
                            <View style={styles.explainerRow}>
                                <View style={[styles.explainerDot, { backgroundColor: '#8b5cf6' }]} />
                                <Text style={styles.explainerText}>
                                    Beyond {radiusKm || '10'} km → Outside Rate (Rs. {outsideCityRate})
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* ===== SHIPPING RATES ===== */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>💰 Shipping Rates</Text>
                    <Text style={styles.sectionDesc}>Set delivery charges for different zones</Text>

                    <View style={styles.card}>
                        {/* Standard Rate */}
                        <View style={styles.rateRow}>
                            <View style={styles.rateInfo}>
                                <View style={[styles.rateIcon, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                                    <Feather name="truck" size={18} color="#10b981" />
                                </View>
                                <View>
                                    <Text style={styles.rateLabel}>Standard Delivery</Text>
                                    <Text style={styles.rateDesc}>Within {radiusKm || '10'} km radius</Text>
                                </View>
                            </View>
                            <View style={styles.rateInputBox}>
                                <Text style={styles.currencyLabel}>Rs.</Text>
                                <TextInput
                                    style={styles.rateInput}
                                    value={standardRate}
                                    onChangeText={setStandardRate}
                                    keyboardType="numeric"
                                    placeholder="100"
                                />
                            </View>
                        </View>

                        <View style={styles.divider} />

                        {/* Outside City Rate */}
                        <View style={styles.rateRow}>
                            <View style={styles.rateInfo}>
                                <View style={[styles.rateIcon, { backgroundColor: 'rgba(139,92,246,0.1)' }]}>
                                    <Feather name="navigation" size={18} color="#8b5cf6" />
                                </View>
                                <View>
                                    <Text style={styles.rateLabel}>Outside Radius</Text>
                                    <Text style={styles.rateDesc}>Beyond {radiusKm || '10'} km</Text>
                                </View>
                            </View>
                            <View style={styles.rateInputBox}>
                                <Text style={styles.currencyLabel}>Rs.</Text>
                                <TextInput
                                    style={styles.rateInput}
                                    value={outsideCityRate}
                                    onChangeText={setOutsideCityRate}
                                    keyboardType="numeric"
                                    placeholder="250"
                                />
                            </View>
                        </View>
                    </View>
                </View>

                {/* ===== FREE SHIPPING ===== */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🎁 Free Shipping</Text>

                    <View style={styles.card}>
                        <View style={styles.switchRow}>
                            <View style={styles.switchInfo}>
                                <Text style={styles.switchLabel}>Enable Free Shipping</Text>
                                <Text style={styles.switchDesc}>Offer free delivery above a threshold</Text>
                            </View>
                            <Switch
                                value={freeShippingEnabled}
                                onValueChange={setFreeShippingEnabled}
                                trackColor={{ false: '#d1d5db', true: colors.primary }}
                            />
                        </View>

                        {freeShippingEnabled && (
                            <>
                                <View style={styles.divider} />
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Free Shipping Above (Rs.)</Text>
                                    <View style={styles.inputContainer}>
                                        <Feather name="gift" size={18} color={colors.primary} />
                                        <TextInput
                                            style={styles.input}
                                            value={freeShippingThreshold}
                                            onChangeText={setFreeShippingThreshold}
                                            keyboardType="numeric"
                                            placeholder="2000"
                                        />
                                    </View>
                                    <Text style={styles.helperText}>
                                        Orders above Rs. {freeShippingThreshold || '0'} get free standard delivery
                                    </Text>
                                </View>
                            </>
                        )}
                    </View>
                </View>

                {/* ===== DELIVERY AREAS ===== */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🗺️ Delivery Areas (Optional)</Text>
                    <Text style={styles.sectionDesc}>Add specific areas where you deliver at standard rate</Text>

                    <View style={styles.card}>
                        <View style={styles.addAreaRow}>
                            <TextInput
                                style={styles.areaInput}
                                placeholder="Add area name..."
                                placeholderTextColor={colors.textMuted}
                                value={newArea}
                                onChangeText={setNewArea}
                            />
                            <TouchableOpacity style={styles.addBtn} onPress={addDeliveryArea}>
                                <Feather name="plus" size={20} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        {deliveryAreas.length > 0 && (
                            <View style={styles.areasContainer}>
                                {deliveryAreas.map((area, index) => (
                                    <View key={index} style={styles.areaChip}>
                                        <Text style={styles.areaChipText}>{area}</Text>
                                        <TouchableOpacity onPress={() => removeDeliveryArea(area)}>
                                            <Feather name="x" size={16} color={colors.textMuted} />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                </View>

                {/* Info Box */}
                <View style={styles.infoBox}>
                    <Feather name="info" size={18} color="#3b82f6" />
                    <Text style={styles.infoText}>
                        Shipping charges are calculated automatically at checkout. If your location is set, distance from your nursery to the customer determines whether standard or outside-radius rates apply.
                    </Text>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.lg,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: colors.border
    },
    title: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text },
    saveBtn: { fontSize: fontSize.base, fontWeight: '600', color: colors.primary },
    content: { padding: spacing.lg },

    section: { marginBottom: spacing.xl },
    sectionTitle: { fontSize: fontSize.base, fontWeight: 'bold', color: colors.text, marginBottom: 4 },
    sectionDesc: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.md },

    card: {
        backgroundColor: '#fff',
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border
    },

    // Location Button
    locationBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#3b82f6',
        paddingVertical: 14,
        borderRadius: borderRadius.md,
        gap: 8,
        marginBottom: spacing.md,
    },
    locationBtnText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: fontSize.base,
    },
    locationStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16,185,129,0.08)',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.md,
        gap: 10,
    },
    locationDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#10b981',
    },
    locationStatusText: {
        fontSize: fontSize.sm,
        fontWeight: '600',
        color: '#10b981',
    },
    locationCoords: {
        fontSize: fontSize.xs,
        color: colors.textMuted,
        marginTop: 2,
    },
    locationWarning: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(245,158,11,0.08)',
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        marginBottom: spacing.md,
        gap: 8,
    },
    locationWarningText: {
        flex: 1,
        fontSize: fontSize.xs,
        color: '#92400e',
    },

    // Radius
    radiusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    radiusInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    radiusInputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f9fafb',
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    radiusInput: {
        width: 50,
        height: 40,
        fontSize: fontSize.base,
        fontWeight: '600',
        color: colors.text,
        textAlign: 'right',
    },
    radiusUnit: {
        fontSize: fontSize.sm,
        color: colors.textMuted,
        marginLeft: 4,
    },
    radiusVisual: {
        marginTop: spacing.md,
    },
    radiusBar: {
        height: 6,
        backgroundColor: '#e5e7eb',
        borderRadius: 3,
        overflow: 'hidden',
    },
    radiusBarFill: {
        height: '100%',
        backgroundColor: '#3b82f6',
        borderRadius: 3,
    },
    radiusLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    radiusLabelText: {
        fontSize: 10,
        color: colors.textMuted,
    },
    radiusExplainer: {
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: '#f3f4f6',
        gap: 6,
    },
    explainerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    explainerDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    explainerText: {
        fontSize: fontSize.xs,
        color: '#6b7280',
    },

    // Form inputs
    inputGroup: { marginBottom: spacing.md },
    inputLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f9fafb',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
        gap: spacing.sm
    },
    input: { flex: 1, height: 48, fontSize: fontSize.base, color: colors.text },
    helperText: { fontSize: fontSize.xs, color: colors.primary, marginTop: spacing.xs },

    // Rates
    rateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm
    },
    rateInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    rateIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    rateLabel: { fontSize: fontSize.base, fontWeight: '600', color: colors.text },
    rateDesc: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
    rateInputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f9fafb',
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border
    },
    currencyLabel: { fontSize: fontSize.sm, color: colors.textMuted, marginRight: 4 },
    rateInput: {
        width: 70,
        height: 40,
        fontSize: fontSize.base,
        fontWeight: '600',
        color: colors.text,
        textAlign: 'right'
    },

    divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },

    // Switch
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.xs
    },
    switchInfo: { flex: 1 },
    switchLabel: { fontSize: fontSize.base, fontWeight: '600', color: colors.text },
    switchDesc: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },

    // Delivery areas
    addAreaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    areaInput: {
        flex: 1,
        height: 44,
        backgroundColor: '#f9fafb',
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
        fontSize: fontSize.base,
        color: colors.text,
        borderWidth: 1,
        borderColor: colors.border
    },
    addBtn: {
        width: 44,
        height: 44,
        backgroundColor: colors.primary,
        borderRadius: borderRadius.md,
        justifyContent: 'center',
        alignItems: 'center'
    },
    areasContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginTop: spacing.md
    },
    areaChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16,185,129,0.1)',
        paddingHorizontal: spacing.sm,
        paddingVertical: 6,
        borderRadius: borderRadius.full,
        gap: spacing.xs
    },
    areaChipText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '500' },

    // Info
    infoBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: 'rgba(59,130,246,0.1)',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        gap: spacing.sm
    },
    infoText: { flex: 1, fontSize: fontSize.sm, color: '#1e40af', lineHeight: 20 },
});

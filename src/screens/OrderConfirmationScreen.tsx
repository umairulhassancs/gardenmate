import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../theme';

export default function OrderConfirmationScreen({ navigation, route }: any) {
    // Backend/Checkout se milne wala data
    const {
        orderNumber = 'N/A',
        total = 0,
        items = 0,
        address = 'Address not provided',
        phone = '',
        vendorId = '',
        vendorName = ''
    } = route.params || {};

    const handleContinueShopping = () => {
        navigation.reset({
            index: 0,
            routes: [{ name: 'MainTabs' }],
        });
    };

    const handleViewOrders = () => {
        // Navigate to Profile and switch to Orders if possible
        navigation.navigate('MainTabs', {
            screen: 'Profile',
            params: { initialTab: 'Orders' } // Agar aapka profile screen tab handle karta hai
        });
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <View style={styles.content}>
                    {/* Success Animation Area */}
                    <View style={styles.successIcon}>
                        <View style={styles.successCircle}>
                            <Feather name="check" size={48} color="#fff" />
                        </View>
                    </View>

                    {/* Title */}
                    <Text style={styles.title}>Order Placed!</Text>
                    <Text style={styles.subtitle}>
                        Thank you for your purchase. Your plants are being prepared for delivery!
                    </Text>

                    {/* Order Details Card */}
                    <View style={styles.orderCard}>
                        <View style={styles.orderHeader}>
                            <Feather name="package" size={20} color={colors.primary} />
                            <Text style={styles.orderNumber}>ID: {orderNumber}</Text>
                        </View>

                        <View style={styles.orderDetails}>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Total Items</Text>
                                <Text style={styles.detailValue}>{items} plant(s)</Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Total Amount</Text>
                                <Text style={styles.detailValueBold}>Rs. {total.toFixed(2)}</Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Payment Mode</Text>
                                <View style={styles.codBadge}>
                                    <Text style={styles.codBadgeText}>Cash on Delivery</Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.addressSection}>
                            <View style={styles.addressHeader}>
                                <Feather name="map-pin" size={16} color={colors.textMuted} />
                                <Text style={styles.addressLabel}>Shipping To</Text>
                            </View>
                            <Text style={styles.addressText}>{address}</Text>
                            {phone ? (
                                <Text style={styles.phoneText}>
                                    <Feather name="phone" size={12} color={colors.textMuted} /> {phone}
                                </Text>
                            ) : null}
                        </View>
                    </View>

                    {/* Delivery Info */}
                    <View style={styles.deliveryCard}>
                        <Feather name="truck" size={24} color={colors.primary} />
                        <View style={styles.deliveryInfo}>
                            <Text style={styles.deliveryTitle}>Estimated Delivery</Text>
                            <Text style={styles.deliveryDate}>3-5 Business Days</Text>
                        </View>
                    </View>

                    {/* Care Tip */}
                    <View style={styles.tipCard}>
                        <Feather name="info" size={18} color={colors.primary} />
                        <Text style={styles.tipText}>
                            Pro Tip: Check your inbox for care instructions tailored to your new plants!
                        </Text>
                    </View>
                </View>
            </ScrollView>

            {/* Sticky Action Buttons */}
            <View style={styles.bottomSection}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={handleViewOrders}>
                    <Feather name="list" size={18} color={colors.primary} style={{ marginRight: 8 }} />
                    <Text style={styles.secondaryBtnText}>Track Order</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryBtn} onPress={handleContinueShopping}>
                    <Feather name="shopping-bag" size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.primaryBtnText}>Back to Shop</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingBottom: 20 },
    content: { flex: 1, padding: spacing.lg, alignItems: 'center' },
    successIcon: { marginTop: spacing.xl, marginBottom: spacing.xl },
    successCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8
    },
    title: { fontSize: 28, fontWeight: 'bold', color: colors.text, marginBottom: spacing.sm },
    subtitle: { fontSize: fontSize.base, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.xl },
    orderCard: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(229,231,235,0.5)'
    },
    orderHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    orderNumber: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text, marginLeft: spacing.sm },
    orderDetails: { gap: spacing.sm },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    detailLabel: { fontSize: fontSize.sm, color: colors.textMuted },
    detailValue: { fontSize: fontSize.sm, color: colors.text },
    detailValueBold: { fontSize: fontSize.base, fontWeight: 'bold', color: colors.primary },
    codBadge: {
        backgroundColor: 'rgba(16,185,129,0.1)',
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: borderRadius.sm
    },
    codBadgeText: { fontSize: fontSize.xs, color: colors.primary, fontWeight: '600' },
    divider: { height: 1, backgroundColor: 'rgba(229,231,235,0.5)', marginVertical: spacing.md },
    addressSection: {},
    addressHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
    addressLabel: { fontSize: fontSize.sm, color: colors.textMuted, marginLeft: spacing.xs },
    addressText: { fontSize: fontSize.sm, color: colors.text, lineHeight: 20 },
    phoneText: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 4 },
    deliveryCard: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16,185,129,0.1)',
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.lg
    },
    deliveryInfo: { marginLeft: spacing.md },
    deliveryTitle: { fontSize: fontSize.sm, color: colors.textMuted },
    deliveryDate: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text },
    tipCard: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: 'rgba(16,185,129,0.05)',
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(16,185,129,0.2)'
    },
    tipText: { flex: 1, fontSize: fontSize.sm, color: colors.text, marginLeft: spacing.sm, lineHeight: 20 },
    bottomSection: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f0f0f0' },
    secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: borderRadius.md, borderWidth: 2, borderColor: colors.primary },
    secondaryBtnText: { fontSize: fontSize.base, fontWeight: 'bold', color: colors.primary },
    primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: borderRadius.md, backgroundColor: colors.primary },
    primaryBtnText: { fontSize: fontSize.base, fontWeight: 'bold', color: '#fff' },
});
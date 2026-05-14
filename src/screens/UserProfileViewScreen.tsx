import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Image, ActivityIndicator, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { colors, spacing, borderRadius, fontSize } from '../theme';

interface Product {
    id: string;
    name: string;
    price: number;
    imageUrl?: string;
    image?: string;
    vendorId?: string;
    [key: string]: any;
}

export default function UserProfileViewScreen({ route, navigation }: any) {
    const { userId, userName, userPhoto, isVendorProfile } = route.params || {};
    const [profile, setProfile] = useState<{ name: string; email?: string; phone?: string; photoURL?: string; location?: string; role?: string; storeName?: string } | null>(null);
    const [vendorData, setVendorData] = useState<any>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    const isVendor = isVendorProfile === true ? true : isVendorProfile === false ? false : (profile?.role === 'vendor' || !!vendorData);

    useEffect(() => {
        const fetchProfile = async () => {
            if (!userId) {
                setLoading(false);
                return;
            }
            try {
                const userRef = doc(db, 'users', userId);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    const d = userSnap.data();
                    const isVendorUser = isVendorProfile === false ? false : (isVendorProfile === true || d.role === 'vendor');
                    setProfile({
                        name: isVendorProfile === false ? (d.name || userName || 'Customer') : (d.storeName || d.name || userName || 'Customer'),
                        email: d.email || '',
                        phone: d.phone || '',
                        photoURL: d.photoURL || d.logoUrl || userPhoto || '',
                        location: d.location || '',
                        role: d.role,
                        storeName: d.storeName,
                    });

                    if (isVendorUser) {
                        const vendorRef = doc(db, 'vendors', userId);
                        const vendorSnap = await getDoc(vendorRef);
                        if (vendorSnap.exists()) {
                            const v = vendorSnap.data();
                            setVendorData(v);
                            setProfile((p) => (p ? { ...p, photoURL: p.photoURL || v?.logoUrl, name: v?.storeName || p.name } : p));
                        }

                        const productsRef = collection(db, 'products');
                        const productsQ = query(productsRef, where('vendorId', '==', userId));
                        const productsSnap = await getDocs(productsQ);
                        const productsList: Product[] = productsSnap.docs.map((docSnap) => {
                            const p = docSnap.data();
                            return {
                                id: docSnap.id,
                                ...p,
                                name: p.name || 'Product',
                                price: p.price || 0,
                                imageUrl: p.imageUrl || p.image,
                                image: p.image || p.imageUrl,
                                vendorId: userId,
                            };
                        });
                        setProducts(productsList);
                    }
                } else {
                    setProfile({ name: userName || 'Customer', photoURL: userPhoto || '' });
                }
            } catch (e) {
                console.warn('UserProfileView: fetch error', e);
                setProfile({ name: userName || 'Customer', photoURL: userPhoto || '' });
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [userId, userName, userPhoto, isVendorProfile]);

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}><Feather name="arrow-left" size={24} color={colors.text} /></TouchableOpacity>
                    <Text style={styles.headerTitle}>Profile</Text>
                </View>
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}><Feather name="arrow-left" size={24} color={colors.text} /></TouchableOpacity>
                <Text style={styles.headerTitle}>{isVendor ? 'Store Profile' : 'Profile'}</Text>
            </View>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.content}>
                    {profile?.photoURL ? (
                        <Image source={{ uri: profile.photoURL }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatar, styles.avatarPlaceholder]}>
                            <Feather name={isVendor ? 'store' : 'user'} size={48} color={colors.textMuted} />
                        </View>
                    )}
                    <Text style={styles.name}>{profile?.name || profile?.storeName || 'Customer'}</Text>
                    {profile?.email ? (
                        <View style={styles.row}>
                            <Feather name="mail" size={18} color={colors.textMuted} style={styles.rowIcon} />
                            <Text style={styles.rowText}>{profile.email}</Text>
                        </View>
                    ) : null}
                    {profile?.phone ? (
                        <View style={styles.row}>
                            <Feather name="phone" size={18} color={colors.textMuted} style={styles.rowIcon} />
                            <Text style={styles.rowText}>{profile.phone}</Text>
                        </View>
                    ) : null}
                    {profile?.location ? (
                        <View style={styles.row}>
                            <Feather name="map-pin" size={18} color={colors.textMuted} style={styles.rowIcon} />
                            <Text style={styles.rowText}>{profile.location}</Text>
                        </View>
                    ) : null}
                </View>

                {isVendor && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Products ({products.length})</Text>
                        {products.length === 0 ? (
                            <Text style={styles.emptyText}>No products listed yet</Text>
                        ) : (
                            <View style={styles.productsGrid}>
                                {products.map((item) => (
                                    <TouchableOpacity
                                        key={item.id}
                                        style={styles.productCard}
                                        onPress={() => navigation.navigate('ProductDetail', { product: item })}
                                        activeOpacity={0.8}
                                    >
                                        <Image
                                            source={{ uri: item.imageUrl || item.image || 'https://via.placeholder.com/150' }}
                                            style={styles.productImage}
                                        />
                                        <Text numberOfLines={2} style={styles.productName}>{item.name}</Text>
                                        <Text style={styles.productPrice}>Rs. {Number(item.price).toFixed(0)}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                        <TouchableOpacity
                            style={styles.viewStoreBtn}
                            onPress={() => navigation.navigate('VendorPublicStore', { vendorId: userId, vendorName: profile?.storeName || profile?.name })}
                            activeOpacity={0.8}
                        >
                            <Feather name="shopping-bag" size={20} color="#fff" style={{ marginRight: 8 }} />
                            <Text style={styles.viewStoreText}>View Full Store</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderColor: colors.border },
    headerTitle: { flex: 1, fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text, marginLeft: spacing.md },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: spacing.xl * 2 },
    content: { padding: spacing.xl, alignItems: 'center' },
    avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: spacing.lg },
    avatarPlaceholder: { backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' },
    name: { fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text, marginBottom: spacing.xl },
    row: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', backgroundColor: colors.white, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.sm },
    rowIcon: { marginRight: spacing.md },
    rowText: { fontSize: fontSize.base, color: colors.text, flex: 1 },
    section: { marginHorizontal: spacing.lg, marginTop: spacing.lg, backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
    sectionTitle: { fontSize: fontSize.base, fontWeight: 'bold', color: colors.text, marginBottom: spacing.md },
    viewStoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, padding: spacing.md, borderRadius: borderRadius.md, marginTop: spacing.lg },
    viewStoreText: { color: '#fff', fontWeight: '600', fontSize: fontSize.base },
    emptyText: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center', padding: spacing.lg },
    productsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    productCard: { width: '48%', backgroundColor: colors.background, borderRadius: borderRadius.md, padding: spacing.sm, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
    productImage: { width: '100%', height: 120, borderRadius: borderRadius.sm, backgroundColor: colors.border, marginBottom: spacing.sm },
    productName: { fontSize: fontSize.sm, fontWeight: '500', color: colors.text, marginBottom: 4 },
    productPrice: { fontSize: fontSize.sm, fontWeight: 'bold', color: colors.primary },
});

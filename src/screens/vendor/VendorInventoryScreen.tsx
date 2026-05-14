import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, FlatList, Modal, Image, Alert, ActivityIndicator, Switch, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, borderRadius, fontSize } from '../../theme';
import { formatPrice } from '../../utils/currency';
import { auth, db } from '../../services/firebaseConfig';
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    where,
    serverTimestamp,
    onSnapshot
} from 'firebase/firestore';

const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY || '';

const PLANT_IMAGES: Record<string, string> = {
    'monstera': 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=400',
    'monstera deliciosa': 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=400',
    'fiddle leaf fig': 'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=400',
    'snake plant': 'https://images.unsplash.com/photo-1593482892540-9e4d90032a49?w=400',
    'pothos': 'https://images.unsplash.com/photo-1572688484438-313a6e50c333?w=400',
    'peace lily': 'https://images.unsplash.com/photo-1593691509543-c55fb32e2db1?w=400',
    'aloe': 'https://images.unsplash.com/photo-1567331711402-509c12c41959?w=400',
    'aloe vera': 'https://images.unsplash.com/photo-1567331711402-509c12c41959?w=400',
    'cactus': 'https://images.unsplash.com/photo-1509423350716-97f9360b4e09?w=400',
    'succulent': 'https://images.unsplash.com/photo-1509223197845-458d87a6f1a4?w=400',
    'rose': 'https://images.unsplash.com/photo-1518882605630-8c64b01ee34f?w=400',
    'orchid': 'https://images.unsplash.com/photo-1566907895970-28930f0427c5?w=400',
    'basil': 'https://images.unsplash.com/photo-1515586838455-8f8f940d6853?w=400',
    'mint': 'https://images.unsplash.com/photo-1515586838455-8f8f940d6853?w=400',
    'default': 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=400',
};

const getPlantImage = (plantName: string): string => {
    const normalizedName = plantName.toLowerCase().trim();

    if (PLANT_IMAGES[normalizedName]) return PLANT_IMAGES[normalizedName];

    const words = normalizedName.split(/\s+/);
    for (const word of words) {
        if (word.length > 2 && PLANT_IMAGES[word]) return PLANT_IMAGES[word];
    }

    for (const key of Object.keys(PLANT_IMAGES)) {
        if (key !== 'default' && (normalizedName.includes(key) || key.includes(normalizedName))) {
            return PLANT_IMAGES[key];
        }
    }

    return PLANT_IMAGES['default'];
};

interface Product {
    id: string;
    name: string;
    price: number;
    originalPrice?: number;
    stock: number;
    sold: number;
    status: string;
    category: string;
    image: string;
    images?: string[];
    description: string;
    careInfo: {
        water: string;
        light: string;
        temperature: string;
        humidity: string;
    };
    tags: string[];
    hasAR: boolean;
    shippingDays: number;
    freeShipping: boolean;
    vendorId: string;
    productType?: 'plant';
    createdAt?: any;
}

type AccessoryCategory =
    | 'Pots & Planters'
    | 'Gardening Tools'
    | 'Fertilizers'
    | 'Soil & Substrates'
    | 'Plant Stands'
    | 'Watering Tools'
    | 'Decorative Stones'
    | 'Plant Labels'
    | 'Other'
    | 'Custom';

interface Accessory {
    id: string;
    productType: 'accessory';
    name: string;
    sku: string;
    category: AccessoryCategory;
    price: number;
    originalPrice?: number;
    description: string;
    material: string;
    size: string;
    dimensions?: {
        length?: number;
        width?: number;
        height?: number;
        unit: 'cm' | 'inch';
    };
    weight?: number;
    weightUnit?: 'kg' | 'g' | 'lb';
    color?: string;
    stock: number;
    sold: number;
    status: string;
    images: string[];
    compatibleWith: string[];
    brand?: string;
    tags: string[];
    shippingDays: number;
    freeShipping: boolean;
    vendorId: string;
    createdAt?: any;
}

type InventoryProduct = Product | Accessory;

const plantCategories = ['All', 'Indoor', 'Flowers', 'Fruits', 'Vegetables', 'Herbs', 'Climbers', 'Seeds'];
const accessoryCategories: AccessoryCategory[] = [
    'Pots & Planters',
    'Gardening Tools',
    'Fertilizers',
    'Soil & Substrates',
    'Plant Stands',
    'Watering Tools',
    'Decorative Stones',
    'Plant Labels',
    'Other',
    'Custom'
];

const plantTagOptions = ['Indoor', 'Outdoor', 'Tropical', 'Air Purifying', 'Low Maintenance', 'Beginner', 'Statement Plant', 'Pet Safe', 'Trailing', 'Rare', 'Collector', 'Flowering', 'Medicinal'];
const accessoryTagOptions = ['Best Seller', 'Eco-Friendly', 'Handmade', 'Premium', 'Beginner Friendly', 'Drainage Hole', 'Self-Watering', 'Decorative', 'Durable', 'Indoor Use', 'Outdoor Use'];
const compatibilityOptions = ['Small Plants (<10cm)', 'Medium Plants (10-30cm)', 'Large Plants (>30cm)', 'Succulents', 'Tropical Plants', 'Indoor Plants', 'Outdoor Plants', 'All Plant Types'];
const materialSuggestions = ['Ceramic', 'Terracotta', 'Plastic', 'Metal', 'Wood', 'Bamboo', 'Concrete', 'Glass', 'Resin', 'Fiber', 'Stone'];

// SKU generation utility
const generateSKU = (category: AccessoryCategory): string => {
    const categoryCode = category.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 3);
    const timestamp = Date.now();
    return `ACC-${categoryCode}-${timestamp}`;
};

// Type guards
const isAccessory = (product: InventoryProduct): product is Accessory => {
    return product.productType === 'accessory';
};

const isPlant = (product: InventoryProduct): product is Product => {
    return !product.productType || product.productType === 'plant';
};

// For backwards compatibility
const categories = plantCategories;
const tagOptions = plantTagOptions;

export default function VendorInventoryScreen({ navigation }: any) {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');
    const [activeFilter, setActiveFilter] = useState('all');
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isAutoFilling, setIsAutoFilling] = useState(false);
    const [plantSuggestions, setPlantSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    const [savingProduct, setSavingProduct] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingProductId, setEditingProductId] = useState<string | null>(null);
    const [deletingProduct, setDeletingProduct] = useState(false);

    // Tab & Accessory State
    const [activeTab, setActiveTab] = useState<'plants' | 'accessories'>('plants');
    const [isEditAccessory, setIsEditAccessory] = useState(false);
    const [editingAccessoryId, setEditingAccessoryId] = useState<string | null>(null);

    const [newProduct, setNewProduct] = useState({
        name: '',
        price: '',
        originalPrice: '',
        stock: '',
        category: 'Indoor',
        description: '',
        images: [] as string[],
        careInfo: { water: '', light: '', temperature: '', humidity: '' },
        tags: [] as string[],
        hasAR: false,
        shippingDays: '3',
        freeShipping: false,
    });

    const [newAccessory, setNewAccessory] = useState({
        name: '',
        sku: '',
        category: 'Pots & Planters' as AccessoryCategory,
        customCategory: '', // For when 'Custom' is selected
        price: '',
        description: '',
        material: '',
        size: '',
        dimensions: { length: '', width: '', height: '', unit: 'cm' as const },
        weight: '',
        weightUnit: 'kg' as const,
        color: '',
        stock: '',
        images: [] as string[],
        compatibleWith: [] as string[],
        brand: '',
        tags: [] as string[],
        shippingDays: '3',
        freeShipping: false,
    });

    useEffect(() => {
        const unsubscribeAuth = auth.onAuthStateChanged((user) => {
            if (!user) {
                console.log('❌ No user logged in');
                setLoading(false);
                setProducts([]);
                return;
            }

            console.log('✅ User found:', user.uid);

            const productsRef = collection(db, 'products');
            const q = query(productsRef, where('vendorId', '==', user.uid));

            const unsubscribeProducts = onSnapshot(q,
                (snapshot) => {
                    const productsList = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    })) as Product[];

                    console.log('✅ Products loaded:', productsList.length);
                    setProducts(productsList);
                    setLoading(false);
                },
                (error) => {
                    console.error('❌ Error:', error);
                    setLoading(false);
                }
            );

            return () => unsubscribeProducts();
        });

        return () => unsubscribeAuth();
    }, []);

    const handleGetSuggestions = async () => {
        if (!newProduct.name.trim()) {
            Alert.alert('Enter Plant Name', 'Please enter a plant name first.');
            return;
        }

        setIsLoadingSuggestions(true);

        const prompt = `You are a nursery plant expert. Given the input "${newProduct.name}", determine if this is a real plant, tree, flower, herb, fruit, vegetable, seed, or any nursery/garden-related item. If it is NOT a real plant or garden item (e.g. it's a car brand, person name, random word, electronics, etc.), return exactly: ["NOT_A_PLANT"]. If it IS a valid plant/garden item, suggest exactly 5 plant names using ONLY their common/popular names (no scientific names, no Latin names, no nicknames). Return ONLY a JSON array of strings. Example: ["Money Plant", "Snake Plant", "Peace Lily", "Spider Plant", "Jade Plant"]`;

        try {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'google/gemini-2.0-flash-001',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.5
                })
            });

            const data = await response.json();
            if (data.error) {
                Alert.alert('Error', data.error.message || 'Failed to get suggestions');
                setIsLoadingSuggestions(false);
                return;
            }

            const content = data.choices[0].message.content;
            const jsonMatch = content.match(/\[[^\]]*\]/);

            if (jsonMatch) {
                const suggestions = JSON.parse(jsonMatch[0]);
                // Check if API determined it's not a plant
                if (suggestions.length === 1 && suggestions[0] === 'NOT_A_PLANT') {
                    Alert.alert(
                        'Not a Plant 🌱',
                        `"${newProduct.name}" doesn't appear to be a plant or garden item. Please enter a real plant, tree, flower, herb, fruit, or vegetable name.`
                    );
                    setIsLoadingSuggestions(false);
                    return;
                }
                setPlantSuggestions(suggestions);
                setShowSuggestions(true);
            }
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }

        setIsLoadingSuggestions(false);
    };

    const handleSelectSuggestion = async (selectedName: string) => {
        setShowSuggestions(false);
        setNewProduct(prev => ({ ...prev, name: selectedName }));
        setIsAutoFilling(true);

        const prompt = `You are a Pakistan nursery expert. Given the plant name "${selectedName}", return ONLY a valid JSON object (no markdown, no backticks) with these exact fields. Use ONLY the simple common name (no scientific name, no Latin name, no nicknames). The price must be realistic for Pakistan nurseries in PKR (Pakistani Rupees), typically between 200-5000:
{
    "name": "Simple common name only",
    "description": "2-3 sentence description focusing on the plant's appeal for home gardens",
    "category": "One of: Indoor, Flowers, Fruits, Vegetables, Herbs, Climbers, Seeds",
    "careInfo": {
        "water": "e.g. Weekly",
        "light": "e.g. Bright Indirect",
        "temperature": "e.g. 18-25°C",
        "humidity": "e.g. 40-60%"
    },
    "tags": ["3-5 tags"],
    "suggestedPrice": 500,
    "shippingDays": 3
}`;

        try {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'google/gemini-2.0-flash-001',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.3
                })
            });

            const data = await response.json();
            if (data.error) {
                Alert.alert('Error', data.error.message);
                setIsAutoFilling(false);
                return;
            }

            const content = data.choices[0].message.content;
            const jsonMatch = content.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                const plantData = JSON.parse(jsonMatch[0]);
                const autoImage = getPlantImage(selectedName);
                setNewProduct(prev => ({
                    ...prev,
                    name: plantData.name || selectedName,
                    description: plantData.description || '',
                    category: plantData.category || 'Indoor',
                    careInfo: plantData.careInfo || prev.careInfo,
                    tags: plantData.tags || [],
                    price: plantData.suggestedPrice?.toString() || prev.price,
                    shippingDays: plantData.shippingDays?.toString() || '3',
                    images: [autoImage],
                }));
                Alert.alert('✨ Auto-Fill Complete!', 'Details filled. Please review.');
            }
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }

        setIsAutoFilling(false);
    };

    const stats = {
        total: products.length,
        totalStock: products.reduce((acc, p) => acc + p.stock, 0),
        wellStock: products.filter(p => p.stock > 20).length,
        lowStock: products.filter(p => p.stock > 0 && p.stock <= 20).length,
        outOfStock: products.filter(p => p.stock === 0).length,
        totalValue: products.reduce((acc, p) => acc + (p.price * p.stock), 0),
    };

    const filteredProducts = products
        .filter(p => {
            // Filter by tab (plants vs accessories)
            if (activeTab === 'plants') return isPlant(p);
            if (activeTab === 'accessories') return isAccessory(p);
            return true;
        })
        .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
        .filter(p => activeCategory === 'All' || p.category === activeCategory)
        .filter(p => {
            if (activeFilter === 'all') return true;
            if (activeFilter === 'active') return p.stock > 20;
            if (activeFilter === 'low-stock') return p.stock > 0 && p.stock <= 20;
            if (activeFilter === 'out-of-stock') return p.stock === 0;
            return true;
        });

    const pickImage = async () => {
        if (newProduct.images.length >= 5) {
            Alert.alert('Limit Reached', 'You can add up to 5 images per product.');
            return;
        }

        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.5,
                base64: true,
            });

            if (!result.canceled && result.assets[0]) {
                const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
                setNewProduct({ ...newProduct, images: [...newProduct.images, base64Image] });
            }
        } catch (error) {
            console.error('Image error:', error);
        }
    };

    const removeImage = (index: number) => {
        setNewProduct({
            ...newProduct,
            images: newProduct.images.filter((_, i) => i !== index)
        });
    };

    const toggleTag = (tag: string) => {
        if (newProduct.tags.includes(tag)) {
            setNewProduct({ ...newProduct, tags: newProduct.tags.filter(t => t !== tag) });
        } else {
            setNewProduct({ ...newProduct, tags: [...newProduct.tags, tag] });
        }
    };

    const handleAddProduct = async () => {
        if (!newProduct.name || !newProduct.price || !newProduct.stock) {
            Alert.alert('Error', 'Please fill Name, Price, Stock');
            return;
        }

        const user = auth.currentUser;
        if (!user) {
            Alert.alert('Error', 'Please login first');
            return;
        }

        try {
            setSavingProduct(true);

            const productData = {
                name: newProduct.name,
                price: Number(newProduct.price),
                originalPrice: newProduct.originalPrice ? Number(newProduct.originalPrice) : null,
                stock: Number(newProduct.stock),
                sold: isEditMode ? undefined : 0,
                status: Number(newProduct.stock) === 0 ? 'out-of-stock' : Number(newProduct.stock) <= 20 ? 'low-stock' : 'active',
                category: newProduct.category,
                images: newProduct.images.length > 0 ? newProduct.images : [PLANT_IMAGES.default],
                image: newProduct.images.length > 0 ? newProduct.images[0] : PLANT_IMAGES.default,
                description: newProduct.description,
                careInfo: newProduct.careInfo,
                tags: newProduct.tags,
                hasAR: newProduct.hasAR,
                shippingDays: Number(newProduct.shippingDays) || 3,
                freeShipping: newProduct.freeShipping,
                vendorId: user.uid,
            };

            // Remove undefined values for update
            const cleanedData = Object.fromEntries(
                Object.entries(productData).filter(([_, v]) => v !== undefined)
            );

            if (isEditMode && editingProductId) {
                await updateDoc(doc(db, 'products', editingProductId), cleanedData);
                Alert.alert('Success! ✅', 'Product updated successfully!');
            } else {
                await addDoc(collection(db, 'products'), {
                    ...cleanedData,
                    sold: 0,
                    createdAt: serverTimestamp(),
                });
                Alert.alert('Success! 🎉', 'Product added successfully!');
            }

            resetForm();
            setShowAddModal(false);
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setSavingProduct(false);
        }
    };

    const handleEditProduct = (product: Product) => {
        setIsEditMode(true);
        setEditingProductId(product.id);
        setNewProduct({
            name: product.name,
            price: product.price.toString(),
            originalPrice: product.originalPrice?.toString() || '',
            stock: product.stock.toString(),
            category: product.category,
            description: product.description || '',
            images: product.images || (product.image ? [product.image] : []),
            careInfo: product.careInfo || { water: '', light: '', temperature: '', humidity: '' },
            tags: product.tags || [],
            hasAR: product.hasAR || false,
            shippingDays: product.shippingDays?.toString() || '3',
            freeShipping: product.freeShipping || false,
        });
        setSelectedProduct(null);
        setShowAddModal(true);
    };

    const handleEditAccessory = (product: any) => {
        setIsEditAccessory(true);
        setEditingAccessoryId(product.id);
        setActiveTab('accessories');
        setNewAccessory({
            name: product.name || '',
            sku: product.sku || '',
            category: product.category || 'Pots & Planters',
            customCategory: '',
            price: product.price?.toString() || '',
            description: product.description || '',
            material: product.material || '',
            size: product.size || '',
            dimensions: {
                length: product.dimensions?.length?.toString() || '',
                width: product.dimensions?.width?.toString() || '',
                height: product.dimensions?.height?.toString() || '',
                unit: product.dimensions?.unit || 'cm',
            },
            weight: product.weight?.toString() || '',
            weightUnit: product.weightUnit || 'kg',
            color: product.color || '',
            stock: product.stock?.toString() || '',
            images: product.images || [],
            compatibleWith: product.compatibleWith || [],
            brand: product.brand || '',
            tags: product.tags || [],
            shippingDays: product.shippingDays?.toString() || '3',
            freeShipping: product.freeShipping || false,
        });
        setSelectedProduct(null);
        setShowAddModal(true);
    };

    const handleDeleteProduct = async (productId: string) => {
        Alert.alert(
            'Delete Product',
            'Are you sure you want to delete this product? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setDeletingProduct(true);
                            await deleteDoc(doc(db, 'products', productId));
                            setSelectedProduct(null);
                            Alert.alert('Deleted', 'Product has been removed.');
                        } catch (error: any) {
                            Alert.alert('Error', 'Failed to delete product: ' + error.message);
                        } finally {
                            setDeletingProduct(false);
                        }
                    }
                }
            ]
        );
    };

    const resetForm = () => {
        setNewProduct({
            name: '', price: '', originalPrice: '', stock: '', category: 'Indoor', description: '', images: [],
            careInfo: { water: '', light: '', temperature: '', humidity: '' },
            tags: [], hasAR: false, shippingDays: '3', freeShipping: false,
        });
        setIsEditMode(false);
        setEditingProductId(null);
    };

    const handleUpdateStock = async (productId: string, delta: number) => {
        try {
            const product = products.find(p => p.id === productId);
            if (!product) return;

            const newStock = Math.max(0, product.stock + delta);
            const newStatus = newStock === 0 ? 'out-of-stock' : newStock <= 20 ? 'low-stock' : 'active';

            await updateDoc(doc(db, 'products', productId), {
                stock: newStock,
                status: newStatus
            });
        } catch (error) {
            Alert.alert('Error', 'Failed to update stock');
        }
    };

    // Accessory Functions
    const pickAccessoryImages = async () => {
        if (newAccessory.images.length >= 6) {
            Alert.alert('Limit Reached', 'You can add up to 6 images per accessory.');
            return;
        }
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.5,
                base64: true,
            });
            if (!result.canceled && result.assets[0]) {
                const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
                setNewAccessory({ ...newAccessory, images: [...newAccessory.images, base64Image] });
            }
        } catch (error) {
            console.error('Image error:', error);
        }
    };

    const removeAccessoryImage = (index: number) => {
        setNewAccessory({
            ...newAccessory,
            images: newAccessory.images.filter((_, i) => i !== index)
        });
    };

    const toggleAccessoryTag = (tag: string) => {
        if (newAccessory.tags.includes(tag)) {
            setNewAccessory({ ...newAccessory, tags: newAccessory.tags.filter(t => t !== tag) });
        } else {
            setNewAccessory({ ...newAccessory, tags: [...newAccessory.tags, tag] });
        }
    };

    const toggleCompatibility = (compat: string) => {
        if (newAccessory.compatibleWith.includes(compat)) {
            setNewAccessory({ ...newAccessory, compatibleWith: newAccessory.compatibleWith.filter(c => c !== compat) });
        } else {
            setNewAccessory({ ...newAccessory, compatibleWith: [...newAccessory.compatibleWith, compat] });
        }
    };

    const handleAddAccessory = async () => {
        // Validation
        if (!newAccessory.name.trim()) {
            Alert.alert('Error', 'Please enter accessory name');
            return;
        }
        if (!newAccessory.price || Number(newAccessory.price) <= 0) {
            Alert.alert('Error', 'Please enter a valid price');
            return;
        }
        if (!newAccessory.stock || Number(newAccessory.stock) < 0) {
            Alert.alert('Error', 'Please enter a valid stock quantity');
            return;
        }
        if (!newAccessory.material.trim()) {
            Alert.alert('Error', 'Please specify the material');
            return;
        }
        if (!newAccessory.size.trim()) {
            Alert.alert('Error', 'Please specify the size');
            return;
        }
        if (!newAccessory.description.trim()) {
            Alert.alert('Error', 'Please add a description');
            return;
        }
        if (newAccessory.images.length === 0) {
            Alert.alert('Error', 'Please add at least one image');
            return;
        }
        if (newAccessory.category === 'Custom' && !newAccessory.customCategory.trim()) {
            Alert.alert('Error', 'Please enter a custom category name');
            return;
        }

        const user = auth.currentUser;
        if (!user) {
            Alert.alert('Error', 'Please login first');
            return;
        }

        try {
            setSavingProduct(true);

            const stockNum = Number(newAccessory.stock);
            const finalCategory = newAccessory.category === 'Custom' ? newAccessory.customCategory.trim() : newAccessory.category;
            const accessoryData: any = {
                productType: 'accessory',
                name: newAccessory.name.trim(),
                sku: newAccessory.sku || generateSKU(newAccessory.category),
                category: finalCategory,
                price: Number(newAccessory.price),
                description: newAccessory.description.trim(),
                material: newAccessory.material.trim(),
                size: newAccessory.size.trim(),
                color: newAccessory.color.trim() || null,
                stock: stockNum,
                sold: 0,
                status: stockNum === 0 ? 'out-of-stock' : stockNum <= 20 ? 'low-stock' : 'active',
                images: newAccessory.images,
                compatibleWith: newAccessory.compatibleWith,
                brand: newAccessory.brand.trim() || null,
                tags: newAccessory.tags,
                shippingDays: Number(newAccessory.shippingDays) || 3,
                freeShipping: newAccessory.freeShipping,
                vendorId: user.uid,
                createdAt: serverTimestamp(),
            };

            // Add dimensions if provided
            if (newAccessory.dimensions.length || newAccessory.dimensions.width || newAccessory.dimensions.height) {
                accessoryData.dimensions = {
                    length: newAccessory.dimensions.length ? Number(newAccessory.dimensions.length) : undefined,
                    width: newAccessory.dimensions.width ? Number(newAccessory.dimensions.width) : undefined,
                    height: newAccessory.dimensions.height ? Number(newAccessory.dimensions.height) : undefined,
                    unit: newAccessory.dimensions.unit,
                };
            }

            // Add weight if provided
            if (newAccessory.weight) {
                accessoryData.weight = Number(newAccessory.weight);
                accessoryData.weightUnit = newAccessory.weightUnit;
            }

            if (isEditAccessory && editingAccessoryId) {
                // Remove createdAt and sold for update
                const { createdAt, sold, ...updateData } = accessoryData;
                await updateDoc(doc(db, 'products', editingAccessoryId), updateData);
                Alert.alert('Success! ✅', 'Accessory updated successfully!');
            } else {
                await addDoc(collection(db, 'products'), accessoryData);
                Alert.alert('Success! 🎉', 'Accessory added successfully!');
            }
            resetAccessoryForm();
            setShowAddModal(false);
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setSavingProduct(false);
        }
    };

    const resetAccessoryForm = () => {
        setNewAccessory({
            name: '',
            sku: '',
            category: 'Pots & Planters',
            customCategory: '',
            price: '',
            description: '',
            material: '',
            size: '',
            dimensions: { length: '', width: '', height: '', unit: 'cm' },
            weight: '',
            weightUnit: 'kg',
            color: '',
            stock: '',
            images: [],
            compatibleWith: [],
            brand: '',
            tags: [],
            shippingDays: '3',
            freeShipping: false,
        });
        setIsEditAccessory(false);
        setEditingAccessoryId(null);
    };

    const statusColors: any = {
        active: '#10b981',
        'low-stock': '#f59e0b',
        'out-of-stock': '#ef4444',
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={{ marginTop: 10, color: colors.textMuted }}>Loading...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Feather name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Inventory</Text>
                <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
                    <Feather name="plus" size={16} color="#fff" style={{ marginRight: 4 }} />
                    <Text style={styles.addBtnText}>Add</Text>
                </TouchableOpacity>
            </View>

            {/* Tab Switcher */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'plants' && styles.tabActive]}
                    onPress={() => { setActiveTab('plants'); setActiveCategory('All'); }}
                >
                    <Feather name="feather" size={16} color={activeTab === 'plants' ? colors.primary : colors.textMuted} />
                    <Text style={[styles.tabText, activeTab === 'plants' && styles.tabTextActive]}>Plants</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'accessories' && styles.tabActive]}
                    onPress={() => { setActiveTab('accessories'); setActiveCategory('All'); }}
                >
                    <Feather name="package" size={16} color={activeTab === 'accessories' ? colors.primary : colors.textMuted} />
                    <Text style={[styles.tabText, activeTab === 'accessories' && styles.tabTextActive]}>Accessories</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={filteredProducts}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                ListHeaderComponent={
                    <>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
                            <View style={[styles.statCard, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                                <Feather name="package" size={20} color={colors.primary} />
                                <Text style={styles.statCardValue}>{stats.total}</Text>
                                <Text style={styles.statCardLabel}>Total Products</Text>
                            </View>
                            <View style={[styles.statCard, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                                <Feather name="check-circle" size={20} color="#3b82f6" />
                                <Text style={styles.statCardValue}>{stats.wellStock}</Text>
                                <Text style={styles.statCardLabel}>Well Stocked</Text>
                            </View>
                            <View style={[styles.statCard, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                                <Feather name="alert-triangle" size={20} color="#f59e0b" />
                                <Text style={styles.statCardValue}>{stats.lowStock}</Text>
                                <Text style={styles.statCardLabel}>Low Stock</Text>
                            </View>
                            <View style={[styles.statCard, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                                <Feather name="x-circle" size={20} color="#ef4444" />
                                <Text style={styles.statCardValue}>{stats.outOfStock}</Text>
                                <Text style={styles.statCardLabel}>Out of Stock</Text>
                            </View>
                            <View style={[styles.statCard, { backgroundColor: 'rgba(139,92,246,0.1)' }]}>
                                <Feather name="dollar-sign" size={20} color="#8b5cf6" />
                                <Text style={styles.statCardValue}>{formatPrice(stats.totalValue)}</Text>
                                <Text style={styles.statCardLabel}>Total Value</Text>
                            </View>
                        </ScrollView>

                        <View style={styles.searchContainer}>
                            <Feather name="search" size={16} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search products..."
                                placeholderTextColor={colors.textMuted}
                                value={search}
                                onChangeText={setSearch}
                            />
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                            {(activeTab === 'plants' ? plantCategories : ['All', ...accessoryCategories]).map(cat => (
                                <TouchableOpacity
                                    key={cat}
                                    style={[styles.filterChip, activeCategory === cat && styles.filterChipActive]}
                                    onPress={() => setActiveCategory(cat)}
                                >
                                    <Text style={[styles.filterChipText, activeCategory === cat && styles.filterChipTextActive]}>{cat}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusFilterRow}>
                            {[
                                { key: 'all', label: 'All', count: stats.total },
                                { key: 'active', label: 'In Stock', count: stats.wellStock },
                                { key: 'low-stock', label: 'Low Stock', count: stats.lowStock },
                                { key: 'out-of-stock', label: 'Out of Stock', count: stats.outOfStock },
                            ].map(f => (
                                <TouchableOpacity
                                    key={f.key}
                                    style={[styles.statusFilterChip, activeFilter === f.key && styles.statusFilterChipActive]}
                                    onPress={() => setActiveFilter(f.key)}
                                >
                                    <Text style={[styles.statusFilterText, activeFilter === f.key && styles.statusFilterTextActive]}>
                                        {f.label} ({f.count})
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </>
                }
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.productCard} onPress={() => setSelectedProduct(item)}>
                        <Image source={{ uri: item.image || item.images?.[0] || PLANT_IMAGES.default }} style={styles.productImage} />
                        <View style={styles.productInfo}>
                            <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                            <Text style={styles.productCategory}>{item.category}</Text>
                            <View style={styles.productMeta}>
                                <Text style={styles.priceText}>{formatPrice(item.price)}</Text>
                                <Text style={styles.stockText}>Stock: {item.stock}</Text>
                                <Text style={styles.soldText}>{item.sold} sold</Text>
                            </View>
                        </View>
                        <View style={[styles.statusDot, { backgroundColor: statusColors[item.status] }]} />
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Feather name="inbox" size={48} color={colors.textMuted} />
                        <Text style={styles.emptyText}>No products found</Text>
                    </View>
                }
            />

            {/* Add Product Modal */}
            <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => { setShowAddModal(false); activeTab === 'plants' ? resetForm() : resetAccessoryForm(); }}>
                            <Feather name="x" size={24} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>
                            {activeTab === 'plants'
                                ? (isEditMode ? 'Edit Product' : 'Add New Product')
                                : (isEditAccessory ? 'Edit Accessory' : 'Add New Accessory')
                            }
                        </Text>
                        <TouchableOpacity
                            onPress={activeTab === 'plants' ? handleAddProduct : handleAddAccessory}
                            disabled={savingProduct}
                        >
                            {savingProduct ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                                <Text style={styles.saveBtn}>{activeTab === 'plants' ? (isEditMode ? 'Update' : 'Save') : (isEditAccessory ? 'Update' : 'Save')}</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
                        {activeTab === 'plants' ? (
                            <>
                                {/* Multiple Images Section */}
                                <View style={styles.formSection}>
                                    <Text style={styles.formLabel}>Product Images (up to 5)</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
                                        {newProduct.images.map((img, index) => (
                                            <View key={index} style={styles.imageThumbContainer}>
                                                <Image source={{ uri: img }} style={styles.imageThumb} />
                                                <TouchableOpacity
                                                    style={styles.removeImageBtn}
                                                    onPress={() => removeImage(index)}
                                                >
                                                    <Feather name="x" size={12} color="#fff" />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                        {newProduct.images.length < 5 && (
                                            <TouchableOpacity style={styles.addImageBtn} onPress={pickImage}>
                                                <Feather name="plus" size={24} color={colors.primary} />
                                                <Text style={styles.addImageText}>Add</Text>
                                            </TouchableOpacity>
                                        )}
                                    </ScrollView>
                                </View>

                                <View style={styles.formSection}>
                                    <Text style={styles.formLabel}>Plant Name *</Text>
                                    <View style={styles.autoFillRow}>
                                        <TextInput
                                            style={[styles.formInput, { flex: 1, marginRight: spacing.sm }]}
                                            placeholder="e.g. money, rose, cactus..."
                                            placeholderTextColor={colors.textMuted}
                                            value={newProduct.name}
                                            onChangeText={(text) => setNewProduct({ ...newProduct, name: text })}
                                        />
                                        <TouchableOpacity
                                            style={[styles.autoFillBtn, (isAutoFilling || isLoadingSuggestions) && styles.autoFillBtnDisabled]}
                                            onPress={handleGetSuggestions}
                                            disabled={isAutoFilling || isLoadingSuggestions}
                                        >
                                            {(isAutoFilling || isLoadingSuggestions) ? (
                                                <ActivityIndicator size="small" color="#fff" />
                                            ) : (
                                                <>
                                                    <Feather name="search" size={14} color="#fff" />
                                                    <Text style={styles.autoFillBtnText}>Find</Text>
                                                </>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                    <Text style={styles.autoFillHint}>🔍 Type partial name and tap Find</Text>

                                    {showSuggestions && plantSuggestions.length > 0 && (
                                        <View style={styles.suggestionsContainer}>
                                            <Text style={styles.suggestionsTitle}>Select a plant:</Text>
                                            {plantSuggestions.map((suggestion, index) => (
                                                <TouchableOpacity
                                                    key={index}
                                                    style={styles.suggestionItem}
                                                    onPress={() => handleSelectSuggestion(suggestion)}
                                                >
                                                    <Feather name="feather" size={16} color={colors.primary} />
                                                    <Text style={styles.suggestionText}>{suggestion}</Text>
                                                    <Feather name="chevron-right" size={16} color={colors.textMuted} />
                                                </TouchableOpacity>
                                            ))}
                                            <TouchableOpacity
                                                style={styles.cancelSuggestions}
                                                onPress={() => setShowSuggestions(false)}
                                            >
                                                <Text style={styles.cancelSuggestionsText}>Cancel</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>

                                <View style={styles.formSection}>
                                    <Text style={styles.formLabel}>Description</Text>
                                    <TextInput
                                        style={[styles.formInput, styles.textArea]}
                                        placeholder="Describe your plant..."
                                        placeholderTextColor={colors.textMuted}
                                        multiline
                                        numberOfLines={3}
                                        value={newProduct.description}
                                        onChangeText={(text) => setNewProduct({ ...newProduct, description: text })}
                                    />
                                </View>

                                <View style={styles.formRow}>
                                    <View style={[styles.formSection, { flex: 1, marginRight: spacing.sm }]}>
                                        <Text style={styles.formLabel}>Price (Rs.) *</Text>
                                        <TextInput
                                            style={styles.formInput}
                                            placeholder="4500"
                                            placeholderTextColor={colors.textMuted}
                                            keyboardType="numeric"
                                            value={newProduct.price}
                                            onChangeText={(text) => setNewProduct({ ...newProduct, price: text })}
                                        />
                                    </View>
                                    <View style={[styles.formSection, { flex: 1, marginRight: spacing.sm }]}>
                                        <Text style={styles.formLabel}>Original Price</Text>
                                        <TextInput
                                            style={styles.formInput}
                                            placeholder="5500"
                                            placeholderTextColor={colors.textMuted}
                                            keyboardType="numeric"
                                            value={newProduct.originalPrice}
                                            onChangeText={(text) => setNewProduct({ ...newProduct, originalPrice: text })}
                                        />
                                    </View>
                                    <View style={[styles.formSection, { flex: 1 }]}>
                                        <Text style={styles.formLabel}>Stock *</Text>
                                        <TextInput
                                            style={styles.formInput}
                                            placeholder="50"
                                            placeholderTextColor={colors.textMuted}
                                            keyboardType="numeric"
                                            value={newProduct.stock}
                                            onChangeText={(text) => setNewProduct({ ...newProduct, stock: text })}
                                        />
                                    </View>
                                </View>

                                <View style={styles.formSection}>
                                    <Text style={styles.formLabel}>Category</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                                        {categories.filter(c => c !== 'All').map(cat => (
                                            <TouchableOpacity
                                                key={cat}
                                                style={[styles.categoryChip, newProduct.category === cat && styles.categoryChipActive]}
                                                onPress={() => setNewProduct({ ...newProduct, category: cat })}
                                            >
                                                <Text style={[styles.categoryChipText, newProduct.category === cat && styles.categoryChipTextActive]}>{cat}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>

                                <View style={styles.sectionCard}>
                                    <View style={styles.sectionHeader}>
                                        <Feather name="heart" size={18} color={colors.primary} />
                                        <Text style={styles.sectionTitle}>Care Information</Text>
                                    </View>

                                    <View style={styles.careGrid}>
                                        <View style={styles.careItem}>
                                            <View style={styles.careIconRow}>
                                                <Feather name="droplet" size={16} color="#3b82f6" />
                                                <Text style={styles.careLabel}>Water</Text>
                                            </View>
                                            <TextInput
                                                style={styles.careInput}
                                                placeholder="e.g. Weekly"
                                                placeholderTextColor={colors.textMuted}
                                                value={newProduct.careInfo.water}
                                                onChangeText={(text) => setNewProduct({ ...newProduct, careInfo: { ...newProduct.careInfo, water: text } })}
                                            />
                                        </View>
                                        <View style={styles.careItem}>
                                            <View style={styles.careIconRow}>
                                                <Feather name="sun" size={16} color="#f59e0b" />
                                                <Text style={styles.careLabel}>Light</Text>
                                            </View>
                                            <TextInput
                                                style={styles.careInput}
                                                placeholder="e.g. Bright Indirect"
                                                placeholderTextColor={colors.textMuted}
                                                value={newProduct.careInfo.light}
                                                onChangeText={(text) => setNewProduct({ ...newProduct, careInfo: { ...newProduct.careInfo, light: text } })}
                                            />
                                        </View>
                                        <View style={styles.careItem}>
                                            <View style={styles.careIconRow}>
                                                <Feather name="thermometer" size={16} color="#ef4444" />
                                                <Text style={styles.careLabel}>Temperature</Text>
                                            </View>
                                            <TextInput
                                                style={styles.careInput}
                                                placeholder="e.g. 18-25°C"
                                                placeholderTextColor={colors.textMuted}
                                                value={newProduct.careInfo.temperature}
                                                onChangeText={(text) => setNewProduct({ ...newProduct, careInfo: { ...newProduct.careInfo, temperature: text } })}
                                            />
                                        </View>
                                        <View style={styles.careItem}>
                                            <View style={styles.careIconRow}>
                                                <Feather name="cloud" size={16} color="#8b5cf6" />
                                                <Text style={styles.careLabel}>Humidity</Text>
                                            </View>
                                            <TextInput
                                                style={styles.careInput}
                                                placeholder="e.g. 50-70%"
                                                placeholderTextColor={colors.textMuted}
                                                value={newProduct.careInfo.humidity}
                                                onChangeText={(text) => setNewProduct({ ...newProduct, careInfo: { ...newProduct.careInfo, humidity: text } })}
                                            />
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.formSection}>
                                    <Text style={styles.formLabel}>Tags</Text>
                                    <View style={styles.tagsContainer}>
                                        {tagOptions.map(tag => (
                                            <TouchableOpacity
                                                key={tag}
                                                style={[styles.tagChip, newProduct.tags.includes(tag) && styles.tagChipActive]}
                                                onPress={() => toggleTag(tag)}
                                            >
                                                <Text style={[styles.tagChipText, newProduct.tags.includes(tag) && styles.tagChipTextActive]}>{tag}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                <View style={styles.sectionCard}>
                                    <View style={styles.sectionHeader}>
                                        <Feather name="truck" size={18} color={colors.primary} />
                                        <Text style={styles.sectionTitle}>Shipping & Options</Text>
                                    </View>

                                    <View style={styles.optionRow}>
                                        <View style={styles.optionLeft}>
                                            <Feather name="calendar" size={16} color={colors.textMuted} />
                                            <Text style={styles.optionLabel}>Shipping Days</Text>
                                        </View>
                                        <TextInput
                                            style={styles.smallInput}
                                            placeholder="3"
                                            placeholderTextColor={colors.textMuted}
                                            keyboardType="numeric"
                                            value={newProduct.shippingDays}
                                            onChangeText={(text) => setNewProduct({ ...newProduct, shippingDays: text })}
                                        />
                                    </View>

                                    <View style={styles.optionRow}>
                                        <View style={styles.optionLeft}>
                                            <Feather name="gift" size={16} color={colors.textMuted} />
                                            <Text style={styles.optionLabel}>Free Shipping</Text>
                                        </View>
                                        <Switch
                                            value={newProduct.freeShipping}
                                            onValueChange={(value) => setNewProduct({ ...newProduct, freeShipping: value })}
                                            trackColor={{ false: colors.border, true: colors.primary }}
                                            thumbColor="#fff"
                                        />
                                    </View>


                                </View>
                                <View style={{ height: 40 }} />
                            </>
                        ) : (
                            <>
                                {/* ACCESSORY FORM */}
                                <View style={styles.formSection}>
                                    <Text style={styles.formLabel}>Accessory Images (1-6) *</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
                                        {newAccessory.images.map((img, index) => (
                                            <View key={index} style={styles.imageThumbContainer}>
                                                <Image source={{ uri: img }} style={styles.imageThumb} />
                                                <TouchableOpacity
                                                    style={styles.removeImageBtn}
                                                    onPress={() => removeAccessoryImage(index)}
                                                >
                                                    <Feather name="x" size={12} color="#fff" />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                        {newAccessory.images.length < 6 && (
                                            <TouchableOpacity style={styles.addImageBtn} onPress={pickAccessoryImages}>
                                                <Feather name="plus" size={24} color={colors.primary} />
                                                <Text style={styles.addImageText}>Add</Text>
                                            </TouchableOpacity>
                                        )}
                                    </ScrollView>
                                </View>

                                <View style={styles.formSection}>
                                    <Text style={styles.formLabel}>Accessory Name *</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        placeholder="e.g. Ceramic Pot, Watering Can..."
                                        placeholderTextColor={colors.textMuted}
                                        value={newAccessory.name}
                                        onChangeText={(text) => setNewAccessory({ ...newAccessory, name: text })}
                                    />
                                </View>

                                <View style={styles.formRow}>
                                    <View style={[styles.formSection, { flex: 1, marginRight: spacing.sm }]}>
                                        <Text style={styles.formLabel}>SKU (auto-generated)</Text>
                                        <TextInput
                                            style={[styles.formInput, { backgroundColor: '#f3f4f6' }]}
                                            placeholder="Will be auto-generated"
                                            placeholderTextColor={colors.textMuted}
                                            value={newAccessory.sku || generateSKU(newAccessory.category)}
                                            onChangeText={(text) => setNewAccessory({ ...newAccessory, sku: text })}
                                        />
                                    </View>
                                    <View style={[styles.formSection, { flex: 1 }]}>
                                        <Text style={styles.formLabel}>Brand</Text>
                                        <TextInput
                                            style={styles.formInput}
                                            placeholder="Optional"
                                            placeholderTextColor={colors.textMuted}
                                            value={newAccessory.brand}
                                            onChangeText={(text) => setNewAccessory({ ...newAccessory, brand: text })}
                                        />
                                    </View>
                                </View>

                                <View style={styles.formSection}>
                                    <Text style={styles.formLabel}>Category *</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                                        {accessoryCategories.map(cat => (
                                            <TouchableOpacity
                                                key={cat}
                                                style={[styles.categoryChip, newAccessory.category === cat && styles.categoryChipActive]}
                                                onPress={() => setNewAccessory({ ...newAccessory, category: cat })}
                                            >
                                                <Text style={[styles.categoryChipText, newAccessory.category === cat && styles.categoryChipTextActive]}>{cat}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>

                                {newAccessory.category === 'Custom' && (
                                    <View style={styles.formSection}>
                                        <Text style={styles.formLabel}>Custom Category Name *</Text>
                                        <TextInput
                                            style={styles.formInput}
                                            placeholder="Enter your category name..."
                                            placeholderTextColor={colors.textMuted}
                                            value={newAccessory.customCategory}
                                            onChangeText={(text) => setNewAccessory({ ...newAccessory, customCategory: text })}
                                        />
                                    </View>
                                )}

                                <View style={styles.formRow}>
                                    <View style={[styles.formSection, { flex: 1, marginRight: spacing.sm }]}>
                                        <Text style={styles.formLabel}>Price (Rs.) *</Text>
                                        <TextInput
                                            style={styles.formInput}
                                            placeholder="2500"
                                            placeholderTextColor={colors.textMuted}
                                            keyboardType="numeric"
                                            value={newAccessory.price}
                                            onChangeText={(text) => setNewAccessory({ ...newAccessory, price: text })}
                                        />
                                    </View>
                                    <View style={[styles.formSection, { flex: 1 }]}>
                                        <Text style={styles.formLabel}>Stock *</Text>
                                        <TextInput
                                            style={styles.formInput}
                                            placeholder="20"
                                            placeholderTextColor={colors.textMuted}
                                            keyboardType="numeric"
                                            value={newAccessory.stock}
                                            onChangeText={(text) => setNewAccessory({ ...newAccessory, stock: text })}
                                        />
                                    </View>
                                </View>

                                <View style={styles.formSection}>
                                    <Text style={styles.formLabel}>Description *</Text>
                                    <TextInput
                                        style={[styles.formInput, styles.textArea]}
                                        placeholder="Describe the accessory..."
                                        placeholderTextColor={colors.textMuted}
                                        multiline
                                        numberOfLines={3}
                                        value={newAccessory.description}
                                        onChangeText={(text) => setNewAccessory({ ...newAccessory, description: text })}
                                    />
                                </View>

                                <View style={styles.formRow}>
                                    <View style={[styles.formSection, { flex: 1, marginRight: spacing.sm }]}>
                                        <Text style={styles.formLabel}>Material *</Text>
                                        <TextInput
                                            style={styles.formInput}
                                            placeholder="e.g. Ceramic, Plastic..."
                                            placeholderTextColor={colors.textMuted}
                                            value={newAccessory.material}
                                            onChangeText={(text) => setNewAccessory({ ...newAccessory, material: text })}
                                        />
                                    </View>
                                    <View style={[styles.formSection, { flex: 1 }]}>
                                        <Text style={styles.formLabel}>Size *</Text>
                                        <TextInput
                                            style={styles.formInput}
                                            placeholder="e.g. Small, 10cm..."
                                            placeholderTextColor={colors.textMuted}
                                            value={newAccessory.size}
                                            onChangeText={(text) => setNewAccessory({ ...newAccessory, size: text })}
                                        />
                                    </View>
                                </View>

                                <View style={styles.formSection}>
                                    <Text style={styles.formLabel}>Dimensions (Optional)</Text>
                                    <View style={styles.formRow}>
                                        <TextInput
                                            style={[styles.formInput, { flex: 1, marginRight: spacing.sm }]}
                                            placeholder="L"
                                            placeholderTextColor={colors.textMuted}
                                            keyboardType="numeric"
                                            value={newAccessory.dimensions.length}
                                            onChangeText={(text) => setNewAccessory({ ...newAccessory, dimensions: { ...newAccessory.dimensions, length: text } })}
                                        />
                                        <TextInput
                                            style={[styles.formInput, { flex: 1, marginRight: spacing.sm }]}
                                            placeholder="W"
                                            placeholderTextColor={colors.textMuted}
                                            keyboardType="numeric"
                                            value={newAccessory.dimensions.width}
                                            onChangeText={(text) => setNewAccessory({ ...newAccessory, dimensions: { ...newAccessory.dimensions, width: text } })}
                                        />
                                        <TextInput
                                            style={[styles.formInput, { flex: 1, marginRight: spacing.sm }]}
                                            placeholder="H"
                                            placeholderTextColor={colors.textMuted}
                                            keyboardType="numeric"
                                            value={newAccessory.dimensions.height}
                                            onChangeText={(text) => setNewAccessory({ ...newAccessory, dimensions: { ...newAccessory.dimensions, height: text } })}
                                        />
                                        <TouchableOpacity
                                            style={[styles.smallInput, { width: 60 }]}
                                            onPress={() => setNewAccessory({ ...newAccessory, dimensions: { ...newAccessory.dimensions, unit: newAccessory.dimensions.unit === 'cm' ? 'inch' : 'cm' } })}
                                        >
                                            <Text style={{ color: colors.text, textAlign: 'center' }}>{newAccessory.dimensions.unit}</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View style={styles.formRow}>
                                    <View style={[styles.formSection, { flex: 1, marginRight: spacing.sm }]}>
                                        <Text style={styles.formLabel}>Weight (Optional)</Text>
                                        <TextInput
                                            style={styles.formInput}
                                            placeholder="Enter weight"
                                            placeholderTextColor={colors.textMuted}
                                            keyboardType="numeric"
                                            value={newAccessory.weight}
                                            onChangeText={(text) => setNewAccessory({ ...newAccessory, weight: text })}
                                        />
                                    </View>
                                    <View style={[styles.formSection, { flex: 1 }]}>
                                        <Text style={styles.formLabel}>Color</Text>
                                        <TextInput
                                            style={styles.formInput}
                                            placeholder="e.g. White, Brown..."
                                            placeholderTextColor={colors.textMuted}
                                            value={newAccessory.color}
                                            onChangeText={(text) => setNewAccessory({ ...newAccessory, color: text })}
                                        />
                                    </View>
                                </View>

                                <View style={styles.formSection}>
                                    <Text style={styles.formLabel}>Compatible With</Text>
                                    <View style={styles.tagsContainer}>
                                        {compatibilityOptions.map(opt => (
                                            <TouchableOpacity
                                                key={opt}
                                                style={[styles.tagChip, newAccessory.compatibleWith.includes(opt) && styles.tagChipActive]}
                                                onPress={() => toggleCompatibility(opt)}
                                            >
                                                <Text style={[styles.tagChipText, newAccessory.compatibleWith.includes(opt) && styles.tagChipTextActive]}>{opt}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                <View style={styles.formSection}>
                                    <Text style={styles.formLabel}>Tags</Text>
                                    <View style={styles.tagsContainer}>
                                        {accessoryTagOptions.map(tag => (
                                            <TouchableOpacity
                                                key={tag}
                                                style={[styles.tagChip, newAccessory.tags.includes(tag) && styles.tagChipActive]}
                                                onPress={() => toggleAccessoryTag(tag)}
                                            >
                                                <Text style={[styles.tagChipText, newAccessory.tags.includes(tag) && styles.tagChipTextActive]}>{tag}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                <View style={styles.sectionCard}>
                                    <View style={styles.sectionHeader}>
                                        <Feather name="truck" size={18} color={colors.primary} />
                                        <Text style={styles.sectionTitle}>Shipping</Text>
                                    </View>

                                    <View style={styles.optionRow}>
                                        <View style={styles.optionLeft}>
                                            <Feather name="calendar" size={16} color={colors.textMuted} />
                                            <Text style={styles.optionLabel}>Shipping Days</Text>
                                        </View>
                                        <TextInput
                                            style={styles.smallInput}
                                            placeholder="3"
                                            placeholderTextColor={colors.textMuted}
                                            keyboardType="numeric"
                                            value={newAccessory.shippingDays}
                                            onChangeText={(text) => setNewAccessory({ ...newAccessory, shippingDays: text })}
                                        />
                                    </View>

                                    <View style={styles.optionRow}>
                                        <View style={styles.optionLeft}>
                                            <Feather name="gift" size={16} color={colors.textMuted} />
                                            <Text style={styles.optionLabel}>Free Shipping</Text>
                                        </View>
                                        <Switch
                                            value={newAccessory.freeShipping}
                                            onValueChange={(value) => setNewAccessory({ ...newAccessory, freeShipping: value })}
                                            trackColor={{ false: colors.border, true: colors.primary }}
                                            thumbColor="#fff"
                                        />
                                    </View>
                                </View>

                                <View style={{ height: 40 }} />
                            </>
                        )}
                    </ScrollView>
                </SafeAreaView>
            </Modal>

            {/* Product Detail Modal */}
            <Modal visible={!!selectedProduct} animationType="slide" presentationStyle="pageSheet">
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setSelectedProduct(null)}>
                            <Feather name="x" size={24} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Product Details</Text>
                        <View style={{ width: 24 }} />
                    </View>

                    {selectedProduct && (
                        <ScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: 40 }}>
                            <Image source={{ uri: selectedProduct.image || selectedProduct.images?.[0] || PLANT_IMAGES.default }} style={styles.productDetailImage} />

                            <View style={styles.productDetailInfo}>
                                <View style={styles.productDetailHeader}>
                                    <Text style={styles.productDetailName}>{selectedProduct.name}</Text>
                                    <View style={[styles.statusBadge, { backgroundColor: statusColors[selectedProduct.status] + '20' }]}>
                                        <Text style={[styles.statusText, { color: statusColors[selectedProduct.status] }]}>
                                            {selectedProduct.status.replace('-', ' ')}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.priceRow}>
                                    <Text style={styles.productDetailPrice}>{formatPrice(selectedProduct.price)}</Text>
                                    {selectedProduct.originalPrice && (
                                        <Text style={styles.originalPriceText}>{formatPrice(selectedProduct.originalPrice)}</Text>
                                    )}
                                </View>

                                {selectedProduct.description ? (
                                    <Text style={styles.productDetailDesc}>{selectedProduct.description}</Text>
                                ) : (
                                    <Text style={[styles.productDetailDesc, { fontStyle: 'italic', color: colors.textMuted }]}>No description available</Text>
                                )}

                                {isAccessory(selectedProduct as InventoryProduct) ? (
                                    <View style={styles.careInfoCard}>
                                        <Text style={styles.careInfoTitle}>Accessory Details</Text>
                                        <View style={styles.careInfoGrid}>
                                            {(selectedProduct as any).material && (
                                                <View style={styles.careInfoItem}>
                                                    <Feather name="layers" size={14} color="#3b82f6" />
                                                    <Text style={styles.careInfoValue}>{(selectedProduct as any).material}</Text>
                                                </View>
                                            )}
                                            {(selectedProduct as any).size && (
                                                <View style={styles.careInfoItem}>
                                                    <Feather name="maximize-2" size={14} color="#f59e0b" />
                                                    <Text style={styles.careInfoValue}>{(selectedProduct as any).size}</Text>
                                                </View>
                                            )}
                                            {(selectedProduct as any).color && (
                                                <View style={styles.careInfoItem}>
                                                    <Feather name="circle" size={14} color="#8b5cf6" />
                                                    <Text style={styles.careInfoValue}>{(selectedProduct as any).color}</Text>
                                                </View>
                                            )}
                                            {(selectedProduct as any).brand && (
                                                <View style={styles.careInfoItem}>
                                                    <Feather name="tag" size={14} color="#ef4444" />
                                                    <Text style={styles.careInfoValue}>{(selectedProduct as any).brand}</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                ) : selectedProduct.careInfo && (selectedProduct.careInfo.water || selectedProduct.careInfo.light || selectedProduct.careInfo.temperature || selectedProduct.careInfo.humidity) ? (
                                    <View style={styles.careInfoCard}>
                                        <Text style={styles.careInfoTitle}>Care Information</Text>
                                        <View style={styles.careInfoGrid}>
                                            {selectedProduct.careInfo.water && (
                                                <View style={styles.careInfoItem}>
                                                    <Feather name="droplet" size={14} color="#3b82f6" />
                                                    <Text style={styles.careInfoValue}>{selectedProduct.careInfo.water}</Text>
                                                </View>
                                            )}
                                            {selectedProduct.careInfo.light && (
                                                <View style={styles.careInfoItem}>
                                                    <Feather name="sun" size={14} color="#f59e0b" />
                                                    <Text style={styles.careInfoValue}>{selectedProduct.careInfo.light}</Text>
                                                </View>
                                            )}
                                            {selectedProduct.careInfo.temperature && (
                                                <View style={styles.careInfoItem}>
                                                    <Feather name="thermometer" size={14} color="#ef4444" />
                                                    <Text style={styles.careInfoValue}>{selectedProduct.careInfo.temperature}</Text>
                                                </View>
                                            )}
                                            {selectedProduct.careInfo.humidity && (
                                                <View style={styles.careInfoItem}>
                                                    <Feather name="cloud" size={14} color="#8b5cf6" />
                                                    <Text style={styles.careInfoValue}>{selectedProduct.careInfo.humidity}</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                ) : (
                                    <View style={styles.careInfoCard}>
                                        <Text style={styles.careInfoTitle}>Care Information</Text>
                                        <Text style={{ color: colors.textMuted, fontStyle: 'italic', fontSize: fontSize.sm }}>No care information available</Text>
                                    </View>
                                )}

                                {selectedProduct.tags && selectedProduct.tags.length > 0 ? (
                                    <View style={styles.tagsRow}>
                                        {selectedProduct.tags.map((tag, i) => (
                                            <View key={i} style={styles.detailTag}>
                                                <Text style={styles.detailTagText}>{tag}</Text>
                                            </View>
                                        ))}
                                    </View>
                                ) : null}

                                <View style={styles.statsGrid}>
                                    <View style={styles.statBox}>
                                        <Text style={styles.statBoxValue}>{selectedProduct.stock}</Text>
                                        <Text style={styles.statBoxLabel}>In Stock</Text>
                                    </View>
                                    <View style={styles.statBox}>
                                        <Text style={styles.statBoxValue}>{selectedProduct.sold}</Text>
                                        <Text style={styles.statBoxLabel}>Sold</Text>
                                    </View>
                                    <View style={styles.statBox}>
                                        <Text style={styles.statBoxValue}>{formatPrice(selectedProduct.price * selectedProduct.stock)}</Text>
                                        <Text style={styles.statBoxLabel}>Value</Text>
                                    </View>
                                </View>

                                <View style={styles.stockControls}>
                                    <Text style={styles.stockControlLabel}>Adjust Stock</Text>
                                    <View style={styles.stockButtons}>
                                        <TouchableOpacity style={styles.stockBtn} onPress={() => handleUpdateStock(selectedProduct.id, -10)}>
                                            <Text style={styles.stockBtnText}>-10</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.stockBtn} onPress={() => handleUpdateStock(selectedProduct.id, -1)}>
                                            <Text style={styles.stockBtnText}>-1</Text>
                                        </TouchableOpacity>
                                        <View style={styles.stockDisplay}>
                                            <Text style={styles.stockDisplayText}>{selectedProduct.stock}</Text>
                                        </View>
                                        <TouchableOpacity style={[styles.stockBtn, styles.stockBtnAdd]} onPress={() => handleUpdateStock(selectedProduct.id, 1)}>
                                            <Text style={[styles.stockBtnText, styles.stockBtnAddText]}>+1</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.stockBtn, styles.stockBtnAdd]} onPress={() => handleUpdateStock(selectedProduct.id, 10)}>
                                            <Text style={[styles.stockBtnText, styles.stockBtnAddText]}>+10</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Edit & Delete Actions */}
                                <View style={styles.productActions}>
                                    <TouchableOpacity
                                        style={styles.editProductBtn}
                                        onPress={() => isAccessory(selectedProduct as InventoryProduct) ? handleEditAccessory(selectedProduct) : handleEditProduct(selectedProduct)}
                                    >
                                        <Feather name="edit-2" size={18} color="#fff" />
                                        <Text style={styles.editProductBtnText}>Edit {isAccessory(selectedProduct as InventoryProduct) ? 'Accessory' : 'Product'}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.deleteProductBtn}
                                        onPress={() => handleDeleteProduct(selectedProduct.id)}
                                        disabled={deletingProduct}
                                    >
                                        {deletingProduct ? (
                                            <ActivityIndicator size="small" color="#ef4444" />
                                        ) : (
                                            <>
                                                <Feather name="trash-2" size={18} color="#ef4444" />
                                                <Text style={styles.deleteProductBtnText}>Delete</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </ScrollView>
                    )}
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg },
    title: { flex: 1, fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text, marginLeft: spacing.md },
    addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md },
    addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: fontSize.sm },
    tabContainer: { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: spacing.lg, marginBottom: spacing.md, borderRadius: borderRadius.lg, padding: 4, gap: spacing.xs },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm, borderRadius: borderRadius.md, gap: spacing.xs },
    tabActive: { backgroundColor: colors.primary },
    tabText: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: '600' },
    tabTextActive: { color: '#fff' },
    statsRow: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
    statCard: { padding: spacing.md, borderRadius: borderRadius.lg, minWidth: 100, height: 80, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
    statCardValue: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text, marginTop: 4 },
    statCardLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2, textAlign: 'center' },
    searchContainer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, backgroundColor: '#fff', borderRadius: borderRadius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)', marginBottom: spacing.md },
    searchInput: { flex: 1, height: 44, fontSize: fontSize.base, color: colors.text },
    filterRow: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, height: 44 },
    filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', marginRight: spacing.sm, borderWidth: 1, borderColor: colors.border, height: 36, justifyContent: 'center' },
    filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterChipText: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
    filterChipTextActive: { color: '#fff', fontWeight: '600' },
    statusFilterRow: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, height: 44 },
    statusFilterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', marginRight: spacing.sm, borderWidth: 1, borderColor: colors.border, height: 36, justifyContent: 'center' },
    statusFilterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    statusFilterText: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
    statusFilterTextActive: { color: '#fff', fontWeight: '600' },
    list: { padding: spacing.lg, paddingTop: 0, paddingBottom: 100 },
    productCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: spacing.sm, borderRadius: borderRadius.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    productImage: { width: 64, height: 64, borderRadius: borderRadius.md, backgroundColor: colors.border },
    productInfo: { flex: 1, marginLeft: spacing.md },
    productName: { fontSize: fontSize.base, fontWeight: 'bold', color: colors.text },
    productCategory: { fontSize: fontSize.xs, color: colors.primary, marginTop: 2 },
    productMeta: { flexDirection: 'row', marginTop: 4, gap: spacing.md },
    priceText: { fontSize: fontSize.sm, color: colors.text, fontWeight: 'bold' },
    stockText: { fontSize: fontSize.xs, color: colors.textMuted },
    soldText: { fontSize: fontSize.xs, color: colors.textMuted },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    emptyState: { alignItems: 'center', padding: spacing.xl, paddingTop: spacing.xl * 2 },
    emptyText: { fontSize: fontSize.base, color: colors.text, marginTop: spacing.md, fontWeight: '600' },
    modalContainer: { flex: 1, backgroundColor: colors.background },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTitle: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text },
    modalContent: { flex: 1, padding: spacing.lg },
    saveBtn: { color: colors.primary, fontSize: fontSize.base, fontWeight: 'bold' },
    imagePicker: { height: 180, backgroundColor: '#fff', borderRadius: borderRadius.xl, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', marginBottom: spacing.lg },
    pickedImage: { width: '100%', height: '100%', borderRadius: borderRadius.xl },
    imagePickerText: { color: colors.textMuted, marginTop: spacing.sm },
    formSection: { marginBottom: spacing.md },
    formLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
    formInput: { backgroundColor: '#fff', borderRadius: borderRadius.md, padding: spacing.md, fontSize: fontSize.base, borderWidth: 1, borderColor: colors.border, color: colors.text },
    formRow: { flexDirection: 'row' },
    textArea: { height: 80, textAlignVertical: 'top' },
    autoFillRow: { flexDirection: 'row', alignItems: 'center' },
    autoFillBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#8b5cf6', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderRadius: borderRadius.md, gap: 4 },
    autoFillBtnDisabled: { backgroundColor: '#c4b5fd' },
    autoFillBtnText: { color: '#fff', fontWeight: 'bold', fontSize: fontSize.sm },
    autoFillHint: { fontSize: 11, color: '#8b5cf6', marginTop: spacing.xs },
    categoryScroll: { marginTop: spacing.xs },
    categoryChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: 'rgba(243,244,246,0.8)', marginRight: spacing.sm },
    categoryChipActive: { backgroundColor: colors.primary },
    categoryChipText: { fontSize: fontSize.sm, color: colors.textMuted },
    categoryChipTextActive: { color: '#fff' },
    sectionCard: { backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, gap: spacing.sm },
    sectionTitle: { fontSize: fontSize.base, fontWeight: 'bold', color: colors.text },
    careGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    careItem: { width: '48%' },
    careIconRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 4 },
    careLabel: { fontSize: fontSize.xs, color: colors.textMuted },
    careInput: { backgroundColor: 'rgba(243,244,246,0.8)', borderRadius: borderRadius.md, padding: spacing.sm, fontSize: fontSize.sm, color: colors.text },
    tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    tagChip: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: borderRadius.full, backgroundColor: 'rgba(243,244,246,0.8)', marginBottom: 4 },
    tagChipActive: { backgroundColor: colors.primary },
    tagChipText: { fontSize: 12, color: colors.textMuted },
    tagChipTextActive: { color: '#fff' },
    optionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: 'rgba(229,231,235,0.5)' },
    optionLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    optionLabel: { fontSize: fontSize.sm, color: colors.text },
    smallInput: { width: 60, backgroundColor: 'rgba(243,244,246,0.8)', borderRadius: borderRadius.md, padding: spacing.sm, fontSize: fontSize.sm, color: colors.text, textAlign: 'center' },
    productDetailImage: { width: '100%', height: 250, borderRadius: borderRadius.xl, backgroundColor: colors.border },
    productDetailInfo: { marginTop: spacing.lg },
    productDetailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    productDetailName: { fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text, flex: 1 },
    statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.sm },
    statusText: { fontSize: fontSize.xs, fontWeight: '600', textTransform: 'capitalize' },
    priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
    productDetailPrice: { fontSize: fontSize['2xl'], fontWeight: 'bold', color: colors.primary },
    originalPriceText: { fontSize: fontSize.base, color: colors.textMuted, textDecorationLine: 'line-through' },
    productDetailDesc: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 22 },
    careInfoCard: { backgroundColor: 'rgba(243,244,246,0.5)', borderRadius: borderRadius.lg, padding: spacing.md, marginTop: spacing.md },
    careInfoTitle: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
    careInfoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    careInfoItem: { flexDirection: 'row', alignItems: 'center', gap: 4, width: '48%' },
    careInfoValue: { fontSize: fontSize.xs, color: colors.text },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
    detailTag: { backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.sm },
    detailTagText: { fontSize: 11, color: colors.primary, fontWeight: '500' },
    statsGrid: { flexDirection: 'row', marginTop: spacing.lg, gap: spacing.md },
    statBox: { flex: 1, backgroundColor: '#fff', padding: spacing.md, borderRadius: borderRadius.lg, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    statBoxValue: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text },
    statBoxLabel: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
    stockControls: { marginTop: spacing.lg, backgroundColor: '#fff', padding: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border },
    stockControlLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
    stockButtons: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
    stockBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(243,244,246,0.8)', justifyContent: 'center', alignItems: 'center' },
    stockBtnAdd: { backgroundColor: 'rgba(16,185,129,0.1)' },
    stockBtnText: { fontSize: fontSize.base, fontWeight: 'bold', color: colors.text },
    stockBtnAddText: { color: colors.primary },
    stockDisplay: { width: 60, height: 44, backgroundColor: colors.primary, borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center' },
    stockDisplayText: { fontSize: fontSize.lg, fontWeight: 'bold', color: '#fff' },
    suggestionsContainer: { marginTop: spacing.md, backgroundColor: '#fff', borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.primary, overflow: 'hidden' },
    suggestionsTitle: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, padding: spacing.md, backgroundColor: 'rgba(139,92,246,0.1)', borderBottomWidth: 1, borderBottomColor: colors.border },
    suggestionItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: 'rgba(229,231,235,0.5)', gap: spacing.sm },
    suggestionText: { flex: 1, fontSize: fontSize.base, color: colors.text },
    cancelSuggestions: { padding: spacing.md, alignItems: 'center', backgroundColor: 'rgba(243,244,246,0.5)' },
    cancelSuggestionsText: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: '500' },
    // Multiple Images Styles
    imageThumbContainer: { position: 'relative', width: 80, height: 80 },
    imageThumb: { width: 80, height: 80, borderRadius: borderRadius.md, backgroundColor: colors.border },
    removeImageBtn: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
    addImageBtn: { width: 80, height: 80, borderRadius: borderRadius.md, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.primary, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.05)' },
    addImageText: { fontSize: fontSize.xs, color: colors.primary, marginTop: 4, fontWeight: '600' },
    // Product Actions Styles
    productActions: { flexDirection: 'row', marginTop: spacing.lg, gap: spacing.md },
    editProductBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, padding: spacing.md, borderRadius: borderRadius.md, gap: spacing.sm },
    editProductBtnText: { color: '#fff', fontWeight: '600', fontSize: fontSize.sm },
    deleteProductBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(239,68,68,0.1)', padding: spacing.md, borderRadius: borderRadius.md, gap: spacing.sm, borderWidth: 1, borderColor: '#ef4444' },
    deleteProductBtnText: { color: '#ef4444', fontWeight: '600', fontSize: fontSize.sm },
});
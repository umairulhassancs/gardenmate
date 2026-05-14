import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, ActivityIndicator, Alert, AppState } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../services/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import * as Notifications from 'expo-notifications';

import { updateUserPushToken } from '../services/NotificationService';
import { initializePresence, cleanupPresence } from '../services/presenceService';

// Consumer Screens
import OnboardingScreen from '../screens/OnboardingScreen';
import AuthScreen from '../screens/AuthScreen';
import HomeScreen from '../screens/HomeScreen';
import MyPlantsScreen from '../screens/MyPlantsScreen';
import PlantDetailScreen from '../screens/PlantDetailScreen';
import AddPlantScreen from '../screens/AddPlantScreen';
import ProfileScreen from '../screens/ProfileScreen';
import MarketplaceScreen from '../screens/MarketplaceScreen';
import CommunityScreen from '../screens/CommunityScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import ARViewScreen from '../screens/ARViewScreen';
import ImageSearchScreen from '../screens/ImageSearchScreen';
import VendorPublicStoreScreen from '../screens/VendorPublicStoreScreen';
import ChatScreen from '../screens/ChatScreen';
import ChatListScreen from '../screens/ChatListScreen';
import FeedbackScreen from '../screens/FeedbackScreen';
import CartScreen from '../screens/CartScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import OrderConfirmationScreen from '../screens/OrderConfirmationScreen';
import WishlistScreen from '../screens/WishlistScreen';
import ShippingAddressesScreen from '../screens/ShippingAddressesScreen';
import OrderHistoryScreen from '../screens/OrderHistoryScreen';
import AccountDetailsScreen from '../screens/AccountDetailsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import TermsOfServiceScreen from '../screens/TermsOfServiceScreen';
import HelpSupportScreen from '../screens/HelpSupportScreen';
import NotFoundScreen from '../screens/NotFoundScreen';
import TasksScreen from '../screens/TasksScreen';
import MyTicketsScreen from '../screens/MyTicketsScreen';
import CreateTicketScreen from '../screens/CreateTicketScreen';
import TicketDetailScreen from '../screens/TicketDetailScreen';
import UserProfileViewScreen from '../screens/UserProfileViewScreen';

// Admin Screens
import AdminLoginScreen from '../screens/admin/AdminLoginScreen';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import AdminUsersScreen from '../screens/admin/AdminUsersScreen';
import AdminVendorsScreen from '../screens/admin/AdminVendorsScreen';
import AdminPlantsScreen from '../screens/admin/AdminPlantsScreen';
import AdminComplaintsScreen from '../screens/admin/AdminComplaintsScreen';
import AdminTicketDetailScreen from '../screens/admin/AdminTicketDetailScreen';
import TicketAnalyticsScreen from '../screens/admin/TicketAnalyticsScreen';
import AdminCommunityScreen from '../screens/admin/AdminCommunityScreen';
import AdminMoreScreen from '../screens/admin/AdminMoreScreen';
import AdminNotificationsScreen from '../screens/admin/AdminNotificationsScreen';

// Vendor Screens
import VendorLoginScreen from '../screens/vendor/VendorLoginScreen';
import VendorDashboardScreen from '../screens/vendor/VendorDashboardScreen';
import VendorOrdersScreen from '../screens/vendor/VendorOrdersScreen';
import VendorInventoryScreen from '../screens/vendor/VendorInventoryScreen';
import VendorPayoutsScreen from '../screens/vendor/VendorPayoutsScreen';
import VendorReportsScreen from '../screens/vendor/VendorReportsScreen';
import VendorReviewsScreen from '../screens/vendor/VendorReviewsScreen';
import VendorSettingsScreen from '../screens/vendor/VendorSettingsScreen';
import VendorStoreProfileScreen from '../screens/vendor/VendorStoreProfileScreen';
import VendorComplaintsScreen from '../screens/vendor/VendorComplaintsScreen';
import VendorNotificationsScreen from '../screens/vendor/VendorNotificationsScreen';
import VendorCommunityScreen from '../screens/vendor/VendorCommunityScreen';
import VendorChatsScreen from '../screens/vendor/VendorChatsScreen';
import VendorChatDetailScreen from '../screens/vendor/VendorChatDetailScreen';
import VendorCommissionScreen from '../screens/vendor/VendorCommissionScreen';
import VendorComplaintDetailScreen from '../screens/vendor/VendorComplaintDetailScreen';
import VendorShippingScreen from '../screens/vendor/VendorShippingScreen';
import AdminCommissionsScreen from '../screens/admin/AdminCommissionsScreen';

// Auth Providers
import { AdminAuthProvider } from '../contexts/AdminAuthContext';
import { VendorAuthProvider } from '../contexts/VendorAuthContext';
import { CartProvider } from '../contexts/CartContext';
import { WishlistProvider } from '../contexts/WishlistContext';
import { ChatProvider } from '../contexts/ChatContext';
import { UserProvider } from '../contexts/UserContext';
import { OrderProvider } from '../contexts/OrderContext';
import { CommissionProvider } from '../contexts/CommissionContext';
import { NotificationProvider } from '../contexts/NotificationContext';

import { colors } from '../theme';

// Storage Keys
const ONBOARDING_COMPLETE_KEY = '@gardenmate_onboarding_complete';
const VENDOR_AUTH_KEY = 'vendor_user';
const ADMIN_AUTH_KEY = 'planthub_admin_auth';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
const AdminTab = createBottomTabNavigator();
const VendorTab = createBottomTabNavigator();

// Consumer Tab Icon with Feather icons
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
    const iconMap: Record<string, any> = {
        Home: 'home',
        Shop: 'shopping-bag',
        ARScan: 'maximize',
        Community: 'users',
        Profile: 'user',
    };
    const iconName = iconMap[name] || 'circle';
    return (
        <View style={styles.tabIconContainer}>
            <Feather
                name={iconName}
                size={22}
                color={focused ? colors.primary : colors.textMuted}
            />
            {focused && name !== 'ARScan' && <View style={styles.tabDot} />}
        </View>
    );
}

// AR FAB Button Component with professional icon
function ARFabButton({ focused }: { focused: boolean }) {
    return (
        <View style={styles.fabContainer}>
            <View style={[styles.fabButton, focused && styles.fabButtonActive]}>
                <Feather name="maximize" size={24} color="#fff" />
            </View>
        </View>
    );
}

// Admin Tab Icon with Feather icons
function AdminTabIcon({ name, focused }: { name: string; focused: boolean }) {
    const iconMap: Record<string, any> = {
        Dashboard: 'bar-chart-2',
        Users: 'users',
        Vendors: 'shopping-bag',
        Plants: 'feather',
        Community: 'message-circle',
        More: 'menu',
    };
    const iconName = iconMap[name] || 'circle';
    return (
        <View style={styles.tabIconContainer}>
            <Feather name={iconName} size={20} color={focused ? colors.primary : colors.textMuted} />
        </View>
    );
}

// Vendor Tab Icon with Feather icons
function VendorTabIcon({ name, focused }: { name: string; focused: boolean }) {
    const iconMap: Record<string, any> = {
        Dashboard: 'bar-chart-2',
        Orders: 'package',
        Inventory: 'box',
        Reports: 'trending-up',
        Community: 'users',
        Settings: 'settings',
    };
    const iconName = iconMap[name] || 'circle';
    return (
        <View style={styles.tabIconContainer}>
            <Feather name={iconName} size={20} color={focused ? '#f97316' : colors.textMuted} />
        </View>
    );
}

// Consumer Main Tabs with AR FAB in center
function MainTabs() {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarStyle: styles.tabBar,
                tabBarShowLabel: true,
                tabBarLabelStyle: styles.mainTabLabel,
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textMuted,
                tabBarIcon: ({ focused }) => {
                    if (route.name === 'ARScan') {
                        return <ARFabButton focused={focused} />;
                    }
                    return <TabIcon name={route.name} focused={focused} />;
                },
            })}
        >
            <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Home' }} />
            <Tab.Screen name="Shop" component={MarketplaceScreen} options={{ tabBarLabel: 'Shop' }} />
            <Tab.Screen
                name="ARScan"
                component={ARViewScreen}
                options={{
                    tabBarLabel: 'AR Scan',
                }}
            />
            <Tab.Screen name="Community" component={CommunityScreen} options={{ tabBarLabel: 'Community' }} />
            <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'Profile' }} />
        </Tab.Navigator>
    );
}

// Admin Tabs
function AdminTabs() {
    return (
        <AdminTab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarStyle: styles.adminTabBar,
                tabBarShowLabel: true,
                tabBarLabelStyle: styles.tabLabel,
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textMuted,
                tabBarIcon: ({ focused }) => <AdminTabIcon name={route.name} focused={focused} />,
            })}
        >
            <AdminTab.Screen name="Dashboard" component={AdminDashboardScreen} />
            <AdminTab.Screen name="Users" component={AdminUsersScreen} />
            <AdminTab.Screen name="Vendors" component={AdminVendorsScreen} />
            <AdminTab.Screen name="Plants" component={AdminPlantsScreen} />
            <AdminTab.Screen name="Community" component={AdminCommunityScreen} />
            <AdminTab.Screen name="More" component={AdminMoreScreen} />
        </AdminTab.Navigator>
    );
}

// Vendor Tabs
function VendorTabs() {
    return (
        <VendorTab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarStyle: styles.vendorTabBar,
                tabBarShowLabel: true,
                tabBarLabelStyle: styles.tabLabel,
                tabBarActiveTintColor: '#f97316',
                tabBarInactiveTintColor: colors.textMuted,
                tabBarIcon: ({ focused }) => <VendorTabIcon name={route.name} focused={focused} />,
            })}
        >
            <VendorTab.Screen name="Dashboard" component={VendorDashboardScreen} />
            <VendorTab.Screen name="Orders" component={VendorOrdersScreen} />
            <VendorTab.Screen name="Inventory" component={VendorInventoryScreen} />
            <VendorTab.Screen name="Reports" component={VendorReportsScreen} />
            <VendorTab.Screen name="Community" component={VendorCommunityScreen} />
            <VendorTab.Screen name="Settings" component={VendorSettingsScreen} />
        </VendorTab.Navigator>
    );
}

// Loading Splash Screen
function LoadingScreen() {
    return (
        <View style={styles.loadingContainer}>
            <Feather name="feather" size={60} color={colors.primary} />
            <Text style={styles.loadingText}>GardenMate</Text>
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
        </View>
    );
}

export default function AppNavigator() {
    const [isLoading, setIsLoading] = useState(true);
    const [initialRoute, setInitialRoute] = useState<string>('Onboarding');

    useEffect(() => {
        checkInitialState();

        // 🔔 Global Foreground Notification Listener
        const subscription = Notifications.addNotificationReceivedListener(notification => {
            // Let the native OS handle the display based on Notifications.setNotificationHandler
            // which is configured in NotificationService.ts
            console.log('Foreground notification received:', notification.request.content.title);

            // Explicitly show an in-app Alert when a reminder is triggered while the app is open
            if (notification.request.content.title?.includes('Reminder') || notification.request.content.data?.isReminder) {
                const data = notification.request.content.data;
                const taskStr = typeof data?.taskType === 'string' ? data.taskType : '';
                const taskType = taskStr ? `Type: ${taskStr.charAt(0).toUpperCase() + taskStr.slice(1)}\n` : '';
                const plantName = typeof data?.plantName === 'string' ? `Plant: ${data.plantName}\n\n` : '';

                Alert.alert(
                    notification.request.content.title || 'Reminder',
                    `${taskType}${plantName}${notification.request.content.body || 'You have a new reminder!'}`
                );
            }
        });

        return () => subscription.remove();
    }, []);

    // 🟢 Presence lifecycle: online/offline based on AppState
    useEffect(() => {
        const handleAppStateChange = (nextAppState: string) => {
            const user = auth.currentUser;
            if (!user) return;
            if (nextAppState === 'active') {
                initializePresence(user.uid).catch(console.error);
            } else if (nextAppState === 'background' || nextAppState === 'inactive') {
                cleanupPresence(user.uid).catch(console.error);
            }
        };
        const subscription = AppState.addEventListener('change', handleAppStateChange);
        // Initialize presence on mount if already logged in
        if (auth.currentUser) {
            initializePresence(auth.currentUser.uid).catch(console.error);
        }
        return () => subscription.remove();
    }, []);

    const checkInitialState = async () => {
        try {
            // 1. Check if onboarding was completed
            const onboardingComplete = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
            const hasSeenOnboarding = onboardingComplete === 'true';

            if (!hasSeenOnboarding) {
                console.log('📱 First time user - showing onboarding');
                setInitialRoute('Onboarding');
                setIsLoading(false);
                return;
            }

            // 2. Check for Admin login (AsyncStorage)
            const adminData = await AsyncStorage.getItem(ADMIN_AUTH_KEY);
            if (adminData) {
                console.log('👨‍💼 Admin is logged in - going to AdminTabs');
                setInitialRoute('AdminTabs');
                setIsLoading(false);
                return;
            }

            // 3. Check for Vendor login (AsyncStorage)
            const vendorData = await AsyncStorage.getItem(VENDOR_AUTH_KEY);
            if (vendorData) {
                console.log('🏪 Vendor is logged in - going to VendorTabs');
                setInitialRoute('VendorTabs');
                setIsLoading(false);
                return;
            }

            // 4. Check for User login (Firebase Auth)
            // Using a promise wrapper for onAuthStateChanged to get initial state
            const checkFirebaseAuth = () => {
                return new Promise<string>((resolve) => {
                    const unsubscribe = onAuthStateChanged(auth, async (user) => {
                        unsubscribe(); // Unsubscribe after first callback

                        if (user) {
                            console.log('✅ User is logged in:', user.email);

                            // Check user role from Firestore
                            try {
                                const userDoc = await getDoc(doc(db, 'users', user.uid));
                                if (userDoc.exists()) {
                                    const userData = userDoc.data();
                                    const role = userData.role || 'user';
                                    console.log('👤 User role from Firestore:', role);

                                    if (role === 'admin') {
                                        resolve('AdminTabs');
                                    } else if (role === 'vendor') {
                                        resolve('VendorTabs');
                                    } else {
                                        resolve('MainTabs');
                                    }
                                    // Register push token for this user
                                    updateUserPushToken(user.uid).catch(() => { });
                                } else {
                                    resolve('MainTabs');
                                }
                            } catch (error) {
                                console.log('Error fetching user role:', error);
                                resolve('MainTabs');
                            }
                        } else {
                            console.log('❌ No user logged in - going to Auth');
                            resolve('Auth');
                        }
                    });
                });
            };

            const firebaseRoute = await checkFirebaseAuth();
            setInitialRoute(firebaseRoute);
            setIsLoading(false);

        } catch (error) {
            console.log('Error checking initial state:', error);
            setInitialRoute('Auth');
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return <LoadingScreen />;
    }

    return (
        <CommissionProvider>
            <UserProvider>
                <OrderProvider>
                    <CartProvider>
                        <WishlistProvider>
                            <ChatProvider>
                                <AdminAuthProvider>
                                    <VendorAuthProvider>
                                        <NotificationProvider>
                                            <NavigationContainer>
                                                <Stack.Navigator
                                                    screenOptions={{ headerShown: false }}
                                                    initialRouteName={initialRoute}
                                                >
                                                    {/* Consumer Flow */}
                                                    <Stack.Screen name="Onboarding" component={OnboardingScreen} />
                                                    <Stack.Screen name="Auth" component={AuthScreen} />
                                                    <Stack.Screen name="MainTabs" component={MainTabs} />
                                                    <Stack.Screen name="MyPlants" component={MyPlantsScreen} />
                                                    <Stack.Screen name="PlantDetail" component={PlantDetailScreen} />
                                                    <Stack.Screen name="AddPlant" component={AddPlantScreen} />
                                                    <Stack.Screen name="Notifications" component={NotificationsScreen} />
                                                    <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
                                                    <Stack.Screen name="ARView" component={ARViewScreen} />
                                                    <Stack.Screen name="ImageSearch" component={ImageSearchScreen} />
                                                    <Stack.Screen name="VendorPublicStore" component={VendorPublicStoreScreen} />
                                                    <Stack.Screen name="Chat" component={ChatScreen} />
                                                    <Stack.Screen name="ChatList" component={ChatListScreen} />
                                                    <Stack.Screen name="CreateTicket" component={CreateTicketScreen} />
                                                    <Stack.Screen name="Feedback" component={FeedbackScreen} />
                                                    <Stack.Screen name="Cart" component={CartScreen} />
                                                    <Stack.Screen name="Checkout" component={CheckoutScreen} />
                                                    <Stack.Screen name="OrderConfirmation" component={OrderConfirmationScreen} />
                                                    <Stack.Screen name="Wishlist" component={WishlistScreen} />
                                                    <Stack.Screen name="ShippingAddresses" component={ShippingAddressesScreen} />
                                                    <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
                                                    <Stack.Screen name="AccountDetails" component={AccountDetailsScreen} />
                                                    <Stack.Screen name="Settings" component={SettingsScreen} />
                                                    <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
                                                    <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
                                                    <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
                                                    <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
                                                    <Stack.Screen name="NotFound" component={NotFoundScreen} />
                                                    <Stack.Screen name="Reminders" component={TasksScreen} />
                                                    <Stack.Screen name="MyTickets" component={MyTicketsScreen} />
                                                    <Stack.Screen name="TicketDetail" component={TicketDetailScreen} />
                                                    <Stack.Screen name="UserProfileView" component={UserProfileViewScreen} />


                                                    {/* Admin Flow */}
                                                    <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
                                                    <Stack.Screen name="AdminTabs" component={AdminTabs} />
                                                    <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
                                                    <Stack.Screen name="AdminUsers" component={AdminUsersScreen} />
                                                    <Stack.Screen name="AdminVendors" component={AdminVendorsScreen} />
                                                    <Stack.Screen name="AdminPlants" component={AdminPlantsScreen} />
                                                    <Stack.Screen name="AdminComplaints" component={AdminComplaintsScreen} />
                                                    <Stack.Screen name="AdminTicketDetail" component={AdminTicketDetailScreen} />
                                                    <Stack.Screen name="TicketAnalytics" component={TicketAnalyticsScreen} />
                                                    <Stack.Screen name="AdminCommunity" component={AdminCommunityScreen} />
                                                    <Stack.Screen name="AdminCommissions" component={AdminCommissionsScreen} />
                                                    <Stack.Screen name="AdminNotifications" component={AdminNotificationsScreen} />

                                                    {/* Vendor Flow */}
                                                    <Stack.Screen name="VendorLogin" component={VendorLoginScreen} />
                                                    <Stack.Screen name="VendorTabs" component={VendorTabs} />
                                                    <Stack.Screen name="VendorDashboard" component={VendorDashboardScreen} />
                                                    <Stack.Screen name="VendorOrders" component={VendorOrdersScreen} />
                                                    <Stack.Screen name="VendorInventory" component={VendorInventoryScreen} />
                                                    <Stack.Screen name="VendorPayouts" component={VendorPayoutsScreen} />
                                                    <Stack.Screen name="VendorReports" component={VendorReportsScreen} />
                                                    <Stack.Screen name="VendorReviews" component={VendorReviewsScreen} />
                                                    <Stack.Screen name="VendorSettings" component={VendorSettingsScreen} />
                                                    <Stack.Screen name="VendorStoreProfile" component={VendorStoreProfileScreen} />
                                                    <Stack.Screen name="VendorComplaints" component={VendorComplaintsScreen} />
                                                    <Stack.Screen name="VendorNotifications" component={VendorNotificationsScreen} />
                                                    <Stack.Screen name="VendorCommunity" component={VendorCommunityScreen} />
                                                    <Stack.Screen name="VendorChats" component={VendorChatsScreen} />
                                                    <Stack.Screen name="VendorChatDetail" component={VendorChatDetailScreen} />
                                                    <Stack.Screen name="VendorCommission" component={VendorCommissionScreen} />
                                                    <Stack.Screen name="VendorComplaintDetail" component={VendorComplaintDetailScreen} />
                                                    <Stack.Screen name="VendorShipping" component={VendorShippingScreen} />

                                                </Stack.Navigator>
                                            </NavigationContainer>
                                        </NotificationProvider>
                                    </VendorAuthProvider>
                                </AdminAuthProvider>
                            </ChatProvider>
                        </WishlistProvider>
                    </CartProvider>
                </OrderProvider>
            </UserProvider>
        </CommissionProvider >
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f9fafb',
    },
    loadingText: {
        fontSize: 28,
        fontWeight: '700',
        color: colors.primary,
        marginTop: 16,
    },
    tabBar: {
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: 'rgba(229,231,235,0.5)',
        height: 80,
        paddingBottom: 20,
        paddingTop: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 20,
    },
    adminTabBar: {
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: 'rgba(229,231,235,0.5)',
        height: 70,
        paddingBottom: 10,
        paddingTop: 8,
    },
    vendorTabBar: {
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: 'rgba(229,231,235,0.5)',
        height: 70,
        paddingBottom: 10,
        paddingTop: 8,
    },
    tabIconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabIcon: {
        fontSize: 22,
        opacity: 0.5,
    },
    tabIconFocused: {
        opacity: 1,
    },
    tabDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.primary,
        marginTop: 4,
    },
    tabLabel: {
        fontSize: 10,
        fontWeight: '500',
    },
    mainTabLabel: {
        fontSize: 10,
        fontWeight: '500',
    },
    fabContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: -30,
    },
    fabButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#10b981',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    fabButtonActive: {
        transform: [{ scale: 1.1 }],
    },
    fabIcon: {
        fontSize: 24,
    },
});

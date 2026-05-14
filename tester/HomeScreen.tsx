import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, SafeAreaView, StatusBar, Animated, Modal, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useTasks } from '../hooks/useTasks';
import { usePlants } from '../hooks/usePlants';
import { colors, spacing, borderRadius, fontSize } from '../theme';
import AnimatedWeatherCard from '../components/AnimatedWeatherCard';

// OpenWeatherMap API Key
const WEATHER_API_KEY = '3f5874a48b9644aa44373ec1c16b0b0a';

// Weather icon mapping
const getWeatherIcon = (weatherMain: string): string => {
    const iconMap: Record<string, string> = {
        'Clear': 'sun',
        'Clouds': 'cloud',
        'Rain': 'cloud-rain',
        'Drizzle': 'cloud-drizzle',
        'Thunderstorm': 'cloud-lightning',
        'Snow': 'cloud-snow',
        'Mist': 'wind',
        'Fog': 'wind',
        'Haze': 'wind',
    };
    return iconMap[weatherMain] || 'cloud';
};

// Get greeting based on time of day
const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good Morning';
    if (hour >= 12 && hour < 17) return 'Good Afternoon';
    if (hour >= 17 && hour < 21) return 'Good Evening';
    return 'Good Night';
};

// Get plant care tip based on weather
const getPlantCareTip = (temp: number, humidity: number, weather: string): string => {
    if (humidity > 70) return 'High humidity today • Perfect for tropical plants!';
    if (humidity < 30) return 'Low humidity • Consider misting your plants';
    if (temp > 30) return 'Hot day • Keep plants away from direct sun';
    if (temp < 10) return 'Cold weather • Protect sensitive plants';
    if (weather === 'Rain') return 'Rainy day • No need to water outdoor plants';
    if (weather === 'Clear' && temp > 20) return 'Great day for plant care activities!';
    return `Humidity: ${humidity}% • Good conditions for most plants`;
};

interface WeatherData {
    temp: number;
    humidity: number;
    weather: string;
    description: string;
    city: string;
    country: string;
    icon: string;
    timezone: number; // UTC offset in seconds
    sunrise: number;  // Unix timestamp
    sunset: number;   // Unix timestamp
    localTime: number; // Calculated local time (hour 0-23)
    isNight: boolean;  // Pre-calculated based on city's time
}

// Icon component for task types
function TaskTypeIcon({ type }: { type: string }) {
    const iconMap: Record<string, { name: any; color: string; bg: string }> = {
        water: { name: 'droplet', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
        fertilize: { name: 'sun', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
        rotate: { name: 'rotate-cw', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
        prune: { name: 'scissors', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
        clean: { name: 'sparkles', color: '#ec4899', bg: 'rgba(236,72,153,0.1)' },
    };
    const icon = iconMap[type] || { name: 'feather', color: colors.primary, bg: 'rgba(16,185,129,0.1)' };
    return (
        <View style={[styles.taskIcon, { backgroundColor: icon.bg }]}>
            <Feather name={icon.name} size={20} color={icon.color} />
        </View>
    );
}

export default function HomeScreen({ navigation }: any) {
    const { tasks, toggleTask } = useTasks();
    const { plants } = usePlants();
    const pendingTasks = tasks.filter(t => !t.completed);

    // Weather state
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [isLoadingWeather, setIsLoadingWeather] = useState(true);
    const [greeting, setGreeting] = useState(getGreeting());
    const [showLocationModal, setShowLocationModal] = useState(false);
    const [manualCity, setManualCity] = useState('');
    const [currentLocation, setCurrentLocation] = useState<{ lat: number; lon: number } | null>(null);
    const [useManualLocation, setUseManualLocation] = useState(false);
    const [savedCity, setSavedCity] = useState('');

    // City suggestions state
    const [citySuggestions, setCitySuggestions] = useState<Array<{ name: string; country: string; state?: string; lat: number; lon: number }>>([]);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    const searchTimeout = useRef<NodeJS.Timeout | null>(null);

    // Live clock state - updates every minute
    const [cityLiveTime, setCityLiveTime] = useState<{ hour: number; minute: number } | null>(null);

    // Animation for water icon bounce
    const bounceAnim = useRef(new Animated.Value(0)).current;

    // Fetch weather by coordinates
    const fetchWeatherByCoords = useCallback(async (lat: number, lon: number) => {
        try {
            const response = await fetch(
                `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}&units=metric`
            );
            const data = await response.json();

            if (data.cod === 200) {
                // Calculate the city's local time using timezone offset
                const cityLocalTime = new Date((Date.now() / 1000 + data.timezone) * 1000);
                const cityHour = cityLocalTime.getUTCHours();

                // Compare current UTC time with sunrise/sunset (both in UTC)
                const currentUtcTimestamp = Math.floor(Date.now() / 1000);
                const isNightTime = currentUtcTimestamp < data.sys.sunrise || currentUtcTimestamp > data.sys.sunset;

                setWeather({
                    temp: Math.round(data.main.temp),
                    humidity: data.main.humidity,
                    weather: data.weather[0].main,
                    description: data.weather[0].description,
                    city: data.name,
                    country: data.sys.country,
                    icon: getWeatherIcon(data.weather[0].main),
                    timezone: data.timezone,
                    sunrise: data.sys.sunrise,
                    sunset: data.sys.sunset,
                    localTime: cityHour,
                    isNight: isNightTime,
                });
            }
        } catch (error) {
            console.log('Weather fetch error:', error);
        }
        setIsLoadingWeather(false);
    }, []);

    // Fetch weather by city name
    const fetchWeatherByCity = useCallback(async (city: string) => {
        try {
            setIsLoadingWeather(true);
            const response = await fetch(
                `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${WEATHER_API_KEY}&units=metric`
            );
            const data = await response.json();

            if (data.cod === 200) {
                // Calculate the city's local time using timezone offset
                const cityLocalTime = new Date((Date.now() / 1000 + data.timezone) * 1000);
                const cityHour = cityLocalTime.getUTCHours();

                // Compare current UTC time with sunrise/sunset (both in UTC)
                const currentUtcTimestamp = Math.floor(Date.now() / 1000);
                const isNightTime = currentUtcTimestamp < data.sys.sunrise || currentUtcTimestamp > data.sys.sunset;

                setWeather({
                    temp: Math.round(data.main.temp),
                    humidity: data.main.humidity,
                    weather: data.weather[0].main,
                    description: data.weather[0].description,
                    city: data.name,
                    country: data.sys.country,
                    icon: getWeatherIcon(data.weather[0].main),
                    timezone: data.timezone,
                    sunrise: data.sys.sunrise,
                    sunset: data.sys.sunset,
                    localTime: cityHour,
                    isNight: isNightTime,
                });
                setSavedCity(city);
                setUseManualLocation(true);
                setShowLocationModal(false);
            } else {
                Alert.alert('City Not Found', 'Please enter a valid city name');
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to fetch weather data');
        }
        setIsLoadingWeather(false);
    }, []);

    // Fetch city suggestions (debounced)
    const fetchCitySuggestions = useCallback(async (query: string) => {
        if (query.length < 1) {
            setCitySuggestions([]);
            return;
        }

        setIsLoadingSuggestions(true);
        try {
            // Limited to Pakistan only
            const response = await fetch(
                `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)},PK&limit=5&appid=${WEATHER_API_KEY}`
            );
            const data = await response.json();

            if (Array.isArray(data)) {
                setCitySuggestions(data.map((item: any) => ({
                    name: item.name,
                    country: item.country,
                    state: item.state,
                    lat: item.lat,
                    lon: item.lon,
                })));
            }
        } catch (error) {
            console.log('City suggestions error:', error);
        }
        setIsLoadingSuggestions(false);
    }, []);

    // Handle city input change with debounce
    const handleCityInputChange = (text: string) => {
        setManualCity(text);

        // Clear previous timeout
        if (searchTimeout.current) {
            clearTimeout(searchTimeout.current);
        }

        // Debounce search by 300ms
        searchTimeout.current = setTimeout(() => {
            fetchCitySuggestions(text);
        }, 300);
    };

    // Select a city suggestion
    const selectCitySuggestion = (suggestion: { name: string; country: string; lat: number; lon: number }) => {
        const cityDisplay = `${suggestion.name}, ${suggestion.country}`;
        setManualCity(cityDisplay);
        setCitySuggestions([]);
        Keyboard.dismiss();

        // Fetch weather by coordinates for accuracy
        Alert.alert(
            '🌍 Change Location',
            `Set weather location to "${cityDisplay}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    onPress: async () => {
                        setIsLoadingWeather(true);
                        await fetchWeatherByCoords(suggestion.lat, suggestion.lon);
                        setSavedCity(suggestion.name);
                        setUseManualLocation(true);
                        setShowLocationModal(false);
                    }
                }
            ]
        );
    };

    // Get current location and fetch weather
    const getLocationAndWeather = useCallback(async () => {
        try {
            setIsLoadingWeather(true);
            const { status } = await Location.requestForegroundPermissionsAsync();

            if (status !== 'granted') {
                // Default to a location if permission denied
                fetchWeatherByCity('Lahore');
                return;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            setCurrentLocation({
                lat: location.coords.latitude,
                lon: location.coords.longitude,
            });

            fetchWeatherByCoords(location.coords.latitude, location.coords.longitude);
        } catch (error) {
            console.log('Location error:', error);
            fetchWeatherByCity('Lahore');
        }
    }, [fetchWeatherByCoords, fetchWeatherByCity]);

    // Use live location with confirmation
    const useLiveLocation = () => {
        Alert.alert(
            '📍 Use Live Location',
            'This will detect your current location using GPS.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Allow',
                    onPress: () => {
                        setUseManualLocation(false);
                        setSavedCity('');
                        setShowLocationModal(false);
                        getLocationAndWeather();
                    }
                }
            ]
        );
    };

    // Handle city search with confirmation
    const handleCitySearch = () => {
        if (!manualCity.trim()) return;
        Keyboard.dismiss();
        Alert.alert(
            '🌍 Change Location',
            `Set weather location to "${manualCity.trim()}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Confirm', onPress: () => fetchWeatherByCity(manualCity.trim()) }
            ]
        );
    };

    // Initial setup and auto-refresh
    useEffect(() => {
        // Update greeting every minute
        const greetingInterval = setInterval(() => {
            setGreeting(getGreeting());
        }, 60000);

        // Update city live time every minute
        const clockInterval = setInterval(() => {
            if (weather?.timezone !== undefined) {
                const cityTime = new Date((Date.now() / 1000 + weather.timezone) * 1000);
                setCityLiveTime({
                    hour: cityTime.getUTCHours(),
                    minute: cityTime.getUTCMinutes(),
                });
            }
        }, 1000); // Update every second for smooth time display

        // Bounce animation
        const bounce = Animated.loop(
            Animated.sequence([
                Animated.timing(bounceAnim, { toValue: -8, duration: 500, useNativeDriver: true }),
                Animated.timing(bounceAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
            ])
        );
        bounce.start();

        // Initial weather fetch
        if (useManualLocation && savedCity) {
            fetchWeatherByCity(savedCity);
        } else {
            getLocationAndWeather();
        }

        // Auto-refresh weather every 10 minutes
        const weatherInterval = setInterval(() => {
            if (useManualLocation && savedCity) {
                fetchWeatherByCity(savedCity);
            } else if (currentLocation) {
                fetchWeatherByCoords(currentLocation.lat, currentLocation.lon);
            } else {
                getLocationAndWeather();
            }
        }, 600000); // 10 minutes

        return () => {
            clearInterval(greetingInterval);
            clearInterval(clockInterval);
            clearInterval(weatherInterval);
            bounce.stop();
        };
    }, [weather?.timezone]);

    const myPlants = plants.length > 0 ? plants.slice(0, 3) : [
        { id: '1', name: 'Monty', species: 'Monstera', image: '', needsWater: true },
        { id: '2', name: 'Figgy', species: 'Fiddle Leaf', image: '', needsWater: false },
        { id: '3', name: 'Snape', species: 'Snake Plant', image: '', needsWater: false },
    ];

    // Location selection modal with keyboard handling
    const renderLocationModal = () => (
        <Modal visible={showLocationModal} animationType="fade" transparent onRequestClose={() => setShowLocationModal(false)}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.modalOverlay}
            >
                <TouchableOpacity
                    style={styles.modalBackdrop}
                    activeOpacity={1}
                    onPress={() => {
                        Keyboard.dismiss();
                        setShowLocationModal(false);
                    }}
                />
                <View style={styles.locationModal}>
                    {/* Handle bar */}
                    <View style={styles.modalHandle} />

                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>📍 Select Location</Text>
                        <TouchableOpacity
                            style={styles.closeBtn}
                            onPress={() => setShowLocationModal(false)}
                        >
                            <Feather name="x" size={20} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    {/* Use Live Location */}
                    <TouchableOpacity style={styles.locationOption} onPress={useLiveLocation}>
                        <View style={styles.locationIconBg}>
                            <Feather name="navigation" size={20} color={colors.primary} />
                        </View>
                        <View style={styles.locationOptionText}>
                            <Text style={styles.locationOptionTitle}>Use Live Location</Text>
                            <Text style={styles.locationOptionSubtitle}>Auto-detect your current location</Text>
                        </View>
                        {!useManualLocation && <Feather name="check-circle" size={20} color={colors.primary} />}
                    </TouchableOpacity>

                    <View style={styles.divider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>OR</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    {/* Manual City Input */}
                    <Text style={styles.inputLabel}>Enter City Name</Text>
                    <View style={styles.cityInputRow}>
                        <TextInput
                            style={styles.cityInput}
                            placeholder="Start typing city name..."
                            placeholderTextColor={colors.textMuted}
                            value={manualCity}
                            onChangeText={handleCityInputChange}
                            onSubmitEditing={() => manualCity.trim() && handleCitySearch()}
                            returnKeyType="search"
                        />
                        {isLoadingSuggestions ? (
                            <View style={styles.searchCityBtn}>
                                <ActivityIndicator size="small" color="#fff" />
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={[styles.searchCityBtn, !manualCity.trim() && styles.searchCityBtnDisabled]}
                                onPress={handleCitySearch}
                                disabled={!manualCity.trim()}
                            >
                                <Feather name="search" size={18} color="#fff" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* City Suggestions Dropdown */}
                    {citySuggestions.length > 0 && (
                        <View style={styles.suggestionsDropdown}>
                            {citySuggestions.map((suggestion, index) => (
                                <TouchableOpacity
                                    key={`${suggestion.name}-${suggestion.lat}-${index}`}
                                    style={styles.suggestionItem}
                                    onPress={() => selectCitySuggestion(suggestion)}
                                >
                                    <Feather name="map-pin" size={16} color={colors.primary} />
                                    <View style={styles.suggestionText}>
                                        <Text style={styles.suggestionCity}>{suggestion.name}</Text>
                                        <Text style={styles.suggestionCountry}>
                                            {suggestion.state ? `${suggestion.state}, ` : ''}{suggestion.country}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Recent/Saved City */}
                    {savedCity && (
                        <TouchableOpacity
                            style={styles.savedCityChip}
                            onPress={() => {
                                Alert.alert(
                                    'Use Saved Location',
                                    `Set location to ${savedCity}?`,
                                    [
                                        { text: 'Cancel', style: 'cancel' },
                                        { text: 'Yes', onPress: () => fetchWeatherByCity(savedCity) }
                                    ]
                                );
                            }}
                        >
                            <Feather name="clock" size={14} color={colors.primary} />
                            <Text style={styles.savedCityText}>{savedCity}</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header with Dynamic Greeting */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.greeting}>{greeting},</Text>
                        <Text style={styles.username}>Alex Johnson</Text>
                    </View>
                    <TouchableOpacity style={styles.bellButton} onPress={() => navigation.navigate('Notifications')}>
                        <Feather name="bell" size={20} color={colors.text} />
                    </TouchableOpacity>
                </View>

                {/* Live Weather Widget - Premium Animated */}
                <TouchableOpacity activeOpacity={0.95} onPress={() => setShowLocationModal(true)}>
                    {isLoadingWeather ? (
                        <LinearGradient
                            colors={['rgba(16,185,129,0.8)', '#059669']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.weatherCard}
                        >
                            <View style={styles.weatherLoading}>
                                <ActivityIndicator color="#fff" size="small" />
                                <Text style={styles.weatherLoadingText}>Getting weather...</Text>
                            </View>
                        </LinearGradient>
                    ) : weather ? (
                        <AnimatedWeatherCard
                            weather={weather.weather}
                            description={weather.description}
                            temp={weather.temp}
                            humidity={weather.humidity}
                            city={weather.city}
                            country={weather.country}
                            icon={weather.icon}
                            isNight={weather.isNight}
                            plantTip={getPlantCareTip(weather.temp, weather.humidity, weather.weather)}
                            localTime={cityLiveTime?.hour ?? weather.localTime}
                            localMinute={cityLiveTime?.minute}
                        />
                    ) : (
                        <LinearGradient
                            colors={['rgba(107,114,128,0.8)', '#4b5563']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.weatherCard}
                        >
                            <Text style={styles.weatherError}>Unable to load weather</Text>
                        </LinearGradient>
                    )}
                </TouchableOpacity>

                {/* Tasks Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Tasks for Today</Text>
                        <View style={styles.pendingBadge}>
                            <Text style={styles.pendingText}>{pendingTasks.length} Pending</Text>
                        </View>
                    </View>

                    <View style={styles.tasksCard}>
                        {pendingTasks.length > 0 ? pendingTasks.slice(0, 4).map(task => (
                            <TouchableOpacity
                                key={task.id}
                                style={styles.taskItem}
                                onPress={() => toggleTask(task.id)}
                                activeOpacity={0.7}
                            >
                                <TaskTypeIcon type={task.taskType} />
                                <View style={styles.taskContent}>
                                    <Text style={styles.taskTitle}>{task.title}</Text>
                                    <Text style={styles.taskSubtitle}>{task.location || 'Your Garden'} • {task.dueDate}</Text>
                                </View>
                                <View style={[styles.checkbox, task.completed && styles.checkboxCompleted]}>
                                    {task.completed && <Feather name="check" size={12} color="#fff" />}
                                </View>
                            </TouchableOpacity>
                        )) : (
                            <View style={styles.emptyState}>
                                <Feather name="check-circle" size={32} color={colors.textMuted} />
                                <Text style={styles.emptyText}>No pending tasks for today!</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* My Garden Carousel */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>My Garden</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('MyPlants')} style={styles.viewAllBtn}>
                            <Text style={styles.viewAll}>View All</Text>
                            <Feather name="arrow-right" size={14} color={colors.primary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
                        {myPlants.map((plant: any, i: number) => (
                            <TouchableOpacity
                                key={plant.id}
                                style={styles.plantCard}
                                onPress={() => navigation.navigate('PlantDetail', { plantId: plant.id })}
                                activeOpacity={0.9}
                            >
                                <View style={styles.plantImageContainer}>
                                    {plant.image ? (
                                        <Image source={{ uri: plant.image }} style={styles.plantImage} />
                                    ) : (
                                        <View style={styles.plantImagePlaceholder}>
                                            <Feather name="feather" size={48} color={colors.primary} />
                                        </View>
                                    )}
                                    {plant.needsWater && (
                                        <Animated.View style={[styles.waterBadge, { transform: [{ translateY: bounceAnim }] }]}>
                                            <Feather name="droplet" size={14} color="#fff" />
                                        </Animated.View>
                                    )}
                                </View>
                                <Text style={styles.plantName}>{plant.name}</Text>
                                <Text style={styles.plantSpecies}>{plant.species}</Text>
                            </TouchableOpacity>
                        ))}

                        {/* Add Plant Card */}
                        <TouchableOpacity
                            style={styles.addPlantCard}
                            onPress={() => navigation.navigate('AddPlant')}
                        >
                            <View style={styles.addPlantIcon}>
                                <Feather name="plus" size={24} color={colors.primary} />
                            </View>
                            <Text style={styles.addPlantText}>Add Plant</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>

            {renderLocationModal()}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, paddingTop: spacing.xl },
    greeting: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: '500' },
    username: { fontSize: fontSize['2xl'], fontWeight: 'bold', color: colors.text, marginTop: 4 },
    bellButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },

    // Weather Card
    weatherCard: { marginHorizontal: spacing.lg, padding: spacing.lg, borderRadius: borderRadius.xl, marginBottom: spacing.lg, position: 'relative', overflow: 'hidden', shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 8 },
    weatherBlob: { position: 'absolute', top: -40, right: -40, width: 128, height: 128, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 64 },
    weatherContent: { flexDirection: 'row', justifyContent: 'space-between' },
    weatherLeft: { flex: 1 },
    weatherRight: { alignItems: 'flex-end', justifyContent: 'space-between' },
    weatherInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
    weatherType: { color: '#fff', fontWeight: '600', fontSize: fontSize.base },
    temperature: { fontSize: 44, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
    humidity: { color: 'rgba(255,255,255,0.9)', fontSize: fontSize.sm, maxWidth: 200 },
    locationBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full },
    locationText: { color: '#fff', fontSize: fontSize.xs, fontWeight: '600' },
    editLocationHint: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, gap: 4 },
    editLocationText: { color: 'rgba(255,255,255,0.6)', fontSize: 10 },
    weatherLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.lg },
    weatherLoadingText: { color: '#fff', marginTop: spacing.sm, fontSize: fontSize.sm },
    weatherError: { color: '#fff', fontSize: fontSize.base },

    // Location Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    locationModal: { backgroundColor: colors.background, borderRadius: borderRadius.xl, padding: spacing.lg, width: '90%', maxWidth: 400 },
    modalHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
    closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(243,244,246,0.8)', justifyContent: 'center', alignItems: 'center' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
    modalTitle: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text },
    locationOption: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, backgroundColor: '#fff', borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border },
    locationIconBg: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(16,185,129,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
    locationOptionText: { flex: 1 },
    locationOptionTitle: { fontSize: fontSize.base, fontWeight: '600', color: colors.text },
    locationOptionSubtitle: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
    divider: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: { marginHorizontal: spacing.md, color: colors.textMuted, fontSize: fontSize.xs },
    inputLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
    cityInputRow: { flexDirection: 'row', gap: spacing.sm },
    cityInput: { flex: 1, backgroundColor: '#fff', borderRadius: borderRadius.md, padding: spacing.md, fontSize: fontSize.base, borderWidth: 1, borderColor: colors.border, color: colors.text },
    searchCityBtn: { width: 48, height: 48, backgroundColor: colors.primary, borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center' },
    searchCityBtnDisabled: { backgroundColor: colors.textMuted },
    savedCityChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, alignSelf: 'flex-start', marginTop: spacing.md },
    savedCityText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '500' },

    // City Suggestions
    suggestionsDropdown: { marginTop: spacing.sm, backgroundColor: '#fff', borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    suggestionItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: 'rgba(229,231,235,0.5)', gap: spacing.sm },
    suggestionText: { flex: 1 },
    suggestionCity: { fontSize: fontSize.base, fontWeight: '600', color: colors.text },
    suggestionCountry: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
    section: { marginBottom: spacing.xl },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
    sectionTitle: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text },
    pendingBadge: { backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.sm },
    pendingText: { color: colors.primary, fontSize: fontSize.xs, fontWeight: '500' },
    viewAllBtn: { flexDirection: 'row', alignItems: 'center' },
    viewAll: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '500', marginRight: 4 },

    // Tasks
    tasksCard: { marginHorizontal: spacing.lg, backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
    taskItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, backgroundColor: 'rgba(243,244,246,0.5)', borderRadius: borderRadius.md, marginBottom: spacing.sm },
    taskIcon: { width: 44, height: 44, borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
    taskContent: { flex: 1 },
    taskTitle: { fontSize: fontSize.base, fontWeight: 'bold', color: colors.text },
    taskSubtitle: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
    checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(16,185,129,0.3)', justifyContent: 'center', alignItems: 'center' },
    checkboxCompleted: { backgroundColor: colors.primary, borderColor: colors.primary },
    emptyState: { padding: spacing.lg, alignItems: 'center' },
    emptyText: { color: colors.textMuted, marginTop: spacing.sm },

    // Plants
    carousel: { paddingLeft: spacing.lg, paddingRight: spacing.md },
    plantCard: { width: 160, marginRight: spacing.md, backgroundColor: '#fff', borderRadius: borderRadius.xl, padding: spacing.md, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
    plantImageContainer: { aspectRatio: 4 / 5, backgroundColor: 'rgba(243,244,246,0.3)', borderRadius: borderRadius.lg, marginBottom: spacing.md, overflow: 'hidden', position: 'relative', justifyContent: 'center', alignItems: 'center' },
    plantImage: { width: '100%', height: '100%' },
    plantImagePlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    waterBadge: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, backgroundColor: '#3b82f6', borderRadius: 14, justifyContent: 'center', alignItems: 'center', shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    plantName: { fontSize: fontSize.base, fontWeight: 'bold', color: colors.text },
    plantSpecies: { fontSize: fontSize.xs, color: colors.textMuted },
    addPlantCard: { width: 160, backgroundColor: 'rgba(16,185,129,0.05)', borderRadius: borderRadius.xl, borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(16,185,129,0.2)', justifyContent: 'center', alignItems: 'center', minHeight: 220 },
    addPlantIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    addPlantText: { fontSize: fontSize.sm, fontWeight: '500', color: colors.textMuted },
});

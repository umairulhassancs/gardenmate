import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useIsFocused } from '@react-navigation/native';
import {
    View, Text, ScrollView, TouchableOpacity, Image, StyleSheet,
    StatusBar, Animated, Alert, Platform, Linking, Modal, TextInput, ActivityIndicator, KeyboardAvoidingView, Keyboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useTasks, groupTasksByDate, TaskType, TaskFrequency } from '../hooks/useTasks';
import { usePlants } from '../hooks/usePlants';
import { colors, spacing, borderRadius, fontSize } from '../theme';
import { auth } from '../services/firebaseConfig';
import { useChat } from '../contexts/ChatContext';
import { useNotification } from '../contexts/NotificationContext';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import AnimatedWeatherCard from '../components/AnimatedWeatherCard';
import DateTimePicker from '@react-native-community/datetimepicker';
import { scheduleReminderNotification, triggerTestNotification } from '../services/NotificationService';


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

export default function HomeScreen({ navigation, route }: any) {

    const { tasks, toggleTask, addTask, updateTask, loading } = useTasks();
    // Pass ALL tasks to grouping so we can track completed vs pending for today
    const groupedTasks = groupTasksByDate(tasks);

    // Check for openAddTask param from other screens
    useEffect(() => {
        if (route?.params?.openAddTask) {
            setShowAddTaskModal(true);
            navigation.setParams({ openAddTask: undefined });
        }
    }, [route?.params]);


    const [setLoading] = useState(true);
    const { plants, loadPlants } = usePlants();
    const isFocused = useIsFocused();
    const { getTotalUnreadCount } = useChat();

    // Task Modal State
    const [showAddTaskModal, setShowAddTaskModal] = useState(false);
    const [taskPlantId, setTaskPlantId] = useState<string>('none');
    const [taskType, setTaskType] = useState<TaskType | 'custom'>('water');
    const [customTaskName, setCustomTaskName] = useState('');
    const [taskTitle, setTaskTitle] = useState('');
    const [reminderDate, setReminderDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    // Repeat Frequency State
    const [repeatFrequency, setRepeatFrequency] = useState<'once' | 'daily' | 'every-3-days' | 'weekly' | 'monthly' | 'custom'>('once');
    const [customDays, setCustomDays] = useState('');

    // Task Confirmation State
    const [confirmTaskId, setConfirmTaskId] = useState<string | null>(null);
    const [confirmTaskTitle, setConfirmTaskTitle] = useState('');
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    // Edit Task State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [editTaskTitle, setEditTaskTitle] = useState('');
    const [editTaskDate, setEditTaskDate] = useState(new Date());
    const [editTaskTime, setEditTaskTime] = useState(new Date());
    const [showEditDatePicker, setShowEditDatePicker] = useState(false);
    const [showEditTimePicker, setShowEditTimePicker] = useState(false);

    // Open edit modal with task data
    const handleEditTask = (task: any) => {
        setEditingTaskId(task.id);
        setEditTaskTitle(task.title);

        let taskDateTime = new Date();
        if (task.reminderDateTime) {
            taskDateTime = task.reminderDateTime instanceof Date
                ? task.reminderDateTime
                : new Date((task.reminderDateTime as any).seconds * 1000);
        }
        setEditTaskDate(taskDateTime);
        setEditTaskTime(taskDateTime);
        setShowEditModal(true);
    };

    // Close edit modal
    const closeEditModal = () => {
        setShowEditModal(false);
        setEditingTaskId(null);
        setShowEditDatePicker(false);
        setShowEditTimePicker(false);
    };

    // Save edited task
    const saveEditedTask = async () => {
        if (!editingTaskId) return;

        if (!editTaskTitle.trim()) {
            Alert.alert('Error', 'Reminder name cannot be empty');
            return;
        }

        // Combine date and time
        const combinedDateTime = new Date(
            editTaskDate.getFullYear(),
            editTaskDate.getMonth(),
            editTaskDate.getDate(),
            editTaskTime.getHours(),
            editTaskTime.getMinutes()
        );

        const success = await updateTask(editingTaskId, {
            title: editTaskTitle.trim(),
            reminderDateTime: combinedDateTime,
        });

        if (success) {
            closeEditModal();
        } else {
            Alert.alert('Error', 'Failed to update reminder');
        }
    };

    // Helper: Get task datetime
    const getTaskDateTime = (task: any): Date | null => {
        if (task.reminderDateTime) {
            return task.reminderDateTime instanceof Date
                ? task.reminderDateTime
                : new Date((task.reminderDateTime as any).seconds * 1000);
        }
        return null;
    };

    // Strict Today Filter (Matches TasksScreen logic)
    const todayTasks = useMemo(() => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrowStart = new Date(todayStart);
        tomorrowStart.setDate(tomorrowStart.getDate() + 1);

        return tasks.filter(task => {
            // 1. Pending only (completed are hidden unless recurring, but recurring resets so active ones are pending)
            if (task.completed) return false;

            // 2. Strict Today check
            if (task.dueDate === 'Today') return true;

            const taskDate = getTaskDateTime(task);
            if (taskDate) {
                // Must be today (not yesterday/overdue)
                return taskDate >= todayStart && taskDate < tomorrowStart;
            }
            return false;
        });
    }, [tasks]);

    // Helper: Check if task can be marked complete (time has passed)
    const canCompleteTask = (task: any): boolean => {
        if (task.completed) return false; // Already completed

        const taskDateTime = getTaskDateTime(task);
        if (!taskDateTime) return true; // No datetime set, allow completion

        const now = new Date();
        return now >= taskDateTime; // Can only complete if current time >= task time
    };

    // Helper: Get time remaining message
    const getTimeRemaining = (task: any): string | null => {
        const taskDateTime = getTaskDateTime(task);
        if (!taskDateTime || task.completed) return null;

        const now = new Date();
        if (now >= taskDateTime) return null; // Already available

        const diff = taskDateTime.getTime() - now.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0) {
            return `Available in ${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            return `Available in ${minutes}m`;
        }
        return null;
    };

    // Handle task completion with confirmation (with time check)
    const handleTaskPress = (task: any) => {
        // Check if task can be completed (time has passed)
        if (!canCompleteTask(task)) {
            const remaining = getTimeRemaining(task);
            Alert.alert(
                'Not Available Yet',
                remaining
                    ? `This reminder is scheduled for later.\n\n${remaining}`
                    : 'You can only mark reminders as done after their scheduled time.'
            );
            return;
        }

        setConfirmTaskId(task.id);
        setConfirmTaskTitle(task.title);
        setShowConfirmModal(true);
    };

    const confirmTaskCompletion = async () => {
        if (confirmTaskId) {
            const result = await toggleTask(confirmTaskId);

            // If recurring task, schedule next notification
            if (result?.isRecurring && result.nextDate && result.task) {
                await scheduleReminderNotification(
                    `🌱 Plant Reminder`,
                    `Time to ${result.task.taskType} ${result.task.plantName || 'your plant'}!`,
                    result.nextDate
                );
                Alert.alert(
                    '✅ Reminder Complete!',
                    `Great job! Next reminder scheduled for ${result.nextDate.toLocaleDateString()}`
                );
            }

            setShowConfirmModal(false);
            setConfirmTaskId(null);
            setConfirmTaskTitle('');
        }
    };

    const [weather, setWeather] = useState<{
        temp: number;
        humidity: number;
        weather: string;
        description: string;
        city: string;
        country: string;
        icon: string;
        timezone: number;
        sunrise: number;
        sunset: number;
        localTime: number;
        isNight: boolean;
    } | null>(null);
    const [isLoadingWeather, setIsLoadingWeather] = useState(true);
    const [showLocationModal, setShowLocationModal] = useState(false);
    const [manualCity, setManualCity] = useState('');
    const [useManualLocation, setUseManualLocation] = useState(false);
    const [savedCity, setSavedCity] = useState('');
    const [citySuggestions, setCitySuggestions] = useState<Array<{ name: string; country: string; state?: string; lat: number; lon: number }>>([]);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    const searchTimeout = useRef<NodeJS.Timeout | null>(null);
    const [cityLiveTime, setCityLiveTime] = useState<{ hour: number; minute: number } | null>(null);

    const [currentLocation, setCurrentLocation] = useState({
        latitude: 0,
        longitude: 0,
        accuracy: 0,
        timestamp: '',
    });

    useEffect(() => {
        if (isFocused) {
            console.log('Refreshing garden data...');
            loadPlants();
        }
    }, [isFocused]);
    // Uses the global NotificationContext for real-time unread count
    const { unreadCount } = useNotification();





    const [userName, setUserName] = useState('Garden Lover');
    const bounceAnim = useRef(new Animated.Value(0)).current;
    const myPlants = plants.length > 0 ? plants.slice(0, 3) : [];

    const WEATHER_API_KEY = '3f5874a48b9644aa44373ec1c16b0b0a';

    const getWeatherIcon = (weatherMain: string): any => {
        const iconMap: Record<string, string> = {
            'Clear': 'sun', 'Clouds': 'cloud', 'Rain': 'cloud-rain',
            'Drizzle': 'cloud-drizzle', 'Thunderstorm': 'cloud-lightning',
            'Snow': 'cloud-snow', 'Mist': 'wind', 'Fog': 'wind', 'Haze': 'wind',
        };
        return iconMap[weatherMain] || 'cloud';
    };

    // Get plant care tip based on weather (short & relevant)
    const getPlantCareTip = (temp: number, humidity: number, weather: string): string => {
        if (humidity > 70) return 'High humidity today • Perfect for tropical plants!';
        if (humidity < 30) return 'Low humidity • Consider misting your plants';
        if (temp > 30) return 'Hot day • Keep plants away from direct sun';
        if (temp < 10) return 'Cold weather • Protect sensitive plants';
        if (weather === 'Rain') return 'Rainy day • No need to water outdoor plants';
        if (weather === 'Clear' && temp > 20) return 'Great day for plant care activities!';
        return `Humidity: ${humidity}% • Good conditions for most plants`;
    };

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
                        // Fetch weather by coords
                        try {
                            const response = await fetch(
                                `https://api.openweathermap.org/data/2.5/weather?lat=${suggestion.lat}&lon=${suggestion.lon}&appid=${WEATHER_API_KEY}&units=metric`
                            );
                            const data = await response.json();

                            if (data.cod === 200) {
                                const cityLocalTime = new Date((Date.now() / 1000 + data.timezone) * 1000);
                                const cityHour = cityLocalTime.getUTCHours();
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
                                setSavedCity(suggestion.name);
                                setUseManualLocation(true);
                                setShowLocationModal(false);
                            }
                        } catch (error) {
                            Alert.alert('Error', 'Failed to fetch weather data');
                        }
                        setIsLoadingWeather(false);
                    }
                }
            ]
        );
    };

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
                        handleGetLocationAndWeather();
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

    const openInGoogleMaps = () => {
        const { latitude, longitude } = currentLocation;
        if (latitude && longitude) {
            const url = `https://www.google.com/maps?q=${latitude},${longitude}`;
            Linking.openURL(url);
        } else {
            Alert.alert('No Location', 'GPS coordinates not available yet');
        }
    };

    const showLocationDetails = () => {
        const { latitude, longitude, accuracy, timestamp } = currentLocation;

        if (!latitude || !longitude) {
            Alert.alert('No Location', 'GPS coordinates not available yet');
            return;
        }

        Alert.alert(
            'GPS Location Details',
            `📍 Latitude: ${latitude.toFixed(6)}\n` +
            `📍 Longitude: ${longitude.toFixed(6)}\n` +
            `🎯 Accuracy: ${Math.round(accuracy)} meters\n` +
            `⏰ Time: ${timestamp}\n\n` +
            `Tap "Open in Maps" to verify location`,
            [
                { text: 'Close' },
                {
                    text: 'Open in Maps',
                    onPress: openInGoogleMaps
                }
            ]
        );
    };

    const fetchWeatherByCoords = async (lat: number, lon: number) => {
        try {
            setIsLoadingWeather(true);
            console.log(`🌦️ Fetching weather for: ${lat}, ${lon}`);

            // ✅ Reverse Geocode to get actual location name
            let locationDetails = {
                area: null as string | null,
                district: null as string | null,
                city: null as string | null,
            };

            try {
                const reverseGeocode = await Location.reverseGeocodeAsync({
                    latitude: lat,
                    longitude: lon
                });

                if (reverseGeocode && reverseGeocode.length > 0) {
                    const location = reverseGeocode[0];
                    console.log("📍 Reverse Geocode Result:", {
                        street: location.street,
                        subregion: location.subregion,
                        district: location.district,
                        city: location.city,
                        region: location.region,
                        country: location.country,
                        isoCountryCode: location.isoCountryCode
                    });

                    locationDetails = {
                        area: location.subregion || location.street || location.name || null,
                        district: location.district || null,
                        city: location.city || null,
                    };

                    // Verify Pakistan
                    if (location.isoCountryCode !== 'PK' && location.country !== 'Pakistan') {
                        console.log(`⚠️ WARNING: Location is ${location.country}, not Pakistan!`);
                        Alert.alert(
                            'Wrong Location Detected',
                            `GPS shows: ${location.city || 'Unknown'}, ${location.country}\n\nUsing Gujranwala instead.`,
                            [{ text: 'OK' }]
                        );
                        fetchWeatherByCity("Gujranwala");
                        return;
                    }
                }
            } catch (reverseError) {
                console.log("⚠️ Reverse geocoding failed:", reverseError);
            }

            // ✅ Fetch Weather API
            const response = await fetch(
                `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}&units=metric`
            );

            const data = await response.json();

            console.log("📡 Weather API Response:", {
                city: data.name,
                country: data.sys.country,
                coordinates: data.coord,
            });


            if (data.cod === 200) {
                // ✅ Use simple city name (just the main city, no area/district)
                const finalLocation = data.name || locationDetails.city || 'Unknown';

                // Calculate the city's local time using timezone offset
                const cityLocalTime = new Date((Date.now() / 1000 + data.timezone) * 1000);
                const cityHour = cityLocalTime.getUTCHours();

                // Compare current UTC time with sunrise/sunset (both in UTC)
                const currentUtcTimestamp = Math.floor(Date.now() / 1000);
                const isNightTime = currentUtcTimestamp < data.sys.sunrise || currentUtcTimestamp > data.sys.sunset;

                console.log(`✅ Displaying: ${finalLocation}`);

                setWeather({
                    temp: Math.round(data.main.temp),
                    humidity: data.main.humidity,
                    weather: data.weather[0].main,
                    description: data.weather[0].description,
                    city: finalLocation,
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
            console.log('❌ Weather Error:', error);
            fetchWeatherByCity("Gujranwala");
        }
        setIsLoadingWeather(false);
    };

    const fetchWeatherByCity = async (cityName: string) => {
        try {
            setIsLoadingWeather(true);
            const response = await fetch(
                `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cityName)}&appid=${WEATHER_API_KEY}&units=metric`
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
            } else {
                console.log('City not found');
                setWeather(null);
            }
        } catch (error) {
            console.log('❌ Weather Error:', error);
            setWeather(null);
        }
        setIsLoadingWeather(false);
    };


    const uniquePlants = Array.from(new Map(plants.map(item => [item.id, item])).values());

    const handleGetLocationAndWeather = async () => {
        try {
            console.log("🔍 Starting location fetch...");

            const enabled = await Location.hasServicesEnabledAsync();
            if (!enabled) {
                Alert.alert(
                    'Location Services Off',
                    'Please enable GPS in your device settings',
                    [{ text: 'OK', onPress: () => fetchWeatherByCity("Gujranwala") }]
                );
                return;
            }

            let { status } = await Location.requestForegroundPermissionsAsync();

            if (status !== 'granted') {
                console.log("❌ Permission denied");
                fetchWeatherByCity("Gujranwala");
                return;
            }

            console.log("✅ Permission granted, getting location...");
            setWeather(prev => ({ ...prev, city: 'Getting GPS...' }));

            let location;
            const accuracyLevels = [
                { level: Location.Accuracy.BestForNavigation, name: 'Best', timeout: 25000 },
                { level: Location.Accuracy.Highest, name: 'Highest', timeout: 20000 },
                { level: Location.Accuracy.High, name: 'High', timeout: 15000 },
            ];

            for (const { level, name, timeout } of accuracyLevels) {
                try {
                    console.log(`📍 Trying ${name} accuracy...`);

                    location = await Location.getCurrentPositionAsync({
                        accuracy: level,
                        timeout: timeout,
                        maximumAge: 5000,
                    });

                    const { latitude, longitude, accuracy } = location.coords;

                    console.log(`✅ Got location with ${name}:`, {
                        lat: latitude,
                        lon: longitude,
                        accuracy: `${Math.round(accuracy)} meters`,
                    });

                    setCurrentLocation({
                        latitude,
                        longitude,
                        accuracy,
                        timestamp: new Date().toLocaleTimeString('en-PK', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                        }),
                    });

                    if (accuracy <= 5000) {
                        console.log("✅ Good accuracy, using this location");
                        break;
                    } else {
                        console.log(`⚠️ Low accuracy, trying next...`);
                    }
                } catch (err: any) {
                    console.log(`⚠️ ${name} failed:`, err.message);
                    continue;
                }
            }

            if (!location) {
                throw new Error("Could not get location");
            }

            const { latitude, longitude, accuracy } = location.coords;

            if (accuracy > 5000) {
                Alert.alert(
                    'Low GPS Accuracy',
                    `⚠️ GPS accuracy: ${Math.round(accuracy / 1000)}km\n\n` +
                    `Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}\n\n` +
                    `Tips to improve:\n` +
                    `• Go outside or near window\n` +
                    `• Turn ON WiFi\n` +
                    `• Wait 10-20 seconds`,
                    [
                        { text: 'View in Maps', onPress: () => Linking.openURL(`https://www.google.com/maps?q=${latitude},${longitude}`) },
                        { text: 'Use This', onPress: () => fetchWeatherByCoords(latitude, longitude) },
                        { text: 'Use Gujranwala', onPress: () => fetchWeatherByCity("Gujranwala") }
                    ]
                );
                return;
            }

            fetchWeatherByCoords(latitude, longitude);

        } catch (err: any) {
            console.error("❌ Location Error:", err.message);
            Alert.alert(
                'Location Error',
                'Could not get GPS location.\n\nUsing Gujranwala as default.',
                [{ text: 'OK' }]
            );
            fetchWeatherByCity("Gujranwala");
        }
    };

    useEffect(() => {
        // 1. Auth Listener: User ka naam set karne ke liye
        const authUnsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                const nameToShow = user.displayName || user.email?.split('@')[0] || 'Garden Lover';
                setUserName(nameToShow);
            }
        });

        // 2. Initial Data Load
        // Hum initial weather load karte hain
        handleGetLocationAndWeather();

        // 3. Animation Logic
        const bounce = Animated.loop(
            Animated.sequence([
                Animated.timing(bounceAnim, {
                    toValue: -8,
                    duration: 600, // Thora slow aur natural rakha hai
                    useNativeDriver: true
                }),
                Animated.timing(bounceAnim, {
                    toValue: 0,
                    duration: 600,
                    useNativeDriver: true
                }),
            ])
        );
        bounce.start();

        // 4. Cleanup Function
        // Jab user screen se bahar jaye toh memory leak na ho
        return () => {
            authUnsubscribe();
            bounce.stop();
        };
    }, []); // Empty array ka matlab sirf first mount par chalega

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.greeting}>Good Morning,</Text>
                        <Text style={styles.username}>{userName}</Text>
                    </View>
                    <View style={styles.headerButtons}>
                        <TouchableOpacity
                            style={styles.iconButton}
                            onPress={() => navigation.navigate('ChatList')}
                        >
                            <Feather name="message-circle" size={20} color={colors.text} />
                            {getTotalUnreadCount('customer') > 0 && (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>
                                        {getTotalUnreadCount('customer') > 9 ? '9+' : getTotalUnreadCount('customer')}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.iconButton}
                            onPress={() => navigation.navigate('Notifications')}
                        >
                            <Feather name="bell" size={20} color={colors.text} />
                            {unreadCount > 0 && (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>

                    </View>
                </View>

                {/* Weather Widget */}
                {isLoadingWeather ? (
                    <View style={styles.weatherLoadingCard}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.weatherLoadingText}>Getting weather...</Text>
                    </View>
                ) : weather ? (
                    <TouchableOpacity onPress={() => setShowLocationModal(true)} activeOpacity={0.9}>
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
                            localMinute={cityLiveTime?.minute ?? 0}
                        />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={styles.weatherErrorCard}
                        onPress={handleGetLocationAndWeather}
                    >
                        <Feather name="cloud-off" size={40} color="#9ca3af" />
                        <Text style={styles.weatherErrorText}>Unable to load weather</Text>
                        <Text style={styles.weatherRetryText}>Tap to retry</Text>
                    </TouchableOpacity>
                )}
                {/* Tasks Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Today's Reminders</Text>
                        <View style={styles.headerActions}>
                            <TouchableOpacity
                                style={styles.addTaskBtn}
                                onPress={() => setShowAddTaskModal(true)}
                            >
                                <Feather name="plus" size={16} color="#fff" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => navigation.navigate('Reminders' as never)}
                                style={styles.viewAllBtn}
                            >
                                <Text style={styles.viewAll}>View All</Text>
                                <Feather name="chevron-right" size={16} color={colors.primary} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.tasksCard}>
                        {loading ? (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyText}>Loading reminders...</Text>
                            </View>
                        ) : todayTasks.length > 0 ? (
                            <View>
                                {todayTasks.slice(0, 3).map((task, index) => {
                                    const canComplete = canCompleteTask(task);
                                    const timeRemaining = getTimeRemaining(task);

                                    return (
                                        <View
                                            key={`today-${task.id || index}`}
                                            style={[styles.taskItem]}
                                        >
                                            <TouchableOpacity
                                                style={styles.taskMainArea}
                                                onPress={() => handleTaskPress(task)}
                                            >
                                                <TaskTypeIcon type={task.taskType || 'water'} />
                                                <View style={styles.taskContent}>
                                                    <Text style={[styles.taskTitle]}>
                                                        {task.title}
                                                    </Text>
                                                    <Text style={styles.taskSubtitle}>
                                                        {task.plantName || 'General Care'}
                                                    </Text>
                                                    {/* Show time remaining for future tasks */}
                                                    {timeRemaining && (
                                                        <Text style={styles.taskTimeRemaining}>{timeRemaining}</Text>
                                                    )}
                                                </View>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => handleTaskPress(task)}
                                                style={!canComplete ? styles.checkboxDisabled : undefined}
                                            >
                                                <View style={[
                                                    styles.checkbox,
                                                    !canComplete && styles.checkboxLocked
                                                ]}>
                                                    {!canComplete ? (
                                                        <Feather name="clock" size={12} color={colors.textMuted} />
                                                    ) : null}
                                                </View>
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })}
                                {todayTasks.length > 3 && (
                                    <TouchableOpacity
                                        style={styles.showMoreBtn}
                                        onPress={() => navigation.navigate('Reminders' as never)}
                                    >
                                        <Text style={styles.showMoreText}>
                                            +{todayTasks.length - 3} more reminders
                                        </Text>
                                        <Feather name="arrow-right" size={14} color={colors.primary} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        ) : (
                            <View style={styles.emptyState}>
                                <Feather name="calendar" size={40} color={colors.textMuted} style={{ opacity: 0.5, marginBottom: spacing.md }} />
                                <Text style={styles.emptyText}>No reminders for today</Text>
                            </View>
                        )}
                    </View>
                </View>
                {/* My Garden Carousel */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>My Garden</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('MyPlants')}>
                            <Text style={styles.viewAll}>View All ({plants.length})</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.carousel}
                    >
                        {uniquePlants.length > 0 ? (
                            <>
                                {uniquePlants.map((plant) => (
                                    <TouchableOpacity
                                        key={plant.id}
                                        style={styles.plantCard}
                                        onPress={() => navigation.navigate('PlantDetail', { plantId: plant.id })}
                                    >
                                        <View style={styles.plantImageContainer}>
                                            {plant.image ? (
                                                <Image source={{ uri: plant.image }} style={styles.plantImage} />
                                            ) : (
                                                <View style={styles.plantImagePlaceholder}>
                                                    <Feather name="feather" size={30} color={colors.primary} />
                                                </View>
                                            )}
                                        </View>
                                        <Text style={styles.plantName} numberOfLines={1}>{plant.name}</Text>
                                        <Text style={styles.plantSpecies} numberOfLines={1}>{plant.species}</Text>
                                    </TouchableOpacity>
                                ))}

                                {/* Add Plant Card - jab plants hain */}
                                <TouchableOpacity
                                    style={styles.addPlantCard}
                                    onPress={() => navigation.navigate('AddPlant')}
                                >
                                    <View style={styles.addPlantIcon}>
                                        <Feather name="plus" size={24} color={colors.primary} />
                                    </View>
                                    <Text style={styles.addPlantText}>Add Plant</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                {/* Empty Garden Card - jab koi plant nahi */}
                                <View style={styles.emptyGardenCard}>
                                    <Feather name="inbox" size={40} color="#cbd5e1" style={{ marginBottom: spacing.sm }} />
                                    <Text style={styles.emptyGardenText}>No plants yet</Text>
                                    <Text style={styles.emptyGardenSubtext}>Start your garden!</Text>
                                </View>

                                {/* Add Plant Card - jab koi plant nahi */}
                                <TouchableOpacity
                                    style={styles.addPlantCard}
                                    onPress={() => navigation.navigate('AddPlant')}
                                >
                                    <View style={styles.addPlantIcon}>
                                        <Feather name="plus" size={24} color={colors.primary} />
                                    </View>
                                    <Text style={styles.addPlantText}>Add Plant</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </ScrollView>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView >

            {/* Location Selection Modal */}
            < Modal visible={showLocationModal} animationType="fade" transparent onRequestClose={() => setShowLocationModal(false)
            }>
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
            </Modal >

            {/* Add Task Modal */}
            < Modal
                visible={showAddTaskModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowAddTaskModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.taskModalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add New Reminder</Text>
                            <TouchableOpacity onPress={() => setShowAddTaskModal(false)}>
                                <Feather name="x" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        {/* Plant Picker */}
                        <Text style={styles.inputLabel}>Select Plant</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.plantPicker}>
                            {plants.map((plant) => (
                                <TouchableOpacity
                                    key={plant.id}
                                    style={[
                                        styles.plantOption,
                                        taskPlantId === plant.id && styles.plantOptionSelected
                                    ]}
                                    onPress={() => setTaskPlantId(plant.id)}
                                >
                                    <Image source={{ uri: plant.image }} style={styles.plantOptionImage} />
                                    <Text style={styles.plantOptionName}>{plant.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* Task Type Picker */}
                        <Text style={styles.inputLabel}>Task Type</Text>
                        <View style={styles.taskTypeRow}>
                            {(['water', 'fertilize', 'prune', 'rotate', 'clean', 'custom'] as (TaskType | 'custom')[]).map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[
                                        styles.taskTypeBtn,
                                        taskType === type && styles.taskTypeBtnSelected
                                    ]}
                                    onPress={() => setTaskType(type)}
                                >
                                    <Feather
                                        name={type === 'water' ? 'droplet' : type === 'fertilize' ? 'sun' : type === 'prune' ? 'scissors' : type === 'rotate' ? 'rotate-cw' : type === 'clean' ? 'star' : 'edit-2'}
                                        size={18}
                                        color={taskType === type ? '#fff' : colors.primary}
                                    />
                                    <Text style={[styles.taskTypeBtnText, taskType === type && { color: '#fff' }]}>
                                        {type === 'custom' ? 'Custom' : type.charAt(0).toUpperCase() + type.slice(1)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Custom Task Name Input */}
                        {taskType === 'custom' && (
                            <TextInput
                                style={styles.customTaskInput}
                                placeholder="Enter custom task name..."
                                placeholderTextColor={colors.textMuted}
                                value={customTaskName}
                                onChangeText={setCustomTaskName}
                            />
                        )}

                        {/* Repeat Frequency Picker */}
                        <Text style={styles.inputLabel}>Repeat Frequency</Text>
                        <View style={styles.frequencyRow}>
                            {([
                                { key: 'once', label: 'Once', icon: 'circle' },
                                { key: 'daily', label: 'Daily', icon: 'sun' },
                                { key: 'every-3-days', label: '3 Days', icon: 'calendar' },
                                { key: 'weekly', label: 'Weekly', icon: 'repeat' },
                                { key: 'monthly', label: 'Monthly', icon: 'calendar' },
                                { key: 'custom', label: 'Custom', icon: 'edit-3' },
                            ] as { key: typeof repeatFrequency; label: string; icon: any }[]).map((freq) => (
                                <TouchableOpacity
                                    key={freq.key}
                                    style={[
                                        styles.frequencyBtn,
                                        repeatFrequency === freq.key && styles.frequencyBtnSelected
                                    ]}
                                    onPress={() => setRepeatFrequency(freq.key)}
                                >
                                    <Feather
                                        name={freq.icon}
                                        size={14}
                                        color={repeatFrequency === freq.key ? '#fff' : colors.primary}
                                    />
                                    <Text style={[styles.frequencyBtnText, repeatFrequency === freq.key && { color: '#fff' }]}>
                                        {freq.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Custom Days Input */}
                        {repeatFrequency === 'custom' && (
                            <View style={styles.customDaysRow}>
                                <Text style={styles.customDaysLabel}>Repeat every</Text>
                                <TextInput
                                    style={styles.customDaysInput}
                                    placeholder="7"
                                    placeholderTextColor={colors.textMuted}
                                    keyboardType="numeric"
                                    value={customDays}
                                    onChangeText={setCustomDays}
                                />
                                <Text style={styles.customDaysLabel}>days</Text>
                            </View>
                        )}

                        {/* Date/Time Picker */}
                        <Text style={styles.inputLabel}>Reminder Date & Time</Text>
                        <View style={styles.dateTimeRow}>
                            <TouchableOpacity
                                style={styles.dateTimeBtn}
                                onPress={() => setShowDatePicker(true)}
                            >
                                <Feather name="calendar" size={18} color={colors.primary} />
                                <Text style={styles.dateTimeText}>
                                    {reminderDate.toLocaleDateString()}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.dateTimeBtn}
                                onPress={() => setShowTimePicker(true)}
                            >
                                <Feather name="clock" size={18} color={colors.primary} />
                                <Text style={styles.dateTimeText}>
                                    {reminderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {showDatePicker && (
                            <DateTimePicker
                                value={reminderDate}
                                mode="date"
                                display="default"
                                minimumDate={new Date()}
                                onChange={(event, date) => {
                                    setShowDatePicker(false);
                                    if (date) setReminderDate(date);
                                }}
                            />
                        )}

                        {showTimePicker && (
                            <DateTimePicker
                                value={reminderDate}
                                mode="time"
                                display="default"
                                onChange={(event, date) => {
                                    setShowTimePicker(false);
                                    if (date) setReminderDate(date);
                                }}
                            />
                        )}

                        {/* Submit Button */}
                        <TouchableOpacity
                            style={styles.submitTaskBtn}
                            onPress={async () => {
                                if (taskPlantId === 'none') {
                                    Alert.alert('Select Plant', 'Please select a plant first');
                                    return;
                                }
                                if (taskType === 'custom' && !customTaskName.trim()) {
                                    Alert.alert('Reminder Name Required', 'Please enter a custom reminder name');
                                    return;
                                }
                                if (repeatFrequency === 'custom' && !customDays.trim()) {
                                    Alert.alert('Custom Days Required', 'Please enter number of days');
                                    return;
                                }
                                const plant = plants.find(p => p.id === taskPlantId);
                                if (!plant) return;

                                const taskTitleText = taskType === 'custom'
                                    ? `${customTaskName} - ${plant.name}`
                                    : `${taskType.charAt(0).toUpperCase() + taskType.slice(1)} ${plant.name}`;

                                // Convert frequency to TaskFrequency format
                                const frequencyMap: Record<string, TaskFrequency> = {
                                    'once': 'once',
                                    'daily': 'daily',
                                    'every-3-days': 'every-2-days', // Closest available
                                    'weekly': 'weekly',
                                    'monthly': 'monthly',
                                    'custom': 'weekly', // Will handle via customDays
                                };

                                await addTask({
                                    title: taskTitleText,
                                    plantId: plant.id,
                                    plantName: plant.name,
                                    taskType: taskType === 'custom' ? 'custom' : taskType,
                                    dueDate: reminderDate.toDateString() === new Date().toDateString() ? 'Today' :
                                        reminderDate.toDateString() === new Date(Date.now() + 86400000).toDateString() ? 'Tomorrow' : 'Later',
                                    reminderDateTime: reminderDate,
                                    frequency: frequencyMap[repeatFrequency] || 'once',
                                    isRecurring: repeatFrequency !== 'once',
                                });

                                // Fire immediate confirmation notification
                                await triggerTestNotification();

                                // Schedule local push notification at reminder time
                                const reminderBody = taskType === 'custom'
                                    ? `${customTaskName} for ${plant.name}!`
                                    : `Time to ${taskType} ${plant.name}!`;

                                await scheduleReminderNotification(
                                    `🌱 Plant Reminder`,
                                    reminderBody,
                                    reminderDate
                                );

                                // Create lightweight in-app notification (just for notification list)
                                const user = auth.currentUser;
                                if (user) {
                                    const reminderDesc = taskType === 'custom'
                                        ? `${customTaskName} for ${plant.name}`
                                        : `Time to ${taskType} ${plant.name}`;
                                    const dateStr = reminderDate.toLocaleDateString();
                                    const timeStr = reminderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                    await addDoc(collection(db, 'notifications'), {
                                        userId: user.uid,
                                        title: `🌱 Reminder: ${taskTitleText}`,
                                        description: `${reminderDesc} — ${dateStr} at ${timeStr}${repeatFrequency !== 'once' ? ` (Repeats ${repeatFrequency})` : ''}`,
                                        type: 'reminder',
                                        read: false,
                                        isRead: false,
                                        time: serverTimestamp(),
                                        createdAt: serverTimestamp(),
                                    });
                                }

                                // Reset form
                                setShowAddTaskModal(false);
                                setTaskPlantId('none');
                                setTaskType('water');
                                setCustomTaskName('');
                                setRepeatFrequency('once');
                                setCustomDays('');
                                setReminderDate(new Date());
                                Alert.alert('Success', `Reminder added${repeatFrequency !== 'once' ? ` (Repeats ${repeatFrequency})` : ''}!`);
                            }}
                        >
                            <Feather name="check" size={20} color="#fff" />
                            <Text style={styles.submitTaskBtnText}>Add Reminder</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal >

            {/* Task Completion Confirmation Modal */}
            < Modal
                visible={showConfirmModal}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setShowConfirmModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.confirmModalContent}>
                        <View style={styles.confirmIconContainer}>
                            <Feather name="check-circle" size={48} color={colors.primary} />
                        </View>
                        <Text style={styles.confirmTitle}>Complete Reminder?</Text>
                        <Text style={styles.confirmMessage}>
                            Did you complete "{confirmTaskTitle}"?
                        </Text>
                        <View style={styles.confirmButtonRow}>
                            <TouchableOpacity
                                style={styles.confirmCancelBtn}
                                onPress={() => {
                                    setShowConfirmModal(false);
                                    setConfirmTaskId(null);
                                    setConfirmTaskTitle('');
                                }}
                            >
                                <Feather name="x" size={18} color={colors.text} />
                                <Text style={styles.confirmCancelText}>Not Yet</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.confirmOkBtn}
                                onPress={confirmTaskCompletion}
                            >
                                <Feather name="check" size={18} color="#fff" />
                                <Text style={styles.confirmOkText}>Yes, Done!</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal >

            {/* Edit Task Modal */}
            < Modal
                visible={showEditModal}
                animationType="slide"
                transparent={true}
                onRequestClose={closeEditModal}
            >
                <View style={styles.modalOverlay}>
                    <TouchableOpacity
                        style={styles.editModalBackdrop}
                        activeOpacity={1}
                        onPress={closeEditModal}
                    />
                    <View style={styles.editModalContent}>
                        {/* Modal Header */}
                        <View style={styles.editModalHeader}>
                            <Text style={styles.editModalTitle}>Edit Reminder</Text>
                            <TouchableOpacity onPress={closeEditModal} style={styles.editCloseBtn}>
                                <Feather name="x" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        {/* Task Name Input */}
                        <View style={styles.editInputGroup}>
                            <Text style={styles.inputLabel}>Reminder Name</Text>
                            <TextInput
                                style={styles.editTaskInput}
                                value={editTaskTitle}
                                onChangeText={setEditTaskTitle}
                                placeholder="Enter reminder name"
                                placeholderTextColor={colors.textMuted}
                            />
                        </View>

                        {/* Date & Time Row */}
                        <View style={styles.editDateTimeRow}>
                            {/* Date Picker */}
                            <View style={styles.editDateTimeGroup}>
                                <Text style={styles.inputLabel}>Date</Text>
                                <TouchableOpacity
                                    style={styles.editDateTimeBtn}
                                    onPress={() => {
                                        setShowEditTimePicker(false);
                                        setShowEditDatePicker(true);
                                    }}
                                >
                                    <Feather name="calendar" size={18} color={colors.primary} />
                                    <Text style={styles.editDateTimeBtnText}>
                                        {editTaskDate.toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Time Picker */}
                            <View style={styles.editDateTimeGroup}>
                                <Text style={styles.inputLabel}>Time</Text>
                                <TouchableOpacity
                                    style={styles.editDateTimeBtn}
                                    onPress={() => {
                                        setShowEditDatePicker(false);
                                        setShowEditTimePicker(true);
                                    }}
                                >
                                    <Feather name="clock" size={18} color={colors.primary} />
                                    <Text style={styles.editDateTimeBtnText}>
                                        {editTaskTime.toLocaleTimeString('en-US', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Date Picker Component */}
                        {showEditDatePicker && (
                            <DateTimePicker
                                value={editTaskDate}
                                mode="date"
                                display="default"
                                minimumDate={new Date()}
                                onChange={(event, date) => {
                                    setShowEditDatePicker(false);
                                    if (date) setEditTaskDate(date);
                                }}
                            />
                        )}

                        {/* Time Picker Component */}
                        {showEditTimePicker && (
                            <DateTimePicker
                                value={editTaskTime}
                                mode="time"
                                display="default"
                                onChange={(event, time) => {
                                    setShowEditTimePicker(false);
                                    if (time) setEditTaskTime(time);
                                }}
                            />
                        )}

                        {/* Save Button */}
                        <TouchableOpacity
                            style={styles.editSaveBtn}
                            onPress={saveEditedTask}
                        >
                            <Feather name="check" size={18} color="#fff" />
                            <Text style={styles.editSaveBtnText}>Save Changes</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal >
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, paddingTop: spacing.xl },
    greeting: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: '500' },
    username: { fontSize: fontSize['2xl'], fontWeight: 'bold', color: colors.text, marginTop: 4 },
    bellButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    headerButtons: { flexDirection: 'row', gap: spacing.sm },
    iconButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, position: 'relative' },
    badge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#ef4444', minWidth: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: '#fff' },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    weatherCard: { marginHorizontal: spacing.lg, padding: spacing.lg, borderRadius: borderRadius.xl, marginBottom: spacing.lg, position: 'relative', overflow: 'hidden', shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 8 },
    weatherContent: { flexDirection: 'row', justifyContent: 'space-between' },
    weatherLeft: { flex: 1 },
    weatherInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
    weatherType: { color: '#fff', fontWeight: '500' },
    temperature: { fontSize: 40, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
    humidity: { color: 'rgba(255,255,255,0.8)', fontSize: fontSize.sm },
    gpsInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
    gpsText: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 11,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        marginHorizontal: 6,
    },
    locationBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full, alignSelf: 'flex-start' },
    locationText: { color: '#fff', fontSize: fontSize.xs, fontWeight: '500' },
    actionButtons: {
        flexDirection: 'row',
        marginTop: 8,
        gap: 8,
    },
    actionButton: {
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 20,
    },
    section: { marginBottom: spacing.xl },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
    sectionTitle: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text },
    pendingBadge: { backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.sm },
    pendingText: { color: colors.primary, fontSize: fontSize.xs, fontWeight: '500' },
    pendingText: { color: colors.primary, fontSize: fontSize.xs, fontWeight: '500' },
    viewAll: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '500', marginRight: 4 },
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

    emptyGardenCard: {
        width: 160,
        height: 250,
        backgroundColor: '#fff',
        borderRadius: borderRadius.xl,
        padding: spacing.md,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
        borderWidth: 1,
        borderColor: '#e2e8f0',

    },
    emptyGardenText: {
        fontSize: fontSize.base,
        color: colors.text,
        fontWeight: '600',
        marginBottom: 4,
    },
    emptyGardenSubtext: {
        fontSize: fontSize.sm,
        color: '#64748b',
    },
    weatherLoadingCard: {
        marginHorizontal: spacing.lg,
        padding: spacing.xl,
        borderRadius: borderRadius.xl,
        marginBottom: spacing.lg,
        backgroundColor: 'rgba(16,185,129,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 160,
    },
    weatherLoadingText: {
        marginTop: spacing.md,
        color: colors.primary,
        fontSize: fontSize.sm,
        fontWeight: '500',
    },
    weatherErrorCard: {
        marginHorizontal: spacing.lg,
        padding: spacing.xl,
        borderRadius: borderRadius.xl,
        marginBottom: spacing.lg,
        backgroundColor: '#f8f9fa',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 160,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    weatherErrorText: {
        marginTop: spacing.md,
        color: '#6b7280',
        fontSize: fontSize.base,
        fontWeight: '500',
    },
    weatherRetryText: {
        marginTop: spacing.xs,
        color: colors.primary,
        fontSize: fontSize.sm,
    },
    // Location Modal Styles
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
    // Task Modal & Grouped Tasks Styles
    taskModalContent: { backgroundColor: colors.background, borderRadius: borderRadius.xl, padding: spacing.lg, width: '90%', maxWidth: 400, maxHeight: '85%' },
    addTaskBtnText: { color: '#fff', fontSize: fontSize.sm, fontWeight: '600' },
    taskGroup: { marginBottom: spacing.md },
    taskGroupTitle: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textMuted, marginBottom: spacing.sm },
    plantPicker: { marginBottom: spacing.md },
    plantOption: { alignItems: 'center', marginRight: spacing.md, padding: spacing.sm, borderRadius: borderRadius.lg, borderWidth: 2, borderColor: 'transparent' },
    plantOptionSelected: { borderColor: colors.primary, backgroundColor: 'rgba(16,185,129,0.1)' },
    plantOptionImage: { width: 60, height: 60, borderRadius: 30, marginBottom: spacing.xs },
    plantOptionName: { fontSize: fontSize.xs, color: colors.text, fontWeight: '500', maxWidth: 70, textAlign: 'center' },
    taskTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
    taskTypeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.primary, backgroundColor: '#fff' },
    taskTypeBtnSelected: { backgroundColor: colors.primary },
    taskTypeBtnText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.primary },
    dateTimeRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
    dateTimeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: '#fff', borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border },
    dateTimeText: { fontSize: fontSize.sm, color: colors.text, fontWeight: '500' },
    submitTaskBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, padding: spacing.md, borderRadius: borderRadius.lg, marginTop: spacing.md },
    submitTaskBtnText: { color: '#fff', fontSize: fontSize.base, fontWeight: '600' },
    // Custom Task & Frequency Styles
    customTaskInput: { backgroundColor: '#fff', borderRadius: borderRadius.md, padding: spacing.md, fontSize: fontSize.base, borderWidth: 1, borderColor: colors.primary, color: colors.text, marginBottom: spacing.md },
    frequencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
    frequencyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.primary, backgroundColor: '#fff' },
    frequencyBtnSelected: { backgroundColor: colors.primary },
    frequencyBtnText: { fontSize: 10, fontWeight: '600', color: colors.primary },
    customDaysRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md, padding: spacing.sm, backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: borderRadius.md },
    customDaysLabel: { fontSize: fontSize.sm, color: colors.text, fontWeight: '500' },
    customDaysInput: { width: 50, backgroundColor: '#fff', borderRadius: borderRadius.sm, padding: spacing.sm, fontSize: fontSize.base, borderWidth: 1, borderColor: colors.primary, textAlign: 'center', color: colors.text },
    // Confirmation Modal Styles
    confirmModalContent: { backgroundColor: colors.background, borderRadius: borderRadius.xl, padding: spacing.xl, width: '85%', maxWidth: 340, alignItems: 'center' },
    confirmIconContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(16,185,129,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
    confirmTitle: { fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text, marginBottom: spacing.sm },
    confirmMessage: { fontSize: fontSize.base, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 22 },
    confirmButtonRow: { flexDirection: 'row', gap: spacing.md, width: '100%' },
    confirmCancelBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: '#f3f4f6', padding: spacing.md, borderRadius: borderRadius.lg },
    confirmCancelText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
    confirmOkBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.primary, padding: spacing.md, borderRadius: borderRadius.lg },
    confirmOkText: { fontSize: fontSize.sm, fontWeight: '600', color: '#fff' },
    // Header Actions & Task Styles
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    addTaskBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
    viewAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    taskMainArea: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    taskEditBtn: { padding: spacing.sm, marginRight: spacing.xs },
    taskTimeRemaining: { fontSize: fontSize.xs, color: '#f59e0b', fontWeight: '500', marginTop: 2 },
    checkboxDisabled: { opacity: 0.5 },
    checkboxLocked: { backgroundColor: '#f3f4f6', borderColor: colors.border },
    showMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.sm, marginTop: spacing.xs, backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: borderRadius.md },
    showMoreText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.primary },
    // Edit Modal Styles
    editModalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    editModalContent: { backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: spacing.xl + 20 },
    editModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    editModalTitle: { fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text },
    editCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },
    editInputGroup: { marginBottom: spacing.lg },
    editTaskInput: { backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing.md, fontSize: fontSize.base, borderWidth: 1, borderColor: colors.border, color: colors.text },
    editDateTimeRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
    editDateTimeGroup: { flex: 1 },
    editDateTimeBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
    editDateTimeBtnText: { fontSize: fontSize.base, color: colors.text, fontWeight: '500' },
    editSaveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, padding: spacing.md, borderRadius: borderRadius.lg, marginTop: spacing.md },
    editSaveBtnText: { fontSize: fontSize.base, fontWeight: '600', color: '#fff' },
});
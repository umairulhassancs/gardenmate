import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../theme';

const { width } = Dimensions.get('window');

interface WeatherCardProps {
    weather: string;
    description: string;
    temp: number;
    humidity: number;
    city: string;
    country: string;
    icon: string;
    isNight?: boolean;
    plantTip: string;
    localTime?: number; // Hour 0-23
    localMinute?: number; // Minute 0-59
}

// Animated Sun Rays Component
const SunRays = () => {
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // Rotate animation
        Animated.loop(
            Animated.timing(rotateAnim, {
                toValue: 1,
                duration: 20000,
                useNativeDriver: true,
            })
        ).start();

        // Pulse animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.2, duration: 2000, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    const rotation = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <Animated.View style={[styles.sunContainer, { transform: [{ rotate: rotation }, { scale: pulseAnim }] }]}>
            {[...Array(8)].map((_, i) => (
                <View key={i} style={[styles.sunRay, { transform: [{ rotate: `${i * 45}deg` }] }]} />
            ))}
            <View style={styles.sunCore} />
        </Animated.View>
    );
};

// Animated Rain Drops Component - Enhanced with wind and varied sizes
const RainDrops = () => {
    const drops = [...Array(25)].map((_, i) => {
        const animValue = useRef(new Animated.Value(0)).current;
        const delay = i * 80;
        const left = (i * 17 + Math.random() * 10) % 100;
        const isHeavy = i % 3 === 0; // Every 3rd drop is heavier

        useEffect(() => {
            Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(animValue, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(animValue, {
                        toValue: 0,
                        duration: 0,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        }, []);

        const translateY = animValue.interpolate({
            inputRange: [0, 1],
            outputRange: [-20, 180],
        });

        const translateX = animValue.interpolate({
            inputRange: [0, 1],
            outputRange: [0, isHeavy ? 15 : 8], // Wind effect
        });

        const opacity = animValue.interpolate({
            inputRange: [0, 0.3, 0.7, 1],
            outputRange: [0, 0.9, 0.7, 0],
        });

        return (
            <Animated.View
                key={i}
                style={[
                    styles.rainDrop,
                    {
                        left: `${left}%`,
                        height: isHeavy ? 18 : 12,
                        width: isHeavy ? 2.5 : 1.5,
                        backgroundColor: isHeavy ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.35)',
                        transform: [{ translateY }, { translateX }, { rotate: '15deg' }],
                        opacity,
                    },
                ]}
            />
        );
    });

    return <View style={styles.rainContainer}>{drops}</View>;
};

// Lightning Flash Effect for Thunderstorm
const Lightning = () => {
    const flashOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const triggerLightning = () => {
            // Random delay between lightning strikes (2-6 seconds)
            const delay = 2000 + Math.random() * 4000;

            setTimeout(() => {
                // Double flash effect
                Animated.sequence([
                    Animated.timing(flashOpacity, { toValue: 0.9, duration: 50, useNativeDriver: true }),
                    Animated.timing(flashOpacity, { toValue: 0.2, duration: 50, useNativeDriver: true }),
                    Animated.timing(flashOpacity, { toValue: 1, duration: 100, useNativeDriver: true }),
                    Animated.timing(flashOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
                ]).start(() => triggerLightning());
            }, delay);
        };

        triggerLightning();
    }, []);

    return (
        <Animated.View style={[styles.lightningOverlay, { opacity: flashOpacity }]}>
            {/* Lightning bolt shape */}
            <View style={styles.lightningBolt}>
                <View style={styles.boltSegment1} />
                <View style={styles.boltSegment2} />
                <View style={styles.boltSegment3} />
            </View>
        </Animated.View>
    );
};

// Falling Snowflakes Animation - Smooth continuous
const Snowflakes = () => {
    const flakes = [...Array(20)].map((_, i) => {
        const animValue = useRef(new Animated.Value(0)).current;
        const swayAnim = useRef(new Animated.Value(0)).current;
        // Spread flakes across the screen
        const left = (i * 19 + 5) % 100;
        const size = 6 + (i % 4) * 2; // 6, 8, 10, 12
        const duration = 3000 + (i % 5) * 500; // Vary speed
        const startDelay = (i * 200) % 2000; // Stagger start

        useEffect(() => {
            // Initial delay then continuous loop
            const timeout = setTimeout(() => {
                // Continuous fall animation
                Animated.loop(
                    Animated.sequence([
                        Animated.timing(animValue, {
                            toValue: 1,
                            duration,
                            useNativeDriver: true,
                        }),
                        Animated.timing(animValue, {
                            toValue: 0,
                            duration: 0, // Instant reset
                            useNativeDriver: true,
                        }),
                    ])
                ).start();
            }, startDelay);

            // Continuous sway animation
            Animated.loop(
                Animated.sequence([
                    Animated.timing(swayAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
                    Animated.timing(swayAnim, { toValue: -1, duration: 1200, useNativeDriver: true }),
                ])
            ).start();

            return () => clearTimeout(timeout);
        }, []);

        const translateY = animValue.interpolate({
            inputRange: [0, 1],
            outputRange: [-30, 180],
        });

        const translateX = swayAnim.interpolate({
            inputRange: [-1, 1],
            outputRange: [-12, 12],
        });

        const rotate = swayAnim.interpolate({
            inputRange: [-1, 1],
            outputRange: ['-20deg', '20deg'],
        });

        const opacity = animValue.interpolate({
            inputRange: [0, 0.05, 0.85, 1],
            outputRange: [0, 1, 1, 0],
        });

        return (
            <Animated.Text
                key={i}
                style={[
                    styles.snowflake,
                    {
                        left: `${left}%`,
                        fontSize: size,
                        transform: [{ translateY }, { translateX }, { rotate }],
                        opacity,
                    },
                ]}
            >
                ❄️
            </Animated.Text>
        );
    });

    return <View style={styles.snowContainer}>{flakes}</View>;
};

// Animated Stars Component (Night)
const Stars = () => {
    const stars = [...Array(20)].map((_, i) => {
        const twinkleAnim = useRef(new Animated.Value(0.3)).current;
        const delay = i * 200;

        useEffect(() => {
            Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(twinkleAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
                    Animated.timing(twinkleAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
                ])
            ).start();
        }, []);

        return (
            <Animated.View
                key={i}
                style={[
                    styles.star,
                    {
                        left: `${(i * 17) % 90}%`,
                        top: `${(i * 23) % 70}%`,
                        opacity: twinkleAnim,
                        width: i % 3 === 0 ? 3 : 2,
                        height: i % 3 === 0 ? 3 : 2,
                    },
                ]}
            />
        );
    });

    return <View style={styles.starsContainer}>{stars}</View>;
};

// Professional Fog Effect - Gradient overlay with breathing animation
const Fog = () => {
    const opacity1 = useRef(new Animated.Value(0.4)).current;
    const opacity2 = useRef(new Animated.Value(0.2)).current;
    const opacity3 = useRef(new Animated.Value(0.3)).current;
    const scale1 = useRef(new Animated.Value(1)).current;
    const translateY = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Breathing opacity animation for layer 1
        Animated.loop(
            Animated.sequence([
                Animated.timing(opacity1, { toValue: 0.6, duration: 3000, useNativeDriver: true }),
                Animated.timing(opacity1, { toValue: 0.3, duration: 3000, useNativeDriver: true }),
            ])
        ).start();

        // Layer 2 opacity
        Animated.loop(
            Animated.sequence([
                Animated.timing(opacity2, { toValue: 0.4, duration: 4000, useNativeDriver: true }),
                Animated.timing(opacity2, { toValue: 0.15, duration: 4000, useNativeDriver: true }),
            ])
        ).start();

        // Layer 3 opacity
        Animated.loop(
            Animated.sequence([
                Animated.timing(opacity3, { toValue: 0.5, duration: 2500, useNativeDriver: true }),
                Animated.timing(opacity3, { toValue: 0.2, duration: 2500, useNativeDriver: true }),
            ])
        ).start();

        // Subtle scale breathing
        Animated.loop(
            Animated.sequence([
                Animated.timing(scale1, { toValue: 1.05, duration: 5000, useNativeDriver: true }),
                Animated.timing(scale1, { toValue: 1, duration: 5000, useNativeDriver: true }),
            ])
        ).start();

        // Slow vertical drift
        Animated.loop(
            Animated.sequence([
                Animated.timing(translateY, { toValue: 8, duration: 6000, useNativeDriver: true }),
                Animated.timing(translateY, { toValue: -8, duration: 6000, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    return (
        <View style={styles.fogContainer}>
            {/* Full gradient overlay */}
            <LinearGradient
                colors={['transparent', 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0.25)', 'rgba(255,255,255,0.15)', 'transparent']}
                style={styles.fogGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
            />
            {/* Animated fog layers using subtle gradients */}
            <Animated.View style={[styles.fogLayerWrap, { opacity: opacity1, transform: [{ scale: scale1 }, { translateY }] }]}>
                <LinearGradient
                    colors={['transparent', 'rgba(255,255,255,0.3)', 'transparent']}
                    style={[styles.fogStripe, { top: '20%' }]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                />
            </Animated.View>
            <Animated.View style={[styles.fogLayerWrap, { opacity: opacity2 }]}>
                <LinearGradient
                    colors={['transparent', 'rgba(255,255,255,0.25)', 'transparent']}
                    style={[styles.fogStripe, { top: '50%', height: 35 }]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                />
            </Animated.View>
            <Animated.View style={[styles.fogLayerWrap, { opacity: opacity3 }]}>
                <LinearGradient
                    colors={['transparent', 'rgba(255,255,255,0.2)', 'transparent']}
                    style={[styles.fogStripe, { top: '75%', height: 25 }]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                />
            </Animated.View>
        </View>
    );
};

// Professional Cloud Effect - Using emoji clouds with smooth animations
const Clouds = () => {
    const cloud1X = useRef(new Animated.Value(0)).current;
    const cloud2X = useRef(new Animated.Value(0)).current;
    const cloud3X = useRef(new Animated.Value(0)).current;
    const cloud1Scale = useRef(new Animated.Value(1)).current;
    const cloud2Scale = useRef(new Animated.Value(1)).current;
    const cloud1Opacity = useRef(new Animated.Value(0.8)).current;

    useEffect(() => {
        // Main cloud - slow horizontal drift
        Animated.loop(
            Animated.sequence([
                Animated.timing(cloud1X, { toValue: 40, duration: 15000, useNativeDriver: true }),
                Animated.timing(cloud1X, { toValue: -40, duration: 15000, useNativeDriver: true }),
            ])
        ).start();

        // Main cloud scale pulse
        Animated.loop(
            Animated.sequence([
                Animated.timing(cloud1Scale, { toValue: 1.1, duration: 4000, useNativeDriver: true }),
                Animated.timing(cloud1Scale, { toValue: 1, duration: 4000, useNativeDriver: true }),
            ])
        ).start();

        // Main cloud opacity pulse
        Animated.loop(
            Animated.sequence([
                Animated.timing(cloud1Opacity, { toValue: 1, duration: 3000, useNativeDriver: true }),
                Animated.timing(cloud1Opacity, { toValue: 0.7, duration: 3000, useNativeDriver: true }),
            ])
        ).start();

        // Second cloud - medium speed, opposite direction
        Animated.loop(
            Animated.sequence([
                Animated.timing(cloud2X, { toValue: -30, duration: 12000, useNativeDriver: true }),
                Animated.timing(cloud2X, { toValue: 30, duration: 12000, useNativeDriver: true }),
            ])
        ).start();

        // Second cloud scale
        Animated.loop(
            Animated.sequence([
                Animated.timing(cloud2Scale, { toValue: 1.15, duration: 5000, useNativeDriver: true }),
                Animated.timing(cloud2Scale, { toValue: 0.95, duration: 5000, useNativeDriver: true }),
            ])
        ).start();

        // Third cloud - slow background
        Animated.loop(
            Animated.sequence([
                Animated.timing(cloud3X, { toValue: 20, duration: 18000, useNativeDriver: true }),
                Animated.timing(cloud3X, { toValue: -20, duration: 18000, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    return (
        <View style={styles.cloudsContainer}>
            {/* Background cloud - small, faint */}
            <Animated.Text
                style={[
                    styles.cloudEmoji,
                    {
                        top: 50,
                        right: 120,
                        fontSize: 30,
                        opacity: 0.4,
                        transform: [{ translateX: cloud3X }]
                    }
                ]}
            >
                ☁️
            </Animated.Text>

            {/* Secondary cloud */}
            <Animated.Text
                style={[
                    styles.cloudEmoji,
                    {
                        top: 25,
                        right: 70,
                        fontSize: 45,
                        opacity: 0.6,
                        transform: [{ translateX: cloud2X }, { scale: cloud2Scale }]
                    }
                ]}
            >
                ☁️
            </Animated.Text>

            {/* Main cloud - largest, most prominent */}
            <Animated.Text
                style={[
                    styles.cloudEmoji,
                    {
                        top: 5,
                        right: 10,
                        fontSize: 60,
                        opacity: cloud1Opacity,
                        transform: [{ translateX: cloud1X }, { scale: cloud1Scale }]
                    }
                ]}
            >
                ☁️
            </Animated.Text>

            {/* Extra small accent cloud */}
            <Animated.Text
                style={[
                    styles.cloudEmoji,
                    {
                        top: 60,
                        right: 30,
                        fontSize: 25,
                        opacity: 0.3,
                        transform: [{ translateX: Animated.multiply(cloud1X, -0.5) }]
                    }
                ]}
            >
                ☁️
            </Animated.Text>
        </View>
    );
};

// Get gradient colors based on weather
const getGradientColors = (weather: string, isNight: boolean): readonly [string, string, string] => {
    if (isNight) {
        return ['#1a1a2e', '#16213e', '#0f3460'] as const;
    }

    switch (weather) {
        case 'Clear':
            return ['#f59e0b', '#ea580c', '#dc2626'] as const;
        case 'Rain':
        case 'Drizzle':
        case 'Thunderstorm':
            return ['#1e3a5f', '#2563eb', '#3b82f6'] as const;
        case 'Clouds':
            return ['#6b7280', '#4b5563', '#374151'] as const;
        case 'Snow':
            return ['#e0e7ff', '#a5b4fc', '#818cf8'] as const;
        case 'Mist':
        case 'Fog':
        case 'Haze':
            return ['#9ca3af', '#6b7280', '#4b5563'] as const;
        default:
            return ['#10b981', '#059669', '#047857'] as const;
    }
};

export default function AnimatedWeatherCard({
    weather,
    description,
    temp,
    humidity,
    city,
    country,
    icon,
    isNight = false,
    plantTip,
    localTime,
    localMinute,
}: WeatherCardProps) {
    // Determine which effects to show
    const showSun = weather === 'Clear' && !isNight;
    const showRain = ['Rain', 'Drizzle', 'Thunderstorm'].includes(weather);
    const showLightning = weather === 'Thunderstorm';
    const showSnow = weather === 'Snow';
    const showStars = isNight && weather !== 'Snow';
    const showFog = ['Mist', 'Fog', 'Haze'].includes(weather);
    const showClouds = weather === 'Clouds' || (isNight && !showSnow);

    const gradientColors = getGradientColors(weather, isNight);

    // Get weather icon
    const getWeatherEmoji = () => {
        if (isNight && weather === 'Clear') return '🌙';
        if (weather === 'Clear') return '☀️';
        if (weather === 'Clouds') return '☁️';
        if (weather === 'Rain') return '🌧️';
        if (weather === 'Drizzle') return '🌦️';
        if (weather === 'Thunderstorm') return '⛈️';
        if (weather === 'Snow') return '❄️';
        if (['Mist', 'Fog', 'Haze'].includes(weather)) return '🌫️';
        return '🌤️';
    };

    return (
        <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
        >
            {/* Background Effects */}
            <View style={styles.effectsContainer}>
                {showSun && <SunRays />}
                {showRain && <RainDrops />}
                {showLightning && <Lightning />}
                {showSnow && <Snowflakes />}
                {showStars && <Stars />}
                {showFog && <Fog />}
                {showClouds && <Clouds />}
            </View>

            {/* Decorative blob */}
            <View style={styles.blob} />
            <View style={styles.blob2} />

            {/* Content */}
            <View style={styles.content}>
                <View style={styles.leftSection}>
                    {/* Weather Icon & Type */}
                    <View style={styles.weatherHeader}>
                        <Text style={styles.weatherEmoji}>{getWeatherEmoji()}</Text>
                        <Text style={styles.weatherType}>{description}</Text>
                    </View>

                    {/* Temperature */}
                    <View style={styles.tempContainer}>
                        <Text style={styles.temperature}>{temp}</Text>
                        <Text style={styles.tempUnit}>°C</Text>
                    </View>

                    {/* Plant Tip */}
                    <Text style={styles.plantTip} numberOfLines={2}>
                        {plantTip}
                    </Text>
                </View>

                <View style={styles.rightSection}>
                    {/* Location Badge */}
                    <View style={styles.locationBadge}>
                        <Feather name="map-pin" size={12} color="#fff" />
                        <Text style={styles.locationText}>{city},{country}</Text>
                    </View>

                    {/* Local Time Badge - Live updating */}
                    {localTime !== undefined && (
                        <View style={styles.timeBadge}>
                            <Feather name="clock" size={12} color="#fff" />
                            <Text style={styles.timeText}>
                                {localTime > 12 ? localTime - 12 : localTime === 0 ? 12 : localTime}:{String(localMinute ?? 0).padStart(2, '0')} {localTime >= 12 ? 'PM' : 'AM'}
                            </Text>
                        </View>
                    )}

                    {/* Humidity Badge */}
                    <View style={styles.humidityBadge}>
                        <Feather name="droplet" size={12} color="#fff" />
                        <Text style={styles.humidityText}>{humidity}%</Text>
                    </View>

                    {/* Edit hint */}
                    <View style={styles.editHint}>
                        <Feather name="edit-2" size={10} color="rgba(255,255,255,0.5)" />
                        <Text style={styles.editText}>Tap to change</Text>
                    </View>
                </View>
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    card: {
        marginHorizontal: spacing.lg,
        padding: spacing.lg,
        borderRadius: borderRadius.xl,
        marginBottom: spacing.lg,
        position: 'relative',
        overflow: 'hidden',
        minHeight: 160,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    effectsContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
    },
    blob: {
        position: 'absolute',
        top: -40,
        right: -40,
        width: 120,
        height: 120,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 60,
    },
    blob2: {
        position: 'absolute',
        bottom: -30,
        left: -30,
        width: 80,
        height: 80,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 40,
    },
    content: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        zIndex: 10,
    },
    leftSection: {
        flex: 1,
    },
    rightSection: {
        alignItems: 'flex-end',
        justifyContent: 'space-between',
    },
    weatherHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    weatherEmoji: {
        fontSize: 28,
        marginRight: spacing.sm,
    },
    weatherType: {
        color: '#fff',
        fontSize: fontSize.base,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    tempContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    temperature: {
        fontSize: 56,
        fontWeight: 'bold',
        color: '#fff',
        lineHeight: 60,
    },
    tempUnit: {
        fontSize: 24,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 8,
    },
    plantTip: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: fontSize.sm,
        maxWidth: 200,
        lineHeight: 18,
    },
    locationBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        gap: 4,
    },
    locationText: {
        color: '#fff',
        fontSize: fontSize.xs,
        fontWeight: '600',
    },
    timeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        gap: 4,
        marginTop: spacing.sm,
    },
    timeText: {
        color: '#fff',
        fontSize: fontSize.xs,
        fontWeight: '500',
    },
    humidityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        gap: 4,
        marginTop: spacing.sm,
    },
    humidityText: {
        color: '#fff',
        fontSize: fontSize.xs,
        fontWeight: '500',
    },
    editHint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: spacing.md,
    },
    editText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 10,
    },

    // Sun Effects
    sunContainer: {
        position: 'absolute',
        top: -30,
        right: 20,
        width: 80,
        height: 80,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sunCore: {
        width: 40,
        height: 40,
        backgroundColor: '#fbbf24',
        borderRadius: 20,
        position: 'absolute',
        shadowColor: '#fbbf24',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 20,
    },
    sunRay: {
        position: 'absolute',
        width: 4,
        height: 25,
        backgroundColor: 'rgba(251,191,36,0.6)',
        borderRadius: 2,
        top: -5,
    },

    // Rain Effects
    rainContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    rainDrop: {
        position: 'absolute',
        width: 2,
        height: 15,
        backgroundColor: 'rgba(255,255,255,0.4)',
        borderRadius: 2,
    },

    // Stars Effects
    starsContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    star: {
        position: 'absolute',
        backgroundColor: '#fff',
        borderRadius: 2,
    },

    // Fog Effects - Professional gradient mist
    fogContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
    },
    fogGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    fogLayerWrap: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    fogStripe: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 30,
    },

    // Cloud Effects - Emoji clouds
    cloudsContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
    },
    cloudEmoji: {
        position: 'absolute',
    },

    // Lightning Effects
    lightningOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    lightningBolt: {
        position: 'absolute',
        top: 10,
        left: '40%',
    },
    boltSegment1: {
        width: 4,
        height: 25,
        backgroundColor: '#fef08a',
        transform: [{ rotate: '10deg' }],
        shadowColor: '#fef08a',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 10,
    },
    boltSegment2: {
        width: 4,
        height: 20,
        backgroundColor: '#fef08a',
        marginLeft: 8,
        marginTop: -5,
        transform: [{ rotate: '-20deg' }],
    },
    boltSegment3: {
        width: 3,
        height: 30,
        backgroundColor: '#fef08a',
        marginLeft: 4,
        marginTop: -5,
        transform: [{ rotate: '15deg' }],
    },

    // Snow Effects
    snowContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
    },
    snowflake: {
        position: 'absolute',
    },
});

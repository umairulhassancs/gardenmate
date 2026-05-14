import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Dimensions, StatusBar, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, borderRadius, fontSize } from '../theme';

const ONBOARDING_COMPLETE_KEY = '@gardenmate_onboarding_complete';

const { width, height } = Dimensions.get('window');

const slides = [
    {
        icon: 'home',
        bgColors: ['#065f46', '#10b981'],
        title: 'Discover Green Life',
        desc: 'Explore thousands of plants and find the perfect match for your home environment.',
    },
    {
        icon: 'smartphone',
        bgColors: ['#1e40af', '#3b82f6'],
        title: 'Try in AR',
        desc: 'See how plants look in your space before you buy them with our advanced AR technology.',
    },
    {
        icon: 'feather',
        bgColors: ['#047857', '#059669'],
        title: 'Smart Care',
        desc: 'Never kill a plant again. Get personalized watering and care schedules.',
    },
];

export default function OnboardingScreen({ navigation }: any) {
    const [step, setStep] = useState(0);
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const textSlideAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const emojiAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Animate content in when step changes
        fadeAnim.setValue(0);
        textSlideAnim.setValue(30);
        scaleAnim.setValue(0.9);
        emojiAnim.setValue(-50);

        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }),
            Animated.spring(textSlideAnim, {
                toValue: 0,
                tension: 50,
                friction: 8,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 50,
                friction: 8,
                useNativeDriver: true,
            }),
            Animated.spring(emojiAnim, {
                toValue: 0,
                tension: 40,
                friction: 6,
                useNativeDriver: true,
            }),
        ]).start();
    }, [step]);

    const markOnboardingComplete = async () => {
        try {
            await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
            console.log('✅ Onboarding marked as complete');
        } catch (error) {
            console.log('Error saving onboarding status:', error);
        }
    };

    const nextStep = async () => {
        if (step < slides.length - 1) {
            setStep(step + 1);
        } else {
            await markOnboardingComplete();
            navigation.replace('Auth');
        }
    };

    const handleSkip = async () => {
        await markOnboardingComplete();
        navigation.replace('Auth');
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Gradient Background */}
            <LinearGradient
                colors={slides[step].bgColors as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradient}
            />

            {/* Decorative Circles */}
            <View style={styles.circle1} />
            <View style={styles.circle2} />
            <View style={styles.circle3} />

            {/* Content */}
            <View style={styles.content}>
                {/* Icon */}
                <Animated.View style={[styles.iconContainer, {
                    opacity: fadeAnim,
                    transform: [{ translateY: emojiAnim }, { scale: scaleAnim }]
                }]}>
                    <Feather name={slides[step].icon as any} size={100} color="#fff" />
                </Animated.View>

                {/* Text Content */}
                <Animated.View style={[styles.textContent, {
                    opacity: fadeAnim,
                    transform: [{ translateY: textSlideAnim }]
                }]}>
                    {step === 0 && (
                        <View style={styles.logoRow}>
                            <View style={styles.logoContainer}>
                                <Feather name="feather" size={24} color="#fff" />
                            </View>
                            <Text style={styles.appName}>GardenMate</Text>
                        </View>
                    )}

                    <Text style={styles.title}>{slides[step].title}</Text>
                    <Text style={styles.desc}>{slides[step].desc}</Text>
                </Animated.View>

                <View style={styles.footer}>
                    {/* Progress Dots */}
                    <View style={styles.dotsContainer}>
                        {slides.map((_, i) => (
                            <Animated.View
                                key={i}
                                style={[
                                    styles.dot,
                                    i === step ? styles.dotActive : styles.dotInactive,
                                ]}
                            />
                        ))}
                    </View>

                    {/* Next Button */}
                    <TouchableOpacity style={styles.nextButton} onPress={nextStep} activeOpacity={0.8}>
                        <Feather name="arrow-right" size={28} color={colors.primary} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Skip Button */}
            <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    gradient: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
    circle1: { position: 'absolute', top: -100, right: -100, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(255,255,255,0.1)' },
    circle2: { position: 'absolute', bottom: 100, left: -150, width: 400, height: 400, borderRadius: 200, backgroundColor: 'rgba(255,255,255,0.05)' },
    circle3: { position: 'absolute', top: height * 0.3, right: -50, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.08)' },
    content: { flex: 1, justifyContent: 'center', padding: spacing.lg * 1.5 },
    iconContainer: { alignItems: 'center', marginBottom: spacing.xl * 2 },
    textContent: {},
    logoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl },
    logoContainer: { width: 52, height: 52, borderRadius: borderRadius.lg, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
    appName: { fontSize: fontSize['2xl'], fontWeight: 'bold', color: '#fff' },
    title: { fontSize: 42, fontWeight: 'bold', color: '#fff', lineHeight: 52, marginBottom: spacing.md },
    desc: { fontSize: fontSize.lg, color: 'rgba(255,255,255,0.85)', lineHeight: 28, marginBottom: spacing.xl * 2 },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xl },
    dotsContainer: { flexDirection: 'row', gap: spacing.sm },
    dot: { height: 8, borderRadius: 4 },
    dotActive: { width: 32, backgroundColor: '#fff' },
    dotInactive: { width: 8, backgroundColor: 'rgba(255,255,255,0.3)' },
    nextButton: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8 },
    skipButton: { position: 'absolute', top: 60, right: spacing.lg },
    skipText: { color: 'rgba(255,255,255,0.7)', fontSize: fontSize.base, fontWeight: '500' },
});

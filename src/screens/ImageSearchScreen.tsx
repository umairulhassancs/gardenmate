import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Image, Alert, ActivityIndicator, StatusBar } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../theme';

type ScreenState = 'camera' | 'preview' | 'processing';

export default function ImageSearchScreen({ navigation }: any) {
    const [permission, requestPermission] = useCameraPermissions();
    const [facing, setFacing] = useState<CameraType>('back');
    const [screenState, setScreenState] = useState<ScreenState>('camera');
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const cameraRef = useRef<any>(null);

    // Request camera permission on mount
    useEffect(() => {
        if (!permission?.granted) {
            requestPermission();
        }
    }, []);

    // Take a photo
    const handleCapture = async () => {
        if (cameraRef.current) {
            try {
                const photo = await cameraRef.current.takePictureAsync({
                    quality: 0.8,
                    base64: false,
                });
                setCapturedImage(photo.uri);
                setScreenState('preview');
            } catch (error) {
                Alert.alert('Error', 'Failed to capture image. Please try again.');
            }
        }
    };

    // Pick image from gallery
    const handlePickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'], 
            allowsMultipleSelection: true,
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            setCapturedImage(result.assets[0].uri);
            setScreenState('preview');
        }
    };

    // Retake photo
    const handleRetake = () => {
        setCapturedImage(null);
        setScreenState('camera');
    };

    // Process the image (search for plant)
    const handleProceed = async () => {
        setScreenState('processing');
        setIsProcessing(true);

        // Simulate plant identification processing
        setTimeout(() => {
            setIsProcessing(false);
            // Navigate to results with mock identified plant
            Alert.alert(
                'Plant Identified!',
                'We found a match: Monstera Deliciosa\n\nConfidence: 94%',
                [
                    { text: 'View Details', onPress: () => navigation.navigate('ProductDetail', { productId: '1' }) },
                    { text: 'Search Again', onPress: handleRetake },
                ]
            );
        }, 2000);
    };

    // Toggle camera facing
    const toggleCameraFacing = () => {
        setFacing(current => (current === 'back' ? 'front' : 'back'));
    };

    // Permission not granted yet
    if (!permission) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator size="large" color={colors.primary} />
            </SafeAreaView>
        );
    }

    // Permission denied
    if (!permission.granted) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.permissionContainer}>
                    <Feather name="camera-off" size={64} color={colors.textMuted} />
                    <Text style={styles.permissionTitle}>Camera Access Required</Text>
                    <Text style={styles.permissionText}>
                        Please grant camera access to search for plants by image
                    </Text>
                    <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
                        <Text style={styles.permissionButtonText}>Grant Permission</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
                        <Text style={styles.backLinkText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // Processing state
    if (screenState === 'processing') {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" />
                <View style={styles.processingContainer}>
                    <Image source={{ uri: capturedImage! }} style={styles.processingImage} />
                    <View style={styles.processingOverlay}>
                        <View style={styles.processingBox}>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text style={styles.processingText}>Identifying plant...</Text>
                            <Text style={styles.processingSubtext}>Using AI to analyze your image</Text>
                        </View>
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    // Preview state
    if (screenState === 'preview' && capturedImage) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" />

                {/* Header */}
                <View style={styles.previewHeader}>
                    <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
                        <Feather name="x" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.previewTitle}>Preview</Text>
                    <View style={{ width: 44 }} />
                </View>

                {/* Image Preview */}
                <View style={styles.previewImageContainer}>
                    <Image source={{ uri: capturedImage }} style={styles.previewImage} />
                </View>

                {/* Action Buttons */}
                <View style={styles.previewActions}>
                    <TouchableOpacity style={styles.retakeButton} onPress={handleRetake}>
                        <Feather name="refresh-cw" size={20} color={colors.text} />
                        <Text style={styles.retakeText}>Retake</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.proceedButton} onPress={handleProceed}>
                        <Text style={styles.proceedText}>Search Plant</Text>
                        <Feather name="arrow-right" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // Camera state
    return (
        <View style={styles.cameraContainer}>
            <StatusBar barStyle="light-content" />

            <CameraView ref={cameraRef} style={styles.camera} facing={facing}>
                {/* Header */}
                <SafeAreaView style={styles.cameraHeader}>
                    <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
                        <Feather name="x" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.cameraTitle}>Search by Image</Text>
                    <TouchableOpacity style={styles.closeButton} onPress={toggleCameraFacing}>
                        <Feather name="refresh-cw" size={20} color="#fff" />
                    </TouchableOpacity>
                </SafeAreaView>

                {/* Focus Frame */}
                <View style={styles.focusFrame}>
                    <View style={styles.focusCorner} />
                    <View style={[styles.focusCorner, { right: 0 }]} />
                    <View style={[styles.focusCorner, { bottom: 0 }]} />
                    <View style={[styles.focusCorner, { bottom: 0, right: 0 }]} />
                </View>

                {/* Instructions */}
                <View style={styles.instructionContainer}>
                    <Text style={styles.instructionText}>
                        Position the plant in the frame and take a photo
                    </Text>
                </View>

                {/* Bottom Controls */}
                <View style={styles.cameraControls}>
                    {/* Gallery Button */}
                    <TouchableOpacity style={styles.galleryButton} onPress={handlePickImage}>
                        <Feather name="image" size={24} color="#fff" />
                    </TouchableOpacity>

                    {/* Capture Button */}
                    <TouchableOpacity style={styles.captureButton} onPress={handleCapture}>
                        <View style={styles.captureButtonInner} />
                    </TouchableOpacity>

                    {/* Placeholder for symmetry */}
                    <View style={styles.galleryButton}>
                        <Feather name="info" size={24} color="rgba(255,255,255,0.5)" />
                    </View>
                </View>
            </CameraView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    cameraContainer: { flex: 1, backgroundColor: '#000' },

    // Permission styles
    permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
    permissionTitle: { fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
    permissionText: { fontSize: fontSize.base, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.xl },
    permissionButton: { backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: borderRadius.md },
    permissionButtonText: { color: '#fff', fontSize: fontSize.base, fontWeight: '600' },
    backLink: { marginTop: spacing.lg },
    backLinkText: { color: colors.primary, fontSize: fontSize.base },

    // Camera styles
    camera: { flex: 1 },
    cameraHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, paddingTop: spacing.xl },
    cameraTitle: { color: '#fff', fontSize: fontSize.lg, fontWeight: '600' },
    closeButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },

    focusFrame: { position: 'absolute', top: '25%', left: '10%', right: '10%', aspectRatio: 1, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderRadius: borderRadius.xl },
    focusCorner: { position: 'absolute', width: 20, height: 20, borderColor: '#fff', borderTopWidth: 3, borderLeftWidth: 3 },

    instructionContainer: { position: 'absolute', bottom: 180, left: 0, right: 0, alignItems: 'center', paddingHorizontal: spacing.xl },
    instructionText: { color: 'rgba(255,255,255,0.8)', fontSize: fontSize.base, textAlign: 'center' },

    cameraControls: { position: 'absolute', bottom: 50, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: spacing.xl },
    galleryButton: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
    captureButton: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: '#fff' },
    captureButtonInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },

    // Preview styles
    previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, backgroundColor: '#000' },
    previewTitle: { color: '#fff', fontSize: fontSize.lg, fontWeight: '600' },
    previewImageContainer: { flex: 1, backgroundColor: '#000' },
    previewImage: { flex: 1, resizeMode: 'contain' },
    previewActions: { flexDirection: 'row', padding: spacing.lg, backgroundColor: '#000', gap: spacing.md },
    retakeButton: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: spacing.md, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: borderRadius.md, gap: spacing.sm },
    retakeText: { color: '#fff', fontSize: fontSize.base, fontWeight: '600' },
    proceedButton: { flex: 2, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: spacing.md, backgroundColor: colors.primary, borderRadius: borderRadius.md, gap: spacing.sm },
    proceedText: { color: '#fff', fontSize: fontSize.base, fontWeight: '600' },

    // Processing styles
    processingContainer: { flex: 1 },
    processingImage: { flex: 1, resizeMode: 'cover' },
    processingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
    processingBox: { backgroundColor: '#fff', padding: spacing.xl, borderRadius: borderRadius.xl, alignItems: 'center', width: '80%' },
    processingText: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text, marginTop: spacing.lg },
    processingSubtext: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.sm },
});

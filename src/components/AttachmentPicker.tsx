import React, { useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Image, Modal,
    ActivityIndicator, Alert, Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../services/firebaseConfig';
import { colors } from '../theme';

interface AttachmentPickerProps {
    ticketId: string;
    onImageReady: (imageUrl: string, fileName: string) => void;
    disabled?: boolean;
}

export default function AttachmentPicker({ ticketId, onImageReady, disabled }: AttachmentPickerProps) {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [previewUri, setPreviewUri] = useState<string | null>(null);
    const [showOptions, setShowOptions] = useState(false);

    const pickImage = async (useCamera: boolean) => {
        setShowOptions(false);
        try {
            const permResult = useCamera
                ? await ImagePicker.requestCameraPermissionsAsync()
                : await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (!permResult.granted) {
                Alert.alert('Permission needed', `Please allow ${useCamera ? 'camera' : 'gallery'} access to send photos.`);
                return;
            }

            const result = useCamera
                ? await ImagePicker.launchCameraAsync({
                    mediaTypes: ['images'],
                    allowsEditing: true,
                    quality: 0.7,
                })
                : await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ['images'],
                    allowsEditing: true,
                    quality: 0.7,
                });

            if (result.canceled || !result.assets?.[0]) return;
            const asset = result.assets[0];
            setPreviewUri(asset.uri);
        } catch (err) {
            console.error('Image pick error:', err);
            Alert.alert('Error', 'Failed to pick image');
        }
    };

    const uploadImage = async () => {
        if (!previewUri) return;
        setUploading(true);
        setProgress(0);

        try {
            const response = await fetch(previewUri);
            const blob = await response.blob();

            // Validate file size (max 5MB)
            const MAX_SIZE = 5 * 1024 * 1024; // 5MB
            if (blob.size > MAX_SIZE) {
                Alert.alert('File Too Large', `Maximum file size is 5MB. Your image is ${(blob.size / (1024 * 1024)).toFixed(1)}MB.`);
                setUploading(false);
                return;
            }

            const fileName = `IMG_${Date.now()}.jpg`;
            const storageRef = ref(storage, `tickets/${ticketId}/attachments/${fileName}`);
            const uploadTask = uploadBytesResumable(storageRef, blob);

            uploadTask.on('state_changed',
                (snapshot) => {
                    const prog = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setProgress(Math.round(prog));
                },
                (error) => {
                    console.error('Upload error:', error);
                    Alert.alert('Upload Failed', 'Could not upload image. Please try again.');
                    setUploading(false);
                    setPreviewUri(null);
                },
                async () => {
                    const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                    onImageReady(downloadUrl, fileName);
                    setUploading(false);
                    setPreviewUri(null);
                    setProgress(0);
                }
            );
        } catch (err) {
            console.error('Upload error:', err);
            Alert.alert('Error', 'Failed to upload image');
            setUploading(false);
            setPreviewUri(null);
        }
    };

    return (
        <>
            {/* Attachment Button */}
            <TouchableOpacity
                onPress={() => setShowOptions(true)}
                disabled={disabled || uploading}
                style={styles.attachBtn}
            >
                {uploading ? (
                    <ActivityIndicator size={18} color={colors.primary} />
                ) : (
                    <Feather name="paperclip" size={20} color={colors.textMuted} />
                )}
            </TouchableOpacity>

            {/* Source Options Modal */}
            <Modal visible={showOptions} transparent animationType="fade" onRequestClose={() => setShowOptions(false)}>
                <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowOptions(false)}>
                    <View style={styles.optionsSheet}>
                        <Text style={styles.optionsTitle}>Send Photo</Text>
                        <TouchableOpacity style={styles.optionRow} onPress={() => pickImage(true)}>
                            <View style={[styles.optionIcon, { backgroundColor: '#3b82f620' }]}>
                                <Feather name="camera" size={20} color="#3b82f6" />
                            </View>
                            <View>
                                <Text style={styles.optionLabel}>Camera</Text>
                                <Text style={styles.optionDesc}>Take a new photo</Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.optionRow} onPress={() => pickImage(false)}>
                            <View style={[styles.optionIcon, { backgroundColor: '#8b5cf620' }]}>
                                <Feather name="image" size={20} color="#8b5cf6" />
                            </View>
                            <View>
                                <Text style={styles.optionLabel}>Gallery</Text>
                                <Text style={styles.optionDesc}>Choose from photos</Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.cancelBtn}
                            onPress={() => setShowOptions(false)}
                        >
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Preview Modal */}
            <Modal visible={!!previewUri} transparent animationType="slide" onRequestClose={() => { setPreviewUri(null); }}>
                <View style={styles.previewContainer}>
                    <View style={styles.previewHeader}>
                        <TouchableOpacity onPress={() => setPreviewUri(null)} disabled={uploading}>
                            <Feather name="x" size={24} color="#fff" />
                        </TouchableOpacity>
                        <Text style={styles.previewTitle}>Send Photo</Text>
                        <View style={{ width: 24 }} />
                    </View>
                    {previewUri && (
                        <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="contain" />
                    )}
                    <View style={styles.previewFooter}>
                        {uploading ? (
                            <View style={styles.progressContainer}>
                                <View style={[styles.progressBar, { width: `${progress}%` }]} />
                                <Text style={styles.progressText}>Uploading... {progress}%</Text>
                            </View>
                        ) : (
                            <TouchableOpacity style={styles.sendImageBtn} onPress={uploadImage}>
                                <Feather name="send" size={20} color="#fff" />
                                <Text style={styles.sendImageText}>Send</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>
        </>
    );
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
    attachBtn: {
        width: 40, height: 40, justifyContent: 'center', alignItems: 'center',
    },
    overlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    optionsSheet: {
        backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 20, paddingBottom: 34,
    },
    optionsTitle: {
        fontSize: 17, fontWeight: '700', color: '#1e293b',
        textAlign: 'center', marginBottom: 16,
    },
    optionRow: {
        flexDirection: 'row', alignItems: 'center', gap: 14,
        paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    optionIcon: {
        width: 44, height: 44, borderRadius: 12,
        justifyContent: 'center', alignItems: 'center',
    },
    optionLabel: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
    optionDesc: { fontSize: 12, color: '#64748b', marginTop: 2 },
    cancelBtn: {
        marginTop: 16, paddingVertical: 14,
        borderRadius: 14, backgroundColor: '#f1f5f9', alignItems: 'center',
    },
    cancelText: { fontSize: 15, fontWeight: '600', color: '#64748b' },

    // Preview
    previewContainer: {
        flex: 1, backgroundColor: '#000',
    },
    previewHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12,
    },
    previewTitle: {
        fontSize: 17, fontWeight: '600', color: '#fff',
    },
    previewImage: {
        flex: 1, width: SCREEN_WIDTH,
    },
    previewFooter: {
        padding: 20, paddingBottom: 34,
    },
    sendImageBtn: {
        flexDirection: 'row', backgroundColor: colors.primary,
        paddingVertical: 14, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center', gap: 8,
    },
    sendImageText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    progressContainer: {
        height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden', justifyContent: 'center',
    },
    progressBar: {
        position: 'absolute', left: 0, top: 0, bottom: 0,
        backgroundColor: colors.primary + '60', borderRadius: 14,
    },
    progressText: {
        color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center',
    },
});

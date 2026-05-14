export interface VendorRequest {
    id: string;
    userId: string;
    status: 'pending' | 'approved' | 'rejected';
    
    // Store Information
    storeName: string;
    businessEmail: string;
    phoneNumber: string;
    
    // Owner Verification
    cnicNumber: string;
    
    // Address
    nurseryAddress: string;
    
    // Documents (URLs from Firebase Storage)
    nurseryPhotos: string[];
    registrationDocs: string[];
    
    // User Info (from auth)
    userName: string;
    userEmail: string;
    
    // Timestamps
    requestedAt: any;
    reviewedAt?: any;
    reviewedBy?: string; // Admin UID
    rejectionReason?: string;
    
    // Agreement
    agreedToTerms: boolean;
}

export interface VendorProfile {
    id: string;
    userId: string;
    storeName: string;
    businessEmail: string;
    phoneNumber: string;
    nurseryAddress: string;
    cnicNumber: string;
    isActive: boolean;
    rating: number;
    totalSales: number;
    joinedAt: any;
}
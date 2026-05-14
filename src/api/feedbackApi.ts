import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  where, 
  getDocs, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { toDateSafe } from '../utils/dateUtils';

export interface Complaint {
  id?: string;
  userId: string;
  userName: string;
  vendorId: string;
  orderId: string;
  description: string;
  status: string;
  createdAt: Date | any;
  updatedAt?: Date | any;
}

export interface FeedbackData {
  userId: string;
  userName: string;
  rating: number;
  category: 'Bug Report' | 'Suggestion' | 'Compliment' | 'Other' | 'Complaint';
  comment: string;
  appVersion?: string;
  orderId?: string;
  vendorId?: string;
  productName?: string;
  productImage?: string; // Field added to support the product image URL
  responses?: string[];
  targetType: 'admin' | 'vendor'; 
}

// #region agent log
const _log = (loc: string, msg: string, data: object, hyp: string) => { fetch('http://127.0.0.1:7242/ingest/30e084bd-42dd-453a-ba7f-8a20a550f1ae', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: loc, message: msg, data, hypothesisId: hyp, sessionId: 'debug-session', timestamp: Date.now() }) }).catch(() => {}); };
// #endregion

export const feedbackApi = {
  submitFeedback: async (data: FeedbackData) => {
    // #region agent log
    _log('feedbackApi.ts:submitFeedback', 'entry', { hasCategory: 'category' in (data || {}), hasTargetType: 'targetType' in (data || {}), keys: Object.keys(data || {}) }, 'H2,H3');
    // #endregion
    try {
      const docRef = await addDoc(collection(db, 'feedbacks'), {
        ...data,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      return { success: true, id: docRef.id };
    } catch (error) {
      // #region agent log
      _log('feedbackApi.ts:submitFeedback:catch', 'error', { errMsg: String(error), errName: (error as Error)?.name, errCode: (error as any)?.code }, 'H2,H5');
      // #endregion
      console.error("Error submitting feedback: ", error);
      throw error;
    }
  },

  submitComplaint: async (data: any) => {
    // #region agent log
    _log('feedbackApi.ts:submitComplaint', 'entry', { dataVendorId: data?.vendorId, dataOrderId: data?.orderId }, 'H2,H4,H5');
    // #endregion
    try {
      const docRef = await addDoc(collection(db, 'complaints'), {
        ...data,
        status: 'open',
        createdAt: serverTimestamp(),
      });
      // Log for debugging: This will tell you in your terminal if an image was actually sent
      console.log("✅ Complaint Saved. Image URL present:", !!data.productImage);
      return { success: true, id: docRef.id };
    } catch (error) {
      // #region agent log
      _log('feedbackApi.ts:submitComplaint:catch', 'error', { errMsg: String(error), errName: (error as Error)?.name, errCode: (error as any)?.code }, 'H5');
      // #endregion
      console.error("Error submitting complaint: ", error);
      throw error;
    }
  },

  getUserFeedback: async (userId: string) => {
    try {
      const q = query(collection(db, 'feedbacks'), where('userId', '==', userId), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: toDateSafe((doc.data() as any).createdAt) }));
    } catch (error) { console.error(error); throw error; }
  },

  getVendorFeedback: async (vendorId: string) => {
    try {
      const q = query(collection(db, 'feedbacks'), where('vendorId', '==', vendorId), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: toDateSafe((doc.data() as any).createdAt) }));
    } catch (error) { console.error(error); throw error; }
  }
};
// Ticket System Type Definitions
// Complete TypeScript interfaces for industry-standard ticket management

export type TicketPriority = 'critical' | 'high' | 'medium' | 'low';
export type TicketStatus = 'new' | 'open' | 'assigned' | 'in_progress' | 'pending_customer' | 'resolved' | 'closed' | 'reopened';
export type TicketCategory =
    | 'product_issue'
    | 'delivery_issue'
    | 'payment_issue'
    | 'account_issue'
    | 'technical_issue'
    | 'refund_request'
    | 'missing_parts'
    | 'wrong_item'
    | 'damaged_product'
    | 'general';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';
export type ParticipantRole = 'customer' | 'vendor' | 'admin';

// Message delivery and read receipts (WhatsApp-like)
export interface MessageDelivery {
    status: MessageStatus;
    sentAt: Date;
    deliveredAt: Date | null;
    readAt: Date | null;
}

// Individual message in ticket conversation
export interface TicketMessage {
    id: string;
    from: ParticipantRole;
    senderId: string;
    senderName: string;
    senderRole: ParticipantRole;
    text: string;

    // WhatsApp-like status tracking
    status: MessageStatus;
    sentAt: Date;
    deliveredAt: Date | null;
    readAt: Date | null;

    // Attachments
    attachments?: TicketAttachment[];

    createdAt: Date;
    editedAt?: Date | null;
    editHistory?: Array<{ text: string; editedAt: Date }>;
}

// File attachments
export interface TicketAttachment {
    id: string;
    type: 'image' | 'pdf' | 'video';
    url: string;
    thumbnail?: string;
    filename: string;
    size: number;
    uploadedBy: string;
    uploadedByRole: ParticipantRole;
    uploadedAt: Date;
}

// Internal staff-only notes
export interface InternalNote {
    id: string;
    authorId: string;
    authorName: string;
    authorRole: 'vendor' | 'admin';
    text: string;
    createdAt: Date;
    mentions?: string[]; // UserIds of mentioned staff
}

// SLA tracking
export interface SLATracking {
    priority: TicketPriority;
    firstResponseDue: Date;
    resolutionDue: Date;
    firstResponseAt: Date | null;
    resolvedAt: Date | null;
    isOverdue: boolean;
    breachedSLA: boolean;
    breachReason?: string;
}

// Status change history
export interface StatusHistoryEntry {
    status: TicketStatus;
    changedBy: string;
    changedByName: string;
    changedByRole: ParticipantRole;
    changedAt: Date;
    reason?: string;
}

// Assignment tracking
export interface TicketAssignment {
    assignedTo: string | null;
    assignedToName: string | null;
    assignedToRole: 'vendor' | 'admin' | null;
    assignedAt: Date | null;
    assignmentHistory?: Array<{
        from: string | null;
        to: string;
        assignedBy: string;
        assignedAt: Date;
        reason?: string;
    }>;
}

// Escalation information
export interface TicketEscalation {
    isEscalated: boolean;
    level: 'L1' | 'L2' | 'L3';
    escalatedAt: Date;
    escalatedBy: string;
    escalatedByName: string;
    escalatedTo: string;
    escalatedToName: string;
    reason: string;
    autoEscalated: boolean;
}

// Ticket metadata
export interface TicketMetadata {
    appVersion: string;
    deviceOS: string;
    deviceModel: string;
    orderSnapshot?: {
        orderNumber: string;
        total: number;
        status: string;
        items: any[];
    };
    customerLifetimeValue: number;
    customerOrderCount: number;
    previousTicketsCount: number;
    source: 'in-app' | 'email' | 'phone';
}

// Customer Satisfaction survey
export interface CSATSurvey {
    rating: 1 | 2 | 3 | 4 | 5;
    feedback: string;
    aspectRatings: {
        responseSpeed: 1 | 2 | 3 | 4 | 5;
        professionalism: 1 | 2 | 3 | 4 | 5;
        resolutionQuality: 1 | 2 | 3 | 4 | 5;
    };
    surveyCompletedAt: Date;
}

// Audit log entry
export interface AuditLogEntry {
    action:
    | 'created'
    | 'status_changed'
    | 'assigned'
    | 'escalated'
    | 'priority_changed'
    | 'tag_added'
    | 'tag_removed'
    | 'note_added'
    | 'closed'
    | 'reopened';
    performedBy: string;
    performedByName: string;
    performedByRole: ParticipantRole;
    timestamp: Date;
    before?: any;
    after?: any;
    ipAddress?: string;
    userAgent?: string;
}

// Main Ticket interface
export interface Ticket {
    // === IDENTIFIERS ===
    id: string; // Firestore document ID
    ticketId: string; // Human-readable: GM-TKT-260214-0001
    ticketNumber: number; // Sequential number

    // === PARTIES ===
    customerId: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    vendorId: string;
    vendorName: string;
    vendorStoreName: string; // NEW: Display in chat instead of "Vendor"
    orderId: string;

    // === CLASSIFICATION ===
    category: TicketCategory;
    subcategory?: string;
    priority: TicketPriority;
    tags: string[];

    // === STATUS ===
    status: TicketStatus;
    statusHistory: StatusHistoryEntry[];

    // === ASSIGNMENT ===
    assignment: TicketAssignment;

    // === SLA ===
    sla: SLATracking;

    // === CONTENT ===
    subject: string; // Short title
    description: string; // Initial complaint text
    messages: TicketMessage[];
    internalNotes: InternalNote[];
    attachments: TicketAttachment[];

    // === ESCALATION ===
    escalation?: TicketEscalation | null;

    // === METADATA ===
    metadata: TicketMetadata;

    // === CSAT ===
    csat?: CSATSurvey | null;

    // === AUDIT ===
    auditLog: AuditLogEntry[];

    // === TIMESTAMPS ===
    createdAt: Date;
    updatedAt: Date;
    closedAt?: Date | null;

    // === RELATIONS ===
    relatedTickets?: string[]; // Linked/merged tickets
    parentTicketId?: string | null; // If merged into another
}

// User presence for online status
export interface UserPresence {
    userId: string;
    online: boolean;
    lastSeen: Date;
    activeTickets: string[]; // Ticket IDs currently viewing
    typing: {
        ticketId: string | null;
        startedAt: Date | null;
    };
}

// Category metadata for UI
export interface CategoryMetadata {
    id: TicketCategory;
    label: string;
    icon: string; // Feather icon name
    description: string;
    suggestedPriority: TicketPriority;
}

// Priority configuration
export interface PriorityConfig {
    level: TicketPriority;
    label: string;
    color: string;
    icon: string;
    firstResponseHours: number;
    resolutionHours: number;
    description: string;
}

export type UserRole = 'user' | 'admin';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Dispute {
  id: string;
  bookingId: string;
  itemId: string;
  renterId: string;
  ownerId: string;
  ownerClaim: string;
  borrowerResponse?: string;
  damageLevel: DamageLevel;
  penaltyAmount: number;
  status: 'pending' | 'resolved' | 'rejected';
  imagesPre: string[];
  imagesPost: string[];
  ownerEvidence: string[];
  borrowerEvidence: string[];
  adminDecision?: string;
  resolvedAt?: any;
  createdAt: any;
}

export interface AdminActivityLog {
  id: string;
  adminId: string;
  adminName: string;
  action: string; // e.g., 'BLOCK_USER', 'RESOLVE_DISPUTE'
  targetId: string;
  targetType: 'user' | 'item' | 'booking' | 'dispute';
  details: string;
  timestamp: any;
}

export interface AuditLog {
  id: string;
  userId?: string;
  action: 'LOGIN' | 'PAYMENT' | 'REFUND' | 'ADMIN_ACTION' | 'ACCESS_DENIED' | 'SYSTEM_RESTART' | 'FRAUD_DETECTED' | 'DATA_ACCESS';
  description: string;
  metadata: Record<string, any>;
  ip?: string;
  userAgent?: string;
  timestamp: any;
}

export interface SecurityAlert {
  id: string;
  type: 'CRITICAL' | 'WARNING' | 'INFO';
  category: 'FRAUD' | 'SYSTEM' | 'SECURITY';
  message: string;
  targetUserId?: string;
  isResolved: boolean;
  createdAt: any;
}

export interface SystemBackup {
  id: string;
  triggeredBy: string;
  timestamp: any;
  collections: string[];
  dataSize: number;
  status: 'SUCCESS' | 'FAILED';
  snapshotUrl?: string; // If using cloud storage
}

export interface UserProfile {
  uid: string;
  displayName: string;
  fullName?: string;
  email: string | null;
  phoneNumber?: string;
  address?: string;
  location?: LatLng;
  photoURL?: string;
  isVerified: boolean;
  verificationLevel: number; // 1, 2, 3
  trustScore: number;
  isRestricted: boolean;
  outstandingBalance: number;
  role: UserRole;
  rating: number;
  reviewCount: number;
  lastActive?: any;
  deviceId?: string;
  createdAt: any;
}

export type ItemCategory = 'Tools' | 'Cleaning' | 'Home Utility' | 'Electronics' | 'Camping';
export type ItemCondition = 'New' | 'Good' | 'Used';
export type ItemStatus = 'pending_approval' | 'active' | 'inactive';
export type DepositType = 'with_deposit' | 'no_deposit';

export interface RentableItem {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  category: string;
  price: number;
  priceUnit: 'minute' | 'hour' | 'day' | 'month';
  deposit: number;
  depositType: DepositType;
  images: string[];
  condition: ItemCondition;
  checklist: string[];
  status: ItemStatus;
  location: LatLng;
  qrCode?: string;
  serialCode?: string;
  createdAt: any;
  ownerName?: string;
  ownerRating?: number;
}

export type BookingStatus = 
  | 'request_sent' 
  | 'accepted_by_owner' 
  | 'rejected_by_owner'
  | 'awaiting_payment'
  | 'confirmed' // Payment verified
  | 'out_for_handover' 
  | 'handover_done' // Checklist verified
  | 'active' // Rented
  | 'return_requested' 
  | 'inspecting'
  | 'damage_reported'
  | 'bill_generated'
  | 'completed' 
  | 'cancelled'
  | 'disputed';

export type DamageLevel = 'none' | 'minor' | 'medium' | 'major' | 'missing_parts';

export interface RentalBill {
  bookingId: string;
  renterId: string;
  ownerId: string;
  itemTitle: string;
  duration: string;
  totalRent: number;
  deposit: number;
  platformFee: number;
  damageCharge?: number;
  refundAmount?: number;
  totalAmount: number;
  createdAt: string;
}

export interface Booking {
  id: string;
  itemId: string;
  renterId: string;
  ownerId: string;
  startDate: string;
  endDate: string;
  durationValue: number;
  durationUnit: 'minutes' | 'hours' | 'days' | 'months';
  totalCost: number;
  depositHeld: number;
  platformFee: number;
  status: BookingStatus;
  checklistVerificationPre? : boolean[];
  checklistVerificationPost? : boolean[];
  damagePhotosPre?: string[];
  damagePhotosPost?: string[];
  damageLevel?: DamageLevel;
  penaltyAmount?: number;
  bill?: RentalBill;
  createdAt: any;
}

export interface Conversation {
  id: string;
  participants: string[];
  itemId: string;
  bookingId?: string;
  lastMessage: string;
  updatedAt: any;
  itemTitle: string;
  itemImage: string;
  pendingOffer?: {
    price: number;
    duration: string;
    proposedBy: string;
  };
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  type?: 'text' | 'bill' | 'offer' | 'system' | 'widget';
  widgetType?: 'booking_request' | 'payment_trigger' | 'handover_form' | 'return_form' | 'bill_summary' | 'refund_alert';
  metadata?: any;
  bill?: RentalBill;
  createdAt: any;
}

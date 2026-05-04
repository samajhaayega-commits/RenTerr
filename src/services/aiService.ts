import { RentableItem, UserProfile } from '../types';

export const getSmartSuggestions = (items: RentableItem[], profile: UserProfile | null) => {
  if (items.length === 0) return ["Looking for something specific? Neighbors are listing items every hour!"];

  const categories = [...new Set(items.map(i => i.category))];
  const highRatedOwners = items.filter(i => i.ownerRating && i.ownerRating > 4.5);
  const lowDepositItems = items.filter(i => i.deposit < 500);

  const suggestions = [
    `Local Deal: ${categories[0]} rentals are high in demand today. Check out nearby listings!`,
    `Neighbor Tip: ${highRatedOwners.length} owners near you have maintained a 5-star rating for over 6 months.`,
    `Budget Alert: Renting for 3+ days usually saves you 20% on the platform service fee.`,
    `Quick Rental: There are ${lowDepositItems.length} items with less than ₹500 deposit within 5km.`,
    `Safety First: Always verify the item condition via the handover checklist in the secure chat.`
  ];

  if (profile?.trustScore && profile.trustScore < 40) {
    suggestions.push(`Warning: Your trust score is low. Complete 2 successful rentals without damage to restore full access.`);
  }

  return suggestions;
};

export const getRiskScoreText = (userProfile: UserProfile) => {
    if (userProfile.trustScore > 80) return "Ultra Reliable";
    if (userProfile.trustScore > 60) return "Trusted Citizen";
    if (userProfile.trustScore > 40) return "Standard Profile";
    return "High Risk / Restricted";
};

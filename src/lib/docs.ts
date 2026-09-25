export const DOC_GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: "Documents",
    items: [
      ["lf", "Driving licence front"],
      ["lb", "Driving licence back"],
      ["af", "Aadhaar or ID front"],
      ["ab", "Aadhaar or ID back"],
      ["pc", "PAN card"],
      ["gw", "Gig work ID proof (Blinkit, Zepto, Zomato, Swiggy etc.)"],
    ],
  },
  { title: "Scooter photos (all 4 sides)", items: [["sf", "Front"], ["sb", "Back"], ["sl", "Left side"], ["sr", "Right side"]] },
  { title: "Helmet", items: [["hm", "Helmet photo"]] },
  { title: "Selfie with scooter", items: [["ss", "Selfie standing with your scooter"]] },
];

export const DOC_COUNT = 12;

export const DOC_LABEL: Record<string, string> = Object.fromEntries(DOC_GROUPS.flatMap((g) => g.items));

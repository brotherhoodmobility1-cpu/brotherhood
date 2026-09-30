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
  {
    title: "Signed agreement, paper copy (optional)",
    items: [["ag1", "Agreement page 1"], ["ag2", "Agreement page 2"], ["ag3", "Agreement page 3"], ["ag4", "Agreement page 4"]],
  },
];

/** The 12 documents every rider must upload. The paper agreement pages are extra and optional. */
export const DOC_REQUIRED = ["lf", "lb", "af", "ab", "pc", "gw", "sf", "sb", "sl", "sr", "hm", "ss"];
export const DOC_COUNT = DOC_REQUIRED.length;

export const DOC_LABEL: Record<string, string> = Object.fromEntries(DOC_GROUPS.flatMap((g) => g.items));

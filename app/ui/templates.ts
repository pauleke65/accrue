export type AgreementTemplate = {
  id: string;
  name: string;
  description: string;
  days: number;
  milestones: {
    title: string;
    criteria: string;
    amount: string;
    fee: string;
  }[];
};

// Starting points for milestone jobs. Amounts are test AUSD and only a
// suggestion; every field stays editable. Each criteria line is written so a
// reviewer could check it without asking the client what they meant.
export const PILOT_TEMPLATES: AgreementTemplate[] = [
  {
    id: "website-build",
    name: "Website build",
    description: "Design and build a marketing or shop website, from wireframes to a live launch.",
    days: 30,
    milestones: [
      { title: "Wireframes", criteria: "Wireframes for every agreed page, shared as a Figma link, approved in one round of comments.", amount: "200.00", fee: "20.00" },
      { title: "Build", criteria: "All pages built and deployed to a preview URL, working on mobile and desktop, content in place.", amount: "600.00", fee: "20.00" },
      { title: "Launch", criteria: "Site live on the client's domain with HTTPS, analytics installed, forms delivering to the agreed inbox.", amount: "300.00", fee: "20.00" },
      { title: "Handover", criteria: "Source code in the client's GitHub, a short admin guide, and a 30-minute walkthrough call.", amount: "100.00", fee: "20.00" },
    ],
  },
  {
    id: "mobile-app",
    name: "Mobile app feature",
    description: "Ship one feature in an existing iOS or Android app, from design to store release.",
    days: 21,
    milestones: [
      { title: "Design sign-off", criteria: "Screens for the full flow, including empty and error states, approved by the client.", amount: "150.00", fee: "15.00" },
      { title: "Working build", criteria: "Feature merged and available in a TestFlight or internal testing build, matching the approved design.", amount: "450.00", fee: "15.00" },
      { title: "Store release", criteria: "Release submitted and approved in the store, with no crash reports from the feature after 48 hours.", amount: "150.00", fee: "15.00" },
    ],
  },
  {
    id: "brand-identity",
    name: "Brand identity",
    description: "Logo, colours and type for a new product, delivered as files the client can use.",
    days: 14,
    milestones: [
      { title: "Concepts", criteria: "Three distinct logo directions, each shown on a light and dark background.", amount: "120.00", fee: "10.00" },
      { title: "Final files", criteria: "Chosen logo in SVG and PNG, colour palette with hex values, and type choices, delivered in a shared folder.", amount: "200.00", fee: "10.00" },
    ],
  },
  {
    id: "content-series",
    name: "Content series",
    description: "A run of articles or posts, each paid on approval.",
    days: 30,
    milestones: [
      { title: "Article 1", criteria: "1,200+ words on the agreed topic, original, with sources linked, delivered as a Google Doc.", amount: "150.00", fee: "0" },
      { title: "Article 2", criteria: "1,200+ words on the agreed topic, original, with sources linked, delivered as a Google Doc.", amount: "150.00", fee: "0" },
      { title: "Article 3", criteria: "1,200+ words on the agreed topic, original, with sources linked, delivered as a Google Doc.", amount: "150.00", fee: "0" },
    ],
  },
];

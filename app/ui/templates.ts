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

export const PILOT_TEMPLATES: AgreementTemplate[] = [
  {
    id: "construction-renovation",
    name: "Construction & Renovation",
    description: "Multi-stage diaspora construction (Foundation, Blockwork, Roofing, Finishing).",
    days: 30,
    milestones: [
      {
        title: "Site Preparation & Foundation",
        criteria: "Foundation poured, cured 72 hours, level within 5mm across the slab. Site cleared.",
        amount: "150.00",
        fee: "10.00",
      },
      {
        title: "Block Work to Lintel Height",
        criteria: "External & internal walls completed to lintel height, plumb within 3mm per metre.",
        amount: "200.00",
        fee: "15.00",
      },
      {
        title: "Roofing Sheeting & Woodwork",
        criteria: "Trusses installed, aluminum sheeting laid, watertight seal with zero light leaks.",
        amount: "180.00",
        fee: "12.00",
      },
      {
        title: "Plastering & First-fix Electrical/Plumbing",
        criteria: "Internal wall plaster smooth, piping and conduits laid and pressure-tested.",
        amount: "120.00",
        fee: "8.00",
      },
    ],
  },
  {
    id: "oneoff-contractor",
    name: "One-Off Contractor Work",
    description: "Single or short-term physical contractor work with milestone completion.",
    days: 14,
    milestones: [
      {
        title: "Initial Mobilization & Materials",
        criteria: "All required materials delivered to site and verified by project supervisor.",
        amount: "80.00",
        fee: "5.00",
      },
      {
        title: "Execution & Final Inspection",
        criteria: "Work completed according to technical specification and cleared by supervisor.",
        amount: "120.00",
        fee: "10.00",
      },
    ],
  },
  {
    id: "professional-service",
    name: "Professional Service Delivery",
    description: "Architectural designs, engineering reviews, or legal consulting.",
    days: 14,
    milestones: [
      {
        title: "Concept & Initial Schematics",
        criteria: "Initial 2D/3D floor plans and site evaluation report delivered in PDF format.",
        amount: "100.00",
        fee: "5.00",
      },
      {
        title: "Final Approved Blueprints",
        criteria: "Structural engineering approval and final CAD drawings provided.",
        amount: "150.00",
        fee: "10.00",
      },
    ],
  },
  {
    id: "goods-procurement",
    name: "Goods & Procurement Delivery",
    description: "Equipment, building supplies, or raw material procurement.",
    days: 7,
    milestones: [
      {
        title: "Procurement & Dispatch",
        criteria: "Supplier invoice and bill of lading uploaded; items dispatched.",
        amount: "250.00",
        fee: "10.00",
      },
      {
        title: "Delivery & Quality Check",
        criteria: "Materials delivered to site, inspected for damage, and quantity confirmed.",
        amount: "250.00",
        fee: "15.00",
      },
    ],
  },
];

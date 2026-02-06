import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

const templates = [
  {
    industry: 'Technology',
    subIndustry: 'SaaS',
    displayName: 'Technology / SaaS',
    icon: 'Code2',
    colorAccent: '#2B6CFF',
    dataOpportunityPrompts: [
      'User behavior analytics and feature adoption patterns',
      'Churn prediction from usage patterns and support tickets',
      'Revenue expansion signals from product usage data',
      'Customer health scoring combining multiple data streams',
      'Product-led growth optimization through conversion funnel analysis',
    ],
    automationPrompts: [
      'Intelligent customer onboarding that adapts to user behavior',
      'Automated support ticket triage and response drafting',
      'Smart billing and subscription management with dunning',
      'Code review and documentation generation from codebase',
      'Product roadmap prioritization from user feedback analysis',
    ],
    successStoryTemplates: [
      {
        title: 'SaaS Churn Reduced by 40%',
        industry: 'B2B SaaS',
        outcome:
          'Predictive model identifying at-risk accounts 30 days before churn',
      },
      {
        title: 'Support Response Time Cut 80%',
        industry: 'Cloud Software',
        outcome: 'AI-powered ticket routing and auto-response system',
      },
      {
        title: 'Feature Adoption Doubled',
        industry: 'Product-Led SaaS',
        outcome: 'Personalized in-app guidance driven by behavioral analysis',
      },
    ],
    roadmapTemplates: [
      {
        phase: 'Quick Wins (Week 1-2)',
        items: [
          'Automated support ticket categorization',
          'Usage analytics dashboard',
          'Customer health score v1',
        ],
      },
      {
        phase: 'Core Build (Week 3-6)',
        items: [
          'Churn prediction model',
          'Smart onboarding flows',
          'Revenue expansion signals',
        ],
      },
      {
        phase: 'Strategic (Week 7-12)',
        items: [
          'Full customer lifecycle AI',
          'Product-led growth engine',
          'Predictive analytics platform',
        ],
      },
    ],
  },
  {
    industry: 'Professional Services',
    subIndustry: null,
    displayName: 'Professional Services',
    icon: 'Briefcase',
    colorAccent: '#7C5FE0',
    dataOpportunityPrompts: [
      'Project profitability prediction from historical engagement data',
      'Resource utilization optimization across teams',
      'Client relationship scoring and upsell opportunity detection',
      'Knowledge management and expertise matching',
      'Proposal win-rate analysis and optimization',
    ],
    automationPrompts: [
      'Automated proposal and SOW generation from brief',
      'Intelligent time tracking and project scoping',
      'Client communication summarization and action extraction',
      'Knowledge base curation from project deliverables',
      'Smart resource allocation based on skills and availability',
    ],
    successStoryTemplates: [
      {
        title: 'Proposal Win Rate Improved 35%',
        industry: 'Management Consulting',
        outcome:
          'AI-assisted proposal generation with competitive intelligence',
      },
      {
        title: 'Utilization Rate Up 20%',
        industry: 'IT Consulting',
        outcome: 'Smart resource matching and project staffing optimization',
      },
      {
        title: 'Client Retention Increased 25%',
        industry: 'Accounting Firm',
        outcome: 'Predictive client health monitoring and proactive engagement',
      },
    ],
    roadmapTemplates: [
      {
        phase: 'Quick Wins (Week 1-2)',
        items: [
          'Meeting summarization',
          'Email intelligence',
          'Time tracking automation',
        ],
      },
      {
        phase: 'Core Build (Week 3-6)',
        items: [
          'Proposal generator',
          'Resource optimizer',
          'Client health dashboard',
        ],
      },
      {
        phase: 'Strategic (Week 7-12)',
        items: [
          'Knowledge management AI',
          'Predictive project scoping',
          'Full engagement intelligence',
        ],
      },
    ],
  },
  {
    industry: 'E-commerce',
    subIndustry: null,
    displayName: 'E-commerce & Retail',
    icon: 'ShoppingCart',
    colorAccent: '#F1D302',
    dataOpportunityPrompts: [
      'Customer lifetime value prediction and segmentation',
      'Product recommendation engine from browsing and purchase patterns',
      'Inventory demand forecasting using sales trends and external signals',
      'Price optimization based on competitor analysis and demand elasticity',
      'Cart abandonment prediction and recovery optimization',
    ],
    automationPrompts: [
      'Personalized product descriptions and marketing copy generation',
      'Dynamic pricing engine with competitor monitoring',
      'Customer service chatbot with order and product knowledge',
      'Automated email campaigns based on customer lifecycle stage',
      'Visual search and product tagging from images',
    ],
    successStoryTemplates: [
      {
        title: 'Revenue Per Visitor Up 28%',
        industry: 'Fashion E-commerce',
        outcome: 'AI-powered personalization engine across all touchpoints',
      },
      {
        title: 'Inventory Waste Reduced 45%',
        industry: 'Consumer Electronics',
        outcome: 'Predictive demand forecasting with supply chain integration',
      },
      {
        title: 'Customer Service Cost Down 60%',
        industry: 'Online Marketplace',
        outcome: 'Intelligent chatbot handling 80% of tier-1 inquiries',
      },
    ],
    roadmapTemplates: [
      {
        phase: 'Quick Wins (Week 1-2)',
        items: [
          'Product description generation',
          'Review sentiment analysis',
          'Basic recommendation engine',
        ],
      },
      {
        phase: 'Core Build (Week 3-6)',
        items: [
          'Customer segmentation',
          'Dynamic pricing',
          'Chatbot deployment',
        ],
      },
      {
        phase: 'Strategic (Week 7-12)',
        items: [
          'Full personalization engine',
          'Demand forecasting',
          'Omnichannel AI integration',
        ],
      },
    ],
  },
  {
    industry: 'Healthcare',
    subIndustry: null,
    displayName: 'Healthcare & Medical',
    icon: 'Heart',
    colorAccent: '#EF4444',
    dataOpportunityPrompts: [
      'Patient flow optimization and appointment scheduling efficiency',
      'Clinical documentation automation and coding accuracy',
      'Treatment outcome prediction from patient data patterns',
      'Resource allocation optimization across departments',
      'Patient engagement and compliance monitoring',
    ],
    automationPrompts: [
      'Automated clinical note generation from consultations',
      'Intelligent appointment scheduling with no-show prediction',
      'Patient intake form processing and data extraction',
      'Insurance claim pre-authorization automation',
      'Medical literature monitoring for relevant research updates',
    ],
    successStoryTemplates: [
      {
        title: 'Admin Time Reduced 40%',
        industry: 'Multi-site Clinic',
        outcome:
          'AI-powered clinical documentation and scheduling optimization',
      },
      {
        title: 'Patient No-Shows Down 50%',
        industry: 'Dental Practice',
        outcome: 'Predictive scheduling with smart reminder system',
      },
      {
        title: 'Claim Approval Rate Up 30%',
        industry: 'Healthcare Provider',
        outcome: 'Automated claim validation and coding accuracy improvement',
      },
    ],
    roadmapTemplates: [
      {
        phase: 'Quick Wins (Week 1-2)',
        items: [
          'Appointment optimization',
          'Document digitization',
          'Patient FAQ chatbot',
        ],
      },
      {
        phase: 'Core Build (Week 3-6)',
        items: [
          'Clinical note automation',
          'Claim processing AI',
          'Patient engagement platform',
        ],
      },
      {
        phase: 'Strategic (Week 7-12)',
        items: [
          'Outcome prediction models',
          'Resource optimization',
          'Full patient journey AI',
        ],
      },
    ],
  },
  {
    industry: 'Manufacturing',
    subIndustry: null,
    displayName: 'Manufacturing & Industry',
    icon: 'Factory',
    colorAccent: '#F97316',
    dataOpportunityPrompts: [
      'Predictive maintenance from sensor data and equipment history',
      'Quality control optimization using production line analytics',
      'Supply chain demand forecasting and inventory optimization',
      'Energy consumption optimization across facilities',
      'Production scheduling optimization for maximum throughput',
    ],
    automationPrompts: [
      'Automated quality inspection using computer vision',
      'Intelligent production planning and scheduling',
      'Supplier communication and order management automation',
      'Safety incident prediction and prevention system',
      'Automated compliance reporting and documentation',
    ],
    successStoryTemplates: [
      {
        title: 'Downtime Reduced 60%',
        industry: 'Automotive Parts',
        outcome:
          'Predictive maintenance system monitoring 500+ machines in real-time',
      },
      {
        title: 'Defect Rate Down 75%',
        industry: 'Electronics Manufacturing',
        outcome: 'Computer vision quality inspection at production line speed',
      },
      {
        title: 'Inventory Costs Cut 30%',
        industry: 'Food Manufacturing',
        outcome: 'AI-driven demand forecasting with supply chain optimization',
      },
    ],
    roadmapTemplates: [
      {
        phase: 'Quick Wins (Week 1-2)',
        items: [
          'Data collection audit',
          'Reporting automation',
          'Basic quality analytics',
        ],
      },
      {
        phase: 'Core Build (Week 3-6)',
        items: [
          'Predictive maintenance v1',
          'Quality vision system',
          'Demand forecasting',
        ],
      },
      {
        phase: 'Strategic (Week 7-12)',
        items: [
          'Full digital twin',
          'Autonomous scheduling',
          'Supply chain intelligence',
        ],
      },
    ],
  },
  {
    industry: 'Construction',
    subIndustry: null,
    displayName: 'Construction & Building',
    icon: 'HardHat',
    colorAccent: '#EAB308',
    dataOpportunityPrompts: [
      'Project cost overrun prediction from historical project data',
      'Safety incident risk scoring from site conditions',
      'Material waste reduction through usage pattern analysis',
      'Subcontractor performance scoring and optimization',
      'Project timeline prediction with weather and supply chain factors',
    ],
    automationPrompts: [
      'Automated progress reporting from site photos and drone imagery',
      'Intelligent bid estimation from project specifications',
      'Safety compliance monitoring with automated alerting',
      'Document management and permit tracking automation',
      'Client communication and change order processing',
    ],
    successStoryTemplates: [
      {
        title: 'Project Overruns Down 35%',
        industry: 'Commercial Construction',
        outcome: 'AI-powered cost prediction and early warning system',
      },
      {
        title: 'Safety Incidents Reduced 45%',
        industry: 'Infrastructure Builder',
        outcome: 'Computer vision site monitoring with real-time safety alerts',
      },
      {
        title: 'Bid Win Rate Up 25%',
        industry: 'Residential Construction',
        outcome: 'Data-driven bid estimation and competitive analysis tool',
      },
    ],
    roadmapTemplates: [
      {
        phase: 'Quick Wins (Week 1-2)',
        items: [
          'Document digitization',
          'Reporting automation',
          'Cost tracking dashboard',
        ],
      },
      {
        phase: 'Core Build (Week 3-6)',
        items: [
          'Cost prediction model',
          'Safety monitoring',
          'Bid estimation tool',
        ],
      },
      {
        phase: 'Strategic (Week 7-12)',
        items: [
          'Full project intelligence',
          'Drone integration',
          'Portfolio optimization',
        ],
      },
    ],
  },
  {
    industry: 'Marketing',
    subIndustry: 'Media',
    displayName: 'Marketing & Media',
    icon: 'Megaphone',
    colorAccent: '#EC4899',
    dataOpportunityPrompts: [
      'Campaign performance prediction from historical data',
      'Audience segmentation and lookalike modeling',
      'Content performance analysis across channels',
      'Client reporting automation with insight generation',
      'Competitive intelligence and market trend analysis',
    ],
    automationPrompts: [
      'AI-powered content creation and adaptation for multiple formats',
      'Automated campaign optimization and budget allocation',
      'Social media monitoring and sentiment analysis',
      'Client brief to creative concept generation',
      'Automated A/B testing and performance reporting',
    ],
    successStoryTemplates: [
      {
        title: 'Campaign ROAS Up 45%',
        industry: 'Digital Agency',
        outcome:
          'AI-driven budget allocation and real-time optimization engine',
      },
      {
        title: 'Content Output Tripled',
        industry: 'Content Agency',
        outcome: 'AI-assisted content creation with brand voice consistency',
      },
      {
        title: 'Client Retention Up 40%',
        industry: 'Full-Service Agency',
        outcome:
          'Automated reporting with predictive insights and recommendations',
      },
    ],
    roadmapTemplates: [
      {
        phase: 'Quick Wins (Week 1-2)',
        items: [
          'Content variation generator',
          'Reporting automation',
          'Social listening setup',
        ],
      },
      {
        phase: 'Core Build (Week 3-6)',
        items: [
          'Campaign optimizer',
          'Audience intelligence',
          'Content performance AI',
        ],
      },
      {
        phase: 'Strategic (Week 7-12)',
        items: [
          'Full creative AI suite',
          'Predictive campaign planning',
          'Client insights platform',
        ],
      },
    ],
  },
  {
    industry: 'Financial Services',
    subIndustry: null,
    displayName: 'Financial Services',
    icon: 'Landmark',
    colorAccent: '#059669',
    dataOpportunityPrompts: [
      'Risk assessment and credit scoring enhancement',
      'Fraud detection from transaction pattern analysis',
      'Customer churn prediction and retention optimization',
      'Portfolio optimization using market data analysis',
      'Regulatory compliance monitoring and reporting',
    ],
    automationPrompts: [
      'Automated KYC/AML document processing and verification',
      'Intelligent customer onboarding with risk assessment',
      'Financial report generation and analysis',
      'Client communication and advisory note drafting',
      'Automated regulatory filing and compliance checking',
    ],
    successStoryTemplates: [
      {
        title: 'Fraud Detection Up 80%',
        industry: 'Payment Provider',
        outcome:
          'Real-time AI transaction monitoring reducing false positives by 60%',
      },
      {
        title: 'KYC Processing 5x Faster',
        industry: 'Wealth Management',
        outcome: 'Automated document verification and risk scoring system',
      },
      {
        title: 'Client Assets Under Management Up 20%',
        industry: 'Financial Advisory',
        outcome: 'AI-driven personalized investment recommendations and alerts',
      },
    ],
    roadmapTemplates: [
      {
        phase: 'Quick Wins (Week 1-2)',
        items: [
          'Document processing automation',
          'Reporting enhancement',
          'Client communication AI',
        ],
      },
      {
        phase: 'Core Build (Week 3-6)',
        items: ['Risk scoring model', 'Fraud detection', 'KYC automation'],
      },
      {
        phase: 'Strategic (Week 7-12)',
        items: [
          'Full compliance AI',
          'Advisory intelligence',
          'Portfolio optimization',
        ],
      },
    ],
  },
  {
    industry: 'Logistics',
    subIndustry: null,
    displayName: 'Logistics & Transport',
    icon: 'Truck',
    colorAccent: '#0EA5E9',
    dataOpportunityPrompts: [
      'Route optimization using historical delivery data and traffic patterns',
      'Demand forecasting for warehouse capacity planning',
      'Fleet maintenance prediction from vehicle telemetry',
      'Delivery time estimation improvement from operational data',
      'Cost optimization across shipping modes and carriers',
    ],
    automationPrompts: [
      'Dynamic route planning and real-time optimization',
      'Automated shipment tracking and exception management',
      'Warehouse picking optimization with AI-guided workflows',
      'Carrier selection and rate negotiation automation',
      'Customer delivery communication and ETD updates',
    ],
    successStoryTemplates: [
      {
        title: 'Delivery Costs Down 25%',
        industry: 'Last-Mile Delivery',
        outcome: 'AI route optimization reducing daily kilometers by 30%',
      },
      {
        title: 'Warehouse Throughput Up 40%',
        industry: '3PL Provider',
        outcome: 'AI-guided picking and packing with dynamic slot allocation',
      },
      {
        title: 'Fleet Downtime Reduced 50%',
        industry: 'Trucking Company',
        outcome:
          'Predictive maintenance from real-time vehicle telemetry analysis',
      },
    ],
    roadmapTemplates: [
      {
        phase: 'Quick Wins (Week 1-2)',
        items: [
          'Delivery analytics dashboard',
          'Communication automation',
          'Basic route analysis',
        ],
      },
      {
        phase: 'Core Build (Week 3-6)',
        items: [
          'Route optimization engine',
          'Demand forecasting',
          'Maintenance prediction',
        ],
      },
      {
        phase: 'Strategic (Week 7-12)',
        items: [
          'Full fleet intelligence',
          'Autonomous scheduling',
          'Supply chain visibility platform',
        ],
      },
    ],
  },
  {
    industry: 'Real Estate',
    subIndustry: null,
    displayName: 'Real Estate & Property',
    icon: 'Building2',
    colorAccent: '#8B5CF6',
    dataOpportunityPrompts: [
      'Property valuation prediction from market data and features',
      'Tenant screening and risk assessment optimization',
      'Maintenance cost prediction from property age and condition',
      'Market trend analysis for investment decision support',
      'Occupancy rate optimization through pricing and marketing',
    ],
    automationPrompts: [
      'Automated property listing generation with compelling descriptions',
      'Intelligent lead qualification and follow-up',
      'Lease management and renewal optimization',
      'Property inspection reporting automation',
      'Tenant communication and maintenance request handling',
    ],
    successStoryTemplates: [
      {
        title: 'Vacancy Rate Down 40%',
        industry: 'Commercial Real Estate',
        outcome: 'AI-powered tenant matching and dynamic pricing optimization',
      },
      {
        title: 'Lead Conversion Up 35%',
        industry: 'Residential Agency',
        outcome: 'Intelligent lead scoring and automated follow-up sequences',
      },
      {
        title: 'Maintenance Costs Reduced 30%',
        industry: 'Property Management',
        outcome: 'Predictive maintenance scheduling from IoT sensor data',
      },
    ],
    roadmapTemplates: [
      {
        phase: 'Quick Wins (Week 1-2)',
        items: [
          'Listing generator',
          'Lead scoring',
          'Communication automation',
        ],
      },
      {
        phase: 'Core Build (Week 3-6)',
        items: [
          'Valuation model',
          'Tenant screening AI',
          'Maintenance prediction',
        ],
      },
      {
        phase: 'Strategic (Week 7-12)',
        items: [
          'Full portfolio intelligence',
          'Market analysis platform',
          'Investment optimization AI',
        ],
      },
    ],
  },
];

async function main() {
  console.log('Seeding industry templates...');

  for (const template of templates) {
    await prisma.industryTemplate.upsert({
      where: {
        industry_subIndustry: {
          industry: template.industry,
          subIndustry: template.subIndustry ?? '',
        },
      },
      update: {
        displayName: template.displayName,
        icon: template.icon,
        colorAccent: template.colorAccent,
        dataOpportunityPrompts: template.dataOpportunityPrompts,
        automationPrompts: template.automationPrompts,
        successStoryTemplates: template.successStoryTemplates,
        roadmapTemplates: template.roadmapTemplates,
      },
      create: {
        industry: template.industry,
        subIndustry: template.subIndustry,
        displayName: template.displayName,
        icon: template.icon,
        colorAccent: template.colorAccent,
        dataOpportunityPrompts: template.dataOpportunityPrompts,
        automationPrompts: template.automationPrompts,
        successStoryTemplates: template.successStoryTemplates,
        roadmapTemplates: template.roadmapTemplates,
      },
    });
    console.log(`  Seeded: ${template.displayName}`);
  }

  console.log(`Done! Seeded ${templates.length} industry templates.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

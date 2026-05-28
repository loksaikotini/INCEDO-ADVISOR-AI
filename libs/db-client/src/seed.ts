// FILE: libs/db-client/src/seed.ts
import { PrismaClient, UserRole, RiskProfile, KycStatus, ComplianceSeverity, DocumentType, RecommendationType } from './generated/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Cleaning existing Advisor AI database...');
  await prisma.auditLog.deleteMany();
  await prisma.aiRecommendation.deleteMany();
  await prisma.complianceEvent.deleteMany();
  await prisma.complianceRule.deleteMany();
  await prisma.conversationTurn.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.portfolioSnapshot.deleteMany();
  await prisma.account.deleteMany();
  await prisma.document.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.instrument.deleteMany();
  await prisma.client.deleteMany();
  await prisma.advisor.deleteMany();
  await prisma.firm.deleteMany();

  console.log('🌱 Seeding Advisor AI database with Firms, Clients, Unstructured Data, and Alerts...');

  // ── 1. Firms ────────────────────────────────────────────────────────────────
  const firmNames = ['DE SHAW', 'INCEDO', 'JP MORGAN', 'GOLDMAN SACHS'];
  const firms = [];
  
  for (const [index, name] of firmNames.entries()) {
    const firm = await prisma.firm.create({
      data: {
        name,
        regulatory_id: `FINRA-00${index + 1}`,
        tier: 'ENTERPRISE',
        settings: { max_advisors: 1000, llm_budget_monthly_usd: 50000 },
      },
    });
    firms.push(firm);
  }
  console.log(`✅ Created 4 firms: ${firms.map(f => f.name).join(', ')}`);

  // ── 2. Instruments ────────────────────────────────────────────────────────
  const instrumentsData = [
    { ticker: 'AAPL', isin: 'US0378331005', name: 'Apple Inc.', asset_class: 'Equity', price: 175.5 },
    { ticker: 'MSFT', isin: 'US5949181045', name: 'Microsoft Corp.', asset_class: 'Equity', price: 380.0 },
    { ticker: 'NVDA', isin: 'US67066G1040', name: 'NVIDIA Corp.', asset_class: 'Equity', price: 870.0 },
    { ticker: 'JPM', isin: 'US46625H1005', name: 'JPMorgan Chase', asset_class: 'Equity', price: 195.0 },
    { ticker: 'GS', isin: 'US38141G1040', name: 'Goldman Sachs Group', asset_class: 'Equity', price: 410.0 },
    { ticker: 'BND', isin: 'US9219378356', name: 'Vanguard Total Bond ETF', asset_class: 'Bond', price: 72.3 },
    { ticker: 'SPY', isin: 'US78462F1030', name: 'SPDR S&P 500 ETF', asset_class: 'ETF', price: 505.0 },
    { ticker: 'CASH', isin: 'CASH', name: 'Cash & Equivalents', asset_class: 'Cash', price: 1.0 },
  ];

  const instruments: Record<string, any> = {};
  for (const inst of instrumentsData) {
    instruments[inst.ticker] = await prisma.instrument.create({
      data: {
        ticker: inst.ticker,
        isin: inst.isin,
        name: inst.name,
        asset_class: inst.asset_class,
        market_data: { last_price: inst.price },
      },
    });
  }
  console.log(`✅ Created ${instrumentsData.length} instruments.`);

  // ── 3. Advisors, Clients, Portfolios, Documents, Alerts ─────────────────────
  let totalClients = 0;

  for (const firm of firms) {
    // Create Roles for each firm (Advisor, Compliance, Ops)
    const isIncedo = firm.name === 'INCEDO';
    
    const advisors = [];
    for (let j = 0; j < 3; j++) {
      const advisorEmail = isIncedo ? (j === 0 ? 'advisor@incedo.com' : `advisor${j+1}@incedo.com`) : faker.internet.email({ provider: firm.name.toLowerCase().replace(' ', '') + '.com' });
      const advisorName = isIncedo ? (j === 0 ? 'Sarah Chen' : `Advisor ${j+1}`) : faker.person.fullName();
      const adv = await prisma.advisor.create({
        data: { name: advisorName, email: advisorEmail, password_hash: "$2b$12$6kOuvNh9UoQKqmmyRNfK/.7iQgIvYZ7zFYrBTReGYI9eULvGk5yN6", firm_id: firm.firm_id, role: UserRole.ADVISOR, licenses: ['Series 7', 'Series 66'] },
      });
      advisors.push(adv);
    }

    const complianceEmail = isIncedo ? 'compliance@incedo.com' : faker.internet.email({ provider: firm.name.toLowerCase().replace(' ', '') + '.com' });
    const opsEmail = isIncedo ? 'ops@incedo.com' : faker.internet.email({ provider: firm.name.toLowerCase().replace(' ', '') + '.com' });

    const compliance = await prisma.advisor.create({
      data: { name: isIncedo ? 'Charles Compliance' : faker.person.fullName(), email: complianceEmail, password_hash: "$2b$12$6kOuvNh9UoQKqmmyRNfK/.7iQgIvYZ7zFYrBTReGYI9eULvGk5yN6", firm_id: firm.firm_id, role: UserRole.COMPLIANCE, licenses: ['Series 24'] },
    });
    const ops = await prisma.advisor.create({
      data: { name: isIncedo ? 'Owen Operations' : faker.person.fullName(), email: opsEmail, password_hash: "$2b$12$6kOuvNh9UoQKqmmyRNfK/.7iQgIvYZ7zFYrBTReGYI9eULvGk5yN6", firm_id: firm.firm_id, role: UserRole.OPERATIONS, licenses: [] },
    });

    if (isIncedo) {
      await prisma.advisor.create({
        data: { name: 'Alice Admin', email: 'admin@incedo.com', password_hash: "$2b$12$6kOuvNh9UoQKqmmyRNfK/.7iQgIvYZ7zFYrBTReGYI9eULvGk5yN6", firm_id: firm.firm_id, role: UserRole.ADMIN, licenses: [] }
      });
    }

    // Generate 10 clients for EACH of the 3 advisors
    for (const advisor of advisors) {
      for (let i = 0; i < 10; i++) {
      const isHnw = Math.random() > 0.5;
      const netWorth = isHnw ? faker.number.int({ min: 1000000, max: 10000000 }) : faker.number.int({ min: 100000, max: 900000 });
      
      const client = await prisma.client.create({
        data: {
          firm_id: firm.firm_id,
          advisor_id: advisor.advisor_id,
          name: faker.person.fullName(),
          email: faker.internet.email(),
          risk_profile: faker.helpers.arrayElement([RiskProfile.CONSERVATIVE, RiskProfile.MODERATE, RiskProfile.AGGRESSIVE]),
          kyc_status: KycStatus.APPROVED,
          segment: isHnw ? 'HIGH_NET_WORTH' : 'RETAIL',
          life_stage: faker.helpers.arrayElement(['ACCUMULATION', 'NEAR_RETIREMENT', 'RETIREMENT']),
          profile: {
            age: faker.number.int({ min: 30, max: 75 }),
            net_worth: netWorth,
            phone: faker.phone.number(),
            address: faker.location.streetAddress(),
          },
          behavioral_flags: faker.helpers.arrayElements(['ESG_FOCUS', 'HIGH_CASH_BALANCE', 'FEE_SENSITIVE', 'TECH_ENTHUSIAST'], { min: 0, max: 2 }),
          life_events: faker.helpers.arrayElements(['UPCOMING_RETIREMENT', 'COLLEGE_FUNDING', 'RECENT_INHERITANCE'], { min: 0, max: 1 }),
        },
      });
      totalClients++;

      // Account & Portfolio
      const account = await prisma.account.create({
        data: {
          client_id: client.client_id,
          account_type: faker.helpers.arrayElement(['BROKERAGE', 'IRA', 'TRUST']),
          custodian: faker.helpers.arrayElement(['Charles Schwab', 'Fidelity', 'BNY Mellon']),
        },
      });

      const numHoldings = faker.number.int({ min: 3, max: 6 });
      const holdings = [];
      let nav = 0;
      
      for (let h = 0; h < numHoldings; h++) {
        const instTicker = faker.helpers.arrayElement(Object.keys(instruments));
        const inst = instruments[instTicker];
        const qty = faker.number.int({ min: 10, max: 1000 });
        const mv = qty * inst.market_data.last_price;
        holdings.push({
          ticker: inst.ticker,
          name: inst.name,
          quantity: qty,
          current_price: inst.market_data.last_price,
          market_value: mv,
          weight_pct: 0, // Simplified
          sector: 'Various',
          asset_class: inst.asset_class,
        });
        nav += mv;
      }

      await prisma.portfolioSnapshot.create({
        data: {
          account_id: account.account_id,
          nav: nav,
          holdings: holdings,
          risk_metrics: { var_95: -0.05, beta: 1.1, max_drawdown_pct: -0.2 },
        },
      });

      // Seed Unstructured Data (Documents, Emails, Notes)
      await prisma.document.createMany({
        data: [
          {
            client_id: client.client_id,
            advisor_id: advisor.advisor_id,
            firm_id: firm.firm_id,
            doc_type: DocumentType.EMAIL,
            title: `Re: Portfolio Review - ${client.name}`,
            content: `Hi ${advisor.name},\n\nI wanted to discuss rebalancing my portfolio next quarter, specifically looking at adding more tech exposure like ${faker.helpers.arrayElement(['AAPL', 'NVDA', 'MSFT'])}.\n\nBest,\n${client.name}`,
            metadata: { sentiment: 'neutral', intent: 'rebalance' },
          },
          {
            client_id: client.client_id,
            advisor_id: advisor.advisor_id,
            firm_id: firm.firm_id,
            doc_type: DocumentType.ADVISOR_NOTE,
            title: `Quarterly Review Notes - ${client.name}`,
            content: `Discussed tax loss harvesting and shifting cash to fixed income. Client is concerned about market volatility.`,
          }
        ]
      });

      // Seed Streaming Data (Alerts & Compliance Events)
      // 1. Portfolio Drift Alert
      if (Math.random() > 0.5) {
        await prisma.alert.create({
          data: {
            firm_id: firm.firm_id,
            advisor_id: advisor.advisor_id,
            client_id: client.client_id,
            alert_type: 'PORTFOLIO_DRIFT',
            severity: ComplianceSeverity.WARN,
            message: `Account ${account.account_id.split('-')[0]} has drifted ${faker.number.int({ min: 6, max: 15 })}% from target allocation.`,
          }
        });
      }

      // 2. Concentration Risk Compliance Alert
      if (Math.random() > 0.5) {
        const concentrationTicker = faker.helpers.arrayElement(['AAPL', 'NVDA', 'MSFT']);
        await prisma.alert.create({
          data: {
            firm_id: firm.firm_id,
            advisor_id: advisor.advisor_id,
            client_id: client.client_id,
            alert_type: 'CONCENTRATION_LIMIT_EXCEEDED',
            severity: ComplianceSeverity.BLOCK,
            message: `Single stock Concentration Risk limit exceeded: Client holds >20% in ${concentrationTicker}. Current exposure is ${faker.number.int({ min: 22, max: 28 })}%.`,
          }
        });
      }

      // 3. KYC Status warning alert
      if (Math.random() > 0.6) {
        await prisma.alert.create({
          data: {
            firm_id: firm.firm_id,
            advisor_id: advisor.advisor_id,
            client_id: client.client_id,
            alert_type: 'KYC_EXPIRATION_WARNING',
            severity: ComplianceSeverity.WARN,
            message: `KYC profile verification for ${client.name} expires within 30 days. Action required.`,
          }
        });
      }

      // Generate AI Recommendations for the client
      const recTypes = [
        {
          type: RecommendationType.UPSELL,
          payload: {
            title: "High Yield Cash Optimization",
            description: `Client holds significant low-yield cash. Recommend deploying a portion into a short-duration treasury ladder yielding 5.25% to maximize risk-free yield.`,
            impact: "High",
            color: "purple"
          },
          shap: { cash_ratio: 0.5, yield_spread: 0.3, client_risk: 0.2 }
        },
        {
          type: RecommendationType.REBALANCE,
          payload: {
            title: "Concentrated Tech Rebalance",
            description: `Technology holdings represent an outsized portion of total portfolio value. Recommend trimming positions and reallocating to broader diversified ETFs to manage concentration volatility.`,
            impact: "High",
            color: "blue"
          },
          shap: { concentration_pct: 0.6, sector_drift: 0.3, market_vol: 0.1 }
        },
        {
          type: RecommendationType.CROSS_SELL,
          payload: {
            title: "ESG Core Allocation Shift",
            description: "Client profile highlights ESG focus. Recommend swapping standard S&P 500 ETF (SPY) exposure with iShares ESG Aware MSCI USA ETF (ESGU) to align with sustainability goals.",
            impact: "Medium",
            color: "emerald"
          },
          shap: { behavioral_esg: 0.7, sustainability_score: 0.2, fee_impact: 0.1 }
        },
        {
          type: RecommendationType.RISK_ALERT,
          payload: {
            title: "Retirement Income Laddering",
            description: `Client is approaching the retirement phase. Recommend shifting a portion of capital from aggressive growth equities into short-duration corporate bond ladders and high-dividend assets to establish a cash-flow buffer.`,
            impact: "High",
            color: "purple"
          },
          shap: { life_stage: 0.65, drawdown_risk: 0.25, income_yield: 0.1 }
        }
      ];

      // Assign 2 random recommendations to each client
      const selectedRecs = faker.helpers.arrayElements(recTypes, 2);
      for (const rec of selectedRecs) {
        await prisma.aiRecommendation.create({
          data: {
            advisor_id: advisor.advisor_id,
            client_id: client.client_id,
            rec_type: rec.type,
            payload: rec.payload,
            shap_explanation: rec.shap,
            acted_on: false,
          }
        });
      }

      }
    }

    // Firm-level Reports & Compliance Rules
    await prisma.document.createMany({
      data: [
        {
          firm_id: firm.firm_id,
          doc_type: DocumentType.RESEARCH_REPORT,
          title: `Macro Outlook 2026 - ${firm.name}`,
          content: `Inflation is stabilizing. Expecting rates to hold. Favorable outlook for large-cap tech.`,
        },
        {
          firm_id: firm.firm_id,
          doc_type: DocumentType.RESEARCH_REPORT,
          title: `Q3 Tech Sector Analysis`,
          content: `AI hardware demand remains unprecedented. Software margins are expanding due to efficiency. Hold overweight in Semis.`,
        },
        {
          firm_id: firm.firm_id,
          doc_type: DocumentType.OTHER,
          title: `Annual SEC Audit Findings - 2025`,
          content: `No major findings. Minor adjustments required in client onboarding documentation workflows. Status: Resolved.`,
        },
        {
          firm_id: firm.firm_id,
          doc_type: DocumentType.CONTRACT,
          title: `Vendor Agreement - Finnhub API`,
          content: `Enterprise tier agreement. Rate limits: 60 calls/min. SLA: 99.99% uptime. Term: 2 years.`,
        },
        {
          firm_id: firm.firm_id,
          doc_type: DocumentType.OTHER,
          title: `Employee Handbook v4.2`,
          content: `Updated PTO policies and remote work guidelines for all advisory staff. Effective Jan 1, 2026.`,
        }
      ]
    });

    await prisma.complianceRule.create({
      data: {
        firm_id: firm.firm_id,
        category: 'CONCENTRATION_RISK',
        name: 'Single Equity Concentration',
        description: 'Flag if single stock > 20% of NAV',
        severity: ComplianceSeverity.WARN,
        rule_logic: { max_pct: 20 },
      }
    });
  }

  console.log(`✅ Created ${totalClients} clients across 4 firms with Portfolios, Notes, Emails, and Alerts.`);
  console.log('\n🎉 Database seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

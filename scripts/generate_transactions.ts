import { PrismaClient, TransactionType } from '../libs/db-client/src/generated/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Generating dummy transactions...');
  
  const accounts = await prisma.account.findMany();
  const instruments = await prisma.instrument.findMany();
  
  if (accounts.length === 0 || instruments.length === 0) {
    console.error('❌ No accounts or instruments found. Run db:seed first.');
    process.exit(1);
  }

  const transactionTypes = Object.values(TransactionType);
  let totalTransactions = 0;

  for (const account of accounts) {
    const numTxns = Math.floor(Math.random() * 20) + 5; // 5 to 25 transactions per account
    const txns = [];

    for (let i = 0; i < numTxns; i++) {
      const instrument = instruments[Math.floor(Math.random() * instruments.length)];
      const type = transactionTypes[Math.floor(Math.random() * transactionTypes.length)];
      
      // Random date within the last year
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * 365));

      txns.push({
        account_id: account.account_id,
        instrument_id: instrument.instrument_id,
        type: type,
        quantity: Math.random() * 100 + 1,
        price: instrument.market_data && typeof instrument.market_data === 'object' && 'last_price' in instrument.market_data 
                ? Number((instrument.market_data as any).last_price) 
                : Math.random() * 200 + 10,
        executed_at: date,
        status: 'SETTLED',
        metadata: { source: 'system_generated' }
      });
    }

    await prisma.transaction.createMany({
      data: txns
    });
    totalTransactions += txns.length;
  }

  console.log(`✅ Generated ${totalTransactions} transactions across ${accounts.length} accounts.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

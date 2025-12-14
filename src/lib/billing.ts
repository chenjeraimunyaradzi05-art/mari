import { prisma } from '@/lib/db';

export async function ensureBillingAccount(organizationId: string) {
  let account = await prisma.adBillingAccount.findUnique({
    where: { organizationId },
  });

  if (!account) {
    account = await prisma.adBillingAccount.create({
      data: {
        organizationId,
      },
    });
  }

  return account;
}

export async function recordAdSpend(organizationId: string, amountCents: number, description: string) {
  const account = await ensureBillingAccount(organizationId);

  // Create a transaction
  await prisma.adTransaction.create({
    data: {
      billingAccountId: account.id,
      type: 'charge',
      amountCents: BigInt(amountCents),
      description,
    },
  });

  // Update balance
  const updatedAccount = await prisma.adBillingAccount.update({
    where: { id: account.id },
    data: {
      balanceCents: {
        increment: BigInt(amountCents),
      },
    },
  });

  // Check threshold
  if (updatedAccount.balanceCents >= updatedAccount.billingThreshold) {
    await processPayment(updatedAccount.id);
  }
}

export async function processPayment(billingAccountId: string) {
  const account = await prisma.adBillingAccount.findUnique({
    where: { id: billingAccountId },
  });

  if (!account || account.balanceCents <= 0n) return;

  // In a real implementation, we would charge Stripe here.
  // For now, we'll just simulate a successful payment.
  
  const amountToCharge = account.balanceCents;

  // 1. Create Invoice
  const invoice = await prisma.adInvoice.create({
    data: {
      billingAccountId: account.id,
      amountCents: amountToCharge,
      status: 'paid', // Simulated
      periodStart: new Date(), // Simplified
      periodEnd: new Date(),
    },
  });

  // 2. Create Payment Transaction
  await prisma.adTransaction.create({
    data: {
      billingAccountId: account.id,
      type: 'payment',
      amountCents: amountToCharge,
      description: `Payment for Invoice ${invoice.id}`,
    },
  });

  // 3. Reset Balance
  await prisma.adBillingAccount.update({
    where: { id: account.id },
    data: {
      balanceCents: 0,
    },
  });
  
  console.log(`Processed payment of ${amountToCharge} cents for account ${account.id}`);
}

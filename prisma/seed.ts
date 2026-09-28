import { AssetType, ChipStatus, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'local@paddock-iq.dev' },
    update: { name: 'Oleksii Panas' },
    create: { email: 'local@paddock-iq.dev', name: 'Oleksii Panas' },
  });

  const team = await prisma.fantasyTeam.upsert({
    where: { userId_season_name: { userId: user.id, season: 2026, name: 'Panass' } },
    update: {},
    create: { userId: user.id, season: 2026, name: 'Panass' },
  });

  const gp = await prisma.grandPrix.upsert({
    where: { season_round: { season: 2026, round: 18 } },
    update: { name: 'Malaysia' },
    create: { season: 2026, round: 18, name: 'Malaysia' },
  });

  const assets = [
    ['VER', 'Max Verstappen', AssetType.DRIVER, 27.6],
    ['ANT', 'Kimi Antonelli', AssetType.DRIVER, 26.9],
    ['HUL', 'Nico Hülkenberg', AssetType.DRIVER, 5.4],
    ['PER', 'Sergio Pérez', AssetType.DRIVER, 3.0],
    ['BOT', 'Valtteri Bottas', AssetType.DRIVER, 3.6],
    ['MER', 'Mercedes', AssetType.CONSTRUCTOR, 33.8],
    ['FER', 'Ferrari', AssetType.CONSTRUCTOR, 27.6],
  ] as const;

  const assetRows = [];
  for (const [code, name, type] of assets) {
    assetRows.push(
      await prisma.asset.upsert({
        where: { season_code_type: { season: 2026, code, type } },
        update: { name },
        create: { season: 2026, code, name, type },
      }),
    );
  }

  let snapshot = await prisma.teamSnapshot.findFirst({
    where: { teamId: team.id, grandPrixId: gp.id },
    orderBy: { capturedAt: 'desc' },
  });

  if (!snapshot) {
    snapshot = await prisma.teamSnapshot.create({
      data: {
        teamId: team.id,
        grandPrixId: gp.id,
        squadValue: 125.7,
        bankValue: 130.3,
        cashBalance: 2.4,
        freeTransfers: 2,
        totalPoints: 3918,
      },
    });
  }

  for (let i = 0; i < assetRows.length; i++) {
    const row = assetRows[i];
    const price = assets[i][3];
    await prisma.teamSlot.upsert({
      where: { snapshotId_assetId: { snapshotId: snapshot.id, assetId: row.id } },
      update: { isDoubled: row.code === 'VER' },
      create: { snapshotId: snapshot.id, assetId: row.id, isDoubled: row.code === 'VER' },
    });

    const existingPrice = await prisma.priceHistory.findFirst({
      where: { assetId: row.id, grandPrixId: gp.id, source: 'user screenshot' },
    });
    if (!existingPrice) {
      await prisma.priceHistory.create({
        data: { assetId: row.id, grandPrixId: gp.id, price, source: 'user screenshot' },
      });
    }
  }

  const chips = {
    WC: ChipStatus.USED,
    LL: ChipStatus.USED,
    AP: ChipStatus.USED,
    NN: ChipStatus.USED,
    DRS: ChipStatus.USED,
    FF: ChipStatus.LOCKED,
  };

  for (const [chipCode, status] of Object.entries(chips)) {
    await prisma.chipUsage.upsert({
      where: { teamId_chipCode: { teamId: team.id, chipCode } },
      update: { status },
      create: { teamId: team.id, chipCode, status },
    });
  }

  console.log('Seeded Paddock IQ local data');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

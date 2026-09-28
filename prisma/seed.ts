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

  // Full 2026 market bootstrap. Prices refreshed from F1Data Space on 2026-09-28.
  const assets = [
    ['RUS','George Russell',AssetType.DRIVER,27.6],['VER','Max Verstappen',AssetType.DRIVER,27.5],
    ['ANT','Kimi Antonelli',AssetType.DRIVER,26.0],['NOR','Lando Norris',AssetType.DRIVER,26.4],
    ['HAM','Lewis Hamilton',AssetType.DRIVER,25.1],['LEC','Charles Leclerc',AssetType.DRIVER,24.2],
    ['PIA','Oscar Piastri',AssetType.DRIVER,24.1],['LAW','Liam Lawson',AssetType.DRIVER,14.3],
    ['GAS','Pierre Gasly',AssetType.DRIVER,12.4],['COL','Franco Colapinto',AssetType.DRIVER,10.6],
    ['OCO','Esteban Ocon',AssetType.DRIVER,10.1],['SAI','Carlos Sainz',AssetType.DRIVER,9.8],
    ['TSU','Yuki Tsunoda',AssetType.DRIVER,9.7],['BOR','Gabriel Bortoleto',AssetType.DRIVER,8.0],
    ['LIN','Arvid Lindblad',AssetType.DRIVER,7.8],['BEA','Oliver Bearman',AssetType.DRIVER,7.0],
    ['ALO','Fernando Alonso',AssetType.DRIVER,6.8],['ALB','Alexander Albon',AssetType.DRIVER,5.2],
    ['HUL','Nico Hülkenberg',AssetType.DRIVER,3.6],['PER','Sergio Pérez',AssetType.DRIVER,3.2],
    ['BOT','Valtteri Bottas',AssetType.DRIVER,3.0],['STR','Lance Stroll',AssetType.DRIVER,3.0],
    ['MER','Mercedes',AssetType.CONSTRUCTOR,32.9],['MCL','McLaren',AssetType.CONSTRUCTOR,31.3],
    ['RBR','Red Bull Racing',AssetType.CONSTRUCTOR,31.2],['FER','Ferrari',AssetType.CONSTRUCTOR,26.9],
    ['ALP','Alpine',AssetType.CONSTRUCTOR,18.9],['RB','Racing Bulls',AssetType.CONSTRUCTOR,13.5],
    ['WIL','Williams',AssetType.CONSTRUCTOR,13.2],['HAS','Haas F1 Team',AssetType.CONSTRUCTOR,11.4],
    ['AUD','Audi Revolut F1 Team',AssetType.CONSTRUCTOR,7.4],['AST','Aston Martin',AssetType.CONSTRUCTOR,6.3],
    ['CAD','Cadillac Formula 1 Team',AssetType.CONSTRUCTOR,3.0],
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
      where: { assetId: row.id, grandPrixId: gp.id, source: 'F1Data Space 2026-09-28' },
    });
    if (!existingPrice) {
      await prisma.priceHistory.create({
        data: { assetId: row.id, grandPrixId: gp.id, price, source: 'F1Data Space 2026-09-28' },
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

  console.log('Seeded Paddock IQ local data and full 2026 market (' + assets.length + ' assets)');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

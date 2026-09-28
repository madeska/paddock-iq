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
    where: { season_round: { season: 2026, round: 16 } },
    update: { name: 'Bahrain GP in Malaysia' },
    create: { season: 2026, round: 16, name: 'Bahrain GP in Malaysia' },
  });

  // Current 2026 market snapshot for the Azerbaijan -> Malaysia transition.
  // Prices refreshed 2026-09-29. Price predictions are intentionally NOT imported.
  const assets = [
    ['RUS','George Russell',AssetType.DRIVER,27.8],['VER','Max Verstappen',AssetType.DRIVER,27.3],
    ['NOR','Lando Norris',AssetType.DRIVER,27.0],['ANT','Kimi Antonelli',AssetType.DRIVER,26.6],
    ['HAM','Lewis Hamilton',AssetType.DRIVER,24.9],['PIA','Oscar Piastri',AssetType.DRIVER,24.1],
    ['LEC','Charles Leclerc',AssetType.DRIVER,24.0],['HAD','Isack Hadjar',AssetType.DRIVER,14.5],
    ['GAS','Pierre Gasly',AssetType.DRIVER,12.0],['COL','Franco Colapinto',AssetType.DRIVER,10.6],
    ['LAW','Liam Lawson',AssetType.DRIVER,9.7],['SAI','Carlos Sainz',AssetType.DRIVER,9.0],
    ['OCO','Esteban Ocon',AssetType.DRIVER,8.9],['BOR','Gabriel Bortoleto',AssetType.DRIVER,8.4],
    ['LIN','Arvid Lindblad',AssetType.DRIVER,8.2],['ALO','Fernando Alonso',AssetType.DRIVER,6.8],
    ['ALB','Alexander Albon',AssetType.DRIVER,6.4],['BEA','Oliver Bearman',AssetType.DRIVER,5.8],
    ['HUL','Nico Hülkenberg',AssetType.DRIVER,4.8],['BOT','Valtteri Bottas',AssetType.DRIVER,3.0],
    ['PER','Sergio Pérez',AssetType.DRIVER,3.0],['STR','Lance Stroll',AssetType.DRIVER,3.0],
    ['MER','Mercedes',AssetType.CONSTRUCTOR,33.5],['MCL','McLaren',AssetType.CONSTRUCTOR,31.9],
    ['RBR','Red Bull Racing',AssetType.CONSTRUCTOR,31.8],['FER','Ferrari',AssetType.CONSTRUCTOR,27.5],
    ['ALP','Alpine',AssetType.CONSTRUCTOR,19.5],['RB','Racing Bulls',AssetType.CONSTRUCTOR,14.7],
    ['WIL','Williams',AssetType.CONSTRUCTOR,14.0],['HAS','Haas F1 Team',AssetType.CONSTRUCTOR,10.2],
    ['AUD','Audi Revolut F1 Team',AssetType.CONSTRUCTOR,8.6],['AST','Aston Martin',AssetType.CONSTRUCTOR,6.3],
    ['CAD','Cadillac Formula 1 Team',AssetType.CONSTRUCTOR,3.0],
  ] as const;

  await prisma.asset.updateMany({where:{season:2026},data:{active:false}});

  const assetRows = [];
  for (const [code, name, type] of assets) {
    assetRows.push(
      await prisma.asset.upsert({
        where: { season_code_type: { season: 2026, code, type } },
        update: { name, active: true },
        create: { season: 2026, code, name, type, active: true },
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
      where: { assetId: row.id, grandPrixId: gp.id, source: 'Market snapshot 2026-09-29' },
    });
    if (!existingPrice) {
      await prisma.priceHistory.create({
        data: { assetId: row.id, grandPrixId: gp.id, price, source: 'Market snapshot 2026-09-29' },
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

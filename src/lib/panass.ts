import type {Asset} from './optimizer';
export const panassAssets:Asset[]=[
 {code:'VER',type:'DRIVER',price:27.6,expectedPoints:0,expectedDelta:0},
 {code:'ANT',type:'DRIVER',price:26.9,expectedPoints:0,expectedDelta:0},
 {code:'HUL',type:'DRIVER',price:5.4,expectedPoints:0,expectedDelta:0},
 {code:'PER',type:'DRIVER',price:3.0,expectedPoints:0,expectedDelta:0},
 {code:'BOT',type:'DRIVER',price:3.6,expectedPoints:0,expectedDelta:0},
 {code:'MER',type:'CONSTRUCTOR',price:33.8,expectedPoints:0,expectedDelta:0},
 {code:'FER',type:'CONSTRUCTOR',price:27.6,expectedPoints:0,expectedDelta:0},
];
export const panassSnapshot={name:'Panass',season:2026,teamSlot:1,source:'user screenshot',capturedAt:'2026-09-28',freeTransfers:2,cash:2.4,totalPoints:3918,reportedSquadValue:125.7,reportedBank:130.3,assets:panassAssets,chips:{WC:'USED',LL:'USED',AP:'USED',NN:'USED',DRS:'USED',FF:'LOCKED'}} as const;

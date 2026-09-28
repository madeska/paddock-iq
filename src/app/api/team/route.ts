import {NextResponse} from 'next/server';
import {panassSnapshot} from '../../../lib/panass';
export async function GET(){return NextResponse.json({...panassSnapshot,syncStatus:'SCREENSHOT_ONLY',externalTeamId:null,forecastStatus:'NOT_AVAILABLE'});}

import {NextResponse} from 'next/server';
import {f1TeamBookmarklet} from '../../../../../lib/f1-team-browser-helper';
export async function GET(){return NextResponse.json({bookmarklet:f1TeamBookmarklet()},{headers:{'Cache-Control':'no-store'}})}

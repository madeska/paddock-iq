import {NextResponse} from 'next/server';
import {f1TeamBookmarklet} from '../../../../../lib/f1-team-browser-helper';
export async function GET(){const destination=process.env.NEXTAUTH_URL?new URL(process.env.NEXTAUTH_URL).origin:undefined;return NextResponse.json({bookmarklet:f1TeamBookmarklet(destination),fileBookmarklet:f1TeamBookmarklet(),direct:Boolean(destination)},{headers:{'Cache-Control':'no-store'}})}

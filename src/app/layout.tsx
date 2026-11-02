import type {ReactNode} from 'react';
import './style.css';
export const metadata={title:'Paddock IQ | F1 Fantasy Strategy',description:'Personal F1 Fantasy strategy dashboard'};
export default function RootLayout({children}:{children:ReactNode}){return <html lang="en"><body>{children}<footer className="site-footer"><span>Independent F1 Fantasy strategy tool.</span><a href="/privacy">Privacy</a><span>Not affiliated with Formula 1.</span></footer></body></html>}

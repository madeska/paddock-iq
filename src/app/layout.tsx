import type {ReactNode} from 'react';
import './style.css';
export const metadata={title:'Paddock IQ | F1 Fantasy Strategy',description:'Personal F1 Fantasy strategy dashboard'};
export default function RootLayout({children}:{children:ReactNode}){return <html lang="uk"><body>{children}</body></html>}

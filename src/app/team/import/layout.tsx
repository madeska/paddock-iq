export const dynamic='force-dynamic';
import {redirect} from 'next/navigation';import {sessionOwner} from '../../../lib/auth';import AccountMenu from '../../account-menu';export default async function Layout({children}:{children:React.ReactNode}){const owner=await sessionOwner();if(!owner)redirect('/login');return <><div style={{padding:'1rem'}}>{owner.email} · <AccountMenu/></div>{children}</>}

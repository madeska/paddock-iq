'use client';
import {signIn} from 'next-auth/react';export default function GoogleButton(){return <button onClick={()=>void signIn('google',{callbackUrl:'/my-team'})}>Continue with Google</button>}

'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="recovery"><h1>Unable to load this page</h1><p>The service may be temporarily unavailable. Try again in a moment.</p><div><button onClick={reset}>Try again</button><a href="/">Back to market</a></div></main>}

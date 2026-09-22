'use client';
import '@rainbow-me/rainbowkit/styles.css';
import {getDefaultConfig, RainbowKitProvider, darkTheme} from '@rainbow-me/rainbowkit';
import {WagmiProvider} from 'wagmi';
import {sepolia, baseSepolia} from 'wagmi/chains';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {useState} from 'react';
const config=getDefaultConfig({appName:'FairLance',projectId:process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID||'demo',chains:[sepolia,baseSepolia],ssr:true});
export default function Providers({children}:{children:React.ReactNode}){
 const [queryClient]=useState(()=>new QueryClient());
 return <WagmiProvider config={config}><QueryClientProvider client={queryClient}><RainbowKitProvider theme={darkTheme({accentColor:'#7c5cff'})}>{children}</RainbowKitProvider></QueryClientProvider></WagmiProvider>;
}

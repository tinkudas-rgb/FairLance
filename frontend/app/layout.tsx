import './styles.css';
import Providers from '../components/Providers';
export const metadata={title:'FairLance',description:'Milestone escrow with community dispute resolution'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body><Providers>{children}</Providers></body></html>}

'use client';
import {ConnectButton} from '@rainbow-me/rainbowkit';
import {useMemo,useState} from 'react';
import {useAccount,useReadContract,useWriteContract} from 'wagmi';
import {keccak256,parseEther,toBytes,formatEther} from 'viem';
import {fairLanceAbi} from '../lib/abi';

type Role='client'|'freelancer'|'juror';
const address=(process.env.NEXT_PUBLIC_CONTRACT_ADDRESS||'0x0000000000000000000000000000000000000000') as `0x${string}`;
const stateNames=['Funded','Submitted','Approved','Disputed','Resolved','Refunded'];
export default function Home(){
 const {isConnected}=useAccount(); const {writeContract,data:tx,isPending,error}=useWriteContract();
 const [role,setRole]=useState<Role>('client'); const [projectId,setProjectId]=useState('1'); const [milestoneId,setMilestoneId]=useState('0');
 const [freelancer,setFreelancer]=useState(''); const [job,setJob]=useState('Landing page redesign'); const [amounts,setAmounts]=useState('0.03, 0.02');
 const [work,setWork]=useState('ipfs://work-demo'); const [evidence,setEvidence]=useState('ipfs://evidence-demo'); const [disputeId,setDisputeId]=useState('1'); const [stake,setStake]=useState('0.01');
 const ids=[BigInt(projectId||0),BigInt(milestoneId||0)] as const;
 const project=useReadContract({address,abi:fairLanceAbi,functionName:'projects',args:[ids[0]],query:{enabled:address!=='0x0000000000000000000000000000000000000000'}});
 const milestone=useReadContract({address,abi:fairLanceAbi,functionName:'milestones',args:ids,query:{enabled:address!=='0x0000000000000000000000000000000000000000'}});
 const amountList=useMemo(()=>amounts.split(',').map(x=>x.trim()).filter(Boolean).map(x=>parseEther(x)),[amounts]);
 const send=(functionName:string,args:any[]=[],value?:bigint)=>writeContract({address,abi:fairLanceAbi,functionName:functionName as any,args,value} as any);
 return <main>
  <nav><div className="brand"><span>F</span>FairLance</div><ConnectButton chainStatus="icon" showBalance={false}/></nav>
  <section className="hero"><p className="eyebrow">TRUST, PROGRAMMED</p><h1>Work gets paid.<br/><em>Disputes get judged.</em></h1><p>Milestone escrow secured by smart contracts and a community of staked jurors.</p><div className="flow"><b>01 Lock</b><i/> <b>02 Deliver</b><i/> <b>03 Approve or dispute</b><i/> <b>04 Settle</b></div></section>
  <section className="workspace">
   <div className="rolebar">{(['client','freelancer','juror'] as Role[]).map(r=><button key={r} className={role===r?'active':''} onClick={()=>setRole(r)}>{r==='client'?'◈':r==='freelancer'?'✦':'⚖'} {r}</button>)}</div>
   {!isConnected&&<div className="notice">Connect a Sepolia wallet to run the live demo.</div>}
   <div className="grid">
    <div className="panel">
     {role==='client'&&<><Tag n="CLIENT DESK"/><h2>Create and fund a project</h2><label>Freelancer wallet<input value={freelancer} onChange={e=>setFreelancer(e.target.value)} placeholder="0x..."/></label><label>Job title or metadata URI<input value={job} onChange={e=>setJob(e.target.value)}/></label><label>Milestones in ETH, comma-separated<input value={amounts} onChange={e=>setAmounts(e.target.value)}/></label><button className="primary" disabled={!isConnected} onClick={()=>send('createProject',[freelancer,job,amountList],amountList.reduce((a,b)=>a+b,0n))}>Lock {amountList.reduce((a,b)=>a+b,0n)?formatEther(amountList.reduce((a,b)=>a+b,0n)):'0'} ETH</button><hr/><h3>Review milestone</h3><IdFields p={projectId} sp={setProjectId} m={milestoneId} sm={setMilestoneId}/><div className="twocol"><button onClick={()=>send('approveMilestone',ids as any)}>Approve & release</button><button className="danger" onClick={()=>send('openDispute',[ids[0],ids[1],evidence])}>Open dispute</button></div><label>Evidence URI<input value={evidence} onChange={e=>setEvidence(e.target.value)}/></label></>}
     {role==='freelancer'&&<><Tag n="FREELANCER DESK"/><h2>Submit milestone work</h2><IdFields p={projectId} sp={setProjectId} m={milestoneId} sm={setMilestoneId}/><label>Work URI<input value={work} onChange={e=>setWork(e.target.value)}/></label><button className="primary" onClick={()=>send('submitWork',[ids[0],ids[1],keccak256(toBytes(work)),work])}>Anchor work hash</button><hr/><h3>Need a fair review?</h3><label>Evidence URI<input value={evidence} onChange={e=>setEvidence(e.target.value)}/></label><button className="danger" onClick={()=>send('openDispute',[ids[0],ids[1],evidence])}>Trigger dispute</button></>}
     {role==='juror'&&<><Tag n="JUROR COURT"/><h2>Stake your judgment</h2><label>Stake in test ETH<input value={stake} onChange={e=>setStake(e.target.value)}/></label><button className="primary" onClick={()=>send('stakeAsJuror',[],parseEther(stake||'0'))}>Join juror pool</button><hr/><h3>Cast a vote</h3><label>Dispute ID<input value={disputeId} onChange={e=>setDisputeId(e.target.value)}/></label><div className="twocol"><button onClick={()=>send('castVote',[BigInt(disputeId||0),true])}>Freelancer wins</button><button onClick={()=>send('castVote',[BigInt(disputeId||0),false])}>Client wins</button></div><p className="small">Majority rules. Vote with the minority and 10% of your stake is slashed.</p></>}
     {isPending&&<p className="status">Confirm in wallet...</p>}{tx&&<p className="status">Transaction sent: {tx.slice(0,10)}...</p>}{error&&<p className="error">{error.message}</p>}
    </div>
    <div className="panel inspect"><Tag n="ONCHAIN INSPECTOR"/><h2>Project #{projectId}</h2>{project.data?<><Metric k="Client" v={short(project.data[0])}/><Metric k="Freelancer" v={short(project.data[1])}/><Metric k="Milestones" v={String(project.data[3])}/><Metric k="Milestone state" v={milestone.data?stateNames[Number(milestone.data[1])]:'-'}/><Metric k="Escrow" v={milestone.data?`${formatEther(milestone.data[0])} ETH`:'-'}/><Metric k="Work" v={milestone.data?.[3]||'Not submitted'}/></>:<div className="empty"><b>No deployment loaded</b><p>Set NEXT_PUBLIC_CONTRACT_ADDRESS after deploying, then select a project.</p></div>}<div className="architecture"><b>How FairLance settles</b><p>Client funds → freelancer submits → client approves</p><p>or</p><p>3 staked jurors → 2-of-3 majority → automatic payout</p></div></div>
   </div>
  </section>
  <footer>FAIRLANCE · TESTNET-ONLY HACKATHON MVP <span>Solidity · Sepolia · wagmi</span></footer>
 </main>
}
function Tag({n}:{n:string}){return <p className="tag">{n}</p>};
function short(v:string){return `${v.slice(0,6)}…${v.slice(-4)}`}
function Metric({k,v}:{k:string,v:string}){return <div className="metric"><span>{k}</span><b>{v}</b></div>}
function IdFields({p,sp,m,sm}:{p:string,sp:(x:string)=>void,m:string,sm:(x:string)=>void}){return <div className="twocol"><label>Project ID<input value={p} onChange={e=>sp(e.target.value)}/></label><label>Milestone ID<input value={m} onChange={e=>sm(e.target.value)}/></label></div>}

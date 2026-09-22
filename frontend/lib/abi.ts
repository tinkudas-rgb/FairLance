export const fairLanceAbi = [
  {type:'function',name:'createProject',stateMutability:'payable',inputs:[{name:'freelancer',type:'address'},{name:'metadataURI',type:'string'},{name:'amounts',type:'uint256[]'}],outputs:[{name:'projectId',type:'uint256'}]},
  {type:'function',name:'submitWork',stateMutability:'nonpayable',inputs:[{name:'projectId',type:'uint256'},{name:'milestoneId',type:'uint256'},{name:'workHash',type:'bytes32'},{name:'workURI',type:'string'}],outputs:[]},
  {type:'function',name:'approveMilestone',stateMutability:'nonpayable',inputs:[{name:'projectId',type:'uint256'},{name:'milestoneId',type:'uint256'}],outputs:[]},
  {type:'function',name:'openDispute',stateMutability:'nonpayable',inputs:[{name:'projectId',type:'uint256'},{name:'milestoneId',type:'uint256'},{name:'evidenceURI',type:'string'}],outputs:[{name:'disputeId',type:'uint256'}]},
  {type:'function',name:'stakeAsJuror',stateMutability:'payable',inputs:[],outputs:[]},
  {type:'function',name:'castVote',stateMutability:'nonpayable',inputs:[{name:'disputeId',type:'uint256'},{name:'forFreelancer',type:'bool'}],outputs:[]},
  {type:'function',name:'projects',stateMutability:'view',inputs:[{name:'',type:'uint256'}],outputs:[{name:'client',type:'address'},{name:'freelancer',type:'address'},{name:'metadataURI',type:'string'},{name:'milestoneCount',type:'uint256'},{name:'exists',type:'bool'}]},
  {type:'function',name:'milestones',stateMutability:'view',inputs:[{name:'',type:'uint256'},{name:'',type:'uint256'}],outputs:[{name:'amount',type:'uint256'},{name:'state',type:'uint8'},{name:'workHash',type:'bytes32'},{name:'workURI',type:'string'},{name:'disputeId',type:'uint256'}]},
  {type:'function',name:'getDispute',stateMutability:'view',inputs:[{name:'disputeId',type:'uint256'}],outputs:[{name:'projectId',type:'uint256'},{name:'milestoneId',type:'uint256'},{name:'opener',type:'address'},{name:'evidenceURI',type:'string'},{name:'selectedJurors',type:'address[3]'},{name:'clientVotes',type:'uint8'},{name:'freelancerVotes',type:'uint8'},{name:'voteCount',type:'uint8'},{name:'resolved',type:'bool'}]}
] as const;

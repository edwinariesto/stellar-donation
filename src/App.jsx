import React, { useState, useEffect } from 'react';
import { translations } from './utils/i18n';
import SwalOrig from 'sweetalert2';

const Swal = SwalOrig.mixin({
  buttonsStyling: false,
  customClass: {
    popup: 'overflow-hidden !pb-0',
    actions: 'flex w-full mt-6 !mb-0 !border-none',
    confirmButton: 'flex-1 bg-[#34C759] hover:bg-green-600 text-white py-3.5 font-bold transition-colors !m-0 !rounded-none min-w-0',
    cancelButton: 'flex-1 bg-[#FF3B30] hover:bg-red-600 text-white py-3.5 font-bold transition-colors !m-0 !rounded-none min-w-0',
    denyButton: 'flex-1 bg-gray-500 hover:bg-gray-600 text-white py-3.5 font-bold transition-colors !m-0 !rounded-none min-w-0'
  }
});
import {
  checkFreighterInstalled,
  getFreighterAddress,
  getXlmBalance,
  callReadOnly,
  executeTransaction,
  getGlobalTopDonors,
  checkFreighterNetwork,
  setAppNetwork
} from './utils/stellar';
import { Address, nativeToScVal } from '@stellar/stellar-sdk';
import bannerImg from './image/banner.png';
const DEFAULT_CONTRACT_ID = 'CABKLAYMJR3WTCAAP4CYZHF7OKAAE47U62EHI2GIY276NNEUB4SGJVBD';
const NATIVE_XLM_SAC = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

const initialNet = localStorage.getItem('steldot_last_network') || 'TESTNET';
setAppNetwork(initialNet);

export default function App() {
  // Wallet & Network State
  const [freighterInstalled, setFreighterInstalled] = useState(false);
  const [userAddress, setUserAddress] = useState('');
  const [freighterBalance, setFreighterBalance] = useState('0.00');
  const [contractId, setContractId] = useState(DEFAULT_CONTRACT_ID);
  const [isMockMode, setIsMockMode] = useState(true);
  const [networkMode, setNetworkMode] = useState(initialNet);
  const isOwner = userAddress === 'GCANOQWHT5YRXX2EBQXZJLFPZ5VHZWZA5ZB3FQEUU6CHDCSHXGS3QJ2O';
  
  // Platform & Contract State
  const [campaigns, setCampaigns] = useState([]);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [totalDonated, setTotalDonated] = useState(0);
  const [claimStatus, setClaimStatus] = useState(0); // 0 = None, 1 = Pending
  const [pendingClaims, setPendingClaims] = useState([]);
  const [totalRaised, setTotalRaised] = useState(0);
  const [totalClaimsApproved, setTotalClaimsApproved] = useState(0);
  const [totalClaimsPending, setTotalClaimsPending] = useState(0);
  const [contractBalance, setContractBalance] = useState(0);
  const [topDonors, setTopDonors] = useState([]);
  const [ownerAddress, setOwnerAddress] = useState('');
  const [lang, setLang] = useState('en');
  const t = translations[lang];

  // UI state
  const [donateAmounts, setDonateAmounts] = useState({});
  const [newCampaign, setNewCampaign] = useState({ id: '', title: '', description: '', target: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const [isSyncingTopDonors, setIsSyncingTopDonors] = useState(false);
  const [expandedCampaigns, setExpandedCampaigns] = useState({});
  const [translatedCampaigns, setTranslatedCampaigns] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('active'); // active, completed, inactive
  const [currentPage, setCurrentPage] = useState(1);
  const CAMPAIGNS_PER_PAGE = 3;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeTab]);

  // Initialize Freighter Check and first run check
  useEffect(() => {
    async function initCheck() {
      const installed = await checkFreighterInstalled();
      setFreighterInstalled(installed);
      
      const savedAddress = localStorage.getItem('steldot_wallet_address');
      if (savedAddress) setUserAddress(savedAddress);

      if (installed) {
        const net = await checkFreighterNetwork();
        setNetworkMode(net);
        setAppNetwork(net);
        const savedContract = localStorage.getItem(`steldot_contract_${net}`);
        if (savedContract) setContractId(savedContract);
      }

      // Show onboarding if not shown before
      const hasOnboarded = localStorage.getItem('steldot_onboarded');
      if (!hasOnboarded) {
        showOnboardingGuide();
      }
    }
    initCheck();
  }, []);

  // Fetch data whenever contract ID, user address, or mode changes
  useEffect(() => {
    refreshData();
  }, [contractId, userAddress]);

  useEffect(() => {
    if (isOwner && !newCampaign.id) {
      const unixTime = Math.floor(Date.now() / 1000);
      setNewCampaign(prev => ({ ...prev, id: `StelDot-${unixTime}` }));
    }
  }, [isOwner, newCampaign.id]);


  // Polling wallet balance if connected
  useEffect(() => {
    if (!userAddress) return;
    const interval = setInterval(async () => {
      const balance = await getXlmBalance(userAddress);
      setFreighterBalance(balance);
    }, 10000);
    return () => clearInterval(interval);
  }, [userAddress]);

  // Check if Freighter status and network changes
  useEffect(() => {
    const interval = setInterval(async () => {
      const installed = await checkFreighterInstalled();
      setFreighterInstalled(installed);
      
      if (installed) {
        const net = await checkFreighterNetwork();
        if (net !== networkMode) {
          localStorage.setItem('steldot_last_network', net);
          window.location.reload();
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [networkMode]);

  // Refresh stats and state
  const refreshData = async () => {
    if (!contractId || contractId.trim() === '') {
      enableMockMode('No Contract ID provided.');
      return;
    }

    try {
      setIsLoading(true);
      
      setSyncProgress('Step 1/4: Fetching smart contract info...');

      // Attempt read calls from on-chain contract
      const ownerRes = await callReadOnly(contractId, 'get_owner');
      setOwnerAddress(ownerRes || '');
      
      
      const raisedRes = await callReadOnly(contractId, 'get_total_raised');
      setTotalRaised(raisedRes ? Number(raisedRes) / 10000000 : 0);

      const approvedClaimsRes = await callReadOnly(contractId, 'get_total_claims_approved');
      setTotalClaimsApproved(Number(approvedClaimsRes || 0));

      const pendingClaimsCountRes = await callReadOnly(contractId, 'get_total_claims_pending');
      setTotalClaimsPending(Number(pendingClaimsCountRes || 0));

      // Get contract active balance (in SAC token)
      const balRes = await callReadOnly(NATIVE_XLM_SAC, 'balance', [
        nativeToScVal(Address.fromString(contractId))
      ]);
      setContractBalance(balRes ? Number(balRes) / 10000000 : 0);

      // Fetch donor points & donations
      setSyncProgress('Step 2/4: Fetching your wallet data...');
      if (userAddress) {
        const pointsRes = await callReadOnly(contractId, 'get_donor_points', [
          nativeToScVal(Address.fromString(userAddress))
        ]);
        setLoyaltyPoints(Number(pointsRes || 0));

        const donorTotalRes = await callReadOnly(contractId, 'get_donor_total_donated', [
          nativeToScVal(Address.fromString(userAddress))
        ]);
        setTotalDonated(donorTotalRes ? Number(donorTotalRes) / 10000000 : 0);

        const statusRes = await callReadOnly(contractId, 'get_claim_status', [
          nativeToScVal(Address.fromString(userAddress))
        ]);
        setClaimStatus(Number(statusRes || 0));
      }

      // Fetch pending claim list
      const pendingClaimsListRes = await callReadOnly(contractId, 'get_pending_claims');
      if (pendingClaimsListRes) {
        // Resolve raw Addresses to string representations
        const resolvedClaims = pendingClaimsListRes.map(addr => addr);
        setPendingClaims(resolvedClaims);
      }

      // Fetch all campaigns
      setSyncProgress('Step 3/4: Loading all campaigns...');
      const campaignIdsRes = await callReadOnly(contractId, 'get_campaign_ids');
      const loadedCampaigns = [];
      if (campaignIdsRes) {
        for (const id of campaignIdsRes) {
          const camp = await callReadOnly(contractId, 'get_campaign', [nativeToScVal(id, { type: 'u32' })]);
          if (camp) {
            loadedCampaigns.push({
              id: camp.id,
              title: camp.title.toString(),
              description: camp.description.toString(),
              target: Number(camp.target) / 10000000,
              raised: Number(camp.raised) / 10000000,
              active: camp.active
            });
          }
        }
      }
      setCampaigns(loadedCampaigns);

      // Fetch wallet balance
      if (userAddress) {
        const balance = await getXlmBalance(userAddress);
        setFreighterBalance(balance);
      }

      // Global top contributors sync has been moved to a separate manual button

      setIsMockMode(false);
    } catch (err) {
      console.warn('On-chain fetch failed, falling back to mock mode:', err);
      enableMockMode(`Unable to sync with Stellar ${networkMode}. Running in offline/mock preview mode.`);
    } finally {
      setIsLoading(false);
      setSyncProgress('');
    }
  };

  const handleSyncTopDonors = async () => {
    setIsSyncingTopDonors(true);
    setSyncProgress('Scanning global contributors...');
    try {
      const globalTop = await getGlobalTopDonors(contractId);
      if (globalTop && globalTop.length > 0) {
        setTopDonors(globalTop);
      } else {
        const realTop = [];
        if (userAddress && totalDonated > 0) {
          realTop.push({ address: userAddress, amount: totalDonated });
        }
        setTopDonors(realTop);
      }
    } finally {
      setIsSyncingTopDonors(false);
      setSyncProgress('');
    }
  };

  const toggleDescription = (id) => {
    setExpandedCampaigns(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleTranslate = async (camp) => {
    if (translatedCampaigns[camp.id] && !translatedCampaigns[camp.id].loading) {
      setTranslatedCampaigns(prev => {
        const next = { ...prev };
        delete next[camp.id];
        return next;
      });
      return;
    }

    setTranslatedCampaigns(prev => ({ ...prev, [camp.id]: { loading: true } }));

    try {
      const detectRes = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(camp.title)}`);
      const detectData = await detectRes.json();
      const detectedLang = detectData[2];
      
      const targetLang = (detectedLang === 'en') ? 'id' : 'en';
      
      const titleRes = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(camp.title)}`);
      const titleData = await titleRes.json();
      const translatedTitle = titleData[0].map(x => x[0]).join('');

      const descRes = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(camp.description)}`);
      const descData = await descRes.json();
      const translatedDesc = descData[0].map(x => x[0]).join('');

      setTranslatedCampaigns(prev => ({
        ...prev,
        [camp.id]: { loading: false, title: translatedTitle, description: translatedDesc, lang: targetLang }
      }));
    } catch (err) {
      console.error(err);
      SwalOrig.fire({ toast: true, position: 'top-end', icon: 'error', title: t.translateFailed, showConfirmButton: false, timer: 3000 });
      setTranslatedCampaigns(prev => {
        const next = { ...prev };
        delete next[camp.id];
        return next;
      });
    }
  };

  // Enforces a mock preview environment so that UI and actions always work
  const enableMockMode = (warning) => {
    setIsMockMode(true);
    setOwnerAddress('GCADMINOWNERSTELDOTPORTALADDRESSXLM');
    setOwnerAddress(prev => {
      
      return 'GCADMINOWNERSTELDOTPORTALADDRESSXLM';
    });

    // Clear static data to show empty state
    if (campaigns.length === 0) {
      setCampaigns([]);
    }
    setTotalRaised(prev => prev || 0);
    setTotalClaimsApproved(prev => prev || 0);
    setTotalClaimsPending(prev => prev || 0);
    setContractBalance(prev => prev || 0);

    const realTop = [];
    if (userAddress && totalDonated > 0) {
      realTop.push({ address: userAddress, amount: totalDonated });
    }
    setTopDonors(realTop);
    
    if (pendingClaims.length === 0) {
      setPendingClaims([]);
    }
  };


  const handleDisconnectWallet = () => {
    localStorage.removeItem('steldot_wallet_address');
    setUserAddress('');
    setFreighterBalance('0.00');
    setLoyaltyPoints(0);
    setTotalDonated(0);
    setClaimStatus(0);
  };

  // Connect Wallet Action
  const handleConnectWallet = async () => {
    try {
      const address = await getFreighterAddress();
      setUserAddress(address);
      localStorage.setItem('steldot_wallet_address', address);
      const balance = await getXlmBalance(address);
      setFreighterBalance(balance);
      
      Swal.fire({
        title: t.walletConnected,
        text: `${t.address}: ${address.substring(0, 6)}...${address.substring(50)}`,
        icon: 'success',
        confirmButtonColor: '#007AFF'
      });
    } catch (err) {
      Swal.fire({
        title: t.connError,
        text: err.message || t.connErrorDesc,
        icon: 'error',
        confirmButtonColor: '#FF3B30'
      });
    }
  };

  // Handle Donation
  const handleDonate = async (campaignId) => {
    const amount = parseFloat(donateAmounts[campaignId]);
    if (isNaN(amount) || amount <= 0) {
      Swal.fire({
        title: t.invalidAmount,
        text: t.invalidAmountDesc,
        icon: 'warning',
        confirmButtonColor: '#007AFF'
      });
      return;
    }

    if (isMockMode) {
      // Execute Mock Transaction
      setIsLoading(true);
      setTimeout(() => {
        // Update campaigns
        setCampaigns(prev => prev.map(c => {
          if (c.id === campaignId) {
            return { ...c, raised: c.raised + amount };
          }
          return c;
        }));
        
        // Update totals
        setTotalRaised(prev => prev + amount);
        setTotalDonated(prev => prev + amount);
        setLoyaltyPoints(prev => prev + 1); // +1 point per donation
        
        // Adjust balance
        setFreighterBalance(prev => (parseFloat(prev) - amount).toFixed(2));
        
        setIsLoading(false);
        Swal.fire({
          title: t.donationSuccess,
          html: t.donationSuccessMock(amount),
          icon: 'success',
          confirmButtonColor: '#34C759',
          timer: 5000,
          timerProgressBar: true
        }).then(() => {
          window.location.reload();
        });
        
        // Clear input
        setDonateAmounts(prev => ({ ...prev, [campaignId]: '' }));
      }, 1500);
    } else {
      // Execute On-Chain Transaction
      try {
        setIsLoading(true);
        Swal.fire({
          title: t.confirmSignature,
          text: t.confirmDonate,
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading()
        });

        const amountStroops = BigInt(Math.round(amount * 10000000));
        const donorSc = nativeToScVal(Address.fromString(userAddress));
        const campaignSc = nativeToScVal(campaignId, { type: 'u32' });
        const amountSc = nativeToScVal(amountStroops, { type: 'i128' });

        const txRes = await executeTransaction(contractId, 'donate', [donorSc, campaignSc, amountSc], userAddress);
        
        setDonateAmounts(prev => ({ ...prev, [campaignId]: '' }));
        await refreshData();
        
        Swal.fire({
          title: t.donationSuccess,
          html: t.donationProcessed(amount, txRes.hash, networkMode),
          icon: 'success',
          confirmButtonColor: '#34C759',
          timer: 5000,
          timerProgressBar: true
        }).then(() => {
          window.location.reload();
        });
      } catch (err) {
        Swal.fire({
          title: t.txFailed,
          text: err.message || t.txFailedDesc,
          icon: 'error',
          confirmButtonColor: '#FF3B30'
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Quick select chips
  const selectQuickAmount = (campaignId, amount) => {
    setDonateAmounts(prev => ({ ...prev, [campaignId]: amount.toString() }));
  };

  // Request Reward Payout
  const handleRequestClaim = async () => {
    if (loyaltyPoints < 10) {
      Swal.fire({
        title: t.pointsInsufficient,
        text: t.pointsInsufficientDesc,
        icon: 'warning',
        confirmButtonColor: '#007AFF'
      });
      return;
    }
    if (claimStatus === 1) {
      Swal.fire({
        title: t.claimPending,
        text: t.claimPendingDesc,
        icon: 'warning',
        confirmButtonColor: '#007AFF'
      });
      return;
    }

    if (isMockMode) {
      setIsLoading(true);
      setTimeout(() => {
        setClaimStatus(1);
        setTotalClaimsPending(prev => prev + 1);
        setPendingClaims(prev => [...prev, userAddress || 'GCSIMULATEDPENDINGCLIENTKEY']);
        
        setIsLoading(false);
        Swal.fire({
          title: t.rewardRequested,
          text: t.rewardRequestedDesc,
          icon: 'success',
          confirmButtonColor: '#007AFF'
        });
      }, 1500);
    } else {
      try {
        setIsLoading(true);
        Swal.fire({
          title: t.confirmSignature,
          text: t.confirmClaim,
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading()
        });

        const donorSc = nativeToScVal(Address.fromString(userAddress));
        await executeTransaction(contractId, 'request_claim', [donorSc], userAddress);
        
        Swal.fire({
          title: t.claimSubmitted,
          text: t.claimSubmittedDesc,
          icon: 'success',
          confirmButtonColor: '#34C759'
        });
        await refreshData();
      } catch (err) {
        Swal.fire({
          title: t.requestFailed,
          text: err.message || t.requestFailedDesc,
          icon: 'error',
          confirmButtonColor: '#FF3B30'
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Owner approves claim
  const handleApproveClaim = async (clientAddress) => {
    // Check treasury balance first (payout is 1 XLM)
    if (contractBalance < 1) {
      Swal.fire({
        title: t.treasuryDeficit,
        text: t.treasuryDeficitDesc(contractBalance.toFixed(2)),
        icon: 'error',
        confirmButtonColor: '#FF3B30'
      });
      return;
    }

    if (isMockMode) {
      setIsLoading(true);
      setTimeout(() => {
        // Payout to claimant
        if (clientAddress === userAddress) {
          setFreighterBalance(prev => (parseFloat(prev) + 1.0).toFixed(2));
          setLoyaltyPoints(0);
          setClaimStatus(0);
        }
        
        // Remove from list
        setPendingClaims(prev => prev.filter(c => c !== clientAddress));
        
        // Adjust counts and contract balance
        setTotalClaimsPending(prev => Math.max(0, prev - 1));
        setTotalClaimsApproved(prev => prev + 1);
        setContractBalance(prev => Math.max(0, prev - 1.0));
        
        setIsLoading(false);
        Swal.fire({
          title: t.claimApproved,
          text: t.claimApprovedMock(`${clientAddress.substring(0, 6)}...${clientAddress.substring(50)}`),
          icon: 'success',
          confirmButtonColor: '#34C759'
        });
      }, 1500);
    } else {
      try {
        setIsLoading(true);
        Swal.fire({
          title: t.approvingClaim,
          text: t.approvingClaimDesc,
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading()
        });

        const ownerSc = nativeToScVal(Address.fromString(userAddress));
        const donorSc = nativeToScVal(Address.fromString(clientAddress));

        const txRes = await executeTransaction(contractId, 'approve_claim', [ownerSc, donorSc], userAddress);
        Swal.fire({
          title: t.claimApproved,
          html: t.approvedSuccessfully(clientAddress.substring(0, 6) + '...', txRes.hash, networkMode),
          icon: 'success',
          confirmButtonColor: '#34C759'
        });
        await refreshData();
      } catch (err) {
        Swal.fire({
          title: t.approvalFailed,
          text: err.message || t.requestFailedDesc,
          icon: 'error',
          confirmButtonColor: '#FF3B30'
        });
      } finally {
        setIsLoading(false);
      }
    }
  };
  // Owner withdraws from treasury
  const handleWithdraw = async () => {
    const { value: formValues } = await Swal.fire({
      title: t.withdrawFunds,
      html: `
        <p class="text-sm text-gray-500 mb-4">${t.withdrawDesc}</p>
        <div class="relative flex items-center">
          <input type="number" id="swal-withdraw" class="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" min="0.1" step="0.1" placeholder="10.00">
          <span class="absolute right-4 font-bold text-xs text-ios-blue">XLM</span>
        </div>
      `,
      preConfirm: () => {
        return parseFloat(document.getElementById('swal-withdraw').value);
      }
    });

    if (!formValues || isNaN(formValues) || formValues <= 0) return;

    if (isMockMode) {
      if (formValues > contractBalance) {
        Swal.fire({ title: t.withdrawFailed, text: 'Insufficient treasury balance.', icon: 'error' });
        return;
      }
      setContractBalance(prev => prev - formValues);
      Swal.fire({ title: t.withdrawSuccess, text: 'Withdrawn in mock mode.', icon: 'success' });
    } else {
      setIsLoading(true);
      try {
        const amountSc = nativeToScVal(formValues * 10000000, { type: 'i128' });
        const ownerSc = nativeToScVal(Address.fromString(userAddress));
        
        const txRes = await executeTransaction(contractId, 'withdraw', [ownerSc, amountSc], userAddress);
        Swal.fire({
          title: t.withdrawSuccess,
          html: t.withdrawSuccessDesc(formValues, txRes.hash, networkMode),
          icon: 'success',
          confirmButtonColor: '#34C759'
        });
        await refreshData();
      } catch (err) {
        Swal.fire({
          title: t.withdrawFailed,
          text: err.message || t.requestFailedDesc,
          icon: 'error',
          confirmButtonColor: '#FF3B30'
        });
      } finally {
        setIsLoading(false);
      }
    }
  };


  // Owner updates a campaign
  const handleUpdateCampaign = async (camp) => {
    const { value: formValues } = await Swal.fire({
      title: 'Update Campaign',
      html: `
        <div class="text-left space-y-4 mt-4">
          <div>
            <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">${t.title}</label>
            <input id="swal-title" class="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow" value="${camp.title}">
          </div>
          <div>
            <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">${t.description}</label>
            <textarea id="swal-desc" rows="6" class="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow resize-y">${camp.description}</textarea>
          </div>
          <div>
            <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">${t.goalTarget}</label>
            <input type="number" id="swal-target" class="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow" value="${camp.target}">
          </div>
          <div class="flex items-center gap-2 pt-2 pb-1">
            <input type="checkbox" id="swal-active" class="w-5 h-5 accent-blue-500 rounded border-gray-300 focus:ring-blue-500 cursor-pointer" ${camp.active ? 'checked' : ''}>
            <label for="swal-active" class="text-sm font-bold text-gray-700 cursor-pointer">Set as Active Campaign</label>
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      preConfirm: () => {
        return {
          title: document.getElementById('swal-title').value,
          description: document.getElementById('swal-desc').value,
          target: parseFloat(document.getElementById('swal-target').value),
          active: document.getElementById('swal-active').checked
        };
      }
    });

    if (!formValues) return;

    if (!formValues.title || !formValues.description || isNaN(formValues.target)) {
      Swal.fire({ title: t.invalidInputs, text: t.invalidInputsDesc, icon: 'warning' });
      return;
    }

    if (isMockMode) {
      setCampaigns(prev => prev.map(c => 
        c.id === camp.id ? { ...c, title: formValues.title, description: formValues.description, target: formValues.target, active: formValues.active } : c
      ));
      Swal.fire('Updated', 'Campaign updated in mock mode.', 'success');
    } else {
      try {
        setIsLoading(true);
        Swal.fire({
          title: 'Updating Campaign',
          text: 'Please sign the update_campaign transaction in Freighter.',
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading()
        });

        const ownerSc = nativeToScVal(Address.fromString(userAddress));
        const idSc = nativeToScVal(camp.id, { type: 'u32' });
        const titleSc = nativeToScVal(formValues.title);
        const descSc = nativeToScVal(formValues.description);
        const targetStroops = BigInt(Math.round(formValues.target * 10000000));
        const targetSc = nativeToScVal(targetStroops, { type: 'i128' });
        const activeSc = nativeToScVal(formValues.active);

        await executeTransaction(
          contractId,
          'update_campaign',
          [ownerSc, idSc, titleSc, descSc, targetSc, activeSc],
          userAddress
        );

        Swal.fire('Updated', 'Campaign updated successfully on-chain.', 'success');
        await refreshData();
      } catch (err) {
        Swal.fire('Update Failed', err.message || 'Signature rejected.', 'error');
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Owner creates new campaign

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    const id = parseInt(newCampaign.id.toString().replace('StelDot-', ''));
    const target = parseFloat(newCampaign.target);
    const title = newCampaign.title.trim();
    const description = newCampaign.description.trim();

    if (isNaN(id) || isNaN(target) || target <= 0 || !title || !description) {
      Swal.fire({
        title: t.invalidInputs,
        text: t.invalidInputsDesc,
        icon: 'warning',
        confirmButtonColor: '#FF3B30'
      });
      return;
    }

    if (isMockMode) {
      setCampaigns(prev => [...prev, { id, title, description, target, raised: 0, active: true }]);
      const unixTime = Math.floor(Date.now() / 1000);
      setNewCampaign({ id: `StelDot-${unixTime}`, title: '', description: '', target: '' });
      Swal.fire({
        title: t.campaignCreated,
        text: t.campaignCreatedMock,
        icon: 'success',
        confirmButtonColor: '#34C759'
      });
    } else {
      try {
        setIsLoading(true);
        Swal.fire({
          title: t.creatingCampaign,
          text: t.creatingCampaignDesc,
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading()
        });

        const ownerSc = nativeToScVal(Address.fromString(userAddress));
        const idSc = nativeToScVal(id, { type: 'u32' });
        const titleSc = nativeToScVal(title);
        const descSc = nativeToScVal(description);
        const targetStroops = BigInt(Math.round(target * 10000000));
        const targetSc = nativeToScVal(targetStroops, { type: 'i128' });

        await executeTransaction(
          contractId,
          'create_campaign',
          [ownerSc, idSc, titleSc, descSc, targetSc],
          userAddress
        );

        Swal.fire({
          title: t.campaignAdded,
          text: typeof t.campaignAddedDesc === 'function' ? t.campaignAddedDesc(networkMode) : t.campaignAddedDesc,
          icon: 'success',
          confirmButtonColor: '#34C759'
        });
        const unixTime = Math.floor(Date.now() / 1000);
        setNewCampaign({ id: `StelDot-${unixTime}`, title: '', description: '', target: '' });
        await refreshData();
      } catch (err) {
        const unixTime = Math.floor(Date.now() / 1000);
        setNewCampaign(prev => ({ ...prev, id: `StelDot-${unixTime}` }));
        
        let errorText = err.message || t.requestFailedDesc;
        if (errorText.includes('UnreachableCodeReached')) {
          errorText = "Kontrak menolak transaksi ini (kemungkinan ID Kampanye sudah terpakai karena transaksi sebelumnya sebenarnya berhasil, atau ada input yang tidak valid). ID telah direset otomatis, silakan periksa daftar kampanye Anda atau coba lagi.";
        }

        Swal.fire({
          title: t.deploymentFailed,
          text: errorText,
          icon: 'error',
          confirmButtonColor: '#FF3B30'
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Modal Dialogs
  const showOnboardingGuide = () => {
    Swal.fire({
      title: t.welcomeTitle,
      iconHtml: '<div class="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center border-4 border-white shadow-sm"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-500"><path d="M18 11V6a2 2 0 0 0-4 0v4"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V5a2 2 0 0 0-4 0v9"/><path d="M6 14v-2a2 2 0 0 0-4 0v5c0 4.418 4.477 8 10 8h2c4.418 0 8-3.582 8-8V9a2 2 0 0 0-4 0v5"/></svg></div>',
      html: t.welcomeDesc,
      confirmButtonText: t.letsGo
    });
    localStorage.setItem('steldot_onboarded', 'true');
  };

  const handleContractIdPrompt = () => {
    Swal.fire({
      title: t.configContract,
      input: 'text',
      inputLabel: t.configContractLabel,
      inputValue: contractId,
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value) {
          return t.contractRequired;
        }
        if (!value.startsWith('C') || value.length !== 56) {
          return t.contractInvalid;
        }
      }
    }).then((result) => {
      if (result.isConfirmed) {
        localStorage.setItem(`steldot_contract_${networkMode}`, result.value);
        setContractId(result.value);
        Swal.fire({
          title: t.updated,
          text: t.updatedDesc,
          icon: 'success',
          confirmButtonColor: '#007AFF'
        });
      }
    });
  };

  // Helper metric computation
  const acceptPercentage = totalClaimsApproved + totalClaimsPending > 0
    ? ((totalClaimsApproved / (totalClaimsApproved + totalClaimsPending)) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex flex-col font-sans relative pb-12">
      
      {/* Sync Progress Banner */}
      {syncProgress && (
        <div className="relative bg-blue-600/95 backdrop-blur-md text-white text-[10px] sm:text-xs font-bold text-center py-2 z-[50] shadow-md flex items-center justify-center gap-2 sm:gap-3 transition-all duration-300">
          <span className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          <span>{t.blockchainSync}: {syncProgress}</span>
        </div>
      )}

      {/* Hero Header */}
      {!freighterInstalled && (
        <div className="bg-ios-red text-white py-3 px-4 text-center text-sm font-semibold flex items-center justify-center gap-2 animate-bounce">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {t.walletNotDetected} 
          <a href="https://www.freighter.app/" target="_blank" rel="noopener noreferrer" className="underline font-bold ml-1 hover:text-gray-100">
            {t.installFreighter}
          </a>
        </div>
      )}

      {/* Main Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-ios-lightGray shadow-sm min-h-[64px] py-2 flex items-center">
        <div className="max-w-6xl w-full mx-auto px-3 sm:px-6 flex flex-wrap sm:flex-nowrap justify-between items-center gap-y-2">
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 sm:w-7 sm:h-7">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            <span className="text-base sm:text-xl font-bold tracking-tight text-ios-darkText hidden sm:block">Stel<span className="text-ios-blue">Dot</span></span>
          </div>

          
          <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-3">
            <div className="flex items-center bg-[#F2F2F7] rounded-full p-0.5 sm:p-1 border border-ios-lightGray/40 mr-1 sm:mr-2">
              <button
                onClick={() => setLang('en')}
                className={`px-2 py-1 sm:px-3 sm:py-1 rounded-full text-[9px] sm:text-xs font-bold transition-all ${lang === 'en' ? 'bg-ios-blue shadow-sm text-white' : 'text-ios-secondaryText hover:text-ios-darkText'}`}
              >
                🇬🇧 <span className="hidden sm:inline">ENG</span>
              </button>
              <button
                onClick={() => setLang('id')}
                className={`px-2 py-1 sm:px-3 sm:py-1 rounded-full text-[9px] sm:text-xs font-bold transition-all ${lang === 'id' ? 'bg-ios-blue shadow-sm text-white' : 'text-ios-secondaryText hover:text-ios-darkText'}`}
              >
                🇮🇩 <span className="hidden sm:inline">IND</span>
              </button>
            </div>

            <button 
              onClick={showOnboardingGuide}
              className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500 hover:bg-blue-100 active:scale-95 transition-all shrink-0"
              title="View Onboarding Guide"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 sm:w-4 sm:h-4"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>
            </button>
            
            {userAddress ? (
              <button 
                onClick={refreshData}
                disabled={isLoading}
                className="ios-transition ios-active-scale px-2 py-1.5 sm:px-4 sm:py-2 rounded-full text-[10px] sm:text-xs font-semibold bg-ios-lightGray text-ios-secondaryText flex items-center gap-1 sm:gap-2 hover:bg-gray-200 shrink-0"
              >
                {isLoading ? <span className="spinner w-3 h-3 border-2"></span> : <span className="hidden sm:inline">{t.sync}</span>}
                {!isLoading && <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" className="sm:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21v-5h5"/></svg>}
              </button>
            ) : null}

            {userAddress ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="px-2 py-1.5 sm:px-4 sm:py-2 rounded-full text-[10px] sm:text-sm font-semibold flex items-center gap-1 sm:gap-2 bg-ios-lightGray text-ios-secondaryText cursor-default shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" className="hidden sm:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <span>{`${userAddress.substring(0, 4)}...${userAddress.substring(52)}`}</span>
                </div>
                <button 
                  onClick={handleDisconnectWallet}
                  className="ios-transition ios-active-scale px-2 py-1.5 sm:px-4 sm:py-2 rounded-full text-[10px] sm:text-sm font-semibold bg-[#FF3B30]/10 text-[#FF3B30] hover:bg-[#FF3B30]/20 flex items-center gap-1 sm:gap-2 shrink-0"
                  title={t.disconnectWallet}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" className="sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                  <span className="hidden sm:inline">{t.disconnect}</span>
                </button>
              </div>
            ) : (
              <button 
                onClick={handleConnectWallet}
                className="ios-transition ios-active-scale px-3 py-1.5 sm:px-5 sm:py-2 rounded-full text-[10px] sm:text-sm font-semibold flex items-center gap-1 sm:gap-2 bg-ios-blue text-white shadow-md shadow-blue-500/10 hover:bg-blue-600 shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" className="sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span className="hidden sm:inline">{t.connectFreighter}</span>
                <span className="sm:hidden">Connect</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl w-full mx-auto px-6 mt-8 flex-grow">
        
        {/* Responsive Hero Banner */}
        <div className="w-full mb-8 rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white border border-ios-lightGray/50">
          <img src={bannerImg} alt="StelDot Campaign Banner" className="w-full h-auto object-cover max-h-[180px] sm:max-h-[300px] md:max-h-[400px] hover:scale-[1.02] transition-transform duration-700 ease-in-out" />
        </div>
        
        {/* On-Chain Connection Mode Warning */}
        {isMockMode && (
          <div className="mb-6 p-4 rounded-2xl bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm flex gap-3 items-center shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-600 flex-shrink-0">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div>
              <span className="font-bold">{t.mockModeAlert}</span> {t.mockModeDesc} 
              <button onClick={handleContractIdPrompt} className="underline font-bold ml-1 text-ios-blue">{t.setContractId}</button> {typeof t.toLinkTestnet === 'function' ? t.toLinkTestnet(networkMode) : t.toLinkTestnet}
            </div>
          </div>
        )}

        {/* Header Cards Row (Heading Metrics) */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          
          {/* Metric Card 1: Total Donasi Terkumpul */}
          <div className="bg-white rounded-2xl p-6 shadow-ios border border-ios-lightGray/30 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-ios-darkGray">{t.totalDonations}</span>
              <div className="text-3xl font-extrabold text-ios-darkText mt-2">{totalRaised.toFixed(2)} <span className="text-lg font-bold text-ios-blue">XLM</span></div>
            </div>
            <p className="text-[11px] text-ios-darkGray mt-4">{t.acrossCampaigns}</p>
          </div>

          {/* Metric Card 2: Poin Accept */}
          <div className="bg-white rounded-2xl p-6 shadow-ios border border-ios-lightGray/30 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-ios-darkGray">{t.pointsAccept}</span>
              <div className="text-3xl font-extrabold text-ios-green mt-2">
                {totalClaimsApproved} <span className="text-lg font-bold text-ios-darkGray">{t.approved}</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="text-xs font-semibold text-ios-secondaryText">{t.pendingClaimsCount(totalClaimsPending)}</div>
                <span className="text-xs text-ios-darkGray font-medium">({acceptPercentage}% {t.rate})</span>
              </div>
            </div>
            
            {/* Progress of approved vs total claims */}
            <div className="w-full bg-ios-lightGray h-2 rounded-full overflow-hidden mt-3">
              <div className="bg-ios-green h-full" style={{ width: `${acceptPercentage}%` }}></div>
            </div>
          </div>

          {/* Metric Card 3: Donasi Anda */}
          <div className="bg-white rounded-2xl p-6 shadow-ios border border-ios-lightGray/30 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-ios-darkGray">{t.yourDonation}</span>
              <div className="text-3xl font-extrabold text-ios-darkText mt-2">{totalDonated.toFixed(2)} <span className="text-lg font-bold text-ios-blue">XLM</span></div>
            </div>
            {userAddress ? (
              <div className="mt-4 flex justify-between items-center bg-[#F2F2F7] py-2 px-3 rounded-xl border border-ios-lightGray/30">
                <span className="text-xs font-semibold text-ios-secondaryText">{t.activePoints}</span>
                <span className="text-sm font-bold text-ios-blue">{loyaltyPoints} / 10</span>
              </div>
            ) : (
              <p className="text-[11px] text-ios-red mt-4">{t.connectHistory}</p>
            )}
          </div>
        </section>

        {/* Loyalty Reward Claims & Actions */}
        {userAddress && (
          <section className="bg-white rounded-2xl p-6 shadow-ios border border-ios-lightGray/30 mb-8 flex flex-col md:flex-row items-center justify-between gap-6 glow-blue">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-yellow-100 flex items-center justify-center border border-yellow-200">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>
              </div>
              <div>
                <h3 className="font-bold text-lg">{t.claimLoyalty}</h3>
                <p className="text-sm text-ios-secondaryText mt-0.5">
                  <span dangerouslySetInnerHTML={{ __html: t.accumulateDesc(loyaltyPoints) }}></span>
                </p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 w-full md:w-auto">
              <button 
                onClick={handleRequestClaim}
                disabled={loyaltyPoints < 10 || claimStatus === 1 || isLoading}
                className={`ios-transition ios-active-scale px-8 py-3.5 rounded-2xl text-sm font-bold shadow-md shadow-blue-500/10 w-full md:w-auto ${
                  loyaltyPoints >= 10 && claimStatus !== 1
                    ? 'bg-ios-blue text-white hover:bg-blue-600'
                    : 'bg-ios-lightGray text-ios-darkGray cursor-not-allowed shadow-none'
                }`}
              >
                {claimStatus === 1 ? t.claimPendingBtn : t.claimRewardBtn}
              </button>
              {claimStatus === 1 && (
                <span className="text-xs text-ios-red font-semibold">
                  {t.limitReached}
                </span>
              )}
            </div>
          </section>
        )}

        {/* Owner Dashboard (Visible to Owner only) */}
        {isOwner && (
          <section className="bg-white border-2 border-ios-red/20 rounded-2xl p-8 shadow-ios mb-12 bg-gradient-to-br from-red-50/10 to-white">
            
            <div className="flex items-center gap-3 border-b border-ios-lightGray pb-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center border border-red-200 flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-ios-red">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-ios-darkText">{t.adminPanel}</h2>
                <p className="text-xs text-ios-secondaryText">{t.adminPanelDesc}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Campaign Creation */}
              <div>
                <h3 className="font-bold text-sm text-ios-secondaryText uppercase tracking-wider mb-4">{t.createNewCampaign}</h3>
                <form onSubmit={handleCreateCampaign} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-ios-darkGray block mb-1">AUTO CAMPAIGN ID</label>
                    <input 
                      type="text" 
                      value={newCampaign.id}
                      readOnly
                      placeholder="e.g. StelDot-126035" 
                      className="w-full bg-[#E5E5EA] border border-ios-lightGray/40 rounded-xl px-4 py-2.5 text-sm outline-none cursor-not-allowed text-ios-darkGray"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-ios-darkGray block mb-1">{t.title}</label>
                    <input 
                      type="text" 
                      value={newCampaign.title}
                      onChange={(e) => setNewCampaign({ ...newCampaign, title: e.target.value })}
                      placeholder="Save the Wildlife" 
                      className="w-full bg-[#F2F2F7] border border-ios-lightGray/40 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-ios-blue transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-ios-darkGray block mb-1">{t.description}</label>
                    <textarea 
                      value={newCampaign.description}
                      onChange={(e) => setNewCampaign({ ...newCampaign, description: e.target.value })}
                      placeholder="Describe the funding campaign..." 
                      rows="5"
                      className="w-full bg-[#F2F2F7] border border-ios-lightGray/40 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-ios-blue transition-all"
                    ></textarea>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-ios-darkGray block mb-1">{t.goalTarget}</label>
                    <input 
                      type="number" 
                      value={newCampaign.target}
                      onChange={(e) => setNewCampaign({ ...newCampaign, target: e.target.value })}
                      placeholder="e.g. 500" 
                      className="w-full bg-[#F2F2F7] border border-ios-lightGray/40 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-ios-blue transition-all"
                    />
                  </div>
                  
                  <button 
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-ios-blue text-white font-bold rounded-xl py-3 text-sm shadow-md shadow-blue-500/10 hover:bg-blue-600 transition-all"
                  >
                    {t.deployCampaign}
                  </button>
                </form>
              </div>

              {/* Pending Claims Queue */}
              <div className="flex flex-col h-full justify-between">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-sm text-ios-secondaryText uppercase tracking-wider">{t.pendingRewardsQueue}</h3>
                    <div className="bg-ios-red/10 border border-ios-red/20 px-3 py-1 rounded-full text-xs font-bold text-ios-red">
                      {pendingClaims.length} {t.pending}
                    </div>
                  </div>

                  <div className="space-y-3 overflow-y-auto max-h-[220px] pr-1">
                    {pendingClaims.length === 0 ? (
                      <p className="text-xs text-ios-secondaryText text-center py-8">{t.noPendingQueue}</p>
                    ) : (
                      pendingClaims.map((claimant, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 rounded-xl border border-ios-lightGray/20 bg-gray-50 hover:bg-gray-100 transition-colors">
                          <div className="min-w-0 flex-grow">
                            <span className="text-xs font-bold text-ios-darkText font-mono block truncate" title={claimant}>
                              {claimant}
                            </span>
                            <span className="text-[10px] font-semibold text-ios-darkGray uppercase">{t.needsPayout}</span>
                          </div>
                          
                          <button 
                            onClick={() => handleApproveClaim(claimant)}
                            disabled={isLoading}
                            className="bg-ios-green hover:bg-green-600 text-white rounded-lg px-3 py-1.5 text-xs font-bold shadow-md shadow-green-500/10 transition-all flex-shrink-0"
                          >
                            {t.approve}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-ios-bg p-4 rounded-xl border border-ios-lightGray/30 mt-6 flex justify-between items-center text-xs flex-wrap gap-3">
                  <div>
                    <span className="text-ios-darkGray block font-semibold uppercase text-[9px]">{t.treasuryCashBalance}</span>
                    <strong className="text-base text-ios-red">{contractBalance.toFixed(2)} XLM</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-ios-secondaryText bg-white border border-ios-lightGray/40 px-2.5 py-1 rounded-full font-bold hidden sm:block">
                      {t.minRequired}
                    </span>
                    <button 
                      onClick={handleWithdraw}
                      disabled={isLoading || contractBalance <= 0}
                      className="bg-ios-blue hover:bg-blue-600 text-white text-[10px] px-3 py-1.5 rounded-lg font-bold shadow-sm transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      {t.withdrawFunds}
                    </button>
                  </div>
                </div>

              </div>

            </div>
          </section>
        )}

        {/* Dashboard Grid Split */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Column 1 & 2: Campaigns */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-xl font-bold tracking-tight text-ios-darkText flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center border border-blue-200">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-700"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
                </div>
                {t.activeCampaigns}
              </h2>
              <div className="relative">
                <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <input 
                  type="text" 
                  placeholder={t.searchCampaign}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-full sm:w-64 transition-shadow"
                />
              </div>
            </div>
            
            {(() => {
              const categorizedCampaigns = {
                active: [],
                completed: [],
                inactive: []
              };

              [...campaigns]
                .sort((a, b) => b.id.toString().localeCompare(a.id.toString()))
                .forEach(c => {
                  if (c.raised >= c.target) {
                    categorizedCampaigns.completed.push(c);
                  } else if (!c.active) {
                    categorizedCampaigns.inactive.push(c);
                  } else {
                    categorizedCampaigns.active.push(c);
                  }
                });

              const filteredCampaigns = categorizedCampaigns[activeTab].filter(c => 
                c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                c.id.toString().toLowerCase().includes(searchQuery.toLowerCase())
              );
              const totalPages = Math.ceil(filteredCampaigns.length / CAMPAIGNS_PER_PAGE);
              const currentCampaigns = filteredCampaigns.slice((currentPage - 1) * CAMPAIGNS_PER_PAGE, currentPage * CAMPAIGNS_PER_PAGE);

              return (
                <>
                  <div className="flex bg-gray-100 p-1.5 rounded-2xl mb-6 shadow-inner gap-1 overflow-x-auto hide-scrollbar">
                    <button 
                      onClick={() => setActiveTab('active')}
                      className={`flex-1 min-w-max flex justify-center items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${activeTab === 'active' ? 'bg-white text-ios-blue shadow-sm' : 'text-ios-secondaryText hover:text-ios-darkText'}`}
                    >
                      {t.tabActive} <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'active' ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500'}`}>{categorizedCampaigns.active.length}</span>
                    </button>
                    <button 
                      onClick={() => setActiveTab('completed')}
                      className={`flex-1 min-w-max flex justify-center items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${activeTab === 'completed' ? 'bg-white text-ios-green shadow-sm' : 'text-ios-secondaryText hover:text-ios-darkText'}`}
                    >
                      {t.tabCompleted} <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'completed' ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'}`}>{categorizedCampaigns.completed.length}</span>
                    </button>
                    <button 
                      onClick={() => setActiveTab('inactive')}
                      className={`flex-1 min-w-max flex justify-center items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${activeTab === 'inactive' ? 'bg-white text-ios-red shadow-sm' : 'text-ios-secondaryText hover:text-ios-darkText'}`}
                    >
                      {t.tabInactive} <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'inactive' ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-500'}`}>{categorizedCampaigns.inactive.length}</span>
                    </button>
                  </div>

                  {campaigns.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 text-center text-ios-secondaryText border border-ios-lightGray/40 shadow-ios">
                      {t.noCampaigns}
                    </div>
                  ) : filteredCampaigns.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 text-center text-ios-secondaryText border border-ios-lightGray/40 shadow-ios">
                      {t.noSearchResults}
                    </div>
                  ) : (
                    currentCampaigns.map((camp) => {
                const percent = Math.min((camp.raised / camp.target) * 100, 100).toFixed(0);
                
                const translated = translatedCampaigns[camp.id];
                const activeTitle = translated?.title || camp.title;
                const activeDesc = translated?.description || camp.description;

                const isExpanded = expandedCampaigns[camp.id];
                const maxLength = 150;
                const lines = activeDesc.split('\n');
                const shouldTruncate = activeDesc.length > maxLength || lines.length > 3;
                
                let displayDesc = activeDesc;
                if (!isExpanded && shouldTruncate) {
                  if (lines.length > 3) {
                    const threeLines = lines.slice(0, 3).join('\n');
                    displayDesc = threeLines.length > maxLength ? threeLines.substring(0, maxLength) + '...' : threeLines + '...';
                  } else {
                    displayDesc = activeDesc.substring(0, maxLength) + '...';
                  }
                }
                
                return (
                  <div key={camp.id} className="bg-white rounded-2xl p-6 shadow-ios border border-ios-lightGray/30 ios-transition hover:shadow-md">
                    <div className="flex justify-between items-start gap-4 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-ios-blue bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                            {t.campaignIdLabel}{camp.id}
                          </span>
                          {isOwner && (
                            <button onClick={() => handleUpdateCampaign(camp)} className="text-[10px] font-bold text-ios-darkText bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full hover:bg-gray-200 transition-colors flex items-center gap-1">
                              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                              Edit
                            </button>
                          )}
                        </div>
                        <div className="flex items-start sm:items-center gap-2 mt-1">
                          <button 
                            onClick={() => handleTranslate(camp)}
                            disabled={translated?.loading}
                            title={translated ? t.showOriginal : t.translateBtn}
                            className={`p-1.5 rounded-full border transition-colors flex items-center justify-center flex-shrink-0 mt-1 sm:mt-0 ${translated ? 'bg-blue-100 border-blue-200 text-blue-600' : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100'}`}
                          >
                            {translated?.loading ? (
                              <span className="spinner w-3 h-3 border-2 border-ios-blue"></span>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>
                            )}
                          </button>
                          <h3 className="font-bold text-lg text-ios-darkText leading-tight">{activeTitle} {!camp.active && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full ml-2 align-middle">Inactive</span>}</h3>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-ios-blue">{percent}%</span>
                        <span className="text-xs text-ios-darkGray block font-medium">{t.raised}</span>
                      </div>
                    </div>

                    <p className={`text-sm text-ios-secondaryText leading-relaxed whitespace-pre-wrap ${shouldTruncate ? 'mb-1' : 'mb-4'}`}>
                      {displayDesc}
                    </p>
                    {shouldTruncate && (
                      <button 
                        onClick={() => toggleDescription(camp.id)} 
                        className="text-[11px] font-bold text-ios-blue hover:text-blue-600 transition-colors mb-4 inline-block"
                      >
                        {isExpanded ? t.showLess : t.showMore}
                      </button>
                    )}

                    {/* Progress Bar */}
                    <div className="w-full bg-ios-bg h-2 rounded-full overflow-hidden mb-6 border border-ios-lightGray/10">
                      <div 
                        className="bg-gradient-to-r from-ios-blue to-ios-green h-full rounded-full transition-all duration-500" 
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>

                    <div className="flex justify-between text-xs text-ios-darkGray font-semibold mb-6">
                      <span>{t.raisedLabel} {camp.raised.toFixed(2)} XLM</span>
                      <span>{t.target} {camp.target.toFixed(2)} XLM</span>
                    </div>

                    {/* Donation Action Form */}
                    {userAddress && camp.active && camp.raised < camp.target ? (
                      <div className="border-t border-ios-lightGray pt-4">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-ios-darkGray block mb-2">{t.donateToThis}</label>
                        
                        <div className="flex gap-3 mb-3">
                          <div className="relative flex-grow flex items-center">
                            <input 
                              type="number" 
                              min="0.1" 
                              step="0.1"
                              value={donateAmounts[camp.id] || ''}
                              onChange={(e) => setDonateAmounts({ ...donateAmounts, [camp.id]: e.target.value })}
                              placeholder="10.00" 
                              className="w-full bg-[#F2F2F7] border border-ios-lightGray/40 rounded-xl px-4 py-3 font-semibold text-sm outline-none focus:border-ios-blue transition-all"
                            />
                            <span className="absolute right-4 font-bold text-xs text-ios-blue">XLM</span>
                          </div>
                          
                          <button 
                            onClick={() => handleDonate(camp.id)}
                            disabled={isLoading}
                            className="bg-ios-blue text-white rounded-xl px-6 py-3 text-sm font-bold shadow-md shadow-blue-500/10 ios-active-scale hover:bg-blue-600 transition-all flex-shrink-0"
                          >
                            {t.donate}
                          </button>
                        </div>

                        {/* Quick select chips */}
                        <div className="flex gap-2 flex-wrap">
                          {[5, 10, 25, 50].map((amt) => (
                            <button 
                              key={amt} 
                              onClick={() => selectQuickAmount(camp.id, amt)}
                              className="px-3 py-1.5 rounded-full border border-ios-lightGray text-[11px] font-bold text-ios-secondaryText hover:bg-gray-50 active:scale-95 transition-all"
                            >
                              +{amt} XLM
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-ios-bg p-3 rounded-xl border border-ios-lightGray/30 text-center text-xs font-semibold text-ios-secondaryText">
                        {userAddress ? (camp.raised >= camp.target ? t.campCompleted : t.campInactive) : t.connectWallet}
                      </div>
                    )}
                  </div>
                );
              })
            )}
              
              {totalPages > 1 && (
                <div className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm border border-ios-lightGray/30 mt-6">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 rounded-full text-sm font-bold bg-gray-50 text-ios-darkText border border-gray-200 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {t.prevPage}
                  </button>
                  <span className="text-sm font-semibold text-ios-secondaryText">
                    {t.page} {currentPage} {t.of} {totalPages}
                  </span>
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 rounded-full text-sm font-bold bg-gray-50 text-ios-darkText border border-gray-200 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {t.nextPage}
                  </button>
                </div>
              )}
            </>
          )
        })()}
          </div>

          {/* Column 3: Sidebar */}
          <div className="space-y-6">
            
            {/* Top 10 Contributors */}
            <div className="bg-white rounded-2xl p-6 shadow-ios border border-ios-lightGray/30">
              <h2 className="text-lg font-bold tracking-tight text-ios-darkText mb-4 flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-yellow-100 flex items-center justify-center border border-yellow-200">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                </div>
                {t.topContributors}
              </h2>
              
              <button 
                onClick={handleSyncTopDonors} 
                disabled={isSyncingTopDonors}
                className="w-full bg-ios-blue text-white rounded-xl py-3 font-bold text-sm hover:bg-blue-600 transition-colors flex justify-center items-center gap-2 mb-4 shadow-sm disabled:opacity-50"
              >
                {isSyncingTopDonors ? <span className="spinner w-4 h-4 border-2"></span> : t.syncTopDonors}
              </button>
              
              <div className="space-y-3">
                {topDonors.length === 0 ? (
                  <p className="text-xs text-ios-secondaryText text-center py-4">{t.noTopDonors}</p>
                ) : (
                  topDonors.map((donor, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2.5 rounded-xl border border-ios-lightGray/20 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-extrabold text-ios-blue w-5 text-center">#{idx + 1}</span>
                        <span className="text-xs font-semibold text-ios-darkText font-mono">
                          {donor.address === userAddress ? t.you : `${donor.address.substring(0, 6)}...${donor.address.substring(50)}`}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-ios-secondaryText">{donor.amount.toFixed(2)} XLM</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Connection Information */}
            <div className="bg-white rounded-2xl p-6 shadow-ios border border-ios-lightGray/30">
              <h2 className="text-lg font-bold tracking-tight text-ios-darkText mb-4 flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                </div>
                {t.walletNetworkInfo}
              </h2>
              
              <ul className="space-y-3 text-xs">
                <li className="flex justify-between border-b border-ios-lightGray/20 pb-2">
                  <span className="text-ios-darkGray font-medium">{t.network}</span>
                  <span className="badge badge-success font-bold text-ios-green">
                    {networkMode === 'PUBLIC' ? 'Stellar Mainnet' : 'Stellar Testnet'}
                  </span>
                </li>
                
                <li className="flex justify-between border-b border-ios-lightGray/20 pb-2">
                  <span className="text-ios-darkGray font-medium">{t.contractId}</span>
                  <button 
                    onClick={handleContractIdPrompt}
                    className="font-mono text-ios-blue underline truncate max-w-[150px] font-bold text-right"
                    title={contractId}
                  >
                    {contractId ? `${contractId.substring(0, 5)}...${contractId.substring(51)}` : 'Set Contract'}
                  </button>
                </li>

                {userAddress && (
                  <li className="flex justify-between">
                    <span className="text-ios-darkGray font-medium">{t.walletBalance}</span>
                    <span className="font-bold text-ios-darkText">{freighterBalance} XLM</span>
                  </li>
                )}
              </ul>
            </div>

            {/* Contact Provider */}
            <div className="bg-white rounded-2xl p-6 shadow-ios border border-ios-lightGray/30 text-xs text-ios-secondaryText space-y-3">
              <h3 className="font-bold text-sm text-ios-darkText">{t.contactSupport}</h3>
              <p>{t.contactSupportDesc}</p>
              <div className="flex flex-col gap-2 font-semibold">
                <a href="mailto:support@steldot.org" className="text-ios-blue hover:underline flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                  </div>
                  support@steldot.org
                </a>
                <a href="https://github.com/stellar-steldot" target="_blank" rel="noopener noreferrer" className="text-ios-blue hover:underline flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200">
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
                  </div>
                  github.com/stellar-steldot
                </a>
              </div>
            </div>

          </div>
        </section>
      </main>
    </div>
  );
}

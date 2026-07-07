import React, { useState, useEffect, useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import QRCode from 'react-qr-code';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { translations } from './utils/i18n';
import SwalOrig from 'sweetalert2';

const Swal = SwalOrig.mixin({
  customClass: {
    popup: 'overflow-hidden !pb-0',
    actions: 'flex w-full mt-6 !mb-0 !border-none',
    confirmButton: 'flex-1 bg-[#34C759] hover:bg-green-600 text-white py-3.5 font-bold transition-colors !m-0 !rounded-none min-w-0',
    cancelButton: 'flex-1 bg-[#FF3B30] hover:bg-red-600 text-white py-3.5 font-bold transition-colors !m-0 !rounded-none min-w-0',
    denyButton: 'flex-1 bg-gray-500 hover:bg-gray-600 text-white py-3.5 font-bold transition-colors !m-0 !rounded-none min-w-0'
  }
});
import {
  checkWalletInstalled,
  connectWallet,
  getXlmBalance,
  callReadOnly,
  executeTransaction,
  getGlobalTopDonors,
  getGlobalClaims,
  getGlobalTransactions,
  checkFreighterNetwork,
  setAppNetwork,
  getWalletPublicKey,
  executeNativePayment
} from './utils/stellar';
import { Address, nativeToScVal } from '@stellar/stellar-sdk';
import bannerImg from './assets/banner.png';
import frighterIcon from './image/frighter-icon.png';
import walletConnectIcon from './image/walletconnect-icon.jfif';
const DEFAULT_CONTRACT_ID = 'CB6UOV6HL3SU7LKXLCU25ISGHFQ3P3HN2Z5VLP22XPNXUPIAVUYD7KFM';
const NATIVE_XLM_SAC = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

const initialNet = localStorage.getItem('steldot_last_network') || 'TESTNET';
setAppNetwork(initialNet);

// Animated neuron/blockchain lines canvas overlay
function NeuronCanvas() {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  const init = useCallback((canvas) => {
    const ctx = canvas.getContext('2d');
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W;
    canvas.height = H;

    const NODE_COUNT = Math.max(18, Math.floor((W * H) / 22000));
    const MAX_DIST = Math.min(W, H) * 0.38;

    const nodes = Array.from({ length: NODE_COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      r: Math.random() * 2.5 + 1.5,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // Draw edges
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MAX_DIST) {
            const alpha = (1 - dist / MAX_DIST) * 0.22;
            ctx.strokeStyle = `rgba(0, 122, 255, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      nodes.forEach(n => {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 122, 255, 0.35)';
        ctx.fill();

        // Update position
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;
      });

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    init(canvas);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [init]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ mixBlendMode: 'multiply' }}
    />
  );
}

// Custom Transparent iOS Date Picker
const CustomDatePicker = ({ value, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(value ? new Date(value) : new Date());
  const [dropUp, setDropUp] = useState(false);
  const triggerRef = React.useRef(null);

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

  const handleDateClick = (day) => {
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    onChange(d.toISOString().split('T')[0]);
    setIsOpen(false);
  };

  const handleToggle = () => {
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setDropUp(spaceBelow < 320);
    }
    setIsOpen(prev => !prev);
  };

  // Close on outside click
  React.useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (triggerRef.current && !triggerRef.current.closest('.custom-datepicker-root').contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  return (
    <div className="relative w-full custom-datepicker-root" ref={triggerRef}>
      <div
        onClick={handleToggle}
        className="w-full bg-[#F2F2F7] border border-ios-lightGray/40 rounded-xl pl-11 pr-4 py-2.5 text-sm outline-none focus:border-ios-blue transition-all text-ios-darkText cursor-pointer flex items-center min-h-[42px]"
      >
        {value ? new Date(value).toLocaleDateString('en-GB') : <span className="text-gray-400">{placeholder || 'Select date'}</span>}
      </div>

      {isOpen && (
        <div
          className={`absolute ${dropUp ? 'bottom-full mb-2' : 'top-full mt-2'} left-0 z-[999] bg-white border border-gray-200 shadow-[0_8px_30px_rgb(0,0,0,0.15)] rounded-2xl p-4 w-[280px]`}
          onMouseDown={e => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-4">
            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)); }} className="p-1 hover:bg-black/5 rounded-full"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6"/></svg></button>
            <span className="font-bold text-sm text-ios-darkText">{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)); }} className="p-1 hover:bg-black/5 rounded-full"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6"/></svg></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-gray-400 mb-2 uppercase">
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-sm">
            {Array(firstDay).fill(null).map((_, i) => <div key={`empty-${i}`}></div>)}
            {Array(daysInMonth).fill(null).map((_, i) => {
              const day = i + 1;
              const dateStr = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toISOString().split('T')[0];
              const isSelected = value === dateStr;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDateClick(day); }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors text-[13px] ${isSelected ? 'bg-ios-blue text-white font-bold shadow-md' : 'hover:bg-black/5 text-gray-700 font-medium'}`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const QRScannerComponent = ({ onScan, onClose }) => {
  useEffect(() => {
    const html5QrcodeScanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: {width: 250, height: 250}, aspectRatio: 1.0 },
      /* verbose= */ false
    );
    html5QrcodeScanner.render(
      (decodedText) => {
        html5QrcodeScanner.clear();
        onScan(decodedText);
      },
      (error) => {
        // Handle scan error if needed quietly
      }
    );

    return () => {
      html5QrcodeScanner.clear().catch(error => {
        console.error("Failed to clear html5QrcodeScanner. ", error);
      });
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      <div className="flex justify-between items-center p-4 bg-slate-900 text-white">
        <h3 className="font-bold">Scan QR Code</h3>
        <button onClick={onClose} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center bg-black relative">
        <div id="qr-reader" className="w-full max-w-sm bg-white"></div>
        <p className="text-white mt-4 text-xs opacity-70">Arahkan kamera ke QR Code dompet target</p>
      </div>
    </div>
  );
};

export default function App() {
  // Wallet & Network State
  const [freighterInstalled, setFreighterInstalled] = useState(false);
  const [userAddress, setUserAddress] = useState('');
  const [freighterBalance, setFreighterBalance] = useState('0.00');
  const [contractId, setContractId] = useState(DEFAULT_CONTRACT_ID);
  const [isMockMode, setIsMockMode] = useState(true);
  const [networkMode, setNetworkMode] = useState(initialNet);

  // Platform & Contract State
  const [myClaims, setMyClaims] = useState([]);
  
  // Referral State
  const [referralBalance, setReferralBalance] = useState(0);
  const [referralHistory, setReferralHistory] = useState([]);
  const [referralPage, setReferralPage] = useState(1);
  const [referralSearch, setReferralSearch] = useState('');
  const REFERRALS_PER_PAGE = 5;
  const filteredReferrals = referralHistory.filter(r => r.donorAddress.toLowerCase().includes(referralSearch.toLowerCase()));
  const totalReferralPages = Math.max(1, Math.ceil(filteredReferrals.length / REFERRALS_PER_PAGE));
  const currentReferrals = filteredReferrals.slice((referralPage - 1) * REFERRALS_PER_PAGE, referralPage * REFERRALS_PER_PAGE);
  
  // Ambassador & VIP State

  
  const [ambassadorHistory, setAmbassadorHistory] = useState(() => {
    try {
      const stored = localStorage.getItem('steldot_ambassador_history');
      return stored ? JSON.parse(stored) : [];
    } catch (e) { return []; }
  });
  
  const [vipHistory, setVipHistory] = useState(() => {
    try {
      const stored = localStorage.getItem('steldot_vip_history');
      return stored ? JSON.parse(stored) : [];
    } catch (e) { return []; }
  });
  
  const [ambassadorPage, setAmbassadorPage] = useState(1);
  const [ambassadorSearch, setAmbassadorSearch] = useState('');
  
  const [isScanning, setIsScanning] = useState(false);
  const [scannerActiveTab, setScannerActiveTab] = useState('voucher'); // 'voucher' or 'event'
  const [vipEventName, setVipEventName] = useState('');
  const [vipPage, setVipPage] = useState(1);
  const [vipSearch, setVipSearch] = useState('');
  const [targetVipTotalDonated, setTargetVipTotalDonated] = useState(0);
  const [isCheckingVip, setIsCheckingVip] = useState(false);
  
  const [ambassadorTarget, setAmbassadorTarget] = useState('');
  const [ambassadorAmount, setAmbassadorAmount] = useState('');
  const [simulateVoucherCode, setSimulateVoucherCode] = useState('');
  const [ambassadorVoucherCode, setAmbassadorVoucherCode] = useState(() => {
    const saved = localStorage.getItem('steldot_ambassador_code');
    if (saved && /^[A-Z0-9]{5}$/.test(saved)) return saved;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  });
  const [showSimulateForm, setShowSimulateForm] = useState(false);
  
  const AMBASSADOR_PER_PAGE = 5;
  const isMasterWallet = userAddress === 'GCANOQWHT5YRXX2EBQXZJLFPZ5VHZWZA5ZB3FQEUU6CHDCSHXGS3QJ2O';
  const ambassadorUserHistory = isMasterWallet ? ambassadorHistory : ambassadorHistory.filter(r => r.address.toLowerCase() === (userAddress || '').toLowerCase());
  const filteredAmbassadors = ambassadorUserHistory.filter(r => (!ambassadorSearch || r.address.toLowerCase().includes(ambassadorSearch.toLowerCase()) || (r.code && r.code.toLowerCase().includes(ambassadorSearch.toLowerCase()))));
  const totalAmbassadorPages = Math.max(1, Math.ceil(filteredAmbassadors.length / AMBASSADOR_PER_PAGE));
  const currentAmbassadors = filteredAmbassadors.slice((ambassadorPage - 1) * AMBASSADOR_PER_PAGE, ambassadorPage * AMBASSADOR_PER_PAGE);
  const currentAmbassadorUses = ambassadorHistory.filter(r => r.type !== 'REGISTER' && r.address.toLowerCase() === (userAddress || '').toLowerCase()).length;

  const searchParams = new URLSearchParams(window.location.search);
  const refParam = searchParams.get('ref');
  const initialPartner = (refParam && refParam.startsWith('G') && refParam.length === 56) ? refParam : null;
  const [partnerAddress, setPartnerAddress] = useState(initialPartner);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [totalDonated, setTotalDonated] = useState(0);
  const [successfulClaims, setSuccessfulClaims] = useState(0);
  const [totalRaised, setTotalRaised] = useState(0);
  const [totalClaimsApproved, setTotalClaimsApproved] = useState(0);
  const [campaigns, setCampaigns] = useState([]);
  const [contractBalance, setContractBalance] = useState(0);
  const [topDonors, setTopDonors] = useState([]);
  const [ownerAddress, setOwnerAddress] = useState('');
  const isOwner = ownerAddress ? userAddress === ownerAddress : userAddress === 'GCANOQWHT5YRXX2EBQXZJLFPZ5VHZWZA5ZB3FQEUU6CHDCSHXGS3QJ2O';
  const [lang, setLang] = useState('en');
  const t = translations[lang];

  // UI state
  const [donateAmounts, setDonateAmounts] = useState({});
  const [newCampaign, setNewCampaign] = useState({ id: '', title: '', description: '', target: '', youtube_link: '', client_wallet: '', expiration: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const [isSyncingTopDonors, setIsSyncingTopDonors] = useState(false);
  const [expandedCampaigns, setExpandedCampaigns] = useState({});
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [transferAmount, setTransferAmount] = useState('');
  const [adminTab, setAdminTab] = useState('campaign'); // 'campaign' or 'claims'
  const [translatedCampaigns, setTranslatedCampaigns] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('active'); // active, completed, inactive
  const [currentPage, setCurrentPage] = useState(1);
  const [showCertificate, setShowCertificate] = useState(false);
  const [showVIPBarcode, setShowVIPBarcode] = useState(false);
  const [showAmbassadorBarcode, setShowAmbassadorBarcode] = useState(false);
  const [showAngelReferral, setShowAngelReferral] = useState(false);
  const [isDownloadingCert, setIsDownloadingCert] = useState(false);
  const CAMPAIGNS_PER_PAGE = 3;

  const CLAIMS_PER_PAGE = 5;
  const [claimHistoryPage, setClaimHistoryPage] = useState(1);
  const [claimHistorySearch, setClaimHistorySearch] = useState('');
  const [claimHistoryData, setClaimHistoryData] = useState([]);
  const filteredClaims = claimHistoryData.filter(c => c.address.toLowerCase().includes(claimHistorySearch.toLowerCase()));
  const totalClaimPages = Math.max(1, Math.ceil(filteredClaims.length / CLAIMS_PER_PAGE));
  const currentClaims = filteredClaims.slice((claimHistoryPage - 1) * CLAIMS_PER_PAGE, claimHistoryPage * CLAIMS_PER_PAGE);

  const [userTxPage, setUserTxPage] = useState(1);
  const [userTxSearch, setUserTxSearch] = useState('');
  const USER_TX_PER_PAGE = 5;
  const [userTxData, setUserTxData] = useState([]);
  
  // My Transactions
  const filteredUserTxs = userTxData
    .filter(tx => tx.wallet === userAddress && tx.to === contractId)
    .filter(tx => tx.hash.toLowerCase().includes(userTxSearch.toLowerCase()));
  const totalUserTxPages = Math.max(1, Math.ceil(filteredUserTxs.length / USER_TX_PER_PAGE));
  const currentUserTxs = filteredUserTxs.slice((userTxPage - 1) * USER_TX_PER_PAGE, userTxPage * USER_TX_PER_PAGE);

  // All Transactions
  const [allTxPage, setAllTxPage] = useState(1);
  const [allTxSearch, setAllTxSearch] = useState('');
  const filteredAllTxs = userTxData
    .filter(tx => tx.to === contractId)
    .filter(tx => tx.hash.toLowerCase().includes(allTxSearch.toLowerCase()));
  const totalAllTxPages = Math.max(1, Math.ceil(filteredAllTxs.length / USER_TX_PER_PAGE));
  const currentAllTxs = filteredAllTxs.slice((allTxPage - 1) * USER_TX_PER_PAGE, allTxPage * USER_TX_PER_PAGE);

  const [userClaimPage, setUserClaimPage] = useState(1);
  const [userClaimSearch, setUserClaimSearch] = useState('');
  const USER_CLAIMS_PER_PAGE = 5;
  const [userClaimData, setUserClaimData] = useState([]);
  const filteredUserClaims = userClaimData
    .filter(c => c.address === userAddress)
    .filter(c => c.address.toLowerCase().includes(userClaimSearch.toLowerCase()));
  const totalUserClaimPages = Math.max(1, Math.ceil(filteredUserClaims.length / USER_CLAIMS_PER_PAGE));
  const currentUserClaims = filteredUserClaims.slice((userClaimPage - 1) * USER_CLAIMS_PER_PAGE, userClaimPage * USER_CLAIMS_PER_PAGE);

  // Fetch Realtime Data
  useEffect(() => {
    const fetchTxs = async () => {
      if (!contractId) {
        setUserTxData([]);
        setUserClaimData([]);
        return;
      }
      try {
        const txs = await getGlobalTransactions(contractId);
        setUserTxData(txs);
        
        // My Claim Rewards: Transactions received from the Smart Contract
        const claims = txs.filter(tx => tx.to === userAddress && tx.wallet === contractId).map(tx => ({
          id: tx.id,
          address: tx.to,
          from: tx.wallet,
          amount: tx.amount,
          date: tx.date,
          status: 'approved'
        }));
        setUserClaimData(claims);
        
      } catch (err) {
        console.error("Failed to fetch user txs", err);
      }
    };
    fetchTxs();
  }, [userAddress, contractId]);

  // Admin Claim History Fetch
  useEffect(() => {
    const fetchClaims = async () => {
      if (!contractId) return;
      try {
        const claims = await getGlobalClaims(contractId);
        setClaimHistoryData(claims);
      } catch (err) {
        console.error("Failed to fetch claims", err);
      }
    };
    fetchClaims();
  }, [contractId]);

  const getExplorerLink = (address) => {
    if (!address) return '#';
    const type = address.startsWith('C') ? 'contract' : 'account';
    return `https://stellar.expert/explorer/${networkMode.toLowerCase()}/${type}/${address}`;
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeTab]);

  useEffect(() => {
    setClaimHistoryPage(1);
  }, [claimHistorySearch]);

  useEffect(() => {
    setUserTxPage(1);
  }, [userTxSearch]);

  useEffect(() => {
    setUserClaimPage(1);
  }, [userClaimSearch]);

  // Initialize Freighter Check and first run check
  useEffect(() => {
    async function initCheck() {
      const installed = await checkWalletInstalled();
      setFreighterInstalled(installed);
      
      const savedAddress = sessionStorage.getItem('steldot_wallet_address');
      if (savedAddress) setUserAddress(savedAddress);

      if (installed) {
        const net = await checkFreighterNetwork();
        setNetworkMode(net);
        setAppNetwork(net);
        const savedContract = localStorage.getItem(`steldot_contract_${net}`);
        const deprecatedContracts = [
          'CBOKKH33TVJCQRMQ7GMHKAVO7BUS7BRXKAZOKZBUK6YOIE5D6EDDL3Q7',
          'CBKZHZ7CFEYLII7O2G7NKTS2RR5SCSQCQI6FA7A4TTPLI25NXSM6BTFB'
        ];
        if (net === 'TESTNET') {
          setContractId(DEFAULT_CONTRACT_ID);
        } else if (savedContract && !deprecatedContracts.includes(savedContract)) {
          setContractId(savedContract);
        } else if (savedContract) {
          localStorage.removeItem(`steldot_contract_${net}`);
          setContractId(DEFAULT_CONTRACT_ID);
        }
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
      setNewCampaign(prev => ({ ...prev, id: unixTime }));
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

  // Check if Freighter status, network, or account changes
  useEffect(() => {
    if (!userAddress) return;
    const walletType = sessionStorage.getItem('steldot_wallet_type');
    
    // Only poll for Freighter to avoid continuous connection popups on mobile wallets
    if (walletType === 'freighter') {
      const interval = setInterval(async () => {
        try {
          const currentAddress = await getWalletPublicKey('freighter');
          if (currentAddress && currentAddress !== userAddress) {
            handleDisconnectWallet();
          }
        } catch (e) {
          handleDisconnectWallet();
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [userAddress]);

  // Realtime VIP Eligibility Check
  useEffect(() => {
    if (scannerActiveTab !== 'event' || !ambassadorTarget || ambassadorTarget.length !== 56) {
      setTargetVipTotalDonated(0);
      setIsCheckingVip(false);
      return;
    }
    let isMounted = true;
    const fetchDonation = async () => {
      setIsCheckingVip(true);
      try {
        const { callReadOnly } = await import('./utils/stellar');
        const donorTotalRes = await callReadOnly(contractId, 'get_donor_total_donated', [
          nativeToScVal(ambassadorTarget, { type: 'address' })
        ]);
        const total = donorTotalRes ? Number(donorTotalRes) / 10000000 : 0;
        if (isMounted) setTargetVipTotalDonated(total);
      } catch (err) {
        if (isMounted) setTargetVipTotalDonated(0);
      } finally {
        if (isMounted) setIsCheckingVip(false);
      }
    };
    
    const timeoutId = setTimeout(fetchDonation, 500); // Debounce 500ms
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [ambassadorTarget, scannerActiveTab, contractId]);

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

      // Get contract active balance (in SAC token)
      const balRes = await callReadOnly(NATIVE_XLM_SAC, 'balance', [
        nativeToScVal(contractId, { type: 'address' })
      ]);
      setContractBalance(balRes ? Number(balRes) / 10000000 : 0);

      // Fetch donor points & donations
      setSyncProgress('Step 2/4: Fetching your wallet data...');
      if (userAddress) {
        const pointsRes = await callReadOnly(contractId, 'get_donor_points', [
          nativeToScVal(userAddress, { type: 'address' })
        ]);
        setLoyaltyPoints(pointsRes ? Number(pointsRes) / 10000000 : 0);

        const donorTotalRes = await callReadOnly(contractId, 'get_donor_total_donated', [
          nativeToScVal(userAddress, { type: 'address' })
        ]);
        const total = donorTotalRes ? Number(donorTotalRes) / 10000000 : 0;
        setTotalDonated(total);

        // Validation for Referral Links: Only for first-time donors
        if (total > 0 && partnerAddress) {
            setPartnerAddress(null);
            const newUrl = window.location.origin + window.location.pathname;
            window.history.pushState({path:newUrl},'',newUrl);
            Swal.fire({
                title: t.invalidReferralTitle || 'Tautan Referral Tidak Berlaku',
                text: t.invalidReferralDesc || 'Tautan referral hanya dapat digunakan oleh pengguna baru yang belum pernah berdonasi. Tautan telah dihapus dari sesi Anda.',
                icon: 'warning',
                });
        }

        const statusRes = await callReadOnly(contractId, 'get_donor_successful_claims', [
          nativeToScVal(userAddress, { type: 'address' })
        ]);
        setSuccessfulClaims(Number(statusRes || 0));

        import('./utils/stellar').then(stellar => {
          stellar.getReferralRewardBalance(contractId, userAddress).then(bal => setReferralBalance(bal));
          stellar.getReferralHistory(contractId, userAddress).then(history => setReferralHistory(history));
        });
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
              active: camp.active,
              youtube_link: camp.youtube_link?.toString() || '',
              client_wallet: camp.client_wallet?.toString() || '',
              expiration: camp.expiration ? Number(camp.expiration) : 0,
              funds_transferred: camp.funds_transferred ? Number(camp.funds_transferred) / 10000000 : 0,
              transfers: camp.transfers ? camp.transfers.map(t => ({ amount: Number(t.amount)/10000000, date: Number(t.date) })) : []
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

      // Global top contributors sync
      getGlobalTopDonors(contractId).then(globalTop => {
        if (globalTop && globalTop.length > 0) {
          setTopDonors(globalTop);
        } else {
          const realTop = [];
          if (userAddress && totalDonated > 0) {
            realTop.push({ address: userAddress, amount: totalDonated });
          }
          setTopDonors(realTop);
        }
      }).catch(err => console.error('Auto sync top donors failed:', err));

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
      Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: t.translateFailed, showConfirmButton: false, timer: 3000 });
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
    setContractBalance(prev => prev || 0);

    const realTop = [];
    if (userAddress && totalDonated > 0) {
      realTop.push({ address: userAddress, amount: totalDonated });
    }
    setTopDonors(realTop);
  };


  const getTranslatedError = (errMessage) => {
    if (!errMessage) return t.connErrorDesc;
    let msg;
    if (typeof errMessage === 'object') {
        msg = errMessage.message ? errMessage.message : JSON.stringify(errMessage);
    } else {
        msg = String(errMessage);
    }
    
    if (msg === 'WALLETCONNECT_SESSION_EXPIRED') return t.wcSessionExpired;
    const msgLow = msg.toLowerCase();
    if (msgLow.includes('no wallet') || msgLow.includes('not connected') || msgLow.includes('not detected')) return t.errNoWallet;
    if (msgLow.includes('decline') || msgLow.includes('reject') || msgLow.includes('not allow')) return t.errUserDeclined;
    if (msgLow.includes('unreachablecodereached') || msgLow.includes('invalidaction') || msgLow.includes('voucher not found')) return t.voucherNotFoundDesc || 'Kode voucher tidak ditemukan atau batas penggunaan telah habis.';
    return errMessage;
  };

  const handleDisconnectWallet = () => {
    sessionStorage.removeItem('steldot_wallet_address');
    setUserAddress('');
    setFreighterBalance('0.00');
    setLoyaltyPoints(0);
    setTotalDonated(0);
    setSuccessfulClaims(0);
  };

  // Connect Wallet Modal
  const handleConnectWallet = async () => {
    Swal.fire({
      title: 'Connect Wallet',
      html: `
        <div class="flex flex-col gap-4 mt-2">
          <button id="btn-freighter" class="w-full bg-[#1e1e1e] hover:bg-[#121212] text-white rounded-xl py-4 font-bold flex items-center justify-center gap-3 transition-colors shadow-md">
            <img src="${frighterIcon}" alt="Freighter" class="w-6 h-6 object-contain rounded-full bg-white p-0.5" /> ${t.freighterWeb || 'Freighter (Web)'}
          </button>
          <button id="btn-walletconnect" class="w-full bg-[#3b99fc] hover:bg-[#2a7bce] text-white rounded-xl py-4 font-bold flex items-center justify-center gap-3 transition-colors shadow-md shadow-blue-500/20">
            <img src="${walletConnectIcon}" alt="WalletConnect" class="w-6 h-6 object-contain rounded-full" /> ${t.walletConnectMobile || 'WalletConnect (Mobile)'}
          </button>
        </div>
      `,
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: t.close || 'Close',
      didOpen: () => {
        document.getElementById('btn-freighter').addEventListener('click', async () => {
          Swal.close();
          try {
            const address = await connectWallet('freighter');
            setUserAddress(address);
            sessionStorage.setItem('steldot_wallet_address', address);
            sessionStorage.setItem('steldot_wallet_type', 'freighter');
            const balance = await getXlmBalance(address);
            setFreighterBalance(balance);
            Swal.fire({ title: t.walletConnected, text: `${t.address}: ${address.substring(0, 6)}...${address.substring(50)}`, icon: 'success', });
          } catch (err) {
            Swal.fire({ title: t.connError, text: getTranslatedError(err.message || err), icon: 'error', });
          }
        });
        
        document.getElementById('btn-walletconnect').addEventListener('click', async () => {
          Swal.close();
          try {
            const address = await connectWallet('wallet_connect');
            setUserAddress(address);
            sessionStorage.setItem('steldot_wallet_address', address);
            sessionStorage.setItem('steldot_wallet_type', 'wallet_connect');
            const balance = await getXlmBalance(address);
            setFreighterBalance(balance);
            Swal.fire({ title: t.walletConnected, text: `${t.address}: ${address.substring(0, 6)}...${address.substring(50)}`, icon: 'success', });
          } catch (err) {
            Swal.fire({ title: t.connError, text: getTranslatedError(err.message || err), icon: 'error', });
          }
        });
      }
    });
  };

  // Handle Donation
  const handleDonate = async (campaignId) => {
    const amount = parseFloat(donateAmounts[campaignId]);
    if (isNaN(amount) || amount <= 0) {
      Swal.fire({
        title: t.invalidAmount,
        text: t.invalidAmountDesc,
        icon: 'warning',
        });
      return;
    }

    const campaign = campaigns.find(c => c.id === campaignId);
    if (campaign) {
      const remaining = Math.max(0, campaign.target - campaign.raised);
      if (amount > remaining) {
        Swal.fire({
          title: t.donationExceedsTarget,
          text: typeof t.donationExceedsTargetDesc === 'function' ? t.donationExceedsTargetDesc(remaining.toFixed(2)) : t.donationExceedsTargetDesc,
          icon: 'warning',
          });
        return;
      }
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
        const donorSc = nativeToScVal(userAddress, { type: 'address' });
        const campaignSc = nativeToScVal(Number(campaignId), { type: 'u32' });
        const amountSc = nativeToScVal(amountStroops, { type: 'i128' });

        let funcName = 'donate';
        let args = [donorSc, campaignSc, amountSc];
        
        const searchParams = new URLSearchParams(window.location.search);
        const refParam = searchParams.get('ref');
        
        if (refParam && refParam.startsWith('G') && refParam.length === 56 && refParam !== userAddress) {
          try {
            args.push(nativeToScVal(refParam, { type: 'address' }));
            funcName = 'donate_with_referral';
          } catch(e) {
            console.error('Invalid ref address', e);
          }
        }

        const txRes = await executeTransaction(contractId, funcName, args, userAddress);
        
        setDonateAmounts(prev => ({ ...prev, [campaignId]: '' }));
        await refreshData();
        
        Swal.fire({
          title: t.donationSuccess,
          html: t.donationProcessed(amount, txRes.hash, networkMode),
          icon: 'success',
          timer: 5000,
          timerProgressBar: true
        }).then(() => {
          window.location.reload();
        });
      } catch (err) {
        Swal.fire({
          title: t.txFailed,
          text: getTranslatedError(err.message || err),
          icon: 'error',
          });
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Simulate Ambassador Discount
  const handleSimulateAmbassadorDiscount = () => {
    setShowSimulateForm(true);
    setAmbassadorAmount('');
    setAmbassadorTarget('');
    setSimulateVoucherCode('');
  };

  const handleProcessVipEntry = async () => {
    if (userAddress !== 'GCANOQWHT5YRXX2EBQXZJLFPZ5VHZWZA5ZB3FQEUU6CHDCSHXGS3QJ2O') {
      Swal.fire({
        icon: 'error',
        title: t.vipAccessDenied || 'Akses Ditolak',
        text: t.vipAccessDeniedDesc || 'Pemindaian tiket VIP Legend hanya dapat dilakukan oleh wallet Pemilik Utama StelDot.',
        customClass: { confirmButton: 'swal-btn-full' }
      });
      return;
    }

    if (!ambassadorTarget || !vipEventName) return;

    // Backend Validation
    setIsCheckingVip(true);
    let totalDonated = 0;
    try {
      const { callReadOnly } = await import('./utils/stellar');
      const donorTotalRes = await callReadOnly(contractId, 'get_donor_total_donated', [
        nativeToScVal(ambassadorTarget, { type: 'address' })
      ]);
      totalDonated = donorTotalRes ? Number(donorTotalRes) / 10000000 : 0;
    } catch (e) {}
    setIsCheckingVip(false);

    if (totalDonated < 500) {
      Swal.fire({
        icon: 'error',
        title: t.validationFailed || 'Validasi Gagal',
        text: t.validationFailedDesc ? t.validationFailedDesc.replace('{amount}', totalDonated.toFixed(2)) : `Total donasi wallet peserta ini hanya ${totalDonated.toFixed(2)} XLM. Akses VIP Legend membutuhkan minimal 500 XLM.`,
        customClass: { confirmButton: 'swal-btn-full' }
      });
      return;
    }

    const newRecord = {
      id: Math.random().toString(36).substring(2, 9).toUpperCase(),
      address: ambassadorTarget.trim(),
      cashier: userAddress,
      eventName: vipEventName.trim(),
      date: new Date().toLocaleDateString('en-GB'),
      time: new Date().toLocaleTimeString('en-GB'),
      status: 'HADIR'
    };

    const updatedHistory = [newRecord, ...vipHistory];
    setVipHistory(updatedHistory);
    try { localStorage.setItem('steldot_vip_history', JSON.stringify(updatedHistory)); } catch (e) {}
    
    setAmbassadorTarget('');
    setVipEventName('');
    setShowSimulateForm(false);

    Swal.fire({
      icon: 'success',
      title: t.vipValidationSuccess || 'Kehadiran Tercatat!',
      text: t.vipValidationSuccessDesc || 'Kehadiran VIP berhasil diverifikasi dan disimpan ke riwayat.',
    }).then(() => {
      window.location.reload();
    });
  };

  const handleProcessDiscount = async () => {
    if (!ambassadorTarget || !ambassadorAmount || !simulateVoucherCode) return;
    const amount = parseFloat(ambassadorAmount);
    if (isNaN(amount) || amount <= 0) return;

    if (!/^[a-zA-Z0-9]{5}$/.test(simulateVoucherCode.trim())) {
      Swal.fire({
        icon: 'warning',
        title: t.invalidVoucherFormat,
        text: t.invalidVoucherFormatDesc,
        });
      return;
    }

    if (!/^G[A-Z0-9]{55}$/.test(ambassadorTarget.trim())) {
      Swal.fire({
        icon: 'warning',
        title: t.invalidTargetAddress || 'Format Alamat Tidak Valid',
        text: t.invalidTargetAddressDesc || 'Alamat dompet target tidak valid. Pastikan alamat dimulai dengan G dan berjumlah 56 karakter.',
        });
      return;
    }

    const usesCount = ambassadorHistory.filter(r => r.type !== 'REGISTER' && r.address.toLowerCase() === ambassadorTarget.toLowerCase()).length;
    
    if (usesCount >= 5) {
      Swal.fire({
        icon: 'error',
        title: t.limitReached || 'Batas Tercapai',
        text: t.usageLimitReached || 'Batas penggunaan 5 kali telah tercapai untuk dompet ini.',
        confirmButtonText: t.close || 'Tutup',
        });
      return;
    }

    const activeCampaigns = campaigns.filter(c => c.active && c.raised < c.target);
    if (activeCampaigns.length === 0) {
      Swal.fire({ icon: 'error', text: 'Tidak ada kampanye aktif untuk diproses ke blockchain.' });
      return;
    }

    const discountedAmount = amount * 0.98;

    try {
      setShowSimulateForm(false);
      let mockHash = '';

      if (!isMockMode) {
        Swal.fire({
          title: t.confirmSignature || 'Konfirmasi Tanda Tangan',
          text: t.confirmDonate || 'Silakan konfirmasi transaksi eksekusi diskon di dompet kasir.',
          icon: 'info',
          allowOutsideClick: false,
          showConfirmButton: false,
          didOpen: () => Swal.showLoading()
        });

        const codeSc = nativeToScVal(simulateVoucherCode.trim().toUpperCase(), { type: 'string' });
        
        try {
          const voucher = await callReadOnly(contractId, 'get_voucher', [codeSc]);
          const ownerStr = voucher?.owner?.toString ? voucher.owner.toString() : voucher?.owner;
          if (ownerStr && ownerStr.toUpperCase() !== ambassadorTarget.trim().toUpperCase()) {
            Swal.close();
            Swal.fire({
              icon: 'error',
              title: t.invalidOwner || 'Akses Ditolak',
              text: t.invalidOwnerDesc || 'Alamat dompet target yang dimasukkan bukan pemilik sah dari kode voucher ini. Pastikan Anda memasukkan dompet pemilik voucher yang benar.',
              confirmButtonText: t.close || 'Tutup',
              });
            return;
          }
        } catch (e) {
          throw new Error('Voucher Tidak Valid');
        }

        const cashierSc = nativeToScVal(userAddress, { type: 'address' });
        
        const txRes = await executeTransaction(
          contractId,
          'verify_and_claim_voucher',
          [codeSc, cashierSc],
          userAddress
        );
        mockHash = txRes.hash;
      } else {
        Swal.fire({
          title: t.blockchainSync || 'Memproses di Blockchain...',
          html: 'Menyimpan transaksi eksekusi voucher ke blockchain...',
          allowOutsideClick: false,
          showConfirmButton: false,
          didOpen: () => Swal.showLoading()
        });
        await new Promise(r => setTimeout(r, 2000));
        mockHash = '0x' + Math.random().toString(16).substring(2, 10).toUpperCase() + '...';
      }

      // Add to local history for UI rendering
      const newTx = {
        hash: mockHash,
        type: 'AMBASSADOR_CLAIM',
        amount: discountedAmount.toFixed(7),
        date: new Date().toLocaleDateString('en-GB')
      };
      setUserTxData([newTx, ...userTxData]);

      const newRecord = {
        id: Math.random().toString(36).substring(2, 7).toUpperCase(),
        address: ambassadorTarget,
        code: simulateVoucherCode.trim().toUpperCase(),
        type: 'CLAIM',
        originalAmount: amount,
        discountedAmount: discountedAmount,
        date: new Date().toLocaleDateString('en-GB'),
        time: new Date().toLocaleTimeString('en-GB'),
        hash: mockHash,
        cashier: userAddress
      };
  
      const updatedHistory = [newRecord, ...ambassadorHistory];
      setAmbassadorHistory(updatedHistory);
      try { localStorage.setItem('steldot_ambassador_history', JSON.stringify(updatedHistory)); } catch (e) {}
        setSimulateVoucherCode('');
      
      Swal.fire({
        icon: 'success',
        title: t.success || 'Berhasil',
        text: t.discountApplied || `Diskon berhasil dieksekusi secara on-chain! Total potongan: ${discountedAmount.toFixed(2)} XLM.`,
        }).then(() => {
          window.location.reload();
        });
    } catch (err) {
      console.error(err);
      Swal.close();
      Swal.fire({
        title: t.txFailed || 'Transaksi Gagal',
        text: getTranslatedError(err.message || err),
        icon: 'error',
        confirmButtonText: t.close || 'Tutup',
        });
    }
  };

  const handleRegisterVoucher = async () => {
    if (!ambassadorVoucherCode) return;
    try {
      Swal.fire({
        title: t.registeringVoucher || 'Mendaftarkan Voucher',
        text: t.registeringVoucherDesc || 'Mohon konfirmasi transaksi di wallet untuk mendaftarkan kode voucher Anda ke Blockchain...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      const ownerSc = nativeToScVal(userAddress, { type: 'address' });
      const codeSc = nativeToScVal(ambassadorVoucherCode, { type: 'string' });
      const maxUsesSc = nativeToScVal(5, { type: 'u32' });

      const txRes = await executeTransaction(
        contractId,
        'register_voucher',
        [ownerSc, codeSc, maxUsesSc],
        userAddress
      );

      const newRecord = {
        id: Math.random().toString(36).substring(2, 7).toUpperCase(),
        address: userAddress,
        type: 'REGISTER',
        code: ambassadorVoucherCode,
        date: new Date().toLocaleDateString('en-GB'),
        time: new Date().toLocaleTimeString('en-GB'),
        hash: txRes?.hash || ''
      };
      
      const updatedHistory = [newRecord, ...ambassadorHistory];
      setAmbassadorHistory(updatedHistory);
      setAmbassadorPage(1);
      try { localStorage.setItem('steldot_ambassador_history', JSON.stringify(updatedHistory)); } catch (e) {}

      Swal.fire(t.success || 'Berhasil!', t.registerVoucherSuccess || 'Kode voucher berhasil terdaftar di Blockchain! Sekarang kasir bisa melakukan verifikasi.', 'success');
    } catch (err) {
      Swal.fire(t.errorTitle || 'Gagal', getTranslatedError(err.message || err), 'error');
    }
  };

  // Claim Referral Rewards
  const handleClaimReferral = async () => {
    if (referralBalance <= 0) {
      Swal.fire({
        title: t.pointsInsufficient,
        text: 'No referral balance to claim',
        icon: 'warning',
        });
      return;
    }

    if (contractBalance < referralBalance) {
      Swal.fire({
        title: t.treasuryDeficit,
        text: typeof t.treasuryDeficitDesc === 'function' ? t.treasuryDeficitDesc(contractBalance.toFixed(2)) : t.treasuryDeficitDesc,
        icon: 'error',
        });
      return;
    }

    if (isMockMode) {
      setIsLoading(true);
      setTimeout(() => {
        setFreighterBalance(prev => (parseFloat(prev) + parseFloat(referralBalance)).toFixed(2));
        setReferralBalance(0);
        setIsLoading(false);
        Swal.fire({
          title: 'Claim Successful',
          text: `You have successfully claimed your referral reward.`,
          icon: 'success',
          });
      }, 1500);
    } else {
      try {
        setIsLoading(true);
        Swal.fire({
          title: t.confirmSignature,
          text: 'Please confirm the claim transaction in your wallet.',
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading()
        });

        const txRes = await executeTransaction(contractId, 'claim_referral_reward', [nativeToScVal(userAddress, { type: 'address' })], userAddress);
        
        await refreshData();
        Swal.fire({
          title: 'Claim Successful',
          html: `<a href="https://stellar.expert/explorer/${networkMode.toLowerCase()}/tx/${txRes.hash}" target="_blank" class="text-ios-blue underline">View on Explorer</a>`,
          icon: 'success',
          });
      } catch (err) {
        console.error('Failed to claim referral reward', err);
        Swal.fire({
          title: t.txFailed,
          text: getTranslatedError(err.message || err),
          icon: 'error',
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

  // Request Reward Payout (Instant Claim)
  const handleRequestClaim = async () => {
    if (loyaltyPoints < 10) {
      Swal.fire({
        title: t.pointsInsufficient,
        text: t.pointsInsufficientDesc,
        icon: 'warning',
        });
      return;
    }

    let rewardXlm = (loyaltyPoints * 0.015).toFixed(2);

    if (contractBalance < parseFloat(rewardXlm)) {
      Swal.fire({
        title: t.treasuryDeficit,
        text: typeof t.treasuryDeficitDesc === 'function' ? t.treasuryDeficitDesc(contractBalance.toFixed(2)) : t.treasuryDeficitDesc,
        icon: 'error',
        });
      return;
    }

    if (isMockMode) {
      setIsLoading(true);
      setTimeout(() => {
        setLoyaltyPoints(0);
        setSuccessfulClaims(prev => prev + 1);
        setTotalClaimsApproved(prev => prev + 1);
        setFreighterBalance(prev => (parseFloat(prev) + parseFloat(rewardXlm)).toFixed(2));
        
        setIsLoading(false);
        Swal.fire({
          title: t.rewardRequested || 'Claim Successful',
          text: `You have successfully claimed ${rewardXlm} XLM.`,
          icon: 'success',
          }).then(() => window.location.reload());
      }, 1500);
    } else {
      try {
        setIsLoading(true);
        Swal.fire({
          title: t.confirmSignature,
          text: `You are about to claim ${rewardXlm} XLM (1.5% of ${loyaltyPoints.toFixed(2)} XLM unclaimed volume).`,
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading()
        });

        const donorSc = nativeToScVal(userAddress, { type: 'address' });
        await executeTransaction(contractId, 'claim_reward', [donorSc], userAddress);
        
        Swal.fire({
          title: t.claimSubmitted || 'Claim Successful',
          text: `You have successfully received ${rewardXlm} XLM in your wallet.`,
          icon: 'success',
          }).then(() => window.location.reload());
        await refreshData();
      } catch (err) {
        Swal.fire({
          title: t.requestFailed,
          text: getTranslatedError(err.message || err),
          icon: 'error',
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
        <div class="text-left mt-2 mb-4">
          <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">${t.amountLabel}</label>
          <input type="number" id="swal-withdraw" class="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" min="0.1" step="0.1" placeholder="${t.placeholderTarget}">
        </div>
      `,
      preConfirm: () => {
        return parseFloat(document.getElementById('swal-withdraw').value);
      }
    });

    if (!formValues || isNaN(formValues) || formValues <= 0) return;

    if (formValues > contractBalance) {
      Swal.fire({ 
        title: t.withdrawFailed, 
        text: typeof t.treasuryDeficitDesc === 'function' ? t.treasuryDeficitDesc(contractBalance.toFixed(2)) : 'Insufficient treasury balance.', 
        icon: 'error' 
      });
      return;
    }

    if (isMockMode) {
      setContractBalance(prev => prev - formValues);
      Swal.fire({ title: t.withdrawSuccessAlert, text: t.withdrawMockAlert, icon: 'success' }).then(() => window.location.reload());
    } else {
      setIsLoading(true);
      try {
        const amountSc = nativeToScVal(formValues * 10000000, { type: 'i128' });
        const ownerSc = nativeToScVal(userAddress, { type: 'address' });
        
        const txRes = await executeTransaction(contractId, 'withdraw', [ownerSc, amountSc], userAddress);
        Swal.fire({
          title: t.withdrawSuccess,
          html: t.withdrawSuccessDesc(formValues, txRes.hash, networkMode),
          icon: 'success',
          }).then(() => window.location.reload());
        await refreshData();
      } catch (err) {
        Swal.fire({
          title: t.withdrawFailed,
          text: getTranslatedError(err.message || err),
          icon: 'error',
          });
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Owner transfers to client
  const handleTransferToClient = async (camp) => {
    const amountVal = parseFloat(transferAmount);
    if (!amountVal || isNaN(amountVal) || amountVal <= 0) {
      Swal.fire({ title: 'Invalid Amount', text: t.invalidAmountDesc || 'Silakan masukkan jumlah transfer yang valid.', icon: 'warning' });
      return;
    }

    const availableFunds = camp.raised - (camp.funds_transferred || 0);
    if (amountVal > availableFunds) {
      Swal.fire({ 
        title: 'Transfer Failed', 
        text: (t.insufficientFundsDesc || 'Anda tidak dapat mentransfer dana lebih dari yang terkumpul. Dana maksimal yang bisa ditarik saat ini adalah {amount} XLM.').replace('{amount}', availableFunds.toFixed(2)), 
        icon: 'error' 
      });
      return;
    }
    
    try {
      setIsLoading(true);
      Swal.fire({
        title: t.transferToClient || 'Transferring Funds',
        text: 'Please sign the transaction in Freighter...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      const ownerSc = nativeToScVal(userAddress, { type: 'address' });
      const idSc = nativeToScVal(camp.id, { type: 'u32' });
      const amountStroops = BigInt(Math.round(transferAmount * 10000000));
      const amountSc = nativeToScVal(amountStroops, { type: 'i128' });

      await executeTransaction(
        contractId,
        'transfer_to_client',
        [ownerSc, idSc, amountSc],
        userAddress
      );

      Swal.fire('Success', 'Funds transferred successfully!', 'success').then(() => {
        setSelectedCampaign(null);
        setTransferAmount('');
        window.location.reload();
      });
      await refreshData();
    } catch (err) {
      Swal.fire('Failed', getTranslatedError(err.message || err), 'error');
    } finally {
      setIsLoading(false);
    }
  };


  // Owner updates a campaign
  const handleUpdateCampaign = (camp) => {
    setEditingCampaign({
      ...camp,
      expirationDateStr: camp.expiration ? new Date(camp.expiration * 1000).toISOString().split('T')[0] : ''
    });
  };

  const submitUpdateCampaign = async (e) => {
    if (e) e.preventDefault();
    if (!editingCampaign) return;

    const id = editingCampaign.id;
    const target = parseFloat(editingCampaign.target);
    const title = editingCampaign.title.trim();
    const description = editingCampaign.description.trim();
    const youtubeLink = (editingCampaign.youtube_link || '').trim();
    const clientWallet = (editingCampaign.client_wallet || '').trim();
    const expirationStr = editingCampaign.expirationDateStr;
    const active = editingCampaign.active;

    if (isNaN(id) || isNaN(target) || target <= 0 || !title || !description || !clientWallet || !expirationStr) {
      Swal.fire({ title: t.invalidInputs, text: 'Harap isi semua kolom wajib.', icon: 'warning', });
      return;
    }

    if (description.split(/\s+/).length <= 2) {
      Swal.fire({ title: t.shortDescription, text: t.shortDescriptionDesc, icon: 'warning', });
      return;
    }

    if (clientWallet.includes(' ') || !clientWallet.startsWith('G') || clientWallet.length !== 56) {
      Swal.fire({ title: t.invalidWalletFormat, text: t.invalidWalletFormatDesc || 'Alamat dompet Stellar tidak valid. Pastikan dimulai dengan G dan berisi 56 karakter.', icon: 'warning', });
      return;
    }

    if (youtubeLink && !/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/.test(youtubeLink)) {
      Swal.fire({ title: t.invalidYoutube, text: t.invalidYoutubeDesc, icon: 'warning', });
      return;
    }

    const expirationTime = new Date(expirationStr).getTime();
    const oneWeekFromNow = Date.now() + (7 * 24 * 60 * 60 * 1000);
    if (expirationTime < new Date(new Date(oneWeekFromNow).setHours(0,0,0,0)).getTime()) {
      Swal.fire({ title: t.invalidDate, text: t.invalidDateDesc, icon: 'warning', });
      return;
    }
    
    const expirationUnix = Math.floor(expirationTime / 1000);

    if (isMockMode) {
      setCampaigns(prev => prev.map(c => 
        c.id === id ? { ...c, title, description, target, active, youtube_link: youtubeLink, client_wallet: clientWallet, expiration: expirationUnix } : c
      ));
      setEditingCampaign(null);
      Swal.fire(t.updateCampaign, t.updateCampaignMock, 'success').then(() => window.location.reload());
    } else {
      try {
        setIsLoading(true);
        Swal.fire({
          title: t.updatingCampaign,
          text: t.updatingCampaignDesc,
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading()
        });

        const ownerSc = nativeToScVal(userAddress, { type: 'address' });
        const idSc = nativeToScVal(id, { type: 'u32' });
        const titleSc = nativeToScVal(title);
        const descSc = nativeToScVal(description);
        const targetStroops = BigInt(Math.round(target * 10000000));
        const targetSc = nativeToScVal(targetStroops, { type: 'i128' });
        const activeSc = nativeToScVal(active);
        const youtubeSc = nativeToScVal(youtubeLink || '', { type: 'string' });
        if (!clientWallet || !clientWallet.startsWith('G') || clientWallet.length !== 56) {
          Swal.fire({ title: t.invalidWalletFormat, text: t.invalidWalletFormatDesc, icon: 'warning', });
          setIsLoading(false);
          return;
        }
        const clientWalletSc = nativeToScVal(clientWallet, { type: 'address' });
        const expirationSc = nativeToScVal(expirationUnix, { type: 'u64' });

        await executeTransaction(
          contractId,
          'update_campaign',
          [ownerSc, idSc, titleSc, descSc, targetSc, activeSc, youtubeSc, clientWalletSc, expirationSc],
          userAddress
        );

        setEditingCampaign(null);
        Swal.fire(t.updateCampaign, t.updateCampaignSuccess, 'success').then(() => window.location.reload());
        await refreshData();
      } catch (err) {
        Swal.fire(t.updateFailed, getTranslatedError(err.message || err), 'error');
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
    const youtubeLink = newCampaign.youtube_link.trim();
    const clientWallet = newCampaign.client_wallet.trim();
    const expirationStr = newCampaign.expiration;

    if (isNaN(id) || isNaN(target) || target <= 0 || !title || !description || !clientWallet || !expirationStr) {
      Swal.fire({ title: t.invalidInputs, text: t.invalidInputsDesc || 'Harap isi semua kolom wajib.', icon: 'warning', });
      return;
    }

    if (description.split(/\s+/).length <= 2) {
      Swal.fire({ title: t.shortDescription, text: t.shortDescriptionDesc, icon: 'warning', });
      return;
    }

    if (clientWallet.includes(' ') || !clientWallet.startsWith('G') || clientWallet.length !== 56) {
      Swal.fire({ title: t.invalidWalletFormat, text: t.invalidWalletFormatDesc || 'Alamat dompet Stellar tidak valid. Pastikan dimulai dengan G dan berisi 56 karakter.', icon: 'warning', });
      return;
    }

    if (youtubeLink && !/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/.test(youtubeLink)) {
      Swal.fire({ title: t.invalidYoutube, text: t.invalidYoutubeDesc, icon: 'warning', });
      return;
    }

    const expirationTime = new Date(expirationStr).getTime();
    const oneWeekFromNow = Date.now() + (7 * 24 * 60 * 60 * 1000);
    if (expirationTime < new Date(new Date(oneWeekFromNow).setHours(0,0,0,0)).getTime()) {
      Swal.fire({ title: t.invalidDate, text: t.invalidDateDesc, icon: 'warning', });
      return;
    }
    
    const expirationUnix = Math.floor(new Date(expirationStr).getTime() / 1000);

    if (isMockMode) {
      setCampaigns(prev => [...prev, { id, title, description, target, raised: 0, active: true, youtube_link: youtubeLink, client_wallet: clientWallet, expiration: expirationUnix, funds_transferred: 0, transfers: [] }]);
      const unixTime = Math.floor(Date.now() / 1000);
      setNewCampaign({ id: unixTime, title: '', description: '', target: '', youtube_link: '', client_wallet: '', expiration: '' });
      Swal.fire({
        title: t.campaignCreated,
        text: t.campaignCreatedMock,
        icon: 'success',
        }).then(() => window.location.reload());
    } else {
      try {
        setIsLoading(true);
        Swal.fire({
          title: t.creatingCampaign,
          text: t.creatingCampaignDesc,
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading()
        });

        const ownerSc = nativeToScVal(userAddress, { type: 'address' });
        const idSc = nativeToScVal(Number(id), { type: 'u32' });
        const titleSc = nativeToScVal(title);
        const descSc = nativeToScVal(description);
        const targetStroops = BigInt(Math.round(target * 10000000));
        const targetSc = nativeToScVal(targetStroops, { type: 'i128' });
        const youtubeSc = nativeToScVal(youtubeLink || '', { type: 'string' });
        if (!clientWallet || !clientWallet.startsWith('G') || clientWallet.length !== 56) {
          Swal.fire({ title: t.invalidWalletFormat, text: t.invalidWalletFormatDesc, icon: 'warning', });
          setIsLoading(false);
          return;
        }
        const clientWalletSc = nativeToScVal(clientWallet, { type: 'address' });
        const expirationSc = nativeToScVal(expirationUnix, { type: 'u64' });

        await executeTransaction(
          contractId,
          'create_campaign',
          [ownerSc, idSc, titleSc, descSc, targetSc, youtubeSc, clientWalletSc, expirationSc],
          userAddress
        );

        Swal.fire({
          title: t.campaignAdded,
          text: typeof t.campaignAddedDesc === 'function' ? t.campaignAddedDesc(networkMode) : t.campaignAddedDesc,
          icon: 'success',
          }).then(() => window.location.reload());
        const unixTime = Math.floor(Date.now() / 1000);
        setNewCampaign({ id: unixTime, title: '', description: '', target: '', youtube_link: '', client_wallet: '', expiration: '' });
        await refreshData();
      } catch (err) {
        const unixTime = Math.floor(Date.now() / 1000);
        setNewCampaign(prev => ({ ...prev, id: unixTime }));
        
        let errorText = getTranslatedError(err.message || err);
        if (errorText.includes('UnreachableCodeReached')) {
          errorText = "Kontrak menolak transaksi ini (kemungkinan ID Kampanye sudah terpakai karena transaksi sebelumnya sebenarnya berhasil, atau ada input yang tidak valid). ID telah direset otomatis, silakan periksa daftar kampanye Anda atau coba lagi.";
        }

        Swal.fire({
          title: t.deploymentFailed,
          text: errorText,
          icon: 'error',
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
    const savedTestnet = DEFAULT_CONTRACT_ID;
    const savedMainnet = localStorage.getItem('steldot_contract_PUBLIC') || '';

    Swal.fire({
      title: t.configContract,
      html: `
        <div class="text-left mb-2">
          <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">${t.mainnetContractId || 'MAINNET CONTRACT ID'}</label>
          <input id="swal-input-mainnet" class="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all" value="${savedMainnet}" placeholder="${t.egHash}">
        </div>
        <div class="text-left mt-4">
          <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">${t.testnetContractId || 'TESTNET CONTRACT ID'}</label>
          <input id="swal-input-testnet" class="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all" value="${savedTestnet}" placeholder="${t.egHash}">
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      preConfirm: () => {
        const mainnetVal = document.getElementById('swal-input-mainnet').value.trim();
        const testnetVal = document.getElementById('swal-input-testnet').value.trim();
        
        if (mainnetVal && (!mainnetVal.startsWith('C') || mainnetVal.length !== 56)) {
          Swal.showValidationMessage(`Mainnet Contract ID is invalid (Length: ${mainnetVal.length}, Must be 56)`);
          return false;
        }
        if (testnetVal && (!testnetVal.startsWith('C') || testnetVal.length !== 56)) {
          Swal.showValidationMessage(`Testnet Contract ID is invalid (Length: ${testnetVal.length}, Must be 56)`);
          return false;
        }
        return { mainnet: mainnetVal, testnet: testnetVal };
      }
    }).then((result) => {
      if (result.isConfirmed) {
        if (result.value.mainnet) {
          localStorage.setItem('steldot_contract_PUBLIC', result.value.mainnet);
        }
        if (result.value.testnet) {
          localStorage.setItem('steldot_contract_TESTNET', result.value.testnet);
        }
        
        const newId = networkMode === 'PUBLIC' ? result.value.mainnet : result.value.testnet;
        if (newId) setContractId(newId);
        Swal.fire({
          title: t.updated,
          text: t.updatedDesc,
          icon: 'success',
          });
      }
    });
  };
  const handleDownloadCertificate = async () => {
    const certNode = document.getElementById('certificate-node');
    if (!certNode) return;
    setIsDownloadingCert(true);
    try {
      const canvas = await html2canvas(certNode, {
        scale: 2, // High resolution
        backgroundColor: '#ffffff'
      });
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `steldot_certificate_${userAddress.substring(0,6)}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to generate certificate:', err);
      Swal.fire(t.errorTitle, t.certError, 'error');
    } finally {
      setIsDownloadingCert(false);
    }
  };
  const handleViewClaimStats = () => {
    if (claimHistoryData.length === 0) {
      Swal.fire({
        title: t.monthlyStatsTitle,
        text: t.noStatsAvailable,
        icon: 'info',
        });
      return;
    }

    const stats = {};
    claimHistoryData.forEach(claim => {
      const dateParts = claim.date.split(' ');
      if (dateParts.length >= 3) {
        const month = dateParts[1];
        const year = dateParts[2].replace(',', '');
        const key = `${month} ${year}`;
        if (!stats[key]) stats[key] = 0;
        stats[key] += claim.amount;
      }
    });

    const statsArray = Object.entries(stats).map(([period, total]) => ({ period, total }));

    Swal.fire({
      title: t.monthlyStatsTitle,
      html: `
        <div id="claim-stats-container" style="background: white; padding: 24px; border-radius: 20px; width: 100%; box-sizing: border-box; text-align: left;">
          <h3 style="text-align: center; font-size: 18px; font-weight: 800; color: #111827; margin-bottom: 24px; font-family: sans-serif; letter-spacing: -0.5px;">${t.monthlyStatsTitle}</h3>
          <table style="width: 100%; border-collapse: collapse; font-family: sans-serif; font-size: 14px;">
            <thead>
              <tr style="border-bottom: 2px solid #f3f4f6;">
                <th style="text-align: left; padding: 12px 8px; color: #6b7280; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">${t.monthYearLabel}</th>
                <th style="text-align: right; padding: 12px 8px; color: #6b7280; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">${t.totalClaimedLabel}</th>
              </tr>
            </thead>
            <tbody>
              ${statsArray.map((stat, idx) => `
                <tr style="border-bottom: 1px solid #f3f4f6; background-color: ${idx % 2 === 0 ? '#fafafa' : '#ffffff'};">
                  <td style="padding: 14px 8px; font-weight: 600; color: #374151;">${stat.period}</td>
                  <td style="text-align: right; padding: 14px 8px; font-weight: 800; color: #10b981;">${stat.total.toFixed(2)} XLM</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div style="margin-top: 24px; text-align: center; font-size: 11px; font-weight: 600; color: #9ca3af; font-family: sans-serif; display: flex; align-items: center; justify-content: center; gap: 4px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>
            StelDot Network Analytics
          </div>
        </div>
        <div style="margin-top: 20px; padding: 0;">
          <button id="download-stats-btn" style="width: 100%; background: #007AFF; color: white; font-weight: 700; padding: 14px 0; border: none; outline: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 14px; font-family: sans-serif; transition: background 0.2s;" onmouseover="this.style.background='#0062cc'" onmouseout="this.style.background='#007AFF'">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            ${t.downloadImage}
          </button>
        </div>
      `,
      showConfirmButton: false,
      showCloseButton: true,
      customClass: {
        popup: 'rounded-3xl overflow-hidden !p-0 pb-5',
        htmlContainer: '!p-0 !m-0',
        title: '!pt-0 !mt-0 !hidden',
        closeButton: '!text-gray-400 hover:!text-gray-600 focus:!outline-none !top-3 !right-3'
      },
      didOpen: () => {
        const btn = document.getElementById('download-stats-btn');
        if (btn) {
          btn.addEventListener('click', async () => {
            btn.innerHTML = `<span class="animate-spin inline-block mr-2 text-lg">⟳</span> ${t.downloadingImage}`;
            btn.disabled = true;
            btn.classList.add('opacity-70', 'cursor-not-allowed');
            try {
              const container = document.getElementById('claim-stats-container');
              const originalStyle = container.getAttribute('style');
              container.style.padding = '40px';
              
              const canvas = await html2canvas(container, {
                scale: 3,
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true
              });
              
              container.setAttribute('style', originalStyle);
              
              const imgData = canvas.toDataURL('image/png');
              const link = document.createElement('a');
              link.download = `steldot_claim_stats_${new Date().getTime()}.png`;
              link.href = imgData;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            } catch (err) {
              console.error('Failed to generate stats image:', err);
              Swal.fire(t.errorTitle, t.downloadImageError, 'error');
            } finally {
              btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> ${t.downloadImage}`;
              btn.disabled = false;
              btn.classList.remove('opacity-70', 'cursor-not-allowed');
            }
          });
        }
      }
    });
  };

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
              {userAddress && (
                <button 
                  onClick={handleSimulateAmbassadorDiscount}
                  className="flex items-center justify-center p-2 rounded-full bg-cyan-50 hover:bg-cyan-100 text-cyan-600 transition-colors"
                  title={t.simulateDiscount || 'Simulate Discount'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                </button>
              )}
            <div className="flex items-center bg-[#F2F2F7] rounded-full p-0.5 sm:p-1 border border-ios-lightGray/40 mr-1 sm:mr-2">
              <button
                onClick={() => setLang('en')}
                className={`px-2 py-1 sm:px-3 sm:py-1 rounded-full text-[9px] sm:text-xs font-bold transition-all flex items-center gap-1.5 ${lang === 'en' ? 'bg-ios-blue shadow-sm text-white' : 'text-ios-secondaryText hover:text-ios-darkText'}`}
              >
                <img src="https://flagcdn.com/w20/gb.png" alt="EN" className="w-3.5 h-2.5 sm:w-4 sm:h-3 rounded-[1px] object-cover" /> 
                <span className="hidden sm:inline">ENG</span>
              </button>
              <button
                onClick={() => setLang('id')}
                className={`px-2 py-1 sm:px-3 sm:py-1 rounded-full text-[9px] sm:text-xs font-bold transition-all flex items-center gap-1.5 ${lang === 'id' ? 'bg-ios-blue shadow-sm text-white' : 'text-ios-secondaryText hover:text-ios-darkText'}`}
              >
                <img src="https://flagcdn.com/w20/id.png" alt="ID" className="w-3.5 h-2.5 sm:w-4 sm:h-3 rounded-[1px] object-cover" /> 
                <span className="hidden sm:inline">IND</span>
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
                <span className="sm:hidden">{t.connectBtn || 'Connect'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl w-full mx-auto px-6 mt-8 flex-grow">
        
        {/* Responsive Hero Banner with Animated Neuron Overlay */}
        <div className="w-full mb-8 rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.08)] bg-white border border-ios-lightGray/50 relative">
          <img src={bannerImg} alt="StelDot Campaign Banner" className="w-full h-auto object-cover max-h-[180px] sm:max-h-[300px] md:max-h-[400px]" />
          <NeuronCanvas />
        </div>
        

        {/* Partner Box (Shown if visited via ?ref=) */}
        {partnerAddress && partnerAddress !== userAddress && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 mb-6 flex items-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mr-4 border border-blue-200 overflow-hidden">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 opacity-80"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            </div>
            <div>
              <h4 className="font-bold text-ios-blue text-sm">{t.partnerTitle || 'Mitra Pengundang'}</h4>
              <p className="text-xs text-ios-secondaryText mt-0.5">{t.partnerDesc || 'Anda diundang oleh malaikat kebaikan. Donasi pertama Anda akan memberikan bonus untuk mereka.'}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-gray-200 text-gray-500">
                  {partnerAddress.substring(0, 8)}...{partnerAddress.substring(48)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Header Cards Row (Heading Metrics) */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          
          {/* Metric Card 1: Total Donasi Terkumpul */}
          <div className="bg-white rounded-2xl p-6 shadow-ios border border-ios-lightGray/30 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-ios-darkGray">{t.totalDonations}</span>
              <div className="text-3xl font-extrabold text-ios-darkText mt-2">{totalRaised.toFixed(2)} <span className="text-lg font-bold text-ios-blue">XLM</span></div>
            </div>
            <p className="text-[11px] text-ios-darkGray mt-4">{t.acrossCampaigns}</p>
          </div>

          {/* Metric Card 1.5: Total Connected Users */}
          <div className="bg-white rounded-2xl p-6 shadow-ios border border-ios-lightGray/30 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-ios-darkGray">{t.totalUsers || 'Total Pengguna'}</span>
              <div className="text-3xl font-extrabold text-ios-darkText mt-2">{topDonors.length}</div>
            </div>
            <p className="text-[11px] text-ios-darkGray mt-4">{t.totalUsersDesc || 'Dompet unik terhubung di jaringan'}</p>
          </div>

          {/* Metric Card 2: Reward Claim Status */}
          <div className="bg-white rounded-2xl p-6 shadow-ios border border-ios-lightGray/30 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-ios-darkGray">{t.rewardClaimStatus || 'Status Klaim Reward'}</span>
              
              {!userAddress ? (
                <div className="text-lg font-bold text-ios-darkGray mt-3 opacity-60">
                  {t.loginToViewPoints}
                </div>
              ) : (
                <>
                  <div className="mt-2 flex gap-6">
                    <div>
                      <div className="text-2xl font-extrabold text-ios-green">
                        {successfulClaims} <span className="text-sm font-bold text-ios-darkGray">{t.successful || 'Sukses'}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Unclaimed Volume */}
                  <div className="mt-4 flex justify-between items-center bg-[#F2F2F7] py-2 px-3 rounded-xl border border-ios-lightGray/30">
                    <span className="text-xs font-semibold text-ios-secondaryText">{t.unclaimedVolume || 'Unclaimed Volume'}</span>
                    <span className="text-sm font-bold text-ios-blue">{loyaltyPoints.toFixed(2)} XLM</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Metric Card 3: Donasi Anda */}
          <div className="bg-white rounded-2xl p-6 shadow-ios border border-ios-lightGray/30 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-ios-darkGray">{t.yourDonation}</span>
              <div className="text-3xl font-extrabold text-ios-darkText mt-2">{totalDonated.toFixed(2)} <span className="text-lg font-bold text-ios-blue">XLM</span></div>
            </div>
            {userAddress ? (
              <p className="text-[11px] text-ios-darkGray mt-4">{t.yourDonationDesc}</p>
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
                disabled={loyaltyPoints < 10 || isLoading}
                className={`ios-transition ios-active-scale px-8 py-3.5 rounded-2xl text-sm font-bold w-full md:w-auto ${
                  loyaltyPoints >= 10
                    ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white hover:from-amber-500 hover:to-orange-600 shadow-md shadow-orange-500/20'
                    : 'bg-ios-lightGray text-ios-darkGray cursor-not-allowed shadow-none'
                }`}
              >
                {t.claimRewardBtn} {(loyaltyPoints >= 10) && `(${(loyaltyPoints * 0.015).toFixed(2)} XLM)`}
              </button>
            </div>
            
          </section>
        )}

        {/* Helping Angel (Referral) Claims & Actions */}
        {userAddress && (totalDonated > 100 || isOwner) && (
          <section className="bg-white rounded-2xl p-6 shadow-ios border border-ios-lightGray/30 mb-8 flex flex-col md:flex-row items-center justify-between gap-6 glow-blue">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-ios-blue"><path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z"></path></svg>
              </div>
              <div>
                <h3 className="font-bold text-lg">{t.helpingAngelTitle || 'Malaikat Penolong (Referral)'}</h3>
                <p className="text-sm text-ios-secondaryText mt-0.5">
                  <span dangerouslySetInnerHTML={{ __html: (typeof t.helpingAngelDesc === 'function' ? t.helpingAngelDesc(referralBalance) : '') || `Saldo referral Anda: <strong>${referralBalance} XLM</strong>.` }}></span>
                </p>
                <div className="mt-2">
                  <button 
                    onClick={() => setShowAngelReferral(true)}
                    className="text-xs text-ios-blue hover:underline font-medium"
                  >
                    {t.referralHistoryTitle || 'Lihat Daftar Teman Berdonasi'} &rarr;
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 w-full md:w-auto">
              <button 
                onClick={handleClaimReferral}
                disabled={referralBalance <= 0 || isLoading}
                className={`ios-transition ios-active-scale px-8 py-3.5 rounded-2xl text-sm font-bold w-full md:w-auto ${
                  referralBalance > 0
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 shadow-md shadow-blue-500/20'
                    : 'bg-ios-lightGray text-ios-darkGray cursor-not-allowed shadow-none'
                }`}
              >
                {t.claimReferralBtn || 'Klaim Reward Referral'}
              </button>
              
              <button
                onClick={() => {
                  const url = `${window.location.origin}${window.location.pathname}?ref=${userAddress}`;
                  navigator.clipboard.writeText(url);
                  Swal.fire({
                    title: t.linkCopied || 'Link Tersalin!',
                    text: t.shareLinkDesc || 'Ajak teman berdonasi dan dapatkan 0.5% dari donasi pertama mereka.',
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                  });
                }}
                className="text-[11px] text-ios-blue hover:bg-blue-50 px-3 py-1 rounded-full ios-transition border border-blue-100 flex items-center gap-1 mt-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                {t.copyLink || 'Salin Link Referral'}
              </button>
            </div>
            
          </section>
        )}

        {/* Progress Rewards - Outside the box */}
        {userAddress && (
          <div className="mb-12 w-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
              <div>
                <h3 className="font-bold text-xl text-ios-darkText">{t.progressRewardsTitle}</h3>
                <p className="text-sm text-ios-secondaryText mt-1">{t.progressRewardsDesc}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
              {/* Milestone 1 */}
              <button 
                onClick={() => {
                  if (totalDonated > 25 || isOwner) {
                    setShowCertificate(true);
                  }
                }}
                disabled={!(totalDonated > 25 || isOwner)}
                className={`relative flex flex-col items-center justify-center p-6 rounded-3xl border-2 transition-all ${
                  totalDonated > 25 || isOwner 
                    ? 'bg-gradient-to-b from-amber-50 to-orange-50 border-orange-200 hover:border-orange-300 hover:shadow-md hover:-translate-y-1 cursor-pointer' 
                    : 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mb-4 ${
                  totalDonated > 25 || isOwner
                    ? 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-orange-500/30'
                    : 'bg-gray-200'
                }`}>
                  {totalDonated > 25 || isOwner ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  )}
                </div>
                <div className="flex flex-col items-center">
                  <span className={`text-[10px] sm:text-xs font-bold text-center ${totalDonated > 25 || isOwner ? 'text-orange-700' : 'text-gray-500'}`}>
                    {t.milestone1}
                  </span>
                  <span className={`text-[10px] sm:text-xs text-center mt-1 font-mono ${totalDonated > 25 || isOwner ? 'text-orange-600/80' : 'text-gray-400'}`}>
                    (&gt; 25 XLM)
                  </span>
                </div>
              </button>

              {/* Milestone 2 */}
              <button 
                onClick={() => {
                  if (totalDonated > 50 || isOwner) {
                    setShowAmbassadorBarcode(true);
                  }
                }}
                disabled={!(totalDonated > 50 || isOwner)}
                className={`relative flex flex-col items-center justify-center p-6 rounded-3xl border-2 transition-all ${
                  totalDonated > 50 || isOwner 
                    ? 'bg-gradient-to-b from-blue-50 to-cyan-50 border-cyan-200 hover:border-cyan-300 hover:shadow-md hover:-translate-y-1 cursor-pointer' 
                    : 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mb-4 ${
                  totalDonated > 50 || isOwner
                    ? 'bg-gradient-to-br from-cyan-400 to-blue-500 shadow-lg shadow-blue-500/30'
                    : 'bg-gray-200'
                }`}>
                  {totalDonated > 50 || isOwner ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  )}
                </div>
                <div className="flex flex-col items-center">
                  <span className={`text-[10px] sm:text-xs font-bold text-center ${totalDonated > 50 || isOwner ? 'text-blue-700' : 'text-gray-500'}`}>
                    {t.milestone2}
                  </span>
                  <span className={`text-[10px] sm:text-xs text-center mt-1 font-mono ${totalDonated > 50 || isOwner ? 'text-blue-600/80' : 'text-gray-400'}`}>
                    (&gt; 50 XLM)
                  </span>
                </div>
              </button>

              {/* Milestone 3 */}
              <button 
                onClick={() => {
                  if (totalDonated > 100 || isOwner) {
                    setShowAngelReferral(true);
                  }
                }}
                disabled={!(totalDonated > 100 || isOwner)}
                className={`relative flex flex-col items-center justify-center p-6 rounded-3xl border-2 transition-all ${
                  totalDonated > 100 || isOwner 
                    ? 'bg-gradient-to-b from-purple-50 to-fuchsia-50 border-purple-200 hover:border-purple-300 hover:shadow-md hover:-translate-y-1 cursor-pointer' 
                    : 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mb-4 ${
                  totalDonated > 100 || isOwner
                    ? 'bg-gradient-to-br from-fuchsia-400 to-purple-500 shadow-lg shadow-purple-500/30'
                    : 'bg-gray-200'
                }`}>
                  {totalDonated > 100 || isOwner ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  )}
                </div>
                <div className="flex flex-col items-center">
                  <span className={`text-[10px] sm:text-xs font-bold text-center ${totalDonated > 100 || isOwner ? 'text-purple-700' : 'text-gray-500'}`}>
                    {t.milestone3}
                  </span>
                  <span className={`text-[10px] sm:text-xs text-center mt-1 font-mono ${totalDonated > 100 || isOwner ? 'text-purple-600/80' : 'text-gray-400'}`}>
                    (&gt; 100 XLM)
                  </span>
                </div>
              </button>

              {/* Milestone 4 */}
              <button 
                onClick={() => {
                  if (totalDonated > 500 || isOwner) {
                    setShowVIPBarcode(true);
                  }
                }}
                disabled={!(totalDonated > 500 || isOwner)}
                className={`relative flex flex-col items-center justify-center p-6 rounded-3xl border-2 transition-all ${
                  totalDonated > 500 || isOwner 
                    ? 'bg-gradient-to-b from-emerald-50 to-teal-50 border-emerald-200 hover:border-emerald-300 hover:shadow-md hover:-translate-y-1 cursor-pointer' 
                    : 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mb-4 ${
                  totalDonated > 500 || isOwner
                    ? 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-teal-500/30'
                    : 'bg-gray-200'
                }`}>
                  {totalDonated > 500 || isOwner ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.956-.734L2.02 6.02a.5.5 0 0 1 .798-.518l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  )}
                </div>
                <div className="flex flex-col items-center">
                  <span className={`text-[10px] sm:text-xs font-bold text-center ${totalDonated > 500 || isOwner ? 'text-teal-700' : 'text-gray-500'}`}>
                    {t.milestone4}
                  </span>
                  <span className={`text-[10px] sm:text-xs text-center mt-1 font-mono ${totalDonated > 500 || isOwner ? 'text-teal-600/80' : 'text-gray-400'}`}>
                    (&gt; 500 XLM)
                  </span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Owner Dashboard (Visible to Owner only) */}
        {isOwner && (
          <section className="bg-white border-2 border-ios-red/20 rounded-2xl p-8 shadow-ios mb-12 bg-gradient-to-br from-red-50/10 to-white">
            
            <div className="flex items-center justify-between border-b border-ios-lightGray pb-4 mb-6">
              <div className="flex items-center gap-3">
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
              <button 
                onClick={(e) => { e.preventDefault(); handleContractIdPrompt(); }} 
                className="bg-gray-100 hover:bg-gray-200 text-ios-darkText text-xs font-bold py-2 px-4 rounded-full border border-gray-200 transition-colors flex items-center gap-2"
                title={t.setContractId || 'Set Contract ID'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                <span className="hidden sm:inline">{t.setContractId || 'Set Contract ID'}</span>
              </button>
            </div>

            {/* iOS Style Tabs for Admin Panel */}
            <div className="flex bg-gray-100 p-1 rounded-xl mb-6 w-full max-w-sm">
              <button 
                onClick={(e) => { e.preventDefault(); setAdminTab('campaign'); }}
                className={`flex-1 py-2 px-4 text-xs font-bold rounded-lg transition-all ${adminTab === 'campaign' ? 'bg-white shadow text-ios-darkText' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {t.createNewCampaign}
              </button>
              <button 
                onClick={(e) => { e.preventDefault(); setAdminTab('claims'); }}
                className={`flex-1 py-2 px-4 text-xs font-bold rounded-lg transition-all ${adminTab === 'claims' ? 'bg-white shadow text-ios-darkText' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {t.rewardClaimHistoryTitle || 'Claim History'}
              </button>
            </div>

            <div>
              {/* Campaign Creation */}
              {adminTab === 'campaign' && (
              <div>
                <form onSubmit={handleCreateCampaign} className="space-y-4">
                  <div>
                    <label className="text-[11px] font-bold text-ios-darkGray block mb-1">{t.autoCampaignId || 'Auto Campaign ID'}</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <div className="w-6 h-6 rounded-full bg-gray-500/10 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"></path></svg>
                        </div>
                      </div>
                      <input 
                        type="text" 
                        value={newCampaign.id}
                        readOnly
                        placeholder={t.egCampaignId}
                        className="w-full bg-[#E5E5EA] border border-ios-lightGray/40 rounded-xl pl-11 pr-4 py-2.5 text-sm outline-none cursor-not-allowed text-ios-darkGray"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-ios-darkGray block mb-1">{t.title}</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </div>
                      </div>
                      <input 
                        type="text" 
                        value={newCampaign.title}
                        onChange={(e) => setNewCampaign({ ...newCampaign, title: e.target.value })}
                        placeholder={t.egTitle}
                        className="w-full bg-[#F2F2F7] border border-ios-lightGray/40 rounded-xl pl-11 pr-4 py-2.5 text-sm outline-none focus:border-ios-blue transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-ios-darkGray block mb-1">{t.description}</label>
                    <div className="relative">
                      <div className="absolute top-2.5 left-0 pl-3 flex items-start pointer-events-none">
                        <div className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7"></path></svg>
                        </div>
                      </div>
                      <textarea 
                        value={newCampaign.description}
                        onChange={(e) => setNewCampaign({ ...newCampaign, description: e.target.value })}
                        placeholder={t.describeCampaign}
                        rows="5"
                        className="w-full bg-[#F2F2F7] border border-ios-lightGray/40 rounded-xl pl-11 pr-4 py-2.5 text-sm outline-none focus:border-ios-blue transition-all"
                      ></textarea>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-ios-darkGray block mb-1">{t.goalTarget}</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </div>
                      </div>
                      <input 
                        type="number" 
                        value={newCampaign.target}
                        onChange={(e) => setNewCampaign({ ...newCampaign, target: e.target.value })}
                        placeholder={t.egTarget}
                        className="w-full bg-[#F2F2F7] border border-ios-lightGray/40 rounded-xl pl-11 pr-4 py-2.5 text-sm outline-none focus:border-ios-blue transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-ios-darkGray block mb-1">{t.youtubeLink || 'YouTube Link'}</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
                        </div>
                      </div>
                      <input 
                        type="url" 
                        value={newCampaign.youtube_link}
                        onChange={(e) => setNewCampaign({ ...newCampaign, youtube_link: e.target.value })}
                        placeholder={t.youtubeLinkEg || "https://youtube.com/watch?v=..."}
                        className="w-full bg-[#F2F2F7] border border-ios-lightGray/40 rounded-xl pl-11 pr-4 py-2.5 text-sm outline-none focus:border-ios-blue transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-ios-darkGray block mb-1">{t.clientWallet || 'Client Wallet'}</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
                        </div>
                      </div>
                      <input 
                        type="text" 
                        value={newCampaign.client_wallet}
                        onChange={(e) => setNewCampaign({ ...newCampaign, client_wallet: e.target.value })}
                        placeholder={t.clientWalletEg || "G..."}
                        className="w-full bg-[#F2F2F7] border border-ios-lightGray/40 rounded-xl pl-11 pr-4 py-2.5 text-sm outline-none focus:border-ios-blue transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-ios-darkGray block mb-1">{t.expirationDate || 'Expiration Date'}</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                        <div className="w-6 h-6 rounded-full bg-purple-500/10 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        </div>
                      </div>
                      <CustomDatePicker 
                        value={newCampaign.expiration}
                        onChange={(val) => setNewCampaign({ ...newCampaign, expiration: val })}
                        placeholder="Select date"
                      />
                    </div>
                  </div>
                  
                  <button 
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-ios-blue text-white font-bold rounded-xl py-3 text-sm shadow-md shadow-blue-500/10 hover:bg-blue-600 transition-all"
                  >
                    {t.deployCampaign}
                  </button>
                </form>

                {/* Treasury Cash Balance */}
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
              )}

              {/* Claim History */}
              {adminTab === 'claims' && (
              <div className="flex flex-col h-full justify-start">
                <div className="flex flex-col mb-4 gap-3">
                  <div className="flex justify-between items-center w-full">
                    <h3 className="font-bold text-sm text-ios-darkText flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-amber-50 flex items-center justify-center border border-amber-100">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>
                      </div>
                      {t.claimHistory}
                    </h3>
                    <button 
                      onClick={handleViewClaimStats}
                      className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-500 rounded-lg transition-colors flex items-center justify-center border border-amber-100"
                      title={t.viewStats}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
                    </button>
                  </div>
                  <div className="relative w-full">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </div>
                    <input 
                      type="text" 
                      placeholder={t.searchWallet}
                      value={claimHistorySearch}
                      onChange={(e) => setClaimHistorySearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-3 flex-1">
                  {currentClaims.length === 0 ? (
                    <div className="text-center py-6 text-xs text-gray-400 bg-gray-50 rounded-2xl border border-gray-100">
                      No claims found.
                    </div>
                  ) : (
                    currentClaims.map(claim => (
                      <div 
                        key={claim.id}
                        onClick={() => {
                          Swal.fire({
                            title: t.transactionDetail,
                            html: `
                              <div style="text-align: left; font-family: monospace; font-size: 13px; padding: 0 16px 16px 16px; color: #374151; word-wrap: break-word;">
                                <strong style="color: #111827;">${t.contractSource}:</strong><br/>
                                <span style="color: #6b7280; user-select: all; display: block; background: #f3f4f6; padding: 8px; border-radius: 8px; margin-top: 4px; font-size: 11px;">
                                  <a href="https://stellar.expert/explorer/${networkMode.toLowerCase()}/contract/${claim.from}" target="_blank" style="color: inherit; text-decoration: underline;">${claim.from}</a>
                                </span><br/>
                                <strong style="color: #111827;">${t.fromSender}:</strong><br/>
                                <span style="color: #2563eb; user-select: all; display: block; background: #f3f4f6; padding: 8px; border-radius: 8px; margin-top: 4px;">
                                  <a href="https://stellar.expert/explorer/${networkMode.toLowerCase()}/account/${claim.address}" target="_blank" style="color: #2563eb; text-decoration: underline;">${claim.address}</a>
                                </span><br/>
                                <strong style="color: #111827;">${t.amountLabel}:</strong> ${claim.amount.toFixed(2)} XLM<br/><br/>
                                <strong style="color: #111827;">${t.dateLabel}:</strong> ${claim.date}<br/><br/>
                                <strong style="color: #111827;">${t.statusLabel}:</strong> <span style="color: #10b981; font-weight: bold; background: #ecfdf5; padding: 2px 6px; border-radius: 4px;">${t.successful.toUpperCase()}</span>
                              </div>
                            `,
                            icon: 'info',
                            confirmButtonText: t.close,
                            customClass: { 
                              popup: 'rounded-2xl overflow-hidden !p-0',
                              htmlContainer: '!p-0 !m-0',
                              title: '!pt-6',
                              actions: 'w-full !m-0 !p-0 border-t border-gray-100',
                              confirmButton: 'w-full bg-ios-blue hover:bg-blue-600 text-white font-bold py-4 rounded-none transition-colors !m-0 border-none outline-none focus:outline-none focus:ring-0'
                            }
                          });
                        }}
                        className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer active:scale-[0.98]"
                      >
                        <div className="flex items-center gap-3 w-2/3">
                          <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>
                          </div>
                          <div className="overflow-hidden w-full">
                            <p className="text-xs font-mono text-ios-darkText font-bold truncate">{claim.address.substring(0, 5)}...{claim.address.substring(claim.address.length - 4)}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5 truncate">{claim.date}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end flex-shrink-0">
                          <span className="text-sm font-bold text-amber-500">{claim.amount.toFixed(2)} XLM</span>
                          <div className="text-[9px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded flex items-center justify-center mt-1 uppercase tracking-wider">
                            {t.approved || 'APPROVED'}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Pagination */}
                <div className="flex justify-center items-center gap-2 mt-4 pt-4 mb-4 border-t border-gray-100">
                  <button 
                    onClick={() => setClaimHistoryPage(p => Math.max(1, p - 1))}
                    disabled={claimHistoryPage === 1}
                    className="p-1 rounded-full text-gray-400 hover:text-amber-500 disabled:opacity-30 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                  </button>
                  <span className="text-xs font-bold text-ios-darkGray">{claimHistoryPage} / {Math.max(1, totalClaimPages)}</span>
                  <button 
                    onClick={() => setClaimHistoryPage(p => Math.min(totalClaimPages, p + 1))}
                    disabled={claimHistoryPage === totalClaimPages || totalClaimPages === 0}
                    className="p-1 rounded-full text-gray-400 hover:text-amber-500 disabled:opacity-30 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </button>
                </div>
              </div>
              )}
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
              ).sort((a, b) => b.id - a.id);
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
                    <div className="flex justify-between items-start gap-4 mb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-ios-blue bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                          {t.campaignIdLabel}{camp.id}
                        </span>
                        
                        <button 
                          onClick={() => handleTranslate(camp)}
                          disabled={translated?.loading}
                          title={translated ? t.showOriginal : t.translateBtn}
                          className={`px-2 py-0.5 rounded-full border transition-colors flex items-center gap-1 text-[10px] font-bold ${translated ? 'bg-blue-100 border-blue-200 text-blue-600' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                        >
                          {translated?.loading ? (
                            <span className="spinner w-3 h-3 border-2 border-blue-500 inline-block rounded-full"></span>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>
                              {translated ? (t.translatedBtn || 'Translated') : (t.translateBtn || 'Translate')}
                            </>
                          )}
                        </button>

                        {isOwner && (
                          <button onClick={() => handleUpdateCampaign(camp)} className="text-[10px] font-bold text-ios-darkText bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full hover:bg-gray-200 transition-colors flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                            {t.editBtn || 'Edit'}
                          </button>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-sm font-bold text-ios-blue">{percent}%</span>
                        <span className="text-xs text-ios-darkGray block font-medium">{t.raised}</span>
                      </div>
                    </div>

                    <h3 className="font-bold text-xl text-ios-darkText leading-tight mb-2">
                      {activeTitle} 
                      {!camp.active && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full ml-2 align-middle">{t.inactive || 'Inactive'}</span>}
                      {camp.expiration > 0 && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ml-2 align-middle border ${(Date.now()/1000) > camp.expiration ? 'bg-red-50 border-red-200 text-red-600' : 'bg-blue-50 border-blue-200 text-blue-600'}`}>
                          <svg className="w-3 h-3 inline mr-1 pb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                          {(Date.now()/1000) > camp.expiration ? t.campaignFinished : `${t.remaining} ${Math.ceil((camp.expiration - (Date.now()/1000)) / (60 * 60 * 24))} ${t.daysRemaining}`}
                        </span>
                      )}
                    </h3>

                    <div className="flex flex-col sm:flex-row gap-4 mb-4">
                      <div className="flex-1 cursor-pointer" onClick={() => setSelectedCampaign(camp)}>
                        <p className={`text-sm text-ios-secondaryText leading-relaxed whitespace-pre-wrap ${shouldTruncate ? 'mb-1' : ''}`}>
                          {displayDesc}
                        </p>
                        {shouldTruncate && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); toggleDescription(camp.id); }} 
                            className="text-[11px] font-bold text-ios-blue hover:text-blue-600 transition-colors inline-block mt-1"
                          >
                            {isExpanded ? t.showLess : t.showMore}
                          </button>
                        )}
                      </div>
                      
                      {camp.youtube_link && (() => {
                        const match = camp.youtube_link.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
                        const videoId = match ? match[1] : null;
                        if (!videoId) return null;
                        return (
                          <div className="w-full sm:w-32 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 border border-gray-200 relative group cursor-pointer" onClick={() => setSelectedCampaign(camp)}>
                            <img src={`https://img.youtube.com/vi/${videoId}/0.jpg`} className="w-full h-full object-cover" alt="YouTube Thumbnail" />
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover:bg-black/40 transition-all">
                              <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
                                <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-ios-bg h-2 rounded-full overflow-hidden mb-3 border border-ios-lightGray/10 cursor-pointer" onClick={() => setSelectedCampaign(camp)}>
                      <div 
                        className="bg-gradient-to-r from-ios-blue to-ios-green h-full rounded-full transition-all duration-500" 
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>

                    <div className="flex justify-between text-xs text-ios-darkGray font-semibold mb-6">
                      <span>{t.raisedLabel} {camp.raised.toFixed(2)} XLM</span>
                      <span>{t.target} {camp.target.toFixed(2)} XLM</span>
                    </div>

                    {/* Transfer Progress Box */}
                    {camp.client_wallet && (
                      <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 mb-6 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => setSelectedCampaign(camp)}>
                        <div className="flex justify-between items-center text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                          <span>{t.transferredToClient || 'Funds Transferred'}</span>
                          <span className="text-ios-blue">{camp.funds_transferred.toFixed(2)} / {camp.raised.toFixed(2)} XLM</span>
                        </div>
                        <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-blue-400 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${camp.raised > 0 ? Math.min((camp.funds_transferred / camp.raised) * 100, 100) : 0}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {/* Donation Action Form */}
                    {userAddress && camp.active && camp.raised < camp.target ? (
                      <div className="border-t border-ios-lightGray pt-4">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-ios-darkGray block mb-2">{t.donateToThis}</label>
                        
                        <div className="flex gap-3 mb-3">
                          <div className="relative flex-grow flex items-center">
                            <input 
                              type="number" 
                              min="0.05" 
                              step="0.05"
                              value={donateAmounts[camp.id] || ''}
                              onChange={(e) => setDonateAmounts({ ...donateAmounts, [camp.id]: e.target.value })}
                              placeholder={t.placeholderTarget}
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
                        <div className="flex gap-2 flex-wrap mb-2">
                          {[0.05, 0.1, 5, 10, 25].map((amt) => (
                            <button 
                              key={amt} 
                              onClick={() => selectQuickAmount(camp.id, amt)}
                              className="px-3 py-1.5 rounded-full border border-ios-lightGray text-[11px] font-bold text-ios-secondaryText hover:bg-gray-50 active:scale-95 transition-all"
                            >
                              +{amt} <span className="hidden sm:inline">XLM</span>
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-gray-400 italic flex items-center gap-1.5">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-amber-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                          {t.donationFeeNote}
                        </p>
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
            <div className="bg-white rounded-2xl p-6 shadow-ios border border-ios-lightGray/30 mb-6">
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
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleContractIdPrompt}
                      className="font-mono text-gray-500 hover:text-ios-darkText truncate max-w-[100px] text-right text-xs"
                      title="Set Contract"
                    >
                      {contractId ? `${contractId.substring(0, 5)}...${contractId.substring(51)}` : 'Set Contract'}
                    </button>
                    {contractId && (
                      <a href={`https://stellar.expert/explorer/testnet/contract/${contractId}`} target="_blank" className="text-ios-blue hover:text-blue-600" title="View Contract on Stellar Expert">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                      </a>
                    )}
                  </div>
                </li>


                {userAddress && (
                  <>
                    <li className="flex justify-between border-b border-ios-lightGray/20 pb-2">
                      <span className="text-ios-darkGray font-medium">Wallet Address</span>
                      <a href={`https://stellar.expert/explorer/testnet/account/${userAddress}`} target="_blank" className="font-mono text-ios-blue underline truncate max-w-[120px] font-bold text-right hover:text-blue-600" title="View Wallet on Stellar Expert">
                        {userAddress.substring(0, 5)}...{userAddress.substring(51)}
                      </a>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-ios-darkGray font-medium">{t.walletBalance}</span>
                      <span className="font-bold text-ios-darkText">{freighterBalance} XLM</span>
                    </li>
                  </>
                )}
              </ul>
            </div>

            {/* User Transactions */}
            {userAddress && (
              <div className="bg-white rounded-2xl p-6 shadow-ios border border-ios-lightGray/30 mb-6">
                <h2 className="text-lg font-bold tracking-tight text-ios-darkText mb-3 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  </div>
                  {t.myTransactions}
                </h2>
                <div className="relative mb-4">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  </div>
                  <input 
                    type="text" 
                    placeholder={t.searchHash}
                    value={userTxSearch}
                    onChange={(e) => setUserTxSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs outline-none focus:ring-2 focus:ring-ios-blue transition-all"
                  />
                </div>

                <div className="space-y-3">
                  {currentUserTxs.length === 0 ? (
                    <div className="text-center py-6 text-xs text-gray-400 bg-gray-50 rounded-2xl border border-gray-100">
                      {t.noTransactions}
                    </div>
                  ) : (
                    currentUserTxs.map(tx => (
                      <div 
                        key={tx.id}
                        onClick={() => {
                          Swal.fire({
                            title: t.transactionDetail,
                            html: `
                              <div style="text-align: left; font-family: monospace; font-size: 13px; padding: 0 16px 16px 16px; color: #374151; word-wrap: break-word;">
                                <strong style="color: #111827;">${t.transactionHash}:</strong><br/>
                                <span style="color: #2563eb; user-select: all; display: block; background: #f3f4f6; padding: 8px; border-radius: 8px; margin-top: 4px;">
                                  <a href="https://stellar.expert/explorer/${networkMode.toLowerCase()}/tx/${tx.hash}" target="_blank" style="color: #2563eb; text-decoration: underline;">${tx.hash}</a>
                                </span><br/>
                                <strong style="color: #111827;">${t.fromSender}:</strong><br/>
                                <span style="color: #6b7280; user-select: all; display: block; background: #f3f4f6; padding: 8px; border-radius: 8px; margin-top: 4px; font-size: 11px;">
                                  <a href="${getExplorerLink(tx.wallet)}" target="_blank" style="color: inherit; text-decoration: underline;">${tx.wallet}</a>
                                </span><br/>
                                <strong style="color: #111827;">${t.toReceiver}:</strong><br/>
                                <span style="color: #6b7280; user-select: all; display: block; background: #f3f4f6; padding: 8px; border-radius: 8px; margin-top: 4px; font-size: 11px;">
                                  <a href="${getExplorerLink(tx.to)}" target="_blank" style="color: inherit; text-decoration: underline;">${tx.to}</a>
                                </span><br/>
                                <strong style="color: #111827;">${t.amountLabel}:</strong> ${tx.amount.toFixed(2)} XLM<br/><br/>
                                <strong style="color: #111827;">${t.dateLabel}:</strong> ${tx.date}<br/><br/>
                                <strong style="color: #111827;">${t.statusLabel}:</strong> <span style="color: #10b981; font-weight: bold; background: #ecfdf5; padding: 2px 6px; border-radius: 4px;">${t.successful.toUpperCase()}</span>
                              </div>
                            `,
                            icon: 'success',
                            confirmButtonText: t.close,
                            customClass: { 
                              popup: 'rounded-2xl overflow-hidden !p-0',
                              htmlContainer: '!p-0 !m-0',
                              title: '!pt-6',
                              actions: 'w-full !m-0 !p-0 border-t border-gray-100',
                              confirmButton: 'w-full bg-ios-blue hover:bg-blue-600 text-white font-bold py-4 rounded-none transition-colors !m-0 border-none outline-none focus:outline-none focus:ring-0'
                            }
                          });
                        }}
                        className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer active:scale-[0.98]"
                      >
                        <div className="flex items-center gap-3 w-2/3">
                          <div className="w-10 h-10 rounded-full bg-green-50 border border-green-100 flex items-center justify-center flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          </div>
                          <div className="overflow-hidden w-full">
                            <p className="text-xs font-mono text-ios-darkText font-bold truncate">{tx.wallet.substring(0, 8)}...{tx.wallet.substring(tx.wallet.length - 8)}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5 truncate">{tx.date}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end flex-shrink-0">
                          <span className="text-sm font-bold text-ios-blue">{tx.amount.toFixed(2)} XLM</span>
                          <span className="text-[10px] font-bold text-green-500 bg-green-50 px-2 py-0.5 rounded-full uppercase mt-1">Success</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                  <div className="flex justify-center items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                    <button 
                      onClick={() => setUserTxPage(p => Math.max(1, p - 1))}
                      disabled={userTxPage === 1}
                      className="p-1 rounded-full text-gray-400 hover:text-ios-blue disabled:opacity-30 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </button>
                    <span className="text-xs font-bold text-ios-darkGray">{userTxPage} / {totalUserTxPages}</span>
                    <button 
                      onClick={() => setUserTxPage(p => Math.min(totalUserTxPages, p + 1))}
                      disabled={userTxPage === totalUserTxPages}
                      className="p-1 rounded-full text-gray-400 hover:text-ios-blue disabled:opacity-30 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                  </div>
              </div>
            )}

            {/* User Claim Rewards */}
            {userAddress && (
              <div className="bg-white rounded-2xl p-6 shadow-ios border border-ios-lightGray/30 mb-6">
                <h2 className="text-lg font-bold tracking-tight text-ios-darkText mb-3 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-amber-50 flex items-center justify-center border border-amber-100">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>
                  </div>
                  {t.myClaimRewards}
                </h2>
                <div className="relative mb-4">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  </div>
                  <input 
                    type="text" 
                    placeholder={t.searchWallet}
                    value={userClaimSearch}
                    onChange={(e) => setUserClaimSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                  />
                </div>

                <div className="space-y-3">
                  {currentUserClaims.length === 0 ? (
                    <div className="text-center py-6 text-xs text-gray-400 bg-gray-50 rounded-2xl border border-gray-100">
                      {t.noClaims}
                    </div>
                  ) : (
                    currentUserClaims.map(claim => (
                      <div 
                        key={claim.id}
                        onClick={() => {
                          Swal.fire({
                            title: t.claimDetailTitle,
                            html: `
                              <div style="text-align: left; font-family: monospace; font-size: 13px; padding: 0 16px 16px 16px; color: #374151; word-wrap: break-word;">
                                <strong style="color: #111827;">${t.claimId}:</strong><br/>
                                <span style="color: #4b5563; user-select: all; display: block; background: #f3f4f6; padding: 8px; border-radius: 8px; margin-top: 4px;">
                                  ${claim.id}
                                </span><br/>
                                <strong style="color: #111827;">${t.claimerAddress}:</strong><br/>
                                <span style="color: #6b7280; user-select: all; display: block; background: #f3f4f6; padding: 8px; border-radius: 8px; margin-top: 4px; font-size: 11px;">
                                  <a href="${getExplorerLink(claim.address)}" target="_blank" style="color: #2563eb; text-decoration: underline;">${claim.address}</a>
                                </span><br/>
                                <strong style="color: #111827;">${t.contractSource}:</strong><br/>
                                <span style="color: #6b7280; user-select: all; display: block; background: #f3f4f6; padding: 8px; border-radius: 8px; margin-top: 4px; font-size: 11px;">
                                  <a href="${getExplorerLink(claim.from)}" target="_blank" style="color: inherit; text-decoration: underline;">${claim.from}</a>
                                </span><br/>
                                <strong style="color: #111827;">${t.amountLabel}:</strong> ${claim.amount.toFixed(2)} XLM<br/><br/>
                                <strong style="color: #111827;">${t.dateLabel}:</strong> ${claim.date}<br/><br/>
                                <strong style="color: #111827;">${t.statusLabel}:</strong> <span style="color: #10b981; font-weight: bold; background: #ecfdf5; padding: 2px 6px; border-radius: 4px;">${t.approved.toUpperCase()}</span>
                              </div>
                            `,
                            icon: 'success',
                            confirmButtonText: t.close,
                            customClass: { 
                              popup: 'rounded-2xl overflow-hidden !p-0',
                              htmlContainer: '!p-0 !m-0',
                              title: '!pt-6',
                              actions: 'w-full !m-0 !p-0 border-t border-gray-100',
                              confirmButton: 'w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 rounded-none transition-colors !m-0 border-none outline-none focus:outline-none focus:ring-0'
                            }
                          });
                        }}
                        className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer active:scale-[0.98]"
                      >
                        <div className="flex items-center gap-3 w-2/3">
                          <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>
                          </div>
                          <div className="overflow-hidden w-full">
                            <p className="text-xs font-mono text-ios-darkText font-bold truncate">{claim.address.substring(0, 5)}...{claim.address.substring(claim.address.length - 4)}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5 truncate">{claim.date}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end flex-shrink-0">
                          <span className="text-sm font-bold text-amber-500">{claim.amount.toFixed(2)} XLM</span>
                          <span className="text-[10px] font-bold text-green-500 bg-green-50 px-2 py-0.5 rounded-full uppercase mt-1">{t.approved}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Pagination */}
                <div className="flex justify-center items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                  <button 
                    onClick={() => setUserClaimPage(p => Math.max(1, p - 1))}
                    disabled={userClaimPage === 1}
                    className="p-1 rounded-full text-gray-400 hover:text-amber-500 disabled:opacity-30 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                  </button>
                  <span className="text-xs font-bold text-ios-darkGray">{userClaimPage} / {Math.max(1, totalUserClaimPages)}</span>
                  <button 
                    onClick={() => setUserClaimPage(p => Math.min(totalUserClaimPages, p + 1))}
                    disabled={userClaimPage === totalUserClaimPages || totalUserClaimPages === 0}
                    className="p-1 rounded-full text-gray-400 hover:text-amber-500 disabled:opacity-30 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </button>
                </div>
              </div>
            )}

            {/* All Transactions (Transparent for everyone) */}
            <div className="bg-white rounded-2xl p-6 shadow-ios border border-ios-lightGray/30 mb-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-16 -mt-16 opacity-50 pointer-events-none transition-transform group-hover:scale-110"></div>
              <h2 className="text-lg font-bold tracking-tight text-ios-darkText mb-3 flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                </div>
                {t.allTransactions}
              </h2>
              <div className="relative mb-4">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </div>
                <input 
                  type="text" 
                  placeholder={t.searchHash}
                  value={allTxSearch}
                  onChange={(e) => setAllTxSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs outline-none focus:ring-2 focus:ring-ios-blue transition-all"
                />
              </div>
              <div className="space-y-3">
                {currentAllTxs.length === 0 ? (
                  <div className="text-center py-6 text-xs text-gray-400 bg-gray-50 rounded-2xl border border-gray-100">
                    {t.noTransactions}
                  </div>
                ) : (
                  currentAllTxs.map(tx => (
                    <div key={tx.id} onClick={() => {
                        Swal.fire({
                          title: t.transactionDetail,
                          html: `
                            <div style="text-align: left; font-family: monospace; font-size: 13px; padding: 0 16px 16px 16px; color: #374151; word-wrap: break-word;">
                              <strong style="color: #111827;">${t.transactionHash}:</strong><br/>
                              <span style="color: #2563eb; user-select: all; display: block; background: #f3f4f6; padding: 8px; border-radius: 8px; margin-top: 4px;">
                                <a href="https://stellar.expert/explorer/${networkMode.toLowerCase()}/tx/${tx.hash}" target="_blank" style="color: #2563eb; text-decoration: underline;">${tx.hash}</a>
                              </span><br/>
                              <strong style="color: #111827;">${t.fromSender}:</strong><br/>
                              <span style="color: #6b7280; user-select: all; display: block; background: #f3f4f6; padding: 8px; border-radius: 8px; margin-top: 4px; font-size: 11px;">
                                <a href="${getExplorerLink(tx.wallet)}" target="_blank" style="color: inherit; text-decoration: underline;">${tx.wallet}</a>
                              </span><br/>
                              <strong style="color: #111827;">${t.toReceiver}:</strong><br/>
                              <span style="color: #6b7280; user-select: all; display: block; background: #f3f4f6; padding: 8px; border-radius: 8px; margin-top: 4px; font-size: 11px;">
                                <a href="${getExplorerLink(tx.to)}" target="_blank" style="color: inherit; text-decoration: underline;">${tx.to}</a>
                              </span><br/>
                              <strong style="color: #111827;">${t.amountLabel}:</strong> ${tx.amount.toFixed(2)} XLM<br/><br/>
                              <strong style="color: #111827;">${t.dateLabel}:</strong> ${tx.date}<br/><br/>
                              <strong style="color: #111827;">${t.statusLabel}:</strong> <span style="color: #10b981; font-weight: bold; background: #ecfdf5; padding: 2px 6px; border-radius: 4px;">${t.successful.toUpperCase()}</span>
                            </div>
                          `,
                          icon: 'success',
                          confirmButtonText: t.close,
                          customClass: { 
                            popup: 'rounded-2xl overflow-hidden !p-0', htmlContainer: '!p-0 !m-0', title: '!pt-6', actions: 'w-full !m-0 !p-0 border-t border-gray-100', confirmButton: 'w-full bg-ios-blue hover:bg-blue-600 text-white font-bold py-4 rounded-none transition-colors !m-0 border-none outline-none focus:outline-none focus:ring-0'
                          }
                        });
                      }}
                      className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-3 w-2/3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        </div>
                        <div className="overflow-hidden w-full">
                          <p className="text-xs font-mono text-ios-darkText font-bold truncate">{tx.wallet.substring(0, 8)}...{tx.wallet.substring(tx.wallet.length - 8)}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5 truncate">{tx.date}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0">
                        <span className="text-sm font-bold text-ios-darkText">{tx.amount.toFixed(2)} XLM</span>
                        <span className="text-[10px] font-bold text-green-500 bg-green-50 px-2 py-0.5 rounded-full uppercase mt-1">{t.successful}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
                <div className="flex justify-center items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                  <button onClick={() => setAllTxPage(p => Math.max(1, p - 1))} disabled={allTxPage === 1} className="p-1 rounded-full text-gray-400 hover:text-ios-blue disabled:opacity-30 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                  </button>
                  <span className="text-xs font-bold text-ios-darkGray">{allTxPage} / {totalAllTxPages}</span>
                  <button onClick={() => setAllTxPage(p => Math.min(totalAllTxPages, p + 1))} disabled={allTxPage === totalAllTxPages} className="p-1 rounded-full text-gray-400 hover:text-ios-blue disabled:opacity-30 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </button>
                </div>
            </div>

            {/* All Claim Rewards (Transparent for everyone) */}
            <div className="bg-white rounded-2xl p-6 shadow-ios border border-ios-lightGray/30 mb-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-bl-full -mr-16 -mt-16 opacity-50 pointer-events-none transition-transform group-hover:scale-110"></div>
              <h2 className="text-lg font-bold tracking-tight text-ios-darkText mb-3 flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-amber-50 flex items-center justify-center border border-amber-100">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                </div>
                {t.allClaimRewards}
              </h2>
              <div className="relative mb-4">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </div>
                <input 
                  type="text" 
                  placeholder={t.searchWallet}
                  value={claimHistorySearch}
                  onChange={(e) => setClaimHistorySearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                />
              </div>
              <div className="space-y-3">
                {currentClaims.length === 0 ? (
                  <div className="text-center py-6 text-xs text-gray-400 bg-gray-50 rounded-2xl border border-gray-100">
                    {t.noClaims}
                  </div>
                ) : (
                  currentClaims.map(claim => (
                    <div key={claim.id} onClick={() => {
                        Swal.fire({
                          title: t.claimRewardDetail,
                          html: `
                            <div style="text-align: left; font-family: monospace; font-size: 13px; padding: 0 16px 16px 16px; color: #374151; word-wrap: break-word;">
                              <strong style="color: #111827;">${t.claimId}:</strong><br/>
                              <span style="color: #4b5563; user-select: all; display: block; background: #f3f4f6; padding: 8px; border-radius: 8px; margin-top: 4px;">${claim.id}</span><br/>
                              <strong style="color: #111827;">${t.claimerAddress}:</strong><br/>
                              <span style="color: #6b7280; user-select: all; display: block; background: #f3f4f6; padding: 8px; border-radius: 8px; margin-top: 4px; font-size: 11px;">
                                <a href="${getExplorerLink(claim.address)}" target="_blank" style="color: #2563eb; text-decoration: underline;">${claim.address}</a>
                              </span><br/>
                              <strong style="color: #111827;">${t.contractSource}:</strong><br/>
                              <span style="color: #6b7280; user-select: all; display: block; background: #f3f4f6; padding: 8px; border-radius: 8px; margin-top: 4px; font-size: 11px;">
                                <a href="${getExplorerLink(claim.from)}" target="_blank" style="color: inherit; text-decoration: underline;">${claim.from}</a>
                              </span><br/>
                              <strong style="color: #111827;">${t.amountLabel}:</strong> ${claim.amount.toFixed(2)} XLM<br/><br/>
                              <strong style="color: #111827;">${t.dateLabel}:</strong> ${claim.date}<br/><br/>
                              <strong style="color: #111827;">${t.statusLabel}:</strong> <span style="color: #10b981; font-weight: bold; background: #ecfdf5; padding: 2px 6px; border-radius: 4px;">${t.approved.toUpperCase()}</span>
                            </div>
                          `,
                          icon: 'success',
                          confirmButtonText: t.close,
                          customClass: { 
                            popup: 'rounded-2xl overflow-hidden !p-0',
                            htmlContainer: '!p-0 !m-0',
                            title: '!pt-6',
                            actions: 'w-full !m-0 !p-0 border-t border-gray-100',
                            confirmButton: 'w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 rounded-none transition-colors !m-0 border-none outline-none focus:outline-none focus:ring-0'
                          }
                        });
                      }}
                      className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-3 w-2/3">
                        <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>
                        </div>
                        <div className="overflow-hidden w-full">
                          <p className="text-xs font-mono text-ios-darkText font-bold truncate">{claim.address.substring(0, 5)}...{claim.address.substring(claim.address.length - 4)}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5 truncate">{claim.date}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0">
                        <span className="text-sm font-bold text-amber-500">{claim.amount.toFixed(2)} XLM</span>
                        <div className="text-[9px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded flex items-center justify-center mt-1 uppercase tracking-wider">
                          {t.approved || 'APPROVED'}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
                <div className="flex justify-center items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                  <button onClick={() => setClaimHistoryPage(p => Math.max(1, p - 1))} disabled={claimHistoryPage === 1} className="p-1 rounded-full text-gray-400 hover:text-amber-500 disabled:opacity-30 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                  </button>
                  <span className="text-xs font-bold text-ios-darkGray">{claimHistoryPage} / {Math.max(1, totalClaimPages)}</span>
                  <button onClick={() => setClaimHistoryPage(p => Math.min(totalClaimPages, p + 1))} disabled={claimHistoryPage === totalClaimPages || totalClaimPages === 0} className="p-1 rounded-full text-gray-400 hover:text-amber-500 disabled:opacity-30 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </button>
                </div>
            </div>

            {/* Contact Provider */}
            <div className="bg-white rounded-2xl p-6 shadow-ios border border-ios-lightGray/30 text-xs text-ios-secondaryText space-y-3">
              <h3 className="font-bold text-sm text-ios-darkText">{t.contactSupport}</h3>
              <p>{t.contactSupportDesc}</p>
              <div className="flex flex-col gap-2 font-semibold">
                <a href="mailto:edwinariesto2@gmail.com" className="text-ios-blue hover:underline flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                  </div>
                  edwinariesto2@gmail.com
                </a>
                <a href="https://github.com/edwinariesto" target="_blank" rel="noopener noreferrer" className="text-ios-blue hover:underline flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200">
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
                  </div>
                  github.com/edwinariesto
                </a>
              </div>
            </div>

          </div>
        </section>
        {/* VIP Barcode Modal */}
        {showVIPBarcode && (() => {
          const isMasterWallet = userAddress === 'GCANOQWHT5YRXX2EBQXZJLFPZ5VHZWZA5ZB3FQEUU6CHDCSHXGS3QJ2O';
          const vipUserHistory = isMasterWallet ? vipHistory : vipHistory.filter(r => r.address.toLowerCase() === (userAddress || '').toLowerCase());
          const VIP_PER_PAGE = 5;
          const filteredVipHistory = vipUserHistory.filter(r => r.eventName.toLowerCase().includes(vipSearch.toLowerCase()));
          const totalVipPages = Math.max(1, Math.ceil(filteredVipHistory.length / VIP_PER_PAGE));
          const currentVipHistory = filteredVipHistory.slice((vipPage - 1) * VIP_PER_PAGE, vipPage * VIP_PER_PAGE);
          return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
              onClick={() => setShowVIPBarcode(false)}
            ></div>

            {/* Modal Content */}
            <div className="bg-gradient-to-b from-slate-900 to-black w-full max-w-md rounded-3xl shadow-2xl relative overflow-hidden border border-fuchsia-900/50 z-10 flex flex-col p-6 animate-ios-fade-in glow-fuchsia">
              <button 
                onClick={() => setShowVIPBarcode(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700 rounded-full p-2 transition-colors z-20"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-gradient-to-br from-fuchsia-400 to-purple-500 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/30 flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.956-.734L2.02 6.02a.5.5 0 0 1 .798-.518l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/></svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">{t.vipPassTitle}</h2>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{t.vipPassDesc}</p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl shadow-inner mb-4 ring-4 ring-fuchsia-500/20 relative flex flex-col items-center justify-center">
                <QRCode value={userAddress || 'StelDot-Legend'} size={200} level="H" />
                <div className="absolute bg-white rounded-lg p-1.5 shadow-sm flex items-center justify-center" style={{ width: 44, height: 44 }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#d946ef" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50 flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-bold text-fuchsia-400 mb-1">{vipUserHistory.length}</span>
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest">{t.totalVisits || 'Total Kunjungan'}</span>
                </div>
                
                <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50 flex flex-col items-center justify-center text-center overflow-hidden">
                  <span className="text-xs font-mono text-slate-300 break-all leading-tight">{userAddress ? `${userAddress.substring(0,6)}...${userAddress.substring(userAddress.length-6)}` : 'N/A'}</span>
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest mt-2">{t.vipWalletAddress || 'VIP Wallet'}</span>
                </div>
              </div>

              {/* History List */}
              <div className="flex-1 bg-slate-900/80 rounded-2xl p-4 border border-slate-800 flex flex-col overflow-hidden relative shadow-inner">
                {/* VIP Count Badge Stretched */}
                <div className="w-full mb-4 flex items-center justify-between bg-fuchsia-400/10 border border-fuchsia-400/20 rounded-lg px-3 py-2">
                   <span className="text-[10px] font-bold text-fuchsia-400 uppercase tracking-widest">{t.totalAttendance || 'Total Kehadiran'}</span>
                   {userAddress === 'GCANOQWHT5YRXX2EBQXZJLFPZ5VHZWZA5ZB3FQEUU6CHDCSHXGS3QJ2O' ? (
                     <span className="text-[10px] font-mono font-bold text-fuchsia-300">{t.globalLabel || 'Global'}: <span className="text-white">{vipHistory.length}</span> <span className="mx-1 text-fuchsia-500/50">|</span> {t.youLabel || 'Anda'}: <span className="text-white">{vipHistory.filter(r => r.address.toLowerCase() === (userAddress || '').toLowerCase()).length}</span></span>
                   ) : (
                     <span className="text-[10px] font-mono font-bold text-fuchsia-300 bg-fuchsia-400/20 px-2 py-0.5 rounded-md">{t.totalLabel || 'Total'}: <span className="text-white">{vipHistory.filter(r => r.address.toLowerCase() === (userAddress || '').toLowerCase()).length}</span></span>
                   )}
                </div>

                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-white">{t.vipHistoryTitle || 'Riwayat Kehadiran VIP'}</h3>
                  <input
                    type="text"
                    placeholder="Cari acara..."
                    value={vipSearch}
                    onChange={(e) => { setVipSearch(e.target.value); setVipPage(1); }}
                    className="bg-slate-800/80 border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-fuchsia-500/50 w-32 sm:w-40 transition-colors"
                  />
                </div>
                
                <div className="flex-1 min-h-[150px] max-h-[220px] overflow-y-auto custom-scrollbar">
                  {currentVipHistory.length > 0 ? (
                    <div className="space-y-2">
                      {currentVipHistory.map((ref, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => {
                            Swal.fire({
                              title: t.transactionDetail || 'Detail Transaksi',
                              html: `
                              <div style="text-align: left; font-family: monospace; font-size: 13px; padding: 0 16px 16px 16px; color: #374151; word-wrap: break-word;">
                                  <strong style="color: #111827;">${t.eventName || 'Nama Acara/Event'}:</strong><br/>
                                  <span style="color: #10b981; font-weight: bold; font-size: 15px;">${ref.eventName}</span><br/><br/>
                                  <strong style="color: #111827;">${t.participantWallet || 'Wallet Peserta'}:</strong><br/>
                                  <span style="color: #2563eb; user-select: all; display: block; background: #f3f4f6; padding: 8px; border-radius: 8px; margin-top: 4px;">
                                    <a href="https://stellar.expert/explorer/${networkMode.toLowerCase()}/account/${ref.address}" target="_blank" style="color: #2563eb; text-decoration: underline;">${ref.address}</a>
                                  </span><br/>
                                  <strong style="color: #111827;">${t.vipScannedBy || 'Discan oleh (Owner StelDot)'}:</strong><br/>
                                  <span style="color: #6b7280; user-select: all; display: block; background: #f3f4f6; padding: 8px; border-radius: 8px; margin-top: 4px; font-size: 11px;">
                                    <a href="https://stellar.expert/explorer/${networkMode.toLowerCase()}/account/${ref.cashier || ''}" target="_blank" style="color: inherit; text-decoration: underline;">${ref.cashier || 'N/A'}</a>
                                  </span><br/>
                                  <strong style="color: #111827;">${t.dateLabel || 'Tanggal'}:</strong> ${ref.date} ${ref.time || ''}<br/><br/>
                                  <strong style="color: #111827;">${t.statusLabel || 'Status'}:</strong> <span style="color: #10b981; font-weight: bold; background: #ecfdf5; padding: 2px 6px; border-radius: 4px;">${t.vipPresent || 'HADIR'}</span>
                                </div>
                              `,
                              icon: 'info',
                              confirmButtonText: t.close || 'Tutup'
                            });
                          }}
                          className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/50 flex justify-between items-center cursor-pointer hover:bg-slate-700/80 transition-colors"
                        >
                          <div>
                            <p className="text-xs font-mono text-fuchsia-400 tracking-wider font-bold mb-1">
                              {ref.eventName.length > 25 ? ref.eventName.substring(0, 25) + '...' : ref.eventName}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{ref.date} {ref.time || ''}</p>
                          </div>
                          <div className="flex flex-col items-end justify-center">
                            <span className="text-[9px] font-bold text-fuchsia-400 bg-fuchsia-400/10 px-2 py-1 rounded-md uppercase">{t.vipPresent || 'HADIR'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center opacity-50">
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 mb-3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                      <p className="text-xs text-slate-400 font-mono text-center max-w-[200px]">
                        {t.vipAttendanceDesc || 'Catatan seluruh kehadiran eksklusif Anda di acara StelDot.'}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex justify-center items-center gap-2 mt-3 pt-3 border-t border-slate-700/50">
                  <button onClick={() => setVipPage(p => Math.max(1, p - 1))} disabled={vipPage === 1} className="p-1 rounded-full text-slate-500 hover:text-fuchsia-400 disabled:opacity-30 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                  </button>
                  <span className="text-[10px] font-bold text-slate-400">{vipPage} / {Math.max(1, totalVipPages)}</span>
                  <button onClick={() => setVipPage(p => Math.min(totalVipPages, p + 1))} disabled={vipPage === totalVipPages || totalVipPages === 0} className="p-1 rounded-full text-slate-500 hover:text-fuchsia-400 disabled:opacity-30 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </button>
                </div>
              </div>

            </div>
          </div>
          );
        })()}

        {/* Ambassador Voucher Modal */}
        {showAmbassadorBarcode && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
              onClick={() => setShowAmbassadorBarcode(false)}
            ></div>

            <div className="bg-gradient-to-b from-slate-900 to-black w-full max-w-md rounded-3xl shadow-2xl relative overflow-hidden border border-cyan-900/50 z-10 flex flex-col p-6 animate-ios-fade-in">
              <button 
                onClick={() => setShowAmbassadorBarcode(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700 rounded-full p-2 transition-colors z-20"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30 flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">{t.ambassadorPassTitle}</h2>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{t.ambassadorPassDesc}</p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl shadow-inner mb-4 ring-4 ring-blue-500/20 relative flex flex-col items-center justify-center">
                <QRCode value={userAddress || 'StelDot-Ambassador'} size={180} level="H" />
                <div className="absolute bg-white rounded-lg p-1.5 shadow-sm flex items-center justify-center" style={{ width: 44, height: 44, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                </div>
              </div>

              <div className="w-full bg-slate-800/50 rounded-xl p-3 border border-slate-700/50 mb-4 text-center">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{t.ambassadorVoucherCode || 'Shopping Voucher Code'}</p>
                <p className="font-mono text-2xl font-bold text-cyan-300 tracking-[0.2em] mb-2">{ambassadorVoucherCode}</p>
                <button
                  onClick={handleRegisterVoucher}
                  disabled={isLoading}
                  className="text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-4 py-2 rounded-lg hover:bg-cyan-500/30 transition-colors w-full uppercase tracking-widest flex items-center justify-center gap-2 mb-3"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  {t.saveToBlockchain || 'Simpan ke Blockchain'}
                </button>
                <p className="text-[9px] text-slate-400/80 italic px-2">{t.saveVoucherInfo || '*Klik "Simpan ke Blockchain" terlebih dahulu agar kasir dapat memvalidasi kode ini.'}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50 flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-bold text-cyan-400 mb-1">{currentAmbassadorUses} / 5</span>
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest">{t.remainingUses || 'Penggunaan'}</span>
                </div>
                <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50 flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-bold text-blue-400 mb-1">2%</span>
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest">{t.ambassadorDiscount || 'Diskon'}</span>
                </div>
              </div>
              
              <div className="mb-4">
                {/* Ambassador Count Badge Stretched */}
                <div className="w-full mb-4 flex items-center justify-between bg-cyan-400/10 border border-cyan-400/20 rounded-lg px-3 py-2">
                   <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">{t.totalDiscountExecutions || 'Total Eksekusi Diskon'}</span>
                   {userAddress === 'GCANOQWHT5YRXX2EBQXZJLFPZ5VHZWZA5ZB3FQEUU6CHDCSHXGS3QJ2O' ? (
                     <span className="text-[10px] font-mono font-bold text-cyan-300">{t.globalLabel || 'Global'}: <span className="text-white">{ambassadorHistory.length}</span> <span className="mx-1 text-cyan-500/50">|</span> {t.youLabel || 'Anda'}: <span className="text-white">{ambassadorHistory.filter(r => r.address.toLowerCase() === (userAddress || '').toLowerCase()).length}</span></span>
                   ) : (
                     <span className="text-[10px] font-mono font-bold text-cyan-300 bg-cyan-400/20 px-2 py-0.5 rounded-md">{t.totalLabel || 'Total'}: <span className="text-white">{ambassadorHistory.filter(r => r.address.toLowerCase() === (userAddress || '').toLowerCase()).length}</span></span>
                   )}
                </div>

                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-bold text-slate-200">{t.discountHistoryTitle || 'Riwayat Penggunaan Diskon'}</h3>
                  <input
                    type="text"
                    placeholder="Search address..."
                    value={ambassadorSearch}
                    onChange={(e) => { setAmbassadorSearch(e.target.value); setAmbassadorPage(1); }}
                    className="bg-slate-800/80 border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-cyan-500/50 w-32 sm:w-40 transition-colors"
                  />
                </div>
                <div className="flex-1 min-h-[150px] max-h-[220px] overflow-y-auto custom-scrollbar">
                  {currentAmbassadors.length > 0 ? (
                    <div className="space-y-2">
                      {currentAmbassadors.map((ref, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => {
                            Swal.fire({
                              title: t.transactionDetail || 'Detail Transaksi',
                              html: `
                                <div style="text-align: left; font-family: monospace; font-size: 13px; padding: 0 16px 16px 16px; color: #374151; word-wrap: break-word;">
                                  <strong style="color: #111827;">${t.contractSource || 'Sumber Kontrak'}:</strong><br/>
                                  <span style="color: #6b7280; user-select: all; display: block; background: #f3f4f6; padding: 8px; border-radius: 8px; margin-top: 4px; font-size: 11px;">
                                    <a href="https://stellar.expert/explorer/${networkMode.toLowerCase()}/contract/${contractId}" target="_blank" style="color: inherit; text-decoration: underline;">${contractId}</a>
                                  </span><br/>
                                  <strong style="color: #111827;">${ref.type === 'REGISTER' ? 'Wallet (Pendaftar)' : (t.targetAddress || 'Wallet (Pengguna)')}:</strong><br/>
                                  <span style="color: #2563eb; user-select: all; display: block; background: #f3f4f6; padding: 8px; border-radius: 8px; margin-top: 4px;">
                                    <a href="https://stellar.expert/explorer/${networkMode.toLowerCase()}/account/${ref.address}" target="_blank" style="color: #2563eb; text-decoration: underline;">${ref.address}</a>
                                  </span><br/>
                                  ${ref.type === 'REGISTER' ? `<strong style="color: #111827;">${t.ambassadorVoucherCode || 'Voucher Code'}:</strong><br/><span style="color: #10b981; font-weight: bold; font-size: 16px;">${ref.code}</span><br/><br/>` : ''}
                                  ${ref.hash ? `<strong style="color: #111827;">Transaction Hash:</strong><br/>
                                  <span style="color: #2563eb; user-select: all; display: block; background: #f3f4f6; padding: 8px; border-radius: 8px; margin-top: 4px; font-size: 11px;">
                                    <a href="https://stellar.expert/explorer/${networkMode.toLowerCase()}/tx/${ref.hash}" target="_blank" style="color: #2563eb; text-decoration: underline;">${ref.hash}</a>
                                  </span><br/>` : ''}
                                  ${ref.type !== 'REGISTER' ? `<strong style="color: #111827;">${t.originalAmount || 'Nominal Asli'}:</strong> ${ref.originalAmount.toFixed(2)} XLM<br/>
                                  <strong style="color: #111827;">${t.discountAmount || 'Potongan'}:</strong> -${(ref.originalAmount - ref.discountedAmount).toFixed(2)} XLM<br/>
                                  <strong style="color: #111827;">${t.totalPay || 'Harga Bayar'}:</strong> ${ref.discountedAmount.toFixed(2)} XLM<br/><br/>` : ''}
                                  ${ref.type !== 'REGISTER' ? `<strong style="color: #111827;">${t.cashierWallet || 'Dompet Kasir'}:</strong><br/>
                                  <span style="color: #6b7280; user-select: all; display: block; background: #f3f4f6; padding: 8px; border-radius: 8px; margin-top: 4px; font-size: 11px;">
                                    <a href="https://stellar.expert/explorer/${networkMode.toLowerCase()}/account/${ref.cashier || ''}" target="_blank" style="color: inherit; text-decoration: underline;">${ref.cashier || 'N/A'}</a>
                                  </span><br/>` : ''}
                                  <strong style="color: #111827;">${t.dateLabel || 'Tanggal'}:</strong> ${ref.date} ${ref.time || ''}<br/><br/>
                                  <strong style="color: #111827;">${t.statusLabel || 'Status'}:</strong> <span style="color: #10b981; font-weight: bold; background: #ecfdf5; padding: 2px 6px; border-radius: 4px;">${ref.type === 'REGISTER' ? 'TERDAFTAR' : (t.successful ? t.successful.toUpperCase() : 'SUKSES')}</span>
                                </div>
                              `,
                              icon: 'info',
                              confirmButtonText: t.close || 'Tutup'
                            });
                          }}
                          className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/50 flex justify-between items-center cursor-pointer hover:bg-slate-700/80 transition-colors"
                        >
                          <div>
                            {ref.type === 'REGISTER' ? (
                              <p className="text-xs font-mono text-blue-400 tracking-wider">Register: <span className="font-bold text-white">{ref.code}</span></p>
                            ) : ref.code ? (
                              <p className="text-xs font-mono text-cyan-300 tracking-wider">Voucher: <span className="font-bold text-white">{ref.code}</span></p>
                            ) : (
                              <p className="text-xs font-mono text-slate-300">{ref.address.substring(0, 8)}...{ref.address.substring(ref.address.length - 8)}</p>
                            )}
                            <p className="text-[10px] text-slate-500 mt-0.5">{ref.date} {ref.time || ''}</p>
                          </div>
                          <div className="flex flex-col items-end justify-center">
                            {ref.type === 'REGISTER' ? (
                              <span className="text-[9px] font-bold text-blue-400 bg-blue-400/10 px-2 py-1 rounded-md uppercase">TERDAFTAR</span>
                            ) : (
                              <>
                                <span className="text-[10px] font-bold text-cyan-400 mb-0.5"><span className="line-through text-slate-500 mr-1">{ref.originalAmount.toFixed(2)}</span>{ref.discountedAmount.toFixed(2)} XLM</span>
                                <span className="text-[9px] font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded-md uppercase">+ {t.successful || 'Sukses'}</span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[120px] text-center p-6 bg-slate-800/30 rounded-xl border border-slate-700/30 border-dashed">
                      <p className="text-sm text-slate-500">{t.noDiscountHistory || 'Belum ada riwayat penggunaan diskon.'}</p>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-center items-center gap-2 mt-3 pt-3 border-t border-slate-700/50">
                  <button onClick={() => setAmbassadorPage(p => Math.max(1, p - 1))} disabled={ambassadorPage === 1} className="p-1 rounded-full text-slate-500 hover:text-cyan-400 disabled:opacity-30 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                  </button>
                  <span className="text-[10px] font-bold text-slate-400">{ambassadorPage} / {Math.max(1, totalAmbassadorPages)}</span>
                  <button onClick={() => setAmbassadorPage(p => Math.min(totalAmbassadorPages, p + 1))} disabled={ambassadorPage === totalAmbassadorPages || totalAmbassadorPages === 0} className="p-1 rounded-full text-slate-500 hover:text-cyan-400 disabled:opacity-30 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Simulate Discount Form Modal */}
        {showSimulateForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
              onClick={() => setShowSimulateForm(false)}
            ></div>

            <div className="bg-gradient-to-b from-slate-900 to-black w-full max-w-sm rounded-3xl shadow-2xl relative overflow-hidden border border-cyan-900/50 z-10 flex flex-col p-6 animate-ios-fade-in">
              <button 
                onClick={() => setShowSimulateForm(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700 rounded-full p-2 transition-colors z-20"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>

              <h2 className="text-xl font-bold text-white mb-4">{t.scannerCenterTitle || 'Scanner Center'}</h2>

              {/* iOS Style Segmented Control */}
              <div className="flex bg-slate-800/80 p-1 rounded-xl mb-6 border border-slate-700">
                <button
                  onClick={() => setScannerActiveTab('voucher')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${scannerActiveTab === 'voucher' ? 'bg-cyan-500/20 text-cyan-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {t.scanVoucherTab || 'Scan Voucher'}
                </button>
                <button
                  onClick={() => setScannerActiveTab('event')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${scannerActiveTab === 'event' ? 'bg-fuchsia-500/20 text-fuchsia-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {t.scanEventTab || 'Scan Event'}
                </button>
              </div>

              {scannerActiveTab === 'voucher' ? (
                <>
                  <p className="text-[11px] text-slate-400 mb-6 leading-relaxed pr-6">
                    {t.simulateDesc || 'Masukkan alamat dompet dan nominal untuk mensimulasikan potongan 2%. Maksimal 5 kali penggunaan per dompet.'}
                  </p>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1.5 block">{t.targetAddress || 'Alamat Target'}</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={ambassadorTarget}
                      onChange={(e) => setAmbassadorTarget(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 pl-4 pr-12 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
                      placeholder="G..."
                    />
                    <button 
                      onClick={() => setIsScanning(true)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-cyan-400 hover:bg-cyan-900/30 rounded-lg transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1.5 block">{t.amount || 'Nominal'} (XLM)</label>
                  <input 
                    type="number" 
                    value={ambassadorAmount}
                    onChange={(e) => setAmbassadorAmount(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
                    placeholder="0.00"
                    min="0"
                    step="0.1"
                  />
                </div>
                
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1.5 block">{t.ambassadorVoucherCode || 'Shopping Voucher Code'}</label>
                  <input 
                    type="text" 
                    value={simulateVoucherCode}
                    onChange={(e) => setSimulateVoucherCode(e.target.value.toUpperCase())}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors uppercase font-mono tracking-widest"
                    placeholder="XXXXX"
                  />
                </div>

                <div className="bg-cyan-900/20 border border-cyan-800/50 rounded-xl p-4 flex justify-between items-center">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-0.5">{t.totalPay || 'Total Bayar'}</p>
                    <p className="text-xl font-bold text-cyan-400">
                      {ambassadorAmount && !isNaN(parseFloat(ambassadorAmount)) && parseFloat(ambassadorAmount) > 0 
                        ? (parseFloat(ambassadorAmount) * 0.98).toFixed(2) 
                        : '0.00'} XLM
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-0.5">{t.discountAmount || 'Potongan (2%)'}</p>
                    <p className="text-sm font-bold text-green-400">
                      {ambassadorAmount && !isNaN(parseFloat(ambassadorAmount)) && parseFloat(ambassadorAmount) > 0 
                        ? (parseFloat(ambassadorAmount) * 0.02).toFixed(2) 
                        : '0.00'} XLM
                    </p>
                  </div>
                </div>
              </div>

                  <button 
                    onClick={handleProcessDiscount}
                    disabled={!ambassadorTarget || !ambassadorAmount || isNaN(parseFloat(ambassadorAmount)) || parseFloat(ambassadorAmount) <= 0 || !simulateVoucherCode}
                    className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-3.5 rounded-xl hover:shadow-lg hover:shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t.simulateDiscount || 'Eksekusi Diskon'}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-[11px] text-slate-400 mb-6 leading-relaxed pr-6">
                    {t.vipOnlyOwner || '*Pemindaian dan verifikasi tiket VIP ini hanya dapat dilakukan secara eksklusif oleh Pemilik Utama StelDot.'}
                    <br/><br/>
                    <span className="text-fuchsia-400 font-bold">{t.vipScanInstruction || 'Pindai atau masukkan alamat wallet peserta untuk memverifikasi kehadiran VIP. Peserta wajib memiliki akumulasi donasi minimal 500 XLM.'}</span>
                  </p>

                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="text-xs font-bold text-slate-300 mb-1.5 block">{t.participantWalletLabel || 'Wallet Peserta VIP'}</label>
                      <div className="relative">
                        <input 
                          type="text" 
                          value={ambassadorTarget}
                          onChange={(e) => setAmbassadorTarget(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 pl-4 pr-12 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500/50 transition-colors"
                          placeholder="G..."
                        />
                        <button 
                          onClick={() => setIsScanning(true)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-fuchsia-400 hover:bg-fuchsia-900/30 rounded-lg transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-300 mb-1.5 block">{t.eventName || 'Nama Acara/Event'}</label>
                      <input 
                        type="text" 
                        value={vipEventName}
                        onChange={(e) => setVipEventName(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500/50 transition-colors"
                        placeholder={t.eventNamePlaceholder || 'Contoh: StelDot Web3 Summit 2026'}
                      />
                    </div>
                  </div>

                  {ambassadorTarget && ambassadorTarget.length === 56 && (
                    <div className={`mb-4 p-3 rounded-xl border flex items-center justify-between ${targetVipTotalDonated >= 500 ? 'bg-fuchsia-900/20 border-fuchsia-500/30' : 'bg-red-900/20 border-red-500/30'}`}>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest">{t.totalDonated || 'Total Donasi'}</p>
                        {isCheckingVip ? (
                          <div className="h-6 flex items-center">
                            <div className="w-4 h-4 border-2 border-slate-500 border-t-fuchsia-400 rounded-full animate-spin"></div>
                          </div>
                        ) : (
                          <p className={`font-mono text-lg font-bold ${targetVipTotalDonated >= 500 ? 'text-fuchsia-400' : 'text-red-400'}`}>
                            {targetVipTotalDonated.toFixed(2)} XLM
                          </p>
                        )}
                      </div>
                      {!isCheckingVip && (
                        <div className="text-right">
                          {targetVipTotalDonated >= 500 ? (
                            <span className="text-[10px] font-bold text-fuchsia-400 bg-fuchsia-400/10 px-2 py-1 rounded-md uppercase">{t.legendValid || 'Legend Valid'}</span>
                          ) : (
                            <span className="text-[10px] font-bold text-red-400 bg-red-400/10 px-2 py-1 rounded-md uppercase">{t.legendNotValid || 'Belum Legend'}</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <button 
                    onClick={handleProcessVipEntry}
                    disabled={!ambassadorTarget || !vipEventName || isCheckingVip || targetVipTotalDonated < 500}
                    className="w-full bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white font-bold py-3.5 rounded-xl hover:shadow-lg hover:shadow-fuchsia-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCheckingVip ? (t.verifying || 'Memverifikasi...') : (t.simulateVipEntry || 'Proses Kehadiran VIP')}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {isScanning && (
          <QRScannerComponent 
            onScan={(text) => {
              setAmbassadorTarget(text);
              setIsScanning(false);
            }} 
            onClose={() => setIsScanning(false)} 
          />
        )}

        {/* Helping Angel Referral Modal */}
        {showAngelReferral && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
              onClick={() => setShowAngelReferral(false)}
            ></div>

            <div className="bg-gradient-to-b from-slate-900 to-black w-full max-w-md rounded-3xl shadow-2xl relative overflow-hidden border border-fuchsia-900/50 z-10 flex flex-col p-6 animate-ios-fade-in">
              <button 
                onClick={() => setShowAngelReferral(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700 rounded-full p-2 transition-colors z-20"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-gradient-to-br from-fuchsia-400 to-purple-500 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/30 flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">{t.angelTitle}</h2>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{t.angelDesc}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50 flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-bold text-fuchsia-400 mb-1">{referralHistory.length}</span>
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest">{t.friendsInvited || 'Teman Diundang'}</span>
                </div>
                <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50 flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-bold text-purple-400 mb-1 flex items-baseline gap-1">{referralBalance.toFixed(2)} <span className="text-sm">XLM</span></span>
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest">{t.rewardEarned || 'Reward XLM'}</span>
                </div>
              </div>

              <div className="mb-4">
                {/* Angel Count Badge Stretched */}
                <div className="w-full mb-4 flex items-center justify-between bg-purple-400/10 border border-purple-400/20 rounded-lg px-3 py-2">
                   <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">{t.totalFriendsDonated || 'Total Teman Berdonasi'}</span>
                   {userAddress === 'GCANOQWHT5YRXX2EBQXZJLFPZ5VHZWZA5ZB3FQEUU6CHDCSHXGS3QJ2O' ? (
                     <span className="text-[10px] font-mono font-bold text-purple-300">{t.globalLabel || 'Global'}: <span className="text-white">{referralHistory.length}</span> <span className="mx-1 text-purple-500/50">|</span> {t.youLabel || 'Anda'}: <span className="text-white">{referralHistory.filter(r => r.referrer === userAddress).length}</span></span>
                   ) : (
                     <span className="text-[10px] font-mono font-bold text-purple-300 bg-purple-400/20 px-2 py-0.5 rounded-md">{t.totalLabel || 'Total'}: <span className="text-white">{referralHistory.length}</span></span>
                   )}
                </div>

                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-bold text-slate-200">{t.referralHistoryTitle || 'Daftar Teman Berdonasi'}</h3>
                  <input
                    type="text"
                    placeholder="Search address..."
                    value={referralSearch}
                    onChange={(e) => { setReferralSearch(e.target.value); setReferralPage(1); }}
                    className="bg-slate-800/80 border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-purple-500/50 w-32 sm:w-40 transition-colors"
                  />
                </div>
                <div className="flex-1 min-h-[150px] max-h-[220px] overflow-y-auto custom-scrollbar">
                  {currentReferrals.length > 0 ? (
                    <div className="space-y-2">
                      {currentReferrals.map((ref, idx) => (
                        <div 
                          key={idx} 
                          className="bg-slate-800/80 hover:bg-slate-700/80 cursor-pointer transition-colors rounded-xl p-3 border border-slate-700/50 flex justify-between items-center"
                          onClick={() => {
                            Swal.fire({
                              title: t.claimDetailTitle || 'Detail Transaksi',
                              html: `
                                <div style="text-align: left; font-family: monospace; font-size: 13px; padding: 0 16px 16px 16px; color: #374151; word-wrap: break-word;">
                                  ${userAddress === 'GCANOQWHT5YRXX2EBQXZJLFPZ5VHZWZA5ZB3FQEUU6CHDCSHXGS3QJ2O' ? `
                                  <strong style="color: #111827;">Referrer Wallet:</strong><br/>
                                  <span style="color: #6b7280; user-select: all; display: block; background: #f3f4f6; padding: 8px; border-radius: 8px; margin-top: 4px; font-size: 11px;">
                                    <a href="${getExplorerLink(ref.referrer)}" target="_blank" style="color: #2563eb; text-decoration: underline;">${ref.referrer}</a>
                                  </span><br/>
                                  ` : ''}
                                  <strong style="color: #111827;">Teman (Donor):</strong><br/>
                                  <span style="color: #6b7280; user-select: all; display: block; background: #f3f4f6; padding: 8px; border-radius: 8px; margin-top: 4px; font-size: 11px;">
                                    <a href="${getExplorerLink(ref.donorAddress)}" target="_blank" style="color: #2563eb; text-decoration: underline;">${ref.donorAddress}</a>
                                  </span><br/>
                                  <strong style="color: #111827;">Jumlah Donasi (XLM):</strong> ${ref.amount.toFixed(2)} XLM<br/><br/>
                                  <strong style="color: #111827;">Tanggal:</strong> ${ref.date}<br/><br/>
                                  <strong style="color: #111827;">Status:</strong> <span style="color: #10b981; font-weight: bold; background: #ecfdf5; padding: 2px 6px; border-radius: 4px;">SUKSES</span>
                                </div>
                              `,
                              icon: 'info',
                              confirmButtonText: t.close || 'Tutup',
                              customClass: { 
                                popup: 'rounded-2xl overflow-hidden !p-0',
                                htmlContainer: '!p-0 !m-0',
                                title: '!pt-6',
                                actions: 'w-full !m-0 !p-0 border-t border-gray-100',
                                confirmButton: 'w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 rounded-none transition-colors !m-0 border-none outline-none focus:outline-none focus:ring-0'
                              }
                            });
                          }}
                        >
                          <div>
                            <p className="text-xs font-mono text-slate-300">{ref.donorAddress.substring(0, 8)}...{ref.donorAddress.substring(48)}</p>
                            {userAddress === 'GCANOQWHT5YRXX2EBQXZJLFPZ5VHZWZA5ZB3FQEUU6CHDCSHXGS3QJ2O' && (
                              <p className="text-[9px] font-mono text-fuchsia-400 mt-0.5">Ref: {ref.referrer.substring(0, 6)}...{ref.referrer.substring(50)}</p>
                            )}
                            <p className="text-[10px] text-slate-500 mt-0.5">{ref.date}</p>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] font-bold text-fuchsia-400 mb-0.5">{ref.amount.toFixed(2)} XLM</span>
                            <span className="text-[9px] font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded-md">+ Sukses</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[120px] text-center p-6 bg-slate-800/30 rounded-xl border border-slate-700/30 border-dashed">
                      <p className="text-sm text-slate-500">{t.noReferralHistory || 'Belum ada teman yang berdonasi menggunakan link Anda.'}</p>
                    </div>
                  )}
                </div>
                {totalReferralPages > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-3 pt-3 border-t border-slate-700/50">
                    <button onClick={() => setReferralPage(p => Math.max(1, p - 1))} disabled={referralPage === 1} className="p-1 rounded-full text-slate-500 hover:text-fuchsia-400 disabled:opacity-30 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </button>
                    <span className="text-[10px] font-bold text-slate-400">{referralPage} / {Math.max(1, totalReferralPages)}</span>
                    <button onClick={() => setReferralPage(p => Math.min(totalReferralPages, p + 1))} disabled={referralPage === totalReferralPages || totalReferralPages === 0} className="p-1 rounded-full text-slate-500 hover:text-fuchsia-400 disabled:opacity-30 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-black/50 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
                <div className="text-xs font-mono text-slate-300 truncate flex-1 opacity-80 select-all">
                  {window.location.origin}/?ref={userAddress ? userAddress.substring(0, 8) + '...' + userAddress.substring(userAddress.length - 8) : ''}
                </div>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/?ref=${userAddress}`);
                    Swal.fire({ title: t.linkCopied, icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, background: '#1f2937', color: '#fff' });
                  }}
                  className="bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-400 hover:to-purple-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-lg shadow-purple-500/20 whitespace-nowrap active:scale-95"
                >
                  {t.copyLink}
                </button>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* Update Campaign Modal */}
      {editingCampaign && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] my-8 animate-fade-in">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur z-10 rounded-t-2xl">
              <h2 className="text-xl font-bold text-ios-darkText">{t.updateCampaign || 'Update Campaign'}</h2>
              <button onClick={() => setEditingCampaign(null)} className="text-gray-400 hover:text-gray-600 transition-colors bg-gray-100 hover:bg-gray-200 rounded-full p-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar">
              <form id="update-campaign-form" onSubmit={submitUpdateCampaign} className="space-y-5">
                <div>
                  <label className="text-[11px] font-bold text-ios-darkGray block mb-1">{t.title}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      </div>
                    </div>
                    <input type="text" value={editingCampaign.title} onChange={(e) => setEditingCampaign({ ...editingCampaign, title: e.target.value })} className="w-full bg-[#F2F2F7] border border-ios-lightGray/40 rounded-xl pl-11 pr-4 py-2.5 text-sm outline-none focus:border-ios-blue transition-all" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-ios-darkGray block mb-1">{t.description}</label>
                  <div className="relative">
                    <div className="absolute top-2.5 left-0 pl-3 flex items-start pointer-events-none">
                      <div className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7"></path></svg>
                      </div>
                    </div>
                    <textarea value={editingCampaign.description} onChange={(e) => setEditingCampaign({ ...editingCampaign, description: e.target.value })} rows="5" className="w-full bg-[#F2F2F7] border border-ios-lightGray/40 rounded-xl pl-11 pr-4 py-2.5 text-sm outline-none focus:border-ios-blue transition-all"></textarea>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-ios-darkGray block mb-1">{t.goalTarget}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      </div>
                    </div>
                    <input type="number" value={editingCampaign.target} onChange={(e) => setEditingCampaign({ ...editingCampaign, target: e.target.value })} className="w-full bg-[#F2F2F7] border border-ios-lightGray/40 rounded-xl pl-11 pr-4 py-2.5 text-sm outline-none focus:border-ios-blue transition-all" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-ios-darkGray block mb-1">{t.youtubeLink || 'YouTube Link'}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
                      </div>
                    </div>
                    <input type="url" value={editingCampaign.youtube_link || ''} onChange={(e) => setEditingCampaign({ ...editingCampaign, youtube_link: e.target.value })} className="w-full bg-[#F2F2F7] border border-ios-lightGray/40 rounded-xl pl-11 pr-4 py-2.5 text-sm outline-none focus:border-ios-blue transition-all" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-ios-darkGray block mb-1">{t.clientWallet || 'Client Wallet'}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
                      </div>
                    </div>
                    <input type="text" value={editingCampaign.client_wallet || ''} onChange={(e) => setEditingCampaign({ ...editingCampaign, client_wallet: e.target.value })} className="w-full bg-[#F2F2F7] border border-ios-lightGray/40 rounded-xl pl-11 pr-4 py-2.5 text-sm outline-none focus:border-ios-blue transition-all" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-ios-darkGray block mb-1">{t.expirationDate || 'Expiration Date'}</label>
                  <div className="relative z-50">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                      <div className="w-6 h-6 rounded-full bg-gray-500/10 flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                      </div>
                    </div>
                    <CustomDatePicker 
                      selectedDate={editingCampaign.expirationDateStr}
                      onChange={(e) => setEditingCampaign({ ...editingCampaign, expirationDateStr: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <input type="checkbox" id="edit-active" checked={editingCampaign.active} onChange={(e) => setEditingCampaign({ ...editingCampaign, active: e.target.checked })} className="w-5 h-5 accent-ios-blue rounded border-gray-300 focus:ring-ios-blue cursor-pointer" />
                  <label htmlFor="edit-active" className="text-sm font-bold text-ios-darkText cursor-pointer">{t.setAsActive || 'Set as Active Campaign'}</label>
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-end gap-3 sticky bottom-0">
              <button type="button" onClick={() => setEditingCampaign(null)} className="px-6 py-2.5 rounded-xl font-bold text-ios-darkGray bg-white border border-gray-200 hover:bg-gray-50 transition-colors">
                {t.closeBtn || 'Close'}
              </button>
              <button form="update-campaign-form" type="submit" disabled={isLoading} className="px-6 py-2.5 rounded-xl font-bold text-white bg-ios-blue hover:bg-blue-600 transition-colors shadow-md disabled:opacity-50">
                {isLoading ? t.processing || 'Processing...' : t.updateCampaign || 'Update Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Details Modal */}
      {selectedCampaign && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-ios-darkText">{selectedCampaign.title}</h2>
              <button onClick={() => { setSelectedCampaign(null); setTransferAmount(''); }} className="text-gray-400 hover:text-gray-600 transition-colors bg-gray-100 rounded-full p-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {selectedCampaign.youtube_link && (() => {
                const match = selectedCampaign.youtube_link.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
                const videoId = match ? match[1] : null;
                if (!videoId) return null;
                return (
                  <div className="w-full aspect-video bg-black rounded-xl overflow-hidden mb-6 shadow-md">
                    <iframe 
                      className="w-full h-full" 
                      src={`https://www.youtube.com/embed/${videoId}?autoplay=0`} 
                      title="YouTube video player" 
                      frameBorder="0" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                      allowFullScreen
                    ></iframe>
                  </div>
                );
              })()}

              <div className="mb-6 space-y-4">
                <p className="text-sm text-ios-secondaryText whitespace-pre-wrap leading-relaxed">{selectedCampaign.description}</p>
                
                <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                  <span className="bg-blue-50 text-ios-blue px-3 py-1 rounded-lg border border-blue-100">ID: {selectedCampaign.id}</span>
                  {!selectedCampaign.active && <span className="bg-red-50 text-red-600 px-3 py-1 rounded-lg border border-red-200">{t.inactive || 'Inactive'}</span>}
                  {selectedCampaign.expiration > 0 && (
                    <span className={`px-3 py-1 rounded-lg border flex items-center gap-1 ${(Date.now()/1000) > selectedCampaign.expiration ? 'bg-red-50 border-red-200 text-red-600' : 'bg-purple-50 border-purple-200 text-purple-600'}`}>
                      <svg className="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      {(Date.now()/1000) > selectedCampaign.expiration
                        ? t.campaignFinished
                        : `${t.remaining} ${Math.ceil((selectedCampaign.expiration - (Date.now()/1000)) / (60 * 60 * 24))} ${t.daysRemaining}`}
                    </span>
                  )}
                  {selectedCampaign.client_wallet && isOwner && (
                    <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg border border-gray-200 break-all">
                      Wallet: {selectedCampaign.client_wallet}
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 mb-6">
                <div className="flex justify-between text-xs text-ios-darkGray font-semibold mb-2">
                  <span>{t.raisedLabel} {selectedCampaign.raised.toFixed(2)} XLM</span>
                  <span>{t.target} {selectedCampaign.target.toFixed(2)} XLM</span>
                </div>
                <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden mb-4">
                  <div 
                    className="bg-gradient-to-r from-ios-blue to-ios-green h-full rounded-full" 
                    style={{ width: `${selectedCampaign.target > 0 ? Math.min((selectedCampaign.raised / selectedCampaign.target) * 100, 100) : 0}%` }}
                  ></div>
                </div>

                <div className="flex justify-between text-xs text-ios-darkGray font-semibold mb-2 pt-2 border-t border-gray-200">
                  <span>{t.transferredToClient || 'Transferred to Client'}</span>
                  <span className="text-ios-blue">{selectedCampaign.funds_transferred.toFixed(2)} / {selectedCampaign.raised.toFixed(2)} XLM</span>
                </div>
                <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-blue-500 h-full rounded-full" 
                    style={{ width: `${selectedCampaign.raised > 0 ? Math.min((selectedCampaign.funds_transferred / selectedCampaign.raised) * 100, 100) : 0}%` }}
                  ></div>
                </div>
              </div>

              {isOwner && selectedCampaign.client_wallet && (
                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-5 mb-2">
                  <h3 className="text-sm font-bold text-ios-darkText mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-ios-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                    {t.transferToClient || 'Transfer to Client'}
                  </h3>
                  <div className="flex gap-3">
                    <div className="relative flex-grow">
                      <input 
                        type="number" 
                        min="0.1" 
                        step="0.1"
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(e.target.value)}
                        placeholder={t.transferAmount || "Amount (XLM)"}
                        className="w-full bg-white border border-blue-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-ios-blue transition-all font-semibold"
                      />
                    </div>
                    <button 
                      onClick={() => handleTransferToClient(selectedCampaign)}
                      disabled={isLoading}
                      className="bg-ios-blue hover:bg-blue-600 text-white font-bold px-6 py-2.5 rounded-xl shadow-md disabled:opacity-50 transition-all flex-shrink-0"
                    >
                      {t.sendFunds || 'Send Funds'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Certificate Modal */}
      {showCertificate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-3xl flex flex-col items-center my-auto">
            {/* Modal Actions */}
            <div className="w-full flex justify-end gap-2 mb-4">
              <button 
                onClick={handleDownloadCertificate}
                disabled={isDownloadingCert}
                className="bg-white hover:bg-gray-100 text-ios-blue font-bold px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg disabled:opacity-50"
              >
                {isDownloadingCert ? <span className="spinner w-4 h-4 border-2 border-ios-blue"></span> : <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>}
                {t.downloadCert}
              </button>
              <button 
                onClick={() => setShowCertificate(false)}
                className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-xl backdrop-blur-md"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Certificate DOM to Capture */}
            <div 
              id="certificate-node" 
              className="bg-white w-full max-w-[450px] rounded-none sm:rounded-xl shadow-2xl relative overflow-hidden"
              style={{
                aspectRatio: '1 / 1.414',
                padding: '30px',
                background: '#fff url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23f3f4f6\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")'
              }}
            >
              {/* Border */}
              <div className="absolute inset-4 sm:inset-5 border-4 border-double border-amber-300 rounded-lg pointer-events-none"></div>
              <div className="absolute inset-[22px] sm:inset-[26px] border border-amber-200/50 rounded pointer-events-none"></div>

              {/* Content - Portrait Centered */}
              <div className="relative h-full flex flex-col items-center justify-between text-center p-6 z-10 bg-white/90 backdrop-blur-sm rounded-xl overflow-hidden">
                
                {/* Watermark */}
                <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none z-[-1]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="250" height="250" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                </div>

                <div className="flex flex-col items-center w-full mt-4">
                  {/* Logo Area */}
                  <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-orange-500/20 border-4 border-white">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                  </div>
                  
                  <h1 className="text-2xl sm:text-3xl font-serif font-bold text-amber-600 mb-2 uppercase tracking-widest">
                    {t.certTitle}
                  </h1>
                  
                  <div className="w-16 border-t-2 border-amber-300 my-4"></div>
                </div>

                <div className="flex flex-col items-center w-full my-auto">
                  <p className="text-sm text-gray-500 italic mb-4 font-serif">
                    {t.certPresentedTo}
                  </p>
                  
                  <div className="w-full max-w-[280px] border-b-2 border-gray-300 pb-2 mb-6">
                    <h2 className="text-lg font-mono font-bold text-gray-900 break-all leading-tight">
                      {userAddress}
                    </h2>
                  </div>
                  
                  <p className="text-xs sm:text-sm text-gray-600 max-w-[280px] leading-relaxed">
                    {t.certDesc}
                  </p>
                </div>

                <div className="flex flex-col items-center w-full mt-auto mb-4">
                  <div className="w-32 border-b border-gray-400 pb-2 mb-2 flex justify-center">
                    <span className="font-serif italic text-gray-800 font-bold block signature-font text-lg">StelDot</span>
                  </div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest mb-3">Verified Issuer</span>
                  
                  <span className="text-[10px] text-gray-400 block mb-1">DATE ISSUED</span>
                  <span className="font-mono text-[10px] text-gray-600 font-bold">{new Date().toLocaleDateString()}</span>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

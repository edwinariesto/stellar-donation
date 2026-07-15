import {
  rpc,
  Contract,
  nativeToScVal,
  scValToNative,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  Address,
  xdr,
  Account,
  Operation,
  Asset,
  Memo
} from '@stellar/stellar-sdk';
import { 
  StellarWalletsKit, 
  Networks as WalletNetwork
} from '@creit.tech/stellar-wallets-kit';
import { FreighterModule } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { WalletConnectModule } from '@creit.tech/stellar-wallets-kit/modules/wallet-connect';
import { requestAccess, setAllowed, isConnected, getAddress as freighterGetAddress, signTransaction as freighterSignTransaction } from '@stellar/freighter-api';

export const NETWORKS = {
  TESTNET: {
    rpc: 'https://soroban-testnet.stellar.org',
    horizon: 'https://horizon-testnet.stellar.org',
    passphrase: Networks.TESTNET,
    networkName: 'TESTNET'
  },
  PUBLIC: {
    rpc: 'https://soroban-rpc.mainnet.stellar.gateway.fm',
    horizon: 'https://horizon.stellar.org',
    passphrase: Networks.PUBLIC,
    networkName: 'PUBLIC'
  }
};

export let currentNetwork = NETWORKS.TESTNET;
export let rpcServer = new rpc.Server(currentNetwork.rpc);

export function setAppNetwork(networkType) {
  if (NETWORKS[networkType]) {
    currentNetwork = NETWORKS[networkType];
    rpcServer = new rpc.Server(currentNetwork.rpc);
  }
}

const freighter = new FreighterModule();
const wc = new WalletConnectModule({
  projectId: 'ccb6f24ee282461976ae9ec6f70388c6',
  metadata: {
    name: 'StelDot Donation',
    description: 'Decentralized Donate-to-Earn Platform on Stellar',
    url: window.location.origin,
    icons: [window.location.origin + '/favicon.svg']
  },
  allowedChains: ['stellar:pubnet', 'stellar:testnet']
});

function getActiveModule(walletType) {
  if (walletType === 'wallet_connect' || walletType === 'walletConnect') {
    return wc;
  }
  return freighter;
}

export async function checkFreighterNetwork() {
  return currentNetwork.networkName;
}

export async function checkWalletInstalled() {
  return true;
}

export async function connectWallet(walletType) {
  return new Promise(async (resolve, reject) => {
    try {
      if (walletType === 'freighter') {
        if (typeof window !== 'undefined' && window.freighter) {
          if (typeof window.freighter.getPublicKey === 'function') {
            try {
              let pubKey = await window.freighter.getPublicKey();
              if (pubKey) return resolve(typeof pubKey === 'string' ? pubKey : (pubKey.publicKey || pubKey.address));
            } catch(e) {}
          }
          if (typeof window.freighter.getAddress === 'function') {
            try {
              let pubKey = await window.freighter.getAddress();
              if (pubKey && !pubKey.error) return resolve(typeof pubKey === 'string' ? pubKey : (pubKey.address || pubKey.publicKey));
            } catch(e) {}
          }
        }
        
        const connected = await isConnected();
        if (!connected || !connected.isConnected) return reject(new Error("Freighter not detected"));
        
        let access = await requestAccess();
        if (access && access.error) return reject(new Error(access.error));
        
        let pubKey = await freighterGetAddress();
        if (pubKey && pubKey.error) return reject(new Error(pubKey.error));
        
        return resolve(pubKey.address || pubKey);
      }
      
      const module = getActiveModule(walletType);
      module.getAddress()
        .then((res) => resolve(res.address || res))
        .catch(reject);
    } catch (e) {
      reject(e);
    }
  });
}

export async function getWalletPublicKey() {
  try {
    const walletType = sessionStorage.getItem('steldot_wallet_type') || 'freighter';
    if (walletType === 'freighter') {
      if (typeof window !== 'undefined' && window.freighter) {
        if (typeof window.freighter.getPublicKey === 'function') {
          try {
            let pubKey = await window.freighter.getPublicKey();
            if (pubKey) return typeof pubKey === 'string' ? pubKey : (pubKey.publicKey || pubKey.address);
          } catch(e) {}
        }
        if (typeof window.freighter.getAddress === 'function') {
          try {
            let pubKey = await window.freighter.getAddress();
            if (pubKey && !pubKey.error) return typeof pubKey === 'string' ? pubKey : (pubKey.address || pubKey.publicKey);
          } catch(e) {}
        }
      }
      const pubKey = await freighterGetAddress();
      return (pubKey && !pubKey.error) ? pubKey.address || pubKey : null;
    }
    const module = getActiveModule(walletType);
    const res = await module.getAddress();
    return res.address || res;
  } catch (err) {
    return null;
  }
}

// Fetch XLM balance from Horizon
export async function getXlmBalance(address) {
  try {
    const res = await fetch(`${currentNetwork.horizon}/accounts/${address}`);
    if (!res.ok) return '0.00';
    const data = await res.json();
    const nativeAsset = data.balances.find(b => b.asset_type === 'native');
    return nativeAsset ? parseFloat(nativeAsset.balance).toFixed(2) : '0.00';
  } catch (err) {
    console.error('Error fetching balance:', err);
    return '0.00';
  }
}

// Call Read-only contract function
export const callReadOnly = async (contractId, method, args = []) => {
  let attempts = 0;
  while (attempts < 3) {
    try {
      // We use a predefined account that will execute the simulation
      // Using the hardcoded address for read-only simulations to avoid auth failures on pure views
      const mockSource = 'GCANOQWHT5YRXX2EBQXZJLFPZ5VHZWZA5ZB3FQEUU6CHDCSHXGS3QJ2O'; 
      const account = new Account(mockSource, '1');

      const contractObj = new Contract(contractId);
      let tx = new TransactionBuilder(account, { fee: '100', networkPassphrase: currentNetwork.passphrase })
        .addOperation(contractObj.call(method, ...args))
        .setTimeout(30)
        .build();

      const sim = await rpcServer.simulateTransaction(tx);
      if (!sim || !sim.result || !sim.result.retval) {
        throw new Error('Simulation failed or returned no result.');
      }
      return scValToNative(sim.result.retval);
    } catch (e) {
      attempts++;
      if (attempts >= 3) {
        console.warn(`Read-only call failed for ${method}:`, e);
        throw e;
      }
      // Wait before retrying (rate limit / intermittent RPC errors)
      await new Promise(resolve => setTimeout(resolve, 500 * attempts));
    }
  }
};

export const getReferralRewardBalance = async (contractId, userAddress) => {
  try {
    const val = await callReadOnly(contractId, 'get_referral_reward', [nativeToScVal(userAddress, { type: 'address' })]);
    return Number(val) / 10000000;
  } catch (err) {
    return 0;
  }
};

const fetchAllEventsFallback = async (contractId) => {
  let minLedger = 1;
  try {
    await rpcServer.getEvents({ startLedger: 1, filters: [], limit: 1 });
  } catch(err) {
    const match = err.message.match(/range: (\d+) - (\d+)/);
    const match2 = err.message.match(/greater than or equal to (\d+)/);
    if (match) minLedger = parseInt(match[1], 10);
    else if (match2) minLedger = parseInt(match2[1], 10);
  }
  
  try {
    const latest = await rpcServer.getLatestLedger();
    let currentEnd = latest.sequence;
    let allEvents = [];
    
    // Scan up to 60 chunks of 5000 ledgers = 300,000 ledgers (~20+ days)
    for (let i = 0; i < 60; i++) {
      const startLedger = Math.max(minLedger, currentEnd - 5000);
      let pagingToken;
      try {
        while (true) {
          const res = await rpcServer.getEvents({
            startLedger,
            filters: [{ type: 'contract', contractIds: [contractId] }],
            pagination: { cursor: pagingToken, limit: 100 }
          });
          if (!res.events || res.events.length === 0) break;
          const validEvents = res.events.filter(e => parseInt(e.ledger, 10) <= currentEnd);
          allEvents = allEvents.concat(validEvents);
          if (res.events.length < 100) break;
          pagingToken = res.events[res.events.length - 1].id;
          if (parseInt(res.events[res.events.length - 1].ledger, 10) >= currentEnd) break;
        }
      } catch (e) { break; }
      currentEnd = startLedger - 1;
      if (currentEnd <= minLedger) break;
    }
    return allEvents;
  } catch (err) {
    console.error('RPC Fallback also failed:', err);
    return [];
  }
};

let cachedEventsPromise = null;
let cachedEventsTime = 0;
let lastContractId = null;

const fetchAllEventsFromExpert = async (contractId) => {
  const now = Date.now();
  // Cache for 30 seconds or if contract ID changes
  if (cachedEventsPromise && lastContractId === contractId && (now - cachedEventsTime < 30000)) {
    return cachedEventsPromise;
  }
  
  lastContractId = contractId;
  cachedEventsTime = now;
  
  cachedEventsPromise = (async () => {
    let allEvents = [];
    try {
      let url = `https://api.stellar.expert/explorer/testnet/contract/${contractId}/events?limit=100`;
      let pageCount = 0;
      while (url && pageCount < 20) {
        pageCount++;
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } }).then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        });
        if (!res || !res._embedded || !res._embedded.records || res._embedded.records.length === 0) break;
        
        const records = res._embedded.records.map(evt => {
          return {
            id: evt.id,
            ledgerClosedAt: evt.ts * 1000,
            txHash: evt.txHash || evt.id.split('-')[0],
            topic: evt.topicsXdr.map(t => xdr.ScVal.fromXDR(t, 'base64')),
            value: xdr.ScVal.fromXDR(evt.bodyXdr, 'base64')
          };
        });
        allEvents = allEvents.concat(records);
        
        if (res._links && res._links.next && res._links.next.href) {
          url = 'https://api.stellar.expert' + res._links.next.href;
        } else {
          break;
        }
      }
      if (allEvents.length === 0) {
        // stellar.expert might not have indexed yet, try RPC as supplement
        console.warn('Stellar.expert returned 0 events, supplementing with RPC...');
        const rpcEvents = await fetchAllEventsFallback(contractId);
        return rpcEvents;
      }
      return allEvents;
    } catch(e) {
      console.warn('Stellar.expert fetch failed, falling back to RPC...', e.message);
      return await fetchAllEventsFallback(contractId);
    }
  })();
  
  try {
    return await cachedEventsPromise;
  } catch(e) {
    cachedEventsPromise = null;
    return [];
  }
};

export const getGlobalTopDonors = async (contractId) => {
  try {
    const allEvents = await fetchAllEventsFromExpert(contractId);
    const donorTotals = {};
    allEvents.forEach(evt => {
      try {
        const topic0 = scValToNative(evt.topic[0]);
        if (topic0 === 'donate') {
          const donor = scValToNative(evt.topic[1]);
          const amt = Number(scValToNative(evt.value)) / 10000000;
          donorTotals[donor] = (donorTotals[donor] || 0) + amt;
        }
      } catch(e){}
    });
    
    const top = Object.entries(donorTotals).map(([address, amount]) => ({ address, amount }));
    top.sort((a, b) => b.amount - a.amount);
    return top.slice(0, 10);
    
  } catch (err) {
    console.error('Failed to get global events', err);
    return [];
  }
};

export const getGlobalClaims = async (contractId) => {
  try {
    const allEvents = await fetchAllEventsFromExpert(contractId);
    const claims = [];
    allEvents.forEach(evt => {
      try {
        const topic0 = scValToNative(evt.topic[0]);
        if (topic0 === 'claim' || topic0 === 'clm_ref') {
          const address = scValToNative(evt.topic[1]);
          const amount = Number(scValToNative(evt.value)) / 10000000;
          claims.push({
            id: evt.id,
            address: address,
            from: contractId,
            amount: amount,
            date: new Date(evt.ledgerClosedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' }),
            status: 'approved'
          });
        }
      } catch(e){}
    });
    
    claims.sort((a, b) => b.id.localeCompare(a.id));
    return claims;
  } catch (err) {
    console.error('Failed to get global claims', err);
    return [];
  }
};

export const getGlobalVipHistory = async (contractId) => {
  try {
    const ownerRes = await callReadOnly(contractId, 'get_owner');
    const contractOwner = ownerRes || 'Unknown';
    
    const allEvents = await fetchAllEventsFromExpert(contractId);
    const history = [];
    allEvents.forEach(evt => {
      try {
        const topic0 = scValToNative(evt.topic[0]);
        if (topic0 === 'vip_att') {
          const participant = scValToNative(evt.topic[1]);
          const eventName = scValToNative(evt.value);
          const dateObj = new Date(evt.ledgerClosedAt);
          history.push({
            id: evt.id,
            address: participant,
            cashier: contractOwner, // Only owner can scan VIP
            eventName: eventName,
            date: dateObj.toLocaleDateString('en-GB'),
            time: dateObj.toLocaleTimeString('en-GB'),
            status: 'HADIR'
          });
        }
      } catch(e){}
    });
    
    history.sort((a, b) => b.id.localeCompare(a.id));
    return history;
  } catch (err) {
    console.error('Failed to get VIP history', err);
    return [];
  }
};

export const getGlobalVoucherHistory = async (contractId) => {
  try {
    const allEvents = await fetchAllEventsFromExpert(contractId);
    const history = [];
    allEvents.forEach(evt => {
      try {
        const topic0 = scValToNative(evt.topic[0]);
        if (topic0 === 'vouch_reg') {
          const owner = scValToNative(evt.topic[1]);
          const code = scValToNative(evt.value);
          const dateObj = new Date(evt.ledgerClosedAt);
          history.push({
            id: evt.id,
            hash: evt.txHash || evt.id.substring(0, 16),
            address: owner,
            code: code,
            type: 'REGISTER',
            amount: '0.00',
            date: dateObj.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit', second:'2-digit' }).replace(',', ''),
            status: 'TERDAFTAR'
          });
        } else if (topic0 === 'vouch_clm') {
          const cashier = scValToNative(evt.topic[1]);
          // Event value is now a tuple: (code, discounted_amount_in_stroops)
          let code = '';
          let discountedXlm = 0;
          try {
            const rawVal = scValToNative(evt.value);
            if (Array.isArray(rawVal)) {
              code = String(rawVal[0]);
              discountedXlm = Number(rawVal[1]) / 10_000_000;
            } else {
              // Older events emitted just the code string
              code = String(rawVal);
            }
          } catch(e) { code = ''; }
          const dateObj = new Date(evt.ledgerClosedAt);
          const originalXlm = discountedXlm > 0 ? (discountedXlm / 0.98) : 0;
          history.push({
            id: evt.id,
            hash: evt.txHash || evt.id.substring(0, 16),
            address: cashier,
            code: code,
            type: 'CLAIM',
            amount: discountedXlm.toFixed(2),
            discountedAmount: discountedXlm,
            originalAmount: originalXlm,
            date: dateObj.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit', second:'2-digit' }).replace(',', ''),
            status: 'SUCCESS'
          });
        }
      } catch(e){}
    });
    
    // Cross-reference CLAIM events with REGISTER events to attach the correct ambassador address to CLAIM events
    const codeToOwner = {};
    history.forEach(h => {
      if (h.type === 'REGISTER') codeToOwner[h.code] = h.address;
    });
    history.forEach(h => {
      if (h.type === 'CLAIM' && codeToOwner[h.code]) {
        h.address = codeToOwner[h.code];
      }
    });

    history.sort((a, b) => b.id.localeCompare(a.id));
    return history;
  } catch (err) {
    console.error('Failed to get voucher history', err);
    return [];
  }
};

export const getGlobalTransactions = async (contractId) => {
  try {
    const allEvents = await fetchAllEventsFromExpert(contractId);
    const txs = [];
    allEvents.forEach(evt => {
      try {
        const topic0 = scValToNative(evt.topic[0]);
        if (topic0 === 'donate') {
          const donor = scValToNative(evt.topic[1]);
          const amount = Number(scValToNative(evt.value)) / 10000000;
          txs.push({
            id: evt.id,
            hash: evt.txHash || evt.id.substring(0, 16),
            wallet: donor,
            to: contractId,
            amount: amount,
            date: new Date(evt.ledgerClosedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' }),
            status: 'success'
          });
        } else if (topic0 === 'claim' || topic0 === 'clm_ref') {
          const address = scValToNative(evt.topic[1]);
          const amount = Number(scValToNative(evt.value)) / 10000000;
          txs.push({
            id: evt.id,
            hash: evt.txHash || evt.id.substring(0, 16),
            wallet: contractId,
            to: address,
            amount: amount,
            date: new Date(evt.ledgerClosedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' }),
            status: 'success'
          });
        }
      } catch(e) {}
    });
    
    txs.sort((a, b) => b.id.localeCompare(a.id));
    return txs;
  } catch (err) {
    console.error('Failed to get global txs', err);
    return [];
  }
};

export const getReferralHistory = async (contractId, referrerAddress) => {
  try {
    const allEvents = await fetchAllEventsFromExpert(contractId);
    const donateAmounts = {};
    allEvents.forEach(evt => {
      try {
        const topic0 = scValToNative(evt.topic[0]);
        if (topic0 === 'donate') {
           const amount = Number(scValToNative(evt.value)) / 10000000;
           donateAmounts[evt.txHash || evt.id.substring(0, 16)] = amount;
        }
      } catch(e) {}
    });

    const referrals = [];
    allEvents.forEach(evt => {
      try {
        const topic0 = scValToNative(evt.topic[0]);
        if (topic0 === 'referral') {
          const referrer = scValToNative(evt.topic[1]);
          if (referrerAddress === 'GCANOQWHT5YRXX2EBQXZJLFPZ5VHZWZA5ZB3FQEUU6CHDCSHXGS3QJ2O' || referrer === referrerAddress) {
            const donorAddress = scValToNative(evt.value);
            const txHashKey = evt.txHash || evt.id.substring(0, 16);
            const amount = donateAmounts[txHashKey] || 0;
            referrals.push({
              id: evt.id,
              referrer,
              donorAddress,
              amount,
              hash: evt.txHash,
              date: new Date(evt.ledgerClosedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' })
            });
          }
        }
      } catch(e) {}
    });
    
    referrals.sort((a, b) => b.id.localeCompare(a.id));
    
    const uniqueReferrals = [];
    const seen = new Set();
    for (const ref of referrals) {
      if (!seen.has(ref.donorAddress)) {
        seen.add(ref.donorAddress);
        uniqueReferrals.push(ref);
      }
    }
    
    return uniqueReferrals;
  } catch (err) {
    console.error('Failed to get referral history', err);
    return [];
  }
}

export const getOwnerTransferHistory = async (contractId) => {
  try {
    // Fetch operations for the Master Wallet from Horizon
    const res = await fetch(`${currentNetwork.horizon}/accounts/GCANOQWHT5YRXX2EBQXZJLFPZ5VHZWZA5ZB3FQEUU6CHDCSHXGS3QJ2O/operations?limit=100&order=desc`);
    if (!res.ok) return [];
    const data = await res.json();
    
    const transfers = [];
    data._embedded.records.forEach(op => {
      try {
        if (op.type === 'invoke_host_function') {
          const symParam = op.parameters.find(p => p.type === 'Sym');
          if (symParam) {
            // Decode XDR Sym using stellar-sdk
            const funcNameScVal = xdr.ScVal.fromXDR(symParam.value, 'base64');
            const funcName = scValToNative(funcNameScVal);
            
            if (funcName === 'transfer_to_client') {
               let targetContract = '';
               try {
                 if (op.parameters.length > 0) {
                   const contractSc = xdr.ScVal.fromXDR(op.parameters[0].value, 'base64');
                   targetContract = scValToNative(contractSc);
                 }
               } catch (e) {}
               
               if (targetContract !== contractId) {
                 return; // Skip operations belonging to older smart contract deployments
               }

               let owner = '';
               let campaignId = '';
               let amount = 0;
               let receiver = 'Campaign Client';

               // Parse other parameters
               if (op.parameters.length > 2) {
                 const ownerSc = xdr.ScVal.fromXDR(op.parameters[2].value, 'base64');
                 owner = scValToNative(ownerSc);
               }
               if (op.parameters.length > 3) {
                 const idSc = xdr.ScVal.fromXDR(op.parameters[3].value, 'base64');
                 campaignId = scValToNative(idSc);
               }
               if (op.parameters.length > 4) {
                 const amountSc = xdr.ScVal.fromXDR(op.parameters[4].value, 'base64');
                 amount = Number(scValToNative(amountSc)) / 10000000;
               }

               transfers.push({
                  id: op.id,
                  hash: op.transaction_hash,
                  campaignId: campaignId || 'N/A',
                  sender: owner || 'GCANOQWHT5YRXX2EBQXZJLFPZ5VHZWZA5ZB3FQEUU6CHDCSHXGS3QJ2O',
                  receiver: receiver,
                  amount: amount || 0,
                  date: new Date(op.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' }),
                  status: 'SUCCESS'
               });
            }
          }
        }
      } catch(e) {}
    });
    
    // Sort descending by date
    return transfers.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (err) {
    console.error('Failed to get owner transfer history', err);
    return [];
  }
}


  // Execute native payment transaction via Freighter/WC signing
  export async function executeNativePayment(destination, amountStr, memoText, userAddress) {
    const res = await fetch(`${currentNetwork.horizon}/accounts/${userAddress}`);
    if (!res.ok) {
      throw new Error('Failed to retrieve account details from Horizon. Ensure you have balance.');
    }
    const accountData = await res.json();
    const account = new Account(userAddress, accountData.sequence);
  
    let tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: currentNetwork.passphrase,
    })
      .addOperation(Operation.payment({
        destination: destination,
        asset: Asset.native(),
        amount: amountStr.toString()
      }))
      .addMemo(Memo.text(memoText))
      .setTimeout(60)
      .build();
  
    const xdrString = tx.toXDR();
    const walletType = sessionStorage.getItem('steldot_wallet_type') || 'freighter';
    const module = getActiveModule(walletType);
    
    let signedResult;
    try {
      if (walletType === 'freighter') {
        if (typeof window !== 'undefined' && window.freighter && typeof window.freighter.signTransaction === 'function') {
          signedResult = await window.freighter.signTransaction(xdrString, {
            network: currentNetwork.network,
            accountToSign: userAddress
          });
        } else {
          signedResult = await module.signTransaction({
            xdr: xdrString,
            network: currentNetwork.network,
          });
        }
      } else {
        const sessionPath = sessionStorage.getItem('wcSessionPath');
        let customParams = {};
        if (sessionPath) customParams.sessionPath = sessionPath;
        
        const originalLog = console.log;
        console.log = function(...args) {
          if (args[0] && typeof args[0] === 'string' && (args[0].includes('No session found') || args[0].includes('expired') || args[0].includes('Missing or invalid'))) {
            throw new Error('SessionExpired');
          }
          originalLog.apply(console, args);
        };
        try {
          signedResult = await module.signTransaction({
            xdr: xdrString,
            network: currentNetwork.network,
          }, customParams);
        } finally {
          console.log = originalLog;
        }
      }
    } catch (signErr) {
      if (signErr.message === 'SessionExpired' || (signErr.message && signErr.message.toLowerCase().includes('session'))) {
        try { sessionStorage.removeItem('wcSessionPath'); await module.disconnect(); } catch (e) {}
        throw new Error('Sesi WalletConnect Anda telah berakhir atau terputus. Silakan klik tombol "Disconnect", lalu hubungkan ulang dompet Anda.');
      }
      if (signErr.includes && signErr.includes('User declined')) {
        throw new Error('User declined the signature request.');
      }
      throw signErr;
    }
  
    const signedXdr = signedResult.signedTxXdr || signedResult;
    if (!signedXdr) {
      throw new Error('No signature returned from the wallet.');
    }
  
    const signedTx = TransactionBuilder.fromXDR(signedXdr, currentNetwork.passphrase);
    const submitRes = await rpcServer.submitTransaction(signedTx);
    
    if (submitRes.status === 'ERROR') {
      throw new Error('Transaction execution failed: ' + JSON.stringify(submitRes.errorResultXdr || submitRes));
    }
    
    let status = submitRes.status;
    let txHash = submitRes.hash;
    let retryCount = 0;
    while (status === 'PENDING' && retryCount < 10) {
      await new Promise(r => setTimeout(r, 2000));
      const getTxRes = await rpcServer.getTransaction(txHash);
      status = getTxRes.status;
      if (status === 'SUCCESS') break;
      if (status === 'FAILED') throw new Error('Transaction failed on-chain.');
      retryCount++;
    }
    
    return txHash;
  }

// Execute write transaction via Freighter signing
export async function executeTransaction(contractId, functionName, args = [], userAddress) {
  // 1. Get sequence from Horizon
  const res = await fetch(`${currentNetwork.horizon}/accounts/${userAddress}`);
  if (!res.ok) {
    throw new Error('Failed to retrieve account details from Horizon.');
  }
  const accountData = await res.json();
  const account = new Account(userAddress, accountData.sequence);

  // 2. Build transaction
  const contractObj = new Contract(contractId);
  let tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: currentNetwork.passphrase,
  })
    .addOperation(contractObj.call(functionName, ...args))
    .setTimeout(60)
    .build();

  // 3. Prepare transaction (simulation + footprint + auth)
  try {
    tx = await rpcServer.prepareTransaction(tx);
  } catch (simErr) {
    const detail = simErr?.message || simErr?.toString() || 'Simulation failed';
    throw new Error(`Contract simulation error: ${detail}`);
  }

  // 4. Convert to XDR and request Wallet signature
  const xdrString = tx.toXDR();
  const walletType = sessionStorage.getItem('steldot_wallet_type') || 'freighter';
  
  const module = getActiveModule(walletType);
  let signedResult;
  try {
    if (walletType === 'freighter') {
      if (typeof window !== 'undefined' && window.freighter && typeof window.freighter.signTransaction === 'function') {
        try {
          signedResult = await window.freighter.signTransaction(xdrString, {
            network: currentNetwork.networkName,
            networkPassphrase: currentNetwork.passphrase,
            accountToSign: account.accountId()
          });
          if (typeof signedResult === 'string') signedResult = { signedTxXdr: signedResult };
        } catch (e) { console.warn("Direct signTransaction failed", e); }
      }
      
      if (!signedResult) {
        signedResult = await freighterSignTransaction(xdrString, {
          network: currentNetwork.networkName,
          networkPassphrase: currentNetwork.passphrase,
          accountToSign: account.accountId()
        });
      }
      if (signedResult && signedResult.error) {
        throw new Error(signedResult.error);
      }
    } else {
      signedResult = await module.signTransaction(xdrString, {
        networkPassphrase: currentNetwork.passphrase,
        address: account.accountId()
      });
    }
  } catch (err) {
    const errMsg = err.message || err.toString();
    if (errMsg.toLowerCase().includes("session topic doesn't exist") || 
        errMsg.toLowerCase().includes("no matching key") ||
        errMsg.toLowerCase().includes("expired")) {
      sessionStorage.removeItem('steldot_wallet_address');
      sessionStorage.removeItem('steldot_wallet_type');
      throw new Error('WALLETCONNECT_SESSION_EXPIRED');
    }
    throw err;
  }

  const finalXdr = signedResult.result || signedResult.signedTxXdr || signedResult;
  
  // 5. Submit transaction
  const signedTx = TransactionBuilder.fromXDR(finalXdr, currentNetwork.passphrase);
  let sendResponse = await rpcServer.sendTransaction(signedTx);

  if (sendResponse.status === 'ERROR') {
    throw new Error(sendResponse.errorResultXdr || 'Transaction submission error.');
  }

  // 6. Poll status until SUCCESS or FAILED
  let status = sendResponse.status;
  let hash = sendResponse.hash;
  
  while (status === 'PENDING') {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    try {
      const txStatus = await rpcServer.getTransaction(hash);
      status = txStatus.status;
      
      if (status === 'SUCCESS') {
        return { status, hash, txStatus };
      } else if (status === 'FAILED') {
        throw new Error('Transaction execution failed on-chain.');
      }
    } catch (err) {
      if (err.message && err.message.includes('Bad union switch')) {
        console.warn('Caught known stellar-sdk XDR parsing error for Protocol 22. Assuming transaction success:', err.message);
        return { status: 'SUCCESS', hash, txStatus: null };
      }
      throw err;
    }
  }
  
  return { status, hash, response: sendResponse };
}

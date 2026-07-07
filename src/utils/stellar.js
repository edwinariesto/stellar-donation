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
  Account
} from '@stellar/stellar-sdk';
import { 
  StellarWalletsKit, 
  Networks as WalletNetwork
} from '@creit.tech/stellar-wallets-kit';
import { FreighterModule } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { WalletConnectModule } from '@creit.tech/stellar-wallets-kit/modules/wallet-connect';

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
  return new Promise((resolve, reject) => {
    try {
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
    
    for (let i = 0; i < 6; i++) {
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
  // Cache for 10 seconds or if contract ID changes
  if (cachedEventsPromise && lastContractId === contractId && (now - cachedEventsTime < 10000)) {
    return cachedEventsPromise;
  }
  
  lastContractId = contractId;
  cachedEventsTime = now;
  
  cachedEventsPromise = (async () => {
    let allEvents = [];
    try {
      let url = `https://api.stellar.expert/explorer/testnet/contract/${contractId}/events?limit=100`;
      while (url) {
        const res = await fetch(url).then(r => r.json());
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
      return allEvents;
    } catch(e) {
      console.warn('Direct fetch blocked by browser, falling back to RPC...', e.message);
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
          if (referrer === referrerAddress) {
            const donorAddress = scValToNative(evt.value);
            const txHashKey = evt.txHash || evt.id.substring(0, 16);
            const amount = donateAmounts[txHashKey] || 0;
            referrals.push({
              id: evt.id,
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
};

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

  // 3. Prepare transaction (adds footprint/simulated authorization details)
  tx = await rpcServer.prepareTransaction(tx);

  // 4. Convert to XDR and request Wallet signature
  const xdrString = tx.toXDR();
  const walletType = sessionStorage.getItem('steldot_wallet_type') || 'freighter';
  
  const module = getActiveModule(walletType);
  let signedResult;
  try {
    signedResult = await module.signTransaction(xdrString, {
      networkPassphrase: currentNetwork.passphrase,
      address: account.accountId()
    });
  } catch (err) {
    const errMsg = err.message || err.toString();
    if (errMsg.toLowerCase().includes("session topic doesn't exist") || errMsg.toLowerCase().includes("no matching key")) {
      sessionStorage.removeItem('steldot_wallet_address');
      sessionStorage.removeItem('steldot_wallet_type');
      throw new Error("Sesi WalletConnect Anda telah berakhir atau terputus. Silakan klik tombol 'Disconnect', lalu hubungkan ulang dompet Anda.");
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

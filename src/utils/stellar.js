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
  }
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
    const walletType = localStorage.getItem('steldot_wallet_type') || 'freighter';
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
    console.warn(`Read-only call failed for ${method}:`, e);
    throw e;
  }
};

export const getGlobalTopDonors = async (contractId) => {
  try {
    let minLedger = 1;
    try {
      await rpcServer.getEvents({ startLedger: 1, filters: [], limit: 1 });
    } catch(err) {
      const match = err.message.match(/range: (\d+) - (\d+)/);
      const match2 = err.message.match(/greater than or equal to (\d+)/);
      if (match) minLedger = parseInt(match[1], 10);
      else if (match2) minLedger = parseInt(match2[1], 10);
    }
    
    const latest = await rpcServer.getLatestLedger();
    let currentEnd = latest.sequence;
    let allEvents = [];
    
    // Scan backwards in chunks of 5000 ledgers to prevent Soroban RPC from silently dropping events
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
      } catch (e) {
        console.warn('RPC retention limit reached while scanning older ledgers:', e.message);
        break; // Stop scanning older chunks, but keep allEvents collected so far!
      }
      
      currentEnd = startLedger - 1;
      if (currentEnd <= minLedger) break;
    }
    
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
    let minLedger = 1;
    try {
      await rpcServer.getEvents({ startLedger: 1, filters: [], limit: 1 });
    } catch(err) {
      const match = err.message.match(/range: (\d+) - (\d+)/);
      const match2 = err.message.match(/greater than or equal to (\d+)/);
      if (match) minLedger = parseInt(match[1], 10);
      else if (match2) minLedger = parseInt(match2[1], 10);
    }
    
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
      } catch (e) {
        break; 
      }
      currentEnd = startLedger - 1;
      if (currentEnd <= minLedger) break;
    }
    
    const claims = [];
    console.log('getGlobalClaims fetched allEvents count:', allEvents.length);
    allEvents.forEach(evt => {
      try {
        const topic0 = scValToNative(evt.topic[0]);
        if (topic0 === 'claim') {
          const address = scValToNative(evt.topic[1]);
          const amount = Number(scValToNative(evt.value)) / 10000000;
          console.log('Parsed claim:', address, amount);
          claims.push({
            id: evt.id,
            address: address,
            from: contractId,
            amount: amount,
            date: new Date(evt.ledgerClosedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' }),
            status: 'approved'
          });
        }
      } catch(e){
        console.error('Error parsing event in getGlobalClaims', e);
      }
    });
    
    // Sort descending by date (using id which contains ledger sequence)
    claims.sort((a, b) => b.id.localeCompare(a.id));
    console.log('Final claims data:', claims);
    return claims;
    
  } catch (err) {
    console.error('Failed to get global claims', err);
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
  const walletType = localStorage.getItem('steldot_wallet_type') || 'freighter';
  
  const module = getActiveModule(walletType);
  const signedResult = await module.signTransaction(xdrString, {
    networkPassphrase: currentNetwork.passphrase,
    address: account.accountId()
  });

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

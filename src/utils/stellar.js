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
import { isConnected, requestAccess, signTransaction } from '@stellar/freighter-api';

const RPC_URL = 'https://soroban-testnet.stellar.org';
const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const rpcServer = new rpc.Server(RPC_URL);

// Check if Freighter is installed
export async function checkFreighterInstalled() {
  try {
    return await isConnected();
  } catch (err) {
    return false;
  }
}

// Request address from Freighter
export async function getFreighterAddress() {
  const installed = await checkFreighterInstalled();
  if (!installed) {
    throw new Error('Freighter wallet extension not detected.');
  }
  try {
    const address = await requestAccess();
    if (!address) {
      throw new Error('User declined access or no address returned.');
    }
    return address;
  } catch (err) {
    throw err;
  }
}

// Fetch XLM balance from Horizon
export async function getXlmBalance(address) {
  try {
    const res = await fetch(`${HORIZON_URL}/accounts/${address}`);
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
    let tx = new TransactionBuilder(account, { fee: '100', networkPassphrase: Networks.TESTNET })
      .addOperation(contractObj.call(method, ...args))
      .setTimeout(30)
      .build();

    const sim = await rpcServer.simulateTransaction(tx);
    if (!sim || !sim.result || !sim.result.retval) return null;
    return scValToNative(sim.result.retval);
  } catch (e) {
    console.warn(`Read-only call failed for ${method}:`, e);
    return null;
  }
};

export const getGlobalTopDonors = async (contractId) => {
  try {
    let minLedger = 1;
    try {
      await rpcServer.getEvents({ startLedger: 1, filters: [], limit: 1 });
    } catch(err) {
      const match = err.message.match(/range: (\d+) - (\d+)/);
      if (match) minLedger = parseInt(match[1], 10);
    }
    
    const latest = await rpcServer.getLatestLedger();
    let currentEnd = latest.sequence;
    let allEvents = [];
    
    // Scan backwards in chunks of 5000 ledgers to prevent Soroban RPC from silently dropping events
    for (let i = 0; i < 6; i++) {
      const startLedger = Math.max(minLedger, currentEnd - 5000);
      let pagingToken;
      
      while (true) {
        const res = await rpcServer.getEvents({
          startLedger,
          filters: [{ type: 'contract', contractIds: [contractId] }],
          limit: 1000,
          pagination: pagingToken ? { cursor: pagingToken } : undefined
        });
        
        if (!res.events || res.events.length === 0) break;
        
        // Filter out events that are beyond our current chunk's end
        const validEvents = res.events.filter(e => parseInt(e.ledger, 10) <= currentEnd);
        allEvents = allEvents.concat(validEvents);
        
        pagingToken = res.events[res.events.length - 1].pagingToken;
        if (parseInt(res.events[res.events.length - 1].ledger, 10) >= currentEnd) break;
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

// Execute write transaction via Freighter signing
export async function executeTransaction(contractId, functionName, args = [], userAddress) {
  // 1. Get sequence from Horizon
  const res = await fetch(`${HORIZON_URL}/accounts/${userAddress}`);
  if (!res.ok) {
    throw new Error('Failed to retrieve account details from Horizon.');
  }
  const accountData = await res.json();
  const account = new Account(userAddress, accountData.sequence);

  // 2. Build transaction
  const contractObj = new Contract(contractId);
  let tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(contractObj.call(functionName, ...args))
    .setTimeout(60)
    .build();

  // 3. Prepare transaction (adds footprint/simulated authorization details)
  tx = await rpcServer.prepareTransaction(tx);

  // 4. Convert to XDR and request Freighter signature
  const xdrString = tx.toXDR();
  const signedXdr = await signTransaction(xdrString, {
    network: 'TESTNET',
  });

  // 5. Submit transaction
  const finalXdr = typeof signedXdr === 'string' ? signedXdr : signedXdr.signedTxXdr || signedXdr;
  const signedTx = TransactionBuilder.fromXDR(finalXdr, Networks.TESTNET);
  let sendResponse = await rpcServer.sendTransaction(signedTx);

  if (sendResponse.status === 'ERROR') {
    throw new Error(sendResponse.errorResultXdr || 'Transaction submission error.');
  }

  // 6. Poll status until SUCCESS or FAILED
  let status = sendResponse.status;
  let hash = sendResponse.hash;
  
  while (status === 'PENDING') {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const txStatus = await rpcServer.getTransaction(hash);
    status = txStatus.status;
    
    if (status === 'SUCCESS') {
      return { status, hash, txStatus };
    } else if (status === 'FAILED') {
      throw new Error('Transaction execution failed on-chain.');
    }
  }
  
  return { status, hash, response: sendResponse };
}

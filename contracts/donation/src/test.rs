#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, token, Address, Env, String};

#[test]
fn test_steldot_flow() {
    let env = Env::default();
    env.mock_all_auths();

    // Register contract
    // Catatan: Jika versi SDK kamu error di bagian ini, ganti menjadi:
    // let contract_id = env.register_contract(None, crate::StelDotContract);
    let contract_id = env.register(StelDotContract, ());
    let client = StelDotContractClient::new(&env, &contract_id);

    // Create test accounts
    let owner = Address::generate(&env);
    let donor = Address::generate(&env);

    // Register mock token
    let token_admin = Address::generate(&env);
    let token_addr = env.register_stellar_asset_contract(token_admin.clone());
    let token_admin_client = token::StellarAssetClient::new(&env, &token_addr);
    let token_client = token::Client::new(&env, &token_addr);

    // Mint tokens (50 XLM in stroops = 500_000_000) -> WAJIB pakai i128
    token_admin_client.mint(&donor, &500_000_000i128);

    // Initialize StelDot
    client.initialize(&owner, &token_addr);

    // Create Campaign
    let title = String::from_str(&env, "Campaign 1");
    let desc = String::from_str(&env, "Description 1");
    let youtube = String::from_str(&env, "");
    let client_wallet = Address::generate(&env);
    let expiration = 0u64;
    client.create_campaign(
        &owner,
        &1u32,
        &title,
        &desc,
        &200_000_000i128,
        &youtube,
        &client_wallet,
        &expiration,
    ); // target 20 XLM

    // Verify campaign details
    let campaign = client.get_campaign(&1u32);
    assert_eq!(campaign.id, 1);
    assert_eq!(campaign.target, 200_000_000i128);
    assert_eq!(campaign.raised, 0i128);

    // Donor donates 10 XLM (100_000_000 stroops)
    client.donate(&donor, &1u32, &100_000_000i128);

    // Verify donor points and totals
    assert_eq!(client.get_donor_points(&donor), 100_000_000i128);
    assert_eq!(client.get_donor_total_donated(&donor), 100_000_000i128);
    assert_eq!(client.get_total_raised(), 100_000_000i128);
    assert_eq!(token_client.balance(&contract_id), 100_000_000i128);

    // Request claim instantly
    client.claim_reward(&donor);

    // Verify post-claim state
    assert_eq!(client.get_donor_points(&donor), 0i128); // reset to 0
    assert_eq!(client.get_donor_total_donated(&donor), 100_000_000i128); // historic kept
    assert_eq!(client.get_total_claims_approved(), 1);

    // Contract paid out 1.5% of 100M = 1.5M stroops
    assert_eq!(token_client.balance(&contract_id), 98_500_000i128);
    // Initial 500M - 100M (donated) + 1.5M (reward) = 401_500_000
    assert_eq!(token_client.balance(&donor), 401_500_000i128);
}

#[test]
#[should_panic(expected = "insufficient unclaimed volume: need at least 10 XLM")]
fn test_insufficient_points_for_claim() {
    let env = Env::default();
    env.mock_all_auths();

    // Catatan: Sama seperti di atas, sesuaikan register jika perlu
    let contract_id = env.register(StelDotContract, ());
    let client = StelDotContractClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    let donor = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_addr = env.register_stellar_asset_contract(token_admin.clone());
    let token_admin_client = token::StellarAssetClient::new(&env, &token_addr);

    // Mint tokens
    token_admin_client.mint(&donor, &500_000_000i128);

    client.initialize(&owner, &token_addr);

    // Create Campaign
    let title = String::from_str(&env, "Campaign 1");
    let desc = String::from_str(&env, "Description 1");
    let youtube = String::from_str(&env, "");
    let client_wallet = Address::generate(&env);
    let expiration = 0u64;
    client.create_campaign(
        &owner,
        &1u32,
        &title,
        &desc,
        &200_000_000i128,
        &youtube,
        &client_wallet,
        &expiration,
    );

    // Donate 9 XLM (90_000_000 stroops)
    client.donate(&donor, &1u32, &90_000_000i128);

    // Try to claim, should panic because < 100M stroops
    client.claim_reward(&donor);
}

#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, token, Address, Env, String};

#[test]
fn test_steldot_flow() {
    let env = Env::default();
    env.mock_all_auths();

    // Register contract
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

    // Mint tokens (50 XLM in stroops = 500_000_000)
    token_admin_client.mint(&donor, &500_000_000);

    // Initialize StelDot
    client.initialize(&owner, &token_addr);

    // Create Campaign
    let title = String::from_str(&env, "Campaign 1");
    let desc = String::from_str(&env, "Description 1");
    client.create_campaign(&owner, &1u32, &title, &desc, &200_000_000); // target 20 XLM

    // Verify campaign details
    let campaign = client.get_campaign(&1u32);
    assert_eq!(campaign.id, 1);
    assert_eq!(campaign.target, 200_000_000);
    assert_eq!(campaign.raised, 0);

    // Donor donates 10 times to accumulate 10 loyalty points (1.5 XLM each time = 15_000_000 stroops)
    for _ in 0..10 {
        client.donate(&donor, &1u32, &15_000_000);
    }

    // Verify donor points and totals
    assert_eq!(client.get_donor_points(&donor), 10);
    assert_eq!(client.get_donor_total_donated(&donor), 150_000_000);
    assert_eq!(client.get_total_raised(), 150_000_000);
    assert_eq!(token_client.balance(&contract_id), 150_000_000);

    // Request claim
    assert_eq!(client.get_claim_status(&donor), 0);
    client.request_claim(&donor);
    assert_eq!(client.get_claim_status(&donor), 1);
    assert_eq!(client.get_total_claims_pending(), 1);

    // Approve claim by owner
    client.approve_claim(&owner, &donor);

    // Verify post-claim state
    assert_eq!(client.get_claim_status(&donor), 0);
    assert_eq!(client.get_donor_points(&donor), 0); // reset to 0
    assert_eq!(client.get_donor_total_donated(&donor), 150_000_000); // historic kept
    assert_eq!(client.get_total_claims_approved(), 1);
    assert_eq!(client.get_total_claims_pending(), 0);

    // Contract paid out 1 XLM = 10,000,000 stroops
    assert_eq!(token_client.balance(&contract_id), 140_000_000);
    assert_eq!(token_client.balance(&donor), 360_000_000); // Initial 500 - 150 (donations) + 10 (reward) = 360
}

#[test]
#[should_panic(expected = "claim already pending")]
fn test_double_claim_prevention() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(StelDotContract, ());
    let client = StelDotContractClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    let donor = Address::generate(&env);
    let token_addr = Address::generate(&env);

    client.initialize(&owner, &token_addr);

    // Mock points and state
    env.as_contract(&contract_id, || {
        env.storage().persistent().set(&DataKey::DonorPoints(donor.clone()), &10u32);
    });

    client.request_claim(&donor);
    client.request_claim(&donor); // Should panic: claim already pending
}

#[test]
#[should_panic(expected = "insufficient loyalty points")]
fn test_insufficient_points_for_claim() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(StelDotContract, ());
    let client = StelDotContractClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    let donor = Address::generate(&env);
    let token_addr = Address::generate(&env);

    client.initialize(&owner, &token_addr);

    // Points is 9
    env.as_contract(&contract_id, || {
        env.storage().persistent().set(&DataKey::DonorPoints(donor.clone()), &9u32);
    });

    client.request_claim(&donor); // Should panic
}

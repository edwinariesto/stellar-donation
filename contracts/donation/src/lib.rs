#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, String, Symbol, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Campaign {
    pub id: u32,
    pub title: String,
    pub description: String,
    pub target: i128,
    pub raised: i128,
    pub active: bool,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Owner,
    Token,
    Campaign(u32),
    CampaignIds,
    DonorPoints(Address),
    DonorTotalDonated(Address),
    ClaimStatus(Address),
    PendingClaims,
    TotalRaised,
    TotalClaimsApproved,
    TotalClaimsPending,
}

#[contract]
pub struct StelDotContract;

#[contractimpl]
impl StelDotContract {
    pub fn initialize(env: Env, owner: Address, token: Address) {
        if env.storage().instance().has(&DataKey::Owner) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Owner, &owner);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::TotalRaised, &0i128);
        env.storage().instance().set(&DataKey::TotalClaimsApproved, &0u32);
        env.storage().instance().set(&DataKey::TotalClaimsPending, &0u32);
        
        let empty_campaigns: Vec<u32> = Vec::new(&env);
        env.storage().instance().set(&DataKey::CampaignIds, &empty_campaigns);

        let empty_claims: Vec<Address> = Vec::new(&env);
        env.storage().instance().set(&DataKey::PendingClaims, &empty_claims);
    }

    pub fn create_campaign(env: Env, owner: Address, id: u32, title: String, description: String, target: i128) {
        owner.require_auth();
        let stored_owner: Address = env.storage().instance().get(&DataKey::Owner).expect("not initialized");
        if owner != stored_owner {
            panic!("not authorized: only owner can create campaigns");
        }
        if env.storage().instance().has(&DataKey::Campaign(id)) {
            panic!("campaign already exists");
        }

        let campaign = Campaign {
            id,
            title,
            description,
            target,
            raised: 0,
            active: true,
        };
        env.storage().instance().set(&DataKey::Campaign(id), &campaign);

        let mut campaign_ids: Vec<u32> = env.storage().instance().get(&DataKey::CampaignIds).unwrap_or(Vec::new(&env));
        campaign_ids.push_back(id);
        env.storage().instance().set(&DataKey::CampaignIds, &campaign_ids);

        env.events().publish((Symbol::short("camp_cre"), id), target);
    }

    pub fn update_campaign(env: Env, owner: Address, id: u32, title: String, description: String, target: i128, active: bool) {
        owner.require_auth();
        let stored_owner: Address = env.storage().instance().get(&DataKey::Owner).expect("not initialized");
        if owner != stored_owner {
            panic!("not authorized: only owner can update campaigns");
        }
        
        let mut campaign: Campaign = env.storage().instance().get(&DataKey::Campaign(id)).expect("campaign not found");
        campaign.title = title;
        campaign.description = description;
        campaign.target = target;
        campaign.active = active;
        
        env.storage().instance().set(&DataKey::Campaign(id), &campaign);
        env.events().publish((Symbol::short("camp_upd"), id), active);
    }

    pub fn donate(env: Env, donor: Address, campaign_id: u32, amount: i128) {
        if amount <= 0 {
            panic!("donation amount must be positive");
        }
        donor.require_auth();

        let mut campaign: Campaign = env.storage().instance().get(&DataKey::Campaign(campaign_id))
            .expect("campaign not found");
        if !campaign.active {
            panic!("campaign is inactive");
        }

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&donor, &env.current_contract_address(), &amount);

        // Update campaign raised amount
        campaign.raised += amount;
        env.storage().instance().set(&DataKey::Campaign(campaign_id), &campaign);

        // Update donor total donations
        let donor_total_key = DataKey::DonorTotalDonated(donor.clone());
        let current_total: i128 = env.storage().persistent().get(&donor_total_key).unwrap_or(0);
        env.storage().persistent().set(&donor_total_key, &(current_total + amount));
        env.storage().persistent().extend_ttl(&donor_total_key, 5000, 10000);

        // Update donor loyalty points (+1 point per donation)
        let donor_points_key = DataKey::DonorPoints(donor.clone());
        let current_points: u32 = env.storage().persistent().get(&donor_points_key).unwrap_or(0);
        env.storage().persistent().set(&donor_points_key, &(current_points + 1));
        env.storage().persistent().extend_ttl(&donor_points_key, 5000, 10000);

        // Update global totals
        let total_raised: i128 = env.storage().instance().get(&DataKey::TotalRaised).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalRaised, &(total_raised + amount));

        env.events().publish((Symbol::short("donate"), donor, campaign_id), amount);
    }

    pub fn request_claim(env: Env, donor: Address) {
        donor.require_auth();

        let donor_points_key = DataKey::DonorPoints(donor.clone());
        let points: u32 = env.storage().persistent().get(&donor_points_key).unwrap_or(0);
        if points < 10 {
            panic!("insufficient loyalty points: need at least 10");
        }

        let status_key = DataKey::ClaimStatus(donor.clone());
        let claim_status: u32 = env.storage().persistent().get(&status_key).unwrap_or(0);
        if claim_status == 1 {
            panic!("claim already pending");
        }

        // Set status to Pending (1)
        env.storage().persistent().set(&status_key, &1u32);
        env.storage().persistent().extend_ttl(&status_key, 5000, 10000);

        // Add to pending claims list
        let mut pending: Vec<Address> = env.storage().instance().get(&DataKey::PendingClaims).unwrap_or(Vec::new(&env));
        if !pending.contains(&donor) {
            pending.push_back(donor.clone());
            env.storage().instance().set(&DataKey::PendingClaims, &pending);
        }

        // Update global pending claims count
        let total_pending: u32 = env.storage().instance().get(&DataKey::TotalClaimsPending).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalClaimsPending, &(total_pending + 1));

        env.events().publish((Symbol::short("claim_req"), donor), points);
    }

    pub fn approve_claim(env: Env, owner: Address, donor: Address) {
        owner.require_auth();
        let stored_owner: Address = env.storage().instance().get(&DataKey::Owner).expect("not initialized");
        if owner != stored_owner {
            panic!("not authorized: only owner can approve claims");
        }

        let status_key = DataKey::ClaimStatus(donor.clone());
        let claim_status: u32 = env.storage().persistent().get(&status_key).unwrap_or(0);
        if claim_status != 1 {
            panic!("no pending claim for donor");
        }

        // Verify treasury balance (needs >= 1 XLM = 10,000,000 stroops)
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_addr);
        let balance = token_client.balance(&env.current_contract_address());
        if balance < 10_000_000 {
            panic!("insufficient treasury balance to payout reward");
        }

        // Transfer 1 XLM (10,000,000 stroops)
        token_client.transfer(&env.current_contract_address(), &donor, &10_000_000);

        // Reset points to 0
        let donor_points_key = DataKey::DonorPoints(donor.clone());
        env.storage().persistent().set(&donor_points_key, &0u32);

        // Clear claim status (0)
        env.storage().persistent().set(&status_key, &0u32);

        // Remove from pending list
        let pending: Vec<Address> = env.storage().instance().get(&DataKey::PendingClaims).unwrap_or(Vec::new(&env));
        let mut new_pending = Vec::new(&env);
        for addr in pending.iter() {
            if addr != donor {
                new_pending.push_back(addr);
            }
        }
        env.storage().instance().set(&DataKey::PendingClaims, &new_pending);

        // Update counts
        let total_pending: u32 = env.storage().instance().get(&DataKey::TotalClaimsPending).unwrap_or(0);
        if total_pending > 0 {
            env.storage().instance().set(&DataKey::TotalClaimsPending, &(total_pending - 1));
        }
        let total_approved: u32 = env.storage().instance().get(&DataKey::TotalClaimsApproved).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalClaimsApproved, &(total_approved + 1));

        env.events().publish((Symbol::short("claim_app"), donor), 10_000_000i128);
    }

    pub fn withdraw(env: Env, owner: Address, amount: i128) {
        owner.require_auth();
        let stored_owner: Address = env.storage().instance().get(&DataKey::Owner).expect("not initialized");
        if owner != stored_owner {
            panic!("not authorized: only owner can withdraw");
        }
        if amount <= 0 {
            panic!("withdrawal amount must be positive");
        }

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&env.current_contract_address(), &owner, &amount);

        env.events().publish((Symbol::short("withdraw"), owner), amount);
    }

    // View Functions
    pub fn get_owner(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Owner).expect("not initialized")
    }

    pub fn get_token(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Token).expect("not initialized")
    }

    pub fn get_total_raised(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalRaised).unwrap_or(0)
    }

    pub fn get_total_claims_approved(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::TotalClaimsApproved).unwrap_or(0)
    }

    pub fn get_total_claims_pending(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::TotalClaimsPending).unwrap_or(0)
    }

    pub fn get_donor_points(env: Env, donor: Address) -> u32 {
        env.storage().persistent().get(&DataKey::DonorPoints(donor)).unwrap_or(0)
    }

    pub fn get_donor_total_donated(env: Env, donor: Address) -> i128 {
        env.storage().persistent().get(&DataKey::DonorTotalDonated(donor)).unwrap_or(0)
    }

    pub fn get_claim_status(env: Env, donor: Address) -> u32 {
        env.storage().persistent().get(&DataKey::ClaimStatus(donor)).unwrap_or(0)
    }

    pub fn get_pending_claims(env: Env) -> Vec<Address> {
        env.storage().instance().get(&DataKey::PendingClaims).unwrap_or(Vec::new(&env))
    }

    pub fn get_campaign_ids(env: Env) -> Vec<u32> {
        env.storage().instance().get(&DataKey::CampaignIds).unwrap_or(Vec::new(&env))
    }

    pub fn get_campaign(env: Env, id: u32) -> Campaign {
        env.storage().instance().get(&DataKey::Campaign(id)).expect("campaign not found")
    }
}

mod test;

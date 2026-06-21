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
    DonorSuccessfulClaims(Address),
    TotalRaised,
    TotalClaimsApproved,
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
        
        let empty_campaigns: Vec<u32> = Vec::new(&env);
        env.storage().instance().set(&DataKey::CampaignIds, &empty_campaigns);
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

        // Update donor unclaimed volume (points = stroops donated)
        let donor_points_key = DataKey::DonorPoints(donor.clone());
        let current_points: i128 = env.storage().persistent().get(&donor_points_key).unwrap_or(0);
        env.storage().persistent().set(&donor_points_key, &(current_points + amount));
        env.storage().persistent().extend_ttl(&donor_points_key, 5000, 10000);

        // Update global totals
        let total_raised: i128 = env.storage().instance().get(&DataKey::TotalRaised).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalRaised, &(total_raised + amount));

        env.events().publish((Symbol::short("donate"), donor, campaign_id), amount);
    }

    pub fn claim_reward(env: Env, donor: Address) {
        donor.require_auth();

        let donor_points_key = DataKey::DonorPoints(donor.clone());
        let points_stroops: i128 = env.storage().persistent().get(&donor_points_key).unwrap_or(0);
        
        // Require at least 10 XLM (100,000,000 stroops) of unclaimed volume
        if points_stroops < 100_000_000 {
            panic!("insufficient unclaimed volume: need at least 10 XLM");
        }

        // Reward is 5% of unclaimed volume
        // e.g. 30 XLM -> 300,000,000 stroops. 5% of 300M is 15M stroops (1.5 XLM)
        let reward_stroops = points_stroops * 5 / 100;

        // Verify treasury balance
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_addr);
        let balance = token_client.balance(&env.current_contract_address());
        if balance < reward_stroops {
            panic!("insufficient treasury balance to payout reward");
        }

        // Transfer XLM
        token_client.transfer(&env.current_contract_address(), &donor, &reward_stroops);

        // Reset unclaimed volume to 0
        env.storage().persistent().set(&donor_points_key, &0i128);

        // Update successful claims for user (+1 to count how many times they claimed)
        let donor_claims_key = DataKey::DonorSuccessfulClaims(donor.clone());
        let successful_claims: u32 = env.storage().persistent().get(&donor_claims_key).unwrap_or(0);
        env.storage().persistent().set(&donor_claims_key, &(successful_claims + 1));
        env.storage().persistent().extend_ttl(&donor_claims_key, 5000, 10000);

        // Update global totals (+1)
        let total_approved: u32 = env.storage().instance().get(&DataKey::TotalClaimsApproved).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalClaimsApproved, &(total_approved + 1));

        env.events().publish((Symbol::short("claim"), donor), reward_stroops);
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

    pub fn get_donor_successful_claims(env: Env, donor: Address) -> u32 {
        env.storage().persistent().get(&DataKey::DonorSuccessfulClaims(donor)).unwrap_or(0)
    }

    pub fn get_donor_points(env: Env, donor: Address) -> i128 {
        env.storage().persistent().get(&DataKey::DonorPoints(donor)).unwrap_or(0)
    }

    pub fn get_donor_total_donated(env: Env, donor: Address) -> i128 {
        env.storage().persistent().get(&DataKey::DonorTotalDonated(donor)).unwrap_or(0)
    }

    pub fn get_campaign_ids(env: Env) -> Vec<u32> {
        env.storage().instance().get(&DataKey::CampaignIds).unwrap_or(Vec::new(&env))
    }

    pub fn get_campaign(env: Env, id: u32) -> Campaign {
        env.storage().instance().get(&DataKey::Campaign(id)).expect("campaign not found")
    }
}

mod test;

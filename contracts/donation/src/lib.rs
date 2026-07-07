#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, String, Symbol, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FundTransfer {
    pub amount: i128,
    pub date: u64, // timestamp
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Campaign {
    pub id: u32,
    pub title: String,
    pub description: String,
    pub target: i128,
    pub raised: i128,
    pub active: bool,
    pub youtube_link: String,
    pub client_wallet: Address,
    pub expiration: u64,
    pub funds_transferred: i128,
    pub transfers: Vec<FundTransfer>,
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
    HasDonated(Address),
    ReferralReward(Address),
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
        env.storage()
            .instance()
            .set(&DataKey::TotalClaimsApproved, &0u32);

        let empty_campaigns: Vec<u32> = Vec::new(&env);
        env.storage()
            .instance()
            .set(&DataKey::CampaignIds, &empty_campaigns);
    }

    pub fn create_campaign(
        env: Env,
        owner: Address,
        id: u32,
        title: String,
        description: String,
        target: i128,
        youtube_link: String,
        client_wallet: Address,
        expiration: u64,
    ) {
        owner.require_auth();
        let stored_owner: Address = env
            .storage()
            .instance()
            .get(&DataKey::Owner)
            .expect("not initialized");
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
            youtube_link,
            client_wallet,
            expiration,
            funds_transferred: 0,
            transfers: Vec::new(&env),
        };
        env.storage()
            .instance()
            .set(&DataKey::Campaign(id), &campaign);

        let mut campaign_ids: Vec<u32> = env
            .storage()
            .instance()
            .get(&DataKey::CampaignIds)
            .unwrap_or(Vec::new(&env));
        campaign_ids.push_back(id);
        env.storage()
            .instance()
            .set(&DataKey::CampaignIds, &campaign_ids);

        env.events()
            .publish((Symbol::short("camp_cre"), id), target);
    }

    pub fn update_campaign(
        env: Env,
        owner: Address,
        id: u32,
        title: String,
        description: String,
        target: i128,
        active: bool,
        youtube_link: String,
        client_wallet: Address,
        expiration: u64,
    ) {
        owner.require_auth();
        let stored_owner: Address = env
            .storage()
            .instance()
            .get(&DataKey::Owner)
            .expect("not initialized");
        if owner != stored_owner {
            panic!("not authorized: only owner can update campaigns");
        }

        let mut campaign: Campaign = env
            .storage()
            .instance()
            .get(&DataKey::Campaign(id))
            .expect("campaign not found");

        campaign.title = title;
        campaign.description = description;
        campaign.target = target;
        campaign.active = active;
        campaign.youtube_link = youtube_link;
        campaign.client_wallet = client_wallet;
        campaign.expiration = expiration;

        env.storage()
            .instance()
            .set(&DataKey::Campaign(id), &campaign);

        env.events()
            .publish((Symbol::short("camp_upd"), id), target);
    }

    pub fn transfer_to_client(env: Env, owner: Address, campaign_id: u32, amount: i128) {
        if amount <= 0 {
            panic!("amount must be positive");
        }
        owner.require_auth();
        let stored_owner: Address = env
            .storage()
            .instance()
            .get(&DataKey::Owner)
            .expect("not initialized");
        if owner != stored_owner {
            panic!("not authorized: only owner can transfer funds");
        }

        let mut campaign: Campaign = env
            .storage()
            .instance()
            .get(&DataKey::Campaign(campaign_id))
            .expect("campaign not found");

        if amount > (campaign.raised - campaign.funds_transferred) {
            panic!("insufficient funds to transfer");
        }

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_addr);
        
        let balance = token_client.balance(&env.current_contract_address());
        if balance < amount {
            panic!("insufficient treasury balance");
        }

        token_client.transfer(&env.current_contract_address(), &campaign.client_wallet, &amount);

        campaign.funds_transferred += amount;
        
        let transfer = FundTransfer {
            amount,
            date: env.ledger().timestamp(),
        };
        campaign.transfers.push_back(transfer);

        env.storage()
            .instance()
            .set(&DataKey::Campaign(campaign_id), &campaign);

        env.events()
            .publish((Symbol::short("fund_trs"), campaign_id), amount);
    }

    pub fn donate(env: Env, donor: Address, campaign_id: u32, amount: i128) {
        if amount <= 0 {
            panic!("donation amount must be positive");
        }
        donor.require_auth();

        let mut campaign: Campaign = env
            .storage()
            .instance()
            .get(&DataKey::Campaign(campaign_id))
            .expect("campaign not found");
        
        if env.ledger().timestamp() > campaign.expiration {
            panic!("campaign has expired");
        }
        if !campaign.active {
            panic!("campaign is inactive");
        }

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&donor, &env.current_contract_address(), &amount);

        // Update campaign raised amount
        campaign.raised += amount;
        env.storage()
            .instance()
            .set(&DataKey::Campaign(campaign_id), &campaign);

        // Update donor total specific to user
        let donor_total_key = DataKey::DonorTotalDonated(donor.clone());
        let current_total: i128 = env
            .storage()
            .persistent()
            .get(&donor_total_key)
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&donor_total_key, &(current_total + amount));
        env.storage()
            .persistent()
            .extend_ttl(&donor_total_key, 5000, 10000);

        // Track unclaimed volume for rewards
        let donor_points_key = DataKey::DonorPoints(donor.clone());
        let current_points: i128 = env
            .storage()
            .persistent()
            .get(&donor_points_key)
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&donor_points_key, &(current_points + amount));
        env.storage()
            .persistent()
            .extend_ttl(&donor_points_key, 5000, 10000);

        // Update global totals
        let total_raised: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalRaised)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalRaised, &(total_raised + amount));

        env.events().publish(
            (Symbol::short("donate"), donor.clone(), campaign_id),
            amount,
        );
    }

    pub fn donate_with_referral(
        env: Env,
        donor: Address,
        campaign_id: u32,
        amount: i128,
        referrer: Address,
    ) {
        if amount <= 0 {
            panic!("donation amount must be positive");
        }
        donor.require_auth();

        if donor == referrer {
            panic!("cannot refer yourself");
        }
        
        let mut campaign: Campaign = env
            .storage()
            .instance()
            .get(&DataKey::Campaign(campaign_id))
            .expect("campaign not found");
            
        if env.ledger().timestamp() > campaign.expiration {
            panic!("campaign has expired");
        }
        if !campaign.active {
            panic!("campaign is inactive");
        }

        // Enforce first-time donor rule for referrals
        let donor_total_key = DataKey::DonorTotalDonated(donor.clone());
        let current_total: i128 = env
            .storage()
            .persistent()
            .get(&donor_total_key)
            .unwrap_or(0);
            
        if current_total > 0 {
            panic!("referral only valid for first time donors");
        }

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&donor, &env.current_contract_address(), &amount);

        // Update campaign raised amount
        campaign.raised += amount;
        env.storage()
            .instance()
            .set(&DataKey::Campaign(campaign_id), &campaign);

        // Update donor total specific to user
        env.storage()
            .persistent()
            .set(&donor_total_key, &(current_total + amount));
        env.storage()
            .persistent()
            .extend_ttl(&donor_total_key, 5000, 10000);

        // Track unclaimed volume for rewards
        let donor_points_key = DataKey::DonorPoints(donor.clone());
        let current_points: i128 = env
            .storage()
            .persistent()
            .get(&donor_points_key)
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&donor_points_key, &(current_points + amount));
        env.storage()
            .persistent()
            .extend_ttl(&donor_points_key, 5000, 10000);

        // Update global totals
        let total_raised: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalRaised)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalRaised, &(total_raised + amount));

        env.events().publish(
            (Symbol::short("donate"), donor.clone(), campaign_id),
            amount,
        );

        // REFERRAL LOGIC
        let has_donated_key = DataKey::HasDonated(donor.clone());
        let has_donated: bool = env
            .storage()
            .persistent()
            .get(&has_donated_key)
            .unwrap_or(false);

        if !has_donated {
            // First time donating!
            // Mark as donated
            env.storage().persistent().set(&has_donated_key, &true);
            env.storage()
                .persistent()
                .extend_ttl(&has_donated_key, 5000, 10000);

            // Reward is 0.5% of donation
            let reward_stroops = amount * 5 / 1000;

            let ref_reward_key = DataKey::ReferralReward(referrer.clone());
            let current_ref_reward: i128 =
                env.storage().persistent().get(&ref_reward_key).unwrap_or(0);
            env.storage()
                .persistent()
                .set(&ref_reward_key, &(current_ref_reward + reward_stroops));
            env.storage()
                .persistent()
                .extend_ttl(&ref_reward_key, 5000, 10000);

            env.events()
                .publish((Symbol::short("referral"), referrer), donor);
        }
    }

    pub fn claim_reward(env: Env, donor: Address) {
        donor.require_auth();

        let donor_points_key = DataKey::DonorPoints(donor.clone());
        let points_stroops: i128 = env
            .storage()
            .persistent()
            .get(&donor_points_key)
            .unwrap_or(0);

        // Require at least 10 XLM (100,000,000 stroops) of unclaimed volume
        if points_stroops < 100_000_000 {
            panic!("insufficient unclaimed volume: need at least 10 XLM");
        }

        // Reward is 1.5% of unclaimed volume
        // e.g. 30 XLM -> 300,000,000 stroops. 1.5% of 300M is 4.5M stroops (0.45 XLM)
        let reward_stroops = points_stroops * 15 / 1000;

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
        let successful_claims: u32 = env
            .storage()
            .persistent()
            .get(&donor_claims_key)
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&donor_claims_key, &(successful_claims + 1));
        env.storage()
            .persistent()
            .extend_ttl(&donor_claims_key, 5000, 10000);

        // Update global totals (+1)
        let total_approved: u32 = env
            .storage()
            .instance()
            .get(&DataKey::TotalClaimsApproved)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalClaimsApproved, &(total_approved + 1));

        env.events()
            .publish((Symbol::short("claim"), donor), reward_stroops);
    }

    pub fn claim_referral_reward(env: Env, referrer: Address) {
        referrer.require_auth();

        let ref_reward_key = DataKey::ReferralReward(referrer.clone());
        let reward_stroops: i128 = env.storage().persistent().get(&ref_reward_key).unwrap_or(0);

        if reward_stroops <= 0 {
            panic!("no referral rewards to claim");
        }

        // Verify treasury balance
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_addr);
        let balance = token_client.balance(&env.current_contract_address());
        if balance < reward_stroops {
            panic!("insufficient treasury balance to payout reward");
        }

        // Transfer XLM
        token_client.transfer(&env.current_contract_address(), &referrer, &reward_stroops);

        // Reset unclaimed referral volume to 0
        env.storage().persistent().set(&ref_reward_key, &0i128);

        env.events()
            .publish((Symbol::short("clm_ref"), referrer), reward_stroops);
    }

    pub fn withdraw(env: Env, owner: Address, amount: i128) {
        owner.require_auth();
        let stored_owner: Address = env
            .storage()
            .instance()
            .get(&DataKey::Owner)
            .expect("not initialized");
        if owner != stored_owner {
            panic!("not authorized: only owner can withdraw");
        }
        if amount <= 0 {
            panic!("withdrawal amount must be positive");
        }

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&env.current_contract_address(), &owner, &amount);

        env.events()
            .publish((Symbol::short("withdraw"), owner), amount);
    }

    // View Functions
    pub fn get_owner(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Owner)
            .expect("not initialized")
    }

    pub fn get_token(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Token)
            .expect("not initialized")
    }

    pub fn get_total_raised(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalRaised)
            .unwrap_or(0)
    }

    pub fn get_total_claims_approved(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::TotalClaimsApproved)
            .unwrap_or(0)
    }

    pub fn get_donor_successful_claims(env: Env, donor: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::DonorSuccessfulClaims(donor))
            .unwrap_or(0)
    }

    pub fn get_donor_points(env: Env, donor: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::DonorPoints(donor))
            .unwrap_or(0)
    }

    pub fn get_donor_total_donated(env: Env, donor: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::DonorTotalDonated(donor))
            .unwrap_or(0)
    }

    pub fn get_campaign_ids(env: Env) -> Vec<u32> {
        env.storage()
            .instance()
            .get(&DataKey::CampaignIds)
            .unwrap_or(Vec::new(&env))
    }

    pub fn get_campaign(env: Env, id: u32) -> Campaign {
        let mut cmp: Campaign = env.storage()
            .instance()
            .get(&DataKey::Campaign(id))
            .expect("campaign not found");
        
        // Auto-flag inactive if expired
        if env.ledger().timestamp() > cmp.expiration {
            cmp.active = false;
        }
        cmp
    }

    pub fn has_donated(env: Env, donor: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::HasDonated(donor))
            .unwrap_or(false)
    }

    pub fn get_referral_reward(env: Env, referrer: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::ReferralReward(referrer))
            .unwrap_or(0)
    }
}

mod test;

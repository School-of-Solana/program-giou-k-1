use anchor_lang::prelude::*;

declare_id!("9NG82RTePVDeDpTZEc4v2c5CnyadftEyaT2v9864CQPX");

const MAX_MESSAGE_LENGTH: usize = 280; // Like Twitter
const MAX_MESSAGES: usize = 10; // Store last 10 messages per user

#[program]
pub mod message_board {
    use super::*;

    pub fn initialize_user(ctx: Context<InitializeUser>) -> Result<()> {
        let user_account = &mut ctx.accounts.user_account;
        user_account.authority = ctx.accounts.authority.key();
        user_account.message_count = 0;
        msg!("User account initialized for: {}", ctx.accounts.authority.key());
        Ok(())
    }

    pub fn post_message(ctx: Context<PostMessage>, content: String) -> Result<()> {
        require!(
            content.len() <= MAX_MESSAGE_LENGTH,
            MessageBoardError::MessageTooLong
        );
        require!(!content.is_empty(), MessageBoardError::MessageEmpty);

        let user_account = &mut ctx.accounts.user_account;
        let clock = Clock::get()?;

        // Create new message
        let message = Message {
            content,
            timestamp: clock.unix_timestamp,
        };

        // Add message (circular buffer - overwrites oldest if full)
        if user_account.messages.len() < MAX_MESSAGES {
            user_account.messages.push(message);
        } else {
            let index = (user_account.message_count as usize) % MAX_MESSAGES;
            user_account.messages[index] = message;
        }
        user_account.message_count += 1;

        msg!(
            "Message posted by: {} (total: {})",
            user_account.authority,
            user_account.message_count
        );
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeUser<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + UserAccount::INIT_SPACE,
        seeds = [b"user", authority.key().as_ref()],
        bump
    )]
    pub user_account: Account<'info, UserAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PostMessage<'info> {
    #[account(
        mut,
        seeds = [b"user", authority.key().as_ref()],
        bump,
        has_one = authority
    )]
    pub user_account: Account<'info, UserAccount>,
    pub authority: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct UserAccount {
    pub authority: Pubkey,
    pub message_count: u64,
    #[max_len(MAX_MESSAGES)]
    pub messages: Vec<Message>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct Message {
    #[max_len(MAX_MESSAGE_LENGTH)]
    pub content: String,
    pub timestamp: i64,
}

#[error_code]
pub enum MessageBoardError {
    #[msg("Message exceeds maximum length of 280 characters")]
    MessageTooLong,
    #[msg("Message cannot be empty")]
    MessageEmpty,
}

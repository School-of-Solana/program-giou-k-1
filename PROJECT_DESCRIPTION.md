# Project Description

**Deployed Frontend URL:** https://frontend-giou-ks-projects.vercel.app

**Solana Program ID:** `9NG82RTePVDeDpTZEc4v2c5CnyadftEyaT2v9864CQPX`

## Project Overview

### Description
This is a simple on-chain message board dApp built on Solana using the Anchor framework. Users can connect their wallet, initialize their account, and post messages that are stored permanently on the blockchain. The application demonstrates core Solana concepts including PDAs (Program Derived Addresses), account initialization, and state management.

### Key Features
- **Wallet Integration:** Connect using any Solana wallet (Phantom, Solflare, etc.)
- **Account Initialization:** One-time setup to create your personal message board account
- **Post Messages:** Write and store messages on-chain (max 280 characters, similar to Twitter)
- **Message History:** View your last 10 messages with timestamps
- **Circular Buffer:** Automatically overwrites oldest messages when limit is reached

### How to Use the dApp

1. **Connect Wallet:** Click "Select Wallet" button and connect your Solana wallet (make sure you're on Devnet)
2. **Initialize Account:** Click "Initialize Account" to create your personal message board (one-time action, costs ~0.002 SOL)
3. **Post Messages:** Type your message (up to 280 characters) and click "Post Message"
4. **View History:** See your last 10 messages displayed below the input area

## Program Architecture

The program is built using Anchor 0.31.1 and consists of two main instructions that manage user message boards on-chain.

### PDA Usage

The program uses a single PDA (Program Derived Address) to store each user's message board account.

**PDAs Used:**
- **User Account PDA:** Derived using seeds `["user", authority.key()]`
  - **Purpose:** Creates a deterministic address for each user's message board
  - **Why:** Allows users to have a unique, predictable account address without needing to generate and store keypairs
  - **Benefits:** Simplifies account management and ensures each wallet has exactly one message board

### Program Instructions

**Instructions Implemented:**
- **initialize_user:** Creates a new user account (PDA) to store messages
  - Initializes the account with the user's public key as authority
  - Sets message_count to 0
  - Creates an empty messages vector

- **post_message:** Adds a new message to the user's account
  - Validates message is not empty and not longer than 280 characters
  - Stores message content and current timestamp
  - Implements circular buffer logic (max 10 messages)
  - Increments message_count

### Account Structure

The program uses two main data structures:

```rust
#[account]
#[derive(InitSpace)]
pub struct UserAccount {
    pub authority: Pubkey,        // The wallet that owns this message board (32 bytes)
    pub message_count: u64,       // Total number of messages posted (8 bytes)
    #[max_len(10)]
    pub messages: Vec<Message>,   // Last 10 messages (circular buffer)
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct Message {
    #[max_len(280)]
    pub content: String,          // Message text (max 280 characters)
    pub timestamp: i64,           // Unix timestamp when message was posted
}
```

**Constants:**
- `MAX_MESSAGE_LENGTH = 280` - Maximum characters per message
- `MAX_MESSAGES = 10` - Maximum messages stored per user

## Testing

### Test Coverage

The project includes comprehensive tests covering both happy and unhappy paths.

**Happy Path Tests:**
- **Initialize User:** Successfully creates a new user account
- **Post Message:** Successfully posts a message after initialization
- **Post Multiple Messages:** Posts several messages and verifies they're stored correctly
- **Post Max Length Message:** Posts a 280-character message successfully

**Unhappy Path Tests:**
- **Post Without Initialization:** Attempts to post before initializing account (should fail)
- **Empty Message:** Attempts to post an empty message (should fail with MessageEmpty error)
- **Message Too Long:** Attempts to post a 281-character message (should fail with MessageTooLong error)
- **Wrong Authority:** Attempts to post with wrong wallet (should fail with constraint violation)

### Running Tests
```bash
cd anchor_project/message_board
anchor test
```

All 8 tests pass successfully.

### Additional Notes for Evaluators

- **Program deployed on Devnet:** The program is live and functional on Solana Devnet
- **Frontend is fully functional:** Users can connect wallet, initialize account, and post messages
- **PDA implementation:** Uses deterministic PDAs for user accounts with seeds `["user", authority]`
- **Error handling:** Custom errors for message validation (MessageTooLong, MessageEmpty)
- **Circular buffer:** Automatically manages message history by overwriting oldest messages
- **Timestamp tracking:** Each message includes Unix timestamp for chronological ordering
- **Account space optimization:** Uses `InitSpace` derive macro for automatic space calculation
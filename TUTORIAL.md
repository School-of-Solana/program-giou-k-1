# Message Board dApp Tutorial

## Part 1: Anchor Program

### 1.1 Setup & Initialize Project

```bash
# Create Anchor project
anchor init message_board
cd message_board

# Add Solana tools to PATH (if needed)
export PATH="/Users/YOUR_USERNAME/.local/share/solana/install/active_release/bin:$PATH"
```

### 1.2 Configure Anchor.toml

Set cluster to devnet:
```toml
[provider]
cluster = "Devnet"
```

### 1.3 Setup Wallet

```bash
# Copy your existing devnet wallet as program keypair
cp ~/.config/solana/devnet.json target/deploy/id.json

# Check balance (need SOL for deployment)
solana balance --url devnet

# If needed, airdrop SOL
solana airdrop 2 --url devnet
```

### 1.4 Write the Program

**File:** `programs/message_board/src/lib.rs`

Key concepts:
- **PDA (Program Derived Address):** Deterministic address using seeds `["user", authority.key()]`
- **Two instructions:** `initialize_user` and `post_message`
- **Circular buffer:** Stores last 10 messages, overwrites oldest when full
- **Custom errors:** `MessageTooLong`, `MessageEmpty`

```rust
use anchor_lang::prelude::*;

declare_id!("YOUR_PROGRAM_ID"); // Will be generated

const MAX_MESSAGE_LENGTH: usize = 280;
const MAX_MESSAGES: usize = 10;

#[program]
pub mod message_board {
    use super::*;

    pub fn initialize_user(ctx: Context<InitializeUser>) -> Result<()> {
        let user_account = &mut ctx.accounts.user_account;
        user_account.authority = ctx.accounts.authority.key();
        user_account.message_count = 0;
        user_account.messages = Vec::new();
        Ok(())
    }

    pub fn post_message(ctx: Context<PostMessage>, content: String) -> Result<()> {
        require!(!content.is_empty(), MessageBoardError::MessageEmpty);
        require!(content.len() <= MAX_MESSAGE_LENGTH, MessageBoardError::MessageTooLong);

        let user_account = &mut ctx.accounts.user_account;
        let message = Message {
            content,
            timestamp: Clock::get()?.unix_timestamp,
        };

        // Circular buffer logic
        if user_account.messages.len() < MAX_MESSAGES {
            user_account.messages.push(message);
        } else {
            let index = (user_account.message_count as usize) % MAX_MESSAGES;
            user_account.messages[index] = message;
        }
        
        user_account.message_count += 1;
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
    #[msg("Message cannot be empty")]
    MessageEmpty,
    #[msg("Message exceeds maximum length of 280 characters")]
    MessageTooLong,
}
```

### 1.5 Build & Deploy

```bash
# Build the program
anchor build

# Deploy to devnet
anchor deploy

# Note the Program ID from output, update in lib.rs and Anchor.toml
```

### 1.6 Write Tests

**File:** `tests/message_board.ts`

```typescript
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { MessageBoard } from "../target/types/message_board";
import { expect } from "chai";

describe("message_board", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.MessageBoard as Program<MessageBoard>;

  const [userPDA] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("user"), provider.wallet.publicKey.toBuffer()],
    program.programId
  );

  it("Initializes user account", async () => {
    const tx = await program.methods
      .initializeUser()
      .accounts({
        userAccount: userPDA,
        authority: provider.wallet.publicKey,
      })
      .rpc();
    
    const account = await program.account.userAccount.fetch(userPDA);
    expect(account.messageCount.toNumber()).to.equal(0);
  });

  it("Posts a message", async () => {
    const tx = await program.methods
      .postMessage("Hello Solana!")
      .accounts({
        userAccount: userPDA,
        authority: provider.wallet.publicKey,
      })
      .rpc();
    
    const account = await program.account.userAccount.fetch(userPDA);
    expect(account.messages[0].content).to.equal("Hello Solana!");
  });

  // Add more tests for unhappy paths...
});
```

```bash
# Run tests
anchor test
```

## Part 2: Frontend (Next.js)

### 2.1 Create Next.js App

```bash
# In project root
npx create-next-app@latest frontend
# Choose: TypeScript, Tailwind CSS, App Router
```

### 2.2 Install Solana Dependencies

```bash
cd frontend
npm install @solana/web3.js @solana/wallet-adapter-react @solana/wallet-adapter-react-ui @solana/wallet-adapter-wallets @coral-xyz/anchor @coral-xyz/borsh
```

### 2.3 Copy IDL

```bash
# Copy the generated IDL from Anchor project
cp ../anchor_project/message_board/target/idl/message_board.json lib/idl.json
```

Create `lib/idl.ts`:
```typescript
import idl from './idl.json';
export const IDL = idl;
export const PROGRAM_ID = "YOUR_PROGRAM_ID";
```

### 2.4 Create Main Component

**File:** `components/MessageBoard.tsx`

Key concepts:
- **Wallet Adapter:** Connect to Solana wallets (Phantom, Solflare)
- **Anchor Program:** Interact with deployed program
- **PDA Derivation:** Calculate user's PDA address client-side
- **Borsh Deserialization:** Manually decode account data

```typescript
"use client";

import { useMemo, useState, useEffect } from "react";
import { ConnectionProvider, WalletProvider, useWallet } from "@solana/wallet-adapter-react";
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import { IDL } from "@/lib/idl";
import * as borsh from "@coral-xyz/borsh";

const PROGRAM_ID = new PublicKey("YOUR_PROGRAM_ID");

function MessageBoardContent() {
  const wallet = useWallet();
  const [messages, setMessages] = useState<any[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);

  const connection = useMemo(() => new web3.Connection(clusterApiUrl("devnet")), []);
  
  const program = useMemo(() => {
    if (!wallet.publicKey) return null;
    const provider = new AnchorProvider(connection, wallet as any, {});
    return new Program(IDL as any, PROGRAM_ID, provider);
  }, [wallet, connection]);

  // Calculate PDA
  const getUserPDA = () => {
    if (!wallet.publicKey) return null;
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user"), wallet.publicKey.toBuffer()],
      PROGRAM_ID
    );
    return pda;
  };

  // Fetch messages using manual Borsh deserialization
  const fetchMessages = async () => {
    if (!program || !wallet.publicKey) return;
    try {
      const userPDA = getUserPDA();
      if (!userPDA) return;

      const accountData = await connection.getAccountInfo(userPDA);
      if (!accountData) {
        setMessages([]);
        return;
      }

      // Define Borsh schema matching Rust structs
      const messageSchema = borsh.struct([
        borsh.str("content"),
        borsh.i64("timestamp"),
      ]);

      const userAccountSchema = borsh.struct([
        borsh.publicKey("authority"),
        borsh.u64("messageCount"),
        borsh.vec(messageSchema, "messages"),
      ]);

      // Skip 8-byte discriminator and decode
      const decoded = userAccountSchema.decode(accountData.data.slice(8));
      setMessages(decoded.messages || []);
      setIsInitialized(true);
    } catch (error) {
      console.error("Error fetching messages:", error);
      setMessages([]);
    }
  };

  // Initialize user account
  const initializeAccount = async () => {
    if (!program || !wallet.publicKey) return;
    try {
      const userPDA = getUserPDA();
      const tx = await program.methods
        .initializeUser()
        .accounts({
          userAccount: userPDA,
          authority: wallet.publicKey,
        })
        .rpc();
      
      console.log("Initialize tx:", tx);
      await fetchMessages();
    } catch (error) {
      console.error("Error initializing:", error);
    }
  };

  // Post message
  const postMessage = async () => {
    if (!program || !wallet.publicKey || !messageInput) return;
    try {
      const userPDA = getUserPDA();
      const tx = await program.methods
        .postMessage(messageInput)
        .accounts({
          userAccount: userPDA,
          authority: wallet.publicKey,
        })
        .rpc();
      
      console.log("Post message tx:", tx);
      
      // Wait for confirmation
      await connection.confirmTransaction(tx, "confirmed");
      
      setMessageInput("");
      await fetchMessages();
    } catch (error) {
      console.error("Error posting message:", error);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [wallet.publicKey, program]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-500 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Message Board</h1>
          <WalletMultiButton />
        </div>

        {wallet.connected && (
          <>
            {!isInitialized && (
              <button onClick={initializeAccount} className="btn-primary">
                Initialize Account
              </button>
            )}

            <div className="mb-4">
              <textarea
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Write a message (max 280 chars)"
                maxLength={280}
                className="w-full p-2 border rounded"
              />
              <button onClick={postMessage} className="btn-primary mt-2">
                Post Message
              </button>
            </div>

            <div>
              <h2 className="text-xl font-bold mb-2">Your Messages</h2>
              {messages.map((msg, i) => (
                <div key={i} className="border p-3 mb-2 rounded">
                  <p>{msg.content}</p>
                  <small>{new Date(msg.timestamp * 1000).toLocaleString()}</small>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function MessageBoard() {
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={clusterApiUrl("devnet")}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <MessageBoardContent />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
```

### 2.5 Setup Layout & Page

**File:** `app/layout.tsx`
```typescript
import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

**File:** `app/page.tsx`
```typescript
"use client";
import dynamic from "next/dynamic";

const MessageBoard = dynamic(() => import("@/components/MessageBoard"), { ssr: false });

export default function Home() {
  return <MessageBoard />;
}
```

### 2.6 Test Locally

```bash
npm run dev
# Open http://localhost:3000
```

### 2.7 Deploy to Vercel

```bash
# Install Vercel CLI (or use brew install vercel)
npm install -g vercel

# Deploy
vercel

# Deploy to production
vercel --prod
```

## Key Concepts Explained

### PDAs (Program Derived Addresses)
- Deterministic addresses derived from seeds
- No private key needed
- Seeds: `["user", wallet_pubkey]` → unique address per user
- Allows programs to "sign" transactions

### Borsh Serialization
- Binary format used by Solana/Anchor
- Rust structs → binary data on-chain
- JavaScript needs to deserialize: define schema → decode bytes
- Skip first 8 bytes (account discriminator)

### Wallet Adapters
- `@solana/wallet-adapter-react`: React hooks for wallet connection
- `@solana/wallet-adapter-react-ui`: Pre-built UI components
- Supports multiple wallets: Phantom, Solflare, etc.
- Handles signing transactions

### Anchor Program Interaction
- `AnchorProvider`: Connects wallet + RPC
- `Program`: Type-safe interface to call instructions
- `.methods.instructionName(args).accounts({...}).rpc()`: Call instruction

## Common Issues & Solutions

**Issue:** `cargo: command not found: build-sbf`
```bash
export PATH="/Users/YOUR_USERNAME/.local/share/solana/install/active_release/bin:$PATH"
```

**Issue:** Account data won't decode
- Use manual Borsh deserialization instead of Anchor coder
- Define schema matching Rust structs exactly
- Skip 8-byte discriminator

**Issue:** CSS import error in Next.js
- Import wallet CSS in `layout.tsx`, not component
- Use `"use client"` directive for client components

## Testing Checklist

- [ ] All Anchor tests pass (`anchor test`)
- [ ] Program deployed to devnet
- [ ] Frontend connects to wallet
- [ ] Can initialize account
- [ ] Can post messages
- [ ] Messages display correctly
- [ ] Frontend deployed to Vercel


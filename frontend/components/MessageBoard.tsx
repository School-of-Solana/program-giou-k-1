"use client";

import { useMemo, useState, useEffect } from "react";
import {
  ConnectionProvider,
  WalletProvider,
  useConnection,
  useWallet,
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  WalletModalProvider,
  WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, web3, BN } from "@coral-xyz/anchor";
import { IDL } from "@/lib/idl";

const PROGRAM_ID = new PublicKey("9NG82RTePVDeDpTZEc4v2c5CnyadftEyaT2v9864CQPX");

function MessageBoardContent() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const program = useMemo(() => {
    if (!wallet.publicKey) return null;
    const provider = new AnchorProvider(
      connection,
      wallet as any,
      AnchorProvider.defaultOptions()
    );
    return new Program(IDL as any, provider);
  }, [connection, wallet]);

  const getUserPDA = () => {
    if (!wallet.publicKey) return null;
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user"), wallet.publicKey.toBuffer()],
      PROGRAM_ID
    );
    return pda;
  };

  const checkInitialized = async () => {
    if (!program || !wallet.publicKey) return;
    try {
      const userPDA = getUserPDA();
      if (!userPDA) return;
      const account = await connection.getAccountInfo(userPDA);
      setInitialized(!!account);
      if (account) {
        await fetchMessages();
      }
    } catch (error) {
      console.error("Error checking initialization:", error);
      setInitialized(false);
    }
  };

  const initializeUser = async () => {
    if (!program || !wallet.publicKey) return;
    setLoading(true);
    try {
      const userPDA = getUserPDA();
      if (!userPDA) return;

      const tx = await program.methods
        .initializeUser()
        .accounts({
          userAccount: userPDA,
          authority: wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      console.log("Initialize transaction:", tx);
      setInitialized(true);
      alert("Account initialized successfully!");
    } catch (error: any) {
      console.error("Error initializing:", error);
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    if (!program || !wallet.publicKey) return;
    try {
      const userPDA = getUserPDA();
      if (!userPDA) return;

      const accountData = await connection.getAccountInfo(userPDA);
      if (!accountData) {
        console.log("No account data found");
        setMessages([]);
        return;
      }

      // Decode the account data - skip the 8-byte discriminator
      const decoded: any = program.coder.accounts.decode(
        "UserAccount",
        accountData.data
      );
      console.log("Decoded account:", decoded);
      console.log("Messages count:", decoded.messageCount?.toString());
      console.log("Messages array:", decoded.messages);

      // Make sure messages is an array
      const msgs = Array.isArray(decoded.messages) ? decoded.messages : [];
      console.log("Setting messages:", msgs);
      setMessages(msgs);
    } catch (error) {
      console.error("Error fetching messages:", error);
      setMessages([]);
    }
  };

  const postMessage = async () => {
    if (!program || !wallet.publicKey || !newMessage.trim()) return;
    setLoading(true);
    try {
      const userPDA = getUserPDA();
      if (!userPDA) return;

      const tx = await program.methods
        .postMessage(newMessage)
        .accounts({
          userAccount: userPDA,
          authority: wallet.publicKey,
        })
        .rpc();

      console.log("Post message transaction:", tx);

      // Wait for confirmation
      await connection.confirmTransaction(tx, "confirmed");

      setNewMessage("");

      // Wait a bit for the account to update
      await new Promise(resolve => setTimeout(resolve, 1000));
      await fetchMessages();

      alert("Message posted!");
    } catch (error: any) {
      console.error("Error posting message:", error);
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (wallet.publicKey) {
      checkInitialized();
    }
  }, [wallet.publicKey]);

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold text-white">Message Board</h1>
            <WalletMultiButton />
          </div>

          {!wallet.connected ? (
            <div className="text-center py-12">
              <p className="text-white text-xl">
                Please connect your wallet to continue
              </p>
            </div>
          ) : !initialized ? (
            <div className="text-center py-12">
              <p className="text-white text-xl mb-6">
                Initialize your account to start posting messages
              </p>
              <button
                onClick={initializeUser}
                disabled={loading}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-lg disabled:opacity-50"
              >
                {loading ? "Initializing..." : "Initialize Account"}
              </button>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="What's on your mind? (max 280 characters)"
                  maxLength={280}
                  className="w-full p-4 rounded-lg bg-white/20 text-white placeholder-white/60 border border-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={4}
                />
                <div className="flex justify-between items-center mt-4">
                  <span className="text-white/60 text-sm">
                    {newMessage.length}/280
                  </span>
                  <button
                    onClick={postMessage}
                    disabled={loading || !newMessage.trim()}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-lg disabled:opacity-50"
                  >
                    {loading ? "Posting..." : "Post Message"}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-white mb-4">
                  Your Messages ({messages.length}/10)
                </h2>
                {messages.length === 0 ? (
                  <p className="text-white/60 text-center py-8">
                    No messages yet. Post your first message!
                  </p>
                ) : (
                  messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className="bg-white/10 p-4 rounded-lg border border-white/20"
                    >
                      <p className="text-white mb-2">{msg.content}</p>
                      <p className="text-white/40 text-sm">
                        {new Date(
                          msg.timestamp.toNumber() * 1000
                        ).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <div className="mt-8 text-center text-white/60 text-sm">
          <p>Program ID: {PROGRAM_ID.toString()}</p>
          <p className="mt-2">Deployed on Solana Devnet</p>
        </div>
      </div>
    </div>
  );
}

export default function MessageBoard() {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <MessageBoardContent />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}


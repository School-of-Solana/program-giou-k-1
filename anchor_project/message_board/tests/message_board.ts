import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { MessageBoard } from "../target/types/message_board";
import { expect } from "chai";

describe("message_board", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.MessageBoard as Program<MessageBoard>;
  const user = provider.wallet;

  // Derive the PDA for the user account
  const [userAccountPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("user"), user.publicKey.toBuffer()],
    program.programId
  );

  describe("Happy Path Tests", () => {
    it("Initializes user account", async () => {
      const tx = await program.methods
        .initializeUser()
        .accounts({
          userAccount: userAccountPda,
          authority: user.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      console.log("Initialize user tx:", tx);

      // Fetch and verify the account
      const userAccount = await program.account.userAccount.fetch(userAccountPda);
      expect(userAccount.authority.toString()).to.equal(user.publicKey.toString());
      expect(userAccount.messageCount.toNumber()).to.equal(0);
      expect(userAccount.messages.length).to.equal(0);
    });

    it("Posts a message", async () => {
      const message = "Hello, Solana!";

      const tx = await program.methods
        .postMessage(message)
        .accounts({
          userAccount: userAccountPda,
          authority: user.publicKey,
        })
        .rpc();

      console.log("Post message tx:", tx);

      // Fetch and verify
      const userAccount = await program.account.userAccount.fetch(userAccountPda);
      expect(userAccount.messageCount.toNumber()).to.equal(1);
      expect(userAccount.messages.length).to.equal(1);
      expect(userAccount.messages[0].content).to.equal(message);
      expect(userAccount.messages[0].timestamp.toNumber()).to.be.greaterThan(0);
    });

    it("Posts multiple messages", async () => {
      const messages = ["Second message", "Third message", "Fourth message"];

      for (const msg of messages) {
        await program.methods
          .postMessage(msg)
          .accounts({
            userAccount: userAccountPda,
            authority: user.publicKey,
          })
          .rpc();
      }

      // Fetch and verify
      const userAccount = await program.account.userAccount.fetch(userAccountPda);
      expect(userAccount.messageCount.toNumber()).to.equal(4); // 1 from previous test + 3 new
      expect(userAccount.messages.length).to.equal(4);
    });

    it("Posts maximum length message", async () => {
      const maxMessage = "a".repeat(280); // Max 280 chars

      const tx = await program.methods
        .postMessage(maxMessage)
        .accounts({
          userAccount: userAccountPda,
          authority: user.publicKey,
        })
        .rpc();

      console.log("Max length message tx:", tx);

      const userAccount = await program.account.userAccount.fetch(userAccountPda);
      expect(userAccount.messages[userAccount.messages.length - 1].content).to.equal(maxMessage);
    });
  });

  describe("Unhappy Path Tests", () => {
    it("Fails to post message without initialization", async () => {
      // Create a new keypair that hasn't been initialized
      const newUser = anchor.web3.Keypair.generate();
      const [newUserPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("user"), newUser.publicKey.toBuffer()],
        program.programId
      );

      try {
        await program.methods
          .postMessage("This should fail")
          .accounts({
            userAccount: newUserPda,
            authority: newUser.publicKey,
          })
          .signers([newUser])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).to.exist;
        // Account doesn't exist error
        console.log("Expected error:", error.message);
      }
    });

    it("Fails to post empty message", async () => {
      try {
        await program.methods
          .postMessage("")
          .accounts({
            userAccount: userAccountPda,
            authority: user.publicKey,
          })
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).to.exist;
        expect(error.toString()).to.include("MessageEmpty");
        console.log("Expected error: MessageEmpty");
      }
    });

    it("Fails to post message exceeding max length", async () => {
      const tooLongMessage = "a".repeat(281); // 281 chars, exceeds 280 limit

      try {
        await program.methods
          .postMessage(tooLongMessage)
          .accounts({
            userAccount: userAccountPda,
            authority: user.publicKey,
          })
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).to.exist;
        expect(error.toString()).to.include("MessageTooLong");
        console.log("Expected error: MessageTooLong");
      }
    });

    it("Fails when wrong authority tries to post", async () => {
      const wrongAuthority = anchor.web3.Keypair.generate();

      try {
        await program.methods
          .postMessage("Unauthorized message")
          .accounts({
            userAccount: userAccountPda,
            authority: wrongAuthority.publicKey,
          })
          .signers([wrongAuthority])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).to.exist;
        // Should fail due to has_one constraint
        console.log("Expected error:", error.message);
      }
    });
  });
});

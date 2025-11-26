export const IDL = {
  "address": "9NG82RTePVDeDpTZEc4v2c5CnyadftEyaT2v9864CQPX",
  "metadata": {
    "name": "message_board",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "initialize_user",
      "discriminator": [111, 17, 185, 250, 60, 122, 38, 254],
      "accounts": [
        {
          "name": "user_account",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [117, 115, 101, 114]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "post_message",
      "discriminator": [214, 50, 100, 209, 38, 34, 7, 76],
      "accounts": [
        {
          "name": "user_account",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [117, 115, 101, 114]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true,
          "relations": ["user_account"]
        }
      ],
      "args": [
        {
          "name": "content",
          "type": "string"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "UserAccount",
      "discriminator": [211, 33, 136, 16, 186, 110, 242, 127]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "MessageTooLong",
      "msg": "Message exceeds maximum length of 280 characters"
    },
    {
      "code": 6001,
      "name": "MessageEmpty",
      "msg": "Message cannot be empty"
    }
  ],
  "types": [
    {
      "name": "Message",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "content",
            "type": "string"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "UserAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "message_count",
            "type": "u64"
          },
          {
            "name": "messages",
            "type": {
              "vec": {
                "defined": {
                  "name": "Message"
                }
              }
            }
          }
        ]
      }
    }
  ]
} as const;

export type MessageBoard = {
  address: string;
  metadata: {
    name: string;
    version: string;
    spec: string;
    description: string;
  };
  instructions: Array<any>;
  accounts: Array<any>;
  errors: Array<any>;
  types: Array<any>;
};


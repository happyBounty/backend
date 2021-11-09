#!/bin/bash

export WEB3_RPC_URL=https://mainnet.infura.io/v3/13453433b46c49baa33b06a3ebde4b32
export WEB3_PRIVATE_KEY=$4
export WEB3_ADDRESS=$2

# web3 contract call --wait --abi $3 --gas-limit 2000000 --function mint $1
#!/bin/bash

export WEB3_RPC_URL=https://mainnet.infura.io/v3/13453433b46c49baa33b06a3ebde4b32
export WEB3_PRIVATE_KEY=$6
export WEB3_ADDRESS=$4

# web3 contract call --wait --abi $5 --gas-limit 2000000 --function transferFrom $1 $2 $3
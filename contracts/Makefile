# Deploy DeFiAgentDelegate to multiple chains via CREATE2 (same address on each).
# Usage: make deploy CHAINS="sepolia base"
# Requires: PRIVATE_KEY and per-chain RPC URLs (e.g. SEPOLIA_RPC_URL, BASE_RPC_URL)
CHAINS ?= ethereum base

deploy:
	@for chain in $(CHAINS); do \
		echo "Deploying to $$chain..."; \
		forge script script/Deploy.s.sol:Deploy --rpc-url $$chain --private-key "$${PRIVATE_KEY}" --broadcast; \
	done

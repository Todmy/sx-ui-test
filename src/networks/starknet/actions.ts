import { clients as Clients, getExecutionData, defaultNetwork, clients } from '@snapshot-labs/sx';
import { SUPPORTED_AUTHENTICATORS, SUPPORTED_EXECUTORS, SUPPORTED_STRATEGIES } from './constants';
import { verifyNetwork } from '@/helpers/utils';
import type { Provider } from 'starknet';
import type { Web3Provider } from '@ethersproject/providers';
import type { MetaTransaction } from '@snapshot-labs/sx/dist/utils/encoding/execution-hash';
import type { NetworkActions } from '@/networks/types';
import type { Space, Proposal, Transaction } from '@/types';

const VANILLA_EXECUTOR = '0x4ecc83848a519cc22b0d0ffb70e65ec8dde85d3d13439eff7145d4063cf6b4d';
const ZODIAC_EXECUTOR = '0x21dda40770f4317582251cffd5a0202d6b223dc167e5c8db25dc887d11eba81';

function convertToMetaTransactions(transactions: Transaction[]): MetaTransaction[] {
  return transactions.map((tx: Transaction) => ({
    ...tx,
    nonce: 0,
    operation: 0
  }));
}

function buildExecution(space: Space, transactions: MetaTransaction[]) {
  if (space.executors.find(executor => executor === ZODIAC_EXECUTOR)) {
    return getExecutionData(ZODIAC_EXECUTOR, defaultNetwork, { transactions });
  }

  if (space.executors.find(executor => executor === VANILLA_EXECUTOR)) {
    if (transactions.length) {
      console.warn('transactions will be ignored as vanilla executor is used');
    }

    return {
      executor: VANILLA_EXECUTOR,
      executionParams: []
    };
  }

  throw new Error('No supported executor configured for this space');
}

function pickAuthenticatorAndStrategies(authenticators: string[], strategies: string[]) {
  const authenticator = authenticators.find(
    authenticator => SUPPORTED_AUTHENTICATORS[authenticator]
  );

  const selectedStrategies = strategies
    .map((strategy, index) => [index, strategy] as const)
    .filter(([, strategy]) => SUPPORTED_STRATEGIES[strategy])
    .map(([index]) => index);

  if (!authenticator || selectedStrategies.length === 0) {
    throw new Error('Unsupported space');
  }

  return { authenticator, strategies: selectedStrategies };
}

export function createActions(
  starkProvider: Provider,
  { l1ChainId }: { l1ChainId: number }
): NetworkActions {
  const manaUrl: string = import.meta.env.VITE_MANA_URL || 'http://localhost:3000';
  const ethUrl: string = import.meta.env.VITE_ETH_RPC_URL;

  const client = new Clients.EthereumSig({
    starkProvider,
    manaUrl,
    ethUrl
  });

  return {
    async createSpace(
      web3: any,
      params: {
        controller: string;
        votingDelay: number;
        minVotingDuration: number;
        maxVotingDuration: number;
        proposalThreshold: bigint;
        qorum: bigint;
        authenticators: string[];
        votingStrategies: string[];
        votingStrategiesParams: string[][];
        executionStrategies: string[];
        metadataUri: string;
      }
    ) {
      const spaceManager = new clients.SpaceManager({
        starkProvider,
        account: web3.provider.account,
        disableEstimation: true
      });

      return spaceManager.deploySpace(params);
    },
    setMetadataUri: async (web3: any, spaceId: string, metadataUri: string) => {
      const spaceManager = new clients.SpaceManager({
        starkProvider,
        account: web3.provider.account,
        disableEstimation: true
      });

      return spaceManager.setMetadataUri(spaceId, metadataUri);
    },
    propose: async (
      web3: Web3Provider,
      account: string,
      space: Space,
      cid: string,
      transactions: MetaTransaction[]
    ) => {
      await verifyNetwork(web3, l1ChainId);

      const { authenticator, strategies } = pickAuthenticatorAndStrategies(
        space.authenticators,
        space.strategies
      );

      const executionData = buildExecution(space, transactions);

      return client.propose(web3, account, {
        space: space.id,
        authenticator,
        strategies,
        metadataUri: `ipfs://${cid}`,
        ...executionData
      });
    },
    vote: async (web3: Web3Provider, account: string, proposal: Proposal, choice: number) => {
      await verifyNetwork(web3, l1ChainId);

      const { authenticator, strategies } = pickAuthenticatorAndStrategies(
        proposal.space.authenticators,
        proposal.strategies
      );

      return client.vote(web3, account, {
        space: proposal.space.id,
        authenticator,
        strategies,
        proposal: proposal.proposal_id,
        choice
      });
    },
    finalizeProposal: async (web3: Web3Provider, proposal: Proposal) => {
      const res = await fetch(
        `${manaUrl}/space/${proposal.space.id}/${proposal.proposal_id}/finalize`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            transactions: convertToMetaTransactions(proposal.execution)
          })
        }
      );

      const { error, receipt } = await res.json();
      if (error) throw new Error('Finalization failed');

      return receipt;
    },
    receiveProposal: async (web3: Web3Provider, proposal: Proposal) => {
      await verifyNetwork(web3, l1ChainId);

      const zodiac = new Clients.Zodiac({ signer: web3.getSigner() });

      const executor = proposal.space.executors.find(executor => SUPPORTED_EXECUTORS[executor]);
      if (!executor) throw new Error('Unsupported space');

      return zodiac.receiveProposal(proposal.space.id, executor, {
        transactions: convertToMetaTransactions(proposal.execution)
      });
    },
    executeTransactions: async (web3: Web3Provider, proposal: Proposal) => {
      await verifyNetwork(web3, l1ChainId);

      // TODO: make it dynamic once we have way to fetch it somehow
      const proposalIndex = 3;

      const zodiac = new Clients.Zodiac({ signer: web3.getSigner() });

      const executor = proposal.space.executors.find(executor => SUPPORTED_EXECUTORS[executor]);
      if (!executor) throw new Error('Unsupported space');

      return zodiac.executeProposalTxBatch(
        proposalIndex,
        executor,
        convertToMetaTransactions(proposal.execution)
      );
    },
    send: (envelope: any) => client.send(envelope)
  };
}

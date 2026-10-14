import { CURRENCY } from '@/lib/config';
import { AddressWithLabel } from '@/components/AddressWithLabel';
import { firstOutputAddress, rankedRecipients } from './tx-classification';
import type { TransactionData, TxClassification } from './types';

export function generateTxSummary(
  data: TransactionData,
  classification: TxClassification,
): React.ReactNode {
  const { txType, valueBalance } = classification;

  if (classification.isCoinbase) {
    const recipient = firstOutputAddress(data.outputs);
    const privatePortion = valueBalance < 0 ? Math.abs(valueBalance) : 0;
    if (recipient && privatePortion > 0) {
      return <>This coinbase pays a public reward to <AddressWithLabel address={recipient} /> and {privatePortion.toFixed(4)} {CURRENCY} into Ironwood.</>;
    }
    if (recipient) return <>This coinbase pays a W.cash block reward to <AddressWithLabel address={recipient} />.</>;
    return 'This coinbase creates a W.cash block reward.';
  }

  if (txType === 'IRONWOOD') {
    return 'Fully private W.cash transaction using Ironwood. Public recipients and amounts are not available.';
  }

  if (txType === 'SHIELDING') {
    const amount = Math.abs(valueBalance);
    const fromAddr = data.inputs.find((input) => input.address)?.address;
    return fromAddr
      ? <>{amount.toFixed(4)} {CURRENCY} moved from <AddressWithLabel address={fromAddr} /> into Ironwood.</>
      : `${amount.toFixed(4)} ${CURRENCY} moved from public inputs into Ironwood.`;
  }

  if (txType === 'UNSHIELDING') {
    const amount = Math.abs(valueBalance);
    const toAddr = firstOutputAddress(data.outputs);
    return toAddr
      ? <>{amount.toFixed(4)} {CURRENCY} moved from Ironwood to <AddressWithLabel address={toAddr} />.</>
      : `${amount.toFixed(4)} ${CURRENCY} moved from Ironwood to a public output.`;
  }

  if (txType === 'MIXED') {
    return 'This W.cash transaction combines public inputs or outputs with Ironwood activity. Private recipients remain hidden.';
  }

  const fromAddr = data.inputs.find((input) => input.address)?.address;
  const recipients = rankedRecipients(data.outputs, fromAddr ? [fromAddr] : []);
  const recipient = recipients[0] || null;
  if (fromAddr && recipient) {
    return <><AddressWithLabel address={fromAddr} /> sent {recipient.amount.toFixed(4)} {CURRENCY} to <AddressWithLabel address={recipient.address} />{recipients.length > 1 ? ` and ${recipients.length - 1} other${recipients.length > 2 ? 's' : ''}` : ''}.</>;
  }

  return `A transparent W.cash transaction with ${data.inputs.length} input${data.inputs.length === 1 ? '' : 's'} and ${data.outputs.length} output${data.outputs.length === 1 ? '' : 's'}.`;
}

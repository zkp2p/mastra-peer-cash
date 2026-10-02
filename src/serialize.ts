import type { PrepareResult, PreparedTransaction } from "@zkp2p/cash";

export function jsonSafe(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item)),
  ) as unknown;
}

export function preparedTransactionToJson(transaction: PreparedTransaction) {
  return {
    to: transaction.to,
    data: transaction.data,
    value: transaction.value.toString(),
    chainId: transaction.chainId,
  };
}

export function preparedPlanToJson(
  plan:
    | PrepareResult
    | {
        txs: PreparedTransaction[];
        steps: PrepareResult["steps"];
      },
) {
  return {
    txs: plan.txs.map(preparedTransactionToJson),
    steps: plan.steps,
    ...("accessPolicyRequired" in plan ? { accessPolicyRequired: plan.accessPolicyRequired } : {}),
    ...("accessPolicyPaymentMethods" in plan
      ? { accessPolicyPaymentMethods: plan.accessPolicyPaymentMethods }
      : {}),
    ...("register" in plan ? { register: jsonSafe(plan.register) } : {}),
  };
}
